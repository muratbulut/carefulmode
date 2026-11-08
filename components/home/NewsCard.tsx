import Link from "next/link";
import { ArrowRight, Mail, Newspaper } from "lucide-react";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type NewsCardData = {
  title: string;
  summary: string;
  date: string;
  /** Haber sayfasının adresi. */
  href: string;
  /** Haberin mahallesinde sıradaki lab. */
  related: { name: string; href: string } | null;
};

/** "Gündemde · bu hafta": haftanın haberi ve ilgili lab. */
export function NewsCard({ news, compact = false, className }: { news: NewsCardData; compact?: boolean; className?: string }) {
  const t = getMessages().home.news;
  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 overflow-hidden rounded-[20px] border border-orange/40 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--orange)_12%,transparent),var(--surface)_55%)]",
        compact ? "p-[18px]" : "gap-3.5 p-6",
        className,
      )}
    >
      <Mail aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-8 size-[150px] text-accent opacity-15" strokeWidth={1.2} />
      <span className="relative inline-flex h-7 items-center gap-1.5 self-start rounded-full bg-orange/16 px-2.5 text-xs font-bold tracking-[0.5px] text-orange-fg">
        <Newspaper className="size-3.5" strokeWidth={2} aria-hidden="true" />
        {t.eyebrow}
      </span>
      <h3 className={cn("relative m-0 font-heading leading-[1.2] font-bold", compact ? "text-xl" : "text-2xl")}>{news.title}</h3>
      <p className={cn("relative m-0 leading-[1.6] text-fg-2", compact ? "line-clamp-3 text-[15px]" : "text-[15px]")}>{news.summary}</p>
      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-xs text-fg-3 lg:text-[13px]">{news.date}</span>
        <div className={cn("flex flex-wrap gap-2", compact && "grid w-full grid-cols-2")}>
          <Link
            href={news.href}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold text-fg no-underline hover:border-accent"
          >
            {t.read}
          </Link>
          {news.related ? (
            <Link
              href={news.related.href}
              className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
            >
              <span className={cn(compact && "truncate")}>{compact ? t.related : format(t.startWith, { name: news.related.name })}</span>
              <ArrowRight className="size-4 flex-none" strokeWidth={2.2} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
