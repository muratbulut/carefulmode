// Yönetimdeki "Öğretmen talepleri" ekranının saf kuralları (Tur 4, Talepler-Son): sekmeler ve
// adresteki adları, kontrol listesi, sinyaller ve "Güçlü / Orta / Zayıf" etiketi, "Bu okul mu?"
// için benzer okullar, bilgi isteme geçmişi ve sunucu eylemlerinin girdi şemaları. Veritabanına
// dokunmaz; tarayıcı ve sunucu aynı kuralları kullanır, birim testlidir
// (tests/unit/admin-applications.test.ts). Asıl denetim sunucu eylemlerindedir
// (lib/admin/application-actions.ts).

import * as z from "@/lib/zod";
import type { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { paths } from "@/lib/navigation";
import { schoolNameKey, similarSchoolNames } from "@/lib/school/names";

// ---------------------------------------------------------------------------------------
// Sekmeler: Bekleyen / Bilgi istendi / Onaylanan / Reddedilen
// ---------------------------------------------------------------------------------------

export const applicationTabs = ["pending", "info", "approved", "rejected"] as const;
export type ApplicationTab = (typeof applicationTabs)[number];

/** Adresteki adları (?sekme=...). */
export const tabParams = {
  pending: "bekleyen",
  info: "bilgi-istendi",
  approved: "onaylanan",
  rejected: "reddedilen",
} as const satisfies Record<ApplicationTab, string>;

/** Sekmedeki talepler hangi durumda? Cevabı gelen (CEVAP GELDİ) talep de PENDING'dir, Bekleyen'dedir. */
export const tabStatus = {
  pending: "PENDING",
  info: "INFO_REQUESTED",
  approved: "APPROVED",
  rejected: "REJECTED",
} as const satisfies Record<ApplicationTab, ApplicationStatus>;

/** Adresteki sekme adı; tanınmazsa null. */
export function tabFromParam(value: unknown): ApplicationTab | null {
  return applicationTabs.find((tab) => tabParams[tab] === value) ?? null;
}

export function tabOf(status: ApplicationStatus): ApplicationTab {
  return applicationTabs.find((tab) => tabStatus[tab] === status) ?? "pending";
}

/** Talep kimliği (cuid; testlerde "e2e..."): harf, rakam, - ve _. */
export const applicationIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const isApplicationId = (value: unknown): value is string => applicationIdSchema.safeParse(value).success;

/** Sekmenin ve seçili talebin adresi (bağlantı paylaşılabilir; telefonda talep sayfası açılır). */
export function applicationsHref(tab: ApplicationTab, applicationId?: string | null): string {
  const query = new URLSearchParams({ sekme: tabParams[tab] });
  if (applicationId) query.set("talep", applicationId);
  return `${paths.adminApplications}?${query.toString()}`;
}

/** Belgenin yalnızca talepleri inceleyenlere açık adresi (app/yonetim/talepler/[talep]/belge). */
export const documentHref = (applicationId: string) => `${paths.adminApplications}/${encodeURIComponent(applicationId)}/belge`;

// ---------------------------------------------------------------------------------------
// Kontrol listesi: onaylamak için en az 2 işaret, reddetmek için gerekmez
// ---------------------------------------------------------------------------------------

export const checkKeys = ["schoolReal", "emailDomain", "documentReadable", "subjectFits"] as const;
export type CheckKey = (typeof checkKeys)[number];

export const minApprovalChecks = 2;

/**
 * Bilgisi olmayan madde işaretlenemez: kurumsal e-posta yoksa "E-posta okulun alan adıyla
 * uyumlu", belge yoksa "Belge okunaklı" (ekranda "bilgi yok"). Sayılmaz da.
 */
export function checkApplies(key: CheckKey, app: { hasEmail: boolean; hasDocument: boolean }): boolean {
  if (key === "emailDomain") return app.hasEmail;
  if (key === "documentReadable") return app.hasDocument;
  return true;
}

/** Geçerli (bilgisi olan, tekrarsız) işaretler, listedeki sırayla. */
export function countedChecks(keys: readonly string[], app: { hasEmail: boolean; hasDocument: boolean }): CheckKey[] {
  return checkKeys.filter((key) => keys.includes(key) && checkApplies(key, app));
}

/** Veritabanındaki kontrol listesi (TeacherApplication.checks: { anahtar: true }). */
export function readChecks(value: unknown): CheckKey[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return checkKeys.filter((key) => record[key] === true);
}

export function checksJson(keys: readonly CheckKey[]): Record<CheckKey, boolean> {
  return Object.fromEntries(checkKeys.map((key) => [key, keys.includes(key)])) as Record<CheckKey, boolean>;
}

// ---------------------------------------------------------------------------------------
// Sinyaller: karar vermez, yardım eder
// ---------------------------------------------------------------------------------------

export type SignalFacts = {
  hasEmail: boolean;
  hasDocument: boolean;
  /** Okul listede mi (ya da "Bu okul mu?" ile listedeki okula eşlendi mi)? */
  schoolListed: boolean;
  /** Aynı okuldaki onaylı öğretmen sayısı. */
  colleagues: number;
};

export const signalKeys = ["email", "document", "listed", "colleagues"] as const;
export type SignalKey = (typeof signalKeys)[number];
export type Signal = { key: SignalKey; ok: boolean };
export type SignalLevel = "strong" | "medium" | "weak";

export function signalsOf(facts: SignalFacts): Signal[] {
  return [
    { key: "email", ok: facts.hasEmail },
    { key: "document", ok: facts.hasDocument },
    { key: "listed", ok: facts.schoolListed },
    { key: "colleagues", ok: facts.schoolListed && facts.colleagues > 0 },
  ];
}

/** 3 ya da 4 sinyal: Güçlü, 2: Orta, daha azı: Zayıf. */
export function signalLevel(facts: SignalFacts): SignalLevel {
  const n = signalsOf(facts).filter((s) => s.ok).length;
  return n >= 3 ? "strong" : n === 2 ? "medium" : "weak";
}

// ---------------------------------------------------------------------------------------
// "Bu okul mu?": aynı ilçede benzer adlı okullar
// ---------------------------------------------------------------------------------------

/** Okul adlarında her okulda geçen, ayırt etmeyen kelimeler ("orta okulu" yazımı da dahil). */
const genericWords = new Set([
  "ortaokulu",
  "ortaokul",
  "orta",
  "lisesi",
  "lise",
  "anadolu",
  "ilkokulu",
  "ilkokul",
  "ilk",
  "okulu",
  "okul",
  "fen",
  "sosyal",
  "bilimler",
  "mesleki",
  "meslek",
  "teknik",
  "ve",
  "imam",
  "hatip",
  "koleji",
  "kolej",
]);

/** Küçük harf, Türkçe harfler Latin karşılığına, işaretler boşluğa. */
function plain(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Adın ayırt edici kelimeleri: "bahçelievler orta okulu" → ["bahcelievler"]. */
export function schoolKeywords(name: string): string[] {
  return plain(name)
    .split(" ")
    .filter((w) => w.length > 1 && !genericWords.has(w));
}

const keywordsMeet = (a: string, b: string) => a === b || (a.length >= 4 && b.startsWith(a)) || (b.length >= 4 && a.startsWith(b));

/**
 * Öğretmenin yazdığı ad listedeki okula benziyor mu? Aynı ad (büyük-küçük harf, Türkçe harf ve
 * boşluk farkı sayılmaz: "bahçelievler orta okulu" = "Bahçelievler Ortaokulu") 3, benzer ad 2,
 * ortak ayırt edici kelime 1, değilse 0.
 */
export function schoolSimilarity(typed: string, listed: string): number {
  const compact = (value: string) => plain(value).replace(/ /g, "");
  if (schoolNameKey(typed) === schoolNameKey(listed) || compact(typed) === compact(listed)) return 3;
  if (similarSchoolNames(typed, listed)) return 2;
  const a = schoolKeywords(typed);
  const b = schoolKeywords(listed);
  return a.some((v) => b.some((w) => keywordsMeet(v, w))) ? 1 : 0;
}

export const similarSchoolLimit = 5;

/** Aynı ilçedeki okullardan benzer olanlar, en benzeri önce (en fazla 5). */
export function similarSchools<T extends { name: string }>(typed: string, schools: readonly T[]): T[] {
  return schools
    .map((school) => ({ school, score: schoolSimilarity(typed, school.name) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.school.name.localeCompare(b.school.name, "tr"))
    .slice(0, similarSchoolLimit)
    .map((s) => s.school);
}

/** "Okulu internette ara": okulun adı, ilçesi ve ili ile arama (yeni sekmede, yönlendiren bilgisi gitmez). */
export function schoolSearchUrl(name: string, district: string, province: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} ${district} ${province}`)}`;
}

// ---------------------------------------------------------------------------------------
// Bilgi isteme geçmişi
// ---------------------------------------------------------------------------------------

export type QaRound = { question: string; questionAt: Date; answer: string | null; answeredAt: Date | null };

type QaEntry = { id: string; action: string; details: unknown };
type QaState = { question: string | null; questionAt: Date | null; answer: string | null; answeredAt: Date | null };

const asText = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : null);
const asDate = (value: unknown) => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Talepteki soru-cevap turları, eskiden yeniye. Talep satırında yalnızca son soru ve cevap durur;
 * önceki turu her "application.info_requested" kaydı ayrıntısında ("previous") saklar
 * (lib/teacher/decide.ts). Geri alınmış kayıtlar ("application.undone") sayılmaz.
 */
export function qaHistory(entries: readonly QaEntry[], current: QaState): QaRound[] {
  const undone = new Set<string>();
  for (const entry of entries) {
    if (entry.action !== "application.undone") continue;
    const list = (entry.details as { undone?: unknown } | null)?.undone;
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const id = (item as { id?: unknown } | null)?.id;
      if (typeof id === "string") undone.add(id);
    }
  }

  const rounds: QaRound[] = [];
  const add = (state: Partial<Record<keyof QaState, unknown>>) => {
    const question = asText(state.question);
    const questionAt = asDate(state.questionAt);
    if (!question || !questionAt) return;
    if (rounds.some((r) => r.questionAt.getTime() === questionAt.getTime())) return;
    rounds.push({ question, questionAt, answer: asText(state.answer), answeredAt: asDate(state.answeredAt) });
  };
  for (const entry of entries) {
    if (entry.action !== "application.info_requested" || undone.has(entry.id)) continue;
    const previous = (entry.details as { previous?: unknown } | null)?.previous;
    if (previous && typeof previous === "object") add(previous as Record<string, unknown>);
  }
  add(current);
  return rounds.sort((a, b) => a.questionAt.getTime() - b.questionAt.getTime());
}

// ---------------------------------------------------------------------------------------
// Arama (ekrandaki liste): ad, okul ya da branş
// ---------------------------------------------------------------------------------------

export function matchesSearch(row: { name: string; school: string; subject: string }, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("tr");
  if (!q) return true;
  return `${row.name} ${row.school} ${row.subject}`.toLocaleLowerCase("tr").includes(q);
}

// ---------------------------------------------------------------------------------------
// Sunucu eylemlerinin girdileri
// ---------------------------------------------------------------------------------------

/** Not, soru ve okul adı burada yalnızca kaba boyutla sınırlanır; asıl kurallar decide.ts ve names.ts'te. */
const text = (max: number) => z.string().max(max);

export const approveInputSchema = z.strictObject({
  applicationId: applicationIdSchema,
  checks: z.array(z.enum(checkKeys)).max(checkKeys.length),
  /** "Yeni okul" talebinde "Bu okul mu?" eşlemesi. */
  matchSchoolId: applicationIdSchema.optional(),
  /** "Yeni okul" talebinde okulun düzeltilmiş adı. */
  schoolName: text(200).optional(),
});
export type ApproveInput = z.infer<typeof approveInputSchema>;

export const rejectInputSchema = z.strictObject({ applicationId: applicationIdSchema, note: text(2000) });
export type RejectInput = z.infer<typeof rejectInputSchema>;

export const infoInputSchema = z.strictObject({
  applicationId: applicationIdSchema,
  question: text(2000),
  /** O ana kadar işaretlenen kontroller (cevap gelince yeniden işaretlemek gerekmesin). */
  checks: z.array(z.enum(checkKeys)).max(checkKeys.length).optional(),
});
export type InfoInput = z.infer<typeof infoInputSchema>;

/** Eylemin hata kodu; ekranda adminApplications.errors[kod]. */
export type ApplicationActionError =
  | "forbidden"
  | "notFound"
  | "invalidState"
  | "invalidInput"
  | "checksRequired"
  | "schoolName"
  | "schoolMismatch"
  | "ownApplication"
  | "tooLate"
  | "rateLimited"
  | "failed";

export type ApplicationActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: ApplicationActionError };
