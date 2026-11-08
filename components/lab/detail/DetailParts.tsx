import Link from "next/link";
import { Check, ChevronDown, Lock, Mail, MessageCircle, Phone, Play, RotateCcw, ShoppingBag, Star, Store, type LucideIcon } from "lucide-react";
import { ProgressBar, ProgressRing } from "@/components/roadmap/ProgressRing";
import { avatars } from "@/lib/avatars";
import { format, getMessages, rich } from "@/lib/i18n";
import { reportScale } from "@/lib/lab/content";
import { scoreTone } from "@/lib/lab/route";
import { cn } from "@/lib/utils";
import type { LabDetailData } from "./types";

/** Süs: bitiren öğrencileri temsil eden avatarlar (gerçek öğrenci değil, isim yok). */
export function AvatarStack({ size = "md" }: { size?: "sm" | "md" }) {
  const tones = ["bg-warning", "bg-accent", "bg-purple", "bg-success", "bg-pink"];
  return (
    <span aria-hidden="true" className="inline-flex">
      {[avatars[0], avatars[1], avatars[9], avatars[2], avatars[8]].map((avatar, i) => (
        <span
          key={avatar.code}
          className={cn(
            "flex items-center justify-center rounded-full border-[3px] leading-none",
            size === "md" ? "size-[30px] border-canvas text-[17px]" : "size-5 border-surface text-xs",
            i > 0 && (size === "md" ? "-ml-2.5" : "-ml-[7px]"),
            tones[i],
          )}
        >
          {avatar.emoji}
        </span>
      ))}
    </span>
  );
}

/** Dersler (8. revize D): oda bitene kadar başlıkları görünmez, yalnızca kaç ders olduğu. */
export function LockedLearn({ count, className }: { count: number; className?: string }) {
  const t = getMessages().lab.detail;
  return (
    <section className={cn("flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-[18px] lg:p-[22px]", className)}>
      <h2 className="m-0 font-heading text-xl font-bold">{t.learnTitle}</h2>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex items-center gap-2.5 rounded-xl border border-dashed border-line-strong px-3 py-3 text-sm text-fg-4">
            <Lock className="size-4 flex-none" strokeWidth={2.2} aria-hidden="true" />
            <span>{rich(format(t.learnLocked, { n: i + 1 }), { b: (chunk) => <b className="text-fg-2">{chunk}</b> })}</span>
          </li>
        ))}
      </ol>
      <span className="text-[13px] text-fg-4">{t.learnLockedHint}</span>
    </section>
  );
}

/** "Bu odada öğrendiklerin" listesi (oda bitince). */
export function LearnList({ items }: { items: LabDetailData["learn"] }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
      {items.map((item, i) => (
        <li key={item.title} className="flex gap-3">
          <span className="flex size-7 flex-none items-center justify-center rounded-[9px] bg-accent/12 font-mono text-sm font-bold text-accent-fg">{i + 1}</span>
          <span className="flex flex-col gap-[3px]">
            <span className="text-[15px] leading-[1.4] font-bold">{item.title}</span>
            {item.text ? <span className="text-sm leading-normal text-fg-3">{item.text}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Telefonda açılır kapanır "Bu odada öğrendiklerin". */
export function LearnDisclosure({ items }: { items: LabDetailData["learn"] }) {
  const t = getMessages().lab.detail;
  return (
    <details className="group overflow-hidden rounded-[20px] border border-line bg-surface">
      <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-2.5 px-[18px] [&::-webkit-details-marker]:hidden">
        <span className="font-heading text-lg font-bold">{t.learnDone}</span>
        <ChevronDown className="size-5 text-fg-3 transition-transform group-open:rotate-180" strokeWidth={2.2} aria-hidden="true" />
      </summary>
      <div className="px-[18px] pb-[18px]">
        <LearnList items={items} />
      </div>
    </details>
  );
}

type Step = {
  key: string;
  mark: "done" | "current" | "locked";
  title: string;
  text: string;
  short: string;
  bar?: number;
  link?: { href: string; label: string };
};

/** Adımlar: Eğitim → Senaryo → Rapor. */
export function detailSteps(data: LabDetailData): Step[] {
  const t = getMessages().lab.detail;
  const steps: Step[] = [];
  if (data.training) {
    steps.push(
      data.training.done
        ? {
            key: "training",
            mark: "done",
            title: data.training.name,
            text: data.training.doneOn ? format(t.trainingDone, { date: data.training.doneOn }) : t.done,
            short: t.done,
            link: { href: data.training.href, label: t.trainingReview },
          }
        : {
            key: "training",
            mark: "current",
            title: data.training.name,
            text: t.trainingTodo,
            short: t.trainingStart,
            link: { href: data.training.href, label: t.trainingStart },
          },
    );
  }
  if (data.attempt) {
    steps.push({
      key: "scenario",
      mark: "current",
      title: t.scenario,
      text: format(t.scenarioAt, { n: data.attempt.current }),
      short: format(t.taskOf, { n: data.attempt.current, total: data.attempt.total }),
      bar: data.attempt.done / data.attempt.total,
    });
  } else if (data.finishedCount > 0) {
    steps.push({
      key: "scenario",
      mark: "done",
      title: t.scenario,
      text: data.best !== null ? format(t.scenarioDone, { score: data.best }) : t.done,
      short: t.done,
    });
  } else if (data.state === "locked") {
    steps.push({ key: "scenario", mark: "locked", title: t.scenario, text: t.scenarioLocked, short: t.locked });
  } else {
    steps.push({ key: "scenario", mark: "current", title: t.scenario, text: t.scenarioTodo, short: t.scenarioTodo });
  }
  steps.push(
    data.last
      ? { key: "report", mark: "done", title: t.report, text: t.reportReady, short: t.done, link: { href: data.last.href, label: t.openReport } }
      : { key: "report", mark: "locked", title: t.report, text: t.reportLocked, short: t.locked },
  );
  return steps;
}

function StepMark({ mark }: { mark: Step["mark"] }) {
  if (mark === "done") {
    return (
      <span className="flex size-[30px] flex-none items-center justify-center rounded-full bg-success/16">
        <Check className="size-[15px] text-success-fg" strokeWidth={2.6} aria-hidden="true" />
      </span>
    );
  }
  if (mark === "current") {
    return (
      <span className="flex size-[30px] flex-none items-center justify-center rounded-full border-2 border-accent">
        <span className="size-2.5 rounded-full bg-accent anim-breathe-fast" />
      </span>
    );
  }
  return (
    <span className="flex size-[30px] flex-none items-center justify-center rounded-full border border-line">
      <Lock className="size-[13px] text-fg-4" strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

/**
 * Masaüstü: kapağın altında adım yolu (8. revize D): Eğitim → Senaryo → Rapor yan yana, aralarında
 * çizgi. Raporun bağlantısı sağdaki "Önceki denemen" kutusundadır.
 */
export function StepsRoad({ steps }: { steps: Step[] }) {
  const t = getMessages().lab.detail;
  const current = steps.find((s) => s.mark === "current");
  return (
    <ol aria-label={t.stepsTitle} className="m-0 flex list-none items-center gap-4 rounded-[20px] border border-line bg-surface px-[22px] py-4">
      {steps.map((step, i) => (
        <li key={step.key} className="contents">
          <div className="flex min-w-0 flex-[0_1_auto] items-center gap-3" aria-current={step === current ? "step" : undefined}>
            <StepMark mark={step.mark} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={cn("font-bold", step.mark === "locked" ? "text-fg-3" : "text-fg")}>{step.title}</span>
              <span className="text-sm text-fg-3">{step.text}</span>
              {step.bar !== undefined ? <ProgressBar value={step.bar} fillClass="bg-accent" className="mt-1.5 h-1.5 w-[140px]" /> : null}
            </div>
            {step.link && step.key !== "report" ? (
              <Link
                href={step.link.href}
                className="inline-flex h-[34px] flex-none items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 text-[13px] font-bold text-fg no-underline hover:border-accent"
              >
                {step.mark === "done" ? (
                  <RotateCcw className="size-3.5 text-accent-fg" strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <Play className="size-3.5 fill-accent-fg text-accent-fg" strokeWidth={2.2} aria-hidden="true" />
                )}
                {step.link.label}
              </Link>
            ) : null}
          </div>
          {i < steps.length - 1 ? <span aria-hidden="true" className={cn("h-0.5 min-w-8 flex-1", step.mark === "done" ? "bg-success" : "bg-line")} /> : null}
        </li>
      ))}
    </ol>
  );
}

/** Telefon: yan yana üç adım. */
export function StepsRow({ steps }: { steps: Step[] }) {
  const t = getMessages().lab.detail;
  const current = steps.find((s) => s.mark === "current");
  return (
    <ol aria-label={t.stepsTitle} className="m-0 flex list-none items-start p-0">
      {steps.map((step, i) => (
        <li key={step.key} className="contents">
          <div className="flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={step === current ? "step" : undefined}>
            <StepMark mark={step.mark} />
            <span className={cn("text-sm font-bold", step.mark === "locked" ? "text-fg-3" : "text-fg")}>
              {step.key === "training" ? t.trainingStep : step.title}
            </span>
            <span className="text-xs text-fg-3">{step.short}</span>
            {step.link && step.key === "training" && step.mark === "done" ? (
              <Link href={step.link.href} className="-my-1 inline-flex min-h-10 items-center gap-1 text-xs font-bold no-underline">
                <RotateCcw className="size-3" strokeWidth={2.4} aria-hidden="true" />
                {step.link.label}
              </Link>
            ) : null}
          </div>
          {i < steps.length - 1 ? (
            <span aria-hidden="true" className={cn("mt-[15px] h-0.5 flex-[0_0_28px]", step.mark === "done" ? "bg-success" : "bg-line")} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** "Önceki denemen": puan halkası, tarih, kısa not, raporu tekrar gör. */
export function PreviousAttempt({ data, className }: { data: LabDetailData; className?: string }) {
  const t = getMessages().lab.detail;
  const last = data.last;
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="m-0 font-heading text-xl font-bold">{t.previous}</h2>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 text-xs font-bold text-accent-light">
        <Lock className="size-[13px]" strokeWidth={2.2} aria-hidden="true" />
        {t.private}
      </span>
    </div>
  );
  if (!last) {
    return (
      <section className={cn("flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-[22px]", className)}>
        {header}
        <p className="m-0 text-sm leading-normal text-fg-3">{t.previousNone}</p>
      </section>
    );
  }
  const score = last.score ?? 0;
  return (
    <section className={cn("flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-[22px]", className)}>
      {header}
      <div className="flex items-center gap-4">
        <ProgressRing
          value={score / reportScale}
          size={72}
          stroke={7}
          strokeClass={last.status === "hacked" ? "stroke-danger" : scoreTone(score) === "good" ? "stroke-success" : "stroke-warning"}
        >
          <span className="flex flex-col items-center leading-none">
            <span className="font-heading text-xl font-bold">{score}</span>
            <span className="text-[11px] text-fg-3">{t.outOf}</span>
          </span>
        </ProgressRing>
        <div className="flex flex-col gap-1">
          <div className="font-bold">{format(t.previousMeta, { date: last.date ?? "", n: data.finishedCount })}</div>
          <div className="text-sm leading-normal text-fg-3">{last.status === "safe" && score >= reportScale ? t.previousNote.perfect : t.previousNote[last.status]}</div>
        </div>
      </div>
      <Link href={last.href} className="text-sm font-bold">
        {t.openReport}
      </Link>
    </section>
  );
}

const aheadTone = {
  caller: "bg-orange/16 text-orange-fg",
  items: "bg-accent/16 text-accent-fg",
  deal: "bg-purple/16 text-purple-fg",
  points: "bg-warning/16 text-warning-fg",
};

/**
 * "Seni neler bekliyor" (8. revize D): odayı henüz bitirmeyene "Önceki denemen"in boş kutusu yerine
 * odanın tanıtımı. Kim arayacak, hangi uygulamada kaç öğe, hangi mağaza ya da ilan, kaç görev.
 */
export function AheadBox({ data, className }: { data: LabDetailData; className?: string }) {
  const t = getMessages().lab.detail.ahead;
  const { ahead } = data;
  const rows: { key: keyof typeof aheadTone; Icon: LucideIcon; title: string; text: string }[] = [];
  if (ahead.caller) rows.push({ key: "caller", Icon: Phone, title: format(t.caller, { caller: ahead.caller }), text: t.callerText });
  if (ahead.items > 0) {
    rows.push({ key: "items", Icon: data.template === "MESSAGING" ? MessageCircle : Mail, title: format(t.items[data.template], { n: ahead.items }), text: t.itemsText });
  }
  if (ahead.deal) {
    rows.push(
      ahead.deal.kind === "shop"
        ? { key: "deal", Icon: ShoppingBag, title: ahead.deal.name, text: format(t.shopText, { owner: ahead.deal.owner }) }
        : { key: "deal", Icon: Store, title: ahead.deal.name, text: format(t.saleText, { product: ahead.deal.product }) },
    );
  }
  rows.push({ key: "points", Icon: Star, title: ahead.tasks > 0 ? format(t.points, { n: ahead.tasks }) : t.pointsOnly, text: t.pointsText });
  return (
    <section data-testid="detail-ahead" className={cn("flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-[18px] lg:p-[22px]", className)}>
      <h2 className="m-0 font-heading text-xl font-bold">{t.title}</h2>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-3">
            <span aria-hidden="true" className={cn("flex size-11 flex-none items-center justify-center rounded-xl", aheadTone[row.key])}>
              <row.Icon className="size-[22px]" strokeWidth={2} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="text-[15px]">{row.title}</b>
              <span className="text-[13.5px] leading-snug text-fg-3">{row.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
