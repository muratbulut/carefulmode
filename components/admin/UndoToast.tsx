"use client";

import { AlertCircle, Check, Undo2 } from "lucide-react";
import { useEffect, useEffectEvent } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ToastData = {
  /** Aynı metin art arda gelse de süre yeniden başlasın diye. */
  id: number;
  message: string;
  /** Varsa "Geri al" düğmesi çıkar (5 saniye). */
  undo?: () => void;
  tone?: "ok" | "error";
};

/** Yeni bildirim: `setToast(nextToast({ message }))`. Numara bir öncekinden bir fazladır. */
export function nextToast(data: Omit<ToastData, "id">) {
  return (prev: ToastData | null): ToastData => ({ ...data, id: (prev?.id ?? 0) + 1 });
}

/**
 * Yönetimdeki bildirim kutusu (Lablar-Son): kısa mesaj ve isteğe bağlı "Geri al". 5 saniye
 * sonra kapanır. Ekran okuyucu bölgesi kutu boşken de sayfada durur.
 */
export function UndoToast({ toast, onClose, duration = 5000 }: { toast: ToastData | null; onClose: () => void; duration?: number }) {
  const t = getMessages().admin;
  const close = useEffectEvent(onClose);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => close(), duration);
    return () => window.clearTimeout(timer);
  }, [toast, duration]);

  const Icon = toast?.tone === "error" ? AlertCircle : Check;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-3 bottom-5 z-[60] flex justify-center lg:bottom-7 print:hidden">
      {toast ? (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-[640px] items-center gap-3 rounded-[14px] py-3 pr-3.5 pl-4 text-sm font-bold shadow-toast [animation:fade-up_.25s_ease-out_both] lg:w-auto",
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
              className="inline-flex h-8 flex-none items-center gap-1.5 rounded-lg bg-toast-fg px-2.5 text-[13px] font-bold text-toast-bg"
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
