// Yönetim özetinin (Ozet-Son) verisi. Bütün sayılar veritabanında toplanır (count, FILTER, GROUP BY);
// sayfaya yalnızca toplamlar ve hazır metinler gider: öğrenci adı, e-postası ya da kimliği yok.
// Bekleyen iş kartları kişinin izinlerine göre seçilir (izni olmayan işin sayısı sayfaya hiç gönderilmez).
// Yalnızca sunucuda; çağıran sayfa önce erişimi denetler (lib/admin/access.ts).

import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { format, getMessages } from "@/lib/i18n";
import { schemaFor, type ScenarioContent, type Template } from "@/lib/lab/content";
import { requestTime } from "@/lib/lab/data";
import { can, hasLabAccess, type AdminAccess } from "./access";
import { getRecentAudit, type AuditEntryView } from "./audit-log";
import { clip } from "./audit-sentences";
import { dayKey, dayMonth, trParts, upcomingFridays, weekMs, weekStart, whenLabel } from "./calendar";
import { readContent, sameContent } from "./lab-data";
import {
  buildChart,
  buildKpis,
  buildPendingCards,
  emptyCounts,
  emptyNewsWeeks,
  overviewWindows,
  rankTraps,
  topMissed,
  trapMinSample,
  windowKeys,
  type ChartSeries,
  type Kpi,
  type MissRow,
  type PendingCard,
  type PendingInput,
  type Period,
  type TrapStat,
  type WindowCounts,
  type WindowKey,
} from "./overview-model";

// ---------------------------------------------------------------------------------------
// Sayılar ve grafik
// ---------------------------------------------------------------------------------------

type CountRow = { i: number; finished: number; firstTries: number; firstNoticed: number; signups: number; active: number; firstSignup: Date | null };

/**
 * Bütün pencerelerin sayıları tek sorguda. Biten lab: biten senaryo denemesi (tamamlandı ya da
 * hacklendi) ve biten eğitim. Tuzağı fark eden: öğrencinin o labdaki ilk biten denemesi, raporu
 * "Güvende kaldın" (getNoticeCounts ile aynı kural; pencereye ilk denemenin bittiği an girer). Aktif öğrenci: pencerede labda bir şey yapan öğrenci (deneme başlattı,
 * bitirdi, olay gönderdi, eğitim kartı ilerletti). Yeni kayıt: öğrenci hesabı.
 */
async function windowCounts(now: Date) {
  const windows = overviewWindows(now);
  const values = Prisma.join(windows.map((w, i) => Prisma.sql`(${i}::int, ${w.start}::timestamp, ${w.end}::timestamp)`));
  // Olay tablosu büyür: yalnızca hafta ve ay pencerelerinin aralığına bakılır. "Tüm zamanlar"
  // penceresi için deneme ve eğitim satırları zaten herkesi kapsar (her olayın bir denemesi var).
  const eventsFrom = new Date(Math.min(...windows.filter((w) => w.key !== "all").map((w) => w.start.getTime())));
  const rows = await db.$queryRaw<CountRow[]>`
    WITH win(i, s, e) AS (VALUES ${values}),
    finished AS (
      SELECT "endedAt" AS t, ("resultReport"->>'status' = 'safe') AS noticed,
        row_number() OVER (PARTITION BY "userId", "labId" ORDER BY "startedAt", "id") = 1 AS first
      FROM "LabAttempt" WHERE "status" IN ('COMPLETED', 'HACKED') AND "endedAt" IS NOT NULL
      UNION ALL
      SELECT "completedAt", false, false FROM "TrainingProgress" WHERE "completedAt" IS NOT NULL
    ),
    students AS (SELECT "id", "createdAt" FROM "User" WHERE "role" = 'STUDENT'),
    activity AS (
      SELECT "userId" AS u, "startedAt" AS t FROM "LabAttempt"
      UNION ALL SELECT "userId", "endedAt" FROM "LabAttempt" WHERE "endedAt" IS NOT NULL
      UNION ALL SELECT "userId", "updatedAt" FROM "TrainingProgress"
      UNION ALL SELECT a."userId", e."createdAt" FROM "LabEvent" e JOIN "LabAttempt" a ON a."id" = e."attemptId" WHERE e."createdAt" >= ${eventsFrom}
    )
    SELECT win.i,
      (SELECT count(*)::int FROM finished f WHERE f.t >= win.s AND f.t < win.e) AS finished,
      (SELECT count(*)::int FROM finished f WHERE f.first AND f.t >= win.s AND f.t < win.e) AS "firstTries",
      (SELECT count(*)::int FROM finished f WHERE f.first AND f.noticed AND f.t >= win.s AND f.t < win.e) AS "firstNoticed",
      (SELECT count(*)::int FROM students s WHERE s."createdAt" >= win.s AND s."createdAt" < win.e) AS signups,
      (SELECT count(DISTINCT x.u)::int FROM activity x JOIN students s ON s."id" = x.u WHERE x.t >= win.s AND x.t < win.e) AS active,
      (SELECT min("createdAt") FROM students) AS "firstSignup"
    FROM win ORDER BY win.i`;

  const counts = Object.fromEntries(windowKeys.map((key) => [key, { ...emptyCounts }])) as Record<WindowKey, WindowCounts>;
  for (const row of rows) {
    const key = windows[row.i]?.key;
    if (key) counts[key] = { finished: row.finished, firstTries: row.firstTries, firstNoticed: row.firstNoticed, signups: row.signups, active: row.active };
  }
  return { counts, windows, firstSignup: rows[0]?.firstSignup ?? null };
}

// ---------------------------------------------------------------------------------------
// Lablar: durum sayıları, bekleyen taslaklar, son değişiklik
// ---------------------------------------------------------------------------------------

type LabSummary = {
  published: number;
  drafts: number;
  hidden: number;
  /** Taslakta ya da yayınlanmamış değişikliği olan lablar (Lablar-Son "Yayınlanmamış değişiklik var"). */
  pending: { name: string; neighborhood: string }[];
  last: { name: string; at: Date } | null;
};

async function labSummary(): Promise<LabSummary> {
  const labs = await db.lab.findMany({
    orderBy: [{ neighborhood: { sortOrder: "asc" } }, { type: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      slug: true,
      template: true,
      status: true,
      publishedVersion: true,
      draftContent: true,
      updatedAt: true,
      neighborhood: { select: { name: true } },
    },
  });
  const published = labs.filter((l) => l.publishedVersion !== null);
  const versions = published.length
    ? await db.labVersion.findMany({
        where: { OR: published.map((l) => ({ labId: l.id, version: l.publishedVersion! })) },
        select: { labId: true, content: true },
      })
    : [];
  const live = new Map(versions.map((v) => [v.labId, v.content]));

  const rows = labs.map((lab) => {
    const content = readContent(lab.template, lab.draftContent, lab.slug);
    const current = live.get(lab.id);
    const changed = current !== undefined && !sameContent(content, schemaFor(lab.template).safeParse(current).data ?? current);
    return { lab, name: content.meta.name || lab.slug, pending: lab.status === "DRAFT" || changed };
  });
  const last = rows.reduce<(typeof rows)[number] | null>((a, b) => (!a || b.lab.updatedAt > a.lab.updatedAt ? b : a), null);
  return {
    published: labs.filter((l) => l.status === "PUBLISHED").length,
    drafts: labs.filter((l) => l.status === "DRAFT").length,
    hidden: labs.filter((l) => l.status === "HIDDEN").length,
    pending: rows.filter((r) => r.pending).map((r) => ({ name: r.name, neighborhood: r.lab.neighborhood.name })),
    last: last ? { name: last.name, at: last.lab.updatedAt } : null,
  };
}

// ---------------------------------------------------------------------------------------
// En çok tuzağa düşülen lablar (Özet ve Canlı nabız)
// ---------------------------------------------------------------------------------------

export type TrapView = {
  name: string;
  neighborhood: { name: string; color: string };
  /** Hacklenerek biten denemelerin yüzdesi. */
  rate: number;
  finished: string;
  /** En çok kaçırılan rapor satırı (sahte öğe ya da soru); yoksa null. */
  missed: string | null;
};

/**
 * Hacklenerek biten senaryo denemelerinin payı en yüksek lablar (en az trapMinSample deneme). "En
 * çok kaçırılan" saklanan rapor özetlerinden çıkar: işaretler tek tek kaydedilmediği için sahte öğe
 * ve soru satırlarından en çok "kötü" ya da "yarım" kalan gösterilir (gerçek öğe yanlış alarmdır,
 * cevaplanmayan soru kaçırma sayılmaz).
 *
 * "En çok kaçırılan" labın cevabıdır (hangi mailin sahte olduğu). Yalnızca lab izni olan (labı
 * zaten düzenleyicide gören) kişiye verilir: `withMissed` false ise hiç hesaplanmaz, sayfaya gitmez.
 * Ekipteki öğrenci hesabı labları oynayan bir öğrencidir (güvenlik turu 4).
 */
export async function getTraps(withMissed: boolean): Promise<TrapView[]> {
  const stats = await db.$queryRaw<TrapStat[]>`
    SELECT "labId", count(*)::int AS total, count(*) FILTER (WHERE "status" = 'HACKED')::int AS hacked
    FROM "LabAttempt" WHERE "status" IN ('COMPLETED', 'HACKED') GROUP BY "labId"`;
  const top = rankTraps(stats);
  if (top.length === 0) return [];
  const ids = top.map((s) => s.labId);

  const [misses, labs] = await Promise.all([
    withMissed
      ? db.$queryRaw<MissRow[]>`
          SELECT a."labId", r->>'type' AS type, coalesce(r->>'item', r->>'task') AS key, count(*)::int AS missed
          FROM "LabAttempt" a
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(a."resultReport"->'rows') = 'array' THEN a."resultReport"->'rows' ELSE '[]'::jsonb END
          ) AS r
          WHERE a."labId" = ANY(${ids}) AND a."status" IN ('COMPLETED', 'HACKED')
            AND r->>'type' IN ('fake', 'question') AND r->>'state' IN ('bad', 'part')
            AND coalesce(r->>'item', r->>'task') IS NOT NULL
          GROUP BY 1, 2, 3`
      : Promise.resolve([]),
    db.lab.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true, template: true, draftContent: true, publishedVersion: true, neighborhood: { select: { name: true, color: true } } },
    }),
  ]);
  const missedBy = topMissed(misses);
  const versions = missedBy.size
    ? await db.labVersion.findMany({
        where: { OR: labs.filter((l) => l.publishedVersion !== null).map((l) => ({ labId: l.id, version: l.publishedVersion! })) },
        select: { labId: true, content: true },
      })
    : [];
  const t = getMessages().adminOverview.traps;
  const byId = new Map(labs.map((l) => [l.id, l]));
  const live = new Map(versions.map((v) => [v.labId, v.content]));

  return top.flatMap((stat) => {
    const lab = byId.get(stat.labId);
    if (!lab) return [];
    const miss = missedBy.get(lab.id);
    const content = miss ? (readContent(lab.template, live.get(lab.id) ?? lab.draftContent, lab.slug) as ScenarioContent) : null;
    return [
      {
        name: readContent(lab.template, lab.draftContent, lab.slug).meta.name || lab.slug,
        neighborhood: lab.neighborhood,
        rate: stat.rate,
        finished: format(t.finished, { n: stat.total.toLocaleString("tr-TR") }),
        missed: miss && content ? missedLabel(lab.template, content, miss) : null,
      },
    ];
  });
}

function missedLabel(template: Template, content: ScenarioContent, miss: MissRow): string | null {
  const t = getMessages().adminOverview.traps;
  if (template === "TRAINING") return null;
  if (miss.type === "fake") {
    const item = content.items?.find((i) => i.id === miss.key);
    return item?.sender ? format(t.missedFake[template], { sender: clip(item.sender, 40) }) : null;
  }
  const task = content.tasks?.find((task) => task.id === miss.key);
  return task?.text ? format(t.missedQuestion, { text: clip(task.text, 70) }) : null;
}

// ---------------------------------------------------------------------------------------
// Bekleyen işler
// ---------------------------------------------------------------------------------------

type Counters = { pending: number; newSchool: number; answered: number; notes: number; newsDrafts: number; tipPool: number };

async function counters(): Promise<Counters> {
  const [row] = await db.$queryRaw<Counters[]>`
    SELECT
      (SELECT count(*)::int FROM "TeacherApplication" WHERE "status" = 'PENDING') AS pending,
      (SELECT count(*)::int FROM "TeacherApplication" WHERE "status" = 'PENDING' AND "schoolId" IS NULL) AS "newSchool",
      (SELECT count(*)::int FROM "TeacherApplication" WHERE "status" = 'PENDING' AND "answeredAt" IS NOT NULL) AS answered,
      (SELECT count(*)::int FROM "TeacherApplication" WHERE "status" = 'PENDING' AND "coordinatorOpinion" IS NOT NULL) AS notes,
      (SELECT count(*)::int FROM "NewsArticle" WHERE "status" = 'DRAFT') AS "newsDrafts",
      (SELECT count(*)::int FROM "DailyTip" WHERE "status" = 'POOL') AS "tipPool"`;
  return row;
}

/** Kartları kişinin izinlerine göre hazırlar: izni olmayan işin girdisi hiç verilmez. */
function pendingInput(
  access: AdminAccess,
  c: Counters,
  note: { coordinatorOpinion: "ENDORSED" | "NOT_RECOGNIZED" | null; newSchoolName: string | null; school: { name: string } | null } | null,
  newsWeeks: Date[] | null,
  labs: LabSummary,
): PendingInput {
  const input: PendingInput = {};
  if (can(access, "APPLICATIONS")) {
    input.applications = { pending: c.pending, newSchool: c.newSchool, answered: c.answered };
    input.notes = {
      count: c.notes,
      first: note?.coordinatorOpinion ? { school: note.school?.name ?? note.newSchoolName, opinion: note.coordinatorOpinion } : null,
    };
  }
  if (can(access, "NEWS") && newsWeeks) input.news = { emptyWeeks: newsWeeks, drafts: c.newsDrafts };
  if (hasLabAccess(access)) input.labs = { drafts: labs.pending };
  return input;
}

// ---------------------------------------------------------------------------------------
// Bu hafta öğrenciler ne görüyor?
// ---------------------------------------------------------------------------------------

export type SeeingView = {
  news: { label: string; title: string | null; sub: string };
  tip: { text: string | null; sub: string };
  labs: { counts: string; last: string | null };
};

const visibleNews = ["SCHEDULED", "PUBLISHED"] as const;

type TipRow = { text: string; seen: number; reason: number };

// ---------------------------------------------------------------------------------------
// Sayfanın bütün verisi
// ---------------------------------------------------------------------------------------

export type OverviewData = {
  name: string;
  eyebrow: string;
  /** "Bugün değil" seçimlerinin tarayıcıdaki anahtarı: kişiye özel, Türkiye gününe bağlı. */
  snoozeKey: string;
  cards: PendingCard[];
  kpis: Record<Period, Kpi[]>;
  chart: ChartSeries[];
  traps: TrapView[];
  seeing: SeeingView;
  /** Kayıt defterini görebilen için son kayıtlar; göremeyen için null. */
  log: AuditEntryView[] | null;
};

export async function getOverview(access: AdminAccess): Promise<OverviewData> {
  const now = await requestTime();
  const t = getMessages().adminOverview;
  const fridays = upcomingFridays(now, 4);
  const newsFrom = weekStart(fridays[0]);
  const newsTo = new Date(weekStart(fridays[fridays.length - 1]).getTime() + weekMs);

  const [numbers, labs, c, note, upcoming, latest, tip, traps, log] = await Promise.all([
    windowCounts(now),
    labSummary(),
    counters(),
    can(access, "APPLICATIONS")
      ? db.teacherApplication.findFirst({
          where: { status: "PENDING", coordinatorOpinion: { not: null } },
          orderBy: { updatedAt: "desc" },
          select: { coordinatorOpinion: true, newSchoolName: true, school: { select: { name: true } } },
        })
      : null,
    db.newsArticle.findMany({
      where: { status: { in: [...visibleNews] }, publishedAt: { gte: newsFrom } },
      orderBy: { publishedAt: "asc" },
      select: { publishedAt: true },
      take: 20,
    }),
    db.newsArticle.findFirst({
      where: { status: { in: [...visibleNews] }, publishedAt: { lte: now } },
      orderBy: { publishedAt: "desc" },
      select: { title: true, publishedAt: true, readCount: true },
    }),
    db.$queryRaw<TipRow[]>`
      SELECT t."text",
        (SELECT count(*)::int FROM "TipView" v WHERE v."tipId" = t."id" AND v."date" = d."date") AS seen,
        (SELECT count(*)::int FROM "TipView" v WHERE v."tipId" = t."id" AND v."date" = d."date" AND v."reasonViewed") AS reason
      FROM "TipDay" d JOIN "DailyTip" t ON t."id" = d."tipId"
      WHERE d."date" = ${dayKey(now)}::date`,
    getTraps(hasLabAccess(access)),
    can(access, "AUDIT_LOG") ? getRecentAudit(now, 5) : null,
  ]);

  const published = upcoming.flatMap((a) => (a.publishedAt && a.publishedAt < newsTo ? [a.publishedAt] : []));
  const next = upcoming.find((a) => a.publishedAt && a.publishedAt > now)?.publishedAt ?? null;
  const cards = buildPendingCards(pendingInput(access, c, note, emptyNewsWeeks(fridays, published), labs));
  const publishedLabs = labs.published;
  const today = trParts(now);
  const s = t.seeing;
  const todayTip = tip[0] ?? null;

  return {
    name: access.name.trim().split(/\s+/)[0] ?? access.name,
    eyebrow: format(t.eyebrow, { weekday: t.weekdays[today.weekday], date: dayMonth(now) }).toLocaleUpperCase("tr"),
    snoozeKey: `cg.admin.snooze.${createHash("sha256").update(access.userId).digest("base64url").slice(0, 16)}.${dayKey(now)}`,
    cards,
    kpis: buildKpis(numbers.counts, { now, publishedLabs, firstSignup: numbers.firstSignup }),
    chart: buildChart(numbers.counts, numbers.windows),
    traps,
    seeing: {
      news: {
        label: latest?.publishedAt ? format(s.news, { date: dayMonth(latest.publishedAt) }).toLocaleUpperCase("tr") : s.newsLabel,
        title: latest?.title || null,
        // Haber yoksa başlık zaten "Yayında haber yok."; alt satır yalnızca sıradaki haftayı söyler.
        sub: [
          latest ? format(s.reads, { n: latest.readCount.toLocaleString("tr-TR") }) : null,
          next ? format(s.next, { date: dayMonth(next) }) : s.noNext,
        ]
          .filter(Boolean)
          .join(" · "),
      },
      tip: {
        text: todayTip?.text ?? null,
        sub: [
          todayTip ? (todayTip.seen > 0 ? format(s.tipViews, { seen: todayTip.seen, reason: todayTip.reason }) : s.tipNoViews) : null,
          format(s.pool, { n: c.tipPool }),
        ]
          .filter(Boolean)
          .join(" · "),
      },
      labs: {
        counts: format(s.labCounts, { published: labs.published, drafts: labs.drafts, hidden: labs.hidden }),
        last: labs.last ? format(s.lastChange, { name: clip(labs.last.name, 50), when: whenLabel(labs.last.at, now).short }) : null,
      },
    },
    log,
  };
}

export { trapMinSample };
