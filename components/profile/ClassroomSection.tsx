"use client";

import Link from "next/link";
import { Check, LogOut, Users } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { JoinCodeForm } from "@/components/home/JoinCodeForm";
import { withNext } from "@/lib/account/shared";
import type { StudentClass } from "@/lib/classroom/student";
import { leaveClassroom } from "@/lib/classroom/student-actions";
import { format, getMessages } from "@/lib/i18n";
import { paths, routes } from "@/lib/navigation";
import { Dialog } from "./Dialog";
import { SectionCard } from "./SectionCard";

export type ClassroomSectionData = { classes: StudentClass[] };

const quietButton =
  "inline-flex h-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-raised px-4 text-sm font-bold transition-colors hover:border-line-strong disabled:opacity-50";

/**
 * Profil > Sınıf (Ogretmenlik-Son, "Sınıfın"): katıldığı sınıflar, sınıf koduyla katılma ve
 * sınıftan ayrılma (onay penceresiyle). Öğrenci sınıftaki diğer öğrencileri görmez.
 */
export function ClassroomSection({
  data,
  emailVerified,
  onDone,
}: {
  data: ClassroomSectionData;
  emailVerified: boolean;
  onDone: (message: string) => void;
}) {
  const t = getMessages().studentClass;
  const p = t.profile;
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState<StudentClass | null>(null);
  const [pending, startLeave] = useTransition();
  const titleId = useId();
  const classes = data.classes;

  function confirmLeave() {
    const target = leaving;
    if (!target) return;
    startLeave(async () => {
      try {
        const result = await leaveClassroom(target.id);
        onDone(result.message);
      } catch {
        onDone(t.errors.generic);
      }
      setLeaving(null);
    });
  }

  const join = !emailVerified ? (
    <div className="flex flex-col gap-2.5 rounded-xl border border-warning/45 bg-warning/8 px-3.5 py-3 text-sm leading-normal text-warning-fg sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0">{t.verifyFirst}</p>
      <Link href={withNext(routes.verify, paths.profileSection("classroom"))} className="flex-none font-bold">
        {t.verify}
      </Link>
    </div>
  ) : (
    <div className="flex max-w-[420px] flex-col gap-2">
      <JoinCodeForm
        autoFocus
        onJoined={(_, message) => {
          setOpen(false);
          onDone(message);
        }}
      />
      {/* Dokunma alanı 40 px; eksi kenar boşluğu düzeni değiştirmez. */}
      <button type="button" onClick={() => setOpen(false)} className="-mt-2 -mb-3 cursor-pointer self-start pt-2 pb-3 text-sm font-bold text-fg-3 hover:text-fg">
        {p.cancel}
      </button>
    </div>
  );

  return (
    <SectionCard Icon={Users} tone="success" title={p.title} lead={p.lead}>
      {classes.length > 0 ? (
        <ul aria-label={p.list} className="m-0 flex list-none flex-col gap-2.5 p-0">
          {classes.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-[14px] border border-success/40 bg-success/8 px-4 py-3.5"
            >
              <Check className="size-5 flex-none text-success" strokeWidth={2.6} aria-hidden="true" />
              <span className="flex min-w-0 flex-[1_1_200px] flex-col">
                <b className="break-words">{c.school ? format(t.classAndSchool, { name: c.name, school: c.school }) : c.name}</b>
                <span className="text-[13px] text-fg-3">{format(t.teacher, { name: c.teacher })}</span>
              </span>
              <button
                type="button"
                onClick={() => setLeaving(c)}
                className={`${quietButton} text-danger-fg`}
              >
                {p.leave}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        join
      ) : classes.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex-[1_1_200px] text-sm text-fg-2">{p.empty}</span>
          <button type="button" onClick={() => setOpen(true)} className={`${quietButton} text-fg`}>
            {p.enterCode}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={`${quietButton} self-start text-fg`}>
          {p.another}
        </button>
      )}

      <Dialog open={leaving !== null} onClose={() => (pending ? undefined : setLeaving(null))} labelledBy={titleId}>
        <span className="flex size-12 items-center justify-center rounded-[14px] bg-danger/14">
          <LogOut className="size-[22px] text-danger-fg" strokeWidth={2} aria-hidden="true" />
        </span>
        <h2 id={titleId} className="font-heading text-[22px] leading-tight font-bold">
          {format(p.leaveDialog.title, { name: leaving?.name ?? "" })}
        </h2>
        <p className="m-0 text-sm leading-normal text-fg-2">{p.leaveDialog.text}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setLeaving(null)}
            disabled={pending}
            className="h-12 flex-1 cursor-pointer rounded-xl border border-line bg-card font-bold text-fg disabled:opacity-50"
          >
            {p.leaveDialog.cancel}
          </button>
          <button
            type="button"
            onClick={confirmLeave}
            disabled={pending}
            aria-busy={pending}
            className="h-12 flex-[2] cursor-pointer rounded-xl bg-danger font-bold text-on-danger transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
          >
            {p.leaveDialog.confirm}
          </button>
        </div>
      </Dialog>
    </SectionCard>
  );
}
