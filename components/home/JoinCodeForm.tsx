"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { inputClass } from "@/components/auth/fields";
import { Spinner } from "@/components/status/Spinner";
import { joinClassroom } from "@/lib/classroom/student-actions";
import { cleanCodeInput, isJoinCode } from "@/lib/classroom/rules";
import type { StudentClass } from "@/lib/classroom/student";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Sınıf kodu kutusu ve "Katıl" (Ana-Sayfa-Odev, Ogretmenlik-Son). Kod 6 karakter olunca düğme
 * renklenir; eksikse ya da kod yanlışsa kutu kırmızı olur ve bir kez sarsılır ("Hareketi azalt"
 * açıksa sarsılmaz). Katılma sunucuda denetlenir (lib/classroom/student-actions.ts).
 */
export function JoinCodeForm({
  onJoined,
  autoFocus = false,
  className,
}: {
  onJoined: (classroom: StudentClass, message: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const t = getMessages().studentClass;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [pending, startJoin] = useTransition();
  const ready = isJoinCode(code);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  function fail(message: string) {
    setError(message);
    setShake(true);
    input.current?.focus();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!ready) return fail(t.errors.codeFormat);
    startJoin(async () => {
      try {
        const result = await joinClassroom(code);
        if (result.status === "ok") {
          setError(null);
          onJoined(result.classroom, result.message);
        } else {
          fail(result.message);
        }
      } catch {
        fail(t.errors.generic);
      }
    });
  }

  return (
    <form onSubmit={submit} noValidate className={cn("flex flex-col gap-2", className)}>
      <div className={cn("flex gap-2", shake && "motion-safe:anim-shake")} onAnimationEnd={() => setShake(false)}>
        <label htmlFor={`${id}-code`} className="sr-only">
          {t.code.label}
        </label>
        <input
          ref={input}
          id={`${id}-code`}
          name="code"
          value={code}
          onChange={(e) => {
            setCode(cleanCodeInput(e.target.value));
            setError(null);
          }}
          placeholder={t.code.placeholder}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-note`}
          className={cn(
            inputClass,
            "h-[46px] min-w-0 font-mono tracking-[3px] uppercase",
            ready && !error && "border-accent",
          )}
        />
        <button
          type="submit"
          aria-busy={pending}
          className={cn(
            "inline-flex h-[46px] flex-none cursor-pointer items-center justify-center gap-2 rounded-xl px-[18px] text-[15px] font-bold transition-colors",
            ready ? "bg-accent text-on-accent" : "bg-card text-fg-4",
          )}
        >
          {pending ? <Spinner tone="onAccent" /> : null}
          {t.code.join}
        </button>
      </div>
      <p id={`${id}-note`} role={error ? "alert" : undefined} className={cn("m-0 text-xs leading-normal", error ? "text-danger-fg" : "text-fg-3")}>
        {error ?? t.code.hint}
      </p>
    </form>
  );
}
