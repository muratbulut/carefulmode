"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { periods, type Kpi, type KpiKey, type Period } from "@/lib/admin/overview-model";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const dots: Record<KpiKey, string> = {
  newStudents: "bg-purple",
  activeStudents: "bg-success",
  finishedLabs: "bg-accent",
  noticedFirst: "bg-warning",
};

/** Sayılar (Ozet-Son): dönem seçimi (bu hafta / bu ay / tüm zamanlar) ve dört kutu. Metinler sunucuda hazır. */
export function Numbers({ kpis }: { kpis: Record<Period, Kpi[]> }) {
  const t = getMessages().adminOverview;
  const [period, setPeriod] = useState<Period>("week");
  const id = useId();

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = periods[(periods.indexOf(period) + step + periods.length) % periods.length];
    setPeriod(next);
    document.getElementById(`${id}-${next}`)?.focus();
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 id={`${id}-title`} className="m-0 text-[17px] font-bold">
          {t.numbers}
        </h2>
        <div role="tablist" aria-label={t.periodLabel} onKeyDown={onKey} className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
          {periods.map((key) => {
            const on = key === period;
            return (
              <button
                key={key}
                id={`${id}-${key}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`${id}-panel`}
                tabIndex={on ? 0 : -1}
                onClick={() => setPeriod(key)}
                className={cn(
                  "h-[34px] cursor-pointer rounded-[9px] border-none px-3 text-[13px] font-bold whitespace-nowrap max-lg:h-10",
                  on ? "bg-accent text-on-accent" : "bg-transparent text-fg-2 hover:text-fg",
                )}
              >
                {t.periods[key]}
              </button>
            );
          })}
        </div>
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${period}`}
        data-testid="overview-kpis"
        className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3.5"
      >
        {kpis[period].map((kpi) => (
          <div key={kpi.key} className="flex min-w-0 flex-col gap-1.5 rounded-[20px] border border-line bg-surface p-3.5 lg:p-[18px]">
            <span className="flex items-center gap-2 text-[13px] font-bold text-fg-3">
              <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", dots[kpi.key])} />
              {t.kpis[kpi.key]}
            </span>
            <b className="font-heading text-[26px] leading-none lg:text-[32px]">{kpi.value}</b>
            <span className="text-xs text-fg-4">{kpi.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
