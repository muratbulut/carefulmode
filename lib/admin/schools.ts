// Okul işlemlerinin sunucu yardımcıları (Kullanıcılar · Okullar, lib/admin/school-admin-actions.ts):
// okul sorumlusu adaylarının sorgusu ve geri al süresinden sonra giden "okul sorumlusu oldun"
// maili. Okullar görünümünün kendi verisi (kartlar, kurulum hunisi) Kullanıcılar sayfasındadır.
// Yalnızca sunucuda.

import "server-only";
import { auditTarget, type AuditAction } from "@/lib/audit";
import { avatarOf } from "@/lib/avatars";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { sendMail } from "@/lib/mail";
import { coordinatorMail } from "@/lib/mail/team-mail";
import { siteUrl } from "@/lib/site";
import { isStudentAccount } from "./access";
import { personMatchWhere } from "./person-search";
import { runAfterUndoWindow } from "./team";
import { entryMeta, personKind, searchLimits, type CoordinatorRefusal, type PersonKind } from "./team-rules";
import { personShown } from "./users-model";

/** Okul sorumlusu penceresindeki kişi. Öğrenci ve üye de listelenir; seçilince neden olamayacağı yazılır. */
export type CoordinatorCandidate = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  kind: PersonKind;
  /** Okulun şu anki sorumlusu. */
  current: boolean;
  /** Sorumlu olamıyorsa nedeni (öğrenci hesabı ya da öğretmen olmayan üye). */
  refusal: Extract<CoordinatorRefusal, "studentAccount" | "notTeacher"> | null;
};

const candidateSelect = {
  id: true,
  displayName: true,
  email: true,
  avatar: true,
  role: true,
  birthYear: true,
  schoolId: true,
  coordinatedSchool: { select: { id: true } },
} as const satisfies Prisma.UserSelect;

type CandidateRow = Prisma.UserGetPayload<{ select: typeof candidateSelect }>;

/** Sorumlu olabilecek ya da (öğrenci, üye) neden olamayacağı gösterilecek kişi mi? */
export function candidateFacts(row: Pick<CandidateRow, "role" | "birthYear" | "schoolId" | "coordinatedSchool">) {
  const kind = personKind(row.role, isStudentAccount(row));
  return { kind, schoolId: row.schoolId, coordinatedSchoolId: row.coordinatedSchool?.id ?? null };
}

function toCandidate(row: CandidateRow, currentId: string | null, typedEmail = ""): CoordinatorCandidate {
  const { kind } = candidateFacts(row);
  return {
    id: row.id,
    // Öğrenci hesabı "Ad S." ve maskeli e-postayla (sorumlu olamaz; yalnızca nedeni gösterilir).
    ...personShown(row, kind === "student", typedEmail),
    avatar: avatarOf(row).emoji,
    kind,
    current: row.id === currentId,
    refusal: kind === "student" ? "studentAccount" : kind === "member" ? "notTeacher" : null,
  };
}

const active = { emailVerified: true, suspended: false, deletionScheduledAt: null } as const satisfies Prisma.UserWhereInput;

/**
 * Okul sorumlusu adayları (Kullanicilar-Son-Okullar): okulun öğretmenleri (okulu bu okul olan
 * öğretmen ve yöneticiler) ve okulu olmayan üyeler. Başka bir okulun öğretmeni ve başka bir okulun
 * sorumlusu listede çıkmaz. Arama yoksa okulun şu anki sorumlusu ve öğretmenleri gelir; yeni okulda
 * (schoolId null) arama gerekir.
 */
export async function coordinatorCandidates(schoolId: string | null, query: string, currentId: string | null, typedEmail = ""): Promise<CoordinatorCandidate[]> {
  const notOtherCoordinator: Prisma.UserWhereInput = schoolId
    ? { OR: [{ coordinatedSchool: { is: null } }, { coordinatedSchool: { is: { id: schoolId } } }] }
    : { coordinatedSchool: { is: null } };
  const sameSchoolOrNone: Prisma.UserWhereInput = schoolId ? { OR: [{ schoolId }, { schoolId: null }] } : { schoolId: null };

  if (!query) {
    if (!schoolId) return [];
    const rows = await db.user.findMany({
      where: { ...active, AND: [notOtherCoordinator, { OR: [{ schoolId, role: { in: ["TEACHER", "ADMIN"] } }, ...(currentId ? [{ id: currentId }] : [])] }] },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
      take: searchLimits.results,
      select: candidateSelect,
    });
    return rows.map((row) => toCandidate(row, currentId)).sort((a, b) => Number(b.current) - Number(a.current));
  }

  // Öğrenci hesabı yalnızca görünen adıyla ya da e-postasının tamamıyla bulunur (lib/admin/person-search.ts).
  const rows = await db.user.findMany({
    where: {
      ...active,
      AND: [notOtherCoordinator, sameSchoolOrNone, await personMatchWhere(query, typedEmail)],
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: searchLimits.results,
    select: candidateSelect,
  });
  return rows.map((row) => toCandidate(row, currentId, typedEmail));
}

/** "Okul sorumlusu oldun" maili, geri al süresinden sonra (atama geri alınmadıysa). */
export function scheduleCoordinatorMail(schoolId: string, op: string) {
  runAfterUndoWindow("okul sorumlusu maili gönderilemedi", () => sendCoordinatorMail(schoolId, op));
}

/**
 * Mail yalnızca atama hâlâ geçerliyse gider: okul duruyor ve sorumlusu hâlâ atanan kişi (arada
 * değiştirilip geri alındıysa da). Aynı kişi bu kayıttan sonra yeniden atandıysa (geri al değil)
 * mail o atamanın zamanlayıcısıyla gider; burada gönderilmez, iki kez gitmesin. Gönderildiyse true.
 */
export async function sendCoordinatorMail(schoolId: string, op: string): Promise<boolean> {
  const entries = await db.auditLog.findMany({
    where: {
      target: auditTarget.school(schoolId),
      action: { in: ["school.coordinator_set", "school.coordinator_removed", "school.updated"] satisfies AuditAction[] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 30,
    select: { action: true, actorId: true, details: true },
  });
  const userOf = (details: unknown) => (details && typeof details === "object" ? (details as Record<string, unknown>).userId : null);
  const entry = entries.find((e) => e.action === "school.coordinator_set" && entryMeta(e.details).op === op && !entryMeta(e.details).undo);
  if (!entry) return false;
  const userId = userOf(entry.details);
  const index = entries.indexOf(entry);
  const assignedAgain = entries
    .slice(0, index)
    .some((e) => e.action === "school.coordinator_set" && !entryMeta(e.details).undo && userOf(e.details) === userId);
  if (assignedAgain) return false;

  const school = await db.school.findUnique({ where: { id: schoolId }, select: { name: true, coordinatorId: true, coordinatorApproves: true } });
  if (!school || typeof userId !== "string" || school.coordinatorId !== userId) return false;
  const [user, actor] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } }),
    db.user.findUnique({ where: { id: entry.actorId }, select: { displayName: true } }),
  ]);
  if (!user) return false;
  await sendMail(
    coordinatorMail({
      to: user.email,
      name: user.displayName,
      siteUrl: siteUrl(),
      actorName: actor?.displayName ?? "",
      schoolName: school.name,
      coordinatorApproves: school.coordinatorApproves,
    }),
  );
  return true;
}
