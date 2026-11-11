"use client";

import { Check, Eye, KeyRound, Lightbulb, UserRound } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TIP_COUNT = 3;
const TIP_MS = 9000;

// Her sayfa açılışında bir kez seçilen rastgele başlangıç (sunucuda 0).
let randomStart: number | null = null;
function getRandomStart() {
  randomStart ??= Math.floor(Math.random() * TIP_COUNT);
  return randomStart;
}
const noop = () => () => {};
// Kaydedilmiş şifre kutusundaki noktalar (süs).
const MASKED = "•".repeat(8);

/** Fare imleci (animasyonlarda). */
function Cursor({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("absolute size-[22px]", className)} aria-hidden="true">
      <path d="M4 2l15 10-6.5 1.4L9.6 20z" className="fill-cursor-fill stroke-cursor-stroke" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

/** Küçük tarayıcı penceresi çerçevesi. */
function MiniWindow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative h-[150px] w-[280px] max-w-full overflow-hidden rounded-[14px] border border-line bg-canvas", className)}>
      <div className="flex gap-[5px] border-b border-card px-2.5 py-2">
        <span className="size-2 rounded-full bg-line" />
        <span className="size-2 rounded-full bg-line" />
        <span className="size-2 rounded-full bg-line" />
      </div>
      {children}
    </div>
  );
}

function SignOutScene() {
  const t = getMessages().auth.signIn.tips.signOut;
  return (
    <MiniWindow>
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <span className="flex size-[26px] items-center justify-center rounded-full bg-card">
            <UserRound className="size-3.5 text-accent-light" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="h-2 w-[70px] rounded-full bg-card" />
        </div>
        <span className="relative rounded-lg bg-danger px-2.5 py-1.5 text-xs font-bold text-on-danger">
          {t.button}
          <span className="absolute top-3.5 left-[34px] size-[22px] animate-[tip-cursor-a_5s_ease-in-out_both]">
            <Cursor className="inset-0" />
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-1.5 px-3 pb-3">
        <span className="h-1.5 w-4/5 rounded-full bg-card" />
        <span className="h-1.5 w-[62%] rounded-full bg-card" />
        <span className="h-1.5 w-[70%] rounded-full bg-card" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-canvas/95 animate-[tip-done-a_5s_ease-out_both]">
        <span className="flex size-10 items-center justify-center rounded-full bg-success/16">
          <Check className="size-[18px] text-success" strokeWidth={2.8} aria-hidden="true" />
        </span>
        <span className="text-sm font-bold text-success-subtle-fg">{t.done}</span>
      </div>
    </MiniWindow>
  );
}

function SavePasswordScene() {
  const t = getMessages().auth.signIn.tips.savePassword;
  return (
    <MiniWindow>
      <div className="flex flex-col gap-2 p-3">
        <span className="h-[30px] rounded-lg border border-line" />
        <span className="flex h-[30px] items-center rounded-lg border border-line px-2.5 text-[10px] tracking-[2px] text-fg-4">
          {MASKED}
        </span>
      </div>
      <div className="absolute top-[30px] right-2.5 flex w-[196px] flex-col gap-2 rounded-[10px] border border-line-strong bg-card p-2.5 shadow-floating animate-[tip-prompt-b_5s_ease-out_both] motion-reduce:hidden">
        <div className="flex items-center gap-1.5 text-xs font-bold text-fg">
          <KeyRound className="size-3.5 text-warning" strokeWidth={2.2} aria-hidden="true" />
          {t.prompt}
        </div>
        <div className="flex justify-end gap-1.5">
          <span className="rounded-md bg-accent px-2 py-[5px] text-[11px] font-bold text-on-accent">{t.save}</span>
          <span className="relative rounded-md border border-line-strong px-2 py-[5px] text-[11px] font-bold text-fg">
            {t.never}
            <span className="absolute top-3 left-10 size-[22px] animate-[tip-cursor-b_5s_ease-in-out_both]">
              <Cursor className="inset-0" />
            </span>
          </span>
        </div>
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-[10px] border border-success/45 bg-success/10 px-2.5 py-2 text-xs font-bold text-success-subtle-fg animate-[tip-done-b_5s_ease-out_both]">
        <Check className="size-[18px] flex-none text-success" strokeWidth={2.8} aria-hidden="true" />
        {t.done}
      </div>
    </MiniWindow>
  );
}

function ShoulderScene() {
  const t = getMessages().auth.signIn.tips.shoulder;
  return (
    <div className="relative flex h-[150px] w-[280px] max-w-full flex-col justify-center gap-2 overflow-hidden rounded-[14px] border border-line bg-canvas p-4">
      <span className="text-xs font-bold text-fg-3">{t.field}</span>
      <div className="flex h-10 w-[170px] items-center gap-1.5 rounded-[10px] border-2 border-accent px-3">
        {Array.from({ length: 8 }, (_, i) => (
          <span
            key={i}
            className="size-[9px] rounded-full bg-fg animate-[tip-dot-c_0.2s_ease-out_both]"
            style={{ animationDelay: `${0.3 + i * 0.22}s` }}
          />
        ))}
        <span className="h-[18px] w-0.5 bg-accent anim-caret" />
      </div>
      <div className="absolute top-[26px] right-3.5 flex flex-col items-center gap-1.5 animate-[tip-peek-c_5s_ease-out_both]">
        <span className="relative flex size-[58px] items-center justify-center rounded-full border border-line-strong bg-card">
          <Eye className="size-[30px] text-warning" strokeWidth={2} aria-hidden="true" />
          <span className="absolute -inset-1.5 rounded-full border-2 border-danger animate-[tip-ring-c_5s_ease-out_both]" />
        </span>
        <span className="rounded-full bg-danger/14 px-2 py-1 text-[11px] font-bold text-danger-fg animate-[tip-ring-c_5s_ease-out_both]">
          {t.watching}
        </span>
      </div>
    </div>
  );
}

/**
 * Giriş ekranının dönen ipucu paneli (Tur 1, ekran 6, 1. revize): üç ipucundan biri rastgele
 * gelir, 9 saniyede bir sıradakine geçer, noktalarla seçilir. Hiçbirinde ad ya da isim yok.
 */
export function SignInTips() {
  const t = getMessages().auth;
  const tips = t.signIn.tips;
  const start = useSyncExternalStore(noop, getRandomStart, () => 0);
  const [step, setStep] = useState(0);
  const index = (start + step) % TIP_COUNT;

  useEffect(() => {
    const id = setTimeout(() => setStep((s) => s + 1), TIP_MS);
    return () => clearTimeout(id);
  }, [step]);

  const texts = [tips.signOut.text, tips.savePassword.text, tips.shoulder.text];
  const scenes = [<SignOutScene key="a" />, <SavePasswordScene key="b" />, <ShoulderScene key="c" />];

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface-translucent p-[18px] backdrop-blur-sm lg:justify-between lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.8px] text-warning">
          <Lightbulb className="size-4" strokeWidth={2} aria-hidden="true" />
          {t.tipLabel}
        </div>
        <span className="font-mono text-xs text-fg-4">{format(tips.counter, { n: index + 1, total: TIP_COUNT })}</span>
      </div>
      <div aria-live="polite">
        <div key={`${index}-${step}`} className="flex flex-col gap-3.5 anim-slide-in">
          <p className="min-h-[72px] text-base leading-normal text-fg">{texts[index]}</p>
          <div className="flex justify-center" aria-hidden="true">
            {scenes[index]}
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-0.5">
        {texts.map((_, k) => (
          <button
            key={k}
            type="button"
            aria-label={format(tips.label, { n: k + 1 })}
            aria-pressed={k === index}
            onClick={() => setStep((s) => s + ((k - index + TIP_COUNT) % TIP_COUNT || TIP_COUNT))}
            className="-my-1.5 flex size-10 cursor-pointer items-center justify-center"
          >
            <span className={cn("h-2 rounded-full transition-[width,background-color] duration-300", k === index ? "w-[22px] bg-accent" : "w-2 bg-line-strong")} />
          </button>
        ))}
      </div>
    </div>
  );
}
