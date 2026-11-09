// Kayıt defterinin cümleleri (Kayit-Defteri, Ozet-Son "Son kayıtlar"). Her kayıt adı (AuditAction)
// için bir Türkçe cümle; hedefin adı (kişi, okul, lab, ipucu, haber) ayrıca toplu sorguyla bulunur
// (lib/admin/audit-log.ts) ve buraya sözlük olarak gelir. Ayrıntı (details) her kayıtta farklıdır ve
// eksik olabilir: eksik alan cümleyi bozmaz, yalnızca o parça yazılmaz. Bilinmeyen kayıt adı genel
// bir cümleyle gösterilir.
//
// Gizlilik: öğrenci hedef "Ad S." (adı ve soyadının baş harfi) olarak yazılır, e-posta hiç yazılmaz.
// Toplu ekranlarda (Özet) öğrenci adı hiç görünmez: "bir öğrenci". Saf modül; birim testli.

import { auditKindOf, type AuditAction, type AuditKind } from "@/lib/audit";
import { format, getMessages } from "@/lib/i18n";
import { dayMonth } from "./calendar";

// ---------------------------------------------------------------------------------------
// Türler
// ---------------------------------------------------------------------------------------

/**
 * Türlerin veritabanı süzgeci için kuralı: kayıt adının öneki ya da adın kendisi. "Rol" bunların
 * hiçbiri olmayan her şeydir. lib/audit.ts auditKindOf ile aynı sonucu verir (birim testi bütün
 * kayıt adları için karşılaştırır).
 */
export type KindRule = {
  prefixes: readonly string[];
  actions: readonly string[];
  /** Önekle eşleşse de bu türe girmeyen adlar (ör. belgeye bakmak "Bakış"tır, "Talep" değil). */
  except?: readonly string[];
};

export const kindRules: Record<Exclude<AuditKind, "role">, KindRule> = {
  application: { prefixes: ["application."], actions: ["teacher.reminded"], except: ["application.document_viewed"] },
  lab: { prefixes: ["lab."], actions: [] },
  content: { prefixes: ["tip.", "news."], actions: [] },
  view: { prefixes: [], actions: ["student.profile_viewed", "teacher.viewed_as", "application.document_viewed"] },
};

const ruleMatches = (rule: KindRule, action: string) =>
  !rule.except?.includes(action) && (rule.actions.includes(action) || rule.prefixes.some((p) => action.startsWith(p)));

/** kindRules'ın JavaScript karşılığı (veritabanı süzgeciyle aynı mantık). */
export function matchesKind(action: string, kind: AuditKind): boolean {
  if (kind !== "role") return ruleMatches(kindRules[kind], action);
  return !Object.values(kindRules).some((rule) => ruleMatches(rule, action));
}

// ---------------------------------------------------------------------------------------
// Adlar
// ---------------------------------------------------------------------------------------

/** "Ayşe Yılmaz" -> "Ayşe Y."; tek kelimelik ad olduğu gibi kalır. */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  return `${words[0]} ${words.at(-1)!.charAt(0).toLocaleUpperCase("tr")}.`;
}

/** Hedefin adı: kayıt defteri sorgusu bunları toplu bulur ("tür:kimlik" anahtarıyla). */
export type TargetInfo =
  | { kind: "user"; name: string; role: string }
  | { kind: "school"; name: string }
  | { kind: "lab"; name: string; neighborhood: string | null }
  | { kind: "application"; name: string; role: string; school: string | null }
  | { kind: "tip"; text: string }
  | { kind: "news"; title: string };

export type TargetLookup = ReadonlyMap<string, TargetInfo>;

export type SentenceOptions = {
  /** Toplu ekran (Özet): öğrenci adı hiç yazılmaz. */
  anonymizeStudents?: boolean;
};

/** "user:abc" -> { kind: "user", id: "abc" } */
export function parseTarget(target: string): { kind: string; id: string } | null {
  const at = target.indexOf(":");
  if (at <= 0 || at === target.length - 1) return null;
  return { kind: target.slice(0, at), id: target.slice(at + 1) };
}

/**
 * Kişinin kayıt defterindeki adı. Öğretmen (ve öğretmen adayı onaylandıysa) tam adıyla; öğrenci
 * ve ekip "Ad S."; toplu ekranda öğrenci "bir öğrenci".
 */
export function personLabel(person: { name: string; role: string } | null | undefined, options: SentenceOptions = {}): string {
  const t = getMessages().adminAudit;
  if (!person || !person.name.trim()) return t.unknownPerson;
  if (person.role === "STUDENT" && options.anonymizeStudents) return t.aStudent;
  if (person.role === "TEACHER") return person.name.trim();
  return shortName(person.name);
}

/** Yapan kişinin adı: "Ad S."; toplu ekranda (Özet) ekipteki öğrenci hesabının adı da yazılmaz. */
export function actorName(actor: { name: string; role: string }, options: SentenceOptions = {}): string {
  const t = getMessages().adminAudit;
  if (actor.role === "STUDENT" && options.anonymizeStudents) return t.teamStudent;
  return shortName(actor.name) || t.unknownPerson;
}

// ---------------------------------------------------------------------------------------
// Ayrıntı (details) okuma: her alan isteğe bağlı
// ---------------------------------------------------------------------------------------

type Details = Record<string, unknown>;

const asDetails = (value: unknown): Details => (value && typeof value === "object" && !Array.isArray(value) ? (value as Details) : {});
const text = (d: Details, key: string) => (typeof d[key] === "string" && (d[key] as string).trim() ? (d[key] as string).trim() : null);
const number = (d: Details, key: string) => (typeof d[key] === "number" && Number.isFinite(d[key]) ? (d[key] as number) : null);
const list = (d: Details, key: string) => (Array.isArray(d[key]) ? (d[key] as unknown[]).filter((x): x is string => typeof x === "string") : []);

/** İpucu günü kaydı: son değişiklikte gün boşaldı mı, hangi gün (pinTipDay "day" ve "auto" yazar, düzenleme yazmaz). */
function tipPinChange(d: Details): { unpinned: boolean; days: Details } {
  const changes = Array.isArray(d.changes) ? d.changes : [];
  const main = asDetails(changes[changes.length - 1]);
  const before = asDetails(main.before);
  const after = asDetails(main.after);
  const unpinned = d.auto === true || (changes.length > 0 && after.pinnedDay === null);
  return { unpinned, days: { day: text(after, "pinnedDay") ?? text(before, "pinnedDay") } };
}

/** Uzun metni (ipucu) kısaltır. */
export function clip(value: string, max = 60): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function dateOf(d: Details, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = text(d, key);
    if (!value) continue;
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
    if (!Number.isNaN(date.getTime())) return dayMonth(date);
  }
  return null;
}

// ---------------------------------------------------------------------------------------
// Cümleler
// ---------------------------------------------------------------------------------------

type Context = {
  details: Details;
  target: { kind: string; id: string } | null;
  lookup: TargetLookup;
  options: SentenceOptions;
};

type Builder = (c: Context) => string;

const t = () => getMessages().adminAudit;

function info<K extends TargetInfo["kind"]>(c: Context, kind: K, id?: string | null): Extract<TargetInfo, { kind: K }> | undefined {
  const key = id ? `${kind}:${id}` : c.target?.kind === kind ? `${kind}:${c.target.id}` : null;
  const found = key ? c.lookup.get(key) : undefined;
  return found?.kind === kind ? (found as Extract<TargetInfo, { kind: K }>) : undefined;
}

/** Hedef kişi (user:...), ya da ayrıntıdaki kişi (userId). */
function targetPerson(c: Context): string {
  const user = info(c, "user") ?? info(c, "user", text(c.details, "userId"));
  return personLabel(user, c.options);
}

/** Talep hedefinden başvuran kişi; talep silinmişse ayrıntıdaki kişi. */
function applicant(c: Context): string {
  const app = info(c, "application");
  if (app) return personLabel({ name: app.name, role: app.role }, c.options);
  return personLabel(info(c, "user", text(c.details, "userId")), c.options);
}

function schoolName(c: Context): string {
  return info(c, "school")?.name ?? info(c, "school", text(c.details, "schoolId"))?.name ?? text(c.details, "name") ?? t().unknownSchool;
}

function labName(c: Context): string {
  return info(c, "lab")?.name ?? text(c.details, "name") ?? text(c.details, "slug") ?? t().unknownLab;
}

function withNeighborhood(c: Context, sentence: string): string {
  const neighborhood = info(c, "lab")?.neighborhood;
  return neighborhood ? format(t().withNeighborhood, { text: sentence, neighborhood }) : sentence;
}

function tipText(c: Context): string {
  return clip(info(c, "tip")?.text ?? text(c.details, "text") ?? t().unknownTip);
}

function newsTitle(c: Context): string {
  return clip(info(c, "news")?.title || text(c.details, "title") || t().unknownNews, 80);
}

/** Ekip izinleri: "Sorumlu: Oda düzenleme, Gündem" ya da "Yönetici". */
function teamDetail(c: Context): string | null {
  const a = t();
  if (text(c.details, "role") === "ADMIN") return a.roleAdmin;
  const names = list(c.details, "permissions").map((p) => a.permissions[p as keyof typeof a.permissions]).filter(Boolean);
  return names.length ? format(a.teamRole, { permissions: names.join(", ") }) : null;
}

const plus = (sentence: string, detail: string | null) => (detail ? format(t().withDetail, { text: sentence, detail }) : sentence);

const sentences: Record<AuditAction, Builder> = {
  "application.approved": (c) => {
    const sentence = format(t().actions.applicationApproved, { name: applicant(c) });
    const school = info(c, "school", text(c.details, "schoolId"))?.name ?? info(c, "application")?.school;
    return school ? format(t().withSchool, { text: sentence, school }) : sentence;
  },
  "application.rejected": (c) => format(t().actions.applicationRejected, { name: applicant(c) }),
  "application.info_requested": (c) => format(t().actions.applicationInfoRequested, { name: applicant(c) }),
  "application.endorsed": (c) => format(t().actions.applicationEndorsed, { name: applicant(c) }),
  "application.not_recognized": (c) => format(t().actions.applicationNotRecognized, { name: applicant(c) }),
  "application.undone": (c) => format(t().actions.applicationUndone, { name: applicant(c) }),
  "application.mail_sent": (c) => {
    // Hangi mailin gittiği kararın türünden (onay, ret, bilgi isteme); eski kayıtta tür yoksa genel cümle.
    const a = t().actions;
    const kind = text(c.details, "kind");
    const sentence =
      kind === "approved" ? a.applicationMailSentApproved
      : kind === "rejected" ? a.applicationMailSentRejected
      : kind === "infoRequested" ? a.applicationMailSentInfo
      : a.applicationMailSent;
    return format(sentence, { name: applicant(c) });
  },
  "application.school_matched": (c) => {
    const sentence = format(t().actions.applicationSchoolMatched, { name: applicant(c) });
    const school = info(c, "school", text(c.details, "schoolId"))?.name ?? info(c, "application")?.school;
    return school ? format(t().withSchool, { text: sentence, school }) : sentence;
  },
  "teacher.reminded": (c) => format(t().actions.teacherReminded, { name: targetPerson(c) }),
  "teacher.removed": (c) => format(t().actions.teacherRemoved, { name: targetPerson(c) }),
  "teacher.restored": (c) => format(t().actions.teacherRestored, { name: targetPerson(c) }),
  "school.created": (c) => format(t().actions.schoolCreated, { school: schoolName(c) }),
  "school.updated": (c) => format(t().actions.schoolUpdated, { school: schoolName(c) }),
  "school.coordinator_set": (c) => {
    const coordinator = info(c, "user", text(c.details, "coordinatorId") ?? text(c.details, "userId"));
    return format(t().actions.schoolCoordinatorSet, { school: schoolName(c), name: personLabel(coordinator, c.options) });
  },
  "school.coordinator_removed": (c) => format(t().actions.schoolCoordinatorRemoved, { school: schoolName(c) }),
  "user.promote_admin": (c) =>
    format(text(c.details, "source") === "ADMIN_EMAILS" ? t().actions.userPromoteAdminConfigured : t().actions.userPromoteAdmin, {
      name: targetPerson(c),
    }),
  "team.added": (c) => plus(format(t().actions.teamAdded, { name: targetPerson(c) }), teamDetail(c)),
  "team.permissions_changed": (c) => plus(format(t().actions.teamPermissionsChanged, { name: targetPerson(c) }), teamDetail(c)),
  "team.removed": (c) => format(t().actions.teamRemoved, { name: targetPerson(c) }),
  "user.suspended": (c) => format(t().actions.userSuspended, { name: targetPerson(c) }),
  "user.unsuspended": (c) => format(t().actions.userUnsuspended, { name: targetPerson(c) }),
  "lab.create": (c) =>
    withNeighborhood(c, format(c.details.example === true ? t().actions.labCreateExample : t().actions.labCreate, { lab: labName(c) })),
  "lab.save_draft": (c) => format(t().actions.labSaveDraft, { lab: labName(c) }),
  "lab.publish": (c) => {
    const version = number(c.details, "version");
    return format(t().actions.labPublish, { lab: labName(c), version: version !== null ? format(t().version, { n: version }) : "" });
  },
  "lab.unpublish": (c) => {
    const version = number(c.details, "version");
    return format(t().actions.labUnpublish, { lab: labName(c), version: version !== null ? format(t().version, { n: version }) : "" });
  },
  "lab.hide": (c) => {
    const sentence = format(t().actions.labHide, { lab: labName(c) });
    const note = text(c.details, "note");
    return note ? format(t().withNote, { text: sentence, note: clip(note, 120) }) : sentence;
  },
  "lab.unhide": (c) => format(t().actions.labUnhide, { lab: labName(c) }),
  "lab.reorder": (c) => {
    const from = number(c.details, "from");
    const to = number(c.details, "to");
    return from !== null && to !== null
      ? format(t().actions.labReorder, { lab: labName(c), from, to })
      : format(t().actions.labReorderPlain, { lab: labName(c) });
  },
  "lab.gate_changed": (c) => {
    const gate = text(c.details, "gate");
    return gate ? format(t().actions.labGateChanged, { lab: labName(c), gate: clip(gate, 80) }) : format(t().actions.labGateBasic, { lab: labName(c) });
  },
  "tip.created": (c) => format(t().actions.tipCreated, { tip: tipText(c) }),
  "tip.updated": (c) => format(t().actions.tipUpdated, { tip: tipText(c) }),
  "tip.pooled": (c) => format(t().actions.tipPooled, { tip: tipText(c) }),
  "tip.archived": (c) => format(t().actions.tipArchived, { tip: tipText(c) }),
  "tip.pinned": (c) => {
    // Gün "Otomatik"e alındıysa (ya da ipucunun günü boşaldıysa) sabitlenmedi, günden kaldırıldı.
    const main = tipPinChange(c.details);
    const sentence = main.unpinned ? t().actions.tipUnpinned : t().actions.tipPinned;
    return plus(format(sentence, { tip: tipText(c) }), dateOf(c.details, "day", "date", "pinnedDate") ?? dateOf(main.days, "day"));
  },
  "news.created": (c) => format(t().actions.newsCreated, { title: newsTitle(c) }),
  "news.updated": (c) => {
    // Kapak görseli ayrı bir eylemle yüklenir ya da kaldırılır (details.cover).
    const cover = text(c.details, "cover");
    const sentence = cover === "uploaded" ? t().actions.newsCoverUploaded : cover === "removed" ? t().actions.newsCoverRemoved : t().actions.newsUpdated;
    return format(sentence, { title: newsTitle(c) });
  },
  "news.scheduled": (c) => plus(format(t().actions.newsScheduled, { title: newsTitle(c) }), dateOf(c.details, "publishedAt", "date")),
  "news.unscheduled": (c) => format(t().actions.newsUnscheduled, { title: newsTitle(c) }),
  "news.deleted": (c) => format(t().actions.newsDeleted, { title: newsTitle(c) }),
  "student.profile_viewed": (c) => format(t().actions.studentProfileViewed, { name: targetPerson(c) }),
  "teacher.viewed_as": (c) => format(t().actions.teacherViewedAs, { name: targetPerson(c) }),
  "application.document_viewed": (c) => format(t().actions.applicationDocumentViewed, { name: applicant(c) }),
};

/** Cümlesi tanımlı bütün kayıt adları (birim testi her birini dener). */
export const knownActions = Object.keys(sentences);

/** Kaydın Türkçe cümlesi. Ayrıntı eksik ya da bozuksa bile bir cümle döner. */
export function auditSentence(
  entry: { action: string; target: string; details: unknown },
  lookup: TargetLookup,
  options: SentenceOptions = {},
): string {
  const builder = (sentences as Record<string, Builder>)[entry.action];
  if (!builder) return format(t().actions.generic, { action: entry.action });
  try {
    return builder({ details: asDetails(entry.details), target: parseTarget(entry.target), lookup, options });
  } catch {
    return format(t().actions.generic, { action: entry.action });
  }
}

/** Cümleler için adı bulunacak hedefler ("tür:kimlik"): kaydın hedefi ve ayrıntıdaki kişi ve okul. */
export function referencedTargets(entries: readonly { action: string; target: string; details: unknown }[]): string[] {
  const keys = new Set<string>();
  for (const entry of entries) {
    if (parseTarget(entry.target)) keys.add(entry.target);
    const d = asDetails(entry.details);
    for (const key of ["userId", "coordinatorId"]) {
      const id = text(d, key);
      if (id) keys.add(`user:${id}`);
    }
    const schoolId = text(d, "schoolId");
    if (schoolId) keys.add(`school:${schoolId}`);
  }
  return [...keys];
}

export { auditKindOf };
