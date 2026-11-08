import type { SeeingView } from "@/lib/admin/overview";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "Bu hafta öğrenciler ne görüyor?" (Ozet-Son): gündemin son haberi, bugünün ipucu, lablar. */
export function StudentView({ seeing }: { seeing: SeeingView }) {
  const t = getMessages().adminOverview.seeing;
  const rows = [
    { key: "news", bar: "bg-accent", label: seeing.news.label, title: seeing.news.title ?? t.newsEmpty, sub: seeing.news.sub },
    { key: "tip", bar: "bg-warning", label: t.tip, title: seeing.tip.text ?? t.tipNotYet, sub: seeing.tip.sub },
    { key: "labs", bar: "bg-purple", label: t.labs, title: seeing.labs.counts, sub: seeing.labs.last },
  ];
  return (
    <section className="flex flex-col rounded-[20px] border border-line bg-surface p-4 lg:p-5">
      <h2 className="m-0 pb-1.5 text-base font-bold">{t.title}</h2>
      {rows.map((row) => (
        <div key={row.key} className="flex gap-3 border-t border-card py-3">
          <span aria-hidden="true" className={cn("w-1 flex-none rounded-full", row.bar)} />
          <span className="flex min-w-0 flex-col gap-[3px]">
            <span className="text-xs font-bold tracking-[0.6px] text-fg-4">{row.label}</span>
            <b className="text-sm leading-[1.4] [overflow-wrap:anywhere]">{row.title}</b>
            {row.sub ? <span className="text-xs text-fg-3">{row.sub}</span> : null}
          </span>
        </div>
      ))}
    </section>
  );
}
