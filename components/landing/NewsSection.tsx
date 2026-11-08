import Link from "next/link";
import { ArrowRight, ChevronRight, Newspaper } from "lucide-react";
import { Suspense } from "react";
import { DistrictGlyph, NeighborhoodIcon, toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { EmptyState } from "@/components/status/EmptyState";
import { format, getMessages } from "@/lib/i18n";
import { requestTime } from "@/lib/lab/data";
import { getLatestArticles } from "@/lib/news/data";
import { paths, routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Manşetin "BU HAFTA" sayılması için haberin en çok bu kadar eski olması gerekir. */
const weekMs = 7 * 24 * 60 * 60 * 1000;

/**
 * "Gündemde" bölümü (Tur 2, S2 manşet + liste): en yeni haber büyük, öncekiler yanında. Haberler
 * veritabanından, istek anında okunur (yalnızca yayındakiler). Hiç haber yoksa bölüm başlığı
 * kalır, yerine "ilk haber yakında" kutusu çıkar.
 */
export function NewsSection() {
  return (
    <Suspense fallback={null}>
      <NewsSectionContent />
    </Suspense>
  );
}

async function NewsSectionContent() {
  const t = getMessages();
  const n = t.landing.news;
  const [articles, now] = await Promise.all([getLatestArticles(4), requestTime()]);
  const [headline, ...others] = articles;
  const tone = toneOf(headline?.topic?.color ?? "accent");

  return (
    <section aria-labelledby="news-heading" className="relative mx-auto flex max-w-[1200px] flex-col gap-3.5 px-4 pt-6 pb-6 lg:gap-[22px] lg:px-6 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[2px] text-orange-fg">
            <Newspaper className="size-[15px]" strokeWidth={2} aria-hidden="true" />
            {n.eyebrow}
          </span>
          <h2 id="news-heading" className="m-0 font-heading text-[26px] leading-[1.15] font-bold lg:text-4xl">
            {n.heading}
          </h2>
          <p className="m-0 max-w-[560px] text-[15px] leading-[1.55] text-fg-2 lg:text-[17px]">{n.lead}</p>
        </div>
        <Link href={routes.news} className="-my-2 inline-flex min-h-10 items-center gap-1.5 font-bold text-accent-fg no-underline hover:underline">
          {n.all}
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>

      {headline ? (
        <div className={cn("grid gap-3.5 lg:gap-[18px]", others.length > 0 && "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]")}>
          <Link
            href={paths.article(headline.slug)}
            className="group relative flex flex-col gap-3.5 overflow-hidden rounded-[22px] border border-orange/45 keep-dark bg-[linear-gradient(135deg,color-mix(in_oklab,var(--orange)_14%,var(--canvas)),var(--surface)_55%)] p-5 text-fg no-underline transition-transform hover:-translate-y-[3px] lg:min-h-[280px] lg:p-7"
          >
            <span aria-hidden="true" className="absolute -right-6 -bottom-[30px] flex opacity-25">
              <DistrictGlyph icon={headline.topic?.icon ?? "mail"} className={cn("size-[140px] lg:size-[200px]", tone.text)} strokeWidth={1.2} />
            </span>
            <span className="relative text-xs font-bold text-orange-fg">
              {format(now.getTime() - headline.publishedAt.getTime() < weekMs ? n.thisWeek : t.news.landing.latest, { date: headline.day })}
            </span>
            <span className="relative font-heading text-2xl leading-[1.15] font-bold break-words lg:text-[32px]">{headline.title}</span>
            <span className="relative max-w-[520px] text-[15px] leading-[1.6] break-words text-fg-2 lg:text-[17px]">{headline.summary}</span>
            <span className="relative mt-auto inline-flex items-center gap-2 font-bold text-accent-fg">
              {n.read}
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
            </span>
          </Link>

          {others.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {others.map((article) => (
                <li key={article.id}>
                  <Link
                    href={paths.article(article.slug)}
                    className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-3.5 text-fg no-underline transition-[transform,border-color] hover:translate-x-1 hover:border-accent"
                  >
                    {article.topic ? <NeighborhoodIcon icon={article.topic.icon} color={article.topic.color} /> : null}
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-base leading-[1.3] font-bold break-words">{article.title}</span>
                      <span className="text-xs text-fg-3">
                        {article.topic ? format(n.meta, { topic: article.topic.topic, date: article.day }) : article.day}
                      </span>
                    </span>
                    <ChevronRight className="size-4 flex-none text-fg-4" strokeWidth={2} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <EmptyState Icon={Newspaper} tone="warning" title={t.news.landing.emptyTitle} className="flex-none py-8">
          {t.news.landing.emptyText}
        </EmptyState>
      )}
    </section>
  );
}
