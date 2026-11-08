// Yönetim ekibi ve okul işlemlerinin saf kuralları (Kullanicilar-Son, Kullanicilar-Son-Okullar):
// izin sırası, rol etiketi, verilen rol ve izinlerin denetimi, ekipten çıkan yöneticinin
// döneceği rol, "Geri al"ın hangi kayıtları geri alacağı, okul sorumlusu adayının uygunluğu ve
// yeni okul adının denetimi (aynısı var mı, benzeri var mı).
//
// Veritabanına dokunmaz, birim testlidir (tests/unit/admin-team.test.ts). Tarayıcıya giden
// bileşenler de kullanır; bu yüzden lib/admin/access.ts'ten yalnızca tür alır.

import { cleanSchoolName, schoolNameKey, schoolNameOk, similarSchoolNames } from "@/lib/school/names";
import type { TeamPermission } from "./access";

/**
 * Sorumluya verilebilen izinlerin ekrandaki sırası (access.ts grantablePermissions ile aynı; birim
 * testi ikisini karşılaştırır). ROLES (Kullanıcılar ve roller) verilemez, yalnızca yöneticide.
 */
export const grantableOrder: readonly TeamPermission[] = ["APPLICATIONS", "LAB_EDITING", "LAB_PUBLISHING", "TIPS", "NEWS", "AUDIT_LOG"];

/** Bütün izinlerin sırası (access.ts teamPermissionList ile aynı). */
export const permissionOrder: readonly TeamPermission[] = [...grantableOrder, "ROLES"];

/**
 * "Geri al" süresi. Ekrandaki bildirim 5 saniye durur; sunucu yavaş bağlantıyı da düşünerek 30
 * saniyeye kadar kabul eder (öğretmen talepleriyle aynı, lib/teacher/decision-rules.ts).
 */
export const teamUndoWindowMs = 30_000;

/** "Ekibe eklendin" ve "okul sorumlusu oldun" mailleri geri al süresi bitince gider. */
export const afterUndoDelayMs = teamUndoWindowMs + 5_000;

/** Ekipteki rol: yönetici (User.role ADMIN) ya da sorumlu (izin satırları). */
export type TeamRole = "ADMIN" | "MEMBER";
export const teamRoles = ["ADMIN", "MEMBER"] as const satisfies readonly TeamRole[];

/** Kartlardaki rol etiketi: Yönetici, Sorumlu, Sorumlu · öğrenci. */
export type RoleLabel = "admin" | "member" | "studentMember";

export function roleLabelOf(member: { role: TeamRole; studentAccount: boolean }): RoleLabel {
  if (member.role === "ADMIN") return "admin";
  return member.studentAccount ? "studentMember" : "member";
}

const isPermission = (value: string): value is TeamPermission => (permissionOrder as readonly string[]).includes(value);

/** İzinleri ekrandaki sıraya koyar; bilinmeyeni ve tekrarı atar. */
export function sortPermissions(list: readonly string[]): TeamPermission[] {
  const set = new Set(list.filter(isPermission));
  return permissionOrder.filter((p) => set.has(p));
}

export function samePermissions(a: readonly string[], b: readonly string[]): boolean {
  const x = sortPermissions(a);
  const y = sortPermissions(b);
  return x.length === y.length && x.every((p, i) => p === y[i]);
}

/** İzin farkı: eklenenler ve kaldırılanlar (ekran sırasıyla). */
export function permissionDiff(before: readonly string[], after: readonly string[]) {
  const was = new Set(before);
  const now = new Set(after);
  return {
    added: permissionOrder.filter((p) => now.has(p) && !was.has(p)),
    removed: permissionOrder.filter((p) => was.has(p) && !now.has(p)),
  };
}

export type GrantRefusal = "studentAccount" | "permissionNotAllowed" | "noPermission";

/**
 * Ekibe ekleme ve "İzinleri düzenle": bu rol ve izinler bu kişiye verilebilir mi? `allowed` kişinin
 * alabileceği izinlerdir (access.ts allowedPermissions). Öğrenci hesabı yönetici olamaz; sorumluya
 * en az bir izin verilir ve ROLES hiçbir zaman verilmez. Yöneticide izin listesine bakılmaz (her şeyi yapar).
 */
export function grantRefusal(input: {
  role: TeamRole;
  permissions: readonly TeamPermission[];
  studentAccount: boolean;
  allowed: readonly TeamPermission[];
}): GrantRefusal | null {
  if (input.role === "ADMIN") return input.studentAccount ? "studentAccount" : null;
  if (input.permissions.length === 0) return "noPermission";
  if (input.permissions.some((p) => p === "ROLES" || !input.allowed.includes(p))) return "permissionNotAllowed";
  return null;
}

/**
 * Yöneticilikten çıkan (ekipten çıkarılan ya da sorumlu yapılan) kişinin rolü. Öğretmenlik izi
 * varsa (açık sınıfı ya da onaylı talebi ve okulu) öğretmen olur; yoksa yönetici yapılmadan
 * önceki rolü (kayıt defterinde yazılı), o da yoksa öğrenci. Sınıfı olan kişi öğrenci yapılmaz:
 * sınıfları sahipsiz kalırdı.
 */
export function formerRole(input: { recorded: string | null; teacherEvidence: boolean }): "STUDENT" | "TEACHER" {
  return input.teacherEvidence || input.recorded === "TEACHER" ? "TEACHER" : "STUDENT";
}

// ---------------------------------------------------------------------------------------
// Geri al
// ---------------------------------------------------------------------------------------

export type UndoEntry = { id: string; actorId: string; action: string; createdAt: Date; details: unknown };

/** Kayıt ayrıntısından işlem kimliği (op) ve "geri almanın kaydı mı" bilgisi. */
export function entryMeta(details: unknown): { op: string | null; undo: boolean } {
  if (details === null || typeof details !== "object" || Array.isArray(details)) return { op: null, undo: false };
  const d = details as Record<string, unknown>;
  return { op: typeof d.op === "string" ? d.op : null, undo: d.undo === true };
}

const newestFirst = (a: UndoEntry, b: UndoEntry) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * "Geri al" hangi kayıtları geri alır? Her işlem kayıtlarına aynı işlem kimliğini (op) yazar
 * ("Okul ekle" sorumluyla birlikte iki kayıt yazar). Hedefin (kişi ya da okul) kayıtları en yeniden
 * geriye okunur: en yeni kayıtlar bu işlemin olmalı. Kaydı başkası yazdıysa, süre geçtiyse, kayıt
 * bir geri almanın kendisiyse ya da bu işlemden sonra başka bir işlem yapıldıysa boş liste döner
 * (geri alınamaz). Liste en yeniden eskiye sıralıdır.
 */
export function undoBatch<T extends UndoEntry>(entries: readonly T[], op: string, actorId: string, now: Date): T[] {
  const batch: T[] = [];
  for (const entry of [...entries].sort(newestFirst)) {
    const meta = entryMeta(entry.details);
    if (meta.op !== op) break;
    const age = now.getTime() - entry.createdAt.getTime();
    if (entry.actorId !== actorId || meta.undo || age > teamUndoWindowMs || age < -5_000) return [];
    batch.push(entry);
  }
  return batch;
}

// ---------------------------------------------------------------------------------------
// Kişi arama ve okul sorumlusu
// ---------------------------------------------------------------------------------------

/** Arama sonucunda kişinin türü: yönetici, öğretmen, öğrenci hesabı ya da (yetişkin) üye. */
export type PersonKind = "admin" | "teacher" | "student" | "member";

export function personKind(role: string, studentAccount: boolean): PersonKind {
  if (role === "ADMIN") return "admin";
  if (role === "TEACHER") return "teacher";
  return studentAccount ? "student" : "member";
}

export const searchLimits = { min: 3, max: 80, results: 8 } as const;

/** Arama metni: boşluklar sadeleşir; LIKE'ın joker karakterleri (% _ \) atılır. */
export function cleanQuery(value: string): string {
  return value.normalize("NFC").replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, searchLimits.max);
}

export type CoordinatorRefusal = "studentAccount" | "notTeacher" | "otherSchool" | "coordinatesOther";

/**
 * Bu kişi bu okulun sorumlusu olabilir mi? Sorumlu öğretmen ya da yöneticidir (Okulum erişimi bunu
 * ister, lib/teacher/access.ts); öğrenci hesabı ve yetişkin üye olamaz. Başka bir okulun öğretmeni ya
 * da başka bir okulun sorumlusu da olamaz. `schoolId` null: yeni açılan okul.
 */
export function coordinatorRefusal(
  person: { kind: PersonKind; schoolId: string | null; coordinatedSchoolId: string | null },
  schoolId: string | null,
): CoordinatorRefusal | null {
  if (person.kind === "student") return "studentAccount";
  if (person.kind === "member") return "notTeacher";
  if (person.coordinatedSchoolId && person.coordinatedSchoolId !== schoolId) return "coordinatesOther";
  if (person.schoolId && person.schoolId !== schoolId) return "otherSchool";
  return null;
}

// ---------------------------------------------------------------------------------------
// Okul ekle
// ---------------------------------------------------------------------------------------

export type SchoolNameCheck =
  | { status: "invalid" }
  | { status: "duplicate"; name: string }
  | { status: "similar"; names: string[] }
  | { status: "ok" };

/**
 * Yeni okulun adı, aynı ilçedeki okulların adlarıyla (`existing`) karşılaştırılır: birebir aynısı
 * (karşılaştırma biçimi nameKey) varsa eklenmez; benzeri varsa sarı uyarı çıkar ve "Yine de ekle"
 * gerekir (lib/school/names.ts similarSchoolNames).
 */
export function checkSchoolName(name: string, existing: readonly string[]): SchoolNameCheck {
  const clean = cleanSchoolName(name);
  if (!schoolNameOk(clean)) return { status: "invalid" };
  const key = schoolNameKey(clean);
  const duplicate = existing.find((other) => schoolNameKey(other) === key);
  if (duplicate) return { status: "duplicate", name: duplicate };
  const similar = existing.filter((other) => similarSchoolNames(other, clean));
  return similar.length > 0 ? { status: "similar", names: similar } : { status: "ok" };
}
