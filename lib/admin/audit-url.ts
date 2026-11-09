// Kayıt defterinin süzgeçleri ve adresi (/yonetim/kayit-defteri?tur=oda&kisi=...&ara=...&sonraki=...).
// Süzgeçler adreste durur: sayfa yenilenince ya da bağlantı paylaşılınca aynı liste açılır.
// Tarayıcıda da çalışır (arama kutusu adresi buradan kurar); lib/audit.ts'den yalnızca tür alınır.

import type { AuditKind } from "@/lib/audit";
import { paths } from "@/lib/navigation";

/** Tür süzgecinin adresteki adı (?tur=oda): Türkçe, çünkü adresler Türkçe. Sıra süzgeç düğmelerinin sırasıdır. */
export const kindParams: Record<AuditKind, string> = {
  application: "talep",
  role: "rol",
  lab: "oda",
  content: "icerik",
  view: "bakis",
};

export const auditKindList = Object.keys(kindParams) as AuditKind[];

/** Eski adlar: "Lab" yerine "Oda" denmeden önce kaydedilmiş bağlantılar (?tur=lab) aynı listeyi açsın. */
const legacyKindParams: Record<string, AuditKind> = { lab: "lab" };

export function kindFromParam(value: unknown): AuditKind | null {
  if (typeof value === "string" && Object.hasOwn(legacyKindParams, value)) return legacyKindParams[value];
  const entry = Object.entries(kindParams).find(([, param]) => param === value);
  return entry ? (entry[0] as AuditKind) : null;
}

export type AuditFilters = {
  kind: AuditKind | null;
  /** Yapan kişinin kimliği (yönetim ekibinden biri). */
  person: string | null;
  /** Arama: kişi, okul, lab adı (ve ipucu, haber başlığı). */
  query: string;
  /** Sayfalama: bu kaydın kimliğinden daha eski kayıtlar. */
  cursor: string | null;
};

export const emptyFilters: AuditFilters = { kind: null, person: null, query: "", cursor: null };

/** Aramanın en uzun hali (uzun metin sorguyu ağırlaştırmasın). */
export const maxQueryLength = 80;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const idLike = (value: string | undefined) => (value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null);

/** Adresteki parametrelerden süzgeçler; bozuk ya da bilinmeyen değer yok sayılır. */
export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  return {
    kind: kindFromParam(first(params.tur)),
    person: idLike(first(params.kisi)),
    query: (first(params.ara) ?? "").replace(/\s+/g, " ").trim().slice(0, maxQueryLength),
    cursor: idLike(first(params.sonraki)),
  };
}

/** Süzgeçlerin adresi; boş süzgeç adrese yazılmaz. */
export function auditHref(filters: Partial<AuditFilters>): string {
  const search = new URLSearchParams();
  if (filters.kind) search.set("tur", kindParams[filters.kind]);
  if (filters.person) search.set("kisi", filters.person);
  if (filters.query?.trim()) search.set("ara", filters.query.trim());
  if (filters.cursor) search.set("sonraki", filters.cursor);
  const query = search.toString();
  return query ? `${paths.adminAudit}?${query}` : paths.adminAudit;
}
