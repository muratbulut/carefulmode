"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kullanıcılar sayfasının çekmecesi (öğretmen ve öğrenci): masaüstünde sağdan 460 px, telefonda
 * alttan açılan pencere. Tarayıcının <dialog> penceresi: odak içeride kalır, Escape, perde ve
 * kapat düğmesi kapatır. "Hareketi azalt" açıksa kapanırken beklemez.
 */
export function Drawer({
  open,
  label,
  closeLabel,
  onClose,
  children,
  overlay,
}: {
  open: boolean;
  label: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  /** Pencere açıkken bildirim kutusu pencerenin içinde çizilir (yoksa perdenin altında kalır). */
  overlay?: ReactNode;
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

  const closeButton = (className?: string) => (
    <button
      type="button"
      onClick={requestClose}
      aria-label={closeLabel}
      className={cn("flex size-10 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-fg-2 hover:text-fg", className)}
    >
      <X className="size-[18px]" strokeWidth={2} aria-hidden="true" />
    </button>
  );

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
        "m-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-3xl border-0 border-t border-line bg-canvas p-0 text-fg backdrop:bg-scrim",
        "lg:mt-0 lg:ml-auto lg:h-dvh lg:max-h-dvh lg:w-[460px] lg:rounded-none lg:border-t-0 lg:border-l",
        closing
          ? "[animation:slide-up_.2s_ease-in_reverse_both] backdrop:[animation:fade-in_.2s_ease-in_reverse_both] lg:[animation:slide-in-page_.2s_ease-in_reverse_both]"
          : "open:[animation:slide-up_.28s_cubic-bezier(.2,.8,.2,1)_both] backdrop:[animation:fade-in_.2s_ease-out_both] lg:open:[animation:slide-in-page_.3s_cubic-bezier(.2,.8,.2,1)_both]",
      )}
    >
      {open ? (
        <div className="flex flex-col gap-[18px] px-4 pt-3 pb-6 lg:px-6 lg:pt-[22px] lg:pb-8">
          {/* Telefonda satır kapat düğmesi kadar yüksek: düğme pencerenin üst kenarından taşıp kesilmez. */}
          <div className="relative flex items-center justify-center max-lg:min-h-10 lg:justify-end">
            <span aria-hidden="true" className="h-1 w-10 rounded-full bg-line lg:hidden" />
            {closeButton("max-lg:absolute max-lg:top-0 max-lg:right-0")}
          </div>
          {children}
        </div>
      ) : null}
      {overlay}
    </dialog>
  );
}
