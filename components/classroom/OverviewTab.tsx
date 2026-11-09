import { CheckCheck, CircleCheck, ClipboardList, Lock, Presentation, TriangleAlert, Users } from "lucide-react";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { EmptyState } from "@/components/status/EmptyState";
import { minFinishedForRate } from "@/lib/classroom/rules";
import { attentionRules, percent } from "@/lib/classroom/teacher-rules";
import { format, getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SummaryBox } from "./SummaryBox";
import type { ClassroomDetailData } from "./types";

/** Tuzağı fark eden yüzdesi: "zor geçiyor" sınırının altı sarı, üstü yeşil. */
const rateTone = (rate: number) => (rate < attentionRules.hardLabBelowRate ? "text-warning-fg" : "text-success-fg");

/**
 * Sınıf detayı > Genel bakış (Sinif-Detay-Son, D2): özet kutuları, ödevin labları (sınıf toplamı:
 * bitiren sayısı, güvende kalma oranı) ve ödeve başlamayanlar. Oran en az 5 öğrenci bitirince
 * görünür; öğrencinin puanı ya da raporu hiçbir yerde yok.
 */
export function OverviewTab({
  data,
  onOpenStudent,
  onGiveHomework,
  onProject,
}: {
  data: ClassroomDetailData;
  onOpenStudent: (id: string) => void;
  onGiveHomework: () => void;
  onProject: () => void;
}) {
  const t = getMessages().classroom;
  const o = t.detail.overview;
  const hw = data.homework;
  const members = data.students.length;
  const tone = hw ? toneOf(hw.color) : null;

  return (
    <div className="flex flex-col gap-3.5 lg:gap-5">
      <div className="grid grid-cols-3 gap-2 lg:gap-4">
        <SummaryBox compact Icon={Users} tone="accent" value={members} label={o.students} />
        <SummaryBox compact Icon={CircleCheck} tone="success" value={hw ? format(t.doneOf, { done: hw.finished, total: members }) : o.noValue} label={o.completed} />
        <SummaryBox compact Icon={CheckCheck} tone="purple" value={data.week} label={o.week} />
      </div>

      {members === 0 ? (
        <EmptyState
          Icon={Users}
          title={o.noStudentsTitle}
          className="bg-surface py-8"
          action={
            <button
              type="button"
              onClick={onProject}
              className="mt-2 inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-bold text-on-accent"
            >
              <Presentation className="size-[18px]" strokeWidth={2} aria-hidden="true" />
              {t.detail.projectCode}
            </button>
          }
        >
          {o.noStudentsText}
        </EmptyState>
      ) : !hw || !tone ? (
        <EmptyState
          Icon={ClipboardList}
          title={o.noHomeworkTitle}
          className="bg-surface py-8"
          action={
            <button
              type="button"
              onClick={onGiveHomework}
              className="mt-2 inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-bold text-on-accent"
            >
              <ClipboardList className="size-[18px]" strokeWidth={2} aria-hidden="true" />
              {t.detail.giveHomework}
            </button>
          }
        >
          {o.noHomeworkText}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
          {/* Telefonda önce başlamayanlar, sonra lablar (Sinif-Detay-Son-Mobil); masaüstünde lablar solda. */}
          {hw.notStarted.length > 0 ? (
            <section
              aria-labelledby="not-started-title"
              className="relative flex flex-col gap-2.5 overflow-hidden rounded-[20px] border border-warning/30 bg-surface p-4 lg:col-start-2 lg:row-start-1 lg:p-5"
            >
              <span aria-hidden="true" className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full bg-warning/10 blur-3xl" />
              <h3 id="not-started-title" className="relative m-0 flex items-center gap-2 text-[15px] font-bold">
                <TriangleAlert className="size-4 flex-none text-warning-fg" strokeWidth={2} aria-hidden="true" />
                {format(o.notStarted, { count: hw.notStarted.length })}
              </h3>
              <ul className="relative m-0 flex list-none flex-wrap gap-1.5 p-0 max-lg:gap-2">
                {hw.notStarted.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onOpenStudent(s.id)}
                      className="h-[30px] cursor-pointer rounded-full border border-line bg-surface-deep px-2.5 text-[13px] text-fg hover:border-accent max-lg:h-10 max-lg:px-3.5"
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="relative m-0 text-xs text-fg-4">{o.notStartedNote}</p>
            </section>
          ) : (
            <p className="m-0 flex items-center gap-2 rounded-[20px] border border-success/30 bg-surface p-4 text-[15px] font-bold lg:col-start-2 lg:row-start-1">
              <CircleCheck className="size-4 flex-none text-success-fg" strokeWidth={2} aria-hidden="true" />
              {o.allStarted}
            </p>
          )}

          <section aria-labelledby="homework-labs-title" className="flex flex-col gap-2.5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <h3 id="homework-labs-title" className="m-0 text-base font-bold">
              {o.labsTitle}
            </h3>
            {hw.labs.length === 0 ? (
              <p className="m-0 rounded-2xl border border-dashed border-line p-4 text-sm text-fg-3">{o.noLabs}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {hw.labs.map((lab) => (
                  <li key={lab.id} className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5">
                    <span className="flex items-center justify-between gap-2.5">
                      <span className="min-w-0 text-[15px] font-bold break-words">{lab.name}</span>
                      <b className="flex-none text-sm">
                        <span aria-hidden="true">{format(o.finishers, { done: lab.finishers, total: members })}</span>
                        <span className="sr-only">{format(o.finishersLabel, { done: lab.finishers, total: members })}</span>
                      </b>
                    </span>
                    <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-card">
                      <span className={cn("block h-full rounded-full", tone.fill)} style={{ width: `${percent(lab.finishers, members)}%` }} />
                    </span>
                    {lab.training ? (
                      <span className="text-xs text-fg-4">{o.training}</span>
                    ) : lab.noticed !== null ? (
                      <span className="text-[13px] text-fg-3">
                        {rich(format(o.noticed, { first: lab.noticed.first, last: lab.noticed.last }), {
                          first: (chunk) => <b className={rateTone(lab.noticed!.first)}>{chunk}</b>,
                          last: (chunk) => <b className={rateTone(lab.noticed!.last)}>{chunk}</b>,
                        })}
                      </span>
                    ) : (
                      <span className="text-xs text-fg-4">{format(o.noticedHidden, { min: minFinishedForRate })}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="m-0 flex items-start gap-2.5 rounded-[14px] border border-card bg-surface-raised px-3.5 py-3 text-[13px] leading-normal text-fg-3 lg:col-start-2 lg:row-start-2">
            <Lock className="mt-0.5 size-4 flex-none text-accent-light" strokeWidth={2} aria-hidden="true" />
            <span>{format(o.privacy, { min: minFinishedForRate })}</span>
          </p>
        </div>
      )}
    </div>
  );
}
