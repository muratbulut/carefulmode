"use client";

import { ArrowRight, House, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { amountValue, type HackedStory } from "@/lib/lab/story";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Bakiye sahnesinde kalan para: ödemeden sonra hesapta bu kadar kalır, hizmet bedeli de düşer. */
const leftover = 1240;
const fee = 240;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const number = (value: number) => value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Sahnenin adımları zamanla ilerler (0'dan `last`a). "Hareketi azalt" açıksa doğrudan son adım
 * görünür; sahne öğrenci "Devam" diyene kadar durur.
 */
function useSteps(times: number[]) {
  // Adımlar sahne açılınca bir kez kurulur.
  const [plan] = useState(times);
  const [step, setStep] = useState(() => (reducedMotion() ? plan.length : 0));
  useEffect(() => {
    if (reducedMotion()) return;
    const timers = plan.map((ms, i) => window.setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [plan]);
  return step;
}

/** Bankanın uygulaması: ödeme ve hizmet bedeli düşer, bakiye gözünün önünde azalır. */
function MoneyScreen({ story }: { story: HackedStory }) {
  const t = getMessages().lab.hacked.scene.money;
  const amount = amountValue(story.amount ?? "");
  const start = amount + leftover;
  const step = useSteps([700, 2600, 3600]);
  const [balance, setBalance] = useState(() => (reducedMotion() ? start - amount - fee : start));

  useEffect(() => {
    if (reducedMotion()) return;
    const timers: number[] = [];
    for (let i = 1; i <= 40; i++) timers.push(window.setTimeout(() => setBalance(start - (amount * i) / 40), 800 + i * 45));
    for (let i = 1; i <= 10; i++) timers.push(window.setTimeout(() => setBalance(start - amount - (fee * i) / 10), 2700 + i * 50));
    return () => timers.forEach((x) => window.clearTimeout(x));
  }, [start, amount]);

  const rows = [
    { text: format(t.request, { sender: story.sender }), value: `-${number(amount)}` },
    { text: t.fee, value: `-${number(fee)}` },
  ];
  return (
    <div className="flex h-full flex-col bg-scene-paper text-scene-ink">
      <div className="flex flex-col gap-0.5 bg-scene-blue px-4 pt-5 pb-4 text-scene-white">
        <span className="text-xs opacity-85">
          {t.bank} · {t.account}
        </span>
        <span data-testid="scene-balance" className="font-heading text-[28px] font-bold tabular-nums">
          {format(t.lira, { value: number(balance) })}
        </span>
        <span className="text-xs opacity-85">{t.balance}</span>
      </div>
      <ul className="flex flex-col px-3 py-1.5 text-[13px]">
        {rows.map((row, i) => (
          <li
            key={row.text}
            className={cn("flex justify-between gap-2 border-b border-scene-line py-2.5 transition-[opacity,transform] duration-400", step > i ? "opacity-100" : "-translate-y-1.5 opacity-0")}
          >
            <span className="flex flex-col">
              {row.text}
              <small className="text-scene-ink-muted">{t.now}</small>
            </span>
            <b className="text-scene-red tabular-nums">{row.value}</b>
          </li>
        ))}
        <li className={cn("py-2.5 font-bold text-scene-red transition-opacity duration-400", step > 2 ? "opacity-100" : "opacity-0")}>{t.final}</li>
      </ul>
    </div>
  );
}

/** Harcama bildirimleri arka arkaya düşer. */
function CardScreen() {
  const t = getMessages().lab.hacked.scene.card;
  const step = useSteps(t.items.map((_, i) => 400 + i * 650));
  return (
    <div className="flex h-full flex-col gap-1.5 bg-scene-body p-2.5">
      <small className="px-1 text-scene-ink-faint">{t.title}</small>
      <ul className="flex flex-col gap-1.5">
        {t.items.map((n, i) => (
          <li
            key={n.text}
            className={cn("rounded-[14px] bg-scene-white px-3 py-2 text-xs text-scene-ink transition-[opacity,transform] duration-300", step > i ? "opacity-100" : "-translate-y-2.5 opacity-0")}
          >
            <b className="block text-[12.5px]">{n.from}</b>
            {n.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Profil başkasının olur, arkadaşlarına senin adınla mesaj gider. */
function AccountScreen({ story, avatar }: { story: HackedStory; avatar: string }) {
  const t = getMessages().lab.hacked.scene.account;
  const step = useSteps([700, 1500, ...t.messages.map((_, i) => 2200 + i * 800)]);
  const taken = step >= 2;
  return (
    <div className="flex h-full flex-col bg-scene-paper text-scene-ink">
      <div className="flex flex-col items-center gap-1.5 px-3 pt-6 pb-2">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-[76px] items-center justify-center rounded-full border-[3px] border-scene-ink text-[34px] transition-[filter,background-color] duration-500",
            taken ? "bg-scene-red-soft grayscale" : "bg-scene-amber-soft",
          )}
        >
          {taken ? <UserRound className="size-9 text-scene-red" strokeWidth={2.2} /> : avatar}
        </span>
        <b className={cn("text-base transition-colors duration-400", taken && "text-scene-red")}>{taken ? t.hacker : t.you}</b>
        <small className="text-scene-ink-muted">{step >= 1 ? t.changed : format(t.label, { account: story.account.name })}</small>
      </div>
      <div className="flex flex-col gap-1.5 px-3 py-2">
        <small className="self-end text-[10px] text-scene-ink-muted">{t.sent}</small>
        {t.messages.map((m, i) => (
          <span
            key={m}
            className={cn(
              "max-w-[85%] self-end rounded-[14px_14px_4px_14px] bg-scene-blue px-2.5 py-1.5 text-xs text-scene-white transition-opacity duration-400",
              step > i + 2 ? "opacity-100" : "opacity-0",
            )}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Haritada bir nokta evine doğru yaklaşır; kapıya varmadan durur. Korkutmadan anlatır. */
const route: [number, number][] = [
  [40, 40],
  [70, 40],
  [70, 120],
  [70, 200],
  [70, 260],
  [120, 260],
  [160, 260],
  [160, 290],
];
function HomeScreen() {
  const t = getMessages().lab.hacked.scene.home;
  const step = useSteps(route.slice(1).map((_, i) => 400 + i * 500));
  const [x, y] = route[Math.min(step, route.length - 1)];
  const label = step >= route.length - 1 ? t.steps[2] : step >= 4 ? t.steps[1] : t.steps[0];
  return (
    <div className="relative h-full bg-scene-map">
      <svg viewBox="0 0 230 380" role="img" aria-label={t.map} className="size-full">
        <path d="M0 120 H230 M0 260 H230 M70 0 V380 M160 0 V380" className="stroke-scene-map-road" strokeWidth="14" />
        <rect x="90" y="140" width="50" height="40" rx="4" className="fill-scene-map-block" />
        <rect x="10" y="280" width="45" height="60" rx="4" className="fill-scene-map-block" />
        <rect x="180" y="20" width="40" height="80" rx="4" className="fill-scene-map-park" />
        <g transform="translate(185 300)">
          <path d="M-14 4 L0 -10 L14 4 V18 H-14Z" className="fill-scene-blue" />
          <text y="34" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-scene-map-label">
            {t.home}
          </text>
        </g>
        <circle cx={x} cy={y} r="9" strokeWidth="3" className="fill-scene-red stroke-scene-white transition-all duration-500" />
      </svg>
      <span className="absolute inset-x-6 top-14 flex items-center justify-center gap-1.5 rounded-full bg-scene-ink px-3 py-2 text-center text-xs font-bold text-scene-white">
        <House className="size-3.5 flex-none" strokeWidth={2.4} aria-hidden="true" />
        <span aria-live="polite">{label}</span>
      </span>
    </div>
  );
}

/**
 * Alarmdan sonraki sonuç sahnesi (3 Kasım, 19 ve 22. revize): "Adım adım ne oldu" açıklaması
 * kalktı; yerine gerçek hayatta olacak olan telefonun içinde canlanır (bakiye düşer, harcama
 * yağar, profil değişir ya da biri evine yaklaşır). Öğrenci "Devam" diyene kadar durur, sonra
 * rapor açılır. Odanın "Gerçek hayatta" cümlesi (trap.realLife) varsa sahnenin genel metninin yerine.
 */
export function HackedScene({ story, avatar, onContinue }: { story: HackedStory; avatar: string; onContinue: () => void }) {
  const t = getMessages().lab.hacked.scene;
  const sim = getMessages().lab;
  const heading = useRef<HTMLHeadingElement>(null);
  const caption = story.realLife.trim() || t.captions[story.scene];

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-alarm-ink text-alarm-strong" data-testid="hacked-scene" data-scene={story.scene}>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_25%,var(--alarm-glow)_0%,var(--alarm-bg-2)_50%,var(--alarm-ink)_100%)] opacity-70" />
      <div className="relative mx-auto flex min-h-full max-w-[960px] flex-col items-center gap-4 px-4 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] [animation:fade-in_.5s_ease-out_both] lg:gap-6 lg:px-8 lg:pt-10">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-dashed border-alarm-strong/40 px-2.5 text-[11px] font-bold tracking-[0.8px] text-alarm-lilac">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-alarm-pink" />
          {sim.simulationShort}
        </span>
        <div className="flex max-w-[560px] flex-col items-center gap-1.5 text-center">
          <h1 ref={heading} tabIndex={-1} className="font-heading text-[26px] leading-tight font-bold text-balance outline-none lg:text-[34px]">
            {t.kicker}
          </h1>
          <p className="m-0 text-[15px] leading-normal text-alarm-muted lg:text-base">{caption}</p>
        </div>

        <div
          className="h-[400px] w-[220px] flex-none overflow-hidden rounded-[32px] border-[7px] border-scene-phone-edge bg-scene-body shadow-[0_24px_60px_var(--shadow-color)] lg:h-[480px] lg:w-[260px]"
        >
          {story.scene === "money" ? <MoneyScreen story={story} /> : story.scene === "card" ? <CardScreen /> : story.scene === "account" ? <AccountScreen story={story} avatar={avatar} /> : <HomeScreen />}
        </div>

        <div className="flex w-full max-w-[420px] flex-col items-center gap-2">
          <button
            type="button"
            onClick={onContinue}
            className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-[17px] font-bold text-on-accent hover:brightness-110"
          >
            {t.continue}
            <ArrowRight className="size-5" strokeWidth={2.4} aria-hidden="true" />
          </button>
          <span className="text-center text-[13px] text-alarm-muted">{t.continueHint}</span>
        </div>
      </div>
    </div>
  );
}
