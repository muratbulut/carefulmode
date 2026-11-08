// Öğretmen talepleri ekranının verisi (sunucuda lib/admin/applications.ts hazırlar). Tarayıcıya
// giden her şey burada: başvuranın hesap e-postası ve belgenin baytları hiç gelmez; yalnızca
// kurumsal e-posta (isteğe bağlı, doğrulama için verdiği) ve belgenin adı, boyutu, türü.

import type { ApplicationTab, CheckKey, SignalLevel } from "@/lib/admin/application-rules";
import type { ApplicationStatus } from "@/lib/generated/prisma/enums";

/** Listedeki satır. */
export type ApplicationRow = {
  id: string;
  name: string;
  /** Avatar emojisi. */
  avatar: string;
  /** Talep zamanı: "Bugün 21:12", "Dün 18:40", "3 gün önce". */
  when: string;
  /** Listedeki okulun adı ya da "Yeni okul" talebinde öğretmenin yazdığı ad. */
  school: string;
  subject: string;
  hasEmail: boolean;
  hasDocument: boolean;
  level: SignalLevel;
  newSchool: boolean;
  /** Bilgi istenmişti, öğretmen cevapladı ve talep Bekleyen'e döndü (CEVAP GELDİ). */
  answered: boolean;
  /** Doğum yılına göre 18 yaşından küçük olabilir (18 YAŞ ALTI; talep engellenmez). */
  minor: boolean;
};

/** "Bu okul mu?" adayı: aynı ilçede benzer adlı okul. */
export type SimilarSchool = { id: string; name: string; teachers: number };

export type QaView = { question: string; askedAt: string; answer: string | null; answeredAt: string | null };

export type DocumentView = {
  name: string;
  size: string;
  /** Belge hâlâ duruyor mu (karar kesinleşince silinir)? */
  available: boolean;
  /** Önizleme türü: görsel satır içinde, PDF çerçevede. */
  kind: "image" | "pdf" | null;
};

export type ApplicationDetail = {
  id: string;
  status: ApplicationStatus;
  name: string;
  avatar: string;
  /** "Talep: 10 Ekim · Bugün 21:12" */
  requested: string;
  /** Listedeki okul; "Yeni okul" talebinde null (onaylandıysa eklenen ya da eşlenen okul). */
  school: { id: string; name: string; teachers: number; coordinator: string | null; coordinatorApproves: boolean } | null;
  /** "Yeni okul" talebinde öğretmenin yazdığı ad. */
  typedSchoolName: string | null;
  /** "İstanbul · Bahçelievler" */
  place: string;
  province: string;
  district: string;
  subject: string;
  institutionalEmail: string | null;
  document: DocumentView | null;
  /** "3 aydır üye · 11 oda bitirdi" */
  account: string;
  /** Doğum yılına göre 18 yaşından küçük olabilirse kayıttaki yıl, değilse null (uyarı notu). */
  minorBirthYear: number | null;
  /** Okul sorumlusunun görüşü (Okulum) ve kimin verdiği. */
  opinion: { kind: "ENDORSED" | "NOT_RECOGNIZED"; by: string | null } | null;
  history: QaView[];
  /** Kaydedilmiş kontrol listesi (onayda ya da bilgi isterken yazılır). */
  checks: CheckKey[];
  /** Karar: "10 Ekim · Murat B." */
  decided: string | null;
  rejectionNote: string | null;
  /** "Yeni okul" talebinde aynı ilçedeki benzer okullar. */
  similar: SimilarSchool[];
  /** Talep bu yöneticinin kendisinin: karar veremez. */
  own: boolean;
};

export type ApplicationsBoard = {
  tab: ApplicationTab;
  counts: Record<ApplicationTab, number>;
  rows: ApplicationRow[];
  /** Liste kısaltıldıysa (en yeni N talep) N. */
  limit: number | null;
  /** Ayrıntısı gösterilen talep: adresteki ya da listenin ilki (masaüstü). */
  selected: ApplicationDetail | null;
  /** Talep adreste seçildi mi? Telefonda ayrıntı sayfası yalnızca o zaman açılır. */
  explicit: boolean;
};
