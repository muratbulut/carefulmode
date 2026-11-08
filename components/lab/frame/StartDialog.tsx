"use client";

import { Check, ChevronRight, ClipboardList, Clock, Flag, Link2, Mail, MessageCircle, ShieldCheck, type LucideIcon } from "lucide-react";
import { Fragment, useEffect, useEffectEvent, useRef, useState } from "react";
import type { ScenarioTemplate } from "@/lib/lab/content";
import { getMessages } from "@/lib/i18n";

const primary =
  "flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-[17px] font-bold text-on-accent transition-[filter,opacity] hover:brightness-110 disabled:cursor-default disabled:opacity-60";

const flowIcons: { Icon: LucideIcon; tone: string }[] = [
  { Icon: Flag, tone: "text-warning-fg" },
  { Icon: ClipboardList, tone: "text-accent-fg" },
  { Icon: Check, tone: "text-accent-fg" },
];

/** "Başlık: açıklama" biçimindeki hatırlatma iki satıra bölünür; iki nokta yoksa tek satırdır. */
export function splitReminder(text: string) {
  const at = text.indexOf(": ");
  if (at < 0) return { title: text.trim(), text: "" };
  return { title: text.slice(0, at).trim(), text: text.slice(at + 2).trim() };
}

/**
 * Perdede odanın adı harf harf yazılır: harf başına süre (uzun adda kısalır, yazı en çok 1,5 saniye
 * sürer) ve yazı bitince bekleme.
 */
const letterMs = (letters: number) => Math.min(60, 1500 / Math.max(letters, 1));
const holdMs = 800;

/**
 * Oda başlamadan önceki pencere (Lab-Cerceve-Baslangic; 18. revize, 3 Kasım): odaya girer girmez
 * her yer kararır, perdede odanın adı harf harf yazılıp söner, sonra bu kutu gelir. Görevli odada
 * velinin araması "Hazırım, başla"dan sonra çalar. Doğru/yanlış gösterilmeyeceğini anlatır ve genel
 * hatırlatmaları verir (odaya özel değil: tuzağı önceden söylemesin). Masaüstünde ortada, telefonda
 * alttan açılır. "Hareketi azalt" açıksa perde yazısı yok, kutu hemen gelir.
 */
export function StartDialog({
  name,
  template,
  starting,
  onStart,
}: {
  /** Perdede yazan odanın adı. */
  name: string;
  template: ScenarioTemplate;
  starting: boolean;
  onStart: () => void;
}) {
  const t = getMessages().lab.frame.start;
  const button = useRef<HTMLButtonElement>(null);
  const icons: LucideIcon[] = [template === "MESSAGING" ? MessageCircle : Mail, Clock, Link2, ShieldCheck];
  const reminders = t.reminders;
  // Sunucuda ve tarayıcıda aynı başlar (perde); "Hareketi azalt" açıksa ilk karede kalkar.
  const [curtain, setCurtain] = useState(() => name.trim().length > 0);
  const [typed, setTyped] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!curtain) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const skip = window.setTimeout(() => setCurtain(false), 0);
      return () => window.clearTimeout(skip);
    }
    const letters = [...name];
    const step = letterMs(letters.length);
    const end = 500 + letters.length * step + holdMs;
    const timers = letters.map((_, i) => window.setTimeout(() => setTyped(i + 1), 500 + i * step));
    timers.push(window.setTimeout(() => setFading(true), end));
    timers.push(window.setTimeout(() => setCurtain(false), end + 450));
    return () => timers.forEach((x) => window.clearTimeout(x));
  }, [curtain, name]);

  useEffect(() => {
    if (!curtain) button.current?.focus({ preventScroll: true });
  }, [curtain]);

  if (curtain) {
    return (
      <div data-testid="start-curtain" className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/95 px-6 [animation:fade-in_.5s_ease-out_both]">
        <p
          aria-label={name}
          className={`m-0 max-w-[16ch] text-center font-heading text-[30px] leading-tight font-bold text-balance text-fg transition-opacity duration-400 lg:text-[44px] ${fading ? "opacity-0" : "opacity-100"}`}
        >
          <span aria-hidden="true">{[...name].slice(0, typed).join("")}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-canvas/95 [animation:fade-in_.2s_ease-out_both] lg:items-center lg:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-start-title"
        aria-describedby="lab-start-text"
        className="flex max-h-[92dvh] w-full flex-col gap-[18px] overflow-y-auto rounded-t-3xl border border-line bg-surface p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-card [animation:slide-up_.3s_cubic-bezier(.2,.8,.2,1)_both] lg:max-w-[520px] lg:rounded-3xl lg:p-8 lg:[animation:pop_.25s_ease-out_both]"
      >
        <span className="text-xs font-bold tracking-[0.8px] text-warning-fg">{t.kicker}</span>
        <h2 id="lab-start-title" className="-mt-2 font-heading text-2xl leading-tight font-bold lg:text-[28px]">
          {t.title}
        </h2>
        <p id="lab-start-text" className="-mt-1.5 leading-relaxed text-fg-2">
          {t.text}
        </p>

        <div aria-hidden="true" className="flex items-center gap-1.5">
          {t.flow.map((step, i) => {
            const { Icon, tone } = flowIcons[i] ?? flowIcons[2];
            return (
              <Fragment key={step}>
                {i > 0 ? <ChevronRight className="size-3.5 flex-none text-fg-4" strokeWidth={2.2} /> : null}
                <span
                  className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[10px] border border-card bg-surface-deep px-1.5 py-2 text-center text-xs leading-tight font-bold text-fg-2 [animation:rise_.4s_ease-out_both] lg:h-9 lg:flex-row lg:gap-1.5 lg:py-0 lg:text-[13px] lg:whitespace-nowrap"
                  style={{ animationDelay: `${0.1 + i * 0.15}s` }}
                >
                  <Icon className={`size-3.5 flex-none ${tone}`} strokeWidth={2.2} />
                  {step}
                </span>
              </Fragment>
            );
          })}
        </div>

        {reminders.length > 0 ? (
          <>
            <div className="h-px bg-line" />
            <h3 className="-mb-1.5 text-xs font-bold tracking-[0.8px] text-fg-3">{t.remember}</h3>
            <ul className="flex flex-col gap-3.5">
              {reminders.map((reminder, i) => {
                const Icon = icons[i] ?? ShieldCheck;
                const { title, text } = splitReminder(reminder);
                return (
                  <li
                    key={reminder}
                    className="flex items-start gap-3 [animation:rise_.4s_ease-out_both]"
                    style={{ animationDelay: `${0.55 + i * 0.12}s` }}
                  >
                    <span className="flex size-[34px] flex-none items-center justify-center rounded-[10px] bg-accent/12">
                      <Icon className="size-[17px] text-accent-fg" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="flex flex-col gap-px">
                      <span className="text-[15px] font-bold">{title}</span>
                      {text ? <span className="text-[13px] leading-snug text-fg-3">{text}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        <button ref={button} type="button" onClick={onStart} disabled={starting} className={primary}>
          {starting ? t.starting : t.go}
        </button>
      </div>
    </div>
  );
}

/** Çıkış onayı (Lab-Cerceve): "Odada kal" öne çıkar, "Çık" ilerlemeyi kaydedip lab sayfasına döner. */
export function ExitDialog({ open, leaving, onStay, onLeave }: { open: boolean; leaving: boolean; onStay: () => void; onLeave: () => void }) {
  const t = getMessages().lab.frame.exitDialog;
  const stay = useRef<HTMLButtonElement>(null);
  const cancel = useEffectEvent(onStay);

  useEffect(() => {
    if (!open) return;
    stay.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-5 [animation:fade-in_.15s_ease-out_both]" onClick={onStay}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="lab-exit-title"
        aria-describedby="lab-exit-text"
        onClick={(event) => event.stopPropagation()}
        className="flex w-full max-w-[400px] flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-6 shadow-card [animation:pop_.25s_ease-out_both]"
      >
        <h2 id="lab-exit-title" className="font-heading text-[22px] font-bold">
          {t.title}
        </h2>
        <p id="lab-exit-text" className="text-[15px] leading-relaxed text-fg-3">
          {t.text}
        </p>
        <div className="mt-1 grid grid-cols-2 gap-2.5">
          <button
            ref={stay}
            type="button"
            onClick={onStay}
            className="flex h-12 cursor-pointer items-center justify-center rounded-xl bg-accent text-base font-bold text-on-accent hover:brightness-110"
          >
            {t.stay}
          </button>
          <button
            type="button"
            onClick={onLeave}
            disabled={leaving}
            className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-card text-base font-bold text-fg disabled:opacity-60"
          >
            {t.leave}
          </button>
        </div>
      </div>
    </div>
  );
}
