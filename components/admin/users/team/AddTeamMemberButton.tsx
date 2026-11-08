"use client";

import { Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { nextToast, UndoToast, type ToastData } from "@/components/admin/UndoToast";
import { undoTeamChange } from "@/lib/admin/team-actions";
import { format, getMessages } from "@/lib/i18n";
import { AddTeamMemberDialog, type TeamAdded } from "./AddTeamMemberDialog";

/**
 * "Ekibe kişi ekle" düğmesi ve penceresi (Kullanicilar-Son). Sayfa başlığında düğme; Yönetim ekibi
 * sekmesinde kartların sonunda kesik çizgili kart (variant="card"). Eklendikten sonra 5 saniyelik
 * "Geri al" çıkar; "ekibe eklendin" maili geri al süresi bitince gider.
 */
export function AddTeamMemberButton({ variant = "button" }: { variant?: "button" | "card" }) {
  const t = getMessages().adminTeam;
  const [open, setOpen] = useState(false);
  // Her açılışta pencere boş başlar.
  const [session, setSession] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);

  function show() {
    setSession((n) => n + 1);
    setOpen(true);
  }

  async function undo(added: TeamAdded) {
    try {
      const result = await undoTeamChange({ userId: added.userId, op: added.op });
      setToast(nextToast(result.ok ? { message: t.toasts.undone } : { message: t.errors[result.error], tone: "error" }));
    } catch {
      setToast(nextToast({ message: t.errors.failed, tone: "error" }));
    }
  }

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={show}
          className="flex min-h-24 flex-col items-center justify-center gap-2.5 rounded-[20px] border-2 border-dashed border-line bg-transparent p-4 text-[15px] font-bold text-fg-3 transition-colors hover:border-accent hover:text-fg lg:min-h-[170px]"
        >
          <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-card">
            <Plus className="size-5" strokeWidth={2.2} />
          </span>
          {t.add}
        </button>
      ) : (
        <button
          type="button"
          onClick={show}
          className="inline-flex h-[46px] items-center justify-center gap-2 self-start rounded-xl bg-accent px-[18px] text-[15px] font-bold text-on-accent transition-[filter] hover:brightness-110"
        >
          <UserPlus className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          {t.add}
        </button>
      )}
      {session > 0 ? (
        <AddTeamMemberDialog
          key={session}
          open={open}
          onClose={() => setOpen(false)}
          onAdded={(added) => {
            setOpen(false);
            setToast(nextToast({ message: format(t.toasts.added, { name: added.name }), undo: () => void undo(added) }));
          }}
        />
      ) : null}
      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
