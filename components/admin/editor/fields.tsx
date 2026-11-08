"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Lab düzenleme formunun ortak alanları (Lab-Duzenle-Son: koyu zemin, 12px köşe, 16px yazı).
// Etiket alanın adıdır; açıklama aria-describedby ile bağlanır (ekran okuyucu ikisini ayrı okur).

export const inputClass =
  "w-full rounded-xl border border-line bg-canvas px-3.5 text-base font-normal text-fg placeholder:text-fg-4 disabled:opacity-60 aria-[invalid=true]:border-danger";

type Base = { label: string; hint?: ReactNode; mono?: boolean; className?: string };

function FieldShell({ id, label, hint, hintId, className, children }: { id: string; label: string; hint?: ReactNode; hintId: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-bold text-fg-2">
        {label}
      </label>
      {children}
      {hint ? (
        <span id={hintId} className="-mt-0.5 text-xs leading-[1.45] text-fg-4">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function TextField({ label, hint, mono, className, ...input }: Base & Omit<InputHTMLAttributes<HTMLInputElement>, "className">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} hintId={`${id}-hint`} className={className}>
      <input
        id={id}
        type="text"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...input}
        className={cn(inputClass, "h-12", mono && "font-mono text-[15px]")}
      />
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, mono, className, ...input }: Base & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} hintId={`${id}-hint`} className={className}>
      <textarea
        id={id}
        rows={3}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...input}
        className={cn(inputClass, "min-h-[88px] resize-y py-3 leading-normal", mono && "font-mono text-[15px]")}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  className,
  options,
  ...select
}: Base & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & { options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} hintId={`${id}-hint`} className={className}>
      <select id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...select} className={cn(inputClass, "h-12 pr-8")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Başlığı ve açıklaması olan alan grubu ("İşaretler · raporda numaralı gösterilir" gibi). */
export function Group({ title, hint, children, className }: { title: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={cn("flex flex-col gap-2.5", className)}>
      <span id={id} className="text-sm font-bold text-fg-2">
        {title}
      </span>
      {hint ? <span className="-mt-1.5 text-xs leading-[1.45] text-fg-4">{hint}</span> : null}
      {children}
    </div>
  );
}

/** Listeye satır ekleyen kesik kenarlı düğme ("+ Mail ekle"). */
export function AddButton({ children, onClick, disabled, className }: { children: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-11 items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3 text-sm font-bold text-fg-2 hover:border-accent hover:text-fg disabled:opacity-50",
        className,
      )}
    >
      <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
      {children}
    </button>
  );
}

/** Küçük ikon düğmesi (sil, yukarı, aşağı). Adı ekranda görünmez, ekran okuyucu okur. */
export function IconButton({
  label,
  icon,
  onClick,
  disabled,
  tone = "default",
}: {
  label: string;
  icon: "delete" | "up" | "down";
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  const Icon = icon === "delete" ? Trash2 : icon === "up" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex size-9 flex-none items-center justify-center rounded-[10px] text-fg-3 hover:bg-card disabled:text-line-strong disabled:hover:bg-transparent",
        tone === "danger" && "hover:text-danger-fg",
      )}
    >
      <Icon className="size-4" strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

/** Listedeki seçilebilir satır (mail, görev, kart). Seçili olan aria-current taşır. */
export function PickRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-fg transition-colors",
        selected ? "border-accent bg-card" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      {children}
    </button>
  );
}

/** Sıradaki parçanın üst satırı: başlık, yukarı/aşağı ve sil. */
export function RowTools({
  up,
  down,
  remove,
  labels,
}: {
  up?: () => void;
  down?: () => void;
  remove?: () => void;
  labels: { up: string; down: string; remove: string };
}) {
  return (
    <span className="flex flex-none items-center">
      <IconButton label={labels.up} icon="up" onClick={() => up?.()} disabled={!up} />
      <IconButton label={labels.down} icon="down" onClick={() => down?.()} disabled={!down} />
      <IconButton label={labels.remove} icon="delete" tone="danger" onClick={() => remove?.()} disabled={!remove} />
    </span>
  );
}
