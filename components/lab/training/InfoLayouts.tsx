"use client";

import { Check, Eye, Lightbulb, Lock, Nfc, PenLine, User } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { ClientCard } from "@/lib/lab/client";
import type { CardIcon } from "@/lib/lab/content";
import { format, getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RichLine } from "../scene/parts";
import { cardIconMap } from "./card-icons";
import { CardTag, CardTitle, LockHint, Mark, rowTones, toneAt, tones, type Tone } from "./common";

// Bilgi kartının açılan düzenleri (Tur 7, Murat 1 Kasım): keşfet (profil kartı), adım adım ("Dur,
// sor, kontrol et") ve banka kartı ("Kartın önü, arkası ve SMS kodu"). Öğrenci her maddeyi açar;
// hepsi açılmadan oynatıcı Devam'ı açmaz (`seen`, TrainingPlayer). Doğru ya da yanlış yoktur.

export type InfoCard = Extract<ClientCard, { type: "info" }>;
type Props = { card: InfoCard; seen: number[]; onSeen: (point: number) => void };

/** Öğrencinin avatarı (emoji): keşfet kartındaki profil "senin profilin" olsun (Murat, 3 Kasım). */
const AvatarContext = createContext<string | null>(null);
export function ViewerAvatar({ value, children }: { value: string | null; children: ReactNode }) {
  return <AvatarContext value={value}>{children}</AvatarContext>;
}

const exploreIcons: CardIcon[] = ["id", "call", "pin", "card"];
const stepIcons: CardIcon[] = ["stop", "ask", "search", "flag"];
const bankIcons: CardIcon[] = ["card", "flip", "message", "users"];
const stepTones: Tone[] = [tones.danger, tones.warning, tones.accent, tones.success];
const bankTones: Tone[] = [tones.warning, tones.warning, tones.accent, tones.success];

function pointIcon(card: InfoCard, i: number, defaults: CardIcon[]) {
  return cardIconMap[card.points[i]?.icon ?? defaults[i % defaults.length]];
}

/** Sağ üstteki sayaç ("2/4 keşfedildi"); hepsi açılınca yeşil. */
function Counter({ text, all }: { text: string; all: boolean }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 text-sm font-bold transition-colors", all ? "text-success-fg" : "text-fg-3")}>
      <Eye className="size-4" strokeWidth={2.2} aria-hidden="true" />
      {text}
    </span>
  );
}

function Lead({ text }: { text: string | undefined }) {
  return text ? (
    <p className="text-base leading-relaxed text-fg-2 lg:text-[17px]">
      <RichLine text={text} />
    </p>
  ) : null;
}

/** Hepsi açılınca (ya da banka kartında SMS maddesinden sonra) çıkan ikinci paragraf. */
function Callout({ text, tone, icon: Icon }: { text: string; tone: "success" | "warning"; icon: typeof Lightbulb }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5 [animation:rise_.4s_ease-out_both]",
        tone === "success" ? "border-success/45 bg-success/8" : "border-dashed border-line-strong bg-warning/6",
      )}
    >
      <span className={cn("flex size-[34px] flex-none items-center justify-center rounded-[10px]", tone === "success" ? "bg-success/16 text-success-fg" : "bg-warning/14 text-warning-fg")}>
        <Icon className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="text-[15px] leading-relaxed text-fg-2">
        <RichLine text={text} />
      </span>
    </div>
  );
}

const placeholder = "rounded-full bg-line-strong";

/** Keşfet: maddeler bir profil kartının alanlarıdır; öğrenci dokunup açar, ne anlattığını okur. */
export function ExploreInfo({ card, seen, onSeen }: Props) {
  const t = getMessages().lab.training;
  const avatar = useContext(AvatarContext);
  const m = t.explore;
  const [open, setOpen] = useState<number | null>(null);
  const total = card.points.length;
  const all = seen.length >= total;
  const [lead, after] = card.paragraphs;
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <CardTag>{t.tags.info}</CardTag>
        <Counter text={format(m.count, { n: seen.length, total })} all={all} />
      </div>
      <CardTitle>{card.title}</CardTitle>
      <Lead text={lead} />
      <div className="flex flex-col gap-3.5 overflow-hidden rounded-[22px] border border-line bg-[linear-gradient(160deg,var(--card),var(--surface-deep)_60%)] p-4 shadow-floating lg:p-5">
        <div className="flex items-center gap-3.5">
          <span className="flex size-14 flex-none items-center justify-center rounded-full border-2 border-accent/60 bg-card text-fg-2">
            {avatar ? (
              <span aria-hidden="true" className="text-[30px] leading-none" data-testid="explore-avatar">
                {avatar}
              </span>
            ) : (
              <User className="size-7" strokeWidth={2} aria-hidden="true" />
            )}
          </span>
          <span className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-bold tracking-[0.8px] text-fg-3">{m.profile}</span>
            <span aria-hidden="true" className="flex gap-1.5">
              <span className={cn(placeholder, "h-3 w-[92px]")} />
              <span className="h-3 w-[60px] rounded-full bg-line" />
            </span>
          </span>
          <span className="max-w-[110px] text-right text-xs text-fg-3">{m.tap}</span>
        </div>
        <ul aria-label={m.fields} className="grid gap-2.5 lg:grid-cols-2 lg:items-start">
          {card.points.map((point, i) => {
            const tone = toneAt(rowTones, i);
            const Icon = pointIcon(card, i, exploreIcons);
            const isSeen = seen.includes(i);
            const isOpen = open === i;
            return (
              <li
                key={i}
                className={cn("flex flex-col rounded-2xl border transition-[border-color,background-color] duration-200", isOpen ? cn(tone.edge, tone.wash) : "border-line bg-canvas/55")}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setOpen(isOpen ? null : i);
                    onSeen(i);
                  }}
                  className="flex min-h-[60px] cursor-pointer items-center gap-3 px-3.5 py-2.5 text-left"
                >
                  <span className={cn("flex size-10 flex-none items-center justify-center rounded-xl", tone.soft, tone.text)}>
                    <Icon className="size-5" strokeWidth={2.1} aria-hidden="true" />
                  </span>
                  <span className="flex flex-1 flex-col gap-[5px]">
                    <b className={cn("text-base transition-colors", isSeen ? tone.text : "text-fg")}>{point.title}</b>
                    {!isSeen ? (
                      <span aria-hidden="true" className="flex gap-[5px]">
                        <span className={cn(placeholder, "h-2 w-[46px]")} />
                        <span className="h-2 w-7 rounded-full bg-line" />
                        <span className="h-2 w-[38px] rounded-full bg-line" />
                      </span>
                    ) : null}
                  </span>
                  {isSeen ? (
                    <Mark tone={tone.solid}>
                      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    </Mark>
                  ) : (
                    <span aria-hidden="true" className={cn("size-2.5 flex-none rounded-full [animation:blink-dot_1.6s_ease-in-out_infinite]", tone.solid)} />
                  )}
                </button>
                {isOpen ? (
                  <p className="pr-3.5 pb-3.5 pl-[66px] text-[15px] leading-normal text-fg-2 [animation:unfold_.3s_ease-out_both]">
                    <RichLine text={point.text} />
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {!all ? <LockHint>{m.locked}</LockHint> : after ? <Callout text={after} tone="success" icon={Lightbulb} /> : null}
    </>
  );
}

/** Adım adım: maddeler sırayla açılır; açılmamış adım kilitlidir. Masaüstünde yan yana, eşit boyda. */
export function StepsInfo({ card, seen, onSeen }: Props) {
  const t = getMessages().lab.training;
  const m = t.steps;
  const total = card.points.length;
  const opened = Math.min(seen.length, total);
  const all = opened >= total;
  const cols = total >= 4 ? "lg:grid-cols-4" : total === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";
  const list = card.points.map((p, i) => (i === 0 ? p.title : p.title.toLocaleLowerCase("tr"))).join(", ");
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <CardTag>{t.tags.info}</CardTag>
        <span role="status" className={cn("inline-flex items-center gap-2 text-sm font-bold", all ? "text-success-fg" : "text-fg-3")}>
          <span aria-hidden="true" className="flex gap-1">
            {card.points.map((_, i) => (
              <span key={i} className={cn("h-1.5 w-[18px] rounded-full transition-colors duration-300", i < opened ? toneAt(stepTones, i).solid : "bg-card")} />
            ))}
          </span>
          {format(t.progress, { n: opened, total })}
        </span>
      </div>
      <CardTitle>{card.title}</CardTitle>
      <Lead text={card.paragraphs[0]} />
      <ol aria-label={m.list} className={cn("relative flex flex-col gap-3.5 lg:grid lg:gap-3.5", cols)}>
        {/* Adımları bağlayan çizgi: telefonda solda dikey, masaüstünde düğümlerin hizasında yatay. */}
        <span aria-hidden="true" className="absolute top-8 bottom-8 left-[31px] w-[3px] rounded-full bg-card lg:top-[31px] lg:right-[12%] lg:bottom-auto lg:left-[12%] lg:h-[3px] lg:w-auto" />
        {card.points.map((point, i) => {
          const tone = toneAt(stepTones, i);
          const Icon = pointIcon(card, i, stepIcons);
          const done = i < opened;
          const current = i === opened;
          const locked = i > opened;
          return (
            <li key={i} className="relative flex">
              <button
                type="button"
                disabled={locked}
                aria-expanded={done}
                aria-label={format(m.stepLabel, { n: i + 1, title: point.title })}
                onClick={() => current && onSeen(i)}
                className={cn("flex w-full items-start gap-3.5 text-left lg:h-full lg:flex-col lg:items-center lg:gap-3", current ? "cursor-pointer" : "cursor-default")}
              >
                <span
                  className={cn(
                    "relative z-[1] flex size-16 flex-none items-center justify-center rounded-full border-2 transition-[background-color,border-color] duration-300",
                    locked ? "border-dashed border-line-strong bg-surface-deep text-fg-4" : tone.ring,
                    done && cn(tone.solid, "text-on-accent"),
                    current && cn(tone.soft, tone.text, tone.pulse, "[animation:pulse-ring_1.3s_ease-out_infinite]"),
                  )}
                >
                  {locked ? <Lock className="size-[22px]" strokeWidth={2.2} aria-hidden="true" /> : <Icon className="size-[26px]" strokeWidth={2.2} aria-hidden="true" />}
                </span>
                <span
                  className={cn(
                    "flex min-h-16 flex-1 flex-col gap-1.5 self-stretch rounded-2xl border px-3.5 py-3 transition-[border-color,background-color] duration-300 lg:min-h-[150px] lg:p-3.5",
                    done ? cn("border-[1.5px]", tone.ring, tone.wash) : current ? cn("border-[1.5px] border-dashed", tone.ring, "bg-surface-deep") : "border-card bg-surface-deep",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                    <b className={cn("font-heading text-xl", locked ? "text-fg-4" : tone.text)}>{point.title}</b>
                  </span>
                  {done ? (
                    <span className="text-[15px] leading-normal text-fg-2 [animation:unfold_.35s_ease-out_both]">
                      <RichLine text={point.text} />
                    </span>
                  ) : current ? (
                    <span className={cn("text-sm font-bold", tone.text)}>{m.open}</span>
                  ) : (
                    <span className="text-sm text-fg-3">{m.locked}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {!all ? (
        <LockHint>{m.lockedHint}</LockHint>
      ) : (
        <div className="flex items-center justify-center gap-2.5 rounded-[14px] border border-success/45 bg-success/8 p-3 text-center text-[15px] font-bold text-success-fg [animation:pop_.25s_ease-out_both]">
          <Check className="size-[18px] flex-none" strokeWidth={3} aria-hidden="true" />
          {format(m.done, { list })}
        </div>
      )}
    </>
  );
}

/**
 * Banka kartı: örnek kart çizimi, dört madde sırasıyla kartın önü (numara ve tarih parlar), arkası
 * (kart döner, CVV), SMS kodu (telefon ve imza) ve veli izni (kilit). Kart ve telefon kurgusaldır.
 */
export function BankCardInfo({ card, seen, onSeen }: Props) {
  const t = getMessages().lab.training;
  const m = t.bankCard;
  const [step, setStep] = useState<number | null>(null);
  const total = card.points.length;
  const all = seen.length >= total;
  const [lead, after] = card.paragraphs;
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <CardTag>{t.tags.info}</CardTag>
        <Counter text={format(m.count, { n: seen.length, total })} all={all} />
      </div>
      <CardTitle>{card.title}</CardTitle>
      <Lead text={lead} />
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[430px_minmax(0,1fr)] lg:items-start lg:gap-[22px]">
        <div className="flex flex-col gap-2">
          <BankStage step={step} />
          <span className="text-center text-[13px] text-fg-3">{step === null ? m.idle : (m.stage[step] ?? "")}</span>
        </div>
        <ol aria-label={m.list} className="flex flex-col gap-2.5">
          {card.points.map((point, i) => {
            const tone = toneAt(bankTones, i);
            const Icon = pointIcon(card, i, bankIcons);
            const isOpen = step === i;
            const isSeen = seen.includes(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => {
                    setStep(i);
                    onSeen(i);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer flex-col gap-1.5 rounded-2xl border px-3.5 py-3 text-left transition-[border-color,background-color] duration-200",
                    isOpen ? cn("border-[1.5px]", tone.ring, tone.soft) : "border-line bg-surface-deep",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span className={cn("flex size-[38px] flex-none items-center justify-center rounded-xl", tone.soft, tone.text)}>
                      <Icon className="size-[19px]" strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    <b className="flex-1 text-[15px] leading-snug">{point.title}</b>
                    {isSeen ? (
                      <Mark tone="bg-success">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                      </Mark>
                    ) : (
                      <span className="font-mono text-xs font-bold text-fg-3">{format(t.progress, { n: i + 1, total })}</span>
                    )}
                  </span>
                  {isOpen ? (
                    <span className="pl-[50px] text-[15px] leading-normal text-fg-2 [animation:rise_.4s_ease-out_both]">
                      <RichLine text={point.text} />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {after && seen.includes(2) ? <Callout text={after} tone="warning" icon={PenLine} /> : null}
      {!all ? <LockHint>{m.locked}</LockHint> : null}
    </>
  );
}

/** Kartın parlayan yeri (numara, tarih, CVV): seçili adımda görünür. */
function Glow({ on, className }: { on: boolean; className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute rounded-lg transition-opacity duration-300 [animation:glow-box_1.6s_ease-in-out_infinite] motion-reduce:shadow-[0_0_0_2px_var(--warning)]", on ? "opacity-100" : "opacity-0", className)}
    />
  );
}

/** Banka kartının sahnesi: süzülen kart, dönünce arkası, SMS adımında telefon, veli izni kilidi. */
function BankStage({ step }: { step: number | null }) {
  const m = getMessages().lab.training.bankCard;
  const face = "absolute inset-0 overflow-hidden rounded-[18px] shadow-floating [backface-visibility:hidden]";
  return (
    <div
      aria-hidden="true"
      className="relative h-[270px] overflow-hidden rounded-[20px] border border-card bg-[radial-gradient(70%_70%_at_40%_45%,color-mix(in_srgb,var(--art-card-1)_22%,transparent),transparent_70%),var(--surface-deep)] lg:h-[300px]"
    >
      <div className="absolute top-[38px] left-[calc(50%-170px)] h-[186px] w-[296px] [perspective:900px] [animation:card-float_5s_ease-in-out_infinite] lg:top-[53px] lg:left-[calc(50%-182px)]">
        <div
          className={cn(
            "relative size-full transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] [transform-style:preserve-3d]",
            step === 1 ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]",
          )}
        >
          {/* Ön yüz */}
          <div className={cn(face, "bg-[linear-gradient(135deg,var(--art-card-1)_0%,var(--art-card-2)_55%,var(--art-card-3)_100%)] font-sans text-scene-white")}>
            <span className="absolute -top-[60px] -right-10 size-[200px] rounded-full bg-scene-white/8" />
            <span className="absolute top-[18px] left-5 text-[13px] font-bold tracking-[1px] text-scene-white/85">{m.bank}</span>
            <span className="absolute top-[54px] left-5 h-[30px] w-10 rounded-md bg-[linear-gradient(135deg,var(--art-chip-1),var(--art-chip-2))]" />
            <Nfc className="absolute top-14 left-[70px] size-6 text-scene-white/70" strokeWidth={2} />
            <span className="absolute top-[102px] left-5 font-mono text-[19px] font-bold tracking-[2px]">{m.number}</span>
            <Glow on={step === 0} className="top-24 left-3 h-[34px] w-[266px]" />
            <span className="absolute top-[146px] left-5 text-xs font-bold tracking-[1px] text-scene-white/85">{m.holder}</span>
            <span className="absolute top-[140px] left-[196px] flex flex-col">
              <span className="text-[9px] text-scene-white/70">{m.expiry}</span>
              <span className="font-mono text-sm font-bold">{m.date}</span>
            </span>
            <Glow on={step === 0} className="top-[136px] left-[188px] h-[38px] w-[70px]" />
          </div>
          {/* Arka yüz */}
          <div className={cn(face, "[transform:rotateY(180deg)] bg-[linear-gradient(135deg,var(--art-card-2),var(--art-card-3))]")}>
            <span className="absolute inset-x-0 top-[22px] h-[38px] bg-canvas" />
            <span className="absolute top-[84px] left-5 h-[34px] w-[180px] rounded-md bg-[repeating-linear-gradient(90deg,var(--scene-line)_0_8px,var(--scene-paper)_8px_16px)]" />
            <span className="absolute top-[84px] left-[206px] flex h-[34px] w-[66px] items-center justify-center rounded-md bg-scene-paper font-mono text-[17px] font-bold text-scene-ink">{m.cvv}</span>
            <Glow on={step === 1} className="top-[78px] left-[200px] h-[46px] w-[78px]" />
            <span className={cn("absolute top-32 left-[210px] text-[11px] font-bold text-art-chip-1 transition-opacity", step === 1 ? "opacity-100" : "opacity-0")}>{m.cvvLabel}</span>
            <span className="absolute bottom-4 left-5 text-[10px] text-scene-white/60">{m.sample}</span>
          </div>
        </div>
        {step === 3 ? (
          <div className="absolute top-[47px] left-[102px] flex size-[92px] flex-col items-center justify-center gap-0.5 rounded-full border-2 border-success bg-canvas/88 text-success-fg shadow-[0_0_0_10px_color-mix(in_srgb,var(--success)_12%,transparent)] [animation:shield-in_.55s_cubic-bezier(.2,.8,.2,1)_both]">
            <Lock className="size-7" strokeWidth={2.2} />
            <span className="text-[11px] font-bold">{m.parent}</span>
          </div>
        ) : null}
      </div>
      {step === 2 ? (
        <div className="absolute top-3 left-[calc(50%+66px)] h-[236px] w-[132px] rotate-[4deg] rounded-[22px] border-[3px] border-line-strong bg-surface-deep px-2 pt-[22px] pb-2.5 shadow-floating [animation:phone-in_.55s_cubic-bezier(.2,.8,.2,1)_both] lg:top-[27px] lg:left-[calc(50%+54px)]">
          <span className="absolute top-2 left-[46px] h-[5px] w-[34px] rounded-full bg-line" />
          <div className="rounded-[12px_12px_12px_4px] bg-card p-2 text-[10.5px] leading-[1.35] text-fg-2 [animation:bubble-in_.45s_cubic-bezier(.2,.8,.2,1)_.35s_both]">
            <b className="block text-[10px] text-accent-fg">{m.bank}</b>
            {rich(m.sms, { b: (chunk) => <b className="font-mono text-fg">{chunk}</b> })}
          </div>
          <svg width="112" height="56" viewBox="0 0 112 56" className="mt-2.5">
            <path
              d="M6 40 C 18 8, 26 8, 30 34 S 44 52, 50 24 S 66 6, 72 32 S 90 44, 106 18"
              fill="none"
              className="stroke-warning [stroke-dasharray:220] [stroke-dashoffset:220] [animation:sign-draw_1.1s_ease-out_.9s_both] motion-reduce:[stroke-dashoffset:0]"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <line x1="6" y1="50" x2="106" y2="50" className="stroke-line-strong" strokeWidth="1.5" />
          </svg>
          <span className="block text-center text-[10px] font-bold text-warning-fg">{m.signature}</span>
        </div>
      ) : null}
    </div>
  );
}
