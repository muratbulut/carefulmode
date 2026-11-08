import { Check, FlaskConical, GraduationCap, TriangleAlert, User, Users, type LucideIcon } from "lucide-react";
import { brand, LogoMark } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { SchoolBulletin } from "./types";

type Tone = "success" | "accent" | "purple" | "warning";

const toneClass: Record<Tone, string> = {
  success: "bg-success/12 text-success-fg",
  accent: "bg-accent/12 text-accent-fg",
  purple: "bg-purple/12 text-purple-fg",
  warning: "bg-warning/12 text-warning-fg",
};

function NumberBox({ Icon, tone, value, label }: { Icon: LucideIcon; tone: Tone; value: number; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[20px] border border-line bg-surface p-3 lg:p-[18px] print:rounded-xl">
      <span aria-hidden="true" className={cn("flex size-9 flex-none items-center justify-center rounded-xl lg:size-11", toneClass[tone])}>
        <Icon className="size-[18px] lg:size-5" strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-[22px] leading-[1.1] font-bold lg:text-[28px]">{value}</span>
        <span className="text-xs text-fg-3">{label}</span>
      </span>
    </div>
  );
}

function Sentence({ Icon, tone, children }: { Icon: LucideIcon; tone: Tone; children: string }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className={cn("flex size-[34px] flex-none items-center justify-center rounded-[10px]", toneClass[tone])}>
        <Icon className="size-[17px]" strokeWidth={2} />
      </span>
      <span className="pt-[5px] text-[15px] leading-[1.6] text-fg lg:text-base">{children}</span>
    </li>
  );
}

const trendClass = { up: "text-success-fg", down: "text-warning-fg", same: "text-fg-3" } as const;

/**
 * Haftalık okul bülteni (Okulum-O4-Bulten): başlık, 4 sayı kutusu, kendiliğinden yazılan 4 cümle
 * ve son 5 haftanın grafiği. Öğrenci adı ve puan yoktur. "PDF olarak indir" yalnızca bu kartı yazdırır.
 */
export function BulletinCard({ bulletin, schoolName }: { bulletin: SchoolBulletin; schoolName: string }) {
  const t = getMessages().school.bulletin;
  const max = Math.max(1, ...bulletin.chart.map((w) => w.count));
  const chartLabel = format(t.chartLabel, {
    n: bulletin.chart.length,
    list: bulletin.chart.map((w) => format(t.chartItem, { week: w.label, n: w.count })).join(", "),
  });

  return (
    <article
      aria-labelledby="bulletin-title"
      className="flex flex-col gap-4 rounded-[22px] border border-line bg-[linear-gradient(180deg,var(--surface),var(--surface-raised))] p-5 shadow-card lg:gap-[22px] lg:p-9 print:border-line print:bg-none print:p-6 print:shadow-none"
    >
      <header className="flex items-start justify-between gap-3 border-b border-dashed border-line pb-3.5 lg:pb-[18px]">
        <span className="flex flex-col gap-1">
          <span className="font-mono text-[11px] tracking-[2px] text-accent-light">{format(t.heading, { week: bulletin.week })}</span>
          <b id="bulletin-title" className="font-heading text-[22px] leading-[1.15] lg:text-[30px]">
            {schoolName}
          </b>
          <span className="text-[13px] text-fg-3">{format(t.meta, { range: bulletin.range, name: bulletin.preparedBy })}</span>
        </span>
        <LogoMark className="h-7 w-auto flex-none" />
      </header>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <NumberBox Icon={GraduationCap} tone="success" value={bulletin.counts.teachers} label={t.counts.teachers} />
        <NumberBox Icon={Users} tone="accent" value={bulletin.counts.classes} label={t.counts.classes} />
        <NumberBox Icon={User} tone="purple" value={bulletin.counts.students} label={t.counts.students} />
        <NumberBox Icon={Check} tone="warning" value={bulletin.counts.weekDone} label={t.counts.weekDone} />
      </div>

      <ul className="m-0 flex list-none flex-col gap-4 p-0 lg:gap-[22px]">
        <Sentence Icon={Check} tone="success">
          {bulletin.sentences.labs}
        </Sentence>
        <Sentence Icon={FlaskConical} tone="accent">
          {bulletin.sentences.homework}
        </Sentence>
        <Sentence Icon={TriangleAlert} tone="warning">
          {bulletin.sentences.teachers}
        </Sentence>
        <Sentence Icon={GraduationCap} tone="purple">
          {bulletin.sentences.requests}
        </Sentence>
      </ul>

      <section aria-labelledby="bulletin-chart" className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 lg:p-5 print:break-inside-avoid">
        <span className="flex items-baseline justify-between gap-2">
          <b id="bulletin-chart" className="text-base">
            {t.chartTitle}
          </b>
          <span className={cn("text-[13px] font-bold", trendClass[bulletin.trend.tone])}>{bulletin.trend.text}</span>
        </span>
        <div role="img" aria-label={chartLabel} className="flex h-[130px] gap-2.5 lg:h-[150px]">
          {bulletin.chart.map((w) => (
            <div key={w.label} className="flex h-full flex-1 flex-col items-center gap-1.5">
              <span className={cn("text-xs font-bold", w.current ? "text-fg" : "text-fg-3")}>{w.count}</span>
              <span className="flex w-full flex-1 items-end">
                <span
                  className={cn("block w-full rounded-t-lg rounded-b-[3px] print:border print:border-line", w.current ? "bg-accent" : "bg-line")}
                  style={{ height: `${Math.max(4, Math.round((w.count / max) * 100))}%` }}
                />
              </span>
              <span className="text-[11px] whitespace-nowrap text-fg-4">{w.label}</span>
            </div>
          ))}
        </div>
        <span className="text-xs text-fg-4">{t.chartNote}</span>
      </section>
      <span className="text-xs leading-normal text-fg-4">{format(t.footnote, { brand: brand.name })}</span>
    </article>
  );
}
