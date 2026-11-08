"use client";

import { useId, useState, useTransition } from "react";
import { Sheet } from "@/components/classroom/Sheet";
import { SwitchTrack } from "@/components/common/SwitchTrack";
import { Spinner } from "@/components/status/Spinner";
import type { TeamPermission } from "@/lib/admin/access";
import type { TeamMemberView } from "@/lib/admin/team";
import { removeTeamMember, updateTeamMember } from "@/lib/admin/team-actions";
import { grantableOrder, type TeamRole } from "@/lib/admin/team-rules";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type TeamCardMember = TeamMemberView & {
  /** Kartın alt satırı: eklendiği gün, ekleyen, "sen" (sunucuda yazılır). */
  meta: string;
};

/** Pencerenin sonucu: bildirim ve (değiştiyse) geri alınacak işlem. */
export type TeamEditDone = { message: string; undo?: { userId: string; op: string } };

const roles: TeamRole[] = ["MEMBER", "ADMIN"];

/**
 * "İzinleri düzenle" penceresi (Kullanicilar-Son "İzinler"): rol (Sorumlu / Yönetici), sorumlunun
 * izinleri (anahtarlar) ve "Ekipten çıkar". İzinsiz sorumluyu kaydetmek çıkarma onayını açar.
 * Öğrenci hesabında yalnızca İpucu ve Gündem açılır, yönetici seçilemez. ADMIN_EMAILS'teki
 * yönetici buradan yöneticilikten ya da ekipten çıkarılamaz. Kayıt sunucuda yeniden denetlenir.
 */
export function EditTeamMemberDialog({
  member,
  open,
  onClose,
  onDone,
}: {
  member: TeamCardMember;
  open: boolean;
  onClose: () => void;
  onDone: (done: TeamEditDone) => void;
}) {
  const t = getMessages().adminTeam;
  const e = t.editDialog;
  const ids = useId();
  const [role, setRole] = useState<TeamRole>(member.role);
  const [permissions, setPermissions] = useState<TeamPermission[]>(member.role === "ADMIN" ? [] : member.permissions);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(permission: TeamPermission) {
    setError(null);
    setPermissions((list) => (list.includes(permission) ? list.filter((p) => p !== permission) : [...list, permission]));
  }

  function act(work: () => Promise<TeamEditDone | string>) {
    startTransition(async () => {
      try {
        const result = await work();
        if (typeof result === "string") setError(result);
        else onDone(result);
      } catch {
        setError(t.errors.failed);
      }
    });
  }

  function save() {
    if (role === "MEMBER" && permissions.length === 0) {
      setConfirm(true);
      return;
    }
    act(async () => {
      const result = await updateTeamMember({ userId: member.id, role, permissions: role === "ADMIN" ? [] : permissions });
      if (!result.ok) return t.errors[result.error];
      if (!result.changed || !result.op) return { message: t.toasts.unchanged };
      return { message: format(t.toasts.saved, { name: result.name }), undo: { userId: member.id, op: result.op } };
    });
  }

  function remove() {
    act(async () => {
      const result = await removeTeamMember(member.id);
      if (!result.ok) return t.errors[result.error];
      return { message: format(t.toasts.removed, { name: result.name }), undo: { userId: member.id, op: result.op } };
    });
  }

  const titleId = `${ids}-title`;
  const secondary = "inline-flex h-11 items-center justify-center rounded-xl border border-line bg-surface-raised px-4 text-sm font-bold text-fg";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      closeLabel={getMessages().admin.close}
      className="lg:max-w-[480px]"
      title={
        <h2 id={titleId} className="m-0 font-heading text-[22px] font-bold">
          {e.title}
        </h2>
      }
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-card text-[22px]">
          {member.avatar}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <b className="text-base">{member.name}</b>
          <span className="text-xs text-fg-4">{member.meta}</span>
        </span>
      </div>

      <div role="radiogroup" aria-label={e.roleLabel} className="flex gap-1 rounded-xl border border-line bg-surface-deep p-1">
        {roles.map((key) => {
          const on = role === key;
          const locked = (key === "ADMIN" && member.studentAccount) || (key === "MEMBER" && member.configuredAdmin);
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={locked}
              onClick={() => {
                setRole(key);
                setError(null);
                setConfirm(false);
              }}
              className={cn(
                "h-10 flex-1 rounded-[10px] text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                on ? "bg-accent text-on-accent" : "bg-transparent text-fg-2",
              )}
            >
              {t.addDialog.roleOptions[key].title}
            </button>
          );
        })}
      </div>

      {member.configuredAdmin ? <p className="m-0 text-[13px] leading-normal text-fg-3">{e.configured}</p> : null}

      {role === "MEMBER" ? (
        <div className="flex flex-col gap-2">
          {grantableOrder.map((permission) => {
            const on = permissions.includes(permission);
            const locked = !member.allowed.includes(permission);
            return (
              <button
                key={permission}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={locked}
                onClick={() => toggle(permission)}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface-deep px-3 py-2.5 text-left text-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="flex flex-1 flex-col gap-px">
                  <b className="text-sm">{t.permissions[permission].title}</b>
                  <span className="text-xs text-fg-4">{locked && member.studentAccount ? t.notForStudent : t.permissions[permission].text}</span>
                </span>
                <SwitchTrack on={on} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-warning/30 bg-warning/8 px-3.5 py-3 text-[13px] leading-normal text-fg">{e.adminText}</div>
      )}

      {error ? (
        <p role="alert" className="m-0 text-[13px] text-danger-fg">
          {error}
        </p>
      ) : null}

      {confirm ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-danger/35 bg-danger/8 p-3.5 [animation:fade-up_.25s_ease-out_both]">
          <span className="text-sm leading-normal">
            <b>{format(e.removeQuestion, { name: member.name })}</b> {e.removeText}
          </span>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => setConfirm(false)} className={cn(secondary, "flex-1")}>
              {e.cancel}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-danger text-sm font-bold text-on-danger"
            >
              {pending ? <Spinner className="border-on-danger/30 border-t-on-danger" /> : null}
              {e.removeConfirm}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          {member.configuredAdmin ? null : (
            <button
              type="button"
              onClick={() => {
                setConfirm(true);
                setError(null);
              }}
              className="h-11 px-1 text-sm font-bold text-danger-fg"
            >
              {e.remove}
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={onClose} className={secondary}>
            {e.cancel}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent disabled:opacity-70"
          >
            {pending ? <Spinner className="border-on-accent/30 border-t-on-accent" /> : null}
            {pending ? e.saving : e.save}
          </button>
        </div>
      )}
    </Sheet>
  );
}
