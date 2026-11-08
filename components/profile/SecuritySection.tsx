"use client";

import { KeyRound, Monitor, Smartphone, Tablet } from "lucide-react";
import { useActionState, useMemo, useState, useTransition } from "react";
import { Field, Notice, PasswordInput, SubmitButton, compactButtonClass, describedBy } from "@/components/auth/fields";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { useSecondsLeft } from "@/components/auth/useSecondsLeft";
import { changePassword, signOutOtherDevices } from "@/lib/account/profile-actions";
import { deadlineFrom, formatClock, idleState, type FormState } from "@/lib/account/shared";
import { format, getMessages } from "@/lib/i18n";
import { evaluatePassword, personalTokens } from "@/lib/password-strength";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import type { ProfileSession } from "./types";

const kindIcons = { desktop: Monitor, phone: Smartphone, tablet: Tablet } as const;

type Result = FormState & { deadline?: ReturnType<typeof deadlineFrom> };

/** Şifre değiştirme ve açık oturumlar (tahta: Profil-P2-Son, Güvenlik). */
export function SecuritySection({
  name,
  email,
  sessions,
  onDone,
}: {
  name: string;
  email: string;
  sessions: ProfileSession[];
  onDone: (message: string) => void;
}) {
  const m = getMessages();
  const s = m.profile.security;
  const [password, setPassword] = useState("");
  const [round, setRound] = useState(0);
  const evaluation = useMemo(() => evaluatePassword(password, personalTokens(name, email)), [password, name, email]);
  const [state, action] = useActionState<Result, FormData>(async (prev, form) => {
    const result = await changePassword(prev, form);
    if (result.status === "ok" && result.message) {
      onDone(result.message);
      setPassword("");
      setRound((n) => n + 1);
    }
    return { ...result, deadline: deadlineFrom(result.retryAfterSec, Date.now()) };
  }, idleState);
  const wait = useSecondsLeft(state.deadline);
  const errors = state.fieldErrors ?? {};
  const [signingOut, startSignOut] = useTransition();
  const others = sessions.filter((session) => !session.current).length;

  return (
    <SectionCard Icon={KeyRound} tone="success" title={s.title} lead={s.lead}>
      <form key={round} action={action} className="flex flex-col gap-4" noValidate>
        {/* Tarayıcının şifre yöneticisi yeni şifreyi doğru hesaba kaydetsin. */}
        <input type="hidden" name="username" autoComplete="username" value={email} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field id="current-password" label={s.currentPassword} error={errors.password}>
            <PasswordInput
              id="current-password"
              name="password"
              autoComplete="current-password"
              required
              {...describedBy("current-password", { error: errors.password })}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <Field id="profile-new-password" label={s.newPassword} error={errors.newPassword}>
              <PasswordInput
                id="profile-new-password"
                name="newPassword"
                autoComplete="new-password"
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="profile-password-strength"
              />
            </Field>
          </div>
        </div>
        <PasswordStrength id="profile-password-strength" password={password} evaluation={evaluation} />
        {state.code === "rate_limited" && wait > 0 ? (
          <Notice tone="warn" live="assertive">
            {format(m.auth.errors.tooMany, { time: formatClock(wait) })}
          </Notice>
        ) : state.status === "error" && state.message ? (
          <Notice tone="bad" live="assertive">
            {state.message}
          </Notice>
        ) : null}
        <SubmitButton disabled={!evaluation.accepted || wait > 0} className={compactButtonClass}>
          {s.submit}
        </SubmitButton>
      </form>

      <div className="flex flex-col gap-2.5 border-t border-card pt-4">
        <h3 className="text-base font-bold">{s.sessions}</h3>
        <ul className="flex flex-col gap-2">
          {sessions.map((session) => {
            const Icon = kindIcons[session.kind];
            const device = format(s.device, {
              kind: session.current ? s.thisDevice : s.kinds[session.kind],
              browser: [session.browser ?? s.unknownBrowser, session.os].filter(Boolean).join(", "),
            });
            return (
              <li key={session.id} className="flex items-center gap-3 rounded-xl bg-surface-deep px-3.5 py-3">
                <Icon className="size-[18px] flex-none text-fg-2" strokeWidth={2} aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm">{device}</b>
                  <span className="text-xs text-fg-3">{session.lastActive ?? s.now}</span>
                </span>
                {session.current ? <span className="text-xs font-bold text-success">{s.active}</span> : null}
              </li>
            );
          })}
        </ul>
        {others > 0 ? (
          <button
            type="button"
            disabled={signingOut}
            onClick={() =>
              startSignOut(async () => {
                const result = await signOutOtherDevices();
                if (result.message) onDone(result.message);
              })
            }
            className={cn(
              "inline-flex h-11 cursor-pointer items-center self-start rounded-xl border border-line bg-surface px-4 text-[15px] font-bold text-fg transition-colors hover:border-line-strong disabled:opacity-50",
            )}
          >
            {s.signOutOthers}
          </button>
        ) : (
          <p className="text-[13px] text-fg-3">{s.onlyThisDevice}</p>
        )}
        <p className="text-xs leading-normal text-fg-4">{s.sessionsHint}</p>
      </div>
    </SectionCard>
  );
}
