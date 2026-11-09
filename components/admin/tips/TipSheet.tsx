"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * İpucu ekranının penceresi (Ipucu-C3-Bugun): masaüstünde ortada, telefonda alttan açılır
 * (-Mobil). Tarayıcının <dialog> penceresi: odak içeride kalır, Escape ve perde kapatır. İçerik
 * yalnızca açıkken çizilir, böylece her açılışta form baştan başlar.
 */
export function TipSheet({
  open,
  onClose,
  labelledBy,
  title,
  kicker,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  title: string;
  kicker?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = getMessages().admin;
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[88dvh] w-full max-w-full rounded-t-3xl border-0 border-t border-line bg-surface p-0 text-fg backdrop:bg-scrim",
        "open:[animation:slide-up_.28s_cubic-bezier(.2,.8,.2,1)_both] backdrop:[animation:fade-in_.2s_ease-out_both]",
        "lg:m-auto lg:max-h-[90dvh] lg:w-[calc(100%-48px)] lg:rounded-3xl lg:border lg:open:[animation:fade-up_.25s_cubic-bezier(.2,.8,.2,1)_both]",
        className,
      )}
    >
      {open ? (
        <div className="flex flex-col gap-4 px-4 pt-3 pb-6 lg:p-[26px]">
          <span aria-hidden="true" className="h-[5px] w-10 flex-none self-center rounded-full bg-line-strong lg:hidden" />
          <div className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              {kicker ? <span className="text-xs font-bold tracking-[1px] text-fg-4">{kicker}</span> : null}
              <h2 id={labelledBy} className="m-0 font-heading text-[22px] leading-tight font-bold">
                {title}
              </h2>
            </span>
            <button type="button" onClick={onClose} aria-label={t.close} className="flex size-10 flex-none items-center justify-center rounded-xl text-fg-3 hover:text-fg">
              <X className="size-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
