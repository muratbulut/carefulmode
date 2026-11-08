import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { NewsAside, type AsideNextLab } from "@/components/news/NewsAside";
import { NewsTimeline, topicParam, type TimelineItem } from "@/components/news/NewsTimeline";
import { EmptyState } from "@/components/status/EmptyState";
import { Loading } from "@/components/status/Loading";
import { brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { getCityView, getNeighborhoods, requestTime } from "@/lib/lab/data";
import { allLabs, labHref, type LabView } from "@/lib/lab/route";
import { getPublishedArticles, type PublicArticle } from "@/lib/news/data";
import { mostReadOf } from "@/lib/news/dates";
import { getUser } from "@/lib/session";

export const metadata: Metadata = { title: getMessages().pages.news, description: getMessages().news.list.description };

const day = 24 * 60 * 60 * 1000;

/** "Son 3 ayın konuları" bu kadar günü sayar. */
const recentDays = 92;

/** Bu kadar günden yeni haberde "YENİ" yazar (katalogdaki yeni oda gibi, 4 Kasım). */
const newForDays = 7;

/**
 * Gündem listesi (G2 zaman çizelgesi, 4 Kasım revizesi). Herkese açık; giriş yapmış öğrencide sağ
 * sütunda kayıt kutusu yerine "Sıradaki odan" ve bitirdiği labın yanında "Bitirdin" görünür. Sağ
 * sütunda ayrıca bu ayın en çok okunanı ve "Nereye bildirilir". Yalnızca yayındaki haberler
 * listelenir (taslak ve yayın anı gelmemiş haber yok).
 */
export default function NewsPage({ searchParams }: PageProps<"/gundem">) {
  return (
    <>
      <PageBackground />
      <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={3} />}>
        <NewsList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewsList({ searchParams }: Pick<PageProps<"/gundem">, "searchParams">) {
  const t = getMessages();
  const [params, user, articles, neighborhoods, now] = await Promise.all([
    searchParams,
    getUser(),
    getPublishedArticles(),
    getNeighborhoods(),
    requestTime(),
  ]);
  const member = !!user;
  const city = await getCityView(user?.id ?? null);
  const labs = allLabs(city.districts);
  const labOf = (slug: string | null) => (slug ? (labs.find((l) => l.slug === slug) ?? null) : null);

  const items: TimelineItem[] = articles.map((article) => {
    const lab = labOf(article.labSlug);
    return {
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      day: article.day,
      month: article.month,
      minutes: article.minutes,
      topic: article.topic ? { slug: article.topic.slug, topic: article.topic.topic, color: article.topic.color, icon: article.topic.icon } : null,
      lab: lab ? { name: lab.name, done: member && lab.state === "done" } : null,
      cover: article.cover,
      isNew: now.getTime() - article.publishedAt.getTime() < newForDays * day,
    };
  });

  const since = now.getTime() - recentDays * day;
  const most = mostReadOf(articles, now);
  const recent = articles.filter((a) => a.publishedAt.getTime() >= since);
  const topics = neighborhoods.map((n) => ({ slug: n.slug, topic: n.topic, color: n.color, icon: n.icon }));
  const requested = typeof params[topicParam] === "string" ? params[topicParam] : null;

  return (
    <section className="relative mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pt-4 pb-12 lg:gap-6 lg:px-6 lg:pt-10 lg:pb-[72px]">
      <header className="flex flex-col gap-2 lg:gap-2.5">
        <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[2px] text-orange-fg">
          <Newspaper className="size-[15px]" strokeWidth={2} aria-hidden="true" />
          {t.news.list.eyebrow}
        </span>
        <h1 className="m-0 font-heading text-[32px] leading-[1.1] font-bold lg:text-[44px]">{t.pages.news}</h1>
        <p className="m-0 max-w-[680px] text-[15px] leading-[1.55] text-fg-2 lg:text-[17px]">
          {member ? t.news.list.leadStudent : format(t.news.list.lead, { brand: brand.name })}
        </p>
      </header>

      {articles.length === 0 ? (
        <EmptyState Icon={Newspaper} title={t.news.list.emptyTitle} className="max-w-[560px] flex-none self-start py-8">
          {t.news.list.emptyText}
        </EmptyState>
      ) : (
        <NewsTimeline
          items={items}
          topics={topics}
          initialTopic={requested && topics.some((tp) => tp.slug === requested) ? requested : null}
          aside={
            <NewsAside
              topics={topics.map((tp) => ({ ...tp, count: recent.filter((a) => a.topic?.slug === tp.slug).length }))}
              member={member}
              nextLab={member ? nextLabOf(articles[0], labOf, labOf(city.continueSlug)) : null}
              mostRead={
                most
                  ? {
                      slug: most.article.slug,
                      title: most.article.title,
                      day: most.article.day,
                      readCount: most.article.readCount,
                      current: most.current,
                      cover: most.article.cover,
                      topic: most.article.topic,
                    }
                  : null
              }
            />
          }
        />
      )}
    </section>
  );
}

/**
 * Öğrencinin "Sıradaki odan" kartı: bu haftanın haberinin labı (bitirmediyse ve açıksa); yoksa
 * kaldığı yer.
 */
function nextLabOf(latest: PublicArticle | undefined, labOf: (slug: string | null) => LabView | null, fallback: LabView | null): AsideNextLab | null {
  const fromNews = labOf(latest?.labSlug ?? null);
  const usable = (lab: LabView | null) => !!lab && lab.state !== "done" && lab.state !== "locked";
  const lab = usable(fromNews) ? fromNews : usable(fallback) ? fallback : null;
  if (!lab) return null;
  return {
    name: lab.name,
    href: labHref(lab),
    district: lab.district.name,
    difficulty: lab.difficulty,
    durationMin: lab.durationMin,
    icon: lab.district.icon,
    color: lab.district.color,
    fromNews: lab === fromNews,
  };
}
