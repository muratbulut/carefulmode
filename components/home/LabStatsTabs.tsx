"use client";

import Link from "next/link";
import { Check, Flame, Sparkles, TrendingUp } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { NewBadge } from "@/components/catalog/LabCard";
import { getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export const statTabs = ["popular", "newest", "hardest"] as const;
export type StatTab = (typeof statTabs)[number];

/** Bir lab satırı. Yalnızca toplam sayılar; öğrenci adı yok. */
export type StatRow = {
  slug: string;
  href: string;
  name: string;
  topic: string;
  /** Mahallenin rengi (tema sınıfı): nokta ve çubuk. */
  dotClass: string;
  barClass: string;
  bar: number;
  value: string;
  mine: boolean;
  isNew: boolean;
};

const tabIcons = { popular: TrendingUp, newest: Sparkles, hardest: Flame } as const;

/** Ana sayfadaki lab istatistikleri: en çok çözülen, en yeni, en zorlu (sekmeli). */
export function LabStatsTabs({ rows, className }: { rows: Record<StatTab, StatRow[]>; className?: string }) {
  const t = getMessages().home.labStats;
  const [tab, setTab] = useState<StatTab>("popular");
  const id = useId();

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = statTabs[(statTabs.indexOf(tab) + step + statTabs.length) % statTabs.length];
    setTab(next);
    document.getElementById(`${id}-${next}`)?.focus();
  }

  const list = rows[tab];
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      <div role="tablist" aria-label={t.label} onKeyDown={onKey} className="flex gap-1 rounded-xl border border-card bg-surface-raised p-1">
        {statTabs.map((key) => {
          const Icon = tabIcons[key];
          const on = key === tab;
          return (
            <button
              key={key}
              id={`${id}-${key}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${id}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex h-[38px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border px-1 text-[13px] font-bold whitespace-nowrap lg:h-10 lg:flex-none lg:px-3 lg:text-sm",
                on ? "border-accent bg-card text-fg" : "border-transparent bg-transparent text-fg-3 hover:text-fg",
              )}
            >
              <Icon className="hidden size-4 lg:block" strokeWidth={2} aria-hidden="true" />
              {t.tabs[key]}
            </button>
          );
        })}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} key={tab} className="flex flex-col gap-2 motion-safe:anim-rise">
        <span className="text-[13px] text-fg-3">{t.leads[tab]}</span>
        {list.length === 0 ? (
          <p className="m-0 rounded-[14px] border border-dashed border-line px-3.5 py-4 text-center text-sm text-fg-3">{t.empty}</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {list.map((row, i) => (
              <li key={row.slug}>
                <Link
                  href={row.href}
                  className="flex items-center gap-3 rounded-[14px] border border-card bg-surface-raised px-3 py-2.5 text-fg no-underline transition-colors hover:border-line-strong"
                >
                  <span className={cn("w-[26px] flex-none text-center font-heading text-lg font-bold", i === 0 ? "text-warning-fg" : "text-fg-4")}>{i + 1}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[15px] font-bold">{row.name}</span>
                      {row.isNew && tab === "newest" ? <NewBadge className="flex-none" /> : null}
                      {row.mine ? (
                        <span className="inline-flex flex-none items-center gap-1 text-[11px] font-bold text-success-fg">
                          <Check className="size-3" strokeWidth={2.6} aria-hidden="true" />
                          {t.mine}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", row.dotClass)} />
                      <span className="flex-none text-xs text-fg-3">{row.topic}</span>
                      <span aria-hidden="true" className="h-1 flex-1 overflow-hidden rounded-full bg-card">
                        <span className={cn("anim-bar-in block h-full rounded-full", row.barClass)} style={{ width: `${Math.round(row.bar * 100)}%` }} />
                      </span>
                    </span>
                  </span>
                  <span className="min-w-16 flex-none text-right text-sm font-bold text-fg-2">{row.value}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
      <Link href={routes.labs} className="-my-2.5 self-start py-2.5 text-sm font-bold no-underline hover:underline">
        {t.all}
      </Link>
    </div>
  );
}
