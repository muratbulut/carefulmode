"use client";

import { format, getMessages } from "@/lib/i18n";
import type { Signal, SetupStep } from "@/lib/school/bulletin-model";
import { cn } from "@/lib/utils";
import type { SchoolTeacher } from "./types";

/** İşaretin renkleri: İyi gidiyor yeşil, Yolda camgöbeği, Yeni katıldı mor, Takıldı sarı. */
export const signalTone: Record<Signal, { chip: string; fill: string; border: string }> = {
  good: { chip: "bg-success/12 text-success-fg", fill: "bg-success", border: "border-success" },
  onTrack: { chip: "bg-accent/12 text-accent-fg", fill: "bg-accent", border: "border-accent" },
  new: { chip: "bg-purple/12 text-purple-fg", fill: "bg-purple", border: "border-purple" },
  stuck: { chip: "bg-warning/12 text-warning-fg", fill: "bg-warning", border: "border-warning" },
};

export function SignalChip({ signal }: { signal: Signal }) {
  const tone = signalTone[signal];
  return (
    <span className={cn("inline-flex h-6 flex-none items-center gap-1.5 rounded-full px-[9px] text-xs font-bold whitespace-nowrap", tone.chip)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.fill)} />
      {getMessages().school.teachers.signals[signal]}
    </span>
  );
}

/** 5 parçalı kurulum çubuğu. */
export function SetupBar({ step, signal, className }: { step: SetupStep; signal: Signal; className?: string }) {
  const t = getMessages().school.teachers;
  return (
    <span role="img" aria-label={format(t.setupLabel, { step })} className={cn("flex min-w-[60px] flex-1 gap-1", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= step ? signalTone[signal].fill : "bg-line")} />
      ))}
    </span>
  );
}

export function TeacherAvatar({ emoji, size = "md" }: { emoji: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex flex-none items-center justify-center rounded-full border border-line bg-card",
        size === "lg" ? "size-14 text-[28px]" : "size-10 text-xl",
      )}
    >
      {emoji}
    </span>
  );
}

/** Öğretmen kartları: dokununca ayrıntı (masaüstünde sağdan çekmece, telefonda alttan pencere). */
export function TeacherList({ teachers, onOpen }: { teachers: SchoolTeacher[]; onOpen: (id: string) => void }) {
  const t = getMessages().school.teachers;
  return (
    <section aria-labelledby="school-teachers" className="flex flex-col gap-2.5 print:hidden">
      <h2 id="school-teachers" className="m-0 text-[17px] font-bold">
        {t.title}
      </h2>
      {teachers.length === 0 ? (
        <span className="rounded-2xl border border-dashed border-line p-3.5 text-sm text-fg-3">{t.empty}</span>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {teachers.map((teacher) => (
            <li key={teacher.id}>
              <button
                type="button"
                onClick={() => onOpen(teacher.id)}
                aria-haspopup="dialog"
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-2.5 rounded-[20px] border bg-surface p-3.5 text-left font-[inherit] text-fg transition-[border-color,transform] hover:-translate-y-0.5 hover:border-accent",
                  teacher.signal === "new" ? "border-success/50 [animation:fade-up_.35s_ease-out_both]" : "border-line",
                )}
              >
                <span className="flex w-full items-center gap-3">
                  <TeacherAvatar emoji={teacher.avatar} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <b className="truncate text-[15px]">{teacher.name}</b>
                      {teacher.me ? (
                        <span className="flex-none rounded-[5px] bg-card px-1.5 py-0.5 text-[10px] font-extrabold tracking-[.6px] text-accent-fg">{t.me}</span>
                      ) : null}
                    </span>
                    {teacher.subject ? <span className="truncate text-xs text-fg-3">{teacher.subject}</span> : null}
                  </span>
                  <SignalChip signal={teacher.signal} />
                </span>
                <span className="flex w-full items-center gap-2.5">
                  <SetupBar step={teacher.step} signal={teacher.signal} />
                  <span className="text-xs whitespace-nowrap text-fg-3">
                    {teacher.classes.length > 0 ? format(t.classSummary, { classes: teacher.classes.length, students: teacher.students }) : t.noClass}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
