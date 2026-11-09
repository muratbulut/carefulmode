import type { CSSProperties, ReactNode } from "react";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ScrollDots } from "./ScrollDots";

const t = getMessages().landing.steps;

/** Arbitrary animasyonları okunur tutmak için küçük yardımcı. */
const anim = (value: string): CSSProperties => ({ animation: value });

function PreviewFrame({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-card bg-surface-deep">{children}</div>;
}

/** Adım 1: üst üste duran eğitim kartları sırayla çevrilir. */
function CardsPreview() {
  const cards = [
    { n: 1, text: "text-accent-fg", dot: "bg-accent", delay: "0s" },
    { n: 2, text: "text-warning-fg", dot: "bg-warning", delay: "-3s" },
    { n: 3, text: "text-success-fg", dot: "bg-success", delay: "-6s" },
  ];
  return (
    <PreviewFrame>
      <div className="relative flex h-32 items-end justify-center pb-3.5">
        {cards.map((card) => (
          <div
            key={card.n}
            style={anim(`card-cycle 9s ease-in-out ${card.delay} infinite`)}
            className={cn(
              "absolute bottom-[30px] flex h-[84px] w-[150px] flex-col gap-1.5 rounded-xl border bg-surface px-3 py-2.5",
              card.n === 1 ? "border-accent" : "border-line",
            )}
          >
            <div className={cn("flex items-center gap-1.5 text-[10px] font-bold", card.text)}>
              <span className={cn("size-3.5 rounded opacity-30", card.dot)} />
              {format(t.card, { n: card.n })}
            </div>
            <div className="h-[5px] w-[92%] rounded-full bg-line" />
            <div className="h-[5px] w-[70%] rounded-full bg-line" />
            <div className="mt-0.5 flex gap-1.5">
              <span className="h-3.5 flex-1 rounded-[5px] border border-line bg-card" style={anim(`option-pick 9s ${card.delay} infinite`)} />
              <span className="h-3.5 flex-1 rounded-[5px] border border-line bg-card" />
            </div>
          </div>
        ))}
        <div className="flex gap-1.5">
          {["-6.1s", "-3.1s", "-0.1s"].map((delay) => (
            <span key={delay} className="h-1 w-[22px] rounded-full bg-line" style={anim(`page-dot 9s ${delay} infinite`)} />
          ))}
        </div>
      </div>
    </PreviewFrame>
  );
}

function Row({ dot, long, short }: { dot: string; long: string; short: string }) {
  return (
    <>
      <span className={cn("size-3.5 flex-none rounded-full", dot)} />
      <span className="flex flex-1 flex-col gap-[3px]">
        <span className="h-1 rounded-full bg-fg-2" style={{ width: short }} />
        <span className="h-1 rounded-full bg-line" style={{ width: long }} />
      </span>
    </>
  );
}

/** Adım 2: küçük Postam; şüpheli mail seçilir, bildirilir, kutudan kalkar. */
function LabPreview() {
  return (
    <PreviewFrame>
      <div className="relative h-32 p-3">
        <div className="flex h-[104px] flex-col overflow-hidden rounded-[10px] border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-card px-2 py-[5px] text-[9px] font-bold text-fg-3">
            <span>{t.mailApp}</span>
            <span className="rounded-[5px] bg-danger px-1.5 py-0.5 text-on-danger" style={anim("report-press 9s infinite")}>
              {t.report}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 overflow-hidden px-2 py-1.5"
            style={anim("row-select 9s infinite, row-remove 9s infinite")}
          >
            <Row dot="bg-scene-yellow" short="60%" long="85%" />
            <span
              className="flex size-3.5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-on-danger"
              style={anim("alert-pop 9s infinite")}
            >
              !
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <Row dot="bg-success" short="50%" long="75%" />
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <Row dot="bg-indigo" short="40%" long="65%" />
          </div>
        </div>
        <div
          className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-[7px] border border-success bg-success-subtle px-2 py-[3px] text-[10px] font-bold whitespace-nowrap text-success-subtle-fg"
          style={anim("mini-toast 9s infinite")}
        >
          {t.reported}
        </div>
        <svg
          className="absolute top-0 left-0 size-[18px]"
          style={{ ...anim("cursor 9s ease-in-out infinite"), fill: "var(--fg)", stroke: "var(--canvas)" }}
          viewBox="0 0 24 24"
          strokeWidth="1.5"
        >
          <path d="M5 3l14 7-6 2-2 6z" />
        </svg>
      </div>
    </PreviewFrame>
  );
}

/** Adım 3: rapor; puan halkası dolar, işaretler tek tek gelir. */
function ReportPreview() {
  const bars = [
    { mark: "✓", text: "text-success-fg", fill: "bg-success", n: 1, width: "90%" },
    { mark: "✓", text: "text-success-fg", fill: "bg-success", n: 2, width: "70%" },
    { mark: "!", text: "text-warning-fg", fill: "bg-warning", n: 3, width: "40%" },
  ];
  return (
    <PreviewFrame>
      <div className="flex h-32 items-center justify-center gap-3.5 p-3.5">
        <div className="relative size-[70px]">
          <svg className="size-[70px] -rotate-90" viewBox="0 0 70 70">
            <circle cx="35" cy="35" r="28" fill="none" strokeWidth="7" style={{ stroke: "var(--line)" }} />
            <circle
              cx="35"
              cy="35"
              r="28"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray="176"
              strokeDashoffset="35"
              style={{ stroke: "var(--accent)", ...anim("report-ring 9s ease-in-out infinite") }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none" style={anim("report-score 9s infinite")}>
            <span className="font-heading text-base font-bold">{t.score}</span>
            <span className="text-[9px] font-bold text-fg-3">{t.outOf}</span>
          </div>
        </div>
        <div className="flex max-w-[120px] flex-1 flex-col gap-2">
          {bars.map((bar) => (
            <div key={bar.n} className="flex items-center gap-1.5">
              <span className={cn("w-2.5 text-[11px] font-bold", bar.text)} style={anim(`tick-${bar.n} 9s infinite`)}>
                {bar.mark}
              </span>
              <div className="h-1.5 flex-1 rounded-full bg-card">
                <div className={cn("h-full rounded-full", bar.fill)} style={{ width: bar.width, ...anim(`bar-${bar.n} 9s ease-out infinite`) }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PreviewFrame>
  );
}

// Metinler sözlükte aynı sırayla (t.items).
const steps = [
  { no: "01", Preview: CardsPreview, delay: "0s" },
  { no: "02", Preview: LabPreview, delay: "3s" },
  { no: "03", Preview: ReportPreview, delay: "6s" },
].map((step, i) => ({ ...step, ...t.items[i] }));

/**
 * Üç adım kartı (Tema H). Masaüstünde yan yana; telefonda yana kaydırılır.
 * Kartlar 9 saniyelik döngüde sırayla öne çıkar.
 */
export function Steps() {
  return (
    <section aria-labelledby="steps-heading" className="relative mx-auto max-w-[1200px] px-4 pt-2 pb-6 lg:p-6">
      <div className="mb-3.5 flex flex-col gap-1.5 lg:sr-only">
        <h2 id="steps-heading" className="m-0 font-heading text-2xl font-bold">
          {t.heading}
        </h2>
        <p className="m-0 text-sm text-fg-3 lg:hidden">{t.swipeHint}</p>
      </div>
      <ol
        id="step-cards"
        className="no-scrollbar -mx-4 m-0 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-2 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-[18px] lg:overflow-visible lg:p-0"
      >
        {steps.map(({ no, title, text, Preview, delay }) => (
          <li
            key={no}
            data-step
            className="flex flex-[0_0_280px] snap-start flex-col gap-3.5 rounded-[18px] border border-line bg-surface-translucent p-4"
            style={anim(`spot 9s ease-in-out ${delay} infinite`)}
          >
            <div aria-hidden="true">
              <Preview />
            </div>
            <div className="flex flex-col gap-1">
              <div className="font-mono text-xs text-accent-fg">{format(t.step, { no })}</div>
              <h3 className="m-0 text-lg font-bold">{title}</h3>
              <p className="m-0 text-sm leading-normal text-fg-3">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <ScrollDots target="step-cards" count={steps.length} className="mt-3.5 lg:hidden" />
    </section>
  );
}
