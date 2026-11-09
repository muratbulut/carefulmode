// Yönetim ekibi verisi (Kullanıcılar · Yönetim ekibi sekmesi) ve ekip işlemlerinin sunucu
// yardımcıları: ekipten çıkan yöneticinin rolü, geri al süresinden sonra giden "ekibe eklendin"
// maili. Ekip = rolü ADMIN olanlar ve en az bir TeamPermission satırı olanlar. Yönetici izin
// satırı tutmaz (her şeyi yapar); sorumlunun izinleri satırlardadır. Yalnızca sunucuda.

import "server-only";
import { after } from "next/server";
import { auditTarget, type AuditAction } from "@/lib/audit";
import { avatarOf } from "@/lib/avatars";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { sendMail } from "@/lib/mail";
import { teamAddedMail } from "@/lib/mail/team-mail";
import { siteUrl } from "@/lib/site";
import { allowedPermissions, effectivePermissions, isStudentAccount, requireAdmin, type TeamPermission } from "./access";
import { isConfiguredAdminEmail } from "./admin-emails";
import { afterUndoDelayMs, entryMeta, formerRole, grantableOrder, sortPermissions, type TeamRole } from "./team-rules";

export type TeamMemberView = {
  id: string;
  name: string;
  /** Avatar emojisi. */
  avatar: string;
  role: TeamRole;
  /** Öğrenci hesabı (yalnızca İpucu ve Gündem alabilir, yönetici olamaz). */
  studentAccount: boolean;
  /** Geçerli izinler (yöneticide hepsi). */
  permissions: TeamPermission[];
  /** "İzinleri düzenle"de açılabilen izinler (ROLES hiç). */
  allowed: TeamPermission[];
  /** Ekibe eklendiği an (ISO); bilinmiyorsa null. */
  addedAt: string | null;
  /** Ekleyenin adı; bilinmiyorsa ya da ADMIN_EMAILS ile geldiyse null. */
  addedBy: string | null;
  /** İlk yöneticilerden (ADMIN_EMAILS ile gelen yönetici). */
  founder: boolean;
  /** Sayfaya bakan yöneticinin kendisi (kendi kartında "İzinleri düzenle" yok). */
  me: boolean;
  /** ADMIN_EMAILS'te: girişte yeniden yönetici olur, buradan yöneticilikten çıkarılamaz. */
  configuredAdmin: boolean;
};

const memberSelect = {
  id: true,
  displayName: true,
  email: true,
  avatar: true,
  role: true,
  birthYear: true,
  teamPermissions: { select: { permission: true, grantedAt: true, grantedBy: { select: { displayName: true } } }, orderBy: { grantedAt: "asc" } },
} as const satisfies Prisma.UserSelect;

/**
 * Yönetim ekibi sekmesi: yöneticiler önce, sonra sorumlular; ikisi de ekibe giriş sırasıyla.
 * "Eklendi" ve "ekleyen" kayıt defterindeki son "team.added" (ya da ADMIN_EMAILS ile yükseltme)
 * kaydından, o yoksa en eski izin satırından okunur. Yalnızca yönetici çağırır (yeniden denetlenir).
 */
export async function getTeamView(): Promise<{ members: TeamMemberView[] }> {
  const access = await requireAdmin();
  const users = await db.user.findMany({
    where: { OR: [{ role: "ADMIN" }, { teamPermissions: { some: {} } }] },
    select: memberSelect,
  });
  const entries = users.length
    ? await db.auditLog.findMany({
        where: {
          target: { in: users.map((u) => auditTarget.user(u.id)) },
          action: { in: ["team.added", "user.promote_admin"] satisfies AuditAction[] },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { target: true, action: true, createdAt: true, actorId: true, actor: { select: { displayName: true } } },
      })
    : [];

  const members = users.map((user): TeamMemberView => {
    const role: TeamRole = user.role === "ADMIN" ? "ADMIN" : "MEMBER";
    const member = { role: user.role, birthYear: user.birthYear };
    const granted = user.teamPermissions.map((p) => p.permission);
    const latest = entries.find((e) => e.target === auditTarget.user(user.id));
    const firstRow = user.teamPermissions[0];
    const founder = latest?.action === "user.promote_admin";
    return {
      id: user.id,
      name: user.displayName,
      avatar: avatarOf(user).emoji,
      role,
      studentAccount: isStudentAccount(member),
      permissions: effectivePermissions(member, granted),
      allowed: role === "ADMIN" ? [...grantableOrder] : allowedPermissions(member).filter((p) => p !== "ROLES"),
      addedAt: (latest?.createdAt ?? firstRow?.grantedAt)?.toISOString() ?? null,
      addedBy: latest ? (founder ? null : latest.actor.displayName) : (firstRow?.grantedBy.displayName ?? null),
      founder,
      me: user.id === access.userId,
      configuredAdmin: role === "ADMIN" && isConfiguredAdminEmail(user.email),
    };
  });

  const rank = (m: TeamMemberView) => (m.role === "ADMIN" ? 0 : 1);
  members.sort((a, b) => rank(a) - rank(b) || (a.addedAt ?? "").localeCompare(b.addedAt ?? "") || a.name.localeCompare(b.name, "tr"));
  return { members };
}

// ---------------------------------------------------------------------------------------
// Ekip işlemlerinin yardımcıları (lib/admin/team-actions.ts)
// ---------------------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;

/**
 * Bütün ekip değişiklikleri sırayla yapılır (veritabanı kilidi): iki yönetici aynı anda birbirini
 * yöneticilikten çıkaramaz, "son yönetici" denetimi yarışta atlanmaz.
 */
export async function lockTeam(tx: Tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('admin-team'))`;
}

/** Kişinin yöneticiye çevrilmeden önceki rolü (kayıt defterinden), yoksa null. */
function recordedRole(action: string, details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  const after = (d.after ?? null) as Record<string, unknown> | null;
  if (action === "team.added" && d.role === "ADMIN") return typeof d.previousRole === "string" ? d.previousRole : null;
  if (action === "team.permissions_changed" && after?.role === "ADMIN") return typeof d.previousRole === "string" ? d.previousRole : null;
  if (action === "user.promote_admin") return typeof d.from === "string" ? d.from : null;
  return null;
}

/**
 * Yöneticilikten çıkan kişi hangi role döner (team-rules.ts formerRole)? Öğretmenlik izi: açık
 * sınıfı ya da okulu ve onaylı talebi var (öğretmenlikten çıkarıldıysa yok sayılır).
 */
export async function formerRoleOf(tx: Tx, user: { id: string; schoolId: string | null }): Promise<"STUDENT" | "TEACHER"> {
  const entries = await tx.auditLog.findMany({
    where: {
      target: auditTarget.user(user.id),
      action: { in: ["team.added", "team.permissions_changed", "user.promote_admin", "teacher.removed", "teacher.restored"] satisfies AuditAction[] },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 30,
    select: { action: true, details: true },
  });
  const recorded = entries.map((e) => recordedRole(e.action, e.details)).find((r) => r !== null) ?? null;
  const teacherChange = entries.find((e) => e.action === "teacher.removed" || e.action === "teacher.restored");
  if (teacherChange?.action === "teacher.removed") return "STUDENT";
  const classes = await tx.classroom.count({ where: { teacherId: user.id, archived: false } });
  const approved = user.schoolId ? await tx.teacherApplication.count({ where: { userId: user.id, status: "APPROVED" } }) : 0;
  return formerRole({ recorded, teacherEvidence: classes > 0 || approved > 0 });
}

/**
 * Bu kişi dışında kaç aktif yönetici var? Doğrulanmamış ya da askıdaki yönetici panele giremediği
 * için sayılmaz. Son yönetici yöneticilikten çıkarılamaz.
 */
export async function otherActiveAdmins(tx: Tx, exceptId: string) {
  return tx.user.count({ where: { role: "ADMIN", id: { not: exceptId }, emailVerified: true, suspended: false } });
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * İşi geri al süresinden sonraya kurar (lib/teacher/decide.ts scheduleFinalize gibi). İstek
 * içindeyse after() ile (yanıt gittikten sonra), değilse zamanlayıcıyla. Sunucu o arada kapanırsa
 * iş yapılmaz (mail gitmez); kayıt defterindeki işlem yerinde kalır.
 */
export function runAfterUndoWindow(label: string, task: () => Promise<unknown>, delayMs = afterUndoDelayMs) {
  const report = (error: unknown) => console.error(`[yönetim] ${label}:`, errorText(error));
  try {
    after(() =>
      sleep(delayMs)
        .then(task)
        .catch(report),
    );
  } catch {
    setTimeout(() => void task().catch(report), delayMs).unref();
  }
}

/** "Ekibe eklendin" maili, geri al süresinden sonra (işlem geri alınmadıysa). */
export function scheduleTeamAddedMail(userId: string, op: string) {
  runAfterUndoWindow("ekip maili gönderilemedi", () => sendTeamAddedMail(userId, op));
}

/**
 * Mail yalnızca kişi hâlâ ekipteyse gider (geri alınan ekleme ya da sonradan çıkarma mail
 * göndermez; çıkarma geri alındıysa gider). Bu kayıttan sonra kişi yeniden eklendiyse (geri al
 * değil) mail o eklemenin zamanlayıcısıyla gider, iki kez gitmez. Rol ve izinler o anki halinden
 * okunur. Gönderildiyse true.
 */
export async function sendTeamAddedMail(userId: string, op: string): Promise<boolean> {
  const target = auditTarget.user(userId);
  const entries = await db.auditLog.findMany({
    where: { target, action: "team.added" satisfies AuditAction },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: { id: true, action: true, actorId: true, details: true },
  });
  const index = entries.findIndex((e) => entryMeta(e.details).op === op && !entryMeta(e.details).undo);
  if (index < 0) return false;
  const entry = entries[index];
  if (entries.slice(0, index).some((e) => !entryMeta(e.details).undo)) return false;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, role: true, birthYear: true, teamPermissions: { select: { permission: true } } },
  });
  if (!user) return false;
  const role: TeamRole = user.role === "ADMIN" ? "ADMIN" : "MEMBER";
  const permissions = effectivePermissions(user, sortPermissions(user.teamPermissions.map((p) => p.permission)));
  if (role === "MEMBER" && permissions.length === 0) return false;
  const actor = await db.user.findUnique({ where: { id: entry.actorId }, select: { displayName: true } });
  await sendMail(
    teamAddedMail({
      to: user.email,
      name: user.displayName,
      siteUrl: siteUrl(),
      actorName: actor?.displayName ?? "",
      role,
      permissions,
    }),
  );
  return true;
}
