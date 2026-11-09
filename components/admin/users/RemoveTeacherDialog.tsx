"use client";

import { Sheet } from "@/components/classroom/Sheet";
import { format, getMessages } from "@/lib/i18n";
import type { AdminTeacher } from "./types";

/**
 * "Öğretmenlikten çıkar" onayı (Kullanicilar-Son): sınıfları öğrencilerden gizlenir, ilerleme
 * silinmez, kişi normal üye olarak devam eder. Masaüstünde ortada, telefonda alttan açılır.
 */
export function RemoveTeacherDialog({
  teacher,
  onCancel,
  onConfirm,
}: {
  teacher: AdminTeacher | null;
  onCancel: () => void;
  onConfirm: (teacher: AdminTeacher) => void;
}) {
  const t = getMessages().adminUsers.remove;
  return (
    <Sheet
      open={teacher !== null}
      onClose={onCancel}
      labelledBy="admin-remove-teacher-title"
      closeLabel={getMessages().adminUsers.drawer.close}
      title={
        <h2 id="admin-remove-teacher-title" className="m-0 font-heading text-[22px] leading-tight font-bold break-words">
          {teacher ? format(t.title, { name: teacher.name }) : null}
        </h2>
      }
    >
      {teacher ? (
        <>
          <p className="m-0 text-[15px] leading-[1.55] text-fg-2">{teacher.isAdmin ? t.textAdmin : t.text}</p>
          {teacher.coordinatorOf ? (
            <p className="m-0 rounded-xl border border-warning/30 bg-warning/8 px-3.5 py-2.5 text-sm leading-normal text-warning-fg">
              {format(t.coordinator, { school: teacher.coordinatorOf })}
            </p>
          ) : null}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="h-12 cursor-pointer rounded-xl border border-line bg-surface px-4 font-[inherit] text-[15px] font-bold text-fg"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(teacher)}
              className="h-12 flex-1 cursor-pointer rounded-xl border-0 bg-danger px-4 font-[inherit] text-[15px] font-bold text-on-danger"
            >
              {t.confirm}
            </button>
          </div>
        </>
      ) : null}
    </Sheet>
  );
}
