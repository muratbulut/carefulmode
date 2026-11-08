"use server";

// Yönetim · Öğretmen talepleri: Onayla, Bilgi iste, Reddet ve 5 saniyelik "Geri al".
//
// Her eylem yetkiyi yeniden denetler: oturumdaki kişi veritabanındaki güncel haliyle APPLICATIONS
// iznine sahip olmalı (yönetici ya da izinli sorumlu; lib/admin/access.ts). Girdi Zod ile
// denetlenir, istek sınırı uygulanır ve kimse kendi talebine karar veremez. Kararı ortak çekirdek
// verir (lib/teacher/decide.ts): durum kuralları, kayıt defteri satırı, ertelenmiş mail ve belge
// silme oradadır. Onaydaki "en az 2 kontrol" kuralı buradadır; kontrol listesi talebe
// (TeacherApplication.checks) onaydan önce yazılır.

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import { cleanSchoolName, schoolNameOk } from "@/lib/school/names";
import { approveApplication, rejectApplication, requestInfo, undoDecision, type DecideError } from "@/lib/teacher/decide";
import { getPermittedAccess } from "./access";
import {
  applicationIdSchema,
  approveInputSchema,
  checksJson,
  countedChecks,
  infoInputSchema,
  minApprovalChecks,
  rejectInputSchema,
  type ApplicationActionError,
  type ApplicationActionResult,
  type CheckKey,
} from "./application-rules";

const fail = (error: ApplicationActionError) => ({ ok: false as const, error });

/** Çekirdeğin hata kodları ekranın kodlarıyla aynıdır (notFound, invalidState, tooLate...). */
const fromDecide = (error: DecideError): ApplicationActionError => error;

/** İzin ve istek sınırı; kişinin kimliği ya da hata. */
async function reviewer(): Promise<{ ok: true; actorId: string } | { ok: false; error: ApplicationActionError }> {
  const access = await getPermittedAccess("APPLICATIONS");
  if (!access) return fail("forbidden");
  const limit = await rateLimit.consume(rateRules.adminActions, access.userId);
  if (!limit.allowed) return fail("rateLimited");
  return { ok: true, actorId: access.userId };
}

/** Talep var mı ve kişinin kendi talebi değil mi? */
async function reviewable(applicationId: string, actorId: string) {
  const app = await db.teacherApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true, status: true, schoolId: true, institutionalEmail: true, documentName: true },
  });
  if (!app) return fail("notFound");
  if (app.userId === actorId) return fail("ownApplication");
  return { ok: true as const, app };
}

/** Kontrol listesini açık talebe yazar (karar verilmiş talebe dokunmaz). */
async function saveChecks(applicationId: string, checks: CheckKey[]) {
  await db.teacherApplication.updateMany({
    where: { id: applicationId, status: { in: ["PENDING", "INFO_REQUESTED"] } },
    data: { checks: checksJson(checks) },
  });
}

/** Kural geri çevirmesinde sayfa da yenilenir (bu arada karar verilmiş olabilir). */
function refused<T extends object>(error: ApplicationActionError): ApplicationActionResult<T> {
  if (error === "notFound" || error === "invalidState" || error === "tooLate") refresh();
  return fail(error);
}

/**
 * Onayla. En az 2 kontrol işareti gerekir (bilgisi olmayan madde sayılmaz). "Yeni okul"
 * talebinde ya "Bu okul mu?" ile eşlenen okul (aynı il ve ilçede) ya da düzeltilmiş ad verilir;
 * ikisi de yoksa öğretmenin yazdığı ad kullanılır.
 */
export async function approveTeacherApplication(
  input: unknown,
): Promise<ApplicationActionResult<{ schoolCreated: boolean; schoolName: string }>> {
  const parsed = approveInputSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const { applicationId, matchSchoolId, schoolName } = parsed.data;

  const gate = await reviewer();
  if (!gate.ok) return gate;
  const found = await reviewable(applicationId, gate.actorId);
  if (!found.ok) return refused(found.error);
  const { app } = found;

  const checks = countedChecks(parsed.data.checks, { hasEmail: !!app.institutionalEmail, hasDocument: !!app.documentName });
  if (checks.length < minApprovalChecks) return fail("checksRequired");

  let name: string | undefined;
  if (!app.schoolId && !matchSchoolId && schoolName !== undefined) {
    name = cleanSchoolName(schoolName);
    if (!schoolNameOk(name)) return fail("schoolName");
  }

  await saveChecks(app.id, checks);
  const result = await approveApplication({
    applicationId: app.id,
    actorId: gate.actorId,
    ...(app.schoolId ? {} : matchSchoolId ? { matchSchoolId } : name ? { schoolName: name } : {}),
  });
  if (!result.ok) return refused(fromDecide(result.error));

  const school = await db.school.findUnique({ where: { id: result.schoolId }, select: { name: true } });
  refresh();
  return { ok: true, schoolCreated: result.schoolCreated, schoolName: school?.name ?? "" };
}

/** Reddet: not (10-500 karakter) öğretmenin profilinde "Yöneticinin notu" olarak görünür. */
export async function rejectTeacherApplication(input: unknown): Promise<ApplicationActionResult> {
  const parsed = rejectInputSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const gate = await reviewer();
  if (!gate.ok) return gate;
  const found = await reviewable(parsed.data.applicationId, gate.actorId);
  if (!found.ok) return refused(found.error);

  const result = await rejectApplication({ applicationId: found.app.id, actorId: gate.actorId, note: parsed.data.note });
  if (!result.ok) return refused(fromDecide(result.error));
  refresh();
  return { ok: true };
}

/** Bilgi iste: yalnızca bekleyen talepte; soru öğretmenin profiline ve mailine gider. */
export async function requestApplicationInfo(input: unknown): Promise<ApplicationActionResult> {
  const parsed = infoInputSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const gate = await reviewer();
  if (!gate.ok) return gate;
  const found = await reviewable(parsed.data.applicationId, gate.actorId);
  if (!found.ok) return refused(found.error);
  if (found.app.status !== "PENDING") return refused("invalidState");

  const result = await requestInfo({ applicationId: found.app.id, actorId: gate.actorId, question: parsed.data.question });
  if (!result.ok) return refused(fromDecide(result.error));
  // İşaretlenen kontroller kalsın: cevap gelince yeniden işaretlemek gerekmez.
  if (parsed.data.checks) {
    await saveChecks(found.app.id, countedChecks(parsed.data.checks, { hasEmail: !!found.app.institutionalEmail, hasDocument: !!found.app.documentName }));
  }
  refresh();
  return { ok: true };
}

/** Bildirimdeki "Geri al": kişinin bu talepteki son kararı (30 saniye içinde) geri alınır. */
export async function undoApplicationDecision(applicationId: unknown): Promise<ApplicationActionResult> {
  const id = applicationIdSchema.safeParse(applicationId);
  if (!id.success) return fail("invalidInput");
  const gate = await reviewer();
  if (!gate.ok) return gate;
  const found = await reviewable(id.data, gate.actorId);
  if (!found.ok) return refused(found.error);

  const result = await undoDecision({ applicationId: found.app.id, actorId: gate.actorId });
  if (!result.ok) return refused(fromDecide(result.error));
  refresh();
  return { ok: true };
}
