"use server";

// Yönetim · Kullanıcılar sayfasının işlemleri (yalnızca yönetici): öğrencinin kısa profilini açma,
// "Öğretmenin gözünden bak", ekipten hatırlatma maili, "Öğretmenlikten çıkar" ve 5 saniyelik
// "Geri al".
//
// Her eylem yetkiyi yeniden denetler (Roller izni, yani yönetici; lib/admin/access.ts) ve istek
// sınırından geçer. Bakışlar da kayıt defterine yazılır: profil ya da öğretmenin ekranı her
// açıldığında bir satır. Kayıt yazılamazsa veri de dönmez. Kayıt defteri yalnızca eklenir.

import { refresh } from "next/cache";
import type { GazeView, StudentProfile } from "@/components/admin/users/types";
import { auditTarget, writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { teamReminderMail } from "@/lib/mail/team-reminder-mail";
import type { ReminderKind } from "@/lib/mail/teacher-mail";
import { rateLimit, rateRules, type RateRule } from "@/lib/rate-limit";
import { reminderCooldownMs } from "@/lib/school/bulletin-model";
import { siteUrl } from "@/lib/site";
import { getPermittedAccess } from "./access";
import { getAdminTeachers, getStudentProfile, getTeacherGaze } from "./users";
import { isTeacherAccount, removeUndoOver } from "./users-model";

export type UserActionError =
  | "forbidden"
  | "notFound"
  | "self"
  | "rateLimited"
  | "alreadyReminded"
  | "notNeeded"
  | "mailFailed"
  | "tooLate"
  | "failed";

export type UserActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: UserActionError };

const fail = (error: UserActionError) => ({ ok: false as const, error });

const isId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value);

/** Yönetici ve istek sınırı; değilse ya da sınır dolduysa hata. */
async function adminFor(rule: RateRule) {
  const access = await getPermittedAccess("ROLES");
  if (!access) return fail("forbidden");
  const limit = await rateLimit.consume(rule, access.userId);
  if (!limit.allowed) return fail("rateLimited");
  return { ok: true as const, access };
}

/**
 * Öğrencinin kısa profili. Her açılış kayıt defterine "student.profile_viewed" olarak yazılır;
 * kayıt yazılamazsa profil dönmez.
 */
export async function openStudentProfile(studentId: string): Promise<UserActionResult<{ profile: StudentProfile }>> {
  const gate = await adminFor(rateRules.adminActions);
  if (!gate.ok) return gate;
  if (!isId(studentId)) return fail("notFound");
  try {
    const profile = await getStudentProfile(studentId, new Date());
    if (!profile) return fail("notFound");
    await writeAudit(db, {
      actorId: gate.access.userId,
      action: "student.profile_viewed",
      target: auditTarget.user(studentId),
      details: { name: profile.name },
    });
    return { ok: true, profile };
  } catch (error) {
    console.error("[kullanıcılar] profil açılamadı:", error instanceof Error ? error.message : error);
    return fail("failed");
  }
}

/**
 * "Öğretmenin gözünden bak": öğretmenin Sınıflarım ekranı, salt okunur. Her bakış kayıt
 * defterine "teacher.viewed_as" olarak yazılır; kayıt yazılamazsa ekran dönmez.
 */
export async function viewAsTeacher(teacherId: string): Promise<UserActionResult<{ gaze: GazeView }>> {
  const gate = await adminFor(rateRules.adminActions);
  if (!gate.ok) return gate;
  if (!isId(teacherId)) return fail("notFound");
  try {
    const gaze = await getTeacherGaze(teacherId);
    if (!gaze) return fail("notFound");
    await writeAudit(db, {
      actorId: gate.access.userId,
      action: "teacher.viewed_as",
      target: auditTarget.user(teacherId),
      details: { name: gaze.name },
    });
    return { ok: true, gaze };
  } catch (error) {
    console.error("[kullanıcılar] öğretmenin ekranı açılamadı:", error instanceof Error ? error.message : error);
    return fail("failed");
  }
}

class AlreadyReminded extends Error {}

/**
 * Ekipten hatırlatma maili: türü öğretmenin kurulum adımından sunucuda çıkar ("sınıfını kur",
 * "ilk ödevi ver"...). Aynı öğretmene 24 saatte bir; okul sorumlusunun hatırlatması da sayılır
 * (ikisi de "teacher.reminded" yazar ve aynı kilidi kullanır, lib/teacher/school-actions.ts).
 * Mail gidemezse kayıt yazılmaz, yeniden denenebilir.
 */
export async function remindTeacherAsTeam(teacherId: string): Promise<UserActionResult<{ name: string; kind: ReminderKind }>> {
  const gate = await adminFor(rateRules.reminderMails);
  if (!gate.ok) return gate;
  const { access } = gate;
  if (!isId(teacherId)) return fail("notFound");
  if (teacherId === access.userId) return fail("self");

  const now = new Date();
  const [teacher] = await getAdminTeachers(now, access.userId, { ids: [teacherId] });
  if (!teacher) return fail("notFound");
  const kind = teacher.remind;
  if (!kind) return fail("notNeeded");

  const target = auditTarget.user(teacher.id);
  try {
    await db.$transaction(
      async (tx) => {
        // Aynı öğretmene aynı anda iki hatırlatma gitmesin (Okulum'la aynı kilit).
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`teacher-remind:${teacher.id}`}))`;
        const recent = await tx.auditLog.findFirst({
          where: { action: "teacher.reminded", target, createdAt: { gte: new Date(now.getTime() - reminderCooldownMs) } },
          select: { id: true },
        });
        if (recent) throw new AlreadyReminded();
        await sendMail(teamReminderMail({ to: teacher.email, name: teacher.name, siteUrl: siteUrl(), kind }));
        await writeAudit(tx, { actorId: access.userId, action: "teacher.reminded", target, details: { by: "team", kind, step: teacher.step } });
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (error instanceof AlreadyReminded) return fail("alreadyReminded");
    console.error("[kullanıcılar] hatırlatma gönderilemedi:", error instanceof Error ? error.message : error);
    return fail("mailFailed");
  }
  refresh();
  return { ok: true, name: teacher.name, kind };
}

class TooLate extends Error {}
class NotFound extends Error {}

/** "Öğretmenlikten çıkar"ın kayıttaki ayrıntısı; "Geri al" bununla eski hale döndürür. */
type RemovedDetails = {
  name: string;
  previousRole: "TEACHER" | "ADMIN";
  schoolId: string | null;
  coordinatorOf: string | null;
  archivedClassIds: string[];
};

function readRemoved(details: unknown): RemovedDetails | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  const ids = Array.isArray(d.archivedClassIds) ? d.archivedClassIds.filter((x): x is string => typeof x === "string") : null;
  if ((d.previousRole !== "TEACHER" && d.previousRole !== "ADMIN") || ids === null) return null;
  return {
    name: typeof d.name === "string" ? d.name : "",
    previousRole: d.previousRole,
    schoolId: typeof d.schoolId === "string" ? d.schoolId : null,
    coordinatorOf: typeof d.coordinatorOf === "string" ? d.coordinatorOf : null,
    archivedClassIds: ids,
  };
}

/** Öğretmenin rolüne dokunan işlemler sırayla: öğretmen başına kilit. */
const roleLock = (id: string) => `teacher-role:${id}`;

/**
 * "Öğretmenlikten çıkar": rolü öğretmense normal üye (STUDENT) olur; yöneticinin yöneticiliği
 * sürer, yalnızca okulu kalkar. Sınıfları arşivlenir (öğrencilerden gizlenir; üyelik ve ilerleme
 * silinmez), okul sorumlusuysa sorumluluğu da kalkar. Kişi kendini çıkaramaz.
 */
export async function removeTeacher(teacherId: string): Promise<UserActionResult<{ name: string; coordinatorOf: string | null }>> {
  const gate = await adminFor(rateRules.adminActions);
  if (!gate.ok) return gate;
  const { access } = gate;
  if (!isId(teacherId)) return fail("notFound");
  if (teacherId === access.userId) return fail("self");

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${roleLock(teacherId)}))`;
      const user = await tx.user.findUnique({ where: { id: teacherId }, select: { id: true, displayName: true, role: true, schoolId: true } });
      if (!user || !isTeacherAccount(user)) throw new NotFound();
      const [coordinated, classes] = await Promise.all([
        tx.school.findUnique({ where: { coordinatorId: user.id }, select: { id: true, name: true } }),
        tx.classroom.findMany({ where: { teacherId: user.id, archived: false }, select: { id: true } }),
      ]);
      const classIds = classes.map((c) => c.id);
      if (classIds.length > 0) await tx.classroom.updateMany({ where: { id: { in: classIds } }, data: { archived: true } });
      if (coordinated) await tx.school.update({ where: { id: coordinated.id }, data: { coordinatorId: null } });
      await tx.user.update({ where: { id: user.id }, data: { role: user.role === "ADMIN" ? "ADMIN" : "STUDENT", schoolId: null } });
      const details: RemovedDetails = {
        name: user.displayName,
        previousRole: user.role === "ADMIN" ? "ADMIN" : "TEACHER",
        schoolId: user.schoolId,
        coordinatorOf: coordinated?.id ?? null,
        archivedClassIds: classIds,
      };
      await writeAudit(tx, { actorId: access.userId, action: "teacher.removed", target: auditTarget.user(user.id), details });
      return { name: user.displayName, coordinatorOf: coordinated?.name ?? null };
    });
    refresh();
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof NotFound) return fail("notFound");
    console.error("[kullanıcılar] öğretmenlikten çıkarılamadı:", error instanceof Error ? error.message : error);
    return fail("failed");
  }
}

/**
 * Bildirim kutusundaki "Geri al": aynı yöneticinin son "Öğretmenlikten çıkar"ı, arada hiçbir şey
 * değişmediyse eski haline döner (rol, okul, okul sorumluluğu, arşivlenen sınıflar). Ekranda 5
 * saniye; sunucu yavaş bağlantı için 30 saniyeye kadar kabul eder. Değiştiyse hiçbir şey yapılmaz.
 */
export async function undoRemoveTeacher(teacherId: string): Promise<UserActionResult<{ name: string }>> {
  const gate = await adminFor(rateRules.adminActions);
  if (!gate.ok) return gate;
  const { access } = gate;
  if (!isId(teacherId)) return fail("notFound");
  const target = auditTarget.user(teacherId);

  try {
    const name = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${roleLock(teacherId)}))`;
      const last = await tx.auditLog.findFirst({
        where: { target, action: { in: ["teacher.removed", "teacher.restored"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, action: true, actorId: true, createdAt: true, details: true },
      });
      const removed = last ? readRemoved(last.details) : null;
      if (!last || !removed || last.action !== "teacher.removed" || last.actorId !== access.userId || removeUndoOver(last.createdAt, new Date())) {
        throw new TooLate();
      }

      const user = await tx.user.findUnique({ where: { id: teacherId }, select: { role: true, schoolId: true } });
      const expectedRole = removed.previousRole === "ADMIN" ? "ADMIN" : "STUDENT";
      if (!user || user.role !== expectedRole || user.schoolId !== null) throw new TooLate();
      if (removed.schoolId && !(await tx.school.findUnique({ where: { id: removed.schoolId }, select: { id: true } }))) throw new TooLate();
      if (removed.coordinatorOf) {
        const [school, other] = await Promise.all([
          tx.school.findUnique({ where: { id: removed.coordinatorOf }, select: { coordinatorId: true } }),
          tx.school.findUnique({ where: { coordinatorId: teacherId }, select: { id: true } }),
        ]);
        if (!school || school.coordinatorId !== null || other) throw new TooLate();
      }

      await tx.user.update({ where: { id: teacherId }, data: { role: removed.previousRole, schoolId: removed.schoolId } });
      if (removed.coordinatorOf) await tx.school.update({ where: { id: removed.coordinatorOf }, data: { coordinatorId: teacherId } });
      const restored = await tx.classroom.updateMany({
        where: { id: { in: removed.archivedClassIds }, teacherId, archived: true },
        data: { archived: false },
      });
      await writeAudit(tx, {
        actorId: access.userId,
        action: "teacher.restored",
        target,
        details: {
          name: removed.name,
          undo: last.id,
          role: removed.previousRole,
          schoolId: removed.schoolId,
          coordinatorOf: removed.coordinatorOf,
          restoredClasses: restored.count,
        },
      });
      return removed.name;
    });
    refresh();
    return { ok: true, name };
  } catch (error) {
    if (error instanceof TooLate) return fail("tooLate");
    console.error("[kullanıcılar] geri alınamadı:", error instanceof Error ? error.message : error);
    return fail("failed");
  }
}
