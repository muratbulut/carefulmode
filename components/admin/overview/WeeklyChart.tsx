"use client";

import { useState } from "react";
import type { ChartMetric, ChartSeries } from "@/lib/admin/overview-model";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const colors: Record<ChartMetric, { text: string; bar: string; soft: string; border: string }> = {
  finished: { text: "text-accent-fg", bar: "bg-accent", soft: "bg-accent/35", border: "border-accent" },
  signups: { text: "text-purple-fg", bar: "bg-purple", soft: "bg-purple/35", border: "border-purple" },
  active: { text: "text-success-fg", bar: "bg-success", soft: "bg-success/35", border: "border-success" },
};

/**
 * Son 6 haftanın grafiği (Ozet-Son): biten lab, yeni kayıt ya da aktif öğrenci. Çubuklar düz
 * kutudur (kütüphane yok); son çubuk bu hafta. Ekran okuyucu için sayılar etikette yazılıdır.
 */
export function WeeklyChart({ series }: { series: ChartSeries[] }) {
  const t = getMessages().adminOverview.chart;
  const [metric, setMetric] = useState<ChartMetric>("finished");
  const current = series.find((s) => s.metric === metric) ?? series[0];
  if (!current) return null;
  const max = Math.max(1, ...current.bars.map((b) => b.value));
  const color = colors[current.metric];
  const label = `${format(t.label, { metric: t.metrics[current.metric] })}. ${current.bars
    .map((b) => format(t.bar, { week: b.label, n: b.display }))
    .join(", ")}`;

  return (
    <section className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-4 lg:p-[22px]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <span className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-[0.8px] text-fg-4">
            {format(t.heading, { metric: t.metrics[current.metric] }).toLocaleUpperCase("tr")}
          </span>
          <b className={cn("font-heading text-[28px] leading-none", color.text)}>{current.total}</b>
          <span className="text-xs text-fg-3">{current.change}</span>
        </span>
        <div role="radiogroup" aria-label={t.metricLabel} className="flex flex-wrap gap-1.5">
          {series.map((s) => {
            const on = s.metric === metric;
            return (
              <button
                key={s.metric}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMetric(s.metric)}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border bg-transparent px-2.5 text-xs font-bold max-lg:h-10",
                  on ? cn(colors[s.metric].border, "text-fg") : "border-line text-fg-3 hover:text-fg",
                )}
              >
                <span aria-hidden="true" className={cn("size-2 rounded-full", colors[s.metric].bar)} />
                {t.metrics[s.metric]}
              </button>
            );
          })}
        </div>
      </div>
      <div role="img" aria-label={label} className="flex h-[150px] items-end gap-1.5 pt-2.5 lg:h-[190px] lg:gap-3">
        {current.bars.map((bar) => (
          <div key={bar.label} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
            {/* Sayı çubuğun hemen üstünde; çubuğun boyu sayıya yer bırakarak hesaplanır. */}
            <span className="flex w-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className={cn("text-xs font-bold", bar.current ? "text-fg" : "text-fg-3")}>{bar.display}</span>
              <span
                className={cn(
                  "block w-full max-w-[54px] rounded-t-lg rounded-b-[3px] transition-[height] duration-300",
                  bar.current ? color.bar : color.soft,
                )}
                style={{ height: `max(4px, calc(${Math.round((bar.value / max) * 100)}% - 24px))` }}
              />
            </span>
            <span className={cn("text-[11px] whitespace-nowrap", bar.current ? "text-fg" : "text-fg-3")}>{bar.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
