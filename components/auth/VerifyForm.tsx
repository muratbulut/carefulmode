"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { changeUnverifiedEmail, resendVerificationCode, verifyEmail } from "@/lib/account/actions";
import { codeLength, deadlineFrom, formatClock, idleState, type Deadline, type FormState } from "@/lib/account/shared";
import { format, getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AuthHeading } from "./AuthShell";
import { CodeInput } from "./CodeInput";
import { Field, Notice, SubmitButton, describedBy, inputClass, primaryButtonClass } from "./fields";
import { RememberDevice } from "./RememberDevice";
import { useSecondsLeft } from "./useSecondsLeft";

/**
 * E-posta doğrulama (Tur 1, ekran 7; tahta: Dogrulama-Masaustu, Dogrulama-Mobil).
 * `cooldownSec`: kayıtla giden ilk koddan sonra "tekrar gönder" için kalan süre (sunucudan).
 */
export function VerifyForm({ email: initialEmail, next, cooldownSec }: { email: string; next?: string; cooldownSec: number }) {
  const t = getMessages().auth;
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  // Yeni kod istenince kutular boşalır (CodeInput yeniden kurulur).
  const [round, setRound] = useState(0);
  const [deadline, setDeadline] = useState<Deadline | undefined>(() => deadlineFrom(cooldownSec, Date.now()));
  const [notice, setNotice] = useState<FormState>(idleState);
  const [changing, setChanging] = useState(false);
  const [resending, startResend] = useTransition();
  const wait = useSecondsLeft(deadline);

  const [state, action] = useActionState(verifyEmail, idleState);
  const verified = state.status === "ok";

  useEffect(() => {
    if (!verified) return;
    const id = setTimeout(() => router.replace(state.redirectTo ?? "/"), 1200);
    return () => clearTimeout(id);
  }, [verified, state.redirectTo, router]);

  function resend() {
    startResend(async () => {
      const result = await resendVerificationCode();
      setNotice(result);
      if (result.retryAfterSec) setDeadline(deadlineFrom(result.retryAfterSec, Date.now()));
      if (result.code === "sent") {
        setRound((r) => r + 1);
        setCode("");
      }
    });
  }

  function onEmailChanged(result: FormState) {
    if (result.status !== "ok" || !result.email) return;
    setEmail(result.email);
    setChanging(false);
    setNotice(result);
    if (result.retryAfterSec) setDeadline(deadlineFrom(result.retryAfterSec, Date.now()));
    setRound((r) => r + 1);
    setCode("");
  }

  // Yeni kod bildirimi doğrulama sonucundan sonra geldiyse o görünür; doğrula'ya basınca silinir.
  const fresh = notice.status === "idle";
  const codeState = verified ? "ok" : fresh && (state.code === "wrong" || state.code === "expired") ? "bad" : "idle";

  return (
    <>
      <RememberDevice />
      <AuthHeading
        title={t.verify.title}
        lead={rich(format(t.verify.sentTo, { email }), {
          email: (chunk) => <b className="break-all text-fg">{chunk}</b>,
        })}
      />
      <form
        action={(form) => {
          setNotice(idleState);
          return action(form);
        }}
        className="flex flex-col gap-[18px]"
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <CodeInput key={round} label={t.code.label} state={codeState} onChange={setCode} />
        {verified ? (
          <Notice tone="good" className="font-bold anim-pop">
            {t.verify.success}
          </Notice>
        ) : !fresh ? (
          <Notice tone={notice.status === "error" ? "warn" : "accent"}>
            {notice.code === "rate_limited" ? format(t.errors.tooMany, { time: formatClock(wait) }) : notice.message}
          </Notice>
        ) : state.status === "error" ? (
          <Notice tone={state.code === "rate_limited" ? "warn" : "bad"} live="assertive">
            {state.message ?? t.errors.generic}
          </Notice>
        ) : null}
        <SubmitButton disabled={code.length !== codeLength || verified}>{t.verify.submit}</SubmitButton>
      </form>

      <div className="flex flex-col items-center gap-2.5 text-[15px] text-fg-3">
        <button
          type="button"
          onClick={resend}
          disabled={wait > 0 || resending || verified}
          className={cn("min-h-11 cursor-pointer px-3 font-bold text-accent-fg disabled:cursor-not-allowed disabled:text-fg-4")}
        >
          {wait > 0 ? format(t.code.resendIn, { time: formatClock(wait) }) : t.code.resend}
        </button>
        {changing ? (
          <ChangeEmailForm current={email} onDone={onEmailChanged} onCancel={() => setChanging(false)} />
        ) : (
          <p>
            {t.verify.wrongEmail}{" "}
            <button type="button" onClick={() => setChanging(true)} className="cursor-pointer font-bold text-accent-fg hover:underline">
              {t.verify.change}
            </button>
          </p>
        )}
      </div>
    </>
  );
}

function ChangeEmailForm({ current, onDone, onCancel }: { current: string; onDone: (r: FormState) => void; onCancel: () => void }) {
  const t = getMessages().auth;
  const [value, setValue] = useState(current);
  const [state, action, pending] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await changeUnverifiedEmail(prev, form);
    onDone(result);
    return result;
  }, idleState);
  const error = state.fieldErrors?.email ?? (state.status === "error" ? state.message : undefined);

  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-left anim-pop">
      <Field id="new-email" label={t.verify.newEmail} error={error}>
        <input
          id="new-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
          {...describedBy("new-email", { error })}
        />
      </Field>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-11 flex-1 cursor-pointer rounded-xl border border-line bg-card font-bold text-fg">
          {t.verify.cancel}
        </button>
        <button type="submit" disabled={pending} className={cn(primaryButtonClass, "h-11 flex-[2] text-base")}>
          {t.verify.saveEmail}
        </button>
      </div>
    </form>
  );
}
