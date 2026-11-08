import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { dayMonth, memberSince } from "@/lib/account/dates";
import { avatarOf } from "@/lib/avatars";
import { dailyTip } from "@/lib/content/landing";
import { db } from "@/lib/db";
import { format, getMessages } from "@/lib/i18n";
import { getCityView, getLabStats, getNeighborhoods, getPublishedLabs, getReports, requestTime } from "@/lib/lab/data";
import { allLabs, labHref, routeOf, type CityView, type LabView } from "@/lib/lab/route";
import { paths, routes } from "@/lib/navigation";
import { assignmentViews, getHomeClasses } from "@/lib/classroom/student";
import { getLatestArticles } from "@/lib/news/data";
import { badgeCodes } from "@/lib/progress/badges";
import { nextBadge } from "@/lib/progress/next-badge";
import { getProgressSummary } from "@/lib/progress/summary";
import { ClassCard, type HomeClassData } from "./ClassCard";
import { LabStatsTabs, type StatRow, type StatTab } from "./LabStatsTabs";
import { NewsCard, type NewsCardData } from "./NewsCard";
import { NextBadgeCard } from "./NextBadgeCard";
import { ProfileCard } from "./ProfileCard";
import { RecentReports, type ReportItem } from "./RecentReports";
import { RoadmapCards } from "./RoadmapCards";
import { TodayTip } from "./TodayTip";

/** "En zorlu" sekmesine girmek için labı bitirmiş olması gereken en az öğrenci (az veride oran yanıltır). */
const minFinishedForRate = 3;
const statRowCount = 5;

/**
 * Öğrenci ana sayfası (Tur 2; tahtalar: Ana-Sayfa-Son, Ana-Sayfa-Son-Mobil): profil kartı,
 * günün ipucu, sınıf kartı ve öğretmeninin verdiği ödev (Ana-Sayfa-Odev), sıradaki rozet, gündem,
 * lab istatistikleri, yol haritası ve son raporlar. Toplu sayılarda öğrenci adı yoktur.
 */
export async function StudentHome({ userId }: { userId: string }) {
  const t = getMessages().home;
  const [row, summary, city, stats, labs, neighborhoods, reportRows, now, classes] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, displayName: true, gradeLevel: true, avatar: true, createdAt: true, emailVerified: true },
    }),
    getProgressSummary(userId),
    getCityView(userId),
    getLabStats(),
    getPublishedLabs(),
    getNeighborhoods(),
    getReports(userId, { limit: 3 }),
    requestTime(),
    getHomeClasses(userId),
  ]);
  const startHref = city.continueHref ?? routes.roadmap;

  const views = allLabs(city.districts);
  const idOf = new Map(labs.map((lab) => [lab.slug, lab.id]));
  const labStats = statRows(views, idOf, stats);

  const reports: ReportItem[] = reportRows.flatMap((report) => {
    const lab = labs.find((l) => l.id === report.labId);
    if (!lab) return [];
    return [
      {
        href: paths.labReport(lab.slug, report.attemptId),
        name: lab.meta.name,
        district: neighborhoods.find((n) => n.id === lab.neighborhoodId)?.name ?? "",
        date: report.endedAt ? dayMonth(report.endedAt) : "",
        status: report.status,
        score: report.score,
      },
    ];
  });

  const next = nextBadge(summary.badges);
  const tip = { text: dailyTip.text, reason: dailyTip.reason, date: dayMonth(now) };
  const news = await newsOf(city);
  const classData: HomeClassData = {
    classes: classes.classes,
    assignments: assignmentViews(classes.assignments, classes.classes, city.districts, neighborhoods, labs, now),
  };

  return (
    <div className="relative mx-auto flex max-w-[1200px] flex-col gap-3.5 px-4 pt-4 pb-10 lg:gap-8 lg:px-6 lg:pt-10 lg:pb-[72px]">
      <div className="flex flex-col gap-3.5 lg:flex-row lg:flex-wrap lg:items-stretch lg:gap-5">
        <ProfileCard
          className="lg:flex-[1_1_640px]"
          data={{
            name: row.displayName,
            avatar: avatarOf(row).emoji,
            grade: row.gradeLevel,
            since: memberSince(row.createdAt),
            level: summary.level,
            stats: summary.stats,
            showcase: summary.showcase,
            earnedCount: summary.earnedCount,
            badgeTotal: badgeCodes.length,
            continueHref: city.continueHref,
          }}
          footer={<NextBadgeCard badge={next} />}
        />
        <section aria-label={t.today} className="hidden flex-col gap-5 lg:flex lg:max-w-[380px] lg:flex-[1_1_320px]">
          <TodayTip userId={userId} fallback={tip} />
          <ClassCard data={classData} verified={row.emailVerified} className="flex-1" />
        </section>
      </div>

      {/* Telefon: "Bugün" şeridi (gündem, ipucu, sıradaki rozet, sınıf kartı) */}
      <section aria-labelledby="home-today" className="mt-2 flex flex-col gap-3.5 lg:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="home-today" className="m-0 font-heading text-[21px] font-bold">
            {t.today}
          </h2>
          <span aria-hidden="true" className="text-[13px] text-fg-3">
            {t.swipe}
          </span>
        </div>
        <ul className="-mx-4 m-0 flex list-none snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pt-0.5 pb-1.5 [scrollbar-width:none]">
          {news ? (
            <li className="flex w-[300px] flex-none snap-start">
              <NewsCard news={news} compact className="flex-1" />
            </li>
          ) : null}
          <li className="flex w-[300px] flex-none snap-start">
            <TodayTip userId={userId} fallback={tip} className="flex-1" />
          </li>
          <li className="flex w-[300px] flex-none snap-start">
            <NextBadgeCard badge={next} className="flex-1" />
          </li>
          <li className="flex w-[300px] flex-none snap-start">
            <ClassCard data={classData} verified={row.emailVerified} className="flex-1" />
          </li>
        </ul>
      </section>

      <section aria-labelledby="home-stats" className="mt-2 flex flex-col gap-3.5 lg:mt-0 lg:gap-4">
        <h2 id="home-stats" className="m-0 font-heading text-[21px] font-bold lg:text-[26px]">
          <span className="lg:hidden">{t.sections.stats}</span>
          <span className="hidden lg:inline">{t.sections.newsAndStats}</span>
        </h2>
        <div className="flex flex-wrap items-stretch gap-5">
          {news ? <NewsCard news={news} className="hidden lg:flex lg:flex-[1_1_520px]" /> : null}
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-3.5 lg:rounded-[20px] lg:border lg:border-line lg:bg-surface lg:p-5">
            <span className="hidden text-[17px] font-bold lg:block">{t.sections.stats}</span>
            <LabStatsTabs rows={labStats} />
          </div>
        </div>
      </section>

      <div className="mt-2 lg:mt-0">
        <RoadmapCards city={city} />
      </div>

      <div className="mt-2 lg:mt-0">
        <RecentReports reports={reports} startHref={startHref} />
      </div>
    </div>
  );
}

/**
 * En yeni haber (yalnızca yayındaki) ve ilgili lab: haberin bağlı labı, yoksa haberin
 * mahallesindeki sıradaki lab. Haber yoksa kart çizilmez.
 */
async function newsOf(city: CityView): Promise<NewsCardData | null> {
  const [article] = await getLatestArticles(1);
  if (!article) return null;
  const district = city.districts.find((d) => d.slug === article.topic?.slug);
  const route = district ? routeOf(district) : [];
  const linked = article.labSlug ? allLabs(city.districts).find((l) => l.slug === article.labSlug) : undefined;
  const lab = linked ?? route.find((l) => l.slug === district?.nextSlug) ?? route[0] ?? null;
  return {
    title: article.title,
    summary: article.summary,
    date: article.day,
    href: paths.article(article.slug),
    related: lab ? { name: lab.name, href: labHref(lab) } : null,
  };
}

function statRows(
  views: LabView[],
  idOf: Map<string, string>,
  stats: Awaited<ReturnType<typeof getLabStats>>,
): Record<StatTab, StatRow[]> {
  const t = getMessages().home.labStats;
  const id = (lab: LabView) => idOf.get(lab.slug) ?? "";
  const base = (lab: LabView) => {
    const tone = toneOf(lab.district.color);
    return { slug: lab.slug, href: labHref(lab), name: lab.name, topic: lab.district.topic, dotClass: tone.fill, barClass: tone.fill, mine: lab.state === "done", isNew: lab.isNew };
  };

  const popular = views
    .map((lab) => ({ lab, n: stats.month.get(id(lab)) ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, statRowCount);
  const topMonth = popular[0]?.n ?? 1;

  const newest = [...views].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, statRowCount);
  const topCompletions = Math.max(1, ...newest.map((lab) => lab.completions));

  const hardest = views
    .filter((lab) => lab.type === "SCENARIO")
    .map((lab) => ({ lab, noticed: stats.noticed.get(id(lab)) }))
    .filter((x): x is { lab: LabView; noticed: { rate: number; students: number } } => !!x.noticed && x.noticed.students >= minFinishedForRate)
    .sort((a, b) => a.noticed.rate - b.noticed.rate)
    .slice(0, statRowCount);

  return {
    popular: popular.map(({ lab, n }) => ({ ...base(lab), barClass: "bg-accent", bar: n / topMonth, value: format(t.people, { n }) })),
    newest: newest.map((lab) => ({ ...base(lab), bar: lab.completions / topCompletions, value: dayMonth(new Date(lab.publishedAt)) })),
    hardest: hardest.map(({ lab, noticed }) => ({ ...base(lab), bar: noticed.rate, value: format(t.noticed, { n: Math.round(noticed.rate * 100) }) })),
  };
}
