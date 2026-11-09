"use client";

import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { readMuted } from "../sound";
import { smsTone } from "./tones";

/**
 * Ödeme sonrası velinin mesajı (Para Çarşısı, Murat 2 Kasım): mağaza sayfasının üstünde, açılış
 * aramasındaki telefonun aynısı ortaya gelir, kısa bir titreşim ve bildirim sesiyle. Telefonun
 * ekranında velinin mesajı ve iki karar: "Kodu yaz" / "Yazma, anneme anlat". Karardan sonra velinin
 * cevabı gelir (yazmadıysa), "Tamam" telefonu kapatır. "Hareketi azalt" açıksa titreşim yok.
 */
export function MissionSms({
  caller,
  message,
  enter,
  refuse,
  busy,
  reply,
  decided,
  onDecide,
  onClose,
}: {
  caller: string;
  message: ReactNode;
  enter: string;
  refuse: string;
  busy: boolean;
  /** Karardan sonra velinin cevabı (kodu yazmadıysa). */
  reply: string | null;
  decided: boolean;
  onDecide: (enter: boolean) => void;
  onClose: () => void;
}) {
  const t = getMessages().lab.shop;
  const call = getMessages().lab.call;
  const [mounted, setMounted] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal yalnızca tarayıcıda
    setMounted(true);
    if (!readMuted()) smsTone();
  }, []);

  useEffect(() => {
    (decided ? close : first).current?.focus({ preventScroll: true });
  }, [decided, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={format(t.phoneDialog, { caller })} className="fixed inset-0 z-[65] flex items-center justify-center px-4 py-6" data-testid="mission-sms">
      <div aria-hidden="true" className="absolute inset-0 bg-call-dark/85 [animation:fade-in_.3s_ease-out_both]" />
      <div
        className={cn(
          "relative h-[min(560px,calc(100dvh-48px))] w-[min(300px,calc(100vw-32px))] rounded-[46px] bg-call-phone p-2.5 shadow-[0_0_0_2px_var(--call-phone-edge),0_40px_80px_rgb(0_0_0/0.7)]",
          "[animation:fade-up_.5s_cubic-bezier(.2,.9,.3,1.15)_both,call-buzz_.9s_.5s_1]",
        )}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-[37px] bg-scene-paper text-scene-ink">
          <span aria-hidden="true" className="absolute top-2 left-1/2 z-[5] h-7 w-24 -translate-x-1/2 rounded-full bg-call-ink" />
          <span aria-hidden="true" className="flex h-11 flex-none items-center px-6 text-[13px] font-medium">
            {call.time}
          </span>
          <div className="flex flex-none items-center gap-2 border-b border-scene-line px-3 pb-2.5">
            <ChevronLeft aria-hidden="true" className="size-5 text-scene-blue" strokeWidth={2.4} />
            <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-call-avatar-bg text-sm font-bold text-call-ink">
              {caller.slice(0, 1)}
            </span>
            <span className="text-[15px] font-bold">{caller}</span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3" aria-live="polite">
            <span className="self-center text-[11px] font-medium text-scene-ink-muted">{t.now}</span>
            <p className="max-w-[92%] rounded-[18px_18px_18px_4px] bg-scene-bubble px-3 py-2 text-[14px] leading-snug" data-testid="shop-sms">
              {message}
            </p>
            {reply ? <p className="max-w-[92%] rounded-[18px_18px_18px_4px] bg-scene-bubble px-3 py-2 text-[14px] leading-snug [animation:fade-up_.35s_ease-out_both]">{reply}</p> : null}
          </div>

          <div className="flex flex-none flex-col gap-2 px-3 pt-2 pb-5">
            {decided ? (
              <button ref={close} type="button" onClick={onClose} className="min-h-12 cursor-pointer rounded-2xl bg-scene-blue font-bold text-scene-white">
                {t.phoneOk}
              </button>
            ) : (
              <>
                <button
                  ref={first}
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(true)}
                  className="min-h-12 cursor-pointer rounded-2xl bg-scene-ink font-bold text-scene-white disabled:opacity-60"
                >
                  {enter}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(false)}
                  className="min-h-12 cursor-pointer rounded-2xl border border-scene-line-strong bg-scene-white font-bold text-scene-ink hover:border-scene-ink-2 disabled:opacity-60"
                >
                  {refuse}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
