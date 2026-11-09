"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useRevealSelected } from "@/components/common/ScrollStrip";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ScreenLabel, StudentPhone, TeacherScreen } from "./TourScreens";
import { useReducedMotion } from "./useReducedMotion";

/** Bir adımın ekranda kalma süresi (tahtadaki gibi 4,2 sn). */
export const tourStepMs = 4200;

/** Bölüm ekranda değilse adımlar boşuna ilerlemesin. */
function useInView(ref: RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver !== "function") return;
    // Telefonda bölüm ekrandan uzundur; bölümün %25'i hiç sığmayabilir. Ekranın (ya da bölümün,
    // hangisi kısaysa) dörtte biri görünüyorsa ekranda sayılır.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || !entry.boundingClientRect || !entry.intersectionRect) return setInView(entry.isIntersecting);
        const need = Math.min(entry.boundingClientRect.height, entry.rootBounds?.height ?? window.innerHeight) * 0.25;
        setInView(entry.intersectionRect.height >= need);
      },
      { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.75, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

/**
 * "İki ekran, bir ders" (Tur 3, T4): solda öğretmenin ekranı, sağda öğrencinin telefonu; dört adım
 * kendiliğinden sırayla oynar. Bir adıma dokununca ya da Durdur'a basınca durur. "Hareketi azalt"
 * açıksa kendiliğinden ilerlemez; adımlar elle gezilir (istenirse Oynat ile başlatılır).
 */
export function LessonTour() {
  const t = getMessages().teachersPage.tour;
  const count = t.items.length;
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  // null: kullanıcı henüz seçmedi; "Hareketi azalt" kapalıysa oynar.
  const [paused, setPaused] = useState<boolean | null>(null);
  const playing = paused === null ? !reduced : !paused;
  const section = useRef<HTMLElement>(null);
  const inView = useInView(section);
  const running = playing && inView;
  const headingId = useId();
  // Telefonda adımlar yana kaydırılan şeritte: oynayan adım ekranın dışında kalmasın.
  const stepStrip = useRevealSelected<HTMLDivElement>(step);

  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setStep((s) => (s + 1) % count), tourStepMs);
    return () => window.clearTimeout(timer);
  }, [running, step, count]);

  function go(next: number) {
    setStep((next + count) % count);
    setPaused(true);
  }

  return (
    <section ref={section} aria-labelledby={headingId} data-tour-step={step} data-tour-playing={running} className="flex flex-col gap-4 lg:gap-5">
      <div className="flex flex-col gap-2.5 lg:items-center lg:text-center">
        <h2 id={headingId} className="m-0 font-heading text-[26px] leading-[1.15] font-bold tracking-[-0.5px] lg:text-4xl">
          {t.heading}
        </h2>
        <p className="m-0 max-w-[640px] text-[15px] leading-[1.6] text-fg-2 lg:text-[17px]">{reduced ? t.leadStill : t.lead}</p>
      </div>

      <div ref={stepStrip} role="group" aria-label={t.steps} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:gap-3 lg:overflow-visible lg:px-0 lg:pb-0">
        {t.items.map((item, i) => {
          const active = i === step;
          return (
            <button
              key={item.title}
              type="button"
              aria-pressed={active}
              onClick={() => go(i)}
              className={cn(
                "flex min-w-[200px] flex-[1_1_0] cursor-pointer flex-col gap-1.5 rounded-[14px] border px-3.5 py-3 text-left font-[inherit] text-fg transition-colors lg:min-w-0",
                active ? "border-accent bg-surface" : "border-line bg-transparent hover:border-line-strong",
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 flex-none items-center justify-center rounded-full text-xs font-bold transition-colors",
                    i <= step ? "bg-accent text-on-accent" : "bg-card text-fg-3",
                  )}
                >
                  {i + 1}
                </span>
                <b className="text-sm">{item.title}</b>
              </span>
              <span className="text-xs leading-[1.45] text-fg-3">{item.text}</span>
              <span className="h-[3px] overflow-hidden rounded-full bg-card" aria-hidden="true">
                <span
                  className={cn(
                    "block h-full origin-left bg-accent",
                    i > step && "scale-x-0",
                    active && running && "animate-[bar-in_4.2s_linear_both]",
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div role="group" aria-label={t.controls} className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => go(step - 1)} aria-label={t.prev} className={controlClass}>
          <ChevronLeft className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setPaused(playing)} className={cn(controlClass, "w-auto gap-1.5 px-3.5 text-sm font-bold")}>
          {playing ? <Pause className="size-4" strokeWidth={2.2} aria-hidden="true" /> : <Play className="size-4" strokeWidth={2.2} aria-hidden="true" />}
          {playing ? t.pause : t.play}
        </button>
        <button type="button" onClick={() => go(step + 1)} aria-label={t.next} className={controlClass}>
          <ChevronRight className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* Çizimler örnektir; anlattıkları adım düğmelerinde yazılı olduğu için ekran okuyucudan gizli. */}
      <div
        aria-hidden="true"
        className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-14 lg:rounded-[28px] lg:border lg:border-card lg:bg-surface-deep lg:bg-[radial-gradient(60%_80%_at_30%_0%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_60%)] lg:p-9"
      >
        <div className="flex flex-col gap-2.5">
          <ScreenLabel>{t.teacherScreen}</ScreenLabel>
          <TeacherScreen step={step} />
        </div>
        <div className="flex flex-col gap-2.5 lg:items-center">
          <ScreenLabel>{t.studentPhone}</ScreenLabel>
          <div className="flex justify-center">
            <StudentPhone step={step} />
          </div>
        </div>
      </div>
    </section>
  );
}

const controlClass =
  "inline-flex size-10 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface font-[inherit] text-fg transition-colors hover:border-line-strong";
