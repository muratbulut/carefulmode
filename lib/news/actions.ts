"use server";

// Yönetimdeki gündem işlemleri (Gundem-Son): taslak kaydet, planla, yayındaki haberi güncelle,
// planı kaldır (taslağa al), taslağı sil ve her birinin 5 saniyelik "Geri al"ı. Her eylem NEWS
// iznini yeniden denetler, girdiyi Zod ile doğrular, istek sınırına tabidir ve kayıt defterine
// işlemle aynı veritabanı işleminde yazar (lib/audit.ts).
//
// Kurallar:
// - Taslak eksikle kaydedilir (başlık gerekir); planlamak için "Yayına hazır mı?" listesinin her
//   zorunlu maddesi ve önümüzdeki bir Cuma gerekir (lib/news/content.ts).
// - Aynı haftaya ikinci haber planlanırsa o haftadaki önceki haber taslağa döner (uyarılır).
// - Adres (slug) ilk planlamada başlıktan üretilir ve sonra hiç değişmez.
// - Yalnızca taslak silinir; silinen taslağın tamamı kayıt defterindeki satırda kalır (geri al
//   oradan okur). Yayındaki haber silinmez, "Yayından kaldır" ile taslağa döner.
// - "Geri al"ın önceki hali istemciden değil, kayıt defterindeki satırdan okunur (2 dakika).

import { randomUUID } from "node:crypto";
import * as z from "@/lib/zod";
import { getPermittedAccess, type AdminAccess } from "@/lib/admin/access";
import { slugify, uniqueSlug } from "@/lib/admin/slug";
import { auditTarget, writeAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getPublishedLabs } from "@/lib/lab/data";
import { rateLimit, rateRules } from "@/lib/rate-limit";
import {
  articleDraftContentSchema,
  articleState,
  checkSourceUrl,
  draftSlugPrefix,
  fridayPublishTime,
  isDraftSlug,
  newsLimits,
  normalizeContent,
  parseArticleContent,
  readiness,
  upcomingFridays,
  weekKeyOf,
  type ArticleDraft,
  type ArticleState,
} from "./content";
import { checkCover, coverRules, coverUrl } from "./cover";

const inputSchema = z.object({
  id: z.string().min(1).max(64).nullable(),
  title: z.string().max(newsLimits.title),
  summary: z.string().max(newsLimits.summary),
  content: articleDraftContentSchema,
  neighborhoodId: z.string().min(1).max(64).nullable(),
  relatedLabId: z.string().min(1).max(64).nullable(),
  sourceName: z.string().max(newsLimits.sourceName),
  sourceUrl: z.string().max(newsLimits.sourceUrl),
  week: z.string().max(10).nullable(),
  // Kapağın odak noktası, alt metni ve kaynağı (görselin kendisi ayrı eylemle yüklenir).
  cover: z.object({
    focusX: z.number().int().min(0).max(100),
    focusY: z.number().int().min(0).max(100),
    alt: z.string().max(coverRules.alt),
    credit: z.string().max(coverRules.credit),
  }),
});

export type ArticleInput = z.infer<typeof inputSchema>;

export type NewsActionError =
  | "forbidden"
  | "rateLimited"
  | "notFound"
  | "invalid"
  | "titleMissing"
  | "notReady"
  | "badWeek"
  | "weekTaken"
  | "nowLive"
  | "notLive"
  | "notDraft"
  | "tooLate"
  | "coverInvalid"
  | "failed";

export type NewsResult<T = object> = ({ ok: true } & T) | { ok: false; error: NewsActionError };

/** Bir haberin planlanınca yerinden ettiği haber (geri alınınca o haftaya döner). */
export type BumpedArticle = { id: string; title: string };

const fail = (error: NewsActionError) => ({ ok: false as const, error });

/** Geri al bu kadar süre içinde yapılabilir. */
const undoWindowMs = 2 * 60 * 1000;

/** Planlama işlemleri sırayla yapılır: aynı haftaya aynı anda iki haber yerleşemesin. */
const scheduleLockKey = 72_026_105;

class Stop extends Error {
  constructor(readonly code: NewsActionError) {
    super(code);
  }
}

async function begin(): Promise<AdminAccess> {
  const access = await getPermittedAccess("NEWS");
  if (!access) throw new Stop("forbidden");
  const limit = await rateLimit.consume(rateRules.adminActions, access.userId);
  if (!limit.allowed) throw new Stop("rateLimited");
  return access;
}

/** Eylemin gövdesini çalıştırır; beklenen hataları sonuca, beklenmeyenleri "failed"e çevirir. */
async function run<T extends object>(label: string, body: () => Promise<NewsResult<T>>): Promise<NewsResult<T>> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof Stop) return fail(error.code);
    console.error(`[gündem] ${label}:`, error instanceof Error ? error.message : error);
    return fail("failed");
  }
}

function parseInput(raw: unknown): ArticleInput {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) throw new Stop("invalid");
  return parsed.data;
}

const parseId = (id: unknown) => {
  if (typeof id !== "string" || id.length === 0 || id.length > 64) throw new Stop("invalid");
  return id;
};

/**
 * Konu ve ilgili lab gerçekten var mı, lab o konunun (mahallenin) labı mı? Lab yayında değilse
 * haberde görünmez; "Yayına hazır mı?" listesinde de sayılmaz.
 */
async function checkRefs(input: ArticleInput): Promise<{ labPublished: boolean }> {
  if (input.neighborhoodId) {
    const n = await db.neighborhood.findUnique({ where: { id: input.neighborhoodId }, select: { id: true } });
    if (!n) throw new Stop("invalid");
  }
  if (!input.relatedLabId) return { labPublished: false };
  if (!input.neighborhoodId) throw new Stop("invalid");
  const lab = await db.lab.findUnique({ where: { id: input.relatedLabId }, select: { neighborhoodId: true } });
  if (!lab || lab.neighborhoodId !== input.neighborhoodId) throw new Stop("invalid");
  const published = await getPublishedLabs();
  return { labPublished: published.some((l) => l.id === input.relatedLabId) };
}

const draftOf = (input: ArticleInput, labPublished: boolean, week: string | null): ArticleDraft => ({
  title: input.title,
  summary: input.summary,
  content: input.content,
  neighborhoodId: input.neighborhoodId,
  relatedLabId: labPublished ? input.relatedLabId : null,
  sourceName: input.sourceName,
  sourceUrl: input.sourceUrl,
  week,
});

/** Formdan yazılan alanlar (durum, adres ve yayın anı ayrı). */
function fields(input: ArticleInput) {
  const source = checkSourceUrl(input.sourceUrl);
  return {
    title: input.title.trim(),
    summary: input.summary.trim(),
    content: normalizeContent(input.content) as Prisma.InputJsonObject,
    neighborhoodId: input.neighborhoodId,
    relatedLabId: input.relatedLabId,
    sourceName: input.sourceName.trim(),
    // Güvenilir adres ayrıştırıcının yazdığı biçimde saklanır (öğrenci tam olarak bunu görür).
    sourceUrl: source.ok ? source.href : input.sourceUrl.trim(),
    coverFocusX: input.cover.focusX,
    coverFocusY: input.cover.focusY,
    coverAlt: input.cover.alt.trim(),
    coverCredit: input.cover.credit.trim(),
  };
}

const draftSlug = () => `${draftSlugPrefix}${randomUUID().slice(0, 12)}`;

async function lock(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${scheduleLockKey}::bigint)`;
}

/** Başlıktan haberin adresi; alınmış adreslerle çakışmaz. */
async function freshSlug(tx: Prisma.TransactionClient, title: string) {
  const slugged = slugify(title);
  // slugify boş başlıkta "oda" döner; haberde bu yanıltıcı olur.
  const base = slugged === "oda" && !/oda/i.test(title) ? "haber" : slugged;
  const taken = await tx.newsArticle.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  return uniqueSlug(base, taken.map((t) => t.slug));
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

const isUniqueViolation = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

// ---------------------------------------------------------------------------------------
// Taslak kaydet
// ---------------------------------------------------------------------------------------

/**
 * Taslağı kaydeder (yoksa açar). Planlı haber taslak olarak kaydedilince planı kalkar (tahtadaki
 * gibi); bu arada yayına girmiş haber taslağa çevrilmez ("nowLive").
 */
export async function saveArticleDraft(raw: ArticleInput): Promise<NewsResult<{ id: string; unscheduled: boolean }>> {
  return run("taslak kaydedilemedi", async () => {
    const access = await begin();
    const input = parseInput(raw);
    if (!input.title.trim()) return fail("titleMissing");
    await checkRefs(input);
    const now = new Date();
    return db.$transaction(async (tx) => {
      await lock(tx);
      if (!input.id) {
        const created = await tx.newsArticle.create({
          data: { ...fields(input), slug: draftSlug(), status: "DRAFT", authorId: access.userId },
          select: { id: true },
        });
        await writeAudit(tx, { actorId: access.userId, action: "news.created", target: auditTarget.news(created.id), details: { title: input.title.trim() } });
        return { ok: true as const, id: created.id, unscheduled: false };
      }
      const current = await tx.newsArticle.findUnique({ where: { id: input.id }, select: { id: true, status: true, publishedAt: true } });
      if (!current) return fail("notFound");
      const state = articleState(current, now);
      if (state === "live") return fail("nowLive");
      await tx.newsArticle.update({ where: { id: current.id }, data: { ...fields(input), status: "DRAFT", publishedAt: null } });
      const target = auditTarget.news(current.id);
      await writeAudit(tx, { actorId: access.userId, action: "news.updated", target, details: { title: input.title.trim() } });
      if (state === "scheduled") {
        await writeAudit(tx, {
          actorId: access.userId,
          action: "news.unscheduled",
          target,
          details: { title: input.title.trim(), reason: "savedAsDraft", previousStatus: current.status, previousPublishedAt: iso(current.publishedAt) },
        });
      }
      return { ok: true as const, id: current.id, unscheduled: state === "scheduled" };
    });
  });
}

// ---------------------------------------------------------------------------------------
// Planla
// ---------------------------------------------------------------------------------------

/**
 * Haberi kaydeder ve seçilen Cuma 08.00'e planlar. O haftaya planlanmış başka haber taslağa
 * döner (sonuçta `bumped`). Adres ilk planlamada başlıktan üretilir.
 */
export async function scheduleArticle(
  raw: ArticleInput,
): Promise<NewsResult<{ id: string; slug: string; week: string; bumped: BumpedArticle[] }>> {
  return run("haber planlanamadı", async () => {
    const access = await begin();
    const input = parseInput(raw);
    const { labPublished } = await checkRefs(input);
    if (!readiness(draftOf(input, labPublished, input.week)).ready) return fail("notReady");
    const week = input.week!;
    const time = fridayPublishTime(week)!;
    const now = new Date();
    if (!upcomingFridays(now).includes(week)) return fail("badWeek");

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await db.$transaction(async (tx) => {
          await lock(tx);
          const current = input.id
            ? await tx.newsArticle.findUnique({ where: { id: input.id }, select: { id: true, slug: true, status: true, publishedAt: true } })
            : null;
          if (input.id && !current) return fail("notFound");
          if (current && articleState(current, now) === "live") return fail("nowLive");

          const clashes = await tx.newsArticle.findMany({
            where: { status: { in: ["SCHEDULED", "PUBLISHED"] }, publishedAt: time, ...(current ? { id: { not: current.id } } : {}) },
            select: { id: true, title: true, status: true, publishedAt: true },
          });
          for (const clash of clashes) {
            await tx.newsArticle.update({ where: { id: clash.id }, data: { status: "DRAFT", publishedAt: null } });
            await writeAudit(tx, {
              actorId: access.userId,
              action: "news.unscheduled",
              target: auditTarget.news(clash.id),
              details: { title: clash.title, reason: "weekTaken", week, previousStatus: clash.status, previousPublishedAt: iso(clash.publishedAt) },
            });
          }

          const slug = current && !isDraftSlug(current.slug) ? current.slug : await freshSlug(tx, input.title.trim());
          const data = { ...fields(input), slug, status: "SCHEDULED" as const, publishedAt: time };
          let id: string;
          if (current) {
            await tx.newsArticle.update({ where: { id: current.id }, data });
            id = current.id;
          } else {
            id = (await tx.newsArticle.create({ data: { ...data, authorId: access.userId }, select: { id: true } })).id;
            await writeAudit(tx, { actorId: access.userId, action: "news.created", target: auditTarget.news(id), details: { title: data.title } });
          }
          await writeAudit(tx, {
            actorId: access.userId,
            action: "news.scheduled",
            target: auditTarget.news(id),
            details: {
              title: data.title,
              slug,
              week,
              previousStatus: current?.status ?? "DRAFT",
              previousPublishedAt: iso(current?.publishedAt ?? null),
              bumped: clashes.map((c) => ({ id: c.id, status: c.status })),
            },
          });
          return { ok: true as const, id, slug, week, bumped: clashes.map((c) => ({ id: c.id, title: c.title })) };
        });
      } catch (error) {
        // Aynı anda aynı başlıkla iki haber planlanırsa ikincisi yeni bir adres alır.
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }
    return fail("failed");
  });
}

// ---------------------------------------------------------------------------------------
// Yayındaki haberi güncelle
// ---------------------------------------------------------------------------------------

/** Yayındaki haberin değişikliklerini yayınlar: adres, durum ve yayın anı değişmez. */
export async function saveLiveArticle(raw: ArticleInput): Promise<NewsResult<{ id: string }>> {
  return run("yayındaki haber güncellenemedi", async () => {
    const access = await begin();
    const input = parseInput(raw);
    if (!input.id) return fail("invalid");
    const { labPublished } = await checkRefs(input);
    const now = new Date();
    return db.$transaction(async (tx) => {
      await lock(tx);
      const current = await tx.newsArticle.findUnique({ where: { id: input.id! }, select: { id: true, status: true, publishedAt: true } });
      if (!current) return fail("notFound");
      if (articleState(current, now) !== "live") return fail("notLive");
      if (!readiness(draftOf(input, labPublished, weekKeyOf(current.publishedAt!))).ready) return fail("notReady");
      await tx.newsArticle.update({ where: { id: current.id }, data: fields(input) });
      await writeAudit(tx, { actorId: access.userId, action: "news.updated", target: auditTarget.news(current.id), details: { title: input.title.trim(), live: true } });
      return { ok: true as const, id: current.id };
    });
  });
}

// ---------------------------------------------------------------------------------------
// Kapak görseli
// ---------------------------------------------------------------------------------------

/**
 * Kapak görselini yükler ya da değiştirir (formdaki "file" alanı). Görsel tarayıcıda yeniden
 * çizilmiş gelir; burada türü baytlarından, boyutu başlığından yeniden denetlenir
 * (lib/news/cover.ts). Haber yayındaysa yeni kapak hemen görünür.
 */
export async function uploadNewsCover(id: string, form: FormData): Promise<NewsResult<{ src: string; width: number; height: number }>> {
  return run("kapak yüklenemedi", async () => {
    const access = await begin();
    const articleId = parseId(id);
    const file = form.get("file");
    if (!(file instanceof Blob) || file.size > coverRules.maxBytes) return fail("coverInvalid");
    const data = new Uint8Array(await file.arrayBuffer());
    const checked = checkCover(data);
    if (!checked.ok) return fail("coverInvalid");
    return db.$transaction(async (tx) => {
      const article = await tx.newsArticle.findUnique({ where: { id: articleId }, select: { id: true, title: true } });
      if (!article) return fail("notFound");
      const values = { mimeType: checked.mimeType, data, width: checked.width, height: checked.height };
      const saved = await tx.newsCover.upsert({ where: { articleId }, create: { articleId, ...values }, update: values, select: { updatedAt: true } });
      await writeAudit(tx, { actorId: access.userId, action: "news.updated", target: auditTarget.news(articleId), details: { title: article.title, cover: "uploaded" } });
      return { ok: true as const, src: coverUrl(articleId, saved.updatedAt.getTime()), width: checked.width, height: checked.height };
    });
  });
}

/** Kapağı kaldırır; haber konunun (mahallenin) çizimiyle görünür. */
export async function removeNewsCover(id: string): Promise<NewsResult> {
  return run("kapak kaldırılamadı", async () => {
    const access = await begin();
    const articleId = parseId(id);
    return db.$transaction(async (tx) => {
      const article = await tx.newsArticle.findUnique({ where: { id: articleId }, select: { title: true, cover: { select: { articleId: true } } } });
      if (!article) return fail("notFound");
      if (article.cover) {
        await tx.newsCover.delete({ where: { articleId } });
        await writeAudit(tx, { actorId: access.userId, action: "news.updated", target: auditTarget.news(articleId), details: { title: article.title, cover: "removed" } });
      }
      return { ok: true as const };
    });
  });
}

// ---------------------------------------------------------------------------------------
// Planı kaldır / yayından kaldır
// ---------------------------------------------------------------------------------------

/** Planlı ya da yayındaki haberi taslağa alır (adres ve içerik kalır). */
export async function unscheduleArticle(id: string): Promise<NewsResult<{ wasLive: boolean }>> {
  return run("haber taslağa alınamadı", async () => {
    const access = await begin();
    const articleId = parseId(id);
    const now = new Date();
    return db.$transaction(async (tx) => {
      await lock(tx);
      const current = await tx.newsArticle.findUnique({ where: { id: articleId }, select: { id: true, title: true, status: true, publishedAt: true } });
      if (!current) return fail("notFound");
      const state = articleState(current, now);
      if (state === "draft") return fail("notDraft");
      await tx.newsArticle.update({ where: { id: current.id }, data: { status: "DRAFT", publishedAt: null } });
      await writeAudit(tx, {
        actorId: access.userId,
        action: "news.unscheduled",
        target: auditTarget.news(current.id),
        details: { title: current.title, reason: state === "live" ? "unpublished" : "unscheduled", previousStatus: current.status, previousPublishedAt: iso(current.publishedAt) },
      });
      return { ok: true as const, wasLive: state === "live" };
    });
  });
}

// ---------------------------------------------------------------------------------------
// Geri al
// ---------------------------------------------------------------------------------------

const scheduledLog = z.object({
  week: z.string(),
  previousStatus: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED"]),
  previousPublishedAt: z.string().nullable(),
  bumped: z.array(z.object({ id: z.string(), status: z.enum(["SCHEDULED", "PUBLISHED"]) })),
});

const unscheduledLog = z.object({
  reason: z.enum(["savedAsDraft", "unscheduled", "unpublished"]),
  previousStatus: z.enum(["SCHEDULED", "PUBLISHED"]),
  previousPublishedAt: z.string(),
});

/**
 * Haberin geri alma süresi içindeki son kaydı. `skip` verilirse o kayıtlar atlanır (ör. başka bir
 * haber planlanınca yerinden edilmesi, "weekTaken").
 */
async function recentLog(action: "news.scheduled" | "news.unscheduled" | "news.deleted", id: string, skip?: (details: Record<string, unknown>) => boolean) {
  const rows = await db.auditLog.findMany({
    where: { action, target: auditTarget.news(id), createdAt: { gte: new Date(Date.now() - undoWindowMs) } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { details: true },
  });
  const details = rows.map((r) => (r.details && typeof r.details === "object" && !Array.isArray(r.details) ? (r.details as Record<string, unknown>) : {}));
  return details.find((d) => !skip?.(d)) ?? null;
}

export type UndoneState = { state: ArticleState; week: string | null };

/** Planlamayı geri alır: haber önceki haline, yerinden ettiği haber kendi haftasına döner. */
export async function undoSchedule(id: string): Promise<NewsResult<UndoneState>> {
  return run("planlama geri alınamadı", async () => {
    const access = await begin();
    const articleId = parseId(id);
    const parsed = scheduledLog.safeParse(await recentLog("news.scheduled", articleId));
    if (!parsed.success) return fail("tooLate");
    const log = parsed.data;
    const time = fridayPublishTime(log.week);
    const previous = log.previousPublishedAt ? new Date(log.previousPublishedAt) : null;
    const now = new Date();
    return db.$transaction(async (tx) => {
      await lock(tx);
      const current = await tx.newsArticle.findUnique({ where: { id: articleId }, select: { id: true, title: true, status: true, publishedAt: true } });
      if (!current || !time || current.status === "DRAFT" || current.publishedAt?.getTime() !== time.getTime()) return fail("tooLate");
      // Bu arada yayına girdiyse geri alınmaz.
      if (time.getTime() <= now.getTime()) return fail("tooLate");
      const backTo = log.previousStatus !== "DRAFT" && previous ? { status: log.previousStatus, publishedAt: previous } : { status: "DRAFT" as const, publishedAt: null };
      if (backTo.publishedAt) {
        const other = await tx.newsArticle.count({ where: { id: { not: current.id }, status: { in: ["SCHEDULED", "PUBLISHED"] }, publishedAt: backTo.publishedAt } });
        if (other > 0) return fail("weekTaken");
      }
      await tx.newsArticle.update({ where: { id: current.id }, data: backTo });
      await writeAudit(tx, {
        actorId: access.userId,
        action: "news.unscheduled",
        target: auditTarget.news(current.id),
        details: { title: current.title, reason: "undo", week: log.week, restoredPublishedAt: iso(backTo.publishedAt) },
      });
      for (const bumped of log.bumped) {
        const row = await tx.newsArticle.findUnique({ where: { id: bumped.id }, select: { id: true, title: true, status: true, publishedAt: true } });
        if (!row || row.status !== "DRAFT" || row.publishedAt !== null) continue;
        await tx.newsArticle.update({ where: { id: row.id }, data: { status: bumped.status, publishedAt: time } });
        await writeAudit(tx, { actorId: access.userId, action: "news.scheduled", target: auditTarget.news(row.id), details: { title: row.title, reason: "undo", week: log.week } });
      }
      return { ok: true as const, state: articleState(backTo, now), week: backTo.publishedAt ? weekKeyOf(backTo.publishedAt) : null };
    });
  });
}

/** Taslağa almayı (ya da planlı haberi taslak kaydetmeyi) geri alır: haber eski yayın anına döner. */
export async function undoUnschedule(id: string): Promise<NewsResult<UndoneState>> {
  return run("taslağa alma geri alınamadı", async () => {
    const access = await begin();
    const articleId = parseId(id);
    const parsed = unscheduledLog.safeParse(await recentLog("news.unscheduled", articleId, (d) => d.reason === "weekTaken"));
    if (!parsed.success) return fail("tooLate");
    const log = parsed.data;
    const publishedAt = new Date(log.previousPublishedAt);
    if (Number.isNaN(publishedAt.getTime())) return fail("tooLate");
    const [published, now] = [await getPublishedLabs(), new Date()];
    return db.$transaction(async (tx) => {
      await lock(tx);
      const row = await tx.newsArticle.findUnique({ where: { id: articleId } });
      if (!row || row.status !== "DRAFT" || row.publishedAt !== null) return fail("tooLate");
      // Bu arada içerik eksik kaldıysa yayına geri dönmez.
      const check = readiness({
        title: row.title,
        summary: row.summary,
        content: parseArticleContent(row.content),
        neighborhoodId: row.neighborhoodId,
        relatedLabId: row.relatedLabId && published.some((l) => l.id === row.relatedLabId) ? row.relatedLabId : null,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        week: weekKeyOf(publishedAt),
      });
      if (!check.contentReady) return fail("notReady");
      if (publishedAt.getTime() > now.getTime()) {
        const other = await tx.newsArticle.count({ where: { id: { not: row.id }, status: { in: ["SCHEDULED", "PUBLISHED"] }, publishedAt } });
        if (other > 0) return fail("weekTaken");
      }
      // Hiç planlanmamış taslağın adresi yoktur; planlı haberin adresi her zaman vardır.
      const slug = isDraftSlug(row.slug) ? await freshSlug(tx, row.title) : row.slug;
      await tx.newsArticle.update({ where: { id: row.id }, data: { status: log.previousStatus, publishedAt, slug } });
      await writeAudit(tx, {
        actorId: access.userId,
        action: "news.scheduled",
        target: auditTarget.news(row.id),
        details: { title: row.title, reason: "undo", week: weekKeyOf(publishedAt) },
      });
      return { ok: true as const, state: articleState({ status: log.previousStatus, publishedAt }, now), week: weekKeyOf(publishedAt) };
    });
  });
}

// ---------------------------------------------------------------------------------------
// Taslağı sil
// ---------------------------------------------------------------------------------------

const snapshotSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  content: z.unknown(),
  sourceName: z.string(),
  sourceUrl: z.string(),
  neighborhoodId: z.string().nullable(),
  relatedLabId: z.string().nullable(),
  readCount: z.number().int(),
  authorId: z.string(),
  createdAt: z.string(),
});

/** Yalnızca taslak silinir. Taslağın tamamı kayıt defterine yazılır (kayıt defteri silinmez). */
export async function deleteDraft(id: string): Promise<NewsResult> {
  return run("taslak silinemedi", async () => {
    const access = await begin();
    const articleId = parseId(id);
    return db.$transaction(async (tx) => {
      await lock(tx);
      const row = await tx.newsArticle.findUnique({ where: { id: articleId } });
      if (!row) return fail("notFound");
      if (row.status !== "DRAFT") return fail("notDraft");
      await tx.newsArticle.delete({ where: { id: row.id } });
      await writeAudit(tx, {
        actorId: access.userId,
        action: "news.deleted",
        target: auditTarget.news(row.id),
        details: {
          title: row.title,
          snapshot: {
            slug: row.slug,
            title: row.title,
            summary: row.summary,
            content: row.content as Prisma.InputJsonValue,
            sourceName: row.sourceName,
            sourceUrl: row.sourceUrl,
            neighborhoodId: row.neighborhoodId,
            relatedLabId: row.relatedLabId,
            readCount: row.readCount,
            authorId: row.authorId,
            createdAt: row.createdAt.toISOString(),
          },
        },
      });
      return { ok: true as const };
    });
  });
}

/** Silmeyi geri alır: taslak aynı kimlikle kayıt defterindeki halinden yeniden açılır. */
export async function restoreDraft(id: string): Promise<NewsResult> {
  return run("taslak geri getirilemedi", async () => {
    const access = await begin();
    const articleId = parseId(id);
    const parsed = snapshotSchema.safeParse((await recentLog("news.deleted", articleId))?.snapshot);
    if (!parsed.success) return fail("tooLate");
    const s = parsed.data;
    return db.$transaction(async (tx) => {
      await lock(tx);
      if (await tx.newsArticle.findUnique({ where: { id: articleId }, select: { id: true } })) return fail("tooLate");
      const [slugTaken, neighborhood, lab, author] = await Promise.all([
        tx.newsArticle.findUnique({ where: { slug: s.slug }, select: { id: true } }),
        s.neighborhoodId ? tx.neighborhood.findUnique({ where: { id: s.neighborhoodId }, select: { id: true } }) : null,
        s.relatedLabId ? tx.lab.findUnique({ where: { id: s.relatedLabId }, select: { id: true } }) : null,
        tx.user.findUnique({ where: { id: s.authorId }, select: { id: true } }),
      ]);
      await tx.newsArticle.create({
        data: {
          id: articleId,
          slug: slugTaken ? draftSlug() : s.slug,
          title: s.title,
          summary: s.summary,
          content: normalizeContent(parseArticleContent(s.content)) as Prisma.InputJsonObject,
          sourceName: s.sourceName,
          sourceUrl: s.sourceUrl,
          neighborhoodId: neighborhood ? s.neighborhoodId : null,
          relatedLabId: lab ? s.relatedLabId : null,
          readCount: s.readCount,
          status: "DRAFT",
          authorId: author ? s.authorId : access.userId,
          createdAt: new Date(s.createdAt),
        },
      });
      await writeAudit(tx, { actorId: access.userId, action: "news.created", target: auditTarget.news(articleId), details: { title: s.title, reason: "undo" } });
      return { ok: true as const };
    });
  });
}
