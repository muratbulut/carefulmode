// Kayıt defteri (AuditLog): yönetim işlemleri ve öğrenci profiline bakmalar. Kayıtlar silinmez,
// düzenlenmez (veritabanındaki tetikleyici de engeller). Kayıt, işlemin kendisiyle aynı
// veritabanı işleminde (transaction) yazılır: işlem geri dönerse kayıt da yazılmaz.
// Yalnızca sunucuda.

import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Kayıt türleri. Kayıt defteri sayfası bunları türlere (auditKindOf) ve Türkçe cümlelere çevirir. */
export type AuditAction =
  // Öğretmen talepleri
  | "application.approved"
  | "application.rejected"
  | "application.info_requested"
  | "application.endorsed"
  | "application.not_recognized"
  | "application.school_matched"
  // Kararın 5 saniyelik "Geri al"ı (lib/teacher/decide.ts undoDecision): ayrıntıda geri alınan
  // kayıtların türleri ve kimlikleri durur.
  | "application.undone"
  // Karar maili gitti (onay, ret ya da bilgi isteme). Geri al süresi bitince bir kez yazılır;
  // aynı karar için ikinci mail gitmesin diye işaret olarak da okunur.
  | "application.mail_sent"
  // Okulum: okul sorumlusunun öğretmene hatırlatması; Kullanıcılar: yöneticinin hatırlatması
  | "teacher.reminded"
  | "teacher.removed"
  | "teacher.restored"
  // Okullar
  | "school.created"
  | "school.updated"
  | "school.coordinator_set"
  | "school.coordinator_removed"
  // Roller ve ekip izinleri
  | "user.promote_admin"
  | "team.added"
  | "team.permissions_changed"
  | "team.removed"
  | "user.suspended"
  | "user.unsuspended"
  // Lablar (lib/admin/lab-actions.ts)
  | "lab.create"
  | "lab.save_draft"
  | "lab.publish"
  | "lab.unpublish"
  | "lab.hide"
  | "lab.unhide"
  | "lab.reorder"
  | "lab.gate_changed"
  // İçerik: günün ipucu ve gündem
  | "tip.created"
  | "tip.updated"
  | "tip.pooled"
  | "tip.archived"
  | "tip.pinned"
  | "news.created"
  | "news.updated"
  | "news.scheduled"
  | "news.unscheduled"
  | "news.deleted"
  // Bakışlar: öğrenci profili, öğretmenin gözünden
  | "student.profile_viewed"
  | "teacher.viewed_as"
  | "application.document_viewed";

/** Kayıt defterindeki tür süzgeci (Kayit-Defteri): Talep, Rol, Lab, İçerik, Bakış. */
export const auditKinds = ["application", "role", "lab", "content", "view"] as const;
export type AuditKind = (typeof auditKinds)[number];

/** Kaydın türü, adının önekinden çıkarılır (okul, ekip ve hesap işlemleri "Rol"). */
export function auditKindOf(action: string): AuditKind {
  if (action === "application.document_viewed") return "view";
  if (action.startsWith("application.")) return "application";
  if (action.startsWith("lab.")) return "lab";
  if (action.startsWith("tip.") || action.startsWith("news.")) return "content";
  if (action === "student.profile_viewed" || action === "teacher.viewed_as") return "view";
  if (action === "teacher.reminded") return "application";
  return "role";
}

type AuditClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function writeAudit(
  client: AuditClient,
  entry: { actorId: string; action: AuditAction; target: string; details?: Prisma.InputJsonValue },
) {
  await client.auditLog.create({ data: { actorId: entry.actorId, action: entry.action, target: entry.target, details: entry.details } });
}

/** Hedef biçimi: "tür:kimlik" (user:..., school:..., application:...). */
export const auditTarget = {
  user: (id: string) => `user:${id}`,
  school: (id: string) => `school:${id}`,
  application: (id: string) => `application:${id}`,
  lab: (id: string) => `lab:${id}`,
  tip: (id: string) => `tip:${id}`,
  news: (id: string) => `news:${id}`,
} as const;
