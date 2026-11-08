"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Öğretmen ekranlarının penceresi (yeni sınıf, ödev ver): masaüstünde ortada, telefonda alttan
 * açılır (Siniflarim-Son-Mobil, Sinif-Detay-Son-Mobil). Tarayıcının <dialog> penceresi: odak
 * içeride kalır, Escape ve perdeye dokunmak kapatır. Açılınca odak `data-autofocus` olan kutuya gider.
 */
export function Sheet({
  open,
  onClose,
  labelledBy,
  closeLabel,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  closeLabel: string;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // Tarayıcı odağı ilk düğmeye (Kapat) verir; içerik isterse odak ilk kutusuna gider.
      // React'in autoFocus'u pencere açılmadan çalıştığı için işe yaramaz.
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-full overflow-y-auto rounded-t-3xl border-0 border-t border-line bg-surface p-0 text-fg backdrop:bg-scrim",
        "open:[animation:slide-up_.28s_cubic-bezier(.2,.8,.2,1)_both] backdrop:[animation:fade-in_.2s_ease-out_both]",
        "lg:m-auto lg:max-h-[calc(100dvh-48px)] lg:w-[calc(100%-48px)] lg:max-w-[460px] lg:rounded-3xl lg:border lg:open:[animation:fade-up_.25s_cubic-bezier(.2,.8,.2,1)_both]",
        className,
      )}
    >
      {open ? (
        <div className="flex flex-col gap-4 px-5 pt-3 pb-6 lg:gap-[18px] lg:p-7">
          <span aria-hidden="true" className="h-[5px] w-10 flex-none self-center rounded-full bg-line-strong lg:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="flex size-10 flex-none cursor-pointer items-center justify-center rounded-xl text-fg-3 hover:bg-card hover:text-fg"
            >
              <X className="size-5" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
