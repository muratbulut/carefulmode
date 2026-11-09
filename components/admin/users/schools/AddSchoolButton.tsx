"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { nextToast, UndoToast, type ToastData } from "@/components/admin/UndoToast";
import { undoSchoolChange } from "@/lib/admin/school-admin-actions";
import { getMessages } from "@/lib/i18n";
import { SchoolDialog, type SchoolDialogDone } from "./SchoolDialog";

/**
 * "Okul ekle" düğmesi ve penceresi (Kullanicilar-Son-Okullar, sayfa başlığı). Eklendikten sonra
 * 5 saniyelik "Geri al" çıkar; geri alma okulu yalnızca ona henüz hiçbir şey bağlanmadıysa siler.
 */
export function AddSchoolButton() {
  const t = getMessages().adminSchools;
  const [open, setOpen] = useState(false);
  // Her açılışta pencere boş başlar.
  const [session, setSession] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);

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
        className="inline-flex h-[46px] items-center justify-center gap-2 self-start rounded-xl bg-accent px-[18px] text-[15px] font-bold text-on-accent transition-[filter] hover:brightness-110"
      >
        <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
        {t.add}
      </button>
      {session > 0 ? (
        <SchoolDialog
          key={session}
          mode={{ kind: "new" }}
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
