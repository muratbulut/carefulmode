"use client";

import { Check } from "lucide-react";
import { useEffect, useEffectEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Kısa bildirim kutusu ("Kaydedildi" gibi). Birkaç saniye sonra onClose çağrılır.
 * Kutu boşken de ekran okuyucu bölgesi sayfada durur, böylece yeni bildirim okunur.
 * Telefonda alt menünün üstünde, masaüstünde sayfanın altında ortada durur.
 */
export function Toast({
  message,
  onClose,
  duration = 5000,
  className,
}: {
  message: string | null;
  onClose: () => void;
  duration?: number;
  className?: string;
}) {
  const close = useEffectEvent(onClose);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => close(), duration);
    return () => window.clearTimeout(timer);
  }, [message, duration]);

  return (
    <div
      role="status"
      className={cn("pointer-events-none fixed inset-x-3 bottom-[92px] z-[60] flex justify-center lg:bottom-7 print:hidden", className)}
    >
      {message ? (
        <div
          key={message}
          className="pointer-events-auto flex w-full max-w-[680px] items-center gap-2.5 rounded-xl bg-toast-bg px-3.5 py-3 text-sm font-bold text-toast-fg shadow-toast [animation:fade-up_.25s_ease-out_both] lg:w-auto"
        >
          <Check className="size-4 flex-none" strokeWidth={2.6} aria-hidden="true" />
          <span className="flex-1">{message}</span>
        </div>
      ) : null}
    </div>
  );
}
