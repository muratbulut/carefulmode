"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { signUp } from "@/lib/account/actions";
import { deadlineFrom, formatClock, idleState, isMinor, maxBirthYear, minBirthYear, type FormState } from "@/lib/account/shared";
import { format, getMessages, rich } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { evaluatePassword, personalTokens } from "@/lib/password-strength";
import { EducationFields } from "./EducationFields";
import { Field, Notice, PasswordInput, SubmitButton, describedBy, inputClass, selectClass } from "./fields";
import { PasswordStrength } from "./PasswordStrength";
import { useSecondsLeft } from "./useSecondsLeft";

type Result = FormState & { deadline?: ReturnType<typeof deadlineFrom> };

/** Kayıt formu (Tur 1, ekran 5; tahta: Kayit-Masaustu, Kayit-Mobil). */
export function SignUpForm({ next }: { next?: string }) {
  const t = getMessages();
  const m = t.auth.signUp;
  const [state, action] = useActionState<Result, FormData>(async (prev, form) => {
    const result = await signUp(prev, form);
    return { ...result, deadline: deadlineFrom(result.retryAfterSec, Date.now()) };
  }, idleState);
  const wait = useSecondsLeft(state.deadline);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [year, setYear] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [guardian, setGuardian] = useState(false);

  const evaluation = useMemo(() => evaluatePassword(password, personalTokens(name, email)), [password, name, email]);
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = maxBirthYear(); y >= minBirthYear(); y--) list.push(y);
    return list;
  }, []);
  const minor = year !== "" && isMinor(Number(year));
  const notReady = !kvkk || !evaluation.accepted || (minor && !guardian) || wait > 0;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.status === "error" && (state.message || state.code === "rate_limited") ? (
        <Notice tone="bad" live="assertive" shake>
          {state.code === "rate_limited" ? format(t.auth.errors.tooMany, { time: formatClock(wait) }) : state.message}
        </Notice>
      ) : null}

      <Field id="name" label={m.name} hint={m.nameHint} error={errors.name}>
        <input
          id="name"
          name="name"
          autoComplete="nickname"
          placeholder={m.namePlaceholder}
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          {...describedBy("name", { hint: m.nameHint, error: errors.name })}
        />
      </Field>

      <Field id="email" label={t.auth.email} error={errors.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t.auth.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          {...describedBy("email", { error: errors.email })}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Field id="password" label={t.auth.password} error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder={m.passwordPlaceholder}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            {...(errors.password
              ? { "aria-invalid": true, "aria-describedby": "password-error password-strength" }
              : { "aria-describedby": "password-strength" })}
          />
        </Field>
        <PasswordStrength id="password-strength" password={password} evaluation={evaluation} />
      </div>

      <Field id="birthYear" label={m.birthYear} error={errors.birthYear}>
        <select
          id="birthYear"
          name="birthYear"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={selectClass}
          {...describedBy("birthYear", { error: errors.birthYear })}
        >
          <option value="">{m.birthYearPlaceholder}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </Field>

      <EducationFields error={errors.department} />

      {minor ? (
        <label className="flex cursor-pointer items-start gap-3 text-sm leading-normal text-fg-2 anim-pop">
          <input
            type="checkbox"
            name="guardian"
            checked={guardian}
            onChange={(e) => setGuardian(e.target.checked)}
            className="mt-0 size-[22px] flex-none accent-accent"
            {...describedBy("guardian", { error: errors.guardian })}
          />
          <span>{m.guardian}</span>
        </label>
      ) : null}
      {errors.guardian ? (
        <p id="guardian-error" className="text-[13px] text-danger-fg">
          {errors.guardian}
        </p>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-normal text-fg-2">
        <input
          type="checkbox"
          name="kvkk"
          checked={kvkk}
          onChange={(e) => setKvkk(e.target.checked)}
          className="mt-0 size-[22px] flex-none accent-accent"
          {...describedBy("kvkk", { error: errors.kvkk })}
        />
        <span>
          {rich(m.kvkk, {
            link: (chunk) => (
              <Link href={routes.kvkk} target="_blank" className="font-bold">
                {chunk}
              </Link>
            ),
          })}
        </span>
      </label>
      {errors.kvkk ? (
        <p id="kvkk-error" className="text-[13px] text-danger-fg">
          {errors.kvkk}
        </p>
      ) : null}

      <SubmitButton disabled={notReady}>{m.submit}</SubmitButton>
      <p className="text-center text-[15px] text-fg-3">
        {m.haveAccount}{" "}
        <Link href={next ? `${routes.signIn}?sonra=${encodeURIComponent(next)}` : routes.signIn} className="font-bold">
          {m.signIn}
        </Link>
      </p>
    </form>
  );
}
