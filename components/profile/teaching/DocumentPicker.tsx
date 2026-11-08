"use client";

import { FileText, Upload, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Spinner } from "@/components/status/Spinner";
import { format, getMessages } from "@/lib/i18n";
import { formatFileSize } from "@/lib/teacher/document";
import { cn } from "@/lib/utils";
import { prepareDocument, type PrepareError, type PreparedDocument } from "./prepare-document";

/**
 * Belge ekleme kutusu (tahta: Ogretmenlik-Son, "Belge ekle"). Dosya seçilince tarayıcıda
 * hazırlanır (prepare-document.ts) ve forma eklenmek üzere üst bileşene verilir; asıl yükleme
 * form gönderilince olur.
 */
export function DocumentPicker({
  id,
  label,
  types,
  hint,
  value,
  onChange,
  error,
  compact = false,
}: {
  id: string;
  label: ReactNode;
  types: string;
  hint?: string;
  value: PreparedDocument | null;
  onChange: (document: PreparedDocument | null) => void;
  /** Sunucunun belgeyle ilgili hatası. */
  error?: string;
  compact?: boolean;
}) {
  const t = getMessages().teaching.document;
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<PrepareError | null>(null);
  const shownError = localError ? t.errors[localError] : error;
  const describedBy = [shownError ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;

  async function pick(file: File | undefined) {
    if (!file) return;
    setPreparing(true);
    setLocalError(null);
    try {
      const result = await prepareDocument(file, t.fallbackName);
      if (result.ok) onChange(result.document);
      else setLocalError(result.error);
    } catch {
      setLocalError("unreadable");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-bold text-fg-2">
        {label}
      </span>
      {/* Adı yok: seçilen ham dosya forma girmez, hazırlanan kopyası eklenir. */}
      <input
        ref={input}
        id={id}
        type="file"
        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
        aria-labelledby={`${id}-label`}
        tabIndex={-1}
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          // Aynı dosya yeniden seçilebilsin.
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface-deep py-2.5 pr-1.5 pl-3 anim-slide-in">
          <span className="flex size-[38px] flex-none items-center justify-center rounded-[10px] bg-accent/12">
            <FileText className="size-[18px] text-accent-fg" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-bold">{value.name}</span>
            <span className="text-xs text-fg-3">{format(t.added, { size: formatFileSize(value.size) })}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t.remove}
            className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] text-fg-3 hover:bg-card hover:text-fg"
          >
            <X className="size-[17px]" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={preparing}
          aria-describedby={describedBy}
          className={cn(
            "flex cursor-pointer flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-[14px] border-[1.5px] border-dashed border-line-strong bg-surface-deep p-3 text-sm font-bold text-fg-2 transition-colors hover:border-accent/60 disabled:cursor-wait",
            compact ? "min-h-14" : "min-h-16",
            shownError && "border-danger/70",
          )}
        >
          {preparing ? (
            <>
              <Spinner />
              {t.preparing}
            </>
          ) : (
            <>
              <Upload className="size-[18px] text-accent-fg" strokeWidth={2} aria-hidden="true" />
              {t.add}
              <span className="font-medium text-fg-4">{types}</span>
            </>
          )}
        </button>
      )}
      {shownError ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] leading-[1.45] text-danger-fg">
          {shownError}
        </p>
      ) : null}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-normal text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
