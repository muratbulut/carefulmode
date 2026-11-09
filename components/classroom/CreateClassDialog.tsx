"use client";

import { Check, Copy, Link2, Lock, Presentation } from "lucide-react";
import { useId, useState, useTransition, type FormEvent } from "react";
import { classLevels, classNameLimits, classNameOk, type ClassLevel } from "@/lib/classroom/rules";
import { createClassroom, type CreatedClassroom } from "@/lib/classroom/teacher-actions";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { copyText, errorText, inviteLink } from "./client";
import { Sheet } from "./Sheet";
import type { ProjectionTarget } from "./types";

/**
 * Yeni sınıf penceresi (Siniflarim-Son): ad ve düzey; oluşunca sınıf kodu, kopyalama ve
 * "Tahtaya yansıt". Kapanınca form sıfırlanır.
 */
export function CreateClassDialog({
  open,
  onClose,
  origin,
  onProject,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  origin: string;
  onProject: (target: ProjectionTarget) => void;
  onToast: (message: string) => void;
}) {
  const c = getMessages().classroom.create;
  const titleId = useId();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      closeLabel={c.close}
      title={
        <h2 id={titleId} className="m-0 font-heading text-[22px] font-bold">
          {c.title}
        </h2>
      }
    >
      <CreateClassBody origin={origin} onClose={onClose} onProject={onProject} onToast={onToast} />
    </Sheet>
  );
}

function CreateClassBody({
  origin,
  onClose,
  onProject,
  onToast,
}: {
  origin: string;
  onClose: () => void;
  onProject: (target: ProjectionTarget) => void;
  onToast: (message: string) => void;
}) {
  const t = getMessages().classroom;
  const c = t.create;
  const ids = { name: useId(), hint: useId(), error: useId(), level: useId() };
  const [name, setName] = useState("");
  const [level, setLevel] = useState<ClassLevel>("7");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedClassroom | null>(null);
  const [pending, startTransition] = useTransition();
  const nameOk = classNameOk(name);
  const showNameError = tried && !nameOk;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setError(null);
    if (!nameOk || pending) return;
    startTransition(async () => {
      const result = await createClassroom({ name, level });
      if (result.ok) setCreated(result.classroom);
      else setError(errorText(result.error));
    });
  }

  async function copy(text: string, message: string, code: string) {
    onToast((await copyText(text)) ? message : format(t.toasts.copyFailed, { code }));
  }

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 flex-none items-center justify-center rounded-full bg-success/16">
            <Check className="size-[22px] text-success-fg" strokeWidth={2.6} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span role="status" className="text-[17px] font-bold break-words">
              {format(c.ready, { name: created.name })}
            </span>
            <span className="text-[13px] text-fg-3">{c.share}</span>
          </span>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface-deep p-[18px]">
          <span className="text-xs font-bold tracking-[1px] text-fg-3">{c.codeLabel}</span>
          <span data-testid="new-class-code" className="font-mono text-[34px] font-bold tracking-[8px] text-accent-fg lg:text-[40px]">
            {created.code}
          </span>
          <span className="text-center text-xs text-fg-4">{c.codeHint}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => copy(created.code, format(t.toasts.codeCopied, { code: created.code }), created.code)}
            className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-card px-2 text-sm font-bold text-fg"
          >
            <Copy className="size-4 flex-none text-fg-2" strokeWidth={2} aria-hidden="true" />
            {c.copyCode}
          </button>
          <button
            type="button"
            onClick={() => copy(inviteLink(origin, created.code), t.toasts.linkCopied, created.code)}
            className="flex h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-card px-2 text-sm font-bold text-fg"
          >
            <Link2 className="size-4 flex-none text-fg-2" strokeWidth={2} aria-hidden="true" />
            {c.copyLink}
          </button>
        </div>
        <button
          type="button"
          onClick={() => onProject(created)}
          className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-bold text-on-accent"
        >
          <Presentation className="size-[18px]" strokeWidth={2} aria-hidden="true" />
          {c.project}
        </button>
        <button type="button" onClick={onClose} className="h-10 cursor-pointer text-sm font-bold text-fg-3 hover:text-fg">
          {c.later}
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className="text-sm font-bold text-fg-2">
          {c.name}
        </label>
        <input
          id={ids.name}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={classNameLimits.max}
          placeholder={c.namePlaceholder}
          autoComplete="off"
          // Pencere açılınca imleç doğrudan ad kutusunda olsun (Sheet).
          data-autofocus
          aria-invalid={showNameError}
          aria-describedby={showNameError ? `${ids.error} ${ids.hint}` : ids.hint}
          className={cn(
            "h-[50px] w-full rounded-xl border bg-canvas px-3.5 text-base text-fg placeholder:text-fg-4 focus:border-accent focus:outline-none",
            showNameError ? "border-danger" : "border-line",
          )}
        />
        {showNameError ? (
          <span id={ids.error} className="text-[13px] font-medium text-danger-fg">
            {c.nameError}
          </span>
        ) : null}
        <span id={ids.hint} className="text-xs font-medium text-fg-3">
          {c.nameHint}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.level} className="text-sm font-bold text-fg-2">
          {c.level}
        </label>
        <select
          id={ids.level}
          name="level"
          value={level}
          onChange={(e) => setLevel(e.target.value as ClassLevel)}
          className="h-[50px] w-full rounded-xl border border-line bg-canvas px-3.5 text-base text-fg focus:border-accent focus:outline-none"
        >
          {classLevels.map((code) => (
            <option key={code} value={code}>
              {t.levels[code]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2.5 rounded-xl border border-card bg-surface-raised px-3.5 py-3 text-[13px] leading-normal text-fg-3">
        <Lock className="mt-0.5 size-4 flex-none text-accent-light" strokeWidth={2} aria-hidden="true" />
        <span>{c.privacy}</span>
      </div>
      {error ? (
        <p role="alert" className="m-0 text-[13px] font-medium text-danger-fg">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "h-[50px] cursor-pointer rounded-xl text-base font-bold transition-colors disabled:cursor-wait",
          nameOk ? "bg-accent text-on-accent" : "bg-card text-fg-4",
        )}
      >
        {pending ? c.submitting : c.submit}
      </button>
    </form>
  );
}
