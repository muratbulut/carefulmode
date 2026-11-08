"use client";

import { Mic, Phone, PhoneOff, Video, Volume2, VolumeX } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { readMuted, writeMuted } from "../sound";
import type { CallerLook, CardIcon } from "@/lib/lab/content";
import { CallerAvatar } from "./CallerAvatar";
import { afterPointsMs, MissionPoints } from "./MissionPoints";
import { startRing } from "./tones";

/** Bir altyazı satırının ekranda kalma süresi: kelime başına 120 ms belirme, sonra 1,6 sn okuma. */
const wordMs = 120;
const holdMs = 1600;
/** Sesli satırda: ses bitince sonraki satıra geçmeden önceki kısa ara. */
const afterVoiceMs = 300;
/** Bitiş aramalarında telefon kendiliğinden açılır. */
const autoAnswerMs = 2200;
const confettiCount = 48;
const space = " ";

export type CallSheet = {
  kicker: string;
  title: string;
  points?: string[];
  /** Maddelerin ikonları (aynı sırayla), isteğe bağlı. */
  pointIcons?: (CardIcon | null)[];
  button: string;
  onButton: () => void;
  /** İyi bitişte koyu düğme (kabul düğmesinden ayrılsın). */
  alt?: boolean;
  busy?: boolean;
};

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Görevli odanın görüntülü araması (Para Çarşısı, 2 Kasım): oynatıcı kararır, telefonun arkasında
 * yumuşak bir sahne ışığı yanar (3 Kasım, 9B) ve telefon titreyerek çalar; ışık çalarken nabız gibi
 * atar. Açılışta öğrenci "Aç"a basar (Reddet'e basarsa arayan tekrar arar), bitişlerde telefon kendiliğinden açılır. Arayan altyazıyla konuşur; satırlar
 * bitince telefonun altından kart çıkar. "Geç" konuşmayı atlar. Kötü bitişte ışık kırmızıdır ve ekran
 * sarsılır; iyi bitişte konfeti. "Hareketi azalt" açıksa titreme, sarsıntı, ışığın nabzı ve konfeti
 * yok, altyazı satırı bütün olarak görünür.
 *
 * Satırın sesi varsa (voice, aynı sırayla) ses çalar, altyazı kelimeleri sesin süresine yayılır ve
 * sonraki satıra ses bitince geçilir. Ses kapalıysa ("Sesi kapat", alarmla aynı ayar), çalamazsa ya da
 * satırın sesi yoksa altyazı kendi süresiyle geçer; oda sessiz de aynen oynanır.
 */
export function MissionCall({
  caller,
  look = "mother",
  lines,
  voice = [],
  tone = "warm",
  autoAnswer = false,
  confetti = false,
  shake = false,
  sheet,
  onLinesDone,
}: {
  caller: string;
  /** Arayanın çizimi: anne ya da baba. */
  look?: CallerLook;
  lines: string[];
  /** Satırların sesi, aynı sırayla (yoksa null). */
  voice?: (string | null)[];
  tone?: "warm" | "red";
  /** Bitiş aramaları: telefon kısa bir çalmadan sonra kendiliğinden açılır. */
  autoAnswer?: boolean;
  confetti?: boolean;
  shake?: boolean;
  /** Konuşma bitince çıkan kart; yoksa onLinesDone çağrılır. */
  sheet?: CallSheet;
  onLinesDone?: () => void;
}) {
  const t = getMessages().lab.call;
  const [live, setLive] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [line, setLine] = useState(-1);
  const [words, setWords] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [reduce] = useState(reducedMotion);
  const [muted, setMuted] = useState(readMuted);
  // Sesi çalamayan satır (dosya yok, tarayıcı izin vermedi): o satır altyazıyla geçer.
  const [silentLine, setSilentLine] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [wordStep, setWordStep] = useState(wordMs);
  const answerButton = useRef<HTMLButtonElement>(null);
  const sheetButton = useRef<HTMLButtonElement>(null);
  const finished = useEffectEvent(() => onLinesDone?.());
  const red = tone === "red";
  const done = live && line >= lines.length;
  const src = live && !muted && line >= 0 && line < lines.length && silentLine !== line ? (voice[line] ?? null) : null;

  // Bitiş aramaları kendiliğinden açılır; açılışta "Aç" düğmesi odaklanır.
  useEffect(() => {
    if (!autoAnswer) {
      answerButton.current?.focus({ preventScroll: true });
      return;
    }
    const timer = window.setTimeout(() => setLive(true), reduce ? 400 : autoAnswerMs);
    return () => window.clearTimeout(timer);
  }, [autoAnswer, reduce]);

  // Telefon çalarken zil sesi (ses kapalıysa yok); açılınca susar.
  useEffect(() => {
    if (live || muted) return;
    return startRing();
  }, [live, muted]);

  // Satır sesleri önceden yüklenir: satır başlar başlamaz konuşma da başlasın.
  const voiceKey = voice.filter(Boolean).join("\n");
  useEffect(() => {
    if (!voiceKey) return;
    const preload = voiceKey.split("\n").map((src) => {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = src;
      return audio;
    });
    return () => preload.forEach((a) => a.removeAttribute("src"));
  }, [voiceKey]);

  // Görüşme süresi.
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [live]);

  // Satırın sesi: çalar, altyazının hızını sesin süresine göre ayarlar, bitince sonraki satıra geçer.
  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    const count = lines[line].split(/\s+/).length;
    let next = 0;
    const silent = () => setSilentLine(line);
    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration)) setWordStep(Math.min(400, Math.max(80, (audio.duration * 900) / count)));
    });
    audio.addEventListener("playing", () => setPlaying(true));
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("error", silent);
    audio.addEventListener("ended", () => {
      setPlaying(false);
      next = window.setTimeout(() => {
        setLine((l) => l + 1);
        setWords(0);
        setWordStep(wordMs);
      }, afterVoiceMs);
    });
    audio.play().catch(silent);
    return () => {
      window.clearTimeout(next);
      audio.pause();
      audio.removeAttribute("src");
      setPlaying(false);
    };
  }, [src, line, lines]);

  // Altyazılar: satır satır, kelime kelime (hareketi azalt açıksa satır bütün).
  useEffect(() => {
    if (!live || done) return;
    if (line < 0) {
      const timer = window.setTimeout(() => setLine(0), 500);
      return () => window.clearTimeout(timer);
    }
    if (line >= lines.length) return;
    const count = lines[line].split(/\s+/).length;
    // İlk kelime satırla birlikte görünür, kalanlar sırayla.
    if (!reduce && words < count - 1) {
      const timer = window.setTimeout(() => setWords((w) => w + 1), src ? wordStep : wordMs);
      return () => window.clearTimeout(timer);
    }
    // Sesli satırda sonraki satıra ses bitince geçilir (yukarıdaki etki).
    if (src) return;
    const timer = window.setTimeout(
      () => {
        setLine((l) => l + 1);
        setWords(0);
      },
      holdMs + (reduce ? count * wordMs : 0),
    );
    return () => window.clearTimeout(timer);
  }, [live, done, line, words, lines, reduce, src, wordStep]);

  useEffect(() => {
    if (!done) return;
    if (sheet) sheetButton.current?.focus({ preventScroll: true });
    else finished();
  }, [done, sheet]);

  function skip() {
    setLive(true);
    setLine(lines.length);
  }

  function toggleMute() {
    setMuted((m) => {
      writeMuted(!m);
      return !m;
    });
  }

  const current = line >= 0 && line < lines.length ? lines[line].split(/\s+/) : [];
  const talking = live && !done && current.length > 0 && (src ? playing : reduce || words < current.length - 1);
  const light = red ? "var(--call-light-red)" : "var(--call-light)";
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div role="dialog" aria-modal="true" aria-label={format(t.dialog, { caller })} className="fixed inset-0 z-[65] overflow-hidden" data-testid="mission-call">
      {/* Karanlık oda ve telefonun arkasındaki yumuşak sahne ışığı (3 Kasım, 9B): tavan lambası ve ışık
          konisi yok; kenarları dağılan yuvarlak ışık, telefon çalarken nabız gibi atar. */}
      <div aria-hidden="true" className={cn("absolute inset-0 [animation:fade-in_.5s_ease-out_both]", red ? "bg-call-dark-red" : "bg-call-dark")} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center [animation:fade-in_1s_ease-out_.25s_both]">
        <div
          data-testid="call-glow"
          className={cn("aspect-square w-[min(760px,150vw)] shrink-0 rounded-full", !live && "[animation:call-glow_1.2s_ease-in-out_1.2s_infinite]")}
          style={{
            background: `radial-gradient(circle, ${light} 0%, color-mix(in srgb, ${light} 45%, transparent) 38%, transparent 68%)`,
          }}
        />
      </div>

      <button
        type="button"
        onClick={skip}
        hidden={done}
        className="absolute top-3 right-3 z-[3] min-h-10 cursor-pointer rounded-full border border-call-glass bg-call-glass px-4 text-sm font-bold text-call-text"
      >
        {t.skip}
      </button>

      {/* Zil ve arayanın sesi için tek düğme (alarmla aynı ayar). */}
      {!done ? (
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={muted}
          className="absolute top-3 left-3 z-[3] inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-call-glass bg-call-glass px-3.5 text-sm font-bold text-call-text"
        >
          {muted ? <VolumeX className="size-[18px]" strokeWidth={2} aria-hidden="true" /> : <Volume2 className="size-[18px]" strokeWidth={2} aria-hidden="true" />}
          <span className="max-lg:sr-only">{muted ? t.unmute : t.mute}</span>
        </button>
      ) : null}

      {confetti && done && !reduce ? <Confetti /> : null}

      <div className="relative z-[2] flex h-full items-center justify-center px-4 py-6">
        {/* Telefon */}
        <div
          className={cn(
            "relative h-[min(620px,calc(100dvh-48px))] w-[min(300px,calc(100vw-32px))] rounded-[46px] bg-call-phone p-2.5 shadow-[0_0_0_2px_var(--call-phone-edge),0_40px_80px_rgb(0_0_0/0.7)] [animation:fade-up_.6s_cubic-bezier(.2,.9,.3,1.15)_.2s_both]",
            !live && "[animation:call-buzz_.9s_infinite_.9s]",
            shake && live && "[animation:hk-shake_.4s_ease-out_.3s_2]",
          )}
        >
          <div className="relative h-full overflow-hidden rounded-[37px] bg-call-screen text-call-text">
            <span aria-hidden="true" className="absolute top-2 left-1/2 z-[5] h-7 w-24 -translate-x-1/2 rounded-full bg-call-ink" />
            <span aria-hidden="true" className="absolute inset-x-0 top-0 z-[4] flex h-11 items-center justify-between px-6 text-[13px] font-medium">
              <span>{t.time}</span>
            </span>

            {/* Gelen arama */}
            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center bg-[radial-gradient(120%_70%_at_50%_0%,var(--call-screen-3),var(--call-screen-2)_60%,var(--call-screen))] px-5 pt-24 pb-11 transition-opacity duration-400",
                live && "pointer-events-none opacity-0",
              )}
              aria-hidden={live || undefined}
            >
              <span className="text-[13px] text-call-muted">{declined ? format(t.again, { caller }) : autoAnswer ? format(t.calling, { caller }) : t.incoming}</span>
              <span className="mt-1 text-[32px] font-medium">{caller}</span>
              <span className="relative mt-8 size-28 rounded-full bg-call-avatar-bg text-call-ink">
                {[0, 0.9].map((delay) => (
                  <span
                    key={delay}
                    aria-hidden="true"
                    className="absolute -inset-3 rounded-full border-[1.5px] border-call-muted opacity-0 [animation:call-wave_1.8s_ease-out_infinite]"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
                <CallerAvatar look={look} talking={false} crop="face" className="size-full rounded-full" />
              </span>
              {autoAnswer ? null : (
                <div className="mt-auto flex w-full justify-between px-3.5">
                  <button type="button" onClick={() => setDeclined(true)} className="flex cursor-pointer flex-col items-center gap-2 text-xs text-call-text">
                    <span className="flex size-16 items-center justify-center rounded-full bg-call-decline transition-transform hover:scale-105">
                      <PhoneOff className="size-7" strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    {t.decline}
                  </button>
                  <button
                    ref={answerButton}
                    type="button"
                    onClick={() => setLive(true)}
                    className="flex cursor-pointer flex-col items-center gap-2 text-xs text-call-text"
                  >
                    <span className="flex size-16 items-center justify-center rounded-full bg-call-accept transition-transform [animation:call-pulse_1.2s_infinite] hover:scale-105">
                      <Video className="size-7" strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    {t.accept}
                  </button>
                </div>
              )}
            </div>

            {/* Görüntülü görüşme */}
            <div className={cn("absolute inset-0 flex flex-col transition-opacity duration-500", live ? "opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!live || undefined}>
              <div className="absolute inset-0 flex items-end justify-center bg-[linear-gradient(160deg,var(--call-avatar-bg),color-mix(in_srgb,var(--call-avatar-bg)_70%,var(--call-screen-2)))] text-call-ink">
                {live ? <CallerAvatar look={look} talking={talking} mood={red ? "worried" : "happy"} crop="call" className="absolute bottom-0 left-1/2 h-[80%] w-auto max-w-none -translate-x-1/2" /> : null}
              </div>
              <div className="relative z-[2] mt-12 text-center text-call-ink">
                <div className="text-[17px] font-bold">{caller}</div>
                <div className="font-mono text-xs">{clock}</div>
              </div>
              <p aria-live="polite" className="absolute inset-x-3.5 bottom-28 z-[3] min-h-11 text-center text-[15px] leading-snug font-bold">
                {current.length > 0 ? (
                  <span className="rounded-lg bg-call-sub box-decoration-clone px-2 py-0.5">
                    {current.map((word, i) => (
                      <span key={i} className={cn("transition-opacity duration-150", reduce || i <= words ? "opacity-100" : "opacity-0")}>
                        {i > 0 ? space : null}
                        {word}
                      </span>
                    ))}
                  </span>
                ) : null}
              </p>
              <div aria-hidden="true" className="absolute inset-x-0 bottom-7 z-[3] flex justify-center gap-3.5">
                <span className="flex size-12 items-center justify-center rounded-full bg-call-glass backdrop-blur-sm">
                  <Mic className="size-5" strokeWidth={2.2} />
                </span>
                <span className="flex size-12 items-center justify-center rounded-full bg-call-glass backdrop-blur-sm">
                  <Video className="size-5" strokeWidth={2.2} />
                </span>
                <span className="flex size-12 items-center justify-center rounded-full bg-call-decline">
                  <Phone className="size-5 rotate-[135deg]" strokeWidth={2.2} />
                </span>
              </div>
            </div>

            {/* Telefonun altından çıkan kart */}
            {done && sheet ? (
              <div className="absolute inset-x-2 bottom-2 z-[6] rounded-[28px] bg-call-sheet px-4 pt-4 pb-3.5 text-call-sheet-ink [animation:slide-up_.55s_cubic-bezier(.2,.9,.3,1.1)_both]">
                <span aria-hidden="true" className="mx-auto mb-2.5 block h-1 w-10 rounded-full bg-call-sheet-muted/40" />
                <span className="text-[11px] font-bold tracking-[1.2px] text-call-cta uppercase">{sheet.kicker}</span>
                <h2 className="mt-0.5 mb-2 font-heading text-[19px] leading-tight font-bold">{sheet.title}</h2>
                {sheet.points && sheet.points.length > 0 ? <MissionPoints points={sheet.points} icons={sheet.pointIcons} tone="sheet" stagger /> : null}
                <button
                  ref={sheetButton}
                  type="button"
                  disabled={sheet.busy}
                  onClick={sheet.onButton}
                  style={sheet.points?.length ? { animationDelay: `${afterPointsMs(sheet.points.length)}ms` } : undefined}
                  className={cn(
                    "mt-3 block min-h-[50px] w-full cursor-pointer rounded-2xl font-heading text-base font-bold text-call-text transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-60",
                    sheet.points?.length && "[animation:fade-in_.35s_ease-out_both]",
                    sheet.alt
                      ? "bg-call-sheet-ink hover:bg-call-cta hover:shadow-[0_10px_22px_color-mix(in_srgb,var(--call-cta)_35%,transparent)]"
                      : "bg-call-cta hover:bg-call-cta-hover hover:shadow-[0_10px_22px_color-mix(in_srgb,var(--call-cta-hover)_35%,transparent)]",
                  )}
                >
                  {sheet.button}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** İyi bitişte düşen konfeti (yalnızca hareketi azalt kapalıyken çizilir). Yerleri kararlı. */
function Confetti() {
  const colors = ["bg-call-confetti-1", "bg-call-confetti-2", "bg-call-confetti-3", "bg-call-confetti-4", "bg-call-confetti-5"];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[4] overflow-hidden">
      {Array.from({ length: confettiCount }, (_, i) => (
        <i
          key={i}
          className={cn("absolute -top-3 h-3 w-2 rounded-[2px] [animation:confetti-fall_2.6s_linear_forwards]", colors[i % colors.length])}
          style={{ left: `${(i * 37) % 100}%`, animationDelay: `${((i * 13) % 80) / 100}s` }}
        />
      ))}
    </div>
  );
}
