import Link from "next/link";
import { Flame, Play } from "lucide-react";
import { NeighborhoodIcon, toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { withNext } from "@/lib/account/shared";
import { format, getMessages } from "@/lib/i18n";
import type { LabDifficulty } from "@/lib/lab/route";
import type { CoverView } from "@/lib/news/cover";
import { paths, routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { CoverImage } from "./CoverImage";
import { ReportBox } from "./ReportBox";
import { TopicDot } from "./TopicChip";

export type AsideTopic = { slug: string; topic: string; color: string; count: number };

/** "Bu ayın en çok okunanı" (ayın ilk haftasında geçen ayın); yalnızca toplam okuma sayısı. */
export type AsideMostRead = {
  slug: string;
  title: string;
  day: string;
  readCount: number;
  /** false: ayın ilk haftası, geçen ayın en çok okunanı. */
  current: boolean;
  cover: CoverView | null;
  topic: { color: string; icon: string } | null;
};

export type AsideNextLab = {
  name: string;
  href: string;
  district: string;
  difficulty: LabDifficulty;
  durationMin: number;
  icon: string;
  color: string;
  /** Bu haftanın haberinin labı mı, yoksa kaldığı yer mi? */
  fromNews: boolean;
};

/**
 * Gündem listesinin sağ sütunu (Gundem-G2-Ogrenci; 4 Kasım revizesi, 15): son 3 ayın konuları
 * (çubuklu), bu ayın en çok okunanı, "Nereye bildirilir"; ziyaretçide "Okumak yetmez, bir de
 * dene" kayıt kutusu, öğrencide "Sıradaki odan" kartı. Telefonda listenin altına iner: konular
 * üstteki süzgeçte olduğu için orada yoktur, kayıt ve sıradaki oda kutuları da yalnızca masaüstünde.
 */
export function NewsAside({
  topics,
  member,
  nextLab,
  mostRead,
}: {
  topics: AsideTopic[];
  member: boolean;
  nextLab: AsideNextLab | null;
  mostRead: AsideMostRead | null;
}) {
  const t = getMessages();
  const l = t.news.list;
  const max = Math.max(1, ...topics.map((tp) => tp.count));
  return (
    <aside className="flex flex-col gap-4">
      <section aria-labelledby="news-topics" className="hidden flex-col gap-3 rounded-[20px] border border-line bg-surface p-5 lg:flex">
        <h2 id="news-topics" className="m-0 text-base font-bold">
          {l.topicsTitle}
        </h2>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {topics.map((tp) => (
            <li key={tp.slug} className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 text-sm">
              <TopicDot color={tp.color} className="size-2.5" />
              <span className="text-fg-2">{tp.topic}</span>
              <b>{tp.count}</b>
              <span aria-hidden="true" className="col-start-2 col-end-4 h-1 overflow-hidden rounded bg-card">
                <span className={cn("block h-full rounded", toneOf(tp.color).fill)} style={{ width: `${(tp.count / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </section>

      {!member ? (
        <section className="hidden flex-col gap-3 rounded-[20px] border border-line bg-surface bg-[radial-gradient(80%_120%_at_0%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_60%)] p-5 lg:flex">
          <h2 className="m-0 font-heading text-[19px] leading-tight font-bold">{l.tryTitle}</h2>
          <p className="m-0 text-sm leading-normal text-fg-2">{l.tryText}</p>
          <Link
            href={withNext(routes.signUp, routes.news)}
            className="flex h-[46px] items-center justify-center rounded-xl bg-accent font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
          >
            {t.nav.links.signUp}
          </Link>
        </section>
      ) : nextLab ? (
        <section className="hidden flex-col gap-3 rounded-[20px] border border-accent/45 bg-surface bg-[radial-gradient(80%_120%_at_0%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_60%)] p-5 lg:flex">
          <span className="self-start rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tracking-[1px] text-on-accent">{l.nextLab}</span>
          <span className="flex items-center gap-3">
            <NeighborhoodIcon icon={nextLab.icon} color={nextLab.color} className="size-11" iconClassName="size-[22px]" />
            <span className="flex min-w-0 flex-col">
              <span className="font-heading text-lg leading-tight font-bold break-words">{nextLab.name}</span>
              <span className="text-[13px] text-fg-3">
                {format(t.news.article.labMeta, { district: nextLab.district, difficulty: t.lab.difficulty[nextLab.difficulty], minutes: nextLab.durationMin })}
              </span>
            </span>
          </span>
          <p className="m-0 text-[13px] leading-normal text-fg-2">{nextLab.fromNews ? l.nextLabNews : l.nextLabContinue}</p>
          <Link
            href={nextLab.href}
            className="flex h-[46px] items-center justify-center gap-2 rounded-xl bg-accent font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
          >
            <Play className="size-4" strokeWidth={2.4} aria-hidden="true" />
            {l.start}
          </Link>
        </section>
      ) : null}

      {mostRead ? (
        <section aria-labelledby="news-most-read" className="flex flex-col gap-3 rounded-[20px] border border-warning/40 bg-surface p-4">
          <h2 id="news-most-read" className="m-0 inline-flex items-center gap-1.5 text-[11px] leading-none font-bold tracking-[1.4px] text-warning-fg">
            <Flame className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
            {mostRead.current ? l.mostRead : l.mostReadLast}
          </h2>
          <Link href={paths.article(mostRead.slug)} className="group flex items-center gap-3 text-fg no-underline">
            <CoverImage cover={mostRead.cover ? { ...mostRead.cover, alt: "" } : null} topic={mostRead.topic} className="size-16 flex-none rounded-xl" />
            <span className="flex min-w-0 flex-col gap-1">
              <b className="font-heading text-[15.5px] leading-tight break-words group-hover:underline">{mostRead.title}</b>
              <small className="text-[12.5px] text-fg-3">{format(l.mostReadMeta, { n: mostRead.readCount.toLocaleString("tr-TR"), day: mostRead.day })}</small>
            </span>
          </Link>
        </section>
      ) : null}

      <ReportBox className="rounded-[20px] p-5" />
    </aside>
  );
}
