"use server";

// Okulum'daki işlemler (okul sorumlusu): okulundan gelen talebe görüş ("Okulumda çalışıyor,
// onayla" ya da "Tanımıyorum"), 5 saniyelik "Geri al" ve takılan öğretmene hatırlatma maili.
//
// Her eylem yetkiyi yeniden denetler: kişi veritabanındaki güncel haliyle okulun sorumlusu olmalı
// (lib/teacher/access.ts) ve talep ya da öğretmen o okuldan olmalı. Talep kararları ortak çekirdekle
// verilir (lib/teacher/decide.ts); okulun "sorumlu onaylayabilir" seçeneği kapalıysa sorumlu
// yalnızca görüş bildirir, kararı yönetici verir. Her işlem kayıt defterine yazılır.

import { refresh } from "next/cache";
import { auditTarget, writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { reminderMail, type ReminderKind } from "@/lib/mail/teacher-mail";
import { rateLimit, rateRules, type RateRule } from "@/lib/rate-limit";
import { getSchoolFacts } from "@/lib/school/bulletin";
import { canRemind, reminderCooldownMs, reminderKindOf } from "@/lib/school/bulletin-model";
import { siteUrl } from "@/lib/site";
import { getCoordinatorAccess } from "./access";
import { approveApplication, setCoordinatorOpinion, undoDecision, type DecideError } from "./decide";

export type SchoolActionError =
  | "forbidden"
  | "notFound"
  | "invalidState"
  | "tooLate"
  | "rateLimited"
  | "alreadyReminded"
  | "notNeeded"
  | "mailFailed"
  | "failed";

export type SchoolActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: SchoolActionError };

const fail = (error: SchoolActionError) => ({ ok: false as const, error });

function fromDecide(error: DecideError): SchoolActionError {
  if (error === "notFound" || error === "invalidState" || error === "tooLate") return error;
  return "failed";
}

const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;

/** Okulun sorumlusu ve istek sınırı; değilse ya da sınır dolduysa hata. */
async function coordinatorFor(rule: RateRule) {
  const access = await getCoordinatorAccess();
  if (!access) return fail("forbidden");
  const limit = await rateLimit.consume(rule, access.userId);
  if (!limit.allowed) return fail("rateLimited");
  return { ok: true as const, access };
}

/** Sorumlunun okulundan gelen talep (kendi talebi değil). */
async function schoolApplication(applicationId: unknown, schoolId: string, actorId: string) {
  if (!isId(applicationId)) return null;
  const app = await db.teacherApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, schoolId: true, userId: true, user: { select: { displayName: true } } },
  });
  if (!app || app.schoolId !== schoolId || app.userId === actorId) return null;
  return app;
}

/**
 * "Okulumda çalışıyor, onayla": görüş ENDORSED yazılır; okulun sorumlusu onaylayabiliyorsa
 * (School.coordinatorApproves) talep de onaylanır, kişi öğretmen olur. Geri al ikisini birlikte döndürür.
 */
export async function endorseApplication(applicationId: string): Promise<SchoolActionResult<{ approved: boolean; name: string }>> {
  const gate = await coordinatorFor(rateRules.classroomActions);
  if (!gate.ok) return gate;
  const { access } = gate;
  const app = await schoolApplication(applicationId, access.schoolId, access.userId);
  if (!app) return fail("notFound");

  const opinion = await setCoordinatorOpinion({ applicationId: app.id, actorId: access.userId, opinion: "ENDORSED" });
  if (!opinion.ok) return fail(fromDecide(opinion.error));
  const school = await db.school.findUnique({ where: { id: access.schoolId }, select: { coordinatorApproves: true } });
  let approved = false;
  if (school?.coordinatorApproves) {
    const result = await approveApplication({ applicationId: app.id, actorId: access.userId });
    if (!result.ok) {
      // Görüş yazıldı; onay olmadı (o arada yönetici karar vermiş olabilir).
      refresh();
      return fail(fromDecide(result.error));
    }
    approved = true;
  }
  refresh();
  return { ok: true, approved, name: app.user.displayName };
}

/** "Tanımıyorum": talep bekler, yöneticiye "tanımıyorum" notu gider. */
export async function notRecognizeApplication(applicationId: string): Promise<SchoolActionResult<{ name: string }>> {
  const gate = await coordinatorFor(rateRules.classroomActions);
  if (!gate.ok) return gate;
  const { access } = gate;
  const app = await schoolApplication(applicationId, access.schoolId, access.userId);
  if (!app) return fail("notFound");
  const result = await setCoordinatorOpinion({ applicationId: app.id, actorId: access.userId, opinion: "NOT_RECOGNIZED" });
  if (!result.ok) return fail(fromDecide(result.error));
  refresh();
  return { ok: true, name: app.user.displayName };
}

/** Bildirim kutusundaki "Geri al": sorumlunun bu talepteki son kararları geri alınır. */
export async function undoSchoolDecision(applicationId: string): Promise<SchoolActionResult> {
  const gate = await coordinatorFor(rateRules.classroomActions);
  if (!gate.ok) return gate;
  const { access } = gate;
  const app = await schoolApplication(applicationId, access.schoolId, access.userId);
  if (!app) return fail("notFound");
  const result = await undoDecision({ applicationId: app.id, actorId: access.userId });
  if (!result.ok) return fail(fromDecide(result.error));
  refresh();
  return { ok: true };
}

class AlreadyReminded extends Error {}

/**
 * Takılan öğretmene hatırlatma: mail öğretmenin kurulum adımına göre ("sınıfını kur", "ilk ödevi
 * ver"...) seçilir; adım sunucuda hesaplanır. Aynı öğretmene 24 saatte bir (kayıt defterindeki son
 * "teacher.reminded"), sorumlu başına saatlik sınır (rateRules.reminderMails). Mail gidemezse kayıt
 * yazılmaz, yeniden denenebilir.
 */
export async function remindTeacher(teacherId: string): Promise<SchoolActionResult<{ name: string; kind: ReminderKind }>> {
  const gate = await coordinatorFor(rateRules.reminderMails);
  if (!gate.ok) return gate;
  const { access } = gate;
  if (!isId(teacherId)) return fail("notFound");

  const now = new Date();
  const facts = await getSchoolFacts(access.schoolId, now);
  const teacher = facts.teachers.find((t) => t.id === teacherId);
  if (!teacher) return fail("notFound");
  const kind = reminderKindOf(teacher.step);
  if (!kind || !canRemind({ step: teacher.step, fresh: teacher.fresh, isMe: teacher.id === access.userId })) return fail("notNeeded");

  const [user, school] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: teacher.id }, select: { email: true, displayName: true } }),
    db.school.findUniqueOrThrow({ where: { id: access.schoolId }, select: { name: true } }),
  ]);
  const target = auditTarget.user(teacher.id);
  try {
    await db.$transaction(
      async (tx) => {
        // Aynı öğretmene aynı anda iki hatırlatma gitmesin: öğretmen başına kilit.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`teacher-remind:${teacher.id}`}))`;
        const recent = await tx.auditLog.findFirst({
          where: { action: "teacher.reminded", target, createdAt: { gte: new Date(now.getTime() - reminderCooldownMs) } },
          select: { id: true },
        });
        if (recent) throw new AlreadyReminded();
        await sendMail(
          reminderMail({ to: user.email, name: user.displayName, siteUrl: siteUrl(), kind, coordinatorName: access.name, schoolName: school.name }),
        );
        await writeAudit(tx, { actorId: access.userId, action: "teacher.reminded", target, details: { schoolId: access.schoolId, kind, step: teacher.step } });
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (error instanceof AlreadyReminded) return fail("alreadyReminded");
    console.error("[okulum] hatırlatma gönderilemedi:", error instanceof Error ? error.message : error);
    return fail("mailFailed");
  }
  refresh();
  return { ok: true, name: teacher.name, kind };
}
