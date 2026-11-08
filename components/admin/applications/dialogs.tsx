"use client";

import { useId, useRef, useState } from "react";
import { ExternalLink, FileText, Lock, ScrollText } from "lucide-react";
import { Dialog } from "@/components/profile/Dialog";
import { documentHref } from "@/lib/admin/application-rules";
import { format, getMessages } from "@/lib/i18n";
import { questionLimits, rejectionNoteLimits } from "@/lib/teacher/decision-rules";
import { cn } from "@/lib/utils";
import { Chip, DialogHead, sheetClass } from "./parts";
import type { DocumentView } from "./types";

type Limits = { min: number; max: number };

/**
 * Ret ve "Bilgi iste" pencerelerinin ortak formu: hazır seçenek çipleri metni doldurur,
 * "Kendim yazayım" boşaltır; en az 10 karakter (sunucu yeniden denetler).
 */
function TextForm({
  options,
  ownLabel,
  optionsLabel,
  label,
  placeholder,
  hint,
  countTemplate,
  error,
  limits,
  intro,
  cancel,
  confirm,
  confirmClass,
  busy,
  onCancel,
  onSubmit,
}: {
  options: { key: string; label: string; text: string }[];
  ownLabel: string;
  optionsLabel: string;
  label: string;
  placeholder: string;
  hint: string;
  countTemplate: string;
  error: string;
  limits: Limits;
  intro?: string;
  cancel: string;
  confirm: string;
  confirmClass: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [tried, setTried] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();
  const length = text.trim().length;
  const bad = length < limits.min;
  const showError = tried && bad;

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (bad) {
          setTried(true);
          area.current?.focus();
          return;
        }
        onSubmit(text.trim());
      }}
      className="flex flex-col gap-4"
    >
      {intro ? <p className="-mt-1.5 mb-0 text-sm leading-normal text-fg-3">{intro}</p> : null}
      <div role="radiogroup" aria-label={optionsLabel} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip
            key={option.key}
            on={picked === option.key}
            onClick={() => {
              setPicked(option.key);
              setText(option.text);
            }}
          >
            {option.label}
          </Chip>
        ))}
        <Chip
          on={picked === "own"}
          onClick={() => {
            setPicked("own");
            setText("");
            area.current?.focus();
          }}
        >
          {ownLabel}
        </Chip>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-bold text-fg-2">
        {label}
        <textarea
          ref={area}
          rows={4}
          value={text}
          maxLength={limits.max}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-invalid={showError}
          aria-describedby={showError ? errorId : undefined}
          className={cn(
            "w-full resize-y rounded-xl border bg-canvas px-3.5 py-3 text-base leading-normal font-normal text-fg placeholder:text-fg-4",
            showError ? "border-danger" : "border-line",
          )}
        />
        <span className="flex justify-between gap-3 text-xs font-medium text-fg-3">
          <span>{hint}</span>
          <span className="flex-none">{format(countTemplate, { n: length, max: limits.max })}</span>
        </span>
      </label>
      {showError ? (
        <p id={errorId} className="-mt-2 mb-0 text-[13px] text-danger-fg">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 flex-none rounded-xl border border-line bg-surface-raised px-5 text-[15px] font-bold text-fg sm:flex-1"
        >
          {cancel}
        </button>
        <button
          type="submit"
          disabled={busy}
          className={cn("min-h-12 flex-1 rounded-xl px-3.5 py-2 text-[15px] leading-tight font-bold disabled:opacity-60", confirmClass)}
        >
          {confirm}
        </button>
      </div>
    </form>
  );
}

/** "{ad} talebini reddet": hazır gerekçe çipleri ve kullanıcıya giden not. */
export function RejectDialog({
  open,
  name,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  name: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const t = getMessages().adminApplications.reject;
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} className={cn("max-w-[520px]", sheetClass)}>
      <DialogHead id={titleId} title={format(t.title, { name })} onClose={onClose} />
      <TextForm
        options={Object.entries(t.reasons).map(([key, r]) => ({ key, label: r.label, text: r.text }))}
        ownLabel={t.ownReason}
        optionsLabel={t.reasonsLabel}
        label={t.note}
        placeholder={t.placeholder}
        hint={t.hint}
        countTemplate={t.count}
        error={t.error}
        limits={rejectionNoteLimits}
        cancel={t.cancel}
        confirm={t.confirm}
        confirmClass="bg-danger text-on-danger"
        busy={busy}
        onCancel={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}

/** "{ad} için bilgi iste": hazır sorular (kurumsal e-posta, görev yeri belgesi, okulun tam adı) ya da kendi sorusu. */
export function InfoDialog({
  open,
  name,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  name: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (question: string) => void;
}) {
  const t = getMessages().adminApplications.info;
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} className={cn("max-w-[520px]", sheetClass)}>
      <DialogHead id={titleId} title={format(t.title, { name })} onClose={onClose} />
      <TextForm
        intro={t.intro}
        options={Object.entries(t.questions).map(([key, q]) => ({ key, label: q.label, text: q.text }))}
        ownLabel={t.ownQuestion}
        optionsLabel={t.questionsLabel}
        label={t.question}
        placeholder={t.placeholder}
        hint={t.hint}
        countTemplate={t.count}
        error={t.error}
        limits={questionLimits}
        cancel={t.cancel}
        confirm={t.confirm}
        confirmClass="bg-accent text-on-accent"
        busy={busy}
        onCancel={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}

/**
 * Belge önizlemesi (yalnızca talepleri inceleyenler): görsel satır içinde, PDF çerçevede.
 * Belge kendi adresinden gelir (her bakış kayıt defterine yazılır); sayfa verisinde baytları yok.
 * Pencere kapalıyken hiçbir istek gitmez.
 */
export function DocumentDialog({
  open,
  applicationId,
  document,
  onClose,
}: {
  open: boolean;
  applicationId: string;
  document: DocumentView;
  onClose: () => void;
}) {
  const t = getMessages().adminApplications.document;
  const titleId = useId();
  const [failed, setFailed] = useState(false);
  const src = documentHref(applicationId);
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} className={cn("max-w-[640px]", sheetClass)}>
      <DialogHead
        id={titleId}
        title={document.name}
        onClose={onClose}
        icon={<FileText className="size-[18px] flex-none text-accent-fg" strokeWidth={2} aria-hidden="true" />}
      />
      {failed ? (
        <p className="m-0 rounded-xl border border-warning/35 bg-warning/6 px-3.5 py-3 text-sm text-fg-2">{t.failed}</p>
      ) : document.kind === "image" ? (
        // Belge sitenin kendi adresinden, yetki denetimiyle gelir; görsel iyileştirme (next/image) kullanılmaz.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={format(t.image, { name: document.name })}
          onError={() => setFailed(true)}
          className="max-h-[55dvh] w-full rounded-md border border-line bg-canvas object-contain lg:max-h-[60dvh]"
        />
      ) : (
        <iframe src={src} title={format(t.frame, { name: document.name })} className="h-[55dvh] w-full rounded-md border border-line bg-canvas lg:h-[60dvh]" />
      )}
      <div className="flex flex-col gap-2 text-xs leading-normal text-fg-3">
        <span className="flex gap-2">
          <Lock className="mt-px size-[15px] flex-none text-accent-light" strokeWidth={2} aria-hidden="true" />
          <span>{t.note}</span>
        </span>
        <span className="flex gap-2">
          <ScrollText className="mt-px size-[15px] flex-none text-fg-4" strokeWidth={2} aria-hidden="true" />
          <span>{t.audit}</span>
        </span>
      </div>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="-my-2.5 inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-accent-fg no-underline"
      >
        <ExternalLink className="size-4" strokeWidth={2.2} aria-hidden="true" />
        {t.open}
      </a>
    </Dialog>
  );
}
