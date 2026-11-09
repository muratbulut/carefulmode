"use client";

import { Bell, Check, Eye } from "lucide-react";
import type { ReactNode } from "react";
import { SignalChip, signalTone, TeacherAvatar } from "@/components/school/TeacherList";
import { hintText } from "@/lib/admin/users-model";
import { format, getMessages } from "@/lib/i18n";
import { minStudentsJoined } from "@/lib/school/bulletin-model";
import { cn } from "@/lib/utils";
import { Drawer } from "./Drawer";
import { ClassMini, TeacherTags } from "./TeacherBits";
import type { AdminTeacher } from "./types";
import { useUsers } from "./context";

/**
 * Öğretmen çekmecesi (Kullanicilar-Son; Genel ve Okullar ortak): kurulumun 5 adımı, "Öğretmenin
 * gözünden bak", takılana "Hatırlat", sınıfları (yalnızca toplamlar), e-posta, onay, son giriş ve
 * "Öğretmenlikten çıkar". Masaüstünde sağdan, telefonda alttan açılır.
 */
export function TeacherDrawer({
  id,
  teacher,
  onClose,
  onRemove,
  overlay,
}: {
  id: string | null;
  teacher: AdminTeacher | null;
  onClose: () => void;
  onRemove: (teacher: AdminTeacher) => void;
  overlay?: ReactNode;
}) {
  const t = getMessages().adminUsers.drawer;
  return (
    <Drawer open={id !== null} label={teacher ? teacher.name : t.label} closeLabel={t.close} onClose={onClose} overlay={overlay}>
      {teacher ? <TeacherDetail teacher={teacher} onRemove={onRemove} /> : <p className="m-0 text-sm leading-normal text-fg-3">{t.notFound}</p>}
    </Drawer>
  );
}

function TeacherDetail({ teacher, onRemove }: { teacher: AdminTeacher; onRemove: (teacher: AdminTeacher) => void }) {
  const t = getMessages().adminUsers;
  const d = getMessages().school.drawer;
  const { gaze, remind, isReminded, reminding } = useUsers();
  const line = [teacher.school?.name ?? t.teachers.noSchool, teacher.subject || t.teachers.noSubject].join(" · ");
  const reminded = isReminded(teacher);

  return (
    <>
      <div className="flex items-center gap-3.5">
        <TeacherAvatar emoji={teacher.avatar} size="lg" />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <b className="font-heading text-[22px] break-words">{teacher.name}</b>
          <TeacherTags teacher={teacher} />
          <span className="text-[13px] text-fg-3">{line}</span>
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => gaze(teacher)}
          className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 font-[inherit] text-[15px] font-bold text-on-accent"
        >
          <Eye className="size-[18px]" strokeWidth={2} aria-hidden="true" />
          {t.drawer.gaze}
        </button>
        {teacher.me ? (
          <p className="m-0 text-[13px] leading-normal text-fg-3">{t.drawer.self}</p>
        ) : reminded ? (
          <span className="flex h-11 items-center justify-center gap-2 rounded-xl bg-success/10 text-sm font-bold text-success-fg">
            <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
            {d.reminded}
          </span>
        ) : teacher.remind ? (
          <button
            type="button"
            disabled={reminding !== null}
            onClick={() => remind(teacher)}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-warning/45 bg-surface px-4 font-[inherit] text-[15px] font-bold text-warning-fg transition-opacity disabled:cursor-default disabled:opacity-60"
          >
            <Bell className="size-[17px]" strokeWidth={2} aria-hidden="true" />
            {d.remind[teacher.remind]}
          </button>
        ) : null}
      </div>

      <section aria-label={format(d.setup, { step: teacher.step })} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <span className="flex items-center justify-between gap-2">
          <b className="text-[15px]">{format(d.setup, { step: teacher.step })}</b>
          <SignalChip signal={teacher.signal} />
        </span>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {d.steps.map((step, i) => {
            const done = i < teacher.step;
            return (
              <li key={step.title} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 flex-none items-center justify-center rounded-full border-2 text-xs font-extrabold",
                    done ? cn(signalTone[teacher.signal].border, signalTone[teacher.signal].chip) : "border-line bg-canvas text-fg-4",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className="flex flex-col gap-px">
                  <b className={cn("text-sm", done ? "text-fg" : "text-fg-4")}>
                    {step.title}
                    <span className="sr-only">{done ? d.stepDone : d.stepTodo}</span>
                  </b>
                  <span className="text-xs text-fg-4">{format(step.sub, { n: minStudentsJoined })}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <span className="text-[13px] leading-normal text-fg-2">{hintText(teacher.hint)}</span>
      </section>

      <section aria-labelledby="admin-teacher-classes" className="flex flex-col gap-2">
        <span id="admin-teacher-classes" className="text-xs font-bold tracking-[.8px] text-fg-4">
          {t.drawer.classes}
        </span>
        {teacher.classes.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {teacher.classes.map((item) => (
              <ClassMini key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <span className="rounded-[14px] border border-dashed border-line p-3.5 text-sm text-fg-3">{t.drawer.noClasses}</span>
        )}
      </section>

      <dl className="m-0 flex flex-col">
        <InfoRow label={t.drawer.email} value={teacher.email} />
        <InfoRow
          label={t.drawer.approved}
          value={
            teacher.approved
              ? teacher.approved.by
                ? format(t.drawer.approvedBy, { date: teacher.approved.date, name: teacher.approved.by })
                : teacher.approved.date
              : t.drawer.approvedUnknown
          }
        />
        <InfoRow label={t.drawer.lastSeen} value={teacher.lastSeen ?? t.never} />
      </dl>

      {teacher.me ? null : (
        <button
          type="button"
          onClick={() => onRemove(teacher)}
          className="h-10 cursor-pointer self-start border-0 bg-transparent px-1 font-[inherit] text-sm font-bold text-danger-fg hover:underline"
        >
          {t.drawer.remove}
        </button>
      )}
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-line py-2.5 text-sm">
      {/* Etiket kısalmaz: uzun e-posta adresi "E-posta"yı ikiye bölmesin. */}
      <dt className="flex-none text-fg-3">{label}</dt>
      <dd className="m-0 min-w-0 text-right [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
