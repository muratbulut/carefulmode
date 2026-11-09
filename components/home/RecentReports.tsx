import Link from "next/link";
import { ChevronRight, FileText, Lock, Play } from "lucide-react";
import { EmptyState } from "@/components/status/EmptyState";
import { format, getMessages } from "@/lib/i18n";
import type { ReportStatus } from "@/lib/lab/data";
import { cn } from "@/lib/utils";

export type ReportItem = { href: string; name: string; district: string; date: string; status: ReportStatus; score: number | null };

const statusTone: Record<ReportStatus, { chip: string; text: string; dot: string }> = {
  safe: { chip: "bg-success/10", text: "text-success-fg", dot: "bg-success" },
  risky: { chip: "bg-warning/10", text: "text-warning-fg", dot: "bg-warning" },
  hacked: { chip: "bg-danger/10", text: "text-danger-fg", dot: "bg-danger" },
};

/** "Son raporların": yalnızca öğrencinin kendisi görür. */
export function RecentReports({ reports, startHref }: { reports: ReportItem[]; startHref: string }) {
  const t = getMessages().home;
  const r = t.reports;
  return (
    <section aria-labelledby="home-reports" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5 lg:gap-3.5">
        <h2 id="home-reports" className="m-0 font-heading text-[21px] font-bold lg:text-[26px]">
          {t.sections.reports}
        </h2>
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 text-xs font-bold text-accent-light">
          <Lock className="size-3" strokeWidth={2.2} aria-hidden="true" />
          {r.private}
        </span>
      </div>
      {reports.length === 0 ? (
        <EmptyState
          Icon={FileText}
          title={r.empty}
          className="py-6"
          action={
            <Link
              href={startHref}
              className="mt-1 inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
            >
              <Play className="size-3.5 fill-current" strokeWidth={2.4} aria-hidden="true" />
              {r.start}
            </Link>
          }
        >
          {r.emptyText}
        </EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:gap-2.5">
          {reports.map((report) => {
            const tone = statusTone[report.status];
            const score = report.score ?? 0;
            return (
              <li key={report.href}>
                <Link
                  href={report.href}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-fg no-underline transition-colors hover:border-line-strong lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto] lg:gap-5 lg:px-5 lg:py-4"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1 lg:gap-0.5">
                    <span className="truncate text-[15px] font-bold lg:text-base">{report.name}</span>
                    <span className="flex items-center gap-2 text-xs text-fg-3 lg:text-[13px]">
                      <span className={cn("inline-flex flex-none items-center gap-1.5 font-bold lg:hidden", tone.text)}>
                        <span aria-hidden="true" className={cn("size-[7px] rounded-full", tone.dot)} />
                        {r.status[report.status]}
                      </span>
                      <span className="truncate">{format(r.meta, { district: report.district, date: report.date })}</span>
                    </span>
                  </span>
                  <span className={cn("hidden h-7 items-center gap-1.5 justify-self-start rounded-full px-2.5 text-[13px] font-bold lg:inline-flex", tone.chip, tone.text)}>
                    <span aria-hidden="true" className={cn("size-2 rounded-full", tone.dot)} />
                    {r.status[report.status]}
                  </span>
                  <span aria-hidden="true" className="hidden h-1.5 overflow-hidden rounded-full bg-card lg:block">
                    <span className={cn("block h-full rounded-full", tone.dot)} style={{ width: `${score}%` }} />
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    <span className="font-heading text-lg font-bold">
                      {score}
                      <span className="text-[13px] text-fg-4">{t.reports.outOf}</span>
                    </span>
                    <ChevronRight className="size-4 text-fg-4 lg:hidden" strokeWidth={2} aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
