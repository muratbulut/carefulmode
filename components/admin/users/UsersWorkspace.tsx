"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { nextToast, UndoToast, type ToastData } from "@/components/admin/UndoToast";
import { removeTeacher, remindTeacherAsTeam, undoRemoveTeacher, viewAsTeacher, type UserActionError } from "@/lib/admin/user-actions";
import { usersParams } from "@/lib/admin/users-model";
import { format, getMessages } from "@/lib/i18n";
import { UsersContext, type UsersContextValue } from "./context";
import { GazeOverlay, type GazeState } from "./GazeOverlay";
import { RemoveTeacherDialog } from "./RemoveTeacherDialog";
import { StudentDrawer } from "./StudentDrawer";
import { TeacherDrawer } from "./TeacherDrawer";
import type { AdminTeacher } from "./types";

/** Adresteki çekmece: açarken öteki çekmece kapanır. Geçmişe yeni satır eklenmez. */
function setDrawerParam(key: string, value: string | null) {
  const next = new URLSearchParams(window.location.search);
  next.delete(usersParams.student);
  next.delete(usersParams.teacher);
  if (value) next.set(key, value);
  const search = next.toString();
  window.history.replaceState(null, "", search ? `${window.location.pathname}?${search}` : window.location.pathname);
}

/**
 * Kullanıcılar sayfasının ortak durumu: açık çekmece (adreste ?ogrenci= ya da ?ogretmen=),
 * "Öğretmenin gözünden", hatırlatma, "Öğretmenlikten çıkar" ve bildirim kutusu. Bildirim kutusu
 * en üstteki açık pencerenin içinde çizilir (yoksa perdenin altında kalır).
 */
export function UsersWorkspace({ teachers, children }: { teachers: AdminTeacher[]; children: ReactNode }) {
  const t = getMessages().adminUsers;
  const params = useSearchParams();
  const teacherId = params.get(usersParams.teacher);
  const studentId = params.get(usersParams.student);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [remindedNow, setRemindedNow] = useState<ReadonlySet<string>>(new Set());
  const [reminding, setReminding] = useState<string | null>(null);
  const [gazeState, setGazeState] = useState<GazeState | null>(null);
  const [removing, setRemoving] = useState<AdminTeacher | null>(null);
  const [, startTransition] = useTransition();

  const byId = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher])), [teachers]);
  const say = (message: string, undo?: () => void) => setToast(nextToast({ message, undo }));
  const fail = (error: UserActionError) => setToast(nextToast({ message: t.errors[error], tone: "error" }));
  const markReminded = (id: string) => setRemindedNow((ids) => new Set(ids).add(id));

  function gaze(teacher: Pick<AdminTeacher, "id" | "name">) {
    setGazeState({ id: teacher.id, name: teacher.name, data: null });
    startTransition(async () => {
      try {
        const result = await viewAsTeacher(teacher.id);
        if (!result.ok) {
          setGazeState(null);
          return fail(result.error);
        }
        setGazeState((state) => (state?.id === teacher.id ? { ...state, data: result.gaze } : state));
      } catch {
        setGazeState(null);
        fail("failed");
      }
    });
  }

  function remind(teacher: AdminTeacher) {
    if (reminding) return;
    setReminding(teacher.id);
    startTransition(async () => {
      try {
        const result = await remindTeacherAsTeam(teacher.id);
        if (!result.ok) {
          if (result.error === "alreadyReminded") markReminded(teacher.id);
          return fail(result.error);
        }
        markReminded(teacher.id);
        say(format(t.toasts.reminded, { name: result.name, what: getMessages().school.reminderWhat[result.kind] }));
      } catch {
        fail("failed");
      } finally {
        setReminding(null);
      }
    });
  }

  function undoRemove(teacher: AdminTeacher) {
    startTransition(async () => {
      try {
        const result = await undoRemoveTeacher(teacher.id);
        if (!result.ok) return fail(result.error);
        say(format(t.toasts.restored, { name: result.name }));
      } catch {
        fail("failed");
      }
    });
  }

  function remove(teacher: AdminTeacher) {
    setRemoving(null);
    startTransition(async () => {
      try {
        const result = await removeTeacher(teacher.id);
        if (!result.ok) return fail(result.error);
        setDrawerParam(usersParams.teacher, null);
        say(format(t.toasts.removed, { name: result.name }), () => undoRemove(teacher));
      } catch {
        fail("failed");
      }
    });
  }

  const value: UsersContextValue = {
    teachers,
    isReminded: (teacher) => teacher.reminded || remindedNow.has(teacher.id),
    reminding,
    openTeacher: (id) => setDrawerParam(usersParams.teacher, id),
    openStudent: (id) => setDrawerParam(usersParams.student, id),
    gaze,
    remind,
  };

  // Bildirim kutusu en üstteki açık pencereye girer.
  const layer = gazeState ? "gaze" : teacherId ? "teacher" : studentId ? "student" : "page";
  const toastBox = <UndoToast toast={toast} onClose={() => setToast(null)} />;

  return (
    <UsersContext value={value}>
      {children}
      <TeacherDrawer
        id={teacherId}
        teacher={teacherId ? (byId.get(teacherId) ?? null) : null}
        onClose={() => setDrawerParam(usersParams.teacher, null)}
        onRemove={setRemoving}
        overlay={layer === "teacher" ? toastBox : null}
      />
      <StudentDrawer id={studentId} onClose={() => setDrawerParam(usersParams.student, null)} overlay={layer === "student" ? toastBox : null} />
      <RemoveTeacherDialog teacher={removing} onCancel={() => setRemoving(null)} onConfirm={remove} />
      <GazeOverlay state={gazeState} onClose={() => setGazeState(null)} overlay={layer === "gaze" ? toastBox : null} />
      {layer === "page" ? toastBox : null}
    </UsersContext>
  );
}
