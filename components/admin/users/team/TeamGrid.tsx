"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { nextToast, UndoToast, type ToastData } from "@/components/admin/UndoToast";
import { undoTeamChange } from "@/lib/admin/team-actions";
import { roleLabelOf } from "@/lib/admin/team-rules";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AddTeamMemberButton } from "./AddTeamMemberButton";
import { EditTeamMemberDialog, type TeamCardMember, type TeamEditDone } from "./EditTeamMemberDialog";

/**
 * Yönetim ekibinin kartları (Kullanicilar-Son, Yönetim ekibi sekmesi): masaüstünde üç sütun,
 * telefonda tek sütun; sonda "Ekibe kişi ekle" kartı. Kişinin rolü, izinleri, ne zaman ve kimin
 * eklediği; kendi kartı dışında "İzinleri düzenle". Her değişiklikten sonra 5 saniyelik "Geri al".
 */
export function TeamGrid({ members }: { members: TeamCardMember[] }) {
  const t = getMessages().adminTeam;
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // Her açılışta pencere kişinin güncel haliyle baştan başlar.
  const [session, setSession] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);
  const member = members.find((m) => m.id === editing) ?? null;

  async function undo(target: NonNullable<TeamEditDone["undo"]>) {
    try {
      const result = await undoTeamChange(target);
      setToast(nextToast(result.ok ? { message: t.toasts.undone } : { message: t.errors[result.error], tone: "error" }));
    } catch {
      setToast(nextToast({ message: t.errors.failed, tone: "error" }));
    }
  }

  function done(result: TeamEditDone) {
    setOpen(false);
    const target = result.undo;
    setToast(nextToast({ message: result.message, undo: target ? () => void undo(target) : undefined }));
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-3 lg:gap-4">
        {members.map((m) => (
          <TeamCard
            key={m.id}
            member={m}
            onEdit={() => {
              setEditing(m.id);
              setSession((n) => n + 1);
              setOpen(true);
            }}
          />
        ))}
        <AddTeamMemberButton variant="card" />
      </div>
      {member ? <EditTeamMemberDialog key={`${member.id}-${session}`} member={member} open={open} onClose={() => setOpen(false)} onDone={done} /> : null}
      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

function TeamCard({ member, onEdit }: { member: TeamCardMember; onEdit: () => void }) {
  const t = getMessages().adminTeam;
  const label = roleLabelOf(member);
  return (
    <article aria-label={member.name} className="flex min-w-0 flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-[18px]">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-card text-[22px]">
          {member.avatar}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <b className="text-base leading-snug [overflow-wrap:anywhere]">{member.name}</b>
          <span className="text-xs text-fg-4">{member.meta}</span>
        </span>
        <span
          className={cn(
            "inline-flex h-6 flex-none items-center gap-1.5 rounded-full px-[9px] text-xs font-bold whitespace-nowrap",
            label === "admin" ? "bg-warning/14 text-warning-fg" : "bg-purple/14 text-purple-fg",
          )}
        >
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", label === "admin" ? "bg-warning" : "bg-purple")} />
          {t.roles[label]}
        </span>
      </div>
      {member.role === "ADMIN" ? (
        <span className="text-[13px] leading-normal text-fg-2">{t.adminAll}</span>
      ) : member.permissions.length > 0 ? (
        <ul aria-label={t.editDialog.title} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {member.permissions.map((p) => (
            <li key={p} className="inline-flex h-[26px] items-center rounded-lg bg-card px-2.5 text-xs font-bold text-fg-2">
              {t.permissions[p].title}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[13px] text-fg-3">{t.noPermissions}</span>
      )}
      {member.me ? null : (
        <button
          type="button"
          onClick={onEdit}
          aria-label={format(t.editFor, { name: member.name })}
          className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-[10px] border border-line bg-transparent px-3 text-[13px] font-bold text-fg-2 transition-colors hover:border-accent hover:text-fg"
        >
          <Pencil className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
          {t.edit}
        </button>
      )}
    </article>
  );
}
