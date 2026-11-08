"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useId, useState, useTransition } from "react";
import { Field, describedBy, inputClass } from "@/components/auth/fields";
import { cancelDeletion, scheduleDeletion } from "@/lib/account/profile-actions";
import { idleState, isDeleteWord, type FormState } from "@/lib/account/shared";
import { format, getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Dialog } from "./Dialog";
import { SectionCard } from "./SectionCard";

const dangerButton =
  "inline-flex h-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-danger/45 bg-danger/8 px-4 text-[15px] font-bold text-danger-fg transition-colors hover:bg-danger/14";

/**
 * Hesabı sil: "SİL" yazılınca açılan onay penceresi, sonra 7 günlük bekleme şeridi
 * (bu sürede giriş yapınca ya da "Silmeyi iptal et" ile geri alınır).
 */
export function DeleteSection({ deletionOn, onDone }: { deletionOn: string | null; onDone: (message: string) => void }) {
  const t = getMessages().profile.delete;
  const [confirming, setConfirming] = useState(false);
  const [cancelling, startCancel] = useTransition();
  const titleId = useId();

  return (
    <SectionCard Icon={Trash2} tone="danger" title={t.title} danger>
      {deletionOn ? (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-deep p-3.5 sm:flex-row sm:items-center sm:gap-4">
          <p className="flex-1 text-sm leading-normal text-fg-2">{format(t.scheduled, { date: deletionOn })}</p>
          <button
            type="button"
            disabled={cancelling}
            onClick={() =>
              startCancel(async () => {
                const result = await cancelDeletion();
                if (result.message) onDone(result.message);
              })
            }
            className="inline-flex h-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-canvas px-4 text-[15px] font-bold text-fg disabled:opacity-50"
          >
            {t.undo}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <p className="flex-1 text-sm leading-normal text-fg-2">{t.text}</p>
          <button type="button" onClick={() => setConfirming(true)} className={dangerButton}>
            {t.button}
          </button>
        </div>
      )}

      <Dialog open={confirming} onClose={() => setConfirming(false)} labelledBy={titleId}>
        <span className="flex size-12 items-center justify-center rounded-[14px] bg-danger/14">
          <Trash2 className="size-[22px] text-danger-fg" strokeWidth={2} aria-hidden="true" />
        </span>
        <h2 id={titleId} className="font-heading text-[22px] leading-tight font-bold">
          {t.confirmTitle}
        </h2>
        <ConfirmForm
          onCancel={() => setConfirming(false)}
          onDone={(message) => {
            setConfirming(false);
            onDone(message);
          }}
        />
      </Dialog>
    </SectionCard>
  );
}

function ConfirmForm({ onCancel, onDone }: { onCancel: () => void; onDone: (message: string) => void }) {
  const t = getMessages().profile.delete;
  const [word, setWord] = useState("");
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await scheduleDeletion(prev, form);
    if (result.status === "ok" && result.message) onDone(result.message);
    return result;
  }, idleState);
  const ready = isDeleteWord(word, t.confirmWord);
  const error = state.fieldErrors?.confirm;
  const label = rich(format(t.confirmText, { word: t.confirmWord }), { b: (chunk) => <b className="text-fg">{chunk}</b> });

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field id="delete-confirm" label={<span className="font-medium text-fg-2">{label}</span>} error={error}>
        <input
          id="delete-confirm"
          name="confirm"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          className={cn(inputClass, "font-mono tracking-[2px]")}
          {...describedBy("delete-confirm", { error })}
        />
      </Field>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-12 flex-1 cursor-pointer rounded-xl border border-line bg-card font-bold text-fg">
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={!ready || pending}
          className="h-12 flex-[2] cursor-pointer rounded-xl bg-danger font-bold text-on-danger transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
        >
          {t.button}
        </button>
      </div>
    </form>
  );
}
