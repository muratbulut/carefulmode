"use client";

import { Check, CircleCheck, Flag, Lightbulb, Maximize, Minimize, Play, Search, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { ClientCard } from "@/lib/lab/client";
import type { PlacementResult } from "@/lib/lab/training";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PostamLogo } from "../inbox/InboxScene";
import { RichLine, SenderAvatar } from "../scene/parts";
import { QuizArtView } from "./art";
import { cardIconMap } from "./card-icons";
import { CardTag, CardTitle, Mark } from "./common";
import { BankCardInfo, ExploreInfo, StepsInfo } from "./InfoLayouts";

export { CardTag, CardTitle } from "./common";

export type Spot = { index: number; text: string };
export type QuizResult = { correct: boolean; answer: number; explain: string };
export type Answer = { option: number; result: QuizResult };
/** Kontrol edilmiş yerleştirme: öğrencinin seçimleri ve sürücünün söylediği doğrular. */
export type Placement = { picks: number[]; result: PlacementResult };

type ClickFindCard = Extract<ClientCard, { type: "clickFind" }>;
type QuizCard = Extract<ClientCard, { type: "quiz" }>;
type VideoCard = Extract<ClientCard, { type: "video" }>;
type InfoCard = Extract<ClientCard, { type: "info" }>;
export type PlacementCard = Extract<ClientCard, { type: "match" | "fill" }>;

const letters = "ABCD";
const pointIcons: LucideIcon[] = [X, Search, Flag, Check];

/** İlk bilgi kartındaki oltalama çizimi (Egitim-Masaustu). Renkler temadan. */
function HookIllustration() {
  return (
    <div aria-hidden="true" className="flex justify-center py-1.5">
      <svg width="260" height="190" viewBox="0 0 260 190" className="max-w-full">
        <circle cx="130" cy="105" r="80" className="fill-accent/7" />
        <g className="origin-[130px_0] [animation:bob_4s_ease-in-out_infinite]">
          <path d="M130 0 V92" className="stroke-fg-3" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M130 92 v14 a10 10 0 1 1 -14 -9" fill="none" className="stroke-warning" strokeWidth="4" strokeLinecap="round" />
          <g transform="translate(78 100)">
            <rect x="0" y="0" width="104" height="70" rx="10" className="fill-surface stroke-accent" strokeWidth="2.5" />
            <path d="M2 6l50 34 50-34" fill="none" className="stroke-accent" strokeWidth="2.5" strokeLinejoin="round" />
            <rect x="62" y="44" width="30" height="14" rx="4" className="fill-danger" />
            <path d="M68 51h18" className="stroke-on-danger" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </g>
        <circle cx="46" cy="60" r="4" className="fill-accent [animation:breathe_8s_ease-in-out_infinite]" />
        <circle cx="214" cy="150" r="5" className="fill-accent [animation:breathe_8s_ease-in-out_-3s_infinite]" />
      </svg>
    </div>
  );
}

/**
 * Bilgi kartı. list düzeni başlıklı maddeleri alt alta gösterir (maddenin ikonu yazılmışsa o,
 * yoksa sıradaki); diğer düzenler (keşfet, adım adım, banka kartı) InfoLayouts.tsx'te ve hepsi
 * açılmadan Devam yoktur (`seen`).
 */
export function InfoCardView({ card, first, seen, onSeen }: { card: InfoCard; first: boolean; seen: number[]; onSeen: (point: number) => void }) {
  const t = getMessages().lab.training;
  if (card.layout === "explore") return <ExploreInfo card={card} seen={seen} onSeen={onSeen} />;
  if (card.layout === "steps") return <StepsInfo card={card} seen={seen} onSeen={onSeen} />;
  if (card.layout === "bankCard") return <BankCardInfo card={card} seen={seen} onSeen={onSeen} />;
  return (
    <>
      <CardTag>{t.tags.info}</CardTag>
      {first && card.points.length === 0 ? <HookIllustration /> : null}
      <CardTitle>{card.title}</CardTitle>
      {card.paragraphs.map((p) => (
        <p key={p} className="text-base leading-relaxed text-fg-2 lg:text-lg">
          <RichLine text={p} />
        </p>
      ))}
      {card.points.length > 0 ? (
        <ol className="flex flex-col gap-2.5">
          {card.points.map((point, i) => {
            const Icon = point.icon ? cardIconMap[point.icon] : (pointIcons[i] ?? Check);
            return (
              <li
                key={point.title}
                className="flex items-start gap-3.5 rounded-[14px] border border-card bg-surface-deep p-3.5 [animation:rise_.4s_ease-out_both]"
                style={{ animationDelay: `${0.1 + i * 0.12}s` }}
              >
                <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-accent/12">
                  <Icon className="size-[22px] text-accent-fg" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-[3px]">
                  <span className="text-base font-bold">{point.title}</span>
                  <span className="text-[15px] leading-normal text-fg-3">{point.text}</span>
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </>
  );
}

/** Tıkla-bul mailinin seçilebilir bir parçası (gönderen, adres, konu, paragraf, düğme, alt satır). */
function MailPart({
  id,
  spot,
  onPick,
  block,
  className,
  children,
}: {
  id: string;
  spot: Spot | null | undefined;
  onPick: (part: string) => void;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const t = getMessages().lab.training;
  return (
    <button
      type="button"
      aria-pressed={spot ? true : undefined}
      data-part={id}
      onClick={(event) => {
        event.stopPropagation();
        onPick(id);
      }}
      className={cn(
        "relative -mx-[3px] cursor-pointer rounded-md px-[3px] py-px text-left transition-[box-shadow,background-color] duration-200 hover:bg-scene-amber-soft",
        block ? "block w-[calc(100%+6px)]" : "inline",
        spot && "bg-scene-red-soft shadow-[0_0_0_2px_var(--scene-red)] hover:bg-scene-red-soft",
        className,
      )}
    >
      {children}
      {spot ? (
        <span className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full bg-scene-red text-xs font-bold text-scene-white [animation:pop_.25s_ease-out_both]">
          <span aria-hidden="true">{spot.index + 1}</span>
          <span className="sr-only">{format(t.spotFound, { n: spot.index + 1 })}</span>
        </span>
      ) : null}
    </button>
  );
}

/**
 * Tıkla-bul: mailin her parçası seçilebilir; hangisinin şüpheli olduğunu sürücü söyler (doğrular
 * tarayıcıda yok). Bulunan parça kırmızı halkayla ve sırasıyla işaretlenir, açıklaması altta çıkar.
 */
export function ClickFindView({
  card,
  found,
  onPick,
  onHint,
}: {
  card: ClickFindCard;
  /** Bakılan parçalar: şüpheliyse Spot, değilse null. */
  found: Record<string, Spot | null>;
  onPick: (part: string) => Promise<Spot | null | undefined>;
  /** "İpucu al" (Murat, 3 Kasım): n. ipucu; sınır ve ceza yok. Önizlemede de çalışır. */
  onHint?: (n: number) => Promise<string | null | undefined>;
}) {
  const t = getMessages().lab.training;
  const [miss, setMiss] = useState(false);
  const [hint, setHint] = useState<{ n: number; text: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const pending = useRef(new Set<string>());
  const spots = Object.values(found).filter((s): s is Spot => s !== null);
  const all = card.spotCount > 0 && spots.length >= card.spotCount;
  const mail = card.mail;

  async function check(part: string) {
    if (part in found) {
      setMiss(found[part] === null);
      return;
    }
    if (pending.current.has(part)) return;
    pending.current.add(part);
    const spot = await onPick(part);
    pending.current.delete(part);
    if (spot !== undefined) setMiss(spot === null);
  }

  async function askHint() {
    if (!onHint || asking) return;
    const n = hint ? hint.n + 1 : 0;
    setAsking(true);
    const text = await onHint(n);
    setAsking(false);
    if (text) setHint({ n, text });
  }

  const part = (id: string, children: ReactNode, options?: { block?: boolean; className?: string }) => (
    <MailPart id={id} spot={found[id]} onPick={(part) => void check(part)} block={options?.block} className={options?.className}>
      {children}
    </MailPart>
  );

  return (
    <>
      <CardTag>{t.tags.clickFind}</CardTag>
      <div className="flex items-start justify-between gap-3">
        <CardTitle>{card.title}</CardTitle>
        <span
          role="status"
          className={cn(
            "inline-flex h-8 flex-none items-center rounded-full border px-3 font-mono text-sm font-bold",
            all ? "border-success bg-success/12 text-success-fg" : "border-line bg-surface text-fg",
          )}
        >
          {format(t.progress, { n: spots.length, total: card.spotCount })}
        </span>
      </div>
      <div className="-mt-1.5 flex flex-wrap items-center justify-between gap-2.5">
        <p className="text-[15px] text-fg-3">{card.hint || t.findHint}</p>
        {onHint && !all ? (
          <button
            type="button"
            onClick={() => void askHint()}
            disabled={asking}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-warning/50 bg-warning/10 px-3.5 text-sm font-bold text-warning-fg transition-colors hover:bg-warning/18 disabled:opacity-60"
          >
            <Lightbulb className="size-4" strokeWidth={2.4} aria-hidden="true" />
            {hint ? t.hint.again : t.hint.ask}
          </button>
        ) : null}
      </div>
      {hint && !all ? (
        <p role="status" key={hint.n} className="flex w-full items-start gap-2.5 self-stretch rounded-[14px] border border-warning/45 bg-warning/8 px-3.5 py-3 text-[15px] leading-normal text-fg [animation:pop_.25s_ease-out_both]">
          <Lightbulb className="mt-0.5 size-[18px] flex-none text-warning-fg" strokeWidth={2.2} aria-hidden="true" />
          <span>
            <b className="text-warning-fg">{format(t.hint.label, { n: hint.n + 1 })}</b> {hint.text}
          </span>
        </p>
      ) : null}

      <div
        onClick={() => setMiss(true)}
        className="overflow-hidden rounded-[14px] border border-scene-line-strong bg-scene-white font-sans text-scene-ink"
      >
        <div className="flex items-center border-b border-scene-line bg-scene-paper px-3 py-2">
          <PostamLogo className="text-sm" />
        </div>
        <div className="flex flex-col gap-3 p-4 lg:p-[18px]">
          {mail.subject ? (
            <div className="text-[17px] font-bold lg:text-[19px]">
              {part("subject", mail.subject)}
            </div>
          ) : null}
          <div className="flex items-start gap-2.5">
            <SenderAvatar name={mail.sender} index={0} className="size-[34px] text-sm" />
            <div className="flex min-w-0 flex-col gap-0.5 text-[13px]">
              <span className="break-words">
                <b className="mr-1 text-sm">{part("sender", mail.sender)}</b>
                <span className="text-scene-ink-3">{part("address", format(getMessages().lab.inbox.address, { address: mail.address }))}</span>
              </span>
              <span className="text-scene-ink-muted">{format(t.to, { time: mail.time })}</span>
            </div>
          </div>
          {mail.paragraphs.map((p, i) => (
            <div key={i} className="text-[15px] leading-relaxed text-scene-body">
              {part(`p${i}`, <RichLine text={p} />, { block: true })}
            </div>
          ))}
          {mail.button ? (
            <div>
              {part(
                "button",
                <span className="inline-flex h-10 items-center rounded-lg bg-scene-blue px-[18px] text-[15px] font-bold text-scene-white">{mail.button}</span>,
                { className: "inline-flex" },
              )}
            </div>
          ) : null}
          {mail.footer ? (
            <div className="text-xs text-scene-ink-muted">
              {part("footer", mail.footer)}
            </div>
          ) : null}
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2.5">
        {all ? (
          <p className="flex items-center gap-2 text-[15px] font-bold text-success-fg [animation:pop_.25s_ease-out_both]">
            <CircleCheck className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
            {t.allFound}
          </p>
        ) : miss ? (
          <p className="text-sm text-warning-fg [animation:pop_.25s_ease-out_both]">{t.miss}</p>
        ) : null}
        {spots.length > 0 ? (
          <ol className="flex flex-col gap-2.5">
            {[...spots]
              .sort((a, b) => a.index - b.index)
              .map((spot) => (
                <li key={spot.index} className="flex items-start gap-2.5 text-sm leading-normal text-fg-2 [animation:pop_.25s_ease-out_both]">
                  <span aria-hidden="true" className="flex size-[22px] flex-none items-center justify-center rounded-full bg-danger text-xs font-bold text-on-danger">
                    {spot.index + 1}
                  </span>
                  {spot.text}
                </li>
              ))}
          </ol>
        ) : null}
      </div>
    </>
  );
}

/** Doğru şıkkın rozetinden saçılan noktalar (Tur 7). */
const burst: { x: number; y: number; color: string }[] = [
  { x: -26, y: -22, color: "bg-success" },
  { x: 24, y: -26, color: "bg-warning" },
  { x: 30, y: 8, color: "bg-accent" },
  { x: -30, y: 10, color: "bg-pink" },
  { x: 0, y: -32, color: "bg-purple" },
  { x: 4, y: 30, color: "bg-success" },
  { x: -20, y: 26, color: "bg-warning" },
  { x: 22, y: 24, color: "bg-accent" },
];

/**
 * Şıklar (Tur 7): sırayla yükselir, masaüstünde ikişer yan yana. Cevaplanınca doğru yeşil (doğru
 * seçildiyse rozetinden noktalar saçılır, seçilmediyse rozeti nabız gibi atar), yanlış seçilen
 * kırmızı ve sarsılır, diğerleri soluk.
 */
function Options({ options, answer, onAnswer, busy }: { options: string[]; answer: Answer | null; onAnswer: (option: number) => void; busy: boolean }) {
  const t = getMessages().lab.training;
  const done = answer !== null;
  return (
    <div className="grid gap-3 lg:grid-cols-2" role="group" aria-label={t.answers}>
      {options.map((option, i) => {
        const isRight = done && i === answer.result.answer;
        const isPicked = done && i === answer.option;
        const wrongPick = isPicked && !isRight;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={isPicked}
            disabled={done || busy}
            onClick={() => onAnswer(i)}
            className={cn(
              "flex min-h-16 w-full cursor-pointer items-center gap-3.5 rounded-2xl border px-3.5 py-3 text-left text-base leading-snug font-bold text-fg transition-[transform,background-color,border-color,opacity] duration-200 disabled:cursor-default lg:min-h-[76px]",
              isRight ? "border-2 border-success bg-success/10" : wrongPick ? "border-2 border-danger bg-danger/10 [animation:shake_.4s_ease-in-out]" : "border-line bg-surface-deep",
              done && !isRight && !isPicked && "opacity-45",
              !done && "[animation:rise_.4s_ease-out_both] hover:-translate-y-0.5 hover:border-accent/60",
            )}
            style={!done ? { animationDelay: `${0.08 + i * 0.09}s` } : undefined}
          >
            <span
              className={cn(
                "relative flex size-10 flex-none items-center justify-center rounded-xl font-heading text-lg font-bold",
                isRight ? "bg-success text-on-accent" : wrongPick ? "bg-danger text-on-danger" : "bg-card text-fg-2",
                isRight && !isPicked && "[--pulse:var(--success)] [animation:pulse-ring_1.2s_ease-out_3]",
              )}
            >
              {isRight ? (
                <>
                  <Check className="size-[22px] [animation:pop_.25s_ease-out_both]" strokeWidth={3} aria-hidden="true" />
                  {isPicked
                    ? burst.map((b, n) => (
                        <span
                          key={n}
                          aria-hidden="true"
                          className={cn("absolute top-4 left-4 size-[7px] rounded-full [animation:burst_.7s_ease-out_both] motion-reduce:hidden", b.color)}
                          style={{ "--bx": `${b.x}px`, "--by": `${b.y}px` } as CSSProperties}
                        />
                      ))
                    : null}
                </>
              ) : wrongPick ? (
                <X className="size-[22px] [animation:pop_.25s_ease-out_both]" strokeWidth={3} aria-hidden="true" />
              ) : (
                letters[i]
              )}
              {isRight || wrongPick ? <span className="sr-only">{letters[i]}</span> : null}
            </span>
            <span className="flex-1">{option}</span>
          </button>
        );
      })}
    </div>
  );
}

function Feedback({ answer }: { answer: Answer }) {
  const t = getMessages().lab.training;
  const { correct, answer: right, explain } = answer.result;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3.5 [animation:rise_.4s_ease-out_both]",
        correct ? "border-success/50 bg-success/8" : "border-danger/55 bg-danger/8",
      )}
    >
      <Mark tone={correct ? "bg-success" : "bg-danger"} className="size-9">
        <Lightbulb className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
      </Mark>
      <span className="flex flex-col gap-1">
        <b className={correct ? "text-success-fg" : "text-danger-fg"}>{correct ? t.correct : format(t.wrong, { letter: letters[right] })}</b>
        {explain ? <span className="text-[15px] leading-relaxed text-fg-2">{explain}</span> : null}
      </span>
    </div>
  );
}

export function QuizView({ card, answer, busy, onAnswer }: { card: QuizCard; answer: Answer | null; busy: boolean; onAnswer: (option: number) => void }) {
  const t = getMessages().lab.training;
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <CardTag>{t.tags.quiz}</CardTag>
        {!answer ? <span className="text-[13px] font-bold text-fg-3">{t.quiz.pick}</span> : null}
      </div>
      {card.art ? <QuizArtView art={card.art} /> : null}
      <CardTitle>{card.question}</CardTitle>
      <Options options={card.options} answer={answer} busy={busy} onAnswer={onAnswer} />
      {answer ? <Feedback answer={answer} /> : null}
    </>
  );
}

const noSubscribe = () => () => undefined;

/**
 * Video kartı: video sitenin kendi dosyasıdır. Sorunun saniyesine gelince durur, soru videonun
 * üstünde sorulur; cevaptan sonra devam eder. Video açılmazsa soru videonun altında sorulur.
 *
 * Tam ekran (Murat, 3 Kasım): tarayıcının kendi tam ekranı yalnızca <video>'yu büyütür, soru
 * dışarıda kalıp görünmezdi. Bu yüzden tam ekranı videonun kutusuna uygulayan kendi düğmemiz var
 * (soru tam ekranda da videonun üstünde açılır); tarayıcının düğmesi kapalıdır (controlsList).
 * Düğmesini gizlemeyen tarayıcıda (ya da iPhone'un kendi oynatıcısında) video yine tek başına tam
 * ekrana geçerse, soru saniyesinde tam ekrandan çıkılır ki soru görünsün.
 */
export function VideoView({ card, answer, busy, onAnswer }: { card: VideoCard; answer: Answer | null; busy: boolean; onAnswer: (option: number) => void }) {
  const t = getMessages().lab.training;
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [asking, setAsking] = useState(false);
  const [broken, setBroken] = useState(!card.src);
  const [full, setFull] = useState(false);
  // iPhone'da kutuyu tam ekran yapmak yok: düğme görünmez (sunucuda da görünmez).
  const canFull = useSyncExternalStore(noSubscribe, () => Boolean(document.fullscreenEnabled), () => false);
  const question = card.question;

  useEffect(() => {
    const el = box.current;
    const sync = () => setFull(el !== null && document.fullscreenElement === el);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      if (el && document.fullscreenElement === el) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  function toggleFull() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void box.current?.requestFullscreen().catch(() => undefined);
  }

  function onTime() {
    const v = video.current;
    if (!v || !question || answer || asking) return;
    if (v.currentTime >= question.at) {
      v.pause();
      // Video kendi başına tam ekrandaysa soru görünmez: önce oradan çık.
      if (document.fullscreenElement === v) void document.exitFullscreen().catch(() => undefined);
      const webkit = v as HTMLVideoElement & { webkitDisplayingFullscreen?: boolean; webkitExitFullscreen?: () => void };
      if (webkit.webkitDisplayingFullscreen) webkit.webkitExitFullscreen?.();
      setAsking(true);
    }
  }

  function resume() {
    setAsking(false);
    void video.current?.play().catch(() => undefined);
  }

  return (
    <>
      <CardTag>{card.duration ? format(t.tags.videoDuration, { duration: card.duration }) : t.tags.video}</CardTag>
      <CardTitle>{card.title}</CardTitle>
      {!broken ? (
        <div
          ref={box}
          data-testid="video-box"
          className={cn("relative overflow-hidden border-line bg-surface-deep", full ? "flex items-center justify-center bg-canvas" : "rounded-2xl border")}
        >
          <video
            ref={video}
            src={card.src}
            controls={!asking}
            controlsList="nofullscreen"
            disablePictureInPicture
            preload="metadata"
            playsInline
            onTimeUpdate={onTime}
            onError={() => setBroken(true)}
            className={cn("video-own-fullscreen w-full bg-surface-deep", full ? "h-full object-contain" : "aspect-video")}
          />
          {canFull ? (
            <button
              type="button"
              onClick={toggleFull}
              aria-label={full ? t.video.exitFull : t.video.full}
              title={full ? t.video.exitFull : t.video.full}
              className="absolute top-2.5 right-2.5 z-10 flex size-10 cursor-pointer items-center justify-center rounded-xl border border-line-strong bg-canvas/80 text-fg backdrop-blur-sm transition-colors hover:bg-card"
            >
              {full ? <Minimize className="size-[18px]" strokeWidth={2.2} aria-hidden="true" /> : <Maximize className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />}
            </button>
          ) : null}
          {asking && question ? (
            // Telefonda video alçak kalır (16:9): soru videonun altında açılır. Masaüstünde ve tam
            // ekranda videonun üstünü örter; uzun soru taşarsa iç kutu (m-auto) üstten kesilmeden kayar.
            <div
              className={cn(
                "flex flex-col [animation:pop_.25s_ease-out_both]",
                full ? "absolute inset-0 overflow-y-auto bg-canvas/90" : "border-t border-line bg-card lg:absolute lg:inset-0 lg:overflow-y-auto lg:border-0 lg:bg-canvas/90",
              )}
            >
              <div className="m-auto flex flex-col items-center gap-3.5 p-3.5 text-center">
                <span className="text-xs font-bold tracking-[0.8px] text-warning-fg">{t.video.kicker}</span>
                <p className={cn("font-heading text-lg leading-tight font-bold lg:text-[22px]", full && "text-[22px] lg:text-[28px]")}>{question.question}</p>
                {answer ? (
                  <div className="flex flex-col items-center gap-2.5">
                    <Feedback answer={answer} />
                    <button
                      type="button"
                      onClick={resume}
                      className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-accent px-[18px] text-[15px] font-bold text-on-accent"
                    >
                      <Play className="size-4" strokeWidth={2.4} aria-hidden="true" />
                      {t.video.resume}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-2.5">
                    {question.options.map((option, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={busy}
                        onClick={() => onAnswer(i)}
                        className="min-h-11 cursor-pointer rounded-xl border border-line-strong bg-card px-[18px] py-2 text-[15px] font-bold text-fg disabled:opacity-60"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-[14px] border border-dashed border-line px-4 py-3 text-sm text-fg-3">{t.video.noVideo}</p>
      )}
      {broken && question ? (
        <>
          <p className="font-heading text-xl font-bold">{question.question}</p>
          <Options options={question.options} answer={answer} busy={busy} onAnswer={onAnswer} />
          {answer ? <Feedback answer={answer} /> : null}
        </>
      ) : null}
    </>
  );
}

/** Kartın yer sayısı: eşleştirmede soldaki satırlar, boşluk doldurmada boşluklar. */
export function slotCount(card: PlacementCard) {
  return card.type === "match" ? card.lefts.length : card.sentences.reduce((n, texts) => n + texts.length - 1, 0);
}
