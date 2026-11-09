"use client";

import Link from "next/link";
import { CircleCheck, Flag } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useRevealSelected } from "@/components/common/ScrollStrip";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { format, getMessages, rich } from "@/lib/i18n";
import type { CoverView } from "@/lib/news/cover";
import { paths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { CoverImage } from "./CoverImage";
import { TopicChip, TopicDot } from "./TopicChip";

export type TimelineTopic = { slug: string; topic: string; color: string; icon: string };

export type TimelineItem = {
  slug: string;
  title: string;
  summary: string;
  /** "9 Ekim" */
  day: string;
  /** Ay başlığı: "Ekim 2026" */
  month: string;
  minutes: number;
  topic: TimelineTopic | null;
  /** İlgili lab (yayındaysa); `done` giriş yapmış öğrenci bitirdiyse. */
  lab: { name: string; done: boolean } | null;
  /** Kare kapak; yoksa konunun çizimi. */
  cover: CoverView | null;
  /** Son 7 günde yayınlandı mı ("YENİ"). */
  isNew: boolean;
};

/** Adresteki konu süzgeci: /gundem?konu=oltalama-limani */
export const topicParam = "konu";

/**
 * Gündem listesi G2 (Gundem-G2-Zaman, -Ogrenci, -Mobil; 4 Kasım revizesi, 15): konu süzgeci
 * (Tümü + mahalleler, sayılarıyla), aylara bölünmüş dikey zaman çizelgesi ve sağ sütun (`aside`).
 * İlk ay başlığı yalnızca sol sütunda durur; sağ sütun ilk haber kartıyla aynı hizada başlar.
 * Telefonda sağ sütun listenin altına iner. Seçilen konu adrese yazılır (sayfa yenilenmez);
 * paylaşılan adres aynı süzgeçle açılır.
 */
export function NewsTimeline({
  items,
  topics,
  initialTopic,
  aside,
}: {
  items: TimelineItem[];
  topics: TimelineTopic[];
  initialTopic: string | null;
  aside: ReactNode;
}) {
  const t = getMessages().news.list;
  const [topic, setTopic] = useState<string | null>(initialTopic);
  const chipStrip = useRevealSelected<HTMLDivElement>(topic);
  const shown = topic ? items.filter((item) => item.topic?.slug === topic) : items;
  const countOf = (slug: string) => items.filter((item) => item.topic?.slug === slug).length;

  function choose(slug: string | null) {
    setTopic(slug);
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set(topicParam, slug);
    else url.searchParams.delete(topicParam);
    window.history.replaceState(null, "", url.pathname + url.search);
  }

  const chip = (on: boolean) =>
    cn(
      "inline-flex h-10 flex-none cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-bold whitespace-nowrap",
      on ? "border-accent bg-accent/10 text-fg" : "border-line bg-surface text-fg-2 hover:border-line-strong",
    );

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <div ref={chipStrip} role="group" aria-label={t.filterLabel} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
        <button type="button" aria-pressed={topic === null} onClick={() => choose(null)} className={chip(topic === null)}>
          {t.all}
          <span className="text-xs font-medium text-fg-4">{items.length}</span>
        </button>
        {topics.map((tp) => (
          <button key={tp.slug} type="button" aria-pressed={topic === tp.slug} onClick={() => choose(tp.slug)} className={chip(topic === tp.slug)}>
            <TopicDot color={tp.color} />
            {tp.topic}
            <span className="text-xs font-medium text-fg-4">{countOf(tp.slug)}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-x-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:grid-rows-[auto_1fr]">
        {shown.length > 0 ? <MonthHeading month={shown[0].month} className="pt-1.5 pb-1 lg:col-start-1 lg:row-start-1 lg:pt-0 lg:pb-1.5" /> : null}
        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {shown.length === 0 ? (
            <p className="m-0 rounded-[18px] border border-dashed border-line p-7 text-center text-fg-3">{t.emptyTopic}</p>
          ) : (
            <ol aria-label={t.timelineLabel} className="relative m-0 list-none p-0">
              <span
                aria-hidden="true"
                className="absolute -top-4 bottom-5 left-[13px] w-0.5 bg-[linear-gradient(var(--orange-fg),var(--line)_30%,var(--card))] lg:left-[17px]"
              />
              {shown.map((item, i) => (
                <li key={item.slug} className="relative">
                  {i > 0 && shown[i - 1].month !== item.month ? <MonthHeading month={item.month} className="pt-1.5 pb-1 lg:pt-2.5 lg:pb-1.5" /> : null}
                  <Row item={item} />
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="mt-6 min-w-0 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-2 lg:mt-0 lg:self-start">{aside}</div>
      </div>
    </div>
  );
}

function MonthHeading({ month, className }: { month: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="relative flex w-7 flex-none justify-center lg:w-9">
        <span className="relative z-[1] size-3 rounded-full border-2 border-orange-fg bg-canvas" />
      </span>
      <h2 className="m-0 font-heading text-lg font-bold lg:text-[22px]">{month}</h2>
    </div>
  );
}

function Row({ item }: { item: TimelineItem }) {
  const t = getMessages().news.list;
  const tone = toneOf(item.topic?.color ?? "accent");
  return (
    <div className="flex gap-3 pb-3.5">
      <span className="relative flex w-7 flex-none justify-center pt-[22px] lg:w-9">
        <span className={cn("size-2.5 rounded-full shadow-[0_0_0_4px_var(--canvas)]", item.topic ? tone.fill : "bg-fg-3")} />
      </span>
      <Link
        href={paths.article(item.slug)}
        className="flex min-w-0 flex-1 items-center gap-3.5 rounded-2xl border border-line bg-surface p-3 text-fg no-underline transition-[transform,border-color] hover:translate-x-1 hover:border-accent lg:gap-[18px] lg:rounded-[18px] lg:p-3.5"
      >
        {/* Kapak süs: haberin başlığı yanında yazıyor; alt metin haber sayfasında okunur. */}
        <CoverImage
          cover={item.cover ? { ...item.cover, alt: "" } : null}
          topic={item.topic}
          className="size-[76px] flex-none rounded-xl lg:size-[118px] lg:rounded-[14px]"
          glyphClassName="right-[-8%] h-[70%]"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2 lg:gap-2.5">
            {item.topic ? <TopicChip name={item.topic.topic} color={item.topic.color} className="h-6 px-[9px] text-[11px] lg:text-xs" /> : null}
            <span className="text-xs text-fg-3 lg:text-[13px]">
              {item.day}
              {" · "}
              {format(t.minutes, { n: item.minutes })}
            </span>
            {item.isNew ? <span className="new-badge rounded-full bg-warning px-[7px] py-0.5 text-[10px] font-bold tracking-[1px] text-on-accent">{t.isNew}</span> : null}
          </span>
          <span className="font-heading text-[17px] leading-tight font-bold break-words lg:text-xl">{item.title}</span>
          <span className="hidden text-[15px] leading-normal break-words text-fg-3 lg:block">{item.summary}</span>
          {item.lab ? (
            <span className="hidden flex-wrap items-center gap-1.5 text-[13px] text-fg-3 lg:inline-flex">
              <Flag className="size-3.5 text-fg-4" strokeWidth={2} aria-hidden="true" />
              {rich(t.relatedLab, { b: () => <b className="font-bold text-fg">{item.lab?.name}</b> })}
              {item.lab.done ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-success-fg">
                  <CircleCheck className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                  {t.done}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </Link>
    </div>
  );
}
