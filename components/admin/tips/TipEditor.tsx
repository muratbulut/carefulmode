"use client";

import { Archive, UserRound } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";
import { TipCard } from "@/components/home/TipCard";
import { inputClass } from "@/components/admin/editor/fields";
import { format, getMessages } from "@/lib/i18n";
import { saveTip, type TipActionError } from "@/lib/tips/actions";
import type { AdminTip, TipAdminData } from "@/lib/tips/data";
import { dayLabel, weekdayLabel } from "@/lib/tips/format";
import { normalizeTipText, pinRange, quickPickDays, reasonError, textError, tipLimits } from "@/lib/tips/rules";
import { addDays, isDayKey, type DayKey } from "@/lib/tips/schedule";
import { cn } from "@/lib/utils";

const dayErrors: TipActionError[] = ["dayInvalid", "dayPast", "dayFar", "dayTaken"];

type Status = "POOL" | "DRAFT";
type FieldError = { field: "day" | "lab"; error: TipActionError };

/**
 * İpucu formu ve canlı önizleme (Ipucu-C3-Bugun): ipucu ve "Neden?" sayaçlı, mahalle, ilgili lab
 * (yalnızca o mahallenin yayındaki labları), ne zaman (otomatik ya da yarından itibaren bir gün).
 * Önizleme öğrencinin kartının aynısıdır. Masaüstünde form solda, önizleme sağda; telefonda
 * önizleme üstte (-Mobil).
 */
export function TipEditor({
  tip,
  data,
  isToday,
  onSaved,
  onArchive,
  onError,
  busy,
}: {
  tip: AdminTip | null;
  data: TipAdminData;
  isToday: boolean;
  onSaved: (message: string, undoKey: string | null) => void;
  onArchive: (tip: AdminTip) => void;
  onError: (error: TipActionError) => void;
  busy: boolean;
}) {
  const t = getMessages().tips;
  const e = t.editor;
  const ids = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const quick = Array.from({ length: quickPickDays }, (_, i) => addDays(data.today, i + 1));
  const range = pinRange(data.today);
  // Geçmiş bir güne sabitlenmiş ipucu (günü geçti) yeniden otomatik sayılır.
  const futurePin = tip?.pinnedDay && tip.pinnedDay > data.today ? tip.pinnedDay : null;

  const neighborhoodsOf = data.neighborhoods;
  const initialNeighborhood = tip?.neighborhoodId ?? neighborhoodsOf[0]?.id ?? "";
  const labsOf = (id: string) => neighborhoodsOf.find((n) => n.id === id)?.labs ?? [];

  const [text, setText] = useState(tip?.text ?? "");
  const [reason, setReason] = useState(tip?.reason ?? "");
  const [neighborhoodId, setNeighborhoodId] = useState(initialNeighborhood);
  const [labId, setLabId] = useState(tip?.labId && labsOf(initialNeighborhood).some((l) => l.id === tip.labId) ? tip.labId : "");
  const [when, setWhen] = useState<string>(!futurePin ? "auto" : quick.includes(futurePin) ? futurePin : "other");
  const [otherDay, setOtherDay] = useState(futurePin && !quick.includes(futurePin) ? futurePin : "");
  const [tried, setTried] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [saving, startSaving] = useTransition();

  // Başka bir ipucunun aldığı günler seçilemez.
  const taken = new Set(data.tips.filter((x) => x.pinnedDay && x.id !== tip?.id).map((x) => x.pinnedDay as DayKey));
  const textErr = textError(text);
  const reasonErr = reasonError(reason);
  const textLength = normalizeTipText(text).length;
  const reasonLength = normalizeTipText(reason).length;
  const chosenDay: DayKey | null = isToday ? null : when === "auto" ? null : when === "other" ? otherDay || null : when;

  const previewDate = isToday ? dayLabel(data.today) : chosenDay && isDayKey(chosenDay) ? dayLabel(chosenDay) : e.whenever;
  const disabled = busy || saving;

  function submit(status: Status) {
    setTried(true);
    setFieldError(null);
    if (textErr) return textRef.current?.focus();
    if (reasonErr) return reasonRef.current?.focus();
    if (!isToday && when !== "auto") {
      if (!chosenDay || !isDayKey(chosenDay)) return setFieldError({ field: "day", error: "dayInvalid" });
      if (taken.has(chosenDay)) return setFieldError({ field: "day", error: "dayTaken" });
    }
    startSaving(async () => {
      try {
        const result = await saveTip({
          id: tip?.id ?? null,
          text,
          reason,
          neighborhoodId,
          labId: labId || null,
          day: isToday ? (tip?.pinnedDay ?? null) : chosenDay,
          status,
        });
        if (!result.ok) {
          if (dayErrors.includes(result.error)) setFieldError({ field: "day", error: result.error });
          else if (result.error === "lab") setFieldError({ field: "lab", error: result.error });
          else onError(result.error);
          return;
        }
        if (!result.undoKey) return onSaved(t.toasts.unchanged, null);
        const message =
          status === "DRAFT"
            ? t.toasts.draft
            : isToday
              ? t.toasts.savedToday
              : chosenDay
                ? format(t.toasts.savedDay, { date: dayLabel(chosenDay) })
                : t.toasts.saved;
        onSaved(message, result.undoKey);
      } catch {
        onError("failed");
      }
    });
  }

  const showTextError = tried && !!textErr;
  const showReasonError = tried && !!reasonErr;
  const errorText = (error: TipActionError) => t.errors[error];

  const primary = "h-12 flex-[1_1_auto] rounded-xl bg-success px-4 text-[15px] font-bold text-on-accent disabled:opacity-60";
  const secondary = "h-12 flex-[1_1_auto] rounded-xl border border-line bg-surface-raised px-4 text-[15px] font-bold text-fg disabled:opacity-60";

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-[22px]">
      <div className="order-2 flex flex-col gap-4 lg:order-1">
        <div className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${ids}-text`} className="text-sm font-bold text-fg-2">
              {e.text}
            </label>
            <span className={cn("text-xs", textLength > tipLimits.textMax ? "text-danger-fg" : "text-fg-4")}>
              {format(e.counter, { n: textLength, max: tipLimits.textMax })}
            </span>
          </span>
          <textarea
            ref={textRef}
            id={`${ids}-text`}
            rows={3}
            value={text}
            onChange={(ev) => setText(ev.target.value)}
            placeholder={e.textPlaceholder}
            aria-invalid={showTextError}
            aria-describedby={showTextError ? `${ids}-text-error` : undefined}
            className={cn(inputClass, "min-h-[88px] resize-y py-3 leading-normal")}
          />
          {showTextError && textErr ? (
            <span id={`${ids}-text-error`} className="text-[13px] text-danger-fg">
              {format(e.errors[textErr], { min: tipLimits.textMin, max: tipLimits.textMax })}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${ids}-reason`} className="text-sm font-bold text-fg-2">
              {e.reason}
            </label>
            <span className={cn("text-xs", reasonLength > tipLimits.reasonMax ? "text-danger-fg" : "text-fg-4")}>
              {format(e.counter, { n: reasonLength, max: tipLimits.reasonMax })}
            </span>
          </span>
          <textarea
            ref={reasonRef}
            id={`${ids}-reason`}
            rows={3}
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            placeholder={e.reasonPlaceholder}
            aria-invalid={showReasonError}
            aria-describedby={showReasonError ? `${ids}-reason-error` : undefined}
            className={cn(inputClass, "min-h-[88px] resize-y py-3 leading-normal")}
          />
          {showReasonError && reasonErr ? (
            <span id={`${ids}-reason-error`} className="text-[13px] text-danger-fg">
              {format(e.errors[reasonErr], { min: tipLimits.reasonMin, max: tipLimits.reasonMax })}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
            <label htmlFor={`${ids}-neighborhood`} className="text-sm font-bold text-fg-2">
              {e.neighborhood}
            </label>
            <select
              id={`${ids}-neighborhood`}
              value={neighborhoodId}
              onChange={(ev) => {
                setNeighborhoodId(ev.target.value);
                setLabId("");
              }}
              className={cn(inputClass, "h-[46px] pr-8 text-[15px]")}
            >
              {neighborhoodsOf.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
            <label htmlFor={`${ids}-lab`} className="text-sm font-bold text-fg-2">
              {e.lab}
            </label>
            <select
              id={`${ids}-lab`}
              value={labId}
              onChange={(ev) => setLabId(ev.target.value)}
              aria-describedby={`${ids}-lab-hint`}
              aria-invalid={fieldError?.field === "lab"}
              className={cn(inputClass, "h-[46px] pr-8 text-[15px]")}
            >
              <option value="">{e.noLab}</option>
              {labsOf(neighborhoodId).map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.name}
                </option>
              ))}
            </select>
            <span id={`${ids}-lab-hint`} className={cn("text-xs", fieldError?.field === "lab" ? "text-danger-fg" : "text-fg-4")}>
              {fieldError?.field === "lab" ? errorText(fieldError.error) : e.labHint}
            </span>
          </div>
        </div>

        {isToday ? (
          <p className="m-0 rounded-xl border border-warning/35 bg-warning/8 px-3.5 py-3 text-sm leading-normal text-fg-2">{e.todayFixed}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-when`} className="text-sm font-bold text-fg-2">
              {e.when}
            </label>
            <select
              id={`${ids}-when`}
              value={when}
              onChange={(ev) => {
                setWhen(ev.target.value);
                setFieldError(null);
              }}
              aria-invalid={fieldError?.field === "day" && when !== "other"}
              aria-describedby={fieldError?.field === "day" ? `${ids}-day-error` : undefined}
              className={cn(inputClass, "h-[46px] pr-8 text-[15px]")}
            >
              <option value="auto">{e.auto}</option>
              {quick.map((day) => (
                <option key={day} value={day} disabled={taken.has(day)}>
                  {format(taken.has(day) ? e.dayTakenOption : e.dayOption, { date: dayLabel(day), weekday: weekdayLabel(day) })}
                </option>
              ))}
              <option value="other">{e.otherDay}</option>
            </select>
            {when === "other" ? (
              <div className="flex flex-col gap-1.5 pt-1">
                <label htmlFor={`${ids}-day`} className="text-[13px] font-bold text-fg-3">
                  {e.otherDayLabel}
                </label>
                <input
                  id={`${ids}-day`}
                  type="date"
                  value={otherDay}
                  min={range.min}
                  max={range.max}
                  onChange={(ev) => {
                    setOtherDay(ev.target.value);
                    setFieldError(null);
                  }}
                  aria-invalid={fieldError?.field === "day"}
                  aria-describedby={fieldError?.field === "day" ? `${ids}-day-error` : undefined}
                  className={cn(inputClass, "h-[46px] text-[15px]")}
                />
              </div>
            ) : null}
            {fieldError?.field === "day" ? (
              <span id={`${ids}-day-error`} role="alert" className="text-[13px] text-danger-fg">
                {errorText(fieldError.error)}
              </span>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2.5">
          {!tip || tip.status !== "POOL" ? (
            <>
              <button type="button" disabled={disabled} onClick={() => submit("DRAFT")} className={secondary}>
                {!tip ? e.saveDraft : tip.status === "DRAFT" ? e.saveDraftAgain : e.toDraft}
              </button>
              <button type="button" disabled={disabled} onClick={() => submit("POOL")} className={primary}>
                {e.addToPool}
              </button>
            </>
          ) : (
            <button type="button" disabled={disabled} onClick={() => submit("POOL")} className={primary}>
              {e.saveChanges}
            </button>
          )}
        </div>

        {tip && tip.status !== "ARCHIVED" && !isToday ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onArchive(tip)}
            className="inline-flex h-[38px] items-center gap-2 self-start px-1 text-sm font-bold text-fg-3 hover:text-fg disabled:opacity-60"
          >
            <Archive className="size-4" strokeWidth={2} aria-hidden="true" />
            {e.archive}
          </button>
        ) : null}
      </div>

      <div className="order-1 flex flex-col gap-2.5 lg:sticky lg:top-0 lg:order-2">
        <span className="flex items-center gap-2 text-xs font-bold tracking-[1px] text-fg-4">
          <UserRound className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {e.preview}
        </span>
        <TipCard text={normalizeTipText(text) || e.previewText} reason={normalizeTipText(reason) || e.previewReason} date={previewDate} />
      </div>
    </div>
  );
}
