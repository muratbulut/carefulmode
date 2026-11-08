import Link from "next/link";
import { ArrowRight, CalendarDays, Copy, Plus, Presentation } from "lucide-react";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { format, getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { percent } from "@/lib/classroom/teacher-rules";
import { cn } from "@/lib/utils";
import { levelName } from "./client";
import type { ClassCardView } from "./types";

/**
 * Sınıf kartı (Siniflarim-Son, C1): ad, düzey ve öğrenci sayısı, kopyalanan kod, açık ödev ve
 * tamamlanma, bu hafta biten lab, son hareket; "Sınıfa git" ve küçük "Tahtaya yansıt".
 * `readOnly`: yönetimin "Öğretmenin gözünden" bakışı; kod, sınıfa bağlantı ve yansıtma yok.
 */
export function ClassCard({
  card,
  onCopy,
  onProject,
  readOnly = false,
}: {
  card: ClassCardView;
  onCopy: () => void;
  onProject: () => void;
  readOnly?: boolean;
}) {
  const t = getMessages().classroom;
  const tone = card.homework ? toneOf(card.homework.color) : null;
  const level = levelName(card.level, t);
  return (
    <article
      aria-label={card.name}
      className="relative flex flex-col gap-3.5 overflow-hidden rounded-[20px] border border-line bg-surface p-[18px] [animation:fade-up_.3s_ease-out_both]"
    >
      {tone ? <span aria-hidden="true" className={cn("pointer-events-none absolute -top-20 -right-16 size-56 rounded-full blur-3xl", tone.glow)} /> : null}
      <div className="relative flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 font-heading text-[22px] leading-tight font-bold break-words">{card.name}</h3>
            {card.isNew ? (
              <span className="rounded-full bg-success px-[7px] py-0.5 text-[10px] font-bold text-on-accent">{t.newBadge}</span>
            ) : null}
          </span>
          <span className="text-[13px] text-fg-3">
            {level ? format(t.levelAndCount, { level, count: card.students }) : format(t.studentCount, { count: card.students })}
          </span>
        </div>
        {readOnly ? null : (
          <button
            type="button"
            onClick={onCopy}
            aria-label={format(t.copyCodeOf, { name: card.name, code: card.code })}
            className="relative inline-flex h-[34px] flex-none cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-line bg-surface-deep px-3 font-mono text-sm font-bold tracking-[2px] text-fg after:absolute after:-inset-x-px after:-inset-y-1"
          >
            {card.code}
            <Copy className="size-[15px] text-fg-4" strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="relative flex flex-col gap-2">
        <span className="flex items-center justify-between gap-2">
          {card.homework && tone ? (
            <>
              <span className={cn("inline-flex h-[26px] min-w-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold", tone.soft, tone.text)}>
                <span aria-hidden="true" className={cn("size-[7px] flex-none rounded-full", tone.fill)} />
                <span className="truncate">{card.homework.name}</span>
              </span>
              <b className="flex-none text-sm" aria-label={format(t.finishedLabel, { done: card.homework.finished, total: card.students })}>
                {format(t.finishedOf, { done: card.homework.finished, total: card.students })}
              </b>
            </>
          ) : (
            <span className="text-xs text-fg-4">{t.noHomework}</span>
          )}
        </span>
        {card.homework && tone ? (
          <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-card">
            <span className={cn("block h-full rounded-full", tone.fill)} style={{ width: `${percent(card.homework.finished, card.students)}%` }} />
          </span>
        ) : null}
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-3">
          {card.homework?.due ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-[13px] text-fg-4" strokeWidth={2} aria-hidden="true" />
              {card.homework.due}
            </span>
          ) : null}
          <span>{format(t.thisWeek, { count: card.week })}</span>
          <span>{card.last ? format(t.last, { time: card.last }) : t.lastNone}</span>
        </span>
      </div>

      {card.students === 0 ? <p className="relative m-0 text-[13px] leading-normal text-fg-2">{t.emptyClassHint}</p> : null}

      {readOnly ? (
        <span className="relative mt-auto flex h-[42px] items-center justify-center rounded-xl border border-dashed border-line text-sm font-bold text-fg-4">
          {t.openClass}
        </span>
      ) : (
        <div className="relative mt-auto flex items-center gap-2">
          <Link
            href={paths.classroom(card.id)}
            className="flex h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-card text-sm font-bold text-fg no-underline hover:border-accent"
          >
            {t.openClass}
            <ArrowRight className="size-[15px] text-accent-fg" strokeWidth={2} aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={onProject}
            aria-label={format(t.projectOf, { name: card.name })}
            className="flex size-[42px] flex-none cursor-pointer items-center justify-center rounded-xl border border-line text-fg-2 hover:border-accent hover:text-fg"
          >
            <Presentation className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  );
}

/** "Yeni sınıf oluştur" kartı: kesikli çerçeve, ortada artı. */
export function NewClassCard({ onClick }: { onClick: () => void }) {
  const t = getMessages().classroom;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[20px] border-2 border-dashed border-line bg-transparent text-[15px] font-bold text-fg-3 hover:border-accent hover:text-fg lg:min-h-[260px]"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-card">
        <Plus className="size-[22px] text-accent-fg" strokeWidth={2.4} aria-hidden="true" />
      </span>
      {t.newClassCard}
    </button>
  );
}
