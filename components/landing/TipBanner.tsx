"use client";

import { Lightbulb } from "lucide-react";
import { useId, useState } from "react";
import { getMessages } from "@/lib/i18n";

/** Günün ipucu şeridi. "Neden?" ipucunun gerekçesini hemen altında açar. Ziyaretçi için hiçbir şey kaydedilmez. */
export function TipBanner({ text, reason }: { text: string; reason: string }) {
  const t = getMessages().landing.tip;
  const [open, setOpen] = useState(false);
  const reasonId = useId();

  return (
    <section aria-label={t.label} className="relative mx-auto max-w-[1200px] px-4 pb-4 lg:px-6">
      <div className="flex flex-wrap items-center gap-4 keep-dark rounded-[18px] border border-warning/32 bg-[color-mix(in_oklab,var(--warning)_7%,var(--canvas))] px-4 py-4 lg:px-5">
        <div className="flex size-11 flex-none items-center justify-center rounded-xl bg-warning/16">
          <Lightbulb className="size-[22px] text-warning" strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5 lg:flex-[1_1_520px]">
          <div className="text-xs font-bold tracking-[0.8px] text-warning-fg">{t.heading}</div>
          <div className="text-base leading-normal [overflow-wrap:anywhere] text-fg">{text}</div>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={reasonId}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-11 flex-none cursor-pointer items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-fg transition-colors hover:border-accent"
        >
          {open ? t.close : t.why}
        </button>
        <p id={reasonId} hidden={!open} className="m-0 basis-full border-t border-warning/20 pt-3 text-[15px] leading-normal [overflow-wrap:anywhere] text-fg-2">
          {reason}
        </p>
      </div>
    </section>
  );
}

/** İpucu gelene kadar şeridin yerini tutar (sayfa kaymasın). */
export function TipBannerSkeleton() {
  return (
    <div aria-hidden="true" className="relative mx-auto max-w-[1200px] px-4 pb-4 lg:px-6">
      <div className="flex items-center gap-4 keep-dark rounded-[18px] border border-warning/32 bg-[color-mix(in_oklab,var(--warning)_7%,var(--canvas))] px-4 py-4 lg:px-5">
        <span className="size-11 flex-none rounded-xl bg-warning/16" />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="skeleton block h-3 w-24 rounded-lg" />
          <span className="skeleton block h-4 w-[70%] rounded-lg" />
        </span>
      </div>
    </div>
  );
}
