"use client";

// Hesap formlarının ortak parçaları: alan, şifre kutusu, bildirim kutusu ve düğmeler.

import { AlertTriangle, ArrowBigUp, CheckCircle2, Eye, EyeOff, Info, Lock, type LucideIcon } from "lucide-react";
import { useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/status/Spinner";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-[50px] w-full rounded-xl border border-line bg-canvas px-3.5 text-base text-fg placeholder:text-fg-4 transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_rgb(34_211_238/0.18)] focus:outline-none aria-[invalid=true]:border-danger";

export const selectClass = cn(
  inputClass,
  "cursor-pointer appearance-none bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-20px)_22px,calc(100%-15px)_22px] bg-no-repeat pr-9",
  "bg-[image:linear-gradient(45deg,transparent_50%,var(--fg-3)_50%),linear-gradient(135deg,var(--fg-3)_50%,transparent_50%)]",
);

export const primaryButtonClass =
  "flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-[17px] font-bold text-on-accent no-underline transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100";

/** Profildeki gibi içeriği kadar geniş, daha alçak ana düğme (SubmitButton'a className olarak). */
export const compactButtonClass = "h-[46px] w-auto self-start px-5 text-base";

export const secondaryButtonClass =
  "flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-card text-base font-bold text-fg no-underline transition-colors hover:border-line-strong";

export function Field({
  id,
  label,
  aside,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  aside?: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold text-fg-2">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[13px] leading-[1.45] text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[13px] leading-[1.45] text-fg-4">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Alanın açıklama ya da hata satırına bağlanması (ekran okuyucu). */
export function describedBy(id: string, { hint, error }: { hint?: unknown; error?: unknown }) {
  if (error) return { "aria-invalid": true as const, "aria-describedby": `${id}-error` };
  if (hint) return { "aria-describedby": `${id}-hint` };
  return {};
}

/**
 * Göster/gizle düğmeli şifre kutusu. Caps Lock açıkken kutunun altında "Büyük harf açık" yazar
 * (tuşa basınca anlaşılır; kutudan çıkınca kaybolur).
 */
export function PasswordInput({ className, onKeyDown, onKeyUp, onBlur, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const t = getMessages().auth;
  const [shown, setShown] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const Icon = shown ? EyeOff : Eye;
  const readCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);
  return (
    <>
      <div className="relative">
        <input
          {...props}
          type={shown ? "text" : "password"}
          onKeyDown={(e) => {
            readCaps(e);
            onKeyDown?.(e);
          }}
          onKeyUp={(e) => {
            readCaps(e);
            onKeyUp?.(e);
          }}
          onBlur={(e) => {
            setCapsLock(false);
            onBlur?.(e);
          }}
          className={cn(inputClass, "pr-[52px] font-mono", className)}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? t.hidePassword : t.showPassword}
          aria-pressed={shown}
          className="absolute top-[3px] right-1 flex size-11 cursor-pointer items-center justify-center rounded-[10px] text-fg-3 hover:text-fg"
        >
          <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {capsLock ? (
        <p role="status" data-testid="caps-lock" className="m-0 flex items-center gap-1.5 text-[13px] leading-[1.45] font-semibold text-warning-fg">
          <ArrowBigUp className="size-4 flex-none" strokeWidth={2.2} aria-hidden="true" />
          {t.capsLock}
        </p>
      ) : null}
    </>
  );
}

export type NoticeTone = "info" | "bad" | "warn" | "good" | "accent";

const toneClass: Record<NoticeTone, string> = {
  info: "border-line bg-surface text-fg-3",
  bad: "border-danger/55 bg-danger/10 text-danger-fg",
  warn: "border-warning/45 bg-warning/8 text-warning-fg",
  good: "border-success/50 bg-success/10 text-success-subtle-fg",
  accent: "border-accent/45 bg-accent/10 text-accent-light",
};

const toneIcon: Record<NoticeTone, LucideIcon> = {
  info: Lock,
  bad: AlertTriangle,
  warn: AlertTriangle,
  good: CheckCircle2,
  accent: Info,
};

/** Formun üstündeki ya da altındaki renkli bildirim kutusu. Hatada bir kez sarsılır. */
export function Notice({
  tone,
  children,
  live = "polite",
  shake = false,
  icon,
  className,
}: {
  tone: NoticeTone;
  children: ReactNode;
  live?: "polite" | "assertive";
  shake?: boolean;
  icon?: LucideIcon;
  className?: string;
}) {
  const Icon = icon ?? toneIcon[tone];
  return (
    <div
      role={live === "assertive" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-normal",
        toneClass[tone],
        shake && "anim-shake",
        className,
      )}
    >
      <Icon className="mt-px size-[18px] flex-none" strokeWidth={2.2} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Formun ana düğmesi; gönderim sürerken bekleme halkası gösterir. */
export function SubmitButton({ children, disabled, className }: { children: ReactNode; disabled?: boolean; className?: string }) {
  const { pending } = useFormStatus();
  const t = getMessages().auth;
  return (
    <button type="submit" disabled={disabled || pending} aria-busy={pending} className={cn(primaryButtonClass, className)}>
      {pending ? (
        <>
          <Spinner tone="onAccent" />
          {t.working}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** "ya da" ayırıcısı. */
export function OrDivider() {
  const t = getMessages().auth;
  return (
    <div className="flex items-center gap-3 text-[13px] text-fg-4">
      <span className="h-px flex-1 bg-line" />
      {t.signIn.or}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
