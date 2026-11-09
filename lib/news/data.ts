// Gündem verisini okuyan sunucu fonksiyonları: herkese açık liste ve haber (yalnızca yayındakiler),
// yönetimdeki liste, düzenleyici ve yayın haftaları. Yalnızca sunucuda.
//
// Yayında olmak: durum SCHEDULED ya da PUBLISHED ve publishedAt <= şimdi (lib/news/content.ts,
// liveWhere). Taslak ve yayın anı gelmemiş haber herkese açık sayfalarda hiç yoktur.

import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getPublishedLabs, requestTime } from "@/lib/lab/data";
import type { LabDifficulty, LabKind } from "@/lib/lab/route";
import { smartQuotes } from "@/lib/typography";
import {
  articleState,
  checkSourceUrl,
  fridayPublishTime,
  isDraftSlug,
  liveWhere,
  parseArticleContent,
  readiness,
  readingMinutes,
  upcomingFridays,
  weekKeyOf,
  type ArticleContent,
  type ArticleState,
  type Readiness,
} from "./content";
import { coverUrl, type CoverView } from "./cover";
import { dayMonthText, fullDateText, monthYearText } from "./dates";

/** Haberin konusu: mahallenin adı, konusu, rengi ve ikonu. */
export type ArticleTopic = { id: string; slug: string; name: string; topic: string; color: string; icon: string };

const topicSelect = { id: true, slug: true, name: true, topic: true, color: true, icon: true } as const;

export type PublicArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publishedAt: Date;
  /** "9 Ekim" */
  day: string;
  /** "9 Ekim 2026" */
  date: string;
  /** "Ekim 2026" (zaman çizelgesindeki ay başlığı) */
  month: string;
  minutes: number;
  topic: ArticleTopic | null;
  content: ArticleContent;
  sourceName: string;
  /** Yalnızca güvenilir listedeki https adres; değilse null (bağlantı çizilmez). */
  sourceUrl: string | null;
  /** İlgili lab yayındaysa adresi; değilse null. */
  labSlug: string | null;
  /** Kapak görseli; yoksa null (konunun çizimi görünür). */
  cover: CoverView | null;
  readCount: number;
};

const publicSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  content: true,
  sourceName: true,
  sourceUrl: true,
  publishedAt: true,
  readCount: true,
  coverFocusX: true,
  coverFocusY: true,
  coverAlt: true,
  coverCredit: true,
  cover: { select: { width: true, height: true, updatedAt: true } },
  neighborhood: { select: topicSelect },
  relatedLab: { select: { slug: true, status: true, publishedVersion: true } },
} as const;

type PublicRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: unknown;
  sourceName: string;
  sourceUrl: string;
  publishedAt: Date | null;
  readCount: number;
  neighborhood: ArticleTopic | null;
  relatedLab: { slug: string; status: string; publishedVersion: number | null } | null;
} & CoverColumns;

type CoverColumns = {
  id: string;
  coverFocusX: number;
  coverFocusY: number;
  coverAlt: string;
  coverCredit: string;
  cover: { width: number; height: number; updatedAt: Date } | null;
};

/** Kapak sütunlarından kapak bilgisi; görsel yoksa null. */
export function coverOf(row: CoverColumns): CoverView | null {
  if (!row.cover) return null;
  return {
    src: coverUrl(row.id, row.cover.updatedAt.getTime()),
    width: row.cover.width,
    height: row.cover.height,
    focusX: row.coverFocusX,
    focusY: row.coverFocusY,
    alt: row.coverAlt,
    credit: row.coverCredit,
  };
}

function toPublic(row: PublicRow): PublicArticle {
  const content = parseArticleContent(row.content);
  const publishedAt = row.publishedAt ?? new Date(0);
  const source = checkSourceUrl(row.sourceUrl);
  const lab = row.relatedLab;
  return {
    id: row.id,
    slug: row.slug,
    title: smartQuotes(row.title),
    summary: row.summary,
    publishedAt,
    day: dayMonthText(publishedAt),
    date: fullDateText(publishedAt),
    month: monthYearText(publishedAt),
    minutes: readingMinutes(content),
    topic: row.neighborhood,
    content,
    sourceName: row.sourceName,
    sourceUrl: source.ok ? source.href : null,
    labSlug: lab && lab.status === "PUBLISHED" && lab.publishedVersion !== null ? lab.slug : null,
    cover: coverOf(row),
    readCount: row.readCount,
  };
}

/** Yayındaki bütün haberler, en yenisi önce. */
export const getPublishedArticles = cache(async (): Promise<PublicArticle[]> => {
  const now = await requestTime();
  const rows = await db.newsArticle.findMany({
    where: liveWhere(now),
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    select: publicSelect,
  });
  return rows.map(toPublic);
});

/** En yeni `limit` haber (tanıtım sayfası, öğrenci ana sayfası). */
export async function getLatestArticles(limit: number): Promise<PublicArticle[]> {
  const now = await requestTime();
  const rows = await db.newsArticle.findMany({
    where: liveWhere(now),
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit,
    select: publicSelect,
  });
  return rows.map(toPublic);
}

/** Adresi verilen haber; taslak, planlı (yayın anı gelmemiş) ya da yoksa null. */
export const getPublishedArticle = cache(async (slug: string): Promise<PublicArticle | null> => {
  if (typeof slug !== "string" || slug.length > 120 || isDraftSlug(slug)) return null;
  const now = await requestTime();
  const row = await db.newsArticle.findFirst({ where: { slug, ...liveWhere(now) }, select: publicSelect });
  return row ? toPublic(row) : null;
});

// ---------------------------------------------------------------------------------------
// Yönetim
// ---------------------------------------------------------------------------------------

export type AdminArticleRow = {
  id: string;
  title: string;
  state: ArticleState;
  /** Yayın haftası ("2026-10-16"); taslakta null. */
  week: string | null;
  /** "16 Ekim"; taslakta boş. */
  day: string;
  topic: ArticleTopic | null;
  readCount: number;
  readiness: Pick<Readiness, "contentReady" | "missing" | "done" | "total">;
  /** Sıralama için (taslaklar son düzenlenen önce). */
  updatedAt: number;
};

/** Yönetimdeki liste (Gundem-Son): Yayında, Planlı, Taslak sekmeleri. */
export async function getAdminArticles(): Promise<AdminArticleRow[]> {
  const [now, rows, labs] = await Promise.all([
    requestTime(),
    db.newsArticle.findMany({
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        summary: true,
        content: true,
        sourceName: true,
        sourceUrl: true,
        status: true,
        publishedAt: true,
        readCount: true,
        relatedLabId: true,
        neighborhoodId: true,
        updatedAt: true,
        neighborhood: { select: topicSelect },
      },
    }),
    getPublishedLabs(),
  ]);
  const published = new Set(labs.map((l) => l.id));
  return rows.map((row) => {
    const state = articleState(row, now);
    const week = row.publishedAt && state !== "draft" ? weekKeyOf(row.publishedAt) : null;
    const check = readiness({
      title: row.title,
      summary: row.summary,
      content: parseArticleContent(row.content),
      neighborhoodId: row.neighborhoodId,
      relatedLabId: row.relatedLabId && published.has(row.relatedLabId) ? row.relatedLabId : null,
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl,
      week,
    });
    return {
      id: row.id,
      title: row.title,
      state,
      week,
      day: row.publishedAt && state !== "draft" ? dayMonthText(row.publishedAt) : "",
      topic: row.neighborhood,
      readCount: row.readCount,
      readiness: { contentReady: check.contentReady, missing: check.missing, done: check.done, total: check.total },
      updatedAt: row.updatedAt.getTime(),
    };
  });
}

export type EditorArticle = {
  id: string;
  /** Asıl adres (ilk planlamadan sonra); taslakta null. */
  slug: string | null;
  state: ArticleState;
  week: string | null;
  /** Yayın haftasının adı ("16 Ekim", "16 Ekim 2026"); taslakta null. */
  weekLabel: { day: string; date: string } | null;
  readCount: number;
  title: string;
  summary: string;
  content: ArticleContent;
  neighborhoodId: string | null;
  relatedLabId: string | null;
  sourceName: string;
  sourceUrl: string;
  /** Kapak görseli (adres ve boyut); yoksa null. */
  cover: { src: string; width: number; height: number } | null;
  coverFocusX: number;
  coverFocusY: number;
  coverAlt: string;
  coverCredit: string;
};

/** Düzenleyicide açılan haber. */
export async function getEditorArticle(id: string): Promise<EditorArticle | null> {
  if (typeof id !== "string" || id.length > 64) return null;
  const [now, row] = await Promise.all([
    requestTime(),
    db.newsArticle.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        content: true,
        sourceName: true,
        sourceUrl: true,
        status: true,
        publishedAt: true,
        readCount: true,
        neighborhoodId: true,
        relatedLabId: true,
        coverFocusX: true,
        coverFocusY: true,
        coverAlt: true,
        coverCredit: true,
        cover: { select: { width: true, height: true, updatedAt: true } },
      },
    }),
  ]);
  if (!row) return null;
  const cover = coverOf(row);
  const state = articleState(row, now);
  return {
    id: row.id,
    slug: isDraftSlug(row.slug) ? null : row.slug,
    state,
    week: row.publishedAt && state !== "draft" ? weekKeyOf(row.publishedAt) : null,
    weekLabel: row.publishedAt && state !== "draft" ? { day: dayMonthText(row.publishedAt), date: fullDateText(row.publishedAt) } : null,
    readCount: row.readCount,
    title: row.title,
    summary: row.summary,
    content: parseArticleContent(row.content),
    neighborhoodId: row.neighborhoodId,
    relatedLabId: row.relatedLabId,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    cover: cover ? { src: cover.src, width: cover.width, height: cover.height } : null,
    coverFocusX: row.coverFocusX,
    coverFocusY: row.coverFocusY,
    coverAlt: row.coverAlt,
    coverCredit: row.coverCredit,
  };
}

/** Düzenleyicinin lab seçeneği: yayındaki lab (önizlemedeki "Bunu odada dene" kutusu için kapak bilgisi). */
export type EditorLab = {
  id: string;
  slug: string;
  type: LabKind;
  name: string;
  difficulty: LabDifficulty;
  durationMin: number;
  /** Yayında değilse (sonradan gizlendiyse) seçili kalır ama haberde görünmez. */
  published: boolean;
};

export type EditorNeighborhood = ArticleTopic & { labs: EditorLab[] };

export type WeekOption = {
  key: string;
  /** "16 Ekim" */
  day: string;
  /** "16 Ekim 2026" (önizlemedeki tarih) */
  date: string;
  /** O haftaya planlanmış başka haber. */
  takenBy: { id: string; title: string } | null;
};

export type EditorOptions = { neighborhoods: EditorNeighborhood[]; weeks: WeekOption[] };

/**
 * Düzenleyicinin seçenekleri: konular ve yayındaki labları; önümüzdeki Cumalar ve o haftaya
 * planlanmış haber ("dolu"). `current` haberin bağlı labı yayında değilse de listede kalır.
 */
export async function getEditorOptions(current?: { relatedLabId: string | null } | null): Promise<EditorOptions> {
  const now = await requestTime();
  const keys = upcomingFridays(now);
  const times = keys.map((k) => fridayPublishTime(k)!);
  const [neighborhoods, labs, taken, extra] = await Promise.all([
    db.neighborhood.findMany({ orderBy: { sortOrder: "asc" }, select: topicSelect }),
    getPublishedLabs(),
    db.newsArticle.findMany({
      where: { status: { in: ["SCHEDULED", "PUBLISHED"] }, publishedAt: { in: times } },
      select: { id: true, title: true, publishedAt: true },
    }),
    current?.relatedLabId
      ? db.lab.findUnique({
          where: { id: current.relatedLabId },
          select: { id: true, slug: true, type: true, neighborhoodId: true, difficulty: true, durationMin: true, draftContent: true },
        })
      : Promise.resolve(null),
  ]);
  return {
    neighborhoods: neighborhoods.map((n) => {
      const own: EditorLab[] = labs
        .filter((lab) => lab.neighborhoodId === n.id)
        .map((lab) => ({ id: lab.id, slug: lab.slug, type: lab.type, name: lab.meta.name, difficulty: lab.difficulty, durationMin: lab.durationMin, published: true }));
      if (extra && extra.neighborhoodId === n.id && !own.some((l) => l.id === extra.id)) {
        const meta = (extra.draftContent as { meta?: { name?: unknown } } | null)?.meta;
        own.push({
          id: extra.id,
          slug: extra.slug,
          type: extra.type,
          name: typeof meta?.name === "string" && meta.name ? meta.name : extra.slug,
          difficulty: extra.difficulty,
          durationMin: extra.durationMin,
          published: false,
        });
      }
      return { ...n, labs: own };
    }),
    weeks: keys.map((key, i) => {
      const other = taken.find((a) => a.publishedAt?.getTime() === times[i].getTime());
      return { key, day: dayMonthText(times[i]), date: fullDateText(times[i]), takenBy: other ? { id: other.id, title: other.title } : null };
    }),
  };
}
