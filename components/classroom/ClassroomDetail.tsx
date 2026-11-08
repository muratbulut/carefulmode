"use client";

import Link from "next/link";
import { CalendarDays, ChevronLeft, ClipboardList, Copy, Presentation, RefreshCw } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { Toast } from "@/components/status/Toast";
import { format, getMessages } from "@/lib/i18n";
import { percent } from "@/lib/classroom/teacher-rules";
import { paths, routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { copyText, levelName } from "./client";
import { HomeworkDialog } from "./HomeworkDialog";
import { OverviewTab } from "./OverviewTab";
import { ProjectionOverlay } from "./ProjectionOverlay";
import { RenewCodeDialog } from "./RenewCodeDialog";
import { StudentDrawer } from "./StudentDrawer";
import { StudentsTab } from "./StudentsTab";
import { TopicsTab } from "./TopicsTab";
import type { ClassroomDetailData, DetailTab } from "./types";

const tabs: DetailTab[] = ["overview", "students", "topics"];
/** Sekmenin adresteki adı (?sekme=...); genel bakışta adres yalın kalır. */
const tabParam = { overview: undefined, students: "ogrenciler", topics: "konular" } as const;

/**
 * Sınıf detayı (Tur 3, Murat kararı: D2 sekmeli; tahtalar Sinif-Detay-Son, -Mobil). Başlıkta
 * sınıf kodu ve "Kodu yenile" (sabah soruları 14), "Kodu yansıt" ve "Ödev ver"; altında açık ödevin bandı ve sekmeler: Genel bakış,
 * Öğrenciler, Konular. Öğretmen öğrencinin yalnızca bitirdi / bitirmedi bilgisini görür.
 */
export function ClassroomDetail({ data, initialTab }: { data: ClassroomDetailData; initialTab: DetailTab }) {
  const t = getMessages().classroom;
  const d = t.detail;
  const [tab, setTab] = useState<DetailTab>(initialTab);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [homeworkHood, setHomeworkHood] = useState<string | null>(null);
  const [projecting, setProjecting] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Çıkarılan öğrenci sayfa yenilenince listeden düşer; çekmece de kapanır.
  const student = data.students.find((s) => s.id === studentId) ?? null;
  const hw = data.homework;
  const tone = hw ? toneOf(hw.color) : null;
  const level = levelName(data.level, t);

  function choose(next: DetailTab) {
    setTab(next);
    window.history.replaceState(null, "", paths.classroom(data.id, tabParam[next]));
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length];
    choose(next);
    document.getElementById(`class-tab-${next}`)?.focus();
  }

  /** "Ödev ver": açık ödev varsa onun mahallesi, yoksa labı olan ilk mahalle seçili açılır. */
  function openHomework(hoodId?: string) {
    const first = hw?.neighborhoodId ?? data.hoods.find((h) => h.labCount > 0)?.id ?? data.hoods[0]?.id;
    const target = hoodId ?? first;
    if (target) setHomeworkHood(target);
  }

  async function copyCode() {
    setToast((await copyText(data.code)) ? format(t.toasts.codeCopied, { code: data.code }) : format(t.toasts.copyFailed, { code: data.code }));
  }

  return (
    <div className="relative mx-auto flex max-w-[1200px] flex-col gap-3.5 px-4 pt-4 pb-28 lg:gap-[22px] lg:px-6 lg:pt-9 lg:pb-[72px]">
      <header className="flex flex-col gap-2.5">
        <Link href={routes.classes} className="-my-2.5 inline-flex min-h-10 items-center gap-1 self-start text-[13px] font-bold text-fg-3 no-underline hover:text-fg">
          <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          {d.back}
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="m-0 font-heading text-[32px] leading-[1.1] font-bold break-words lg:text-[40px]">{data.name}</h1>
            <span className="flex flex-wrap items-center gap-2.5 text-[13px] text-fg-3">
              {level ? format(t.levelAndCount, { level, count: data.students.length }) : format(t.studentCount, { count: data.students.length })}
              <button
                type="button"
                onClick={copyCode}
                aria-label={format(d.copyCode, { code: data.code })}
                className="relative inline-flex h-[30px] cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-line bg-surface-deep px-2.5 font-mono text-[13px] font-bold tracking-[2px] text-fg after:absolute after:-inset-x-px after:-inset-y-1.5"
              >
                {data.code}
                <Copy className="size-3.5 text-fg-4" strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setRenewing(true)}
                className="relative inline-flex h-[30px] cursor-pointer items-center gap-1.5 font-bold text-fg-3 after:absolute after:-inset-x-1.5 after:-inset-y-1.5 hover:text-fg"
              >
                <RefreshCw className="size-3.5" strokeWidth={2} aria-hidden="true" />
                {d.renewCode}
              </button>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-none lg:gap-2.5">
            <button
              type="button"
              onClick={() => setProjecting(true)}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-[15px] font-bold text-fg lg:h-[46px]"
            >
              <Presentation className="size-[18px]" strokeWidth={2} aria-hidden="true" />
              {d.projectCode}
            </button>
            <button
              type="button"
              onClick={() => openHomework()}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-bold text-on-accent lg:h-[46px]"
            >
              <ClipboardList className="size-[18px]" strokeWidth={2} aria-hidden="true" />
              {d.giveHomework}
            </button>
          </div>
        </div>
      </header>

      {hw && tone ? (
        <section
          aria-labelledby="homework-band-title"
          className="relative flex flex-col gap-3 overflow-hidden rounded-[20px] border border-line bg-surface p-4 lg:p-5"
        >
          <span aria-hidden="true" className={cn("pointer-events-none absolute -top-24 -left-20 size-64 rounded-full blur-3xl", tone.glow)} />
          <div className="relative flex flex-wrap items-start justify-between gap-3 lg:items-center">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[11px] font-bold tracking-[1.5px] text-fg-3">{d.band.eyebrow}</span>
              <span className="flex flex-wrap items-center gap-2">
                <span aria-hidden="true" className={cn("size-2.5 flex-none rounded-full", tone.fill)} />
                <h2 id="homework-band-title" className="m-0 font-heading text-xl font-bold lg:text-[22px]">
                  {hw.name}
                </h2>
                <span className="text-[13px] text-fg-3">{format(d.band.labs, { count: hw.labs.length })}</span>
              </span>
            </div>
            <span className={cn("inline-flex items-center gap-1.5 text-[13px]", hw.overdue ? "font-bold text-warning-fg" : "text-fg-3")}>
              {hw.due ? (
                <>
                  <CalendarDays className="size-[15px] flex-none" strokeWidth={2} aria-hidden="true" />
                  {format(t.pair, { a: hw.due, b: hw.left ?? "" })}
                </>
              ) : (
                d.band.noDue
              )}
            </span>
          </div>
          <div className="relative flex items-center gap-3">
            <span
              role="progressbar"
              aria-label={d.band.progress}
              aria-valuemin={0}
              aria-valuemax={data.students.length}
              aria-valuenow={hw.finished}
              aria-valuetext={format(t.finishedLabel, { done: hw.finished, total: data.students.length })}
              className="block h-2 flex-1 overflow-hidden rounded-full bg-card"
            >
              <span className={cn("block h-full rounded-full transition-[width] duration-500", tone.fill)} style={{ width: `${percent(hw.finished, data.students.length)}%` }} />
            </span>
            <b className="font-heading text-xl">{format(t.doneOf, { done: hw.finished, total: data.students.length })}</b>
          </div>
          <span className="relative text-[13px] text-fg-3">
            {format(t.pair, {
              a: d.band.finishedText,
              b: format(d.band.week, { count: data.week }),
            })}
          </span>
        </section>
      ) : (
        <section className="flex flex-col gap-1 rounded-[20px] border border-dashed border-line bg-surface p-4 lg:p-5">
          <span className="text-[11px] font-bold tracking-[1.5px] text-fg-3">{d.band.eyebrow}</span>
          <h2 className="m-0 font-heading text-xl font-bold">{d.band.none}</h2>
          <p className="m-0 text-[13px] leading-normal text-fg-3">{d.band.noneText}</p>
        </section>
      )}

      <div role="tablist" aria-label={d.tabs.label} className="flex border-b border-line lg:gap-2">
        {tabs.map((key) => (
          <button
            key={key}
            id={`class-tab-${key}`}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls={`class-panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => choose(key)}
            onKeyDown={onTabKey}
            className={cn(
              "-mb-px h-[46px] flex-1 cursor-pointer border-b-2 px-1 text-sm font-bold transition-colors lg:flex-none lg:px-4 lg:text-[15px]",
              tab === key ? "border-accent text-fg" : "border-transparent text-fg-3 hover:text-fg",
            )}
          >
            {d.tabs[key]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`class-panel-${tab}`} aria-labelledby={`class-tab-${tab}`} className="[animation:fade-up_.25s_ease-out_both]" key={tab}>
        {tab === "overview" ? (
          <OverviewTab data={data} onOpenStudent={setStudentId} onGiveHomework={() => openHomework()} onProject={() => setProjecting(true)} />
        ) : tab === "students" ? (
          <StudentsTab data={data} onOpenStudent={setStudentId} />
        ) : (
          <TopicsTab data={data} onGive={openHomework} />
        )}
      </div>

      <StudentDrawer
        student={student}
        data={data}
        onClose={() => setStudentId(null)}
        onRemoved={(name) => {
          setStudentId(null);
          setToast(format(t.toasts.removed, { name }));
        }}
      />
      <HomeworkDialog
        hoodId={homeworkHood}
        data={data}
        onClose={() => setHomeworkHood(null)}
        onDone={(message) => {
          setHomeworkHood(null);
          setToast(message);
        }}
      />
      <RenewCodeDialog
        open={renewing}
        classroomId={data.id}
        code={data.code}
        onClose={() => setRenewing(false)}
        onDone={(code) => {
          setRenewing(false);
          setToast(format(t.toasts.codeRenewed, { code }));
        }}
      />
      <ProjectionOverlay target={projecting ? data : null} onClose={() => setProjecting(false)} />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
