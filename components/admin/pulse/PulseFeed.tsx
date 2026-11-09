"use client";

import { useState } from "react";
import type { PulseFeedItem } from "@/lib/admin/pulse";
import type { FeedKind } from "@/lib/admin/pulse-model";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const tones: Record<FeedKind, { dot: string; text: string }> = {
  safe: { dot: "bg-success", text: "text-success-fg" },
  reported: { dot: "bg-success", text: "text-success-fg" },
  done: { dot: "bg-accent", text: "text-accent-fg" },
  training: { dot: "bg-accent", text: "text-accent-fg" },
  hacked: { dot: "bg-danger", text: "text-danger-fg" },
  clicked: { dot: "bg-orange", text: "text-orange-fg" },
  signup: { dot: "bg-purple", text: "text-purple-fg" },
  badge: { dot: "bg-purple", text: "text-purple-fg" },
  application: { dot: "bg-warning", text: "text-warning-fg" },
};

/**
 * "Şu an ne oluyor?" (CanliNabiz-Son): en yeni hareket en üstte. Yenilemede gelen yeni satır
 * hafifçe belirir (hareketi azalt açıksa belirmez). İsim yok: kim değil, ne olduğu.
 */
export function PulseFeed({ items }: { items: PulseFeedItem[] }) {
  const t = getMessages().adminPulse;
  // İlk çizimde hiçbir satır belirmez; yenilemede önceki listede olmayan satırlar belirir.
  const [shown, setShown] = useState<{ items: PulseFeedItem[]; known: Set<string> | null }>({ items, known: null });
  let known = shown.known;
  if (shown.items !== items) {
    known = new Set(shown.items.map((item) => item.id));
    setShown({ items, known });
  }

  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby="pulse-feed-title">
      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 id="pulse-feed-title" className="m-0 text-base font-bold">
          {t.feed.title}
        </h2>
        <span className="text-xs text-fg-4">{t.feed.note}</span>
      </span>
      {items.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-line p-6 text-center text-[13px] text-fg-3">{t.feed.empty}</p>
      ) : (
        <ol
          aria-label={t.feed.label}
          data-testid="pulse-feed"
          className="m-0 flex max-h-[470px] list-none flex-col gap-2 overflow-y-auto rounded-2xl p-0 lg:max-h-[640px]"
        >
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-[14px] border border-card bg-surface px-3.5 py-3",
                known && !known.has(item.id) && "motion-safe:[animation:fade-up_.4s_ease-out_both]",
              )}
            >
              <span aria-hidden="true" className={cn("size-[9px] flex-none rounded-full", tones[item.kind].dot)} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm leading-[1.45] [overflow-wrap:anywhere]">{item.text}</span>
                <span className="flex flex-wrap gap-x-2 text-xs text-fg-4">
                  <span className={cn("font-bold", tones[item.kind].text)}>{t.kinds[item.kind]}</span>
                  {item.where ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{item.where}</span>
                    </>
                  ) : null}
                </span>
              </span>
              <time dateTime={item.at} className="flex-none text-xs text-fg-4">
                {item.ago}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
