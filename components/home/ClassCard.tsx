"use client";

import Link from "next/link";
import { Check, Play, Users } from "lucide-react";
import { useState } from "react";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { ProgressBar } from "@/components/roadmap/ProgressRing";
import { withNext } from "@/lib/account/shared";
import type { AssignmentView, StudentClass } from "@/lib/classroom/student";
import { format, getMessages, rich } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { JoinCodeForm } from "./JoinCodeForm";

export type HomeClassData = { classes: StudentClass[]; assignments: AssignmentView[] };

/**
 * Ana sayfadaki sınıf kartı (Ana-Sayfa-Odev, -Mobil). Sınıfı yoksa kesikli çerçeveli küçük
 * "Sınıfına katıl": kod kutusu doğrudan açık (4 Kasım, 26; doğrulanmamış hesapta önce "Kod gir"). Sınıftaysa öğretmeni, gizlilik sözü ve
 * öğretmeninin verdiği açık ödevler (en acil olan önce). Öğrenci sınıftaki başka kimseyi görmez.
 */
export function ClassCard({ data, verified, className }: { data: HomeClassData; verified: boolean; className?: string }) {
  const t = getMessages().studentClass;
  const [open, setOpen] = useState(false);
  // Bu kartta az önce katılınan sınıf: "… sınıfına katıldın" başlığı sayfa yenilenene kadar kalır.
  const [joined, setJoined] = useState<StudentClass | null>(null);
  const classes = data.classes;
  const inClass = joined !== null || classes.length > 0;

  const title = joined
    ? format(t.joined, { name: joined.name })
    : classes.length === 1
      ? format(t.home.inClass, { name: classes[0].name })
      : classes.length > 1
        ? format(t.home.inClasses, { n: classes.length })
        : t.home.title;
  const lead = joined
    ? format(t.teacher, { name: joined.teacher })
    : classes.length === 1
      ? format(t.teacher, { name: classes[0].teacher })
      : classes.length > 1
        ? classes.map((c) => c.name).join(", ")
        : t.home.lead;

  return (
    <section
      aria-label={t.home.label}
      className={cn(
        "flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-4 lg:p-5",
        inClass ? "border-solid" : "border-dashed",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-card">
          <Users className="size-5 text-fg-2" strokeWidth={2} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <h3 className="m-0 text-base font-bold break-words">{title}</h3>
          <span className="truncate text-[13px] text-fg-3">{lead}</span>
        </span>
      </div>

      {inClass ? (
        <>
          <p className="m-0 flex items-center gap-2.5 rounded-xl border border-success/35 bg-success/10 px-3.5 py-3 text-sm leading-normal text-success-subtle-fg motion-safe:anim-pop">
            <Check className="size-4 flex-none text-success" strokeWidth={2.4} aria-hidden="true" />
            {t.privacy}
          </p>
          {data.assignments.length > 0 ? (
            <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
              {data.assignments.map((a) => (
                <li key={a.id}>
                  <AssignmentBox assignment={a} showClass={classes.length > 1} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[13px] leading-normal text-fg-3">{t.home.noAssignment}</p>
          )}
        </>
      ) : !verified && open ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-warning/45 bg-warning/8 px-3.5 py-3 text-sm leading-normal text-warning-fg">
          <p className="m-0">{t.verifyFirst}</p>
          <Link href={withNext(routes.verify, routes.home)} className="self-start font-bold">
            {t.verify}
          </Link>
        </div>
      ) : verified || open ? (
        <JoinCodeForm autoFocus={open} onJoined={(classroom) => setJoined(classroom)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-card text-[15px] font-bold text-fg transition-colors hover:border-line-strong"
        >
          {t.home.enterCode}
        </button>
      )}
    </section>
  );
}

/** "Öğretmeninin verdiği ödev": mahalle, x/y lab, son tarih, puanlanmaz notu, sıradaki lab. */
function AssignmentBox({ assignment: a, showClass }: { assignment: AssignmentView; showClass: boolean }) {
  const t = getMessages().studentClass.assignment;
  const tone = toneOf(a.district.color);
  return (
    <section
      aria-label={format(t.label, { name: a.district.name })}
      className="flex flex-col gap-2.5 rounded-[14px] border border-accent/40 bg-surface-raised bg-[radial-gradient(90%_120%_at_0%_0%,color-mix(in_oklab,var(--accent)_14%,transparent),transparent_60%)] p-3.5 motion-safe:anim-pop"
    >
      <span className="text-[11px] font-bold tracking-[1px] text-accent-light">{t.eyebrow}</span>
      {showClass ? <span className="-mt-1.5 truncate text-xs text-fg-3">{format(t.from, { name: a.classroom.name, teacher: a.classroom.teacher })}</span> : null}
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className={cn("size-[9px] flex-none rounded-full", tone.fill)} />
          <b className="truncate text-base">{a.district.name}</b>
        </span>
        <span className="flex-none text-[13px] text-fg-3">{format(t.progress, { done: a.done, total: a.total })}</span>
      </span>
      <ProgressBar value={a.total > 0 ? a.done / a.total : 0} fillClass={tone.fill} className="h-1.5" />
      <span className="text-xs leading-normal text-fg-3">
        {a.due ? rich(format(t.dueNote, { date: a.due }), { due: (chunk) => <span className={cn(a.overdue && "font-bold text-warning-fg")}>{chunk}</span> }) : t.note}
      </span>
      {a.finished ? (
        <span className="flex h-11 items-center justify-center gap-2 rounded-xl border border-success/40 bg-success/10 text-sm font-bold text-success-subtle-fg">
          <Check className="size-4 text-success" strokeWidth={2.4} aria-hidden="true" />
          {t.done}
        </span>
      ) : a.next ? (
        <Link
          href={a.next.href}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
        >
          <Play className="size-[13px] flex-none fill-current" strokeWidth={2.4} aria-hidden="true" />
          <span className="truncate">{a.next.label}</span>
        </Link>
      ) : a.total === 0 ? (
        <span className="text-xs text-fg-4">{t.soon}</span>
      ) : null}
    </section>
  );
}
