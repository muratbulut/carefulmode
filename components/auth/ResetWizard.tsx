"use client";

import { ArrowLeft, AtSign, Check, KeyRound, LockKeyhole, MailCheck, MailOpen } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { checkResetCode, requestPasswordReset, resetPassword } from "@/lib/account/actions";
import { codeLength, deadlineFrom, formatClock, idleState, type Deadline, type FormState } from "@/lib/account/shared";
import { format, getMessages, rich } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { evaluatePassword, personalTokens } from "@/lib/password-strength";
import { cn } from "@/lib/utils";
import { AuthHeading } from "./AuthShell";
import { CodeInput } from "./CodeInput";
import { Field, Notice, PasswordInput, SubmitButton, describedBy, inputClass, primaryButtonClass } from "./fields";
import { PasswordStrength } from "./PasswordStrength";
import { useSecondsLeft } from "./useSecondsLeft";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const introIcons = [AtSign, MailOpen, KeyRound, LockKeyhole];

/**
 * Şifremi unuttum (Tur 1, ekran 8; tahta: Sifre-Sifirlama): önce 4 adımlık rehber, sonra
 * e-posta, "kod gönderildi", 6 haneli kod ve yeni şifre. Mail ile bağlantı değil kod gönderilir;
 * "maildeki bağlantıya tıkla" alışkanlığı öğretilmez. "Kod gönderildi" ekranı hesap olsa da
 * olmasa da aynıdır.
 */
export function ResetWizard() {
  const t = getMessages().auth;
  const r = t.reset;
  const [step, setStep] = useState<Step>(0);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [round, setRound] = useState(0);
  const [password, setPassword] = useState("");
  const [deadline, setDeadline] = useState<Deadline | undefined>();
  const [resendNotice, setResendNotice] = useState<FormState>(idleState);
  const [resending, startResend] = useTransition();
  const wait = useSecondsLeft(deadline);
  const evaluation = useMemo(() => evaluatePassword(password, personalTokens(email)), [password, email]);

  const [sendState, sendAction] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await requestPasswordReset(prev, form);
    if (result.retryAfterSec) setDeadline(deadlineFrom(result.retryAfterSec, Date.now()));
    if (result.status === "ok") setStep(2);
    return result;
  }, idleState);

  const [codeState, codeAction] = useActionState(async (prev: FormState, form: FormData) => {
    setResendNotice(idleState);
    const result = await checkResetCode(prev, form);
    if (result.status === "ok") setStep(4);
    return result;
  }, idleState);

  const [passwordState, passwordAction] = useActionState(async (prev: FormState, form: FormData) => {
    const result = await resetPassword(prev, form);
    if (result.status === "ok") setStep(5);
    // Kod bu arada geçersizleştiyse (süre doldu) kod adımına dönülür.
    if (result.code === "expired" || result.code === "wrong") setStep(3);
    return result;
  }, idleState);

  function resend() {
    startResend(async () => {
      const form = new FormData();
      form.set("email", email);
      const result = await requestPasswordReset(idleState, form);
      if (result.retryAfterSec) setDeadline(deadlineFrom(result.retryAfterSec, Date.now()));
      setResendNotice(result.status === "ok" ? { status: "ok", message: t.code.resent } : result);
      if (result.status === "ok") {
        setRound((n) => n + 1);
        setCode("");
      }
    });
  }

  const emailBold = (chunk: string) => <b className="break-all text-fg">{chunk}</b>;

  if (step === 0) {
    return (
      <div className="flex flex-col gap-[22px]">
        <AuthHeading title={r.introTitle} lead={r.introLead} />
        <ol className="flex flex-col gap-2.5">
          {r.steps.map((item, i) => {
            const Icon = introIcons[i];
            return (
              <li
                key={item.title}
                className="flex items-center gap-3.5 rounded-[14px] border border-card bg-surface-deep p-3.5 anim-rise"
                style={{ animationDelay: `${0.1 + i * 0.12}s` }}
              >
                <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-accent/12">
                  <Icon className="size-5 text-accent-fg" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-base font-bold">
                    <span className="mr-1.5 font-mono text-accent-fg">{format(r.stepNumber, { n: i + 1 })}</span>
                    {item.title}
                  </span>
                  <span className="text-sm text-fg-3">{item.text}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <button type="button" onClick={() => setStep(1)} className={primaryButtonClass}>
          {r.start}
        </button>
        <Link href={routes.signIn} className="inline-flex min-h-11 items-center self-center px-2 text-[15px] font-bold no-underline">
          {r.backToSignIn}
        </Link>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="flex flex-col items-center gap-[18px] text-center anim-slide-in">
        <span className="flex size-[84px] items-center justify-center rounded-3xl bg-success/12 anim-pop">
          <Check className="size-10 text-success" strokeWidth={2.6} aria-hidden="true" />
        </span>
        <AuthHeading title={r.doneTitle} lead={r.doneText} />
        <Link href={routes.signIn} className={primaryButtonClass}>
          {r.signIn}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => (s - 1) as Step)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[15px] font-bold text-accent-fg"
          >
            <ArrowLeft className="size-4" strokeWidth={2.2} aria-hidden="true" />
            {r.back}
          </button>
          <span className="text-sm font-bold text-fg-3">{format(r.progress, { n: step })}</span>
        </div>
        <ol aria-label={r.stepsLabel} className="grid grid-cols-4 gap-1.5">
          {r.stepNames.map((name, i) => {
            const n = i + 1;
            const done = n < step;
            const current = n === step;
            return (
              <li key={name} aria-current={current ? "step" : undefined} className="flex flex-col gap-2">
                <span className={cn("h-1.5 rounded-full transition-colors duration-300", done ? "bg-success" : current ? "bg-accent" : "bg-card")} />
                <span className={cn("flex items-center gap-1.5 text-[13px] font-bold", done ? "text-success-subtle-fg" : current ? "text-fg" : "text-fg-4")}>
                  {done ? (
                    <span className="flex size-4 flex-none items-center justify-center rounded-full bg-success">
                      <Check className="size-2.5 text-on-accent" strokeWidth={3.5} aria-hidden="true" />
                    </span>
                  ) : null}
                  {name}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {step === 1 ? (
        <form key="email" action={sendAction} className="flex flex-col gap-[18px] anim-slide-in" noValidate>
          <AuthHeading title={r.emailTitle} lead={r.emailLead} />
          {sendState.status === "error" && sendState.message ? (
            <Notice tone="warn" live="assertive">
              {sendState.code === "rate_limited" ? format(t.errors.tooMany, { time: formatClock(wait) }) : sendState.message}
            </Notice>
          ) : null}
          <Field id="reset-email" label={t.email} error={sendState.fieldErrors?.email}>
            <input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              {...describedBy("reset-email", { error: sendState.fieldErrors?.email })}
            />
          </Field>
          <SubmitButton disabled={!/.+@.+\..+/.test(email)}>{r.send}</SubmitButton>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-[18px] anim-slide-in">
          <div className="flex justify-center py-1.5">
            <span className="flex size-[84px] items-center justify-center rounded-3xl bg-accent/12 anim-pop">
              <MailCheck className="size-10 text-accent-fg" strokeWidth={2} aria-hidden="true" />
            </span>
          </div>
          <AuthHeading title={r.sentTitle} lead={rich(format(r.sentText, { email }), { email: emailBold })} />
          <button type="button" onClick={() => setStep(3)} className={primaryButtonClass}>
            {r.toCode}
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <form key="code" action={codeAction} className="flex flex-col gap-[18px] anim-slide-in">
          <AuthHeading title={r.codeTitle} lead={rich(format(r.codeLead, { email }), { email: emailBold })} />
          <input type="hidden" name="email" value={email} />
          <CodeInput
            key={round}
            label={r.codeLabel}
            state={resendNotice.status === "idle" && codeState.status === "error" ? "bad" : "idle"}
            onChange={setCode}
          />
          {resendNotice.status !== "idle" ? (
            <Notice tone={resendNotice.status === "ok" ? "accent" : "warn"}>
              {resendNotice.code === "rate_limited" ? format(t.errors.tooMany, { time: formatClock(wait) }) : resendNotice.message}
            </Notice>
          ) : codeState.status === "error" || passwordState.code === "expired" || passwordState.code === "wrong" ? (
            <Notice tone="bad" live="assertive">
              {codeState.message ?? passwordState.message}
            </Notice>
          ) : null}
          <SubmitButton disabled={code.length !== codeLength}>{r.next}</SubmitButton>
          <button
            type="button"
            onClick={resend}
            disabled={wait > 0 || resending}
            className="min-h-11 cursor-pointer self-center px-3 text-[15px] font-bold text-accent-fg disabled:cursor-not-allowed disabled:text-fg-4"
          >
            {wait > 0 ? format(t.code.resendIn, { time: formatClock(wait) }) : t.code.resend}
          </button>
        </form>
      ) : null}

      {step === 4 ? (
        <form key="password" action={passwordAction} className="flex flex-col gap-[18px] anim-slide-in" noValidate>
          <AuthHeading title={r.passwordTitle} lead={r.passwordLead} />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="code" value={code} />
          {/* Tarayıcının şifre yöneticisi yeni şifreyi doğru hesaba kaydetsin. */}
          <input type="hidden" name="username" autoComplete="username" value={email} />
          <div className="flex flex-col gap-2">
            <Field id="new-password" label={r.newPassword} error={passwordState.fieldErrors?.password}>
              <PasswordInput
                id="new-password"
                name="password"
                autoComplete="new-password"
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="new-password-strength"
              />
            </Field>
            <PasswordStrength id="new-password-strength" password={password} evaluation={evaluation} />
          </div>
          {passwordState.status === "error" && passwordState.message && !passwordState.code ? (
            <Notice tone="bad" live="assertive">
              {passwordState.message}
            </Notice>
          ) : null}
          <SubmitButton disabled={!evaluation.accepted}>{r.submit}</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
