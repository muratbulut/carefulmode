// Lab verisini okuyan sunucu fonksiyonları: yayındaki lablar, öğrencinin ilerlemesi, kilitler.
// Sayfalar (yol haritası, lablar, lab detayı, ana sayfa) buradan okur. Yalnızca sunucuda.
//
// Kilit kuralı (lib/lab/gates.ts): mahallenin temel eğitimi her zaman açıktır, ileri eğitimler
// temel bitince açılır; her senaryo labı kendi eğitimi bitince açılır. Senaryolar arasında sıra
// kilidi yoktur. "Sıradaki", mahallenin rotasında bitmemiş ilk açık labdır.

import { io } from "next/cache";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Difficulty, LabType, SceneTemplate } from "@/lib/generated/prisma/enums";
import { paths } from "@/lib/navigation";
import { parseScenario, parseTraining, type LabMeta, type ScenarioContent, type TrainingContent } from "./content";
import { reduceEvents, taskProgress, type LabEventData } from "./events";
import { gateOf, isBasicPath, routeOrder, trainingsOf } from "./gates";
import { labHref, type CityView, type DistrictView, type LabView } from "./route";

export type NeighborhoodRow = { id: string; slug: string; name: string; topic: string; color: string; icon: string; sortOrder: number };

export type PublishedLab = {
  id: string;
  slug: string;
  neighborhoodId: string;
  type: LabType;
  template: SceneTemplate;
  sortOrder: number;
  /** Senaryoyu açan eğitim (Lab.unlockedById); kuralı lib/lab/gates.ts uygular. */
  unlockedById: string | null;
  difficulty: Difficulty;
  durationMin: number;
  createdAt: Date;
  version: number;
  publishedAt: Date;
  meta: LabMeta;
  training: TrainingContent | null;
  scenario: ScenarioContent | null;
};

/** Yeni etiketi: ilk yayından sonraki 7 gün (4 Kasım, Murat). */
const newForDays = 7;

export const getNeighborhoods = cache(async (): Promise<NeighborhoodRow[]> =>
  db.neighborhood.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, topic: true, color: true, icon: true, sortOrder: true },
  }),
);

/** Yayındaki bütün lablar (mahalle sırası, sonra eğitimler ve senaryolar kendi sıralarıyla). */
export const getPublishedLabs = cache(async (): Promise<PublishedLab[]> => {
  const labs = await db.lab.findMany({
    where: { status: "PUBLISHED", publishedVersion: { not: null } },
    orderBy: [{ neighborhood: { sortOrder: "asc" } }, { type: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      slug: true,
      neighborhoodId: true,
      type: true,
      template: true,
      sortOrder: true,
      unlockedById: true,
      difficulty: true,
      durationMin: true,
      createdAt: true,
      publishedVersion: true,
    },
  });
  if (labs.length === 0) return [];
  const versions = await db.labVersion.findMany({
    where: { OR: labs.map((lab) => ({ labId: lab.id, version: lab.publishedVersion! })) },
    select: { labId: true, version: true, content: true, publishedAt: true },
  });
  const firstPublished = await db.labVersion.groupBy({
    by: ["labId"],
    where: { labId: { in: labs.map((l) => l.id) } },
    _min: { publishedAt: true },
  });
  const byLab = new Map(versions.map((v) => [v.labId, v]));
  const firstBy = new Map(firstPublished.map((f) => [f.labId, f._min.publishedAt]));

  return labs.flatMap((lab) => {
    const version = byLab.get(lab.id);
    if (!version) return [];
    const training = lab.type === "TRAINING" ? parseTraining(version.content) : null;
    const scenario = lab.type === "SCENARIO" ? parseScenario(version.content) : null;
    const meta = training?.meta ?? scenario?.meta;
    if (!meta) return [];
    return [
      {
        ...lab,
        version: version.version,
        publishedAt: firstBy.get(lab.id) ?? version.publishedAt,
        meta,
        training,
        scenario,
      } satisfies PublishedLab,
    ];
  });
});

export const getPublishedLab = cache(async (slug: string) => (await getPublishedLabs()).find((lab) => lab.slug === slug) ?? null);

/**
 * İsteğin saati. Next 16'da (cacheComponents) saat okunmadan önce `io()` beklenir: ön derlemede
 * ve geliştirmedeki doğrulamada burada durulur, gerçek istekte hemen geçer.
 */
export async function requestTime() {
  await io();
  return new Date();
}

export function isNewLab(lab: Pick<PublishedLab, "publishedAt">, now = new Date()) {
  return now.getTime() - lab.publishedAt.getTime() < newForDays * 24 * 60 * 60 * 1000;
}

/**
 * Labın mahalle içindeki kısa kodu: temel eğitim "O", ileri eğitimler "OE1", "OE2"..., senaryolar
 * rota sırasıyla "O1", "O2"... (index: ileri eğitimin ya da senaryonun sırası, 0'dan).
 */
export function labCode(neighborhoodName: string, kind: "basic" | "advanced" | "scenario", index: number) {
  const letter = neighborhoodName.trim().charAt(0).toLocaleUpperCase("tr");
  if (kind === "basic") return letter;
  return kind === "advanced" ? `${letter}E${index + 1}` : `${letter}${index + 1}`;
}

// ---------------------------------------------------------------------------------------
// Öğrencinin ilerlemesi
// ---------------------------------------------------------------------------------------

export type AttemptRow = {
  id: string;
  labId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "HACKED" | "ABANDONED";
  reportScore: number | null;
  startedAt: Date;
  endedAt: Date | null;
  labVersion: number;
};

export type LabProgress = {
  /** Eğitim: bitirdi mi, kaçıncı kartta; senaryo: en iyi puan, yarım deneme. */
  done: boolean;
  doneAt: Date | null;
  best: number | null;
  finishedCount: number;
  inProgress: AttemptRow | null;
  lastFinished: AttemptRow | null;
  cardIndex: number | null;
  /** En son ne zaman uğradı (kaldığın yerden devam et için). */
  touchedAt: Date | null;
};

export type UserProgress = {
  byLab: Map<string, LabProgress>;
  attempts: AttemptRow[];
};

const emptyProgress = (): LabProgress => ({
  done: false,
  doneAt: null,
  best: null,
  finishedCount: 0,
  inProgress: null,
  lastFinished: null,
  cardIndex: null,
  touchedAt: null,
});

export const isFinished = (status: AttemptRow["status"]) => status === "COMPLETED" || status === "HACKED";

export const getUserProgress = cache(async (userId: string): Promise<UserProgress> => {
  const [training, attempts] = await Promise.all([
    db.trainingProgress.findMany({ where: { userId }, select: { labId: true, cardIndex: true, completedAt: true, updatedAt: true } }),
    db.labAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      select: { id: true, labId: true, status: true, reportScore: true, startedAt: true, endedAt: true, labVersion: true },
    }),
  ]);
  const byLab = new Map<string, LabProgress>();
  const get = (labId: string) => byLab.get(labId) ?? byLab.set(labId, emptyProgress()).get(labId)!;

  for (const row of training) {
    const p = get(row.labId);
    p.done = row.completedAt !== null;
    p.doneAt = row.completedAt;
    p.cardIndex = row.cardIndex;
    p.touchedAt = row.updatedAt;
  }
  for (const attempt of attempts) {
    const p = get(attempt.labId);
    if (!p.touchedAt || attempt.startedAt > p.touchedAt) p.touchedAt = attempt.endedAt ?? attempt.startedAt;
    if (attempt.status === "IN_PROGRESS") {
      if (!p.inProgress) p.inProgress = attempt;
      continue;
    }
    if (!isFinished(attempt.status)) continue;
    p.finishedCount++;
    if (!p.lastFinished) p.lastFinished = attempt;
    if (!p.done || (attempt.endedAt && p.doneAt && attempt.endedAt < p.doneAt)) p.doneAt = attempt.endedAt;
    p.done = true;
    if (attempt.reportScore !== null) p.best = Math.max(p.best ?? 0, attempt.reportScore);
  }
  return { byLab, attempts };
});

// ---------------------------------------------------------------------------------------
// Siber şehir: mahalleler, lablar ve durumları
// ---------------------------------------------------------------------------------------

export type LabState = "done" | "next" | "open" | "locked";

export type CityLab = {
  lab: PublishedLab;
  code: string;
  state: LabState;
  progress: LabProgress;
  /** Labı açan eğitim (temel eğitimde ve eğitimsiz mahallede null). */
  gate: PublishedLab | null;
  /** Kilitliyse açan eğitimin adı. */
  lockedBy: string | null;
  /** Temel yol: temel eğitim ve onun açtığı senaryolar (mahalle rozeti). */
  basicPath: boolean;
};

export type District = NeighborhoodRow & {
  /** Eğitimler sırayla; ilki temel eğitim. */
  trainings: CityLab[];
  /** Senaryolar rota sırasıyla. */
  scenarios: CityLab[];
  /** Rota: her eğitim, ardından onun açtığı senaryolar. */
  route: CityLab[];
  /** Eğitim + senaryo; ilerleme halkası "3/7". */
  doneCount: number;
  total: number;
  /** Temel eğitim bitti mi (eğitimi olmayan mahallede true). */
  trainingDone: boolean;
  next: CityLab | null;
};

/**
 * Şehrin hali. Kullanıcı yoksa (ziyaretçi) ilerleme yoktur; yalnız temel eğitimler açık görünür
 * (Yol-Haritasi-Ziyaretci).
 */
export async function getCity(userId: string | null): Promise<District[]> {
  const [neighborhoods, labs, progress] = await Promise.all([
    getNeighborhoods(),
    getPublishedLabs(),
    userId ? getUserProgress(userId) : Promise.resolve(null),
  ]);
  const progressOf = (lab: PublishedLab) => progress?.byLab.get(lab.id) ?? emptyProgress();
  return neighborhoods.map((n) => {
    const own = labs.filter((lab) => lab.neighborhoodId === n.id);
    const basic = trainingsOf(own, n.id)[0] ?? null;
    let advanced = 0;
    let scenarioIndex = 0;
    const route: CityLab[] = routeOrder(own, n.id).map((lab) => {
      const p = progressOf(lab);
      const gate = gateOf(lab, own);
      const locked = gate ? !userId || !progressOf(gate).done : lab.type === "SCENARIO" && !userId;
      const kind = lab.type === "SCENARIO" ? "scenario" : lab.id === basic?.id ? "basic" : "advanced";
      return {
        lab,
        code: labCode(n.name, kind, kind === "scenario" ? scenarioIndex++ : kind === "advanced" ? advanced++ : 0),
        state: p.done ? "done" : locked ? "locked" : "open",
        progress: p,
        gate,
        lockedBy: locked ? (gate?.meta.name ?? null) : null,
        basicPath: isBasicPath(lab, own),
      };
    });
    const next = route.find((x) => x.state === "open") ?? null;
    if (next && userId) next.state = "next";
    return {
      ...n,
      trainings: route.filter((x) => x.lab.type === "TRAINING"),
      scenarios: route.filter((x) => x.lab.type === "SCENARIO"),
      route,
      doneCount: route.filter((x) => x.state === "done").length,
      total: route.length,
      trainingDone: basic ? progressOf(basic).done : true,
      next,
    };
  });
}

/** Şehirde labın yeri (eğitim ya da senaryo); yayında değilse null. */
export function findInCity(city: District[], labId: string): { district: District; item: CityLab } | null {
  for (const district of city) {
    const item = district.route.find((x) => x.lab.id === labId);
    if (item) return { district, item };
  }
  return null;
}

/** Kaldığın yerden devam et: en son uğradığı yarım lab; yoksa ilk mahallenin sıradaki labı. */
export function continueTarget(city: District[]): CityLab | null {
  const all = city.flatMap((d) => d.route);
  const half = all
    .filter((x) => x.state !== "done" && x.state !== "locked" && (x.progress.inProgress || (x.progress.cardIndex ?? 0) > 0))
    .sort((a, b) => (b.progress.touchedAt?.getTime() ?? 0) - (a.progress.touchedAt?.getTime() ?? 0));
  return half[0] ?? city.map((d) => d.next).find((x) => x !== null) ?? null;
}

/** Labı bitiren öğrenci sayısı (isim yok, yalnızca toplam) ve son 7 gündekiler. */
export const getCompletionCounts = cache(async () => {
  const weekAgo = new Date((await requestTime()).getTime() - 7 * 24 * 60 * 60 * 1000);
  const [scenario, scenarioWeek, training, trainingWeek] = await Promise.all([
    db.labAttempt.groupBy({ by: ["labId", "userId"], where: { status: { in: ["COMPLETED", "HACKED"] } } }),
    db.labAttempt.groupBy({ by: ["labId", "userId"], where: { status: { in: ["COMPLETED", "HACKED"] }, endedAt: { gte: weekAgo } } }),
    db.trainingProgress.groupBy({ by: ["labId"], where: { completedAt: { not: null } }, _count: { _all: true } }),
    db.trainingProgress.groupBy({ by: ["labId"], where: { completedAt: { gte: weekAgo } }, _count: { _all: true } }),
  ]);
  const total = new Map<string, number>();
  const week = new Map<string, number>();
  for (const row of scenario) total.set(row.labId, (total.get(row.labId) ?? 0) + 1);
  for (const row of scenarioWeek) week.set(row.labId, (week.get(row.labId) ?? 0) + 1);
  for (const row of training) total.set(row.labId, row._count._all);
  for (const row of trainingWeek) week.set(row.labId, row._count._all);
  return { total, week };
});

// ---------------------------------------------------------------------------------------
// Sayfaların tarayıcıya giden hali (yol haritası, lablar, ana sayfa). Yalnızca kapak bilgisi:
// mailler, doğru kararlar ve puanlama alanları buradan geçmez (lib/lab/route.ts).
// ---------------------------------------------------------------------------------------

function toLabView(item: CityLab, district: NeighborhoodRow, order: number, completions: Map<string, number>, now: Date): LabView {
  const { lab, progress } = item;
  return {
    slug: lab.slug,
    type: lab.type,
    template: lab.template,
    name: lab.meta.name,
    title: lab.meta.title,
    summary: lab.meta.summary || lab.meta.story,
    difficulty: lab.difficulty,
    durationMin: lab.durationMin,
    cards: lab.training ? lab.training.cards.length : null,
    order,
    state: item.state,
    best: progress.best,
    inProgress: progress.inProgress !== null || (lab.type === "TRAINING" && !progress.done && (progress.cardIndex ?? 0) > 0),
    isNew: isNewLab(lab, now),
    completions: completions.get(lab.id) ?? 0,
    publishedAt: lab.publishedAt.getTime(),
    lockedBy: item.lockedBy,
    gateSlug: item.gate?.slug ?? null,
    reportHref: progress.lastFinished ? paths.labReport(lab.slug, progress.lastFinished.id) : null,
    district: { slug: district.slug, name: district.name, topic: district.topic, color: district.color, icon: district.icon, sortOrder: district.sortOrder },
  };
}

/** Şehrin tarayıcıya giden hali ve "kaldığın yerden devam et" labı. */
export async function getCityView(userId: string | null): Promise<CityView> {
  const [city, counts, now] = await Promise.all([getCity(userId), getCompletionCounts(), requestTime()]);
  const target = userId ? continueTarget(city) : null;
  const districts: DistrictView[] = city.map((d) => ({
    slug: d.slug,
    name: d.name,
    topic: d.topic,
    color: d.color,
    icon: d.icon,
    sortOrder: d.sortOrder,
    trainings: d.trainings.map((x) => toLabView(x, d, 0, counts.total, now)),
    scenarios: d.scenarios.map((x, i) => toLabView(x, d, i + 1, counts.total, now)),
    doneCount: d.doneCount,
    total: d.total,
    trainingDone: d.trainingDone,
    nextSlug: d.next?.lab.slug ?? null,
  }));
  return {
    districts,
    continueSlug: target?.lab.slug ?? null,
    continueHref: target ? labHref(target.lab) : null,
  };
}

// ---------------------------------------------------------------------------------------
// Lab detayı: yarım denemenin görevi, son raporlar
// ---------------------------------------------------------------------------------------

const toEvent = (row: { type: string; data: Prisma.JsonValue }) => ({ type: row.type, ...(row.data as object) }) as LabEventData;

/** Yarım kalan denemede kaçıncı görevde olduğu (1'den başlar) ve görev sayısı. */
export async function getAttemptTaskProgress(attempt: Pick<AttemptRow, "id" | "labVersion">, lab: PublishedLab) {
  const [content, events] = await Promise.all([
    attempt.labVersion === lab.version
      ? Promise.resolve(lab.scenario)
      : db.labVersion
          .findUnique({ where: { labId_version: { labId: lab.id, version: attempt.labVersion } }, select: { content: true } })
          .then((v) => (v ? parseScenario(v.content) : null)),
    db.labEvent.findMany({ where: { attemptId: attempt.id }, orderBy: { seq: "asc" }, select: { type: true, data: true } }),
  ]);
  const tasks = content?.tasks ?? [];
  if (tasks.length === 0) return null;
  const progress = taskProgress(tasks, reduceEvents(events.map(toEvent)), !!content?.mission?.sale);
  return { current: Math.min(progress.current + 1, tasks.length), total: tasks.length, done: progress.done.filter(Boolean).length };
}

export type ReportStatus = "safe" | "risky" | "hacked";

export type ReportRow = { attemptId: string; labId: string; score: number | null; status: ReportStatus; endedAt: Date | null };

function reportStatusOf(row: { status: string; reportScore: number | null; resultReport: Prisma.JsonValue }): ReportStatus {
  const saved = (row.resultReport as { status?: unknown } | null)?.status;
  if (saved === "safe" || saved === "risky" || saved === "hacked") return saved;
  if (row.status === "HACKED") return "hacked";
  return (row.reportScore ?? 0) >= 80 ? "safe" : "risky";
}

/** Öğrencinin son raporları (yeniden eskiye). labId verilirse yalnızca o labın. */
export async function getReports(userId: string, { labId, limit }: { labId?: string; limit: number }): Promise<ReportRow[]> {
  const rows = await db.labAttempt.findMany({
    where: { userId, labId, status: { in: ["COMPLETED", "HACKED"] } },
    orderBy: [{ endedAt: "desc" }, { startedAt: "desc" }],
    take: limit,
    select: { id: true, labId: true, status: true, reportScore: true, endedAt: true, resultReport: true },
  });
  return rows.map((r) => ({ attemptId: r.id, labId: r.labId, score: r.reportScore, status: reportStatusOf(r), endedAt: r.endedAt }));
}

// ---------------------------------------------------------------------------------------
// Ana sayfadaki lab istatistikleri: yalnızca toplam sayılar, isim yok.
// ---------------------------------------------------------------------------------------

export type LabStats = {
  /** Son 30 günde labı bitiren öğrenci sayısı. */
  month: Map<string, number>;
  /** Senaryo labında tuzağı ilk seferde fark edenlerin oranı (0-1) ve labı bitiren öğrenci sayısı. */
  noticed: Map<string, { rate: number; students: number }>;
};

export const getLabStats = cache(async (): Promise<LabStats> => {
  const monthAgo = new Date((await requestTime()).getTime() - 30 * 24 * 60 * 60 * 1000);
  const [scenarioMonth, trainingMonth, counts] = await Promise.all([
    db.labAttempt.groupBy({ by: ["labId", "userId"], where: { status: { in: ["COMPLETED", "HACKED"] }, endedAt: { gte: monthAgo } } }),
    db.trainingProgress.groupBy({ by: ["labId"], where: { completedAt: { gte: monthAgo } }, _count: { _all: true } }),
    getNoticeCounts(),
  ]);
  const month = new Map<string, number>();
  for (const row of scenarioMonth) month.set(row.labId, (month.get(row.labId) ?? 0) + 1);
  for (const row of trainingMonth) month.set(row.labId, row._count._all);
  const noticed = new Map([...counts].map(([labId, c]) => [labId, { rate: c.first / c.students, students: c.students }] as const));
  return { month, noticed };
});

// ---------------------------------------------------------------------------------------
// Tuzağı fark eden: senaryo labı başına, her öğrenci bir kez
// ---------------------------------------------------------------------------------------

/**
 * Senaryo labını bitiren öğrenci sayısı ve bunların kaçının tuzağı fark ettiği (raporu "Güvende
 * kaldın"): ilk biten denemesinde (first) ve son biten denemesinde (last, "tekrar sonrası"; tekrar
 * yapmayanın son denemesi ilkidir). Yönetimdeki lab listesi ve öğrencinin ana sayfası bunu okur;
 * sınıfın oranı aynı kuralla lib/classroom/ içinde, 5'erli gruplarla hesaplanır.
 */
export type NoticeCounts = { students: number; first: number; last: number };

export const getNoticeCounts = cache(async (): Promise<Map<string, NoticeCounts>> => {
  const rows = await db.$queryRaw<({ labId: string } & NoticeCounts)[]>`
    WITH ranked AS (
      SELECT "labId", ("resultReport"->>'status' = 'safe') AS noticed,
        row_number() OVER (PARTITION BY "labId", "userId" ORDER BY "startedAt", "id") AS from_first,
        row_number() OVER (PARTITION BY "labId", "userId" ORDER BY "startedAt" DESC, "id" DESC) AS from_last
      FROM "LabAttempt" WHERE "status" IN ('COMPLETED', 'HACKED')
    )
    SELECT "labId",
      count(*) FILTER (WHERE from_first = 1)::int AS "students",
      count(*) FILTER (WHERE from_first = 1 AND noticed)::int AS "first",
      count(*) FILTER (WHERE from_last = 1 AND noticed)::int AS "last"
    FROM ranked GROUP BY "labId"`;
  return new Map(rows.map(({ labId, ...counts }) => [labId, counts]));
});
