"use client";

import { CreditCard, Download, Lock, LockOpen, Mail, Volume2, VolumeX, type LucideIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { CompromiseKind } from "@/lib/lab/content";
import type { AlarmText, CompromisedAccount } from "@/lib/lab/story";
import { format, getMessages } from "@/lib/i18n";
import { readMuted, writeMuted } from "../sound";

/** Alarm bu kadar sürer, sonra sonuç sahnesi gelir. */
const alarmMs = 4200;

export const kindIcons: Record<CompromiseKind, LucideIcon> = {
  account: LockOpen,
  ransom: Lock,
  data_leak: Download,
  financial: CreditCard,
};

/** Kısa, kısık bir uyarı sesi. Ses öğrencinin tıklamasından hemen sonra çalar (tarayıcı izin verir). */
function beep() {
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const ctx = new Context();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    [0, 0.22, 0.44].forEach((d, i) => osc.frequency.setValueAtTime(i % 2 ? 520 : 760, now + d));
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.72);
    osc.onended = () => void ctx.close();
  } catch {
    // Ses çalınamazsa alarm sessiz devam eder.
  }
}

function NotificationIcon({ kind, mail }: { kind: CompromiseKind; mail: boolean }) {
  if (kind === "account" && mail) {
    return (
      <span aria-hidden="true" className="relative flex size-[30px] flex-none items-center justify-center rounded-[9px] bg-scene-orange text-scene-white">
        <Mail className="size-[18px]" strokeWidth={2.4} />
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-[1.5px] border-scene-orange bg-scene-yellow" />
      </span>
    );
  }
  const Icon = kindIcons[kind];
  return (
    <span aria-hidden="true" className="flex size-[30px] flex-none items-center justify-center rounded-[9px] bg-alarm-pink text-alarm-ink">
      <Icon className="size-[17px]" strokeWidth={2.4} />
    </span>
  );
}

/**
 * "Hacklendin" alarmı (Hacklendin-Son-Alarm): kırmızımsı ekran, kısa titreme ve flaş, griye dönen
 * avatar, sırayla düşen bildirimler. 4 saniye sonra sonuç sahnesine (HackedScene) geçer; "Hareketi azalt" açıksa
 * titreme, flaş ve kayma olmaz, ekran sabit görünür.
 */
export function HackedAlarm({
  kind,
  account,
  avatar,
  contact,
  alarm,
  onDone,
}: {
  kind: CompromiseKind;
  account: CompromisedAccount;
  avatar: string;
  contact: string;
  /** Odaya özgü satır ve bildirimler (tuzaktaki `alarm`, ör. "Annenin kartından"); yoksa türün genel metni. */
  alarm?: AlarmText;
  onDone: () => void;
}) {
  const t = getMessages().lab.hacked;
  const sim = getMessages().lab;
  // Alarm yalnızca tarayıcıda, öğrencinin tıklamasından sonra çizilir; seçim doğrudan okunur.
  const [muted, setMuted] = useState(readMuted);
  const skip = useRef<HTMLButtonElement>(null);
  const done = useEffectEvent(onDone);
  const KindIcon = kindIcons[kind];

  // Hesap Postam değilse bildirimler mail yerine mesaj der (sabah soruları 25d).
  const list = kind === "account" && !account.mail ? t.notifications.accountMessages : t.notifications[kind];
  const notifications = alarm?.notifications.length
    ? alarm.notifications
    : list
        .filter((n) => contact || !n.title.includes("{contact}"))
        .map((n) => ({ title: format(n.title, { contact }), text: format(n.text, { account: account.name }) }));
  const line = alarm?.line.trim() ? alarm.line : format(t.lines[kind], { account: account.name });

  useEffect(() => {
    if (!readMuted()) beep();
    skip.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => done(), alarmMs);
    return () => window.clearTimeout(timer);
  }, []);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    writeMuted(next);
    if (!next) beep();
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-alarm-ink text-alarm-strong" data-testid="hacked-alarm">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,var(--alarm-glow)_0%,var(--alarm-bg-2)_45%,var(--alarm-ink)_100%)]" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgb(255_255_255/.025)_0_1px,transparent_1px_4px)] [animation:hk-scan_.5s_linear_infinite]"
      />
      <div aria-hidden="true" className="absolute inset-0 shadow-[inset_0_0_160px_color-mix(in_srgb,var(--alarm-pink)_16%,transparent)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[3] bg-alarm-pink opacity-0 [animation:hk-flash_1s_ease-out_both]" />

      <div className="relative flex h-full flex-col [animation:hk-shake_.4s_ease-out_.05s_2]">
        <div className="flex flex-none items-center justify-between px-4 py-3.5 lg:px-8 lg:py-[22px]">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-alarm-strong/40 px-2.5 text-[11px] font-bold tracking-[0.8px] text-alarm-lilac">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-alarm-pink [animation:hk-blink_1s_steps(1)_infinite]" />
            <span className="lg:hidden">{sim.simulationShort}</span>
            <span className="max-lg:hidden">{sim.simulation}</span>
          </span>
          <button
            type="button"
            onClick={toggleMute}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-alarm-strong/20 bg-alarm-ink/50 px-3 text-sm font-bold text-alarm-lilac lg:px-4"
          >
            {muted ? <VolumeX className="size-[18px]" strokeWidth={2} aria-hidden="true" /> : <Volume2 className="size-[18px]" strokeWidth={2} aria-hidden="true" />}
            <span className="max-lg:sr-only">{muted ? t.unmute : t.mute}</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5 px-4 text-center lg:gap-5 lg:px-6">
          <div className="relative size-[92px] flex-none lg:size-32">
            {[0.6, 1.2, 1.8].map((delay) => (
              <span
                key={delay}
                aria-hidden="true"
                className="absolute inset-0 rounded-full border-2 border-alarm-pink opacity-0 [animation:hk-ring_1.8s_ease-out_infinite]"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
            <span className="absolute inset-0 flex items-center justify-center rounded-full border-2 border-alarm-strong/20 bg-alarm-avatar text-[50px] grayscale brightness-70 [animation:hk-gray_.9s_ease-out_both] lg:text-[70px]">
              <span aria-hidden="true">{avatar}</span>
            </span>
            <span className="absolute -right-1 -bottom-1 flex size-9 items-center justify-center rounded-full border-[3px] border-alarm-ink bg-alarm-pink text-alarm-ink [animation:pop_.3s_ease-out_.65s_both] lg:size-[46px]">
              <KindIcon className="size-[18px] lg:size-[22px]" strokeWidth={2.4} aria-hidden="true" />
            </span>
          </div>

          <div role="alert" className="flex flex-col items-center gap-1.5 lg:gap-2.5">
            <h1
              data-text={t.title}
              className="hacked-glitch font-heading text-[50px] leading-none font-bold tracking-[2px] text-alarm-strong [text-shadow:0_0_28px_color-mix(in_srgb,var(--alarm-pink)_45%,transparent)] lg:text-8xl lg:tracking-[6px]"
            >
              {t.title}
            </h1>
            <p className="text-lg font-bold text-alarm-text lg:text-2xl">{line}</p>
          </div>

          <ul aria-label={t.notificationsLabel} className="mt-0.5 flex w-full max-w-[480px] flex-col gap-1.5 lg:mt-2 lg:gap-2">
            {notifications.map((n, i) => (
              <li
                key={n.title}
                className="flex items-start gap-3 rounded-[14px] border border-alarm-line bg-alarm-card px-3 py-[9px] text-left backdrop-blur-sm [animation:rise_.35s_ease-out_both] lg:px-3.5 lg:py-3"
                style={{ animationDelay: `${0.9 + i * 0.5}s` }}
              >
                <NotificationIcon kind={kind} mail={account.mail} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex justify-between gap-2">
                    <b className="text-sm text-alarm-strong lg:text-[15px]">{n.title}</b>
                    <span className="flex-none text-xs text-alarm-pink-soft">{t.now}</span>
                  </span>
                  <span className="text-[13px] leading-snug text-alarm-muted">{n.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-none flex-col items-center gap-2.5 px-6 pt-[18px] pb-[max(28px,env(safe-area-inset-bottom))]">
          <span aria-hidden="true" className="h-1 w-[260px] overflow-hidden rounded-full bg-alarm-strong/12">
            <span className="block h-full origin-left bg-alarm-pink-soft [animation:hk-bar_4.2s_linear_both]" />
          </span>
          <span className="text-[13px] text-alarm-muted">{t.footer}</span>
          <button
            ref={skip}
            type="button"
            onClick={onDone}
            className="min-h-11 cursor-pointer px-3 text-sm font-bold text-alarm-lilac underline underline-offset-4"
          >
            {t.skip}
          </button>
        </div>
      </div>
    </div>
  );
}
