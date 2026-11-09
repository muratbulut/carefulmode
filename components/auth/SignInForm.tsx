"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { signIn } from "@/lib/account/actions";
import { deadlineFrom, formatClock, idleState, type FormState } from "@/lib/account/shared";
import { format, getMessages, rich } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { AuthHeading } from "./AuthShell";
import { Field, Notice, OrDivider, PasswordInput, SubmitButton, inputClass, secondaryButtonClass } from "./fields";
import { hasSignedInBefore } from "./device";
import { useSecondsLeft } from "./useSecondsLeft";

type Result = FormState & { deadline?: ReturnType<typeof deadlineFrom> };

const noop = () => () => {};

/** Giriş formu (Tur 1, ekran 6; tahta: Giris-Masaustu, Giris-Mobil). */
export function SignInForm({ next }: { next?: string }) {
  const t = getMessages().auth;
  const [state, action] = useActionState<Result, FormData>(async (prev, form) => {
    const result = await signIn(prev, form);
    return { ...result, deadline: deadlineFrom(result.retryAfterSec, Date.now()) };
  }, idleState);
  const wait = useSecondsLeft(state.deadline);
  const [email, setEmail] = useState("");
  // Bu cihazdan daha önce giriş yapıldıysa "Tekrar hoş geldin" (sunucuda her zaman "Hoş geldin").
  const again = useSyncExternalStore(noop, hasSignedInBefore, () => false);

  const locked = state.code === "locked" && wait > 0;
  const limited = state.code === "rate_limited" && wait > 0;
  const time = formatClock(wait);
  const resetHref = routes.resetPassword;

  return (
    <>
      <AuthHeading title={again ? t.signIn.titleAgain : t.signIn.title} lead={t.signIn.lead} />
      <form action={action} className="flex flex-col gap-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {locked ? (
          <div role="alert" className="flex flex-col gap-2.5 rounded-[14px] border border-warning/45 bg-warning/8 p-3.5">
            <p className="font-bold text-warning-fg">{t.signIn.locked.title}</p>
            <p className="text-sm leading-normal text-fg-2">
              {rich(format(t.signIn.locked.text, { time }), {
                time: (chunk) => <b className="font-mono text-warning-fg">{chunk}</b>,
              })}
            </p>
            <p className="text-[13px] text-fg-3">
              {rich(t.signIn.locked.notYou, {
                link: (chunk) => (
                  <Link href={resetHref} className="font-bold">
                    {chunk}
                  </Link>
                ),
              })}
            </p>
          </div>
        ) : state.code === "wrong" ? (
          <Notice key={state.attemptsLeft} tone="bad" live="assertive" shake>
            <b>{t.signIn.wrong}</b>
            {state.attemptsLeft !== undefined && state.attemptsLeft <= 3 ? ` ${format(t.signIn.attemptsLeft, { n: state.attemptsLeft })}` : null}
          </Notice>
        ) : limited ? (
          <Notice tone="warn" live="assertive">
            {state.message ?? format(t.errors.tooMany, { time })}
          </Notice>
        ) : state.status === "error" && state.message ? (
          <Notice tone="bad" live="assertive">
            {state.message}
          </Notice>
        ) : null}

        <Field id="email" label={t.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field
          id="password"
          label={t.password}
          aside={
            // Dokunma alanı 40 px: dolgu, eksi kenar boşluğuyla yazının yerini değiştirmez.
            <Link href={resetHref} className="-mt-3.5 -mb-1.5 inline-block pt-3.5 pb-1.5 text-sm font-bold">
              {t.signIn.forgot}
            </Link>
          }
        >
          {/* Denetimsiz alan: gönderimden sonra React formu sıfırlar, şifre kutusu boşalır. */}
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton disabled={locked || limited}>{locked || limited ? format(t.signIn.locked.button, { time }) : t.signIn.submit}</SubmitButton>
      </form>
      <OrDivider />
      <Link href={next ? `${routes.signUp}?sonra=${encodeURIComponent(next)}` : routes.signUp} className={secondaryButtonClass}>
        {t.signIn.signUp}
      </Link>
    </>
  );
}
