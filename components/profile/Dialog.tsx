"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Profildeki onay pencereleri (hesap silme, e-posta değiştirme). Tarayıcının kendi <dialog>
 * penceresi: odak içeride kalır, Escape ve perdeye dokunmak kapatır.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
}) {
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-32px)] max-w-[460px] rounded-[22px] border border-line bg-surface p-0 text-fg shadow-card backdrop:bg-scrim",
        "open:[animation:fade-up_.25s_cubic-bezier(.2,.8,.2,1)_both] backdrop:[animation:fade-in_.2s_ease-out_both]",
        className,
      )}
    >
      {open ? <div className="flex flex-col gap-4 p-5 sm:p-7">{children}</div> : null}
    </dialog>
  );
}
