"use server";

// Okul işlemleri (Kullanıcılar · Okullar, Kullanicilar-Son-Okullar): "Okul ekle" (il ve ilçe
// listeden, aynı adlı okul eklenmez, benzer adda "Yine de ekle"), okul sorumlusu atama, değiştirme,
// kaldırma, "Kendi okulundan gelen öğretmen taleplerini onaylayabilir" seçeneği ve her birinin
// 5 saniyelik "Geri al"ı.
//
// Yalnızca yönetici (ROLES); her eylem erişimi yeniden denetler, girdi Zod ile denetlenir, istek
// sınırı vardır. Değişiklik ve kayıt defteri satırı aynı veritabanı işleminde yazılır; okul satırı
// işlem boyunca kilitlenir. Okul sorumlusu öğretmen ya da yöneticidir (Okulum erişimi bunu ister),
// öğrenci hesabı ve yetişkin üye olamaz; başka okulun öğretmeni ya da sorumlusu olamaz. Okulu
// olmayan öğretmen sorumlu yapılınca okulu bu okul olur (geri alınca boşalır); yöneticinin okulu
// değişmez (okulun öğretmenleri arasında sayılmasın).
//
// Kayıt defteri ayrıntıları (target "school:<id>"; hepsinde op = işlem kimliği):
// - school.created: { op, name, province, district, coordinatorApproves, similar }
// - school.coordinator_set: { op, userId, previousCoordinatorId, coordinatorApproves, previousCoordinatorApproves, schoolIdSet }
// - school.coordinator_removed: { op, userId, coordinatorApproves }
// - school.updated: { op, field: "coordinatorApproves", before, after }
// Geri almanın kendisi { undo: true, undoOf } taşır; okul eklemenin geri alınması okulu siler ve
// school.updated { change: "deleted", name, province, district } yazar (silme türü yok).

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import * as z from "@/lib/zod";
import { auditTarget, writeAudit, type AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { rateLimit, rateRules, type RateRule } from "@/lib/rate-limit";
import { cleanSchoolName, schoolNameKey } from "@/lib/school/names";
import { isPlace } from "@/lib/school/places";
import { getPermittedAccess, type AdminAccess } from "./access";
import { candidateFacts, coordinatorCandidates, scheduleCoordinatorMail, type CoordinatorCandidate } from "./schools";
import { checkSchoolName, cleanQuery, coordinatorRefusal, searchLimits, teamUndoWindowMs, undoBatch, type CoordinatorRefusal } from "./team-rules";
import { typedEmailOf } from "./users-model";

export type SchoolActionError =
  | "forbidden"
  | "rateLimited"
  | "invalid"
  | "place"
  | "name"
  | "duplicate"
  | "similar"
  | "notFound"
  | "notEligible"
  | CoordinatorRefusal
  | "noCoordinator"
  | "inUse"
  | "tooLate"
  | "failed";

/** "similar" hatasında aynı ilçedeki benzer okulların adları da gelir. */
export type SchoolActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: SchoolActionError; similar?: string[] };

const searchRule: RateRule = { name: "admin-person-search", max: 300, windowSec: 10 * 60 };

const fail = (error: SchoolActionError, similar?: string[]) => ({ ok: false as const, error, ...(similar ? { similar } : {}) });

class Refusal extends Error {
  constructor(
    readonly code: SchoolActionError,
    readonly similar?: string[],
  ) {
    super(code);
  }
}

async function gate(rule: RateRule = rateRules.adminActions): Promise<{ ok: true; access: AdminAccess } | { ok: false; error: SchoolActionError }> {
  const access = await getPermittedAccess("ROLES");
  if (!access) return fail("forbidden");
  const limit = await rateLimit.consume(rule, access.userId);
  if (!limit.allowed) return fail("rateLimited");
  return { ok: true, access };
}

const uniqueTarget = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? JSON.stringify(error.meta ?? {}) : null;

async function run<T extends object>(label: string, work: () => Promise<T>): Promise<SchoolActionResult<T>> {
  try {
    return { ok: true, ...(await work()) };
  } catch (error) {
    if (error instanceof Refusal) return fail(error.code, error.similar);
    // Aynı anda aynı ad (il, ilçe, nameKey) ya da aynı sorumlu (coordinatorId) iki kez yazılırsa.
    const unique = uniqueTarget(error);
    if (unique !== null) return fail(unique.includes("coordinatorId") ? "coordinatesOther" : "duplicate");
    console.error(`[yönetim] ${label}:`, error instanceof Error ? error.message : error);
    return fail("failed");
  }
}

type Tx = Prisma.TransactionClient;

const id = z.string().min(1).max(64);
const place = z.string().min(1).max(64);

async function lockSchool(tx: Tx, schoolId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "School" WHERE "id" = ${schoolId} FOR UPDATE`;
  if (rows.length === 0) return null;
  return tx.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: { id: true, name: true, province: true, district: true, coordinatorId: true, coordinatorApproves: true },
  });
}

/** Sorumlu yapılacak kişi: kilitlenir, uygunluğu denetlenir. */
async function lockCandidate(tx: Tx, userId: string, schoolId: string | null) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      role: true,
      birthYear: true,
      schoolId: true,
      emailVerified: true,
      suspended: true,
      deletionScheduledAt: true,
      coordinatedSchool: { select: { id: true } },
    },
  });
  if (!user) throw new Refusal("notFound");
  if (!user.emailVerified || user.suspended || user.deletionScheduledAt) throw new Refusal("notEligible");
  const refusal = coordinatorRefusal(candidateFacts(user), schoolId);
  if (refusal) throw new Refusal(refusal);
  return user;
}

/** Okulu olmayan öğretmen sorumlu olunca okulu bu okul olur; yönetici olduğu gibi kalır. */
const takesSchool = (user: { role: string; schoolId: string | null }) => user.role === "TEACHER" && user.schoolId === null;

// ---------------------------------------------------------------------------------------
// Pencerenin verisi: ilçedeki okullar ve sorumlu adayları
// ---------------------------------------------------------------------------------------

/** "Okul ekle": seçilen ilçedeki okulların adları (benzer ad uyarısı tarayıcıda yazarken çıkar). */
export async function districtSchools(province: string, district: string): Promise<SchoolActionResult<{ names: string[] }>> {
  const g = await gate(searchRule);
  if (!g.ok) return g;
  if (!isPlace(province, district)) return fail("place");
  const rows = await db.school.findMany({ where: { province, district }, orderBy: { name: "asc" }, select: { name: true } });
  return { ok: true, names: rows.map((r) => r.name) };
}

/**
 * Okul sorumlusu adayları (lib/admin/schools.ts coordinatorCandidates). Arama boşsa okulun
 * öğretmenleri ve şu anki sorumlusu; aksi halde en az 3 harf.
 */
export async function searchCoordinators(input: { schoolId: string | null; query: string }): Promise<SchoolActionResult<{ people: CoordinatorCandidate[] }>> {
  const g = await gate(searchRule);
  if (!g.ok) return g;
  const parsed = z.object({ schoolId: id.nullable(), query: z.string().max(200) }).safeParse(input);
  if (!parsed.success) return fail("invalid");
  const q = cleanQuery(parsed.data.query);
  if (q.length > 0 && q.length < searchLimits.min) return fail("invalid");
  const typedEmail = typedEmailOf(parsed.data.query);
  let currentId: string | null = null;
  if (parsed.data.schoolId) {
    const school = await db.school.findUnique({ where: { id: parsed.data.schoolId }, select: { coordinatorId: true } });
    if (!school) return fail("notFound");
    currentId = school.coordinatorId;
  }
  return { ok: true, people: await coordinatorCandidates(parsed.data.schoolId, q, currentId, typedEmail) };
}

// ---------------------------------------------------------------------------------------
// Okul ekle
// ---------------------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().max(200),
  province: place,
  district: place,
  coordinatorId: id.nullable(),
  coordinatorApproves: z.boolean(),
  confirmSimilar: z.boolean(),
});

/**
 * Okulu listeye ekler (ekleyen yazılır). Aynı ilçede aynı adlı okul varsa eklenmez; benzer adlı
 * okul varsa confirmSimilar olmadan "similar" döner (adlarıyla). Sorumlu isteğe bağlıdır.
 */
export async function createSchool(input: {
  name: string;
  province: string;
  district: string;
  coordinatorId: string | null;
  coordinatorApproves: boolean;
  confirmSimilar: boolean;
}): Promise<SchoolActionResult<{ op: string; schoolId: string; schoolName: string; coordinatorName: string | null }>> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { province, district, coordinatorId, coordinatorApproves, confirmSimilar } = parsed.data;
  if (!isPlace(province, district)) return fail("place");
  const actorId = g.access.userId;

  const result = await run("okul eklenemedi", () =>
    db.$transaction(async (tx) => {
      // Aynı ilçeye aynı anda iki okul eklenirken benzer ad denetimi atlanmasın.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`school-add:${province}:${district}`}))`;
      const existing = await tx.school.findMany({ where: { province, district }, select: { name: true } });
      const check = checkSchoolName(parsed.data.name, existing.map((s) => s.name));
      if (check.status === "invalid") throw new Refusal("name");
      if (check.status === "duplicate") throw new Refusal("duplicate");
      if (check.status === "similar" && !confirmSimilar) throw new Refusal("similar", check.names);

      const coordinator = coordinatorId ? await lockCandidate(tx, coordinatorId, null) : null;
      const name = cleanSchoolName(parsed.data.name);
      const school = await tx.school.create({
        data: {
          name,
          nameKey: schoolNameKey(name),
          province,
          district,
          createdById: actorId,
          coordinatorId: coordinator?.id ?? null,
          coordinatorApproves,
        },
        select: { id: true },
      });
      const op = randomUUID();
      const target = auditTarget.school(school.id);
      await writeAudit(tx, {
        actorId,
        action: "school.created",
        target,
        details: { op, name, province, district, coordinatorApproves, similar: check.status === "similar" ? check.names : [] },
      });
      if (coordinator) {
        const schoolIdSet = takesSchool(coordinator);
        if (schoolIdSet) await tx.user.update({ where: { id: coordinator.id }, data: { schoolId: school.id } });
        await writeAudit(tx, {
          actorId,
          action: "school.coordinator_set",
          target,
          details: { op, userId: coordinator.id, previousCoordinatorId: null, coordinatorApproves, previousCoordinatorApproves: null, schoolIdSet },
        });
      }
      return { op, schoolId: school.id, schoolName: name, coordinatorName: coordinator?.displayName ?? null };
    }),
  );
  if (!result.ok) return result;
  if (coordinatorId) scheduleCoordinatorMail(result.schoolId, result.op);
  refresh();
  return result;
}

// ---------------------------------------------------------------------------------------
// Okul sorumlusu
// ---------------------------------------------------------------------------------------

/**
 * Sorumlu atar ya da değiştirir; "onaylayabilir" seçeneği birlikte kaydedilir. Sorumlu aynı
 * kişiyse yalnızca seçenek değişir (school.updated); o da aynıysa changed: false.
 */
export async function setSchoolCoordinator(input: {
  schoolId: string;
  userId: string;
  coordinatorApproves: boolean;
}): Promise<SchoolActionResult<{ changed: boolean; kind: "set" | "approves"; op: string | null; schoolName: string; name: string; coordinatorApproves: boolean }>> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = z.object({ schoolId: id, userId: id, coordinatorApproves: z.boolean() }).safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { schoolId, userId, coordinatorApproves } = parsed.data;
  const actorId = g.access.userId;

  const result = await run("okul sorumlusu atanamadı", () =>
    db.$transaction(async (tx) => {
      const school = await lockSchool(tx, schoolId);
      if (!school) throw new Refusal("notFound");
      const op = randomUUID();
      const target = auditTarget.school(schoolId);

      if (school.coordinatorId === userId) {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } });
        const base = { kind: "approves" as const, schoolName: school.name, name: user.displayName, coordinatorApproves };
        if (school.coordinatorApproves === coordinatorApproves) return { ...base, changed: false, op: null };
        await tx.school.update({ where: { id: schoolId }, data: { coordinatorApproves } });
        await writeAudit(tx, {
          actorId,
          action: "school.updated",
          target,
          details: { op, field: "coordinatorApproves", before: school.coordinatorApproves, after: coordinatorApproves },
        });
        return { ...base, changed: true, op };
      }

      const user = await lockCandidate(tx, userId, schoolId);
      await tx.school.update({ where: { id: schoolId }, data: { coordinatorId: userId, coordinatorApproves } });
      const schoolIdSet = takesSchool(user);
      if (schoolIdSet) await tx.user.update({ where: { id: userId }, data: { schoolId } });
      await writeAudit(tx, {
        actorId,
        action: "school.coordinator_set",
        target,
        details: {
          op,
          userId,
          previousCoordinatorId: school.coordinatorId,
          coordinatorApproves,
          previousCoordinatorApproves: school.coordinatorApproves,
          schoolIdSet,
        },
      });
      return { changed: true, kind: "set" as const, op, schoolName: school.name, name: user.displayName, coordinatorApproves };
    }),
  );
  if (!result.ok) return result;
  if (result.changed) {
    if (result.kind === "set" && result.op) scheduleCoordinatorMail(schoolId, result.op);
    refresh();
  }
  return result;
}

/** "Sorumluyu kaldır": okul sorumlusuz kalır, talepleri yönetim onaylar. Kişinin okulu değişmez. */
export async function removeSchoolCoordinator(schoolId: string): Promise<SchoolActionResult<{ op: string; schoolName: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = id.safeParse(schoolId);
  if (!parsed.success) return fail("invalid");
  const actorId = g.access.userId;

  const result = await run("okul sorumlusu kaldırılamadı", () =>
    db.$transaction(async (tx) => {
      const school = await lockSchool(tx, parsed.data);
      if (!school) throw new Refusal("notFound");
      if (!school.coordinatorId) throw new Refusal("noCoordinator");
      await tx.school.update({ where: { id: school.id }, data: { coordinatorId: null } });
      const op = randomUUID();
      await writeAudit(tx, {
        actorId,
        action: "school.coordinator_removed",
        target: auditTarget.school(school.id),
        details: { op, userId: school.coordinatorId, coordinatorApproves: school.coordinatorApproves },
      });
      return { op, schoolName: school.name };
    }),
  );
  if (result.ok) refresh();
  return result;
}

// ---------------------------------------------------------------------------------------
// Geri al
// ---------------------------------------------------------------------------------------

type Details = Record<string, unknown>;
const asId = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : null);

// Aynı işlemin kayıtları: önce sorumlu ve seçenek, en son okulun kendisi geri alınır.
const revertOrder: Record<string, number> = { "school.updated": 0, "school.coordinator_set": 1, "school.coordinator_removed": 1, "school.created": 2 };

async function revert(tx: Tx, schoolId: string, entry: { id: string; action: string; details: unknown }, actorId: string) {
  const d = (entry.details ?? {}) as Details;
  const school = await tx.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, province: true, district: true, coordinatorId: true, coordinatorApproves: true },
  });
  if (!school) throw new Refusal("tooLate");
  const target = auditTarget.school(schoolId);
  const op = randomUUID();
  const undo = { op, undo: true, undoOf: entry.id };

  switch (entry.action as AuditAction) {
    case "school.updated": {
      if (d.field !== "coordinatorApproves" || typeof d.before !== "boolean" || school.coordinatorApproves !== d.after) throw new Refusal("tooLate");
      await tx.school.update({ where: { id: schoolId }, data: { coordinatorApproves: d.before } });
      await writeAudit(tx, { actorId, action: "school.updated", target, details: { ...undo, field: "coordinatorApproves", before: d.after, after: d.before } });
      return;
    }
    case "school.coordinator_set": {
      const userId = asId(d.userId);
      const previous = asId(d.previousCoordinatorId);
      if (!userId || school.coordinatorId !== userId) throw new Refusal("tooLate");
      const approves = typeof d.previousCoordinatorApproves === "boolean" ? d.previousCoordinatorApproves : school.coordinatorApproves;
      await tx.school.update({ where: { id: schoolId }, data: { coordinatorId: previous, coordinatorApproves: approves } });
      if (d.schoolIdSet === true) await tx.user.updateMany({ where: { id: userId, schoolId }, data: { schoolId: null } });
      if (previous) {
        await writeAudit(tx, {
          actorId,
          action: "school.coordinator_set",
          target,
          details: { ...undo, userId: previous, previousCoordinatorId: userId, coordinatorApproves: approves, previousCoordinatorApproves: school.coordinatorApproves, schoolIdSet: false },
        });
      } else {
        await writeAudit(tx, { actorId, action: "school.coordinator_removed", target, details: { ...undo, userId, coordinatorApproves: school.coordinatorApproves } });
      }
      return;
    }
    case "school.coordinator_removed": {
      const userId = asId(d.userId);
      if (!userId || school.coordinatorId !== null) throw new Refusal("tooLate");
      await tx.school.update({ where: { id: schoolId }, data: { coordinatorId: userId } });
      await writeAudit(tx, {
        actorId,
        action: "school.coordinator_set",
        target,
        details: { ...undo, userId, previousCoordinatorId: null, coordinatorApproves: school.coordinatorApproves, previousCoordinatorApproves: school.coordinatorApproves, schoolIdSet: false },
      });
      return;
    }
    case "school.created": {
      // Okula bu arada öğretmen ya da talep bağlandıysa okul silinmez.
      if (school.coordinatorId) throw new Refusal("tooLate");
      const [teachers, applications] = [
        await tx.user.count({ where: { schoolId } }),
        await tx.teacherApplication.count({ where: { schoolId } }),
      ];
      if (teachers > 0 || applications > 0) throw new Refusal("inUse");
      await tx.school.delete({ where: { id: schoolId } });
      await writeAudit(tx, {
        actorId,
        action: "school.updated",
        target,
        details: { ...undo, change: "deleted", name: school.name, province: school.province, district: school.district },
      });
      return;
    }
    default:
      throw new Refusal("tooLate");
  }
}

/**
 * Bildirim kutusundaki "Geri al": bu okuldaki son işlemi (op) geri alır; işlemi yapan yönetici,
 * geri al süresi içinde ve arada başka değişiklik yoksa (team-rules.ts undoBatch). "Okul ekle"
 * sorumluyla birlikte geri alınır; okul ancak hiçbir şey bağlanmadıysa silinir.
 */
export async function undoSchoolChange(input: { schoolId: string; op: string }): Promise<SchoolActionResult<{ schoolName: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = z.object({ schoolId: id, op: z.string().min(8).max(64) }).safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { schoolId, op } = parsed.data;
  const actorId = g.access.userId;

  const result = await run("okul işlemi geri alınamadı", () =>
    db.$transaction(async (tx) => {
      const school = await lockSchool(tx, schoolId);
      if (!school) throw new Refusal("notFound");
      const now = new Date();
      const entries = await tx.auditLog.findMany({
        where: {
          target: auditTarget.school(schoolId),
          action: { in: ["school.created", "school.updated", "school.coordinator_set", "school.coordinator_removed"] satisfies AuditAction[] },
          createdAt: { gte: new Date(now.getTime() - 10 * teamUndoWindowMs) },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: { id: true, actorId: true, action: true, createdAt: true, details: true },
      });
      const batch = undoBatch(entries, op, actorId, now).sort((a, b) => (revertOrder[a.action] ?? 9) - (revertOrder[b.action] ?? 9));
      if (batch.length === 0) throw new Refusal("tooLate");
      for (const entry of batch) await revert(tx, schoolId, entry, actorId);
      return { schoolName: school.name };
    }),
  );
  if (result.ok) refresh();
  return result;
}
