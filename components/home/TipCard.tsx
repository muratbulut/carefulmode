"use client";

import { ChevronDown, Lightbulb } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { getMessages } from "@/lib/i18n";
import { markTipReason } from "@/lib/tips/actions";
import { cn } from "@/lib/utils";

/**
 * Günün ipucu kartı; "Neden?" gerekçeyi kartın içinde açar. `tipId` verilirse (öğrencinin ana
 * sayfasında bugünün ipucu) ilk açılış sunucuya bildirilir: Meraklı rozeti için o gün "Neden?"e
 * bakıldı sayılır. Yönetimdeki önizleme ve hazır gelen ipucu hiçbir şey kaydetmez.
 */
export function TipCard({ text, reason, date, tipId, className }: { text: string; reason: string; date: string; tipId?: string; className?: string }) {
  const t = getMessages().home.tip;
  const [open, setOpen] = useState(false);
  const reasonId = useId();
  const reported = useRef(false);
  const [, startTransition] = useTransition();

  function toggle() {
    setOpen((o) => !o);
    if (open || !tipId || reported.current) return;
    reported.current = true;
    startTransition(async () => {
      try {
        const result = await markTipReason(tipId);
        // Sınır doldu ya da gün değişti: bir sonraki açılışta yeniden denenir.
        if (!result.ok) reported.current = false;
      } catch {
        reported.current = false;
      }
    });
  }

  return (
    <section className={cn("flex flex-col gap-3 keep-dark rounded-[18px] border border-warning/35 bg-[color-mix(in_oklab,var(--warning)_8%,var(--canvas))] p-4 lg:p-5", className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-warning/16">
          <Lightbulb className="size-5 text-warning" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="flex flex-col">
          <h3 className="m-0 text-base font-bold">{t.title}</h3>
          <span className="text-xs text-fg-3">{date}</span>
        </span>
      </div>
      <p className="m-0 text-base leading-[1.55] [overflow-wrap:anywhere] text-fg">{text}</p>
      <p id={reasonId} hidden={!open} className="m-0 rounded-xl bg-canvas/50 px-3.5 py-3 text-sm leading-[1.55] [overflow-wrap:anywhere] text-fg-2 motion-safe:anim-pop">
        {reason}
      </p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={reasonId}
        onClick={toggle}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 self-start rounded-[10px] border border-warning/40 bg-transparent px-3 text-sm font-bold text-warning-fg"
      >
        {open ? t.close : t.why}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </section>
  );
}
