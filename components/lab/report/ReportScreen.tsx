"use client";

import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, GraduationCap, ListChecks, Lock, RotateCw, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import Link from "next/link";
import { Fragment, useRef, useState, type CSSProperties } from "react";
import { reportScale } from "@/lib/lab/content";
import type { ReportView } from "@/lib/lab/report";
import type { ReportStatus } from "@/lib/lab/scoring";
import { format, getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BadgeToast } from "@/components/status/BadgeToast";
import type { BadgeCode } from "@/lib/progress/badges";
import { Mascot, type MascotMood } from "@/components/mascot/Mascot";
import { ReportSteps } from "./ReportSteps";
import { ReportTips } from "./ReportTips";
import { SignsCard } from "./SignsCard";

export type ReportScreenProps = {
  view: ReportView;
  lab: { name: string; title: string; topic: string };
  backHref: string;
  crumbs: { label: string; href?: string }[];
  facts: { duration: string; date: string; tasks: string } | null;
  history: { previous: number | null; best: number; attemptNo: number; bars: { label: string; score: number; current: boolean }[] } | null;
  actions: { next?: { href: string; label: string }; retry: string; training?: string };
  /** Yönetim önizlemesinde "Tekrar dene" sayfayı değil oynatıcıyı sıfırlar. */
  onRetry?: () => void;
  /** Bu denemeyle yeni kazanılan rozetler; rapor ilk açıldığında sağ üstte bildirim olarak çıkar. */
  newBadges?: BadgeCode[];
};

const reportMood: Record<ReportStatus, MascotMood> = { safe: "happy", risky: "suspicious", hacked: "hacked" };

const statusStyle: Record<ReportStatus, { badge: string; ring: string; bar: string; glow: string; Icon: typeof ShieldCheck }> = {
  safe: { badge: "border-success/50 bg-success/12 text-success-fg", ring: "stroke-success", bar: "bg-success", glow: "var(--success)", Icon: ShieldCheck },
  risky: { badge: "border-warning/50 bg-warning/12 text-warning-fg", ring: "stroke-warning", bar: "bg-warning", glow: "var(--warning)", Icon: ShieldAlert },
  hacked: { badge: "border-danger/50 bg-danger/14 text-danger-fg", ring: "stroke-danger", bar: "bg-danger", glow: "var(--danger)", Icon: ShieldX },
};

const primary =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-accent text-[17px] font-bold text-on-accent no-underline hover:brightness-110 cursor-pointer";
const secondary =
  "flex h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-card text-base font-bold text-fg no-underline cursor-pointer";

function ScoreRing({ score, status }: { score: number; status: ReportStatus }) {
  const t = getMessages().lab.report;
  const length = 2 * Math.PI * 88;
  return (
    <div className="relative size-[150px] flex-none lg:size-[196px]" role="img" aria-label={format(t.scoreLabel, { score })}>
      <svg viewBox="0 0 196 196" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="98" cy="98" r="88" fill="none" className="stroke-card" strokeWidth="12" />
        <circle
          cx="98"
          cy="98"
          r="88"
          fill="none"
          className={cn(statusStyle[status].ring, "[animation:ring-draw_1s_ease-out_.15s_both]")}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - Math.max(0, Math.min(reportScale, score)) / reportScale)}
          style={{ "--ring-length": length } as CSSProperties}
        />
      </svg>
      <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-[42px] leading-none font-bold lg:text-[55px]">{score}</span>
        <span className="mt-1 text-xs text-fg-3">{t.outOfPoints}</span>
      </div>
    </div>
  );
}

function diffText(diff: number) {
  const t = getMessages().lab.report;
  return diff > 0 ? format(t.diffUp, { n: diff }) : diff < 0 ? format(t.diffDown, { n: -diff }) : t.diffSame;
}

function PrivateChip() {
  const t = getMessages().lab.report;
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 text-xs font-bold text-accent-light">
      <Lock className="size-3" strokeWidth={2.4} aria-hidden="true" />
      {t.private}
    </span>
  );
}

type JourneyStep = "steps" | "signs" | "tips";

/** Adım şeridi: hangi adımdasın, hangileri bitti. Yalnızca gösterir; ilerlemek "Sonraki" ile. */
function Stepper({ steps, current, caught }: { steps: JourneyStep[]; current: number; caught: boolean }) {
  const t = getMessages().lab.report.journey;
  return (
    <ol aria-label={t.label} className="relative grid gap-0" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li key={step} aria-current={on ? "step" : undefined} className="relative flex flex-col items-center gap-1.5 text-center">
            {i > 0 ? (
              <span aria-hidden="true" className={cn("absolute top-[19px] right-1/2 left-[-50%] h-1 rounded-full", i <= current ? "bg-accent" : "bg-line-strong")} />
            ) : null}
            <span
              className={cn(
                "relative flex size-10 items-center justify-center rounded-full border-2 font-heading font-bold",
                done ? "border-success bg-success/14 text-success-fg" : on ? "border-accent bg-surface text-accent-fg" : "border-line-strong bg-surface text-fg-4",
              )}
            >
              {done ? <Check className="size-[18px]" strokeWidth={2.6} aria-hidden="true" /> : i + 1}
            </span>
            <span className={cn("text-xs font-bold lg:text-sm", on ? "text-fg" : "text-fg-3")}>{step === "signs" && caught ? t.steps.signsCaught : t.steps[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Sonuç raporu (Rapor-Son; 14. revize, 3 Kasım): üstte puan halkası ve durum, altında rapor adım
 * adım okunur. Önce "Odada ne oldu", "Sonraki" ile sahte öğedeki işaretler (kaçırdıysan kaçan
 * puanla), sonra "Bir dahaki sefere" kuralları ve sıradaki adımlar. Üçü aynı anda ekranda olmaz;
 * öğrenciye hiçbir şey yaptırılmaz (dokun, bul, çevir yok), her şey açık gelir. Öğrencinin raporu
 * ve yönetimdeki "Öğrenci gibi dene" aynı ekranı kullanır.
 */
export function ReportScreen({ view, lab, backHref, crumbs, facts, history, actions, onRetry, newBadges }: ReportScreenProps) {
  const t = getMessages().lab.report;
  const [badges, setBadges] = useState<BadgeCode[]>(() => newBadges ?? []);
  const style = statusStyle[view.status];
  const diff = history && history.previous !== null ? view.score - history.previous : null;
  const bold = (chunk: string) => <b className="text-fg">{chunk}</b>;
  const safe = view.status === "safe";
  const steps: JourneyStep[] = view.signs ? ["steps", "signs", "tips"] : ["steps", "tips"];
  const [step, setStep] = useState(0);
  const journey = useRef<HTMLDivElement>(null);
  const last = step === steps.length - 1;
  const fakeRow = view.rows.find((r) => r.kind === "fake" && r.state !== "ok");
  const lost = fakeRow ? fakeRow.max - fakeRow.points : 0;

  function go(next: number) {
    setStep(next);
    // Yeni adımın başına gelinir; başlık odak alır, ekran okuyucu yeni adımı okur.
    requestAnimationFrame(() => {
      const box = journey.current;
      if (!box) return;
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
      box.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    });
  }
  const back =
    step > 0 ? (
      <button type="button" onClick={() => go(step - 1)} className={secondary}>
        <ChevronLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
        {t.journey.back}
      </button>
    ) : null;
  const nav = [
    ...(back ? [back] : []),
    <button key="next" type="button" onClick={() => go(step + 1)} className={primary}>
      {t.journey.next}
      <ArrowRight className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
    </button>,
  ];

  const retry = onRetry ? (
    <button type="button" onClick={onRetry} className={safe ? secondary : primary}>
      <RotateCw className="size-[18px]" strokeWidth={2} aria-hidden="true" />
      {t.actions.retry}
    </button>
  ) : (
    <Link href={actions.retry} className={safe ? secondary : primary}>
      <RotateCw className="size-[18px]" strokeWidth={2} aria-hidden="true" />
      {t.actions.retry}
    </Link>
  );
  const next = actions.next ? (
    <Link href={actions.next.href} className={safe ? primary : secondary}>
      {actions.next.label}
      <ArrowRight className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
    </Link>
  ) : null;
  const buttons = safe && next ? [next, retry] : next ? [retry, next] : [retry];
  const training = actions.training ? (
    <Link href={actions.training} className="inline-flex min-h-11 items-center justify-center gap-2 text-[15px] font-bold text-accent-fg no-underline">
      <GraduationCap className="size-[18px]" strokeWidth={2} aria-hidden="true" />
      {t.actions.training}
    </Link>
  ) : null;

  const factList = facts
    ? [
        { Icon: Clock, label: t.duration, value: facts.duration },
        { Icon: CalendarDays, label: t.date, value: facts.date },
        { Icon: ListChecks, label: t.tasks, value: facts.tasks },
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col" data-testid="lab-report">
      {/* Telefon: üst şerit */}
      <div className="flex flex-none items-center gap-2.5 border-b border-card bg-canvas px-3 py-2.5 lg:hidden">
        <Link href={backHref} aria-label={t.back} className="flex size-11 flex-none items-center justify-center rounded-xl border border-line bg-surface text-fg-2">
          <ArrowLeft className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[11px] font-bold tracking-[0.8px] text-accent-fg">{t.kickerShort}</span>
          <span className="truncate text-sm font-bold">{lab.title || lab.name}</span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-4 pt-5 pb-32 [animation:fade-in_.4s_ease-out_both] lg:px-6 lg:pt-7 lg:pb-14">
        {crumbs.length > 0 ? (
          <nav aria-label={t.crumbLabel} className="hidden flex-wrap items-center gap-2 text-sm text-fg-3 lg:flex">
            {crumbs.map((crumb, i) => (
              <span key={crumb.label} className="inline-flex items-center gap-2">
                {i > 0 ? <ChevronRight className="size-3.5 text-fg-4" aria-hidden="true" /> : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="text-fg-3 no-underline hover:text-fg">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={i === crumbs.length - 1 ? "text-fg" : undefined} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        {/* Özet */}
        <section className="relative flex flex-col items-center gap-4 rounded-3xl border border-line bg-surface p-5 text-center lg:flex-row lg:gap-9 lg:p-8 lg:text-left">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ background: `radial-gradient(ellipse at 15% 0%, color-mix(in srgb, ${style.glow} 13%, transparent), transparent 60%)` }}
          />
          <ScoreRing score={view.score} status={view.status} />
          <div className="relative flex flex-1 flex-col items-center gap-3.5 lg:items-start">
            <div className="flex items-center gap-3">
              <span className={cn("inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold tracking-[0.6px]", style.badge)}>
                <style.Icon className="size-4" strokeWidth={2.2} aria-hidden="true" />
                {t.status[view.status]}
              </span>
              {/* Yeni rozet varken kalp göz, yoksa sonuca göre: güvende mutlu, riskli şüpheli, hacklendi kırmızı. */}
              <Mascot mood={badges.length > 0 ? "love" : reportMood[view.status]} className="h-auto w-[56px] flex-none" />
            </div>
            <h1 className="font-heading text-[28px] leading-[1.12] font-bold lg:text-[40px]">{view.title}</h1>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-[0.8px] text-accent-fg">{format(t.kicker, { topic: lab.topic.toLocaleUpperCase("tr") })}</span>
              <span className="font-bold">
                {lab.title && lab.title !== lab.name
                  ? rich(format(t.labLine, { title: lab.title, name: lab.name }), { muted: (chunk) => <span className="font-medium text-fg-3">{chunk}</span> })
                  : lab.name}
              </span>
            </div>
            {history ? (
              <div className="hidden flex-wrap items-center gap-2.5 text-sm text-fg-3 lg:flex">
                {history.previous !== null && diff !== null ? (
                  <>
                    <span>{rich(format(t.previous, { score: history.previous }), { b: bold })}</span>
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded-lg px-2 font-mono text-[13px] font-bold",
                        diff > 0 ? "bg-success/14 text-success-fg" : diff < 0 ? "bg-danger/14 text-danger-fg" : "bg-card text-fg-3",
                      )}
                    >
                      {diffText(diff)}
                    </span>
                  </>
                ) : (
                  <span>{t.first}</span>
                )}
                {history.attemptNo > 1 ? (
                  <>
                    <span>{format(t.attemptNo, { n: history.attemptNo })}</span>
                    <span>{rich(format(t.best, { score: history.best }), { b: bold })}</span>
                  </>
                ) : null}
                <PrivateChip />
              </div>
            ) : null}

            {/* Telefon: süre, tarih, görev; denemeler */}
            {facts ? (
              <dl className="grid w-full grid-cols-3 gap-2 lg:hidden">
                {factList.map(({ Icon, label, value }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 rounded-xl border border-card bg-surface-deep px-2 py-2.5">
                    <Icon className="size-4 text-fg-3" strokeWidth={2} aria-hidden="true" />
                    <dd className="text-sm font-bold">{value}</dd>
                    <dt className="order-last text-[10px] font-bold tracking-[0.8px] text-fg-4">{label}</dt>
                  </div>
                ))}
              </dl>
            ) : null}
            {history ? (
              <div className="flex w-full flex-col gap-2.5 lg:hidden">
                {history.bars.length > 1 ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-card bg-surface-deep p-3 text-left">
                    <span className="text-[11px] font-bold tracking-[0.8px] text-fg-3">{t.history}</span>
                    <div aria-hidden="true" className="flex h-24 items-end gap-3">
                      {history.bars.map((bar) => (
                        <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                          <span className={cn("font-mono text-xs font-bold", bar.current ? "text-fg" : "text-fg-4")}>{format(t.pointsOf, { points: bar.score, max: reportScale })}</span>
                          <span
                            className={cn("w-full rounded-t-md [animation:rise_.5s_ease-out_both]", bar.current ? style.bar : "bg-line-strong")}
                            style={{ height: `${Math.max(bar.score, 4) * 0.7}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div aria-hidden="true" className="flex gap-3">
                      {history.bars.map((bar) => (
                        <span key={bar.label} className={cn("flex-1 text-center text-xs", bar.current ? "font-bold text-fg" : "text-fg-4")}>
                          {bar.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-fg-3">
                  {diff !== null ? <span>{format(t.diffLabel, { diff: diffText(diff) })}</span> : <span>{t.first}</span>}
                  {history.attemptNo > 1 ? <span>{rich(format(t.bestShort, { score: history.best }), { b: bold })}</span> : null}
                </div>
                <div className="flex justify-center">
                  <PrivateChip />
                </div>
              </div>
            ) : null}
          </div>
          {facts ? (
            <dl className="relative hidden flex-none flex-col gap-4 border-l border-line pl-7 lg:flex">
              {factList.map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-[11px] font-bold tracking-[0.8px] text-fg-4">{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>

        {/* Rapor adım adım: aynı anda tek adım */}
        <div ref={journey} className="flex scroll-mt-4 flex-col gap-5" data-testid="report-journey" data-step={steps[step]}>
          <Stepper steps={steps} current={step} caught={fakeRow === undefined} />
          <div key={steps[step]} className="flex flex-col gap-3.5 [animation:fade-in_.3s_ease-out_both]">
            {steps[step] === "steps" ? (
              <section aria-labelledby="report-steps" className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:justify-between">
                  <h2 id="report-steps" tabIndex={-1} className="font-heading text-[22px] font-bold outline-none lg:text-2xl">
                    {t.stepsTitle}
                  </h2>
                  <span className="text-[13px] text-fg-3 lg:text-sm">{format(view.counts.skip > 0 ? t.summarySkip : t.summary, view.counts)}</span>
                </div>
                <ReportSteps rows={view.rows} />
              </section>
            ) : null}
            {steps[step] === "signs" && view.signs ? (
              <div className="flex flex-col gap-3.5">
                <SignsCard template={view.template} signs={view.signs} />
                {lost > 0 ? (
                  <p className="m-0 flex items-center gap-3 rounded-2xl border border-warning/40 bg-warning/[0.08] px-4 py-3 text-[15px] text-fg-2">
                    {rich(format(t.journey.lost, { n: lost }), { b: (chunk) => <b className="font-heading text-2xl text-warning-fg">{chunk}</b> })}
                    {fakeRow ? <span>{fakeRow.did}</span> : null}
                  </p>
                ) : null}
              </div>
            ) : null}
            {steps[step] === "tips" ? (
              <section aria-labelledby="report-tips" className="flex flex-col gap-3.5">
                <h2 id="report-tips" tabIndex={-1} className="font-heading text-[22px] font-bold outline-none lg:text-2xl">
                  {t.nextTime}
                </h2>
                <ReportTips tips={view.tips} />
              </section>
            ) : null}
          </div>
        </div>

        {/* Masaüstü: düğmeler; telefonda eğitime dön bağlantısı burada, düğmeler altta sabit */}
        {last ? (
          <div className="hidden items-center gap-3 lg:flex">
            {buttons.map((button, i) => (
              <div key={i} className="flex w-60 flex-none">
                {button}
              </div>
            ))}
            {training}
          </div>
        ) : (
          <div className="hidden items-center gap-3 lg:flex">
            {nav.map((button, i) => (
              <div key={i} className="flex w-60 flex-none">
                {button}
              </div>
            ))}
          </div>
        )}
        {training && last ? <div className="flex justify-center lg:hidden">{training}</div> : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 grid auto-cols-fr grid-flow-col gap-2.5 border-t border-card bg-canvas/95 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] lg:hidden">
        {(last ? buttons : nav).map((button, i) => (
          <Fragment key={i}>{button}</Fragment>
        ))}
      </div>
      <BadgeToast codes={badges} onClose={() => setBadges([])} />
    </div>
  );
}
