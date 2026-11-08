"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Telefonda alttan açılan pencere (mahalle sayfasında lab önizlemesi, lablarda süzgeç). Tarayıcının
 * <dialog> penceresi: odak içeride kalır, Escape, perde ve kapat düğmesi kapatır.
 */
export function BottomSheet({
  open,
  onClose,
  label,
  closeLabel,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setClosing(false);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  // Tarayıcının geri tuşuyla başka sayfaya geçilince pencere açık kalmasın.
  useEffect(() => {
    const close = () => ref.current?.close();
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  function requestClose() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onClose();
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[88dvh] w-full max-w-full rounded-t-3xl border-0 border-t border-line bg-surface-deep p-0 text-fg backdrop:bg-scrim",
        closing
          ? "[animation:slide-up_.2s_ease-in_reverse_both] backdrop:[animation:fade-in_.2s_ease-in_reverse_both]"
          : "open:[animation:slide-up_.28s_cubic-bezier(.2,.8,.2,1)_both] backdrop:[animation:fade-in_.2s_ease-out_both]",
        className,
      )}
    >
      {open ? (
        <div className="flex flex-col gap-3.5 px-4 pt-3 pb-[22px]">
          <span aria-hidden="true" className="h-[5px] w-10 self-center rounded-full bg-line-strong" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{title}</div>
            <button
              type="button"
              onClick={requestClose}
              aria-label={closeLabel}
              className="flex size-10 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-fg"
            >
              <X className="size-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          {children}
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
