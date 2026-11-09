"use client";

import { UserCog, UserPlus } from "lucide-react";
import { useState } from "react";
import { nextToast, UndoToast, type ToastData } from "@/components/admin/UndoToast";
import { undoSchoolChange } from "@/lib/admin/school-admin-actions";
import { format, getMessages } from "@/lib/i18n";
import { SchoolDialog, type SchoolDialogDone } from "./SchoolDialog";

/**
 * Okullar görünümündeki satırın "Sorumlu ata" / "Değiştir" düğmesi ve okul sorumlusu penceresi:
 * okulun öğretmenlerinden ya da okulsuz bir öğretmenden sorumlu seçme, "kendi okulunun
 * taleplerini onaylayabilir" anahtarı ve "Sorumluyu kaldır". Her değişiklikten sonra "Geri al".
 */
export function CoordinatorControl({
  schoolId,
  schoolName,
  coordinator,
  coordinatorApproves,
}: {
  schoolId: string;
  schoolName: string;
  coordinator: { id: string; name: string; isTeacher: boolean } | null;
  coordinatorApproves: boolean;
}) {
  const t = getMessages().adminSchools;
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);
  const Icon = coordinator ? UserCog : UserPlus;

  async function undo(target: NonNullable<SchoolDialogDone["undo"]>) {
    try {
      const result = await undoSchoolChange(target);
      setToast(nextToast(result.ok ? { message: t.toasts.undone } : { message: t.errors[result.error], tone: "error" }));
    } catch {
      setToast(nextToast({ message: t.errors.failed, tone: "error" }));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
        aria-label={format(coordinator ? t.changeFor : t.assignFor, { school: schoolName })}
        className="inline-flex h-9 flex-none items-center justify-center gap-1.5 rounded-[10px] border border-line bg-transparent px-3 text-[13px] font-bold whitespace-nowrap text-fg-2 transition-colors hover:border-accent hover:text-fg"
      >
        <Icon className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
        {coordinator ? t.change : t.assign}
      </button>
      {session > 0 ? (
        <SchoolDialog
          key={session}
          mode={{ kind: "coordinator", schoolId, schoolName, coordinator, coordinatorApproves }}
          open={open}
          onClose={() => setOpen(false)}
          onDone={(done) => {
            setOpen(false);
            const target = done.undo;
            setToast(nextToast({ message: done.message, undo: target ? () => void undo(target) : undefined }));
          }}
        />
      ) : null}
      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
