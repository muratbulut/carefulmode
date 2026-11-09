"use server";

// Yönetim ekibi işlemleri (Kullanıcılar · Yönetim ekibi, Kullanicilar-Son): kişi arama, ekibe
// ekleme, izinleri ve rolü düzenleme, ekipten çıkarma ve her birinin 5 saniyelik "Geri al"ı.
//
// Yalnızca yönetici (ROLES izni yalnızca yöneticide); her eylem erişimi veritabanındaki güncel
// rolle yeniden denetler (getPermittedAccess). Girdi Zod ile denetlenir, istek sınırı vardır.
// Değişiklik ve kayıt defteri satırı aynı veritabanı işleminde yazılır; ekip değişiklikleri
// sırayla yapılır (lockTeam). Erişim her istekte yeniden okunduğu için izin değişikliği bir
// sonraki istekte geçerlidir.
//
// Kurallar: öğrenci hesabı yalnızca Sorumlu olur, yalnızca İpucu ve Gündem alır; ROLES hiç
// verilmez; sorumluya en az bir izin verilir. Yönetici kendini çıkaramaz ve kendi rolünü
// değiştiremez; son yönetici yöneticilikten çıkarılamaz; ADMIN_EMAILS'teki yönetici (girişte
// yeniden yönetici olur) buradan çıkarılamaz. Yönetici yapılan kişinin önceki rolü kayda yazılır;
// yöneticilikten çıkınca o role (öğretmenlik izi varsa öğretmenliğe) döner (lib/admin/team.ts).
//
// Kayıt defteri ayrıntıları (target "user:<id>"; hepsinde op = işlem kimliği, geri al bunu kullanır):
// - team.added: { op, role: "ADMIN" | "MEMBER", permissions, previousRole, newRole, studentAccount }
// - team.permissions_changed: { op, before: { role, permissions }, after: { role, permissions },
//   previousRole, newRole, added, removed, removedRows }
// - team.removed: { op, role, permissions, rows, previousRole, newRole }
// Geri almanın kendisi ters işlemin türüyle yazılır ve { undo: true, undoOf: <kayıt kimliği> } taşır
// (eklemenin geri alınması team.removed gibi).

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import * as z from "@/lib/zod";
import { auditTarget, writeAudit, type AuditAction } from "@/lib/audit";
import { avatarOf } from "@/lib/avatars";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Role } from "@/lib/generated/prisma/enums";
import { rateLimit, rateRules, type RateRule } from "@/lib/rate-limit";
import { allowedPermissions, getPermittedAccess, isStudentAccount, teamPermissionList, type AdminAccess, type TeamPermission } from "./access";
import { isConfiguredAdminEmail } from "./admin-emails";
import { personMatchWhere } from "./person-search";
import { formerRoleOf, lockTeam, otherActiveAdmins, scheduleTeamAddedMail } from "./team";
import {
  cleanQuery,
  grantRefusal,
  personKind,
  samePermissions,
  searchLimits,
  sortPermissions,
  permissionDiff,
  teamRoles,
  teamUndoWindowMs,
  undoBatch,
  type GrantRefusal,
  type PersonKind,
  type TeamRole,
} from "./team-rules";
import { personShown, typedEmailOf } from "./users-model";

export type TeamActionError =
  | "forbidden"
  | "rateLimited"
  | "invalid"
  | "notFound"
  | "notEligible"
  | "alreadyInTeam"
  | "notInTeam"
  | GrantRefusal
  | "self"
  | "lastAdmin"
  | "configuredAdmin"
  | "tooLate"
  | "failed";

export type TeamActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: TeamActionError };

/** "Ekibe kişi ekle" aramasının sonucu. Yöneticiye e-posta da gösterilir (Kullanicilar-Son); öğrencide maskeli. */
export type TeamCandidate = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  kind: PersonKind;
  /** Bu kişiye verilebilecek izinler (öğrenci hesabında yalnızca İpucu ve Gündem). */
  allowed: TeamPermission[];
};

// Arama yazdıkça çalışır; sınır yalnızca betikle taramayı keser.
const searchRule: RateRule = { name: "admin-person-search", max: 300, windowSec: 10 * 60 };

const fail = (error: TeamActionError) => ({ ok: false as const, error });

/** İşlemin içinden kuralla geri çevirme: işlem geri döner, çağırana hata kodu gider. */
class Refusal extends Error {
  constructor(readonly code: TeamActionError) {
    super(code);
  }
}

/** Yönetici ve istek sınırı; değilse ya da sınır dolduysa hata. */
async function gate(rule: RateRule = rateRules.adminActions): Promise<{ ok: true; access: AdminAccess } | { ok: false; error: TeamActionError }> {
  const access = await getPermittedAccess("ROLES");
  if (!access) return fail("forbidden");
  const limit = await rateLimit.consume(rule, access.userId);
  if (!limit.allowed) return fail("rateLimited");
  return { ok: true, access };
}

async function run<T extends object>(label: string, work: () => Promise<T>): Promise<TeamActionResult<T>> {
  try {
    return { ok: true, ...(await work()) };
  } catch (error) {
    if (error instanceof Refusal) return fail(error.code);
    console.error(`[yönetim] ${label}:`, error instanceof Error ? error.message : error);
    return fail("failed");
  }
}

const id = z.string().min(1).max(64);
const grantSchema = z.object({
  userId: id,
  role: z.enum(teamRoles),
  permissions: z.array(z.enum(teamPermissionList)).max(teamPermissionList.length * 2),
});
const undoSchema = z.object({ userId: id, op: z.string().min(8).max(64) });

type Tx = Prisma.TransactionClient;

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  emailVerified: true,
  suspended: true,
  deletionScheduledAt: true,
  role: true,
  birthYear: true,
  schoolId: true,
  teamPermissions: { select: { permission: true, grantedById: true, grantedAt: true } },
} as const satisfies Prisma.UserSelect;

type TeamUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;

const loadUser = (tx: Tx, userId: string) => tx.user.findUnique({ where: { id: userId }, select: userSelect });

const inTeam = (user: TeamUser) => user.role === "ADMIN" || user.teamPermissions.length > 0;
const teamRoleOf = (user: TeamUser): TeamRole => (user.role === "ADMIN" ? "ADMIN" : "MEMBER");
const rowsOf = (user: TeamUser) =>
  user.teamPermissions.map((row) => ({ permission: row.permission, grantedById: row.grantedById, grantedAt: row.grantedAt.toISOString() }));
const permissionsOf = (user: TeamUser) => (user.role === "ADMIN" ? [] : sortPermissions(user.teamPermissions.map((p) => p.permission)));

/** Yöneticilikten çıkarma denetimleri: ADMIN_EMAILS'teki yönetici ve son yönetici çıkarılamaz. */
async function assertCanLeaveAdmin(tx: Tx, user: TeamUser) {
  if (isConfiguredAdminEmail(user.email)) throw new Refusal("configuredAdmin");
  if ((await otherActiveAdmins(tx, user.id)) === 0) throw new Refusal("lastAdmin");
}

// ---------------------------------------------------------------------------------------
// Kişi arama
// ---------------------------------------------------------------------------------------

/**
 * "1 · Kim?": ad ya da e-postada geçen metinle (en az 3 harf) var olan, e-postası doğrulanmış,
 * askıda olmayan ve ekipte olmayan hesaplar; en fazla 8 kişi. Öğrenci yalnızca görünen adıyla
 * ("Ayşe Y.") ya da e-postasının tamamıyla bulunur ve öyle gösterilir (lib/admin/person-search.ts).
 */
export async function searchTeamCandidates(query: string): Promise<TeamActionResult<{ people: TeamCandidate[] }>> {
  const g = await gate(searchRule);
  if (!g.ok) return g;
  const raw = typeof query === "string" ? query.slice(0, 200) : "";
  const q = cleanQuery(raw);
  if (q.length < searchLimits.min) return fail("invalid");
  const typedEmail = typedEmailOf(raw);
  const rows = await db.user.findMany({
    where: {
      emailVerified: true,
      suspended: false,
      deletionScheduledAt: null,
      role: { not: "ADMIN" },
      teamPermissions: { none: {} },
      AND: [await personMatchWhere(q, typedEmail, { notInTeam: true })],
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: searchLimits.results,
    select: { id: true, displayName: true, email: true, avatar: true, role: true, birthYear: true },
  });
  return {
    ok: true,
    people: rows.map((row) => {
      const studentAccount = isStudentAccount(row);
      return {
        id: row.id,
        ...personShown(row, studentAccount, typedEmail),
        avatar: avatarOf(row).emoji,
        kind: personKind(row.role, studentAccount),
        allowed: allowedPermissions(row).filter((p) => p !== "ROLES"),
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------
// Ekibe ekle
// ---------------------------------------------------------------------------------------

/**
 * Var olan hesabı ekibe ekler: Yönetici (rolü ADMIN olur; önceki rolü kayda yazılır) ya da
 * Sorumlu (seçilen izinler, ekleyen yazılarak). "Ekibe eklendin" maili geri al süresinden sonra gider.
 */
export async function addTeamMember(input: { userId: string; role: TeamRole; permissions: TeamPermission[] }): Promise<TeamActionResult<{ op: string; name: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { userId, role } = parsed.data;
  const permissions = sortPermissions(parsed.data.permissions);
  const actorId = g.access.userId;

  const result = await run("ekibe eklenemedi", () =>
    db.$transaction(async (tx) => {
      await lockTeam(tx);
      const user = await loadUser(tx, userId);
      if (!user) throw new Refusal("notFound");
      if (!user.emailVerified || user.suspended || user.deletionScheduledAt) throw new Refusal("notEligible");
      if (inTeam(user)) throw new Refusal("alreadyInTeam");
      const studentAccount = isStudentAccount(user);
      const refusal = grantRefusal({ role, permissions, studentAccount, allowed: allowedPermissions(user) });
      if (refusal) throw new Refusal(refusal);

      const op = randomUUID();
      const newRole: Role = role === "ADMIN" ? "ADMIN" : user.role;
      if (role === "ADMIN") {
        await tx.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
      } else {
        await tx.teamPermission.createMany({ data: permissions.map((permission) => ({ userId, permission, grantedById: actorId })) });
      }
      await writeAudit(tx, {
        actorId,
        action: "team.added",
        target: auditTarget.user(userId),
        details: { op, role, permissions: role === "ADMIN" ? [] : permissions, previousRole: user.role, newRole, studentAccount },
      });
      return { op, name: user.displayName };
    }),
  );
  if (!result.ok) return result;
  scheduleTeamAddedMail(userId, result.op);
  refresh();
  return result;
}

// ---------------------------------------------------------------------------------------
// İzinleri düzenle
// ---------------------------------------------------------------------------------------

/**
 * "İzinleri düzenle": rolü (Sorumlu ↔ Yönetici) ve sorumlunun izinlerini değiştirir. Yönetici
 * yapılan kişinin izin satırları silinir (yönetici her şeyi yapar; satırlar kayda yazılır, geri
 * alınca döner). Hiçbir şey değişmediyse changed: false (kayıt yazılmaz). Sorumluyu izinsiz
 * bırakmak "Ekipten çıkar"dır, burada geri çevrilir.
 */
export async function updateTeamMember(input: {
  userId: string;
  role: TeamRole;
  permissions: TeamPermission[];
}): Promise<TeamActionResult<{ changed: boolean; op: string | null; name: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { userId, role } = parsed.data;
  const actorId = g.access.userId;
  const requested = sortPermissions(parsed.data.permissions);

  const result = await run("izinler kaydedilemedi", () =>
    db.$transaction(async (tx) => {
      await lockTeam(tx);
      const user = await loadUser(tx, userId);
      if (!user) throw new Refusal("notFound");
      if (user.id === actorId) throw new Refusal("self");
      if (!inTeam(user)) throw new Refusal("notInTeam");

      const before = { role: teamRoleOf(user), permissions: permissionsOf(user) };
      const permissions = role === "ADMIN" ? [] : requested;
      if (before.role === role && samePermissions(before.permissions, permissions)) return { changed: false, op: null, name: user.displayName };

      // Sorumlu olacak yöneticinin yeni rolü önce belirlenir (öğrenci hesabı mı, ona göre izinler).
      let newRole: Role = user.role;
      if (before.role === "ADMIN" && role === "MEMBER") {
        await assertCanLeaveAdmin(tx, user);
        newRole = await formerRoleOf(tx, user);
      }
      if (role === "ADMIN") {
        if (before.role !== "ADMIN" && (!user.emailVerified || user.suspended || user.deletionScheduledAt)) throw new Refusal("notEligible");
        newRole = "ADMIN";
      }
      const shape = { role: newRole === "ADMIN" ? user.role : newRole, birthYear: user.birthYear };
      const studentAccount = isStudentAccount(shape);
      const refusal = grantRefusal({ role, permissions, studentAccount, allowed: allowedPermissions(shape) });
      if (refusal) throw new Refusal(refusal);

      const { added, removed } = permissionDiff(before.permissions, permissions);
      const removedRows = rowsOf(user).filter((row) => !permissions.includes(row.permission as TeamPermission));
      if (newRole !== user.role) await tx.user.update({ where: { id: userId }, data: { role: newRole } });
      if (removedRows.length) {
        await tx.teamPermission.deleteMany({ where: { userId, permission: { in: removedRows.map((r) => r.permission as TeamPermission) } } });
      }
      if (added.length) {
        await tx.teamPermission.createMany({ data: added.map((permission) => ({ userId, permission, grantedById: actorId })) });
      }
      const op = randomUUID();
      await writeAudit(tx, {
        actorId,
        action: "team.permissions_changed",
        target: auditTarget.user(userId),
        details: { op, before, after: { role, permissions }, previousRole: user.role, newRole, added, removed, removedRows },
      });
      return { changed: true, op, name: user.displayName };
    }),
  );
  if (result.ok && result.changed) refresh();
  return result;
}

// ---------------------------------------------------------------------------------------
// Ekipten çıkar
// ---------------------------------------------------------------------------------------

/**
 * "Ekipten çıkar": izin satırları silinir; yönetici yöneticilikten çıkar ve önceki rolüne döner.
 * Hesap silinmez, yaptığı işler kayıt defterinde kalır.
 */
export async function removeTeamMember(userId: string): Promise<TeamActionResult<{ op: string; name: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = id.safeParse(userId);
  if (!parsed.success) return fail("invalid");
  const actorId = g.access.userId;

  const result = await run("ekipten çıkarılamadı", () =>
    db.$transaction(async (tx) => {
      await lockTeam(tx);
      const user = await loadUser(tx, parsed.data);
      if (!user) throw new Refusal("notFound");
      if (user.id === actorId) throw new Refusal("self");
      if (!inTeam(user)) throw new Refusal("notInTeam");
      let newRole: Role = user.role;
      if (user.role === "ADMIN") {
        await assertCanLeaveAdmin(tx, user);
        newRole = await formerRoleOf(tx, user);
        await tx.user.update({ where: { id: user.id }, data: { role: newRole } });
      }
      await tx.teamPermission.deleteMany({ where: { userId: user.id } });
      const op = randomUUID();
      await writeAudit(tx, {
        actorId,
        action: "team.removed",
        target: auditTarget.user(user.id),
        details: { op, role: teamRoleOf(user), permissions: permissionsOf(user), rows: rowsOf(user), previousRole: user.role, newRole },
      });
      return { op, name: user.displayName };
    }),
  );
  if (result.ok) refresh();
  return result;
}

// ---------------------------------------------------------------------------------------
// Geri al
// ---------------------------------------------------------------------------------------

type Details = Record<string, unknown>;
type Row = { permission: string; grantedById: string; grantedAt: string };

const asRole = (value: unknown): Role | null => (value === "STUDENT" || value === "TEACHER" || value === "ADMIN" ? value : null);
const asList = (value: unknown): TeamPermission[] => (Array.isArray(value) ? sortPermissions(value.filter((v): v is string => typeof v === "string")) : []);
const asRows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter(
        (r): r is Row =>
          !!r && typeof r === "object" && typeof r.permission === "string" && typeof r.grantedById === "string" && typeof r.grantedAt === "string",
      )
    : [];
const asState = (value: unknown) => {
  const d = (value ?? {}) as Details;
  return { role: d.role === "ADMIN" ? ("ADMIN" as const) : ("MEMBER" as const), permissions: asList(d.permissions) };
};

/** Kişinin şu anki hali kayıttaki "sonra" haliyle aynı mı? Değilse arada değişmiştir; geri alınmaz. */
function matches(user: TeamUser, role: Role, permissions: readonly string[]) {
  return user.role === role && samePermissions(user.teamPermissions.map((p) => p.permission), permissions);
}

async function restoreRows(tx: Tx, userId: string, rows: Row[]) {
  if (rows.length === 0) return;
  await tx.teamPermission.createMany({
    data: rows
      .filter((r) => (teamPermissionList as readonly string[]).includes(r.permission))
      .map((r) => ({ userId, permission: r.permission as TeamPermission, grantedById: r.grantedById, grantedAt: new Date(r.grantedAt) })),
    skipDuplicates: true,
  });
}

/** Bir kaydı geri alır ve geri almayı (ters türle, undo: true) kayda yazar. */
async function revert(tx: Tx, user: TeamUser, entry: { id: string; action: string; details: unknown }, actorId: string) {
  const d = (entry.details ?? {}) as Details;
  const previousRole = asRole(d.previousRole);
  const newRole = asRole(d.newRole);
  if (!previousRole || !newRole) throw new Refusal("tooLate");
  const op = randomUUID();
  const target = auditTarget.user(user.id);

  switch (entry.action as AuditAction) {
    case "team.added": {
      const role = d.role === "ADMIN" ? "ADMIN" : "MEMBER";
      const permissions = asList(d.permissions);
      if (!matches(user, newRole, permissions)) throw new Refusal("tooLate");
      await tx.teamPermission.deleteMany({ where: { userId: user.id } });
      if (user.role !== previousRole) await tx.user.update({ where: { id: user.id }, data: { role: previousRole } });
      await writeAudit(tx, {
        actorId,
        action: "team.removed",
        target,
        details: { op, undo: true, undoOf: entry.id, role, permissions, rows: rowsOf(user), previousRole: newRole, newRole: previousRole },
      });
      return;
    }
    case "team.removed": {
      if (inTeam(user) || user.role !== newRole) throw new Refusal("tooLate");
      const rows = asRows(d.rows);
      if (previousRole !== user.role) await tx.user.update({ where: { id: user.id }, data: { role: previousRole } });
      await restoreRows(tx, user.id, rows);
      await writeAudit(tx, {
        actorId,
        action: "team.added",
        target,
        details: {
          op,
          undo: true,
          undoOf: entry.id,
          role: d.role === "ADMIN" ? "ADMIN" : "MEMBER",
          permissions: asList(d.permissions),
          previousRole: newRole,
          newRole: previousRole,
          studentAccount: isStudentAccount({ role: previousRole, birthYear: user.birthYear }),
        },
      });
      return;
    }
    case "team.permissions_changed": {
      const before = asState(d.before);
      const afterState = asState(d.after);
      if (!matches(user, newRole, afterState.permissions)) throw new Refusal("tooLate");
      const { added } = permissionDiff(before.permissions, afterState.permissions);
      if (added.length) await tx.teamPermission.deleteMany({ where: { userId: user.id, permission: { in: added } } });
      if (previousRole !== user.role) await tx.user.update({ where: { id: user.id }, data: { role: previousRole } });
      await restoreRows(tx, user.id, asRows(d.removedRows));
      const diff = permissionDiff(afterState.permissions, before.permissions);
      await writeAudit(tx, {
        actorId,
        action: "team.permissions_changed",
        target,
        details: {
          op,
          undo: true,
          undoOf: entry.id,
          before: afterState,
          after: before,
          previousRole: newRole,
          newRole: previousRole,
          added: diff.added,
          removed: diff.removed,
          removedRows: [],
        },
      });
      return;
    }
    default:
      throw new Refusal("tooLate");
  }
}

/**
 * Bildirim kutusundaki "Geri al": bu kişinin son ekip işlemini (op) geri alır. İşlemi yapan
 * yönetici, geri al süresi içinde ve arada başka değişiklik yoksa (team-rules.ts undoBatch).
 * "Ekibe eklendin" maili süre bitmeden gitmediği için geri alınacak mail yoktur.
 */
export async function undoTeamChange(input: { userId: string; op: string }): Promise<TeamActionResult<{ name: string }>> {
  const g = await gate();
  if (!g.ok) return g;
  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const { userId, op } = parsed.data;
  const actorId = g.access.userId;

  const result = await run("ekip işlemi geri alınamadı", () =>
    db.$transaction(async (tx) => {
      await lockTeam(tx);
      const user = await loadUser(tx, userId);
      if (!user) throw new Refusal("notFound");
      const now = new Date();
      const entries = await tx.auditLog.findMany({
        where: {
          target: auditTarget.user(userId),
          action: { in: ["team.added", "team.permissions_changed", "team.removed"] satisfies AuditAction[] },
          createdAt: { gte: new Date(now.getTime() - 10 * teamUndoWindowMs) },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 20,
        select: { id: true, actorId: true, action: true, createdAt: true, details: true },
      });
      const batch = undoBatch(entries, op, actorId, now);
      if (batch.length !== 1) throw new Refusal("tooLate");
      await revert(tx, user, batch[0], actorId);
      return { name: user.displayName };
    }),
  );
  if (result.ok) refresh();
  return result;
}
