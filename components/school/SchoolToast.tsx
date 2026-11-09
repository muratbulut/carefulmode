"use client";

import { AlertCircle, Check, Undo2 } from "lucide-react";
import { useEffect, useEffectEvent } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type SchoolToastData = {
  /** Aynı metin art arda gelse de süre yeniden başlasın diye. */
  id: number;
  message: string;
  /** Varsa "Geri al" düğmesi çıkar (5 saniye). */
  undo?: () => void;
  tone?: "ok" | "error";
};

/** Yeni bildirim: `setToast(nextToast({ message }))`. */
export function nextToast(data: Omit<SchoolToastData, "id">) {
  return (prev: SchoolToastData | null): SchoolToastData => ({ ...data, id: (prev?.id ?? 0) + 1 });
}

/**
 * Okulum'un bildirim kutusu: yönetimdeki kutuyla aynı görünüm (components/admin/UndoToast.tsx),
 * telefonda alt menünün üstünde durur. 5 saniye sonra kapanır; "Geri al" varsa o süre boyunca
 * görünür. Ekran okuyucu bölgesi kutu boşken de sayfada durur.
 */
export function SchoolToast({ toast, onClose, duration = 5000 }: { toast: SchoolToastData | null; onClose: () => void; duration?: number }) {
  const t = getMessages().school;
  const close = useEffectEvent(onClose);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => close(), duration);
    return () => window.clearTimeout(timer);
  }, [toast, duration]);

  const Icon = toast?.tone === "error" ? AlertCircle : Check;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-3 bottom-[92px] z-[60] flex justify-center lg:bottom-7 print:hidden">
      {toast ? (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-[640px] items-center gap-2.5 rounded-xl py-3 pr-3.5 pl-4 text-sm font-bold shadow-toast [animation:fade-up_.25s_ease-out_both] lg:w-auto",
            toast.tone === "error" ? "bg-danger text-on-danger" : "bg-toast-bg text-toast-fg",
          )}
        >
          <Icon className="size-4 flex-none" strokeWidth={2.6} aria-hidden="true" />
          <span className="flex-1">{toast.message}</span>
          {toast.undo ? (
            <button
              type="button"
              onClick={() => {
                toast.undo?.();
                onClose();
              }}
              className="inline-flex h-8 flex-none cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-toast-fg px-2.5 font-[inherit] text-[13px] font-bold text-toast-bg"
            >
              <Undo2 className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
              {t.undo}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
