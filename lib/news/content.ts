// Gündem haberinin içeriği (NewsArticle.content) ve "Yayına hazır mı?" kuralları. Saf
// fonksiyonlar: sunucu eylemleri, yönetimdeki düzenleyici ve herkese açık haber sayfası aynı
// kuralları kullanır (birim testli: tests/unit/news.test.ts).
//
// Haberin bölümleri öğrencinin gördüğü H2 haber sayfasıyla birebir (Tur 4, 24b; tahtalar
// Gundem-Son, Gundem-Detay-H2-Yan): "Ne oluyor?" metni, isteğe bağlı örnek mesaj (gönderen +
// metin), "Nasıl anlarsın?" 3 işaret (kısa işaret + açıklama), "Ne yapmalısın?" (her satır bir
// madde) ve yan sütundaki "Kısaca" 3 madde. Başlık, özet, konu (mahalle), ilgili lab ve kaynak
// tablonun kendi alanlarıdır.
//
// Haber Cuma 08.00'de (Türkiye saati) yayınlanır. Planlanan haber, yayın anı geçince kendiliğinden
// yayında sayılır (zamanlanmış iş yok): durum SCHEDULED ya da PUBLISHED ve publishedAt <= şimdi.

import * as z from "@/lib/zod";

export const newsLimits = {
  title: 70,
  summary: 180,
  whatsHappening: 2000,
  sender: 40,
  exampleText: 300,
  sign: 80,
  explanation: 220,
  action: 200,
  actions: 8,
  takeaway: 140,
  sourceName: 80,
  sourceUrl: 500,
} as const;

/** "Yayına hazır mı?" listesindeki en az uzunluklar (Gundem-Son). */
export const readyMinimums = {
  title: 10,
  summary: 30,
  /** "Ne oluyor? (en az 2 cümle)" */
  whatsHappening: 80,
  actions: 2,
  takeaway: 10,
} as const;

export const signCount = 3;
export const takeawayCount = 3;

export type Sign = { sign: string; explanation: string };
export type ExampleMessage = { sender: string; text: string };

/** Haberin gövdesi. Taslakta alanlar boş olabilir; yayındaki haberde hepsi doludur. */
export type ArticleContent = {
  /** Ne oluyor? (paragraflar satır satır) */
  whatsHappening: string;
  /** Haberdeki sahte mesaj; yoksa null. */
  example: ExampleMessage | null;
  /** Nasıl anlarsın? Her zaman 3 tane. */
  signs: Sign[];
  /** Ne yapmalısın? Her biri bir madde. */
  actions: string[];
  /** Kısaca: başlığın altındaki 3 kart. */
  takeaways: string[];
};

const limited = (max: number) => z.string().max(max);

/** Taslağın içeriği: boş alanlar olabilir ama biçim ve uzunluk sınırları kesindir (sunucu eylemleri). */
export const articleDraftContentSchema = z.object({
  whatsHappening: limited(newsLimits.whatsHappening),
  example: z.object({ sender: limited(newsLimits.sender), text: limited(newsLimits.exampleText) }).nullable(),
  signs: z.array(z.object({ sign: limited(newsLimits.sign), explanation: limited(newsLimits.explanation) })).length(signCount),
  actions: z.array(limited(newsLimits.action)).max(newsLimits.actions),
  takeaways: z.array(limited(newsLimits.takeaway)).length(takeawayCount),
});

const filled = (max: number) => z.string().trim().min(1).max(max);

/** Yayındaki haberin içeriği: bütün bölümler dolu (örnek mesaj isteğe bağlı). */
export const articleContentSchema = z.object({
  whatsHappening: filled(newsLimits.whatsHappening),
  example: z.object({ sender: z.string().trim().max(newsLimits.sender), text: filled(newsLimits.exampleText) }).nullable(),
  signs: z.array(z.object({ sign: filled(newsLimits.sign), explanation: filled(newsLimits.explanation) })).length(signCount),
  actions: z.array(filled(newsLimits.action)).min(1).max(newsLimits.actions),
  takeaways: z.array(filled(newsLimits.takeaway)).length(takeawayCount),
});

export const emptyContent = (): ArticleContent => ({
  whatsHappening: "",
  example: null,
  signs: Array.from({ length: signCount }, () => ({ sign: "", explanation: "" })),
  actions: [],
  takeaways: Array.from({ length: takeawayCount }, () => ""),
});

const str = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * Veritabanındaki içeriği okur; eksik ya da bozuk parçalar boş gelir (hiç hata atmaz). İşaret ve
 * "Kısaca" her zaman 3 tanedir, fazlası atılır.
 */
export function parseArticleContent(json: unknown): ArticleContent {
  const raw = record(json);
  const example = raw.example === null || raw.example === undefined ? null : record(raw.example);
  const signs = list(raw.signs).slice(0, signCount).map((s) => {
    const sign = record(s);
    return { sign: str(sign.sign, newsLimits.sign), explanation: str(sign.explanation, newsLimits.explanation) };
  });
  while (signs.length < signCount) signs.push({ sign: "", explanation: "" });
  const takeaways = list(raw.takeaways).slice(0, takeawayCount).map((t) => str(t, newsLimits.takeaway));
  while (takeaways.length < takeawayCount) takeaways.push("");
  const sender = example ? str(example.sender, newsLimits.sender) : "";
  const text = example ? str(example.text, newsLimits.exampleText) : "";
  return {
    whatsHappening: str(raw.whatsHappening, newsLimits.whatsHappening),
    example: sender.trim() || text.trim() ? { sender, text } : null,
    signs,
    actions: list(raw.actions)
      .map((a) => str(a, newsLimits.action))
      .filter((a) => a.trim() !== "")
      .slice(0, newsLimits.actions),
    takeaways,
  };
}

/** Kaydedilecek hali: boşluklar kırpılır, boş maddeler atılır, boş örnek mesaj null olur. */
export function normalizeContent(content: ArticleContent): ArticleContent {
  const sender = content.example?.sender.trim() ?? "";
  const text = content.example?.text.trim() ?? "";
  return {
    whatsHappening: content.whatsHappening.trim(),
    example: sender || text ? { sender, text } : null,
    signs: content.signs.map((s) => ({ sign: s.sign.trim(), explanation: s.explanation.trim() })),
    actions: content.actions.map((a) => a.trim()).filter(Boolean),
    takeaways: content.takeaways.map((t) => t.trim()),
  };
}

/** "Ne yapmalısın?" kutusu: her satır bir madde (boş satırlar atılır). */
export function linesOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** "Ne oluyor?" paragrafları (her satır bir paragraf). */
export const paragraphsOf = linesOf;

/** Okuma süresi (dakika): tahtadaki hesap, kelime / 120 + 1. */
export function readingMinutes(content: Pick<ArticleContent, "whatsHappening" | "signs" | "actions">): number {
  const text = [content.whatsHappening, ...content.actions, ...content.signs.flatMap((s) => [s.sign, s.explanation])].join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 120) + 1);
}

// ---------------------------------------------------------------------------------------
// Güvenilir kaynak
// ---------------------------------------------------------------------------------------

/**
 * Güvenilir kaynak listesi (Tur 4, 24b): resmi kurumlar (gov.tr ve alt alan adları),
 * BleepingComputer, The Hacker News, ESET WeLiveSecurity, Kaspersky, NCSC, CISA.
 */
export const trustedDomains = [
  "gov.tr",
  "bleepingcomputer.com",
  "thehackernews.com",
  "welivesecurity.com",
  "kaspersky.com",
  "kaspersky.com.tr",
  "ncsc.gov.uk",
  "cisa.gov",
] as const;

export type SourceProblem = "empty" | "invalid" | "notHttps" | "credentials" | "untrusted";
export type SourceCheck = { ok: true; href: string; host: string } | { ok: false; problem: SourceProblem; host: string | null };

/** Alan adı listedeki bir alan adının kendisi ya da alt alan adı mı? ("usom.gov.tr" evet, "gov.tr.evil.com" hayır) */
export function isTrustedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  return trustedDomains.some((domain) => h === domain || h.endsWith(`.${domain}`));
}

/**
 * Kaynak adresini denetler: https olmalı, kullanıcı adı ya da parola (@ hilesi) ve başka port
 * içermemeli, alan adı güvenilir listede olmalı. Adres URL ayrıştırıcısıyla okunur; ters bölü,
 * boşluk ve kontrol karakteri içeren adres geçersizdir (tarayıcının "düzelttiği" adresler).
 */
export function checkSourceUrl(raw: string): SourceCheck {
  const value = raw.trim();
  if (!value) return { ok: false, problem: "empty", host: null };
  if (/[\s\\\u0000-\u001f\u007f]/.test(value) || !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return { ok: false, problem: "invalid", host: null };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, problem: "invalid", host: null };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, problem: "invalid", host: null };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.split(".").some((label) => label === "")) return { ok: false, problem: "invalid", host: null };
  if (url.username || url.password) return { ok: false, problem: "credentials", host };
  if (url.protocol !== "https:") return { ok: false, problem: "notHttps", host };
  if (url.port !== "" || !isTrustedHost(host)) return { ok: false, problem: "untrusted", host };
  return { ok: true, href: url.href, host };
}

export const isTrustedSourceUrl = (raw: string) => checkSourceUrl(raw).ok;

/** "Siteye git" penceresinde adres üç parça gösterilir; alan adı vurgulanır. */
export function sourceParts(href: string): { scheme: string; host: string; rest: string } | null {
  const check = checkSourceUrl(href);
  if (!check.ok) return null;
  const url = new URL(check.href);
  return { scheme: `${url.protocol}//`, host: url.host, rest: `${url.pathname}${url.search}${url.hash}` };
}

/** Resmi kurum adresi mi (pencerede ".gov.tr ile biter" hatırlatması)? */
export const isGovernmentHost = (host: string) => host === "gov.tr" || host.endsWith(".gov.tr");

// ---------------------------------------------------------------------------------------
// Yayın haftası: Cuma 08.00, Türkiye saati (UTC+3, yaz saati yok)
// ---------------------------------------------------------------------------------------

const turkeyOffsetMs = 3 * 60 * 60 * 1000;
/** 08.00 Türkiye = 05.00 UTC */
const publishHourUtc = 5;
const dayMs = 24 * 60 * 60 * 1000;
const friday = 5;
/** Düzenleyicideki yayın haftası listesi: önümüzdeki 8 Cuma. */
export const weeksAhead = 8;

/** Türkiye saatine göre takvim günü: "2026-10-16". */
export function turkeyDateKey(date: Date): string {
  return new Date(date.getTime() + turkeyOffsetMs).toISOString().slice(0, 10);
}

/** Hafta anahtarı ("2026-10-16", bir Cuma) -> yayın anı (o gün 08.00 Türkiye). Cuma değilse null. */
export function fridayPublishTime(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, publishHourUtc));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.getUTCDay() === friday ? date : null;
}

/** Yayın anı henüz gelmemiş ilk `count` Cuma (Türkiye saatiyle). */
export function upcomingFridays(now: Date, count = weeksAhead): string[] {
  const today = Date.parse(`${turkeyDateKey(now)}T00:00:00Z`);
  const dow = new Date(today).getUTCDay();
  let first = today + ((friday - dow + 7) % 7) * dayMs;
  if (fridayPublishTime(new Date(first).toISOString().slice(0, 10))!.getTime() <= now.getTime()) first += 7 * dayMs;
  return Array.from({ length: count }, (_, i) => new Date(first + i * 7 * dayMs).toISOString().slice(0, 10));
}

/** Yayın anının hafta anahtarı. */
export const weekKeyOf = (publishedAt: Date) => turkeyDateKey(publishedAt);

export type ArticleState = "live" | "scheduled" | "draft";

/** Haberin durumu: yayın anı gelmiş planlı haber de yayındadır. */
export function articleState(row: { status: string; publishedAt: Date | null }, now: Date): ArticleState {
  if ((row.status === "SCHEDULED" || row.status === "PUBLISHED") && row.publishedAt) {
    return row.publishedAt.getTime() <= now.getTime() ? "live" : "scheduled";
  }
  return "draft";
}

/** Yayındaki haberlerin veritabanı koşulu (herkese açık sayfalar). */
export const liveWhere = (now: Date) => ({ status: { in: ["SCHEDULED", "PUBLISHED"] as ("SCHEDULED" | "PUBLISHED")[] }, publishedAt: { lte: now } });

// ---------------------------------------------------------------------------------------
// Yayına hazır mı?
// ---------------------------------------------------------------------------------------

/** Kontrol listesinin maddeleri, tahtadaki sırayla. */
export const readinessKeys = ["titleSummary", "whatsHappening", "signs", "actions", "takeaways", "topic", "source", "trustedSource", "lab", "week"] as const;
export type ReadinessKey = (typeof readinessKeys)[number];

/** Önerilir (planlamayı engellemez). */
const optionalKeys: readonly ReadinessKey[] = ["lab"];

export type ArticleDraft = {
  title: string;
  summary: string;
  content: ArticleContent;
  neighborhoodId: string | null;
  /** Yalnızca yayındaki bir lab sayılır (düzenleyici ve sunucu bunu bilerek verir). */
  relatedLabId: string | null;
  sourceName: string;
  sourceUrl: string;
  /** Yayın haftası (Cuma, "2026-10-16"); seçilmediyse null. */
  week: string | null;
};

export type ReadinessItem = { key: ReadinessKey; ok: boolean; required: boolean };

export type Readiness = {
  items: ReadinessItem[];
  /** Yayın haftası dışındaki zorunlu maddeler tamam (listede "Yayına hazır"). */
  contentReady: boolean;
  /** Planlanabilir: içerik hazır ve hafta seçili. */
  ready: boolean;
  /** Eksik zorunlu maddeler (hafta hariç), sırayla. */
  missing: ReadinessKey[];
  done: number;
  total: number;
};

/**
 * "Yayına hazır mı?" (Gundem-Son): taslak eksikle kaydedilir, planlamak için her zorunlu madde
 * gerekir. İlgili lab önerilir.
 */
export function readiness(draft: ArticleDraft): Readiness {
  const c = draft.content;
  const title = draft.title.trim();
  const summary = draft.summary.trim();
  const source = checkSourceUrl(draft.sourceUrl);
  // Adres yazılmış ve URL olarak okunabiliyor (güvenilir olup olmadığı ayrı madde).
  const sourceWritten = source.ok || (source.problem !== "empty" && source.problem !== "invalid");
  const checks: Record<ReadinessKey, boolean> = {
    titleSummary:
      title.length >= readyMinimums.title &&
      title.length <= newsLimits.title &&
      summary.length >= readyMinimums.summary &&
      summary.length <= newsLimits.summary,
    whatsHappening: c.whatsHappening.trim().length >= readyMinimums.whatsHappening,
    signs: c.signs.length === signCount && c.signs.every((s) => s.sign.trim() !== "" && s.explanation.trim() !== ""),
    actions: c.actions.filter((a) => a.trim() !== "").length >= readyMinimums.actions,
    takeaways: c.takeaways.length === takeawayCount && c.takeaways.every((t) => t.trim().length >= readyMinimums.takeaway),
    topic: !!draft.neighborhoodId,
    source: draft.sourceName.trim() !== "" && sourceWritten,
    trustedSource: source.ok,
    lab: !!draft.relatedLabId,
    week: !!draft.week && fridayPublishTime(draft.week) !== null,
  };
  const items = readinessKeys.map((key) => ({ key, ok: checks[key], required: !optionalKeys.includes(key) }));
  const missing = items.filter((i) => i.required && !i.ok && i.key !== "week").map((i) => i.key);
  return {
    items,
    contentReady: missing.length === 0,
    ready: missing.length === 0 && checks.week,
    missing,
    done: items.filter((i) => i.ok).length,
    total: items.length,
  };
}

// ---------------------------------------------------------------------------------------
// Adres (slug)
// ---------------------------------------------------------------------------------------

/**
 * Taslağın geçici adresi. Asıl adres ilk planlamada başlıktan üretilir ve sonra değişmez.
 * Alt çizgi slugify'ın üretemeyeceği bir karakterdir: geçici adres gerçek bir adresle çakışmaz.
 */
export const draftSlugPrefix = "_taslak-";
export const isDraftSlug = (slug: string) => slug.startsWith(draftSlugPrefix);
