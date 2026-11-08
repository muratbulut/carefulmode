"use client";

import { Check, User } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { EducationFields } from "@/components/auth/EducationFields";
import { CodeInput } from "@/components/auth/CodeInput";
import {
  Field,
  Notice,
  PasswordInput,
  SubmitButton,
  compactButtonClass,
  describedBy,
  inputClass,
} from "@/components/auth/fields";
import { useSecondsLeft } from "@/components/auth/useSecondsLeft";
import { confirmEmailChange, requestEmailChange, updateProfile } from "@/lib/account/profile-actions";
import {
  codeLength,
  deadlineFrom,
  formatClock,
  idleState,
  splitGradeLevel,
  type Deadline,
  type FormState,
} from "@/lib/account/shared";
import { format, getMessages, rich } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Dialog } from "./Dialog";
import { SectionCard } from "./SectionCard";
import type { ProfileUser } from "./types";

const readonlyBox = "flex min-h-[50px] items-center gap-2.5 rounded-xl border border-card bg-surface-deep px-3.5 text-base text-fg";

/** Hesap bilgileri: görünen ad, e-posta (kodla değişir), doğum yılı (değişmez), eğitim durumu. */
export function AccountSection({ user, onDone }: { user: ProfileUser; onDone: (message: string) => void }) {
  const t = getMessages().profile;
  const a = t.account;
  const [name, setName] = useState(user.name);
  const [changing, setChanging] = useState(false);
  const [state, action] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await updateProfile(prev, form);
    if (result.status === "ok" && result.message) onDone(result.message);
    return result;
  }, idleState);
  const trimmed = name.trim();
  const nameError = trimmed.length < 2 || trimmed.length > 24 ? getMessages().auth.errors.nameLength : state.fieldErrors?.name;

  return (
    <SectionCard Icon={User} title={a.title}>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field id="profile-name" label={a.name} hint={a.nameHint} error={name === user.name ? undefined : nameError}>
            <input
              id="profile-name"
              name="name"
              autoComplete="nickname"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              {...describedBy("profile-name", { hint: a.nameHint, error: name === user.name ? undefined : nameError })}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-bold text-fg-2">{a.email}</p>
            <div className={readonlyBox}>
              <span className="min-w-0 flex-1 truncate">{user.email}</span>
              {user.emailVerified ? (
                <span className="inline-flex flex-none items-center gap-1 text-xs font-bold text-success">
                  <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
                  {a.verified}
                </span>
              ) : (
                <span className="flex-none text-xs font-bold text-warning-fg">{a.unverified}</span>
              )}
            </div>
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] leading-[1.45] text-fg-4">
              {user.emailVerified ? a.emailHint : a.verifyHint}
              {user.emailVerified ? (
                <button type="button" onClick={() => setChanging(true)} className="-my-2.5 cursor-pointer py-2.5 font-bold text-accent-fg hover:underline">
                  {a.change}
                </button>
              ) : (
                <Link href={routes.verify} className="-my-2.5 py-2.5 font-bold">
                  {a.verifyNow}
                </Link>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-bold text-fg-2">{a.birthYear}</p>
            <div className={readonlyBox}>{user.birthYear ?? a.notGiven}</div>
            <p className="text-[13px] leading-[1.45] text-fg-4">{a.birthYearHint}</p>
          </div>
        </div>

        <EducationFields initial={splitGradeLevel(user.educationStatus, user.gradeLevel)} error={state.fieldErrors?.department} />

        {state.status === "error" && state.message ? (
          <Notice tone="bad" live="assertive">
            {state.message}
          </Notice>
        ) : null}
        <SubmitButton disabled={!!nameError} className={compactButtonClass}>
          {a.save}
        </SubmitButton>
      </form>

      <EmailChangeDialog
        open={changing}
        onClose={() => setChanging(false)}
        onDone={(message) => {
          setChanging(false);
          onDone(message);
        }}
      />
    </SectionCard>
  );
}

/** E-posta değiştirme: önce yeni adres ve şifre, sonra yeni adrese gelen 6 haneli kod. */
function EmailChangeDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const titleId = useId();
  const t = getMessages().profile.account;
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId}>
      <h2 id={titleId} className="font-heading text-[22px] leading-tight font-bold">
        {t.changeEmailTitle}
      </h2>
      {open ? <EmailChangeSteps onClose={onClose} onDone={onDone} /> : null}
    </Dialog>
  );
}

function EmailChangeSteps({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const m = getMessages();
  const e = m.profile.email;
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [deadline, setDeadline] = useState<Deadline | undefined>();
  const wait = useSecondsLeft(deadline);

  const [sendState, sendAction] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await requestEmailChange(prev, form);
    if (result.retryAfterSec) setDeadline(deadlineFrom(result.retryAfterSec, Date.now()));
    if (result.status === "ok" && result.email) setSentTo(result.email);
    return result;
  }, idleState);

  const [codeState, codeAction] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await confirmEmailChange(prev, form);
    if (result.status === "ok" && result.message) onDone(result.message);
    return result;
  }, idleState);

  if (sentTo) {
    return (
      <form action={codeAction} className="flex flex-col gap-4 anim-slide-in">
        <p className="text-[15px] leading-normal text-fg-3">
          {rich(format(e.codeLead, { email: sentTo }), { email: (chunk) => <b className="break-all text-fg">{chunk}</b> })}
        </p>
        <input type="hidden" name="email" value={sentTo} />
        <CodeInput label={e.codeLabel} state={codeState.status === "error" ? "bad" : "idle"} onChange={setCode} />
        {codeState.status === "error" && codeState.message ? (
          <Notice tone="bad" live="assertive">
            {codeState.message}
          </Notice>
        ) : null}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-12 flex-1 cursor-pointer rounded-xl border border-line bg-card font-bold text-fg">
            {e.cancel}
          </button>
          <div className="flex-[2]">
            <SubmitButton disabled={code.length !== codeLength} className="h-12 text-base">
              {e.confirm}
            </SubmitButton>
          </div>
        </div>
      </form>
    );
  }

  const errors = sendState.fieldErrors ?? {};
  return (
    <form action={sendAction} className="flex flex-col gap-4" noValidate>
      <Field id="new-email" label={e.newEmail} error={errors.email}>
        <input
          id="new-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          className={inputClass}
          {...describedBy("new-email", { error: errors.email })}
        />
      </Field>
      <Field id="email-password" label={e.password} hint={e.passwordHint} error={errors.password}>
        {/* Denetimsiz alan: gönderimden sonra boşalır. */}
        <PasswordInput
          id="email-password"
          name="password"
          autoComplete="current-password"
          required
          {...describedBy("email-password", { hint: e.passwordHint, error: errors.password })}
        />
      </Field>
      {sendState.status === "error" && sendState.message ? (
        <Notice tone="warn" live="assertive">
          {sendState.code === "rate_limited" ? format(m.auth.errors.tooMany, { time: formatClock(wait) }) : sendState.message}
        </Notice>
      ) : null}
      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="h-12 flex-1 cursor-pointer rounded-xl border border-line bg-card font-bold text-fg">
          {e.cancel}
        </button>
        <div className={cn("flex-[2]")}>
          <SubmitButton disabled={!/.+@.+\..+/.test(email) || wait > 0} className="h-12 text-base">
            {e.send}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
