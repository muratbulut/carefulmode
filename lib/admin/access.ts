// Yönetim paneline (/yonetim) kim girebilir? Yönetici (rol ADMIN) her şeyi yapar. Yönetim
// ekibindeki sorumlu yalnızca izni olan işi yapar ve menüde yalnızca o sayfaları görür
// (Tur 4, Kullanicilar-Son): APPLICATIONS öğretmen talepleri, LAB_EDITING taslak açar ve
// düzenler, LAB_PUBLISHING yayınlar, gizler ve sırayı değiştirir, TIPS günün ipucu, NEWS gündem,
// AUDIT_LOG kayıt defteri. ROLES (Kullanıcılar, ekip ve okullar) yalnızca yöneticidedir, verilemez.
// Ekipteki öğrenci hesabı yalnızca TIPS ve NEWS alabilir (Tur 4 kapanış): rolü STUDENT olan ve
// doğum yılına göre 18 yaşından küçük olabilecek (ya da doğum yılı bilinmeyen) hesap. Rolü
// STUDENT olan yetişkin (ör. labları yazan ekip arkadaşı) diğer izinleri de alabilir. Özet ve Canlı nabız
// ekipteki herkese açıktır (yalnızca toplam sayılar). Başka herkes paneli hiç görmez: sayfa
// "bulunamadı" der (panelin varlığı belli olmaz).
//
// Kontrol her istekte sunucuda, veritabanındaki güncel rolle ve izinlerle yapılır; her sunucu
// eylemi yeniden sorar. Yalnızca sunucuda.

import { notFound } from "next/navigation";
import { cache } from "react";
import { avatarOf } from "@/lib/avatars";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { isConfiguredAdminEmail } from "./admin-emails";
import { promoteConfiguredAdmin } from "./promote";

export const teamPermissionList = ["APPLICATIONS", "LAB_EDITING", "LAB_PUBLISHING", "TIPS", "NEWS", "AUDIT_LOG", "ROLES"] as const;
export type TeamPermission = (typeof teamPermissionList)[number];

/** Sorumluya verilebilen izinler (ROLES yalnızca yöneticide). */
export const grantablePermissions = teamPermissionList.filter((p) => p !== "ROLES");
/** Ekipteki öğrenci hesabının alabileceği izinler: başkalarının bilgisini görmeyen içerik işleri. */
export const studentTeamPermissions: readonly TeamPermission[] = ["TIPS", "NEWS"];

const isTeamPermission = (p: string): p is TeamPermission => (teamPermissionList as readonly string[]).includes(p);

/** İzin hesabı için kişi: rolü ve öğrenci hesabı sayılıp sayılmadığı. */
export type TeamMember = { role: string; birthYear?: number | null };

/**
 * Doğum yılına göre 18 yaşından küçük olabilir mi? Yalnızca yıl bilindiği için bu yıl 18'ini
 * dolduracak kişi de sayılır: doğum günü henüz gelmemiş olabilir (güvenlik turu 4). Kayıttaki veli
 * kutusu ayrı bir karardır (lib/account/shared.ts isMinor).
 */
export function mightBeMinor(birthYear: number, now = new Date()): boolean {
  return birthYear >= minorBirthYearFloor(now);
}

/** Bu yıl ya da sonrası doğanlar 18 yaşından küçük olabilir (mightBeMinor; SQL süzgeçleri de bunu kullanır). */
export function minorBirthYearFloor(now = new Date()): number {
  return now.getFullYear() - 18;
}

/** Öğrenci hesabı mı (ekipte yalnızca TIPS ve NEWS)? Doğum yılı bilinmiyorsa öyle sayılır. */
export function isStudentAccount(member: TeamMember): boolean {
  return member.role === "STUDENT" && (member.birthYear == null || mightBeMinor(member.birthYear));
}

/** Bu kişiye verilebilecek izinler (ekibe ekleme ve izin düzenleme formu). */
export function allowedPermissions(member: TeamMember): readonly TeamPermission[] {
  if (member.role === "ADMIN") return teamPermissionList;
  return isStudentAccount(member) ? studentTeamPermissions : grantablePermissions;
}

/**
 * Rol ve veritabanındaki izinlerden geçerli izinler (saf fonksiyon; birim testli). Yönetici her
 * izne sahiptir. Sorumluda ROLES hiç sayılmaz; öğrenci hesabında yalnızca TIPS ve NEWS sayılır
 * (izin satırı bir yolla yazılmış olsa bile).
 */
export function effectivePermissions(member: TeamMember, granted: readonly string[]): TeamPermission[] {
  if (member.role === "ADMIN") return [...teamPermissionList];
  const allowed = allowedPermissions(member);
  const held = granted.filter(isTeamPermission);
  return teamPermissionList.filter((p) => allowed.includes(p) && held.includes(p));
}

export type LabPermissions = { canEdit: boolean; canPublish: boolean };

/** Rol ve ekip izinlerinden lab izinleri (saf fonksiyon; birim testli). */
export function labPermissions(member: TeamMember, permissions: readonly string[]): LabPermissions {
  const effective = effectivePermissions(member, permissions);
  return { canEdit: effective.includes("LAB_EDITING"), canPublish: effective.includes("LAB_PUBLISHING") };
}

export const hasLabAccess = (p: LabPermissions) => p.canEdit || p.canPublish;

export type AdminAccess = LabPermissions & {
  userId: string;
  name: string;
  /** Avatar emojisi (lib/avatars.ts). */
  avatar: string;
  /** Yönetici mi, yoksa izinli sorumlu mu (menüdeki kullanıcı kartı). */
  isAdmin: boolean;
  role: string;
  /** Geçerli izinler (yöneticide hepsi). */
  permissions: TeamPermission[];
};

/** İznin var mı? Birden çok izin verilirse herhangi biri yeter. */
export const can = (access: Pick<AdminAccess, "permissions">, ...needed: TeamPermission[]) => needed.some((p) => access.permissions.includes(p));

/**
 * Oturumdaki kullanıcının yönetim erişimi; panele giremiyorsa null. Doğrulanmamış e-posta ve
 * askıya alınmış hesap giremez. ADMIN_EMAILS'teki doğrulanmış adres ilk girişte yönetici olur.
 */
export const getAdminAccess = cache(async (): Promise<AdminAccess | null> => {
  const sessionUser = await getUser();
  if (!sessionUser) return null;
  const row = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      displayName: true,
      email: true,
      emailVerified: true,
      role: true,
      suspended: true,
      avatar: true,
      birthYear: true,
      teamPermissions: { select: { permission: true } },
    },
  });
  if (!row || !row.emailVerified || row.suspended) return null;

  let role: string = row.role;
  if (role !== "ADMIN" && isConfiguredAdminEmail(row.email) && (await promoteConfiguredAdmin(row.id))) role = "ADMIN";

  const member = { role, birthYear: row.birthYear };
  const granted = row.teamPermissions.map((p) => p.permission);
  const permissions = effectivePermissions(member, granted);
  if (permissions.length === 0) return null;
  return {
    ...labPermissions(member, granted),
    userId: row.id,
    name: row.displayName,
    avatar: avatarOf(row).emoji,
    isAdmin: role === "ADMIN",
    role,
    permissions,
  };
});

/** Lab sayfaları ve lab eylemleri için: lab izni yoksa null. */
export const getLabAccess = cache(async (): Promise<AdminAccess | null> => {
  const access = await getAdminAccess();
  return access && hasLabAccess(access) ? access : null;
});

/** Sunucu eylemleri için: istenen izinlerden biri yoksa null. */
export async function getPermittedAccess(...needed: TeamPermission[]): Promise<AdminAccess | null> {
  const access = await getAdminAccess();
  return access && can(access, ...needed) ? access : null;
}

/** Sayfalar için: ekipte değilse 404 (Özet, Canlı nabız). */
export async function requireAdminAccess(): Promise<AdminAccess> {
  const access = await getAdminAccess();
  if (!access) notFound();
  return access;
}

/** Sayfalar için: istenen izinlerden biri yoksa 404. */
export async function requirePermission(...needed: TeamPermission[]): Promise<AdminAccess> {
  const access = await getPermittedAccess(...needed);
  if (!access) notFound();
  return access;
}

/** Sayfalar için: lab izni yoksa 404. */
export async function requireLabAccess(): Promise<AdminAccess> {
  const access = await getLabAccess();
  if (!access) notFound();
  return access;
}

/** Sayfalar için: yalnızca yönetici (Kullanıcılar, ekip, okullar, öğrenci profili). */
export async function requireAdmin(): Promise<AdminAccess> {
  return requirePermission("ROLES");
}
