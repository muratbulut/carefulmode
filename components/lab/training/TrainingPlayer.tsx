"use client";

import { ArrowLeft, ArrowRight, Check, CircleCheck, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ReactNode, type TouchEvent } from "react";
import { BadgeToast } from "@/components/status/BadgeToast";
import { Toast } from "@/components/status/Toast";
import { withNext } from "@/lib/account/shared";
import type { ClientCard } from "@/lib/lab/client";
import { format, getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { BadgeCode } from "@/lib/progress/badges";
import type { Fail, TrainingDriver, Unanswered } from "../driver";
import { ClickFindView, InfoCardView, QuizView, slotCount, VideoView, type Answer, type Placement, type Spot } from "./cards";
import { ViewerAvatar } from "./InfoLayouts";
import { FillView } from "./FillView";
import { MatchView } from "./MatchView";
import { SortView } from "./SortView";

export type TrainingPlayerProps = {
  driver: TrainingDriver;
  title: string;
  cards: ClientCard[];
  /** Kaldığı kart (bitmiş eğitimde 0). */
  startIndex: number;
  /** Üstteki "Mahalleye dön" ve telefondaki kapat. */
  exitHref: string;
  playHref: string;
  /** Bitiş kartında "Açıldı" listesi: mahallenin senaryo labları. */
  scenarios: { title: string; href: string }[];
  roadmapHref: string;
  /** Öğrencinin avatarı (keşfet kartındaki profil); önizlemede yok, genel simge görünür. */
  avatar?: string;
};

const secondary =
  "flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-card text-base font-bold text-fg transition-opacity disabled:cursor-default disabled:opacity-40";
const primary =
  "flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-[17px] font-bold text-on-accent transition-[filter,opacity] hover:brightness-110 disabled:cursor-default disabled:opacity-45 disabled:hover:brightness-100";

/**
 * Eğitim labı oynatıcısı (Egitim-Masaustu, Egitim-Mobil-1..5): bilgi, tıkla-bul, mini test ve
 * video, eşleştirme, kutulara ayırma ve boşluk doldurma kartları, sonda bitiş kartı. Doğru cevaplar tarayıcıda yoktur; öğrenci seçince sürücü
 * (sunucu) söyler. İlerleme her kartta kaydedilir; son karttan sonra eğitim tamamlanır.
 */
export function TrainingPlayer({ driver, title, cards, startIndex, exitHref, playHref, scenarios, roadmapHref, avatar }: TrainingPlayerProps) {
  const t = getMessages().lab.training;
  const [index, setIndex] = useState(Math.max(0, Math.min(startIndex, cards.length)));
  const [spots, setSpots] = useState<Record<string, Record<string, Spot | null>>>({});
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [placements, setPlacements] = useState<Record<string, Placement>>({});
  /** Açılan maddeli bilgi kartlarında (keşfet, adım adım, banka kartı) açılan maddeler. */
  const [seen, setSeen] = useState<Record<string, number[]>>({});
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [badges, setBadges] = useState<BadgeCode[]>([]);
  const furthest = useRef(startIndex);
  const touchX = useRef<number | null>(null);

  const total = cards.length + 1;
  const card = cards[index] ?? null;
  const finished = index >= cards.length;
  const blocked =
    card !== null &&
    (card.type === "match" || card.type === "fill" || card.type === "sort"
      ? !placements[card.id]
      : card.type === "info"
        ? // Bütün maddeler açılmadan geçilmez; daha önce geçilmiş kart (kaldığı yerden devam) açık kalır.
          (card.layout ?? "list") !== "list" && index >= startIndex && (seen[card.id]?.length ?? 0) < card.points.length
        : (card.type === "quiz" || (card.type === "video" && card.question !== null)) && !answers[card.id]);
  // Banka kartı ve dört adımlı kart masaüstünde daha geniş açılır (çizim ve adımlar yan yana).
  const wide = card?.type === "info" && (card.layout === "bankCard" || (card.layout === "steps" && card.points.length >= 4));

  /** Sürücü çağrısı; bağlantı yoksa ya da oturum düştüyse kullanıcıya söyler, sonuç null olur. */
  async function call<T extends { ok: true }>(run: () => Promise<T | Fail | Unanswered>): Promise<T | null> {
    let result: T | Fail | Unanswered;
    try {
      result = await run();
    } catch {
      setToast(getMessages().lab.frame.toasts.offline);
      return null;
    }
    if (result.ok) return result;
    if (result.reason === "unanswered") {
      // Bitirmek için sunucunun cevaplanmış saymadığı bir soru var: öğrenci o karta döner ve
      // soruyu (yeniden) cevaplar; ancak ondan sonra ilerleyebilir.
      const skipped = cards[result.card];
      if (skipped) {
        const without = <V,>(all: Record<string, V>) => {
          const rest = { ...all };
          delete rest[skipped.id];
          return rest;
        };
        setAnswers(without);
        setPlacements(without);
      }
      setToast(t.unanswered);
      go(result.card);
    } else if (result.reason === "auth") window.location.assign(withNext(routes.signIn, playHref));
    else setToast(getMessages().lab.frame.toasts.error);
    return null;
  }

  function go(to: number) {
    setIndex(Math.max(0, Math.min(to, cards.length)));
    window.scrollTo(0, 0);
  }

  async function next() {
    if (blocked || saving || finished) return;
    const to = index + 1;
    if (to >= cards.length) {
      setSaving(true);
      const saved = await call(() => driver.save(cards.length));
      setSaving(false);
      if (!saved) return;
      furthest.current = cards.length;
      if (saved.badges && saved.badges.length > 0) setBadges(saved.badges);
    } else if (to > furthest.current) {
      furthest.current = to;
      void call(() => driver.save(to));
    }
    go(to);
  }

  async function pickSpot(cardId: string, part: string) {
    const result = await call(() => driver.spot(cardId, part));
    if (!result) return undefined;
    setSpots((all) => ({ ...all, [cardId]: { ...all[cardId], [part]: result.spot } }));
    return result.spot;
  }

  async function askHint(cardId: string, n: number) {
    const found = Object.entries(spots[cardId] ?? {})
      .filter(([, spot]) => spot !== null)
      .map(([part]) => part);
    const result = await call(() => driver.hint(cardId, found, n));
    return result ? result.hint : undefined;
  }

  async function answer(cardId: string, option: number) {
    if (busy || answers[cardId]) return;
    setBusy(true);
    const result = await call(() => driver.answer(cardId, option));
    setBusy(false);
    if (result) setAnswers((all) => ({ ...all, [cardId]: { option, result: result.result } }));
  }

  async function place(cardId: string, picks: number[]) {
    if (busy || placements[cardId]) return;
    setBusy(true);
    const result = await call(() => driver.place(cardId, picks));
    setBusy(false);
    if (result) setPlacements((all) => ({ ...all, [cardId]: { picks, result: result.result } }));
  }

  function onTouchStart(event: TouchEvent) {
    touchX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: TouchEvent) {
    if (touchX.current === null) return;
    const dx = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (dx < -60) void next();
    else if (dx > 60 && index > 0) go(index - 1);
  }

  const progress = (
    <>
      <div
        role="progressbar"
        aria-label={t.progressLabel}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        className="grid flex-1 gap-[5px] lg:max-w-[520px]"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1.5 rounded-full transition-colors duration-300", i < index ? "bg-accent" : i === index ? "bg-accent-light" : "bg-card")} />
        ))}
      </div>
      <span className="flex-none font-mono text-sm font-bold text-fg-3">{format(t.progress, { n: index + 1, total })}</span>
    </>
  );

  let body: ReactNode = null;
  if (finished) body = <FinishCard cards={cards} spots={spots} answers={answers} placements={placements} scenarios={scenarios} roadmapHref={roadmapHref} onAgain={() => go(0)} />;
  else if (card?.type === "info")
    body = (
      <InfoCardView
        card={card}
        first={index === 0}
        seen={seen[card.id] ?? []}
        onSeen={(point) => setSeen((all) => ({ ...all, [card.id]: all[card.id]?.includes(point) ? all[card.id] : [...(all[card.id] ?? []), point] }))}
      />
    );
  else if (card?.type === "clickFind")
    body = <ClickFindView card={card} found={spots[card.id] ?? {}} onPick={(part) => pickSpot(card.id, part)} onHint={(n) => askHint(card.id, n)} />;
  else if (card?.type === "quiz") body = <QuizView card={card} answer={answers[card.id] ?? null} busy={busy} onAnswer={(o) => answer(card.id, o)} />;
  else if (card?.type === "video") body = <VideoView card={card} answer={answers[card.id] ?? null} busy={busy} onAnswer={(o) => answer(card.id, o)} />;
  else if (card?.type === "match")
    body = <MatchView key={card.id} card={card} placed={placements[card.id] ?? null} busy={busy} onCheck={(picks) => void place(card.id, picks)} />;
  else if (card?.type === "fill")
    body = <FillView key={card.id} card={card} placed={placements[card.id] ?? null} busy={busy} onCheck={(picks) => void place(card.id, picks)} />;
  else if (card?.type === "sort")
    body = <SortView key={card.id} card={card} placed={placements[card.id] ?? null} busy={busy} onCheck={(picks) => void place(card.id, picks)} />;

  return (
    <ViewerAvatar value={avatar ?? null}>
    <div className="flex flex-1 flex-col" data-testid="training-player">
      {/* Masaüstü şeridi */}
      <div className="hidden border-b border-card bg-surface-deep lg:block">
        <div className="mx-auto flex max-w-[1200px] items-center gap-6 px-6 py-2.5">
          <Link href={exitHref} className="inline-flex min-h-11 flex-none items-center gap-1.5 text-sm font-bold text-accent-fg no-underline">
            <ArrowLeft className="size-4" strokeWidth={2.2} aria-hidden="true" />
            {t.back}
          </Link>
          <span aria-hidden="true" className="h-7 w-px bg-line" />
          <div className="flex min-w-0 flex-none flex-col gap-px">
            <span className="text-[11px] font-bold tracking-[0.8px] text-accent-fg">{t.kicker}</span>
            <span className="truncate font-bold">{title}</span>
          </div>
          <div className="flex flex-1 items-center justify-end gap-4">{progress}</div>
        </div>
      </div>

      {/* Telefon şeridi */}
      <div className="flex items-center gap-3 px-4 py-3 lg:hidden">
        <Link
          href={exitHref}
          aria-label={t.close}
          className="flex size-11 flex-none items-center justify-center rounded-xl border border-line bg-surface text-fg-2"
        >
          <X className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </Link>
        {progress}
      </div>

      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="flex flex-1 flex-col gap-[22px] px-4 pt-2 pb-[110px] lg:px-6 lg:pt-7 lg:pb-8">
        <div className={cn("mx-auto flex w-full flex-col lg:min-h-[600px] lg:rounded-3xl lg:border lg:border-line lg:bg-surface/90 lg:p-9", wide ? "max-w-[940px]" : "max-w-[760px]")}>
          <div key={index} className="flex flex-col gap-4 [animation:fade-up_.3s_ease-out_both] lg:gap-5">
            {body}
          </div>
        </div>

        {/* Gezinme: masaüstünde kartın altında, telefonda ekranın altında sabit */}
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-20 flex gap-2.5 border-t border-card bg-canvas/95 px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] lg:static lg:mx-auto lg:w-full lg:justify-between lg:border-0 lg:bg-transparent lg:p-0",
            wide ? "lg:max-w-[940px]" : "lg:max-w-[760px]",
          )}
        >
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={cn(secondary, "w-14 flex-none lg:w-40")}>
            <ArrowLeft className="size-5" strokeWidth={2.2} aria-hidden="true" />
            <span className="max-lg:sr-only">{t.prev}</span>
          </button>
          {!finished ? (
            <button type="button" onClick={() => void next()} disabled={blocked || saving} className={cn(primary, "flex-1 lg:w-[220px] lg:flex-none")}>
              {index === cards.length - 1 ? t.finishCards : t.next}
              <ArrowRight className="size-5" strokeWidth={2.2} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {blocked ? <p className="sr-only" aria-live="polite">{t.answerFirst}</p> : null}
      </div>

      <Toast message={toast} onClose={() => setToast(null)} className="max-lg:bottom-[96px]" />
      <BadgeToast codes={badges} onClose={() => setBadges([])} />
    </div>
    </ViewerAvatar>
  );
}

/** Bitiş kartı (Egitim-Mobil-5-Bitis): özet, açılan senaryo labları, ilk senaryoya geçiş. */
function FinishCard({
  cards,
  spots,
  answers,
  placements,
  scenarios,
  roadmapHref,
  onAgain,
}: {
  cards: ClientCard[];
  spots: Record<string, Record<string, Spot | null>>;
  answers: Record<string, Answer>;
  placements: Record<string, Placement>;
  scenarios: TrainingPlayerProps["scenarios"];
  roadmapHref: string;
  onAgain: () => void;
}) {
  const t = getMessages().lab.training;
  const f = t.finish;
  const clickFind = cards.filter((c) => c.type === "clickFind");
  const quizzes = cards.filter((c) => c.type === "quiz");
  const videos = cards.filter((c) => c.type === "video" && c.question !== null);
  const correct = (list: ClientCard[]) => list.filter((c) => answers[c.id]?.result.correct).length;
  // Eşleştirme ve boşluk doldurma: doğru yerleştirilen yer sayısı / bütün yerler.
  const placed = (type: "match" | "sort" | "fill") => {
    const list = cards.filter((c) => c.type === type);
    if (list.length === 0) return null;
    return {
      label: f.summary[type],
      n: list.reduce((sum, c) => sum + (placements[c.id]?.result.slots.filter(Boolean).length ?? 0), 0),
      total: list.reduce((sum, c) => sum + (c.type === "match" || c.type === "fill" ? slotCount(c) : c.type === "sort" ? c.items.length : 0), 0),
    };
  };
  const summary = [
    clickFind.length > 0
      ? {
          label: f.summary.clickFind,
          n: clickFind.reduce((sum, c) => sum + Object.values(spots[c.id] ?? {}).filter(Boolean).length, 0),
          total: clickFind.reduce((sum, c) => sum + (c.type === "clickFind" ? c.spotCount : 0), 0),
        }
      : null,
    quizzes.length > 0 ? { label: f.summary.quiz, n: correct(quizzes), total: quizzes.length } : null,
    videos.length > 0 ? { label: f.summary.video, n: correct(videos), total: videos.length } : null,
    placed("match"),
    placed("sort"),
    placed("fill"),
  ].filter((x) => x !== null);

  return (
    <div className="flex flex-col items-center gap-[18px] pt-5 text-center">
      <span className="flex size-24 items-center justify-center rounded-full border border-success/45 bg-success/14 [animation:pop_.3s_ease-out_both]">
        <Check className="size-12 text-success-fg" strokeWidth={2.4} aria-hidden="true" />
      </span>
      <h1 className="font-heading text-[26px] leading-tight font-bold tracking-[-0.4px] lg:text-[32px]">{f.title}</h1>
      <p className="text-base leading-relaxed text-fg-2 lg:text-lg">{scenarios.length > 0 ? f.text : f.none}</p>
      {summary.length > 0 ? (
        <ul className="flex flex-wrap justify-center gap-2">
          {summary.map((s) => (
            <li key={s.label} className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-line bg-surface-deep px-3 text-sm text-fg-2">
              {s.label}
              <b className="font-mono text-fg">{format(t.progress, { n: s.n, total: s.total })}</b>
            </li>
          ))}
        </ul>
      ) : null}
      {scenarios.length > 0 ? (
        <ul className="flex w-full max-w-[460px] flex-col gap-2 text-left">
          {scenarios.map((s, i) => (
            <li
              key={s.href}
              className="flex items-center gap-2.5 rounded-xl border border-card bg-surface-deep px-3 py-2.5 [animation:rise_.4s_ease-out_both]"
              style={{ animationDelay: `${0.5 + i * 0.15}s` }}
            >
              <span className="flex size-7 flex-none items-center justify-center rounded-full bg-success/14">
                <CircleCheck className="size-4 text-success-fg" strokeWidth={2.2} aria-hidden="true" />
              </span>
              <span className="flex-1 text-sm font-bold">{s.title}</span>
              <span className="text-xs font-bold text-success-fg">{f.unlocked}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={scenarios[0]?.href ?? roadmapHref} className={cn(primary, "w-full max-w-[360px] no-underline")}>
        {scenarios.length > 0 ? f.first : f.roadmap}
        <ArrowRight className="size-5" strokeWidth={2.2} aria-hidden="true" />
      </Link>
      <button type="button" onClick={onAgain} className="min-h-11 cursor-pointer text-[15px] font-bold text-accent-fg">
        {f.again}
      </button>
    </div>
  );
}
