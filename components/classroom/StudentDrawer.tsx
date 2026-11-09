"use client";

import { Check, ChevronLeft, Lock, UserMinus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { removeStudent } from "@/lib/classroom/teacher-actions";
import { initialOf, percent } from "@/lib/classroom/teacher-rules";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { errorText } from "./client";
import type { ClassroomDetailData, StudentView } from "./types";

/**
 * Öğrenci çekmecesi (Sinif-Detay-Son): açık ödevin labları (bitirdi / henüz değil), mahallelere
 * göre x/y, katılma tarihi ve son lab zamanı; "Sınıftan çıkar" onay ister. Masaüstünde sağdan
 * açılır, telefonda tam ekran sayfadır. Puan, rapor ve deneme sayısı burada yok.
 */
export function StudentDrawer({
  student,
  data,
  onClose,
  onRemoved,
}: {
  student: StudentView | null;
  data: ClassroomDetailData;
  onClose: () => void;
  onRemoved: (name: string) => void;
}) {
  const dr = getMessages().classroom.detail.drawer;
  const ref = useRef<HTMLDialogElement>(null);
  const open = student !== null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={dr.label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-canvas p-0 text-fg backdrop:bg-scrim open:flex open:flex-col open:[animation:slide-in-page_.3s_cubic-bezier(.2,.8,.2,1)_both] backdrop:[animation:fade-in_.2s_ease-out_both] lg:mr-0 lg:ml-auto lg:w-[440px] lg:border-l lg:border-line"
    >
      {student ? <DrawerBody key={student.id} student={student} data={data} onClose={onClose} onRemoved={onRemoved} /> : null}
    </dialog>
  );
}

function DrawerBody({
  student,
  data,
  onClose,
  onRemoved,
}: {
  student: StudentView;
  data: ClassroomDetailData;
  onClose: () => void;
  onRemoved: (name: string) => void;
}) {
  const dr = getMessages().classroom.detail.drawer;
  const hw = data.homework;
  const confirmId = useId();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const done = student.homework.filter(Boolean).length;

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeStudent({ classroomId: data.id, userId: student.id });
      if (result.ok) onRemoved(student.name);
      else setError(errorText(result.error));
    });
  }

  return (
    <>
      <div className="flex flex-none items-center justify-between gap-3 border-b border-card p-3 lg:px-[22px] lg:py-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 min-w-0 cursor-pointer items-center gap-1 rounded-xl border border-line bg-surface pr-3 pl-1.5 text-sm font-bold text-fg lg:hidden"
        >
          <ChevronLeft className="size-[18px] flex-none" strokeWidth={2} aria-hidden="true" />
          <span className="truncate">{format(dr.back, { name: data.name })}</span>
        </button>
        <span className="hidden min-w-0 truncate font-bold text-fg-3 lg:block">{format(dr.heading, { name: data.name })}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={dr.close}
          className="hidden size-10 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-fg lg:flex"
        >
          <X className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-[18px] pb-10 lg:gap-[22px] lg:p-[22px]">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="flex size-14 flex-none items-center justify-center rounded-full border border-line bg-card font-heading text-[22px] font-bold text-accent-light"
          >
            {initialOf(student.name)}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <h2 className="m-0 font-heading text-[22px] font-bold break-words">{student.name}</h2>
            <span className="text-[13px] text-fg-3">
              {format(getMessages().classroom.pair, {
                a: format(dr.joined, { date: student.joined }),
                b: student.last ? format(dr.last, { time: student.last }) : dr.lastNone,
              })}
            </span>
          </span>
        </div>

        <section aria-labelledby="drawer-homework" className="flex flex-col gap-2">
          {hw ? (
            <>
              <h3 id="drawer-homework" className="m-0 text-[15px] font-bold">
                {format(dr.homework, { name: hw.name })}{" "}
                <span className="font-medium text-fg-3">{format(getMessages().classroom.detail.students.progress, { done, total: hw.labs.length })}</span>
              </h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {hw.labs.map((lab, i) => {
                  const isDone = student.homework[i] ?? false;
                  return (
                    <li key={lab.id} className="flex items-center gap-2.5 rounded-xl bg-surface-deep px-3 py-2.5 text-sm">
                      {isDone ? (
                        <span className="flex size-[22px] flex-none items-center justify-center rounded-full bg-success/16">
                          <Check className="size-3 text-success-fg" strokeWidth={3} aria-hidden="true" />
                        </span>
                      ) : (
                        <span aria-hidden="true" className="size-[22px] flex-none rounded-full border-[1.5px] border-dashed border-line-strong" />
                      )}
                      <span className="min-w-0 flex-1 break-words">{lab.name}</span>
                      <span className={cn("flex-none text-xs", isDone ? "font-bold text-success-fg" : "text-fg-4")}>{isDone ? dr.done : dr.notYet}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <h3 id="drawer-homework" className="m-0 text-[15px] font-medium text-fg-3">
              {dr.noHomework}
            </h3>
          )}
        </section>

        <section aria-labelledby="drawer-hoods" className="flex flex-col gap-3.5">
          <h3 id="drawer-hoods" className="m-0 text-[15px] font-bold">
            {dr.byNeighborhood}
          </h3>
          {data.hoods.map((hood, i) => {
            const tone = toneOf(hood.color);
            const count = student.byHood[i] ?? 0;
            return (
              <div key={hood.id} className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", tone.fill)} />
                    <span className="truncate">{hood.name}</span>
                    {hood.current ? (
                      <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-bold text-on-accent">
                        {getMessages().classroom.detail.topics.current}
                      </span>
                    ) : null}
                  </span>
                  <b>{format(getMessages().classroom.detail.students.progress, { done: count, total: hood.labCount })}</b>
                </span>
                <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-card">
                  <span className={cn("block h-full rounded-full", tone.fill)} style={{ width: `${percent(count, hood.labCount)}%` }} />
                </span>
              </div>
            );
          })}
        </section>

        <p className="m-0 flex gap-2.5 text-[13px] leading-normal text-fg-3">
          <Lock className="mt-0.5 size-4 flex-none text-accent-light" strokeWidth={2} aria-hidden="true" />
          <span>{dr.privacy}</span>
        </p>

        {confirming ? (
          <div
            role="alertdialog"
            aria-labelledby={confirmId}
            // Onay çekmecenin sonunda açılır; telefonda ekranın altında kalmasın diye görünür alana kayar.
            ref={(el) => el?.scrollIntoView({ block: "nearest" })}
            className="flex flex-col gap-3 rounded-[14px] border border-danger/40 bg-danger/8 p-4 [animation:fade-up_.2s_ease-out_both]"
          >
            <b id={confirmId} className="text-[15px]">
              {format(dr.confirmTitle, { name: student.name, class: data.name })}
            </b>
            <span className="text-[13px] leading-normal text-fg-2">{dr.confirmText}</span>
            {error ? (
              <span role="alert" className="text-[13px] font-medium text-danger-fg">
                {error}
              </span>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                className="h-[42px] cursor-pointer rounded-[10px] border border-line bg-surface text-sm font-bold text-fg"
              >
                {dr.cancel}
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="h-[42px] cursor-pointer rounded-[10px] bg-danger text-sm font-bold text-on-danger disabled:cursor-wait"
              >
                {pending ? dr.removing : dr.confirm}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-danger/40 text-sm font-bold text-danger-fg hover:bg-danger/8"
          >
            <UserMinus className="size-4" strokeWidth={2} aria-hidden="true" />
            {dr.remove}
          </button>
        )}
      </div>
    </>
  );
}
