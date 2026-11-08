"use client";

import { CalendarDays, Info } from "lucide-react";
import { useId, useMemo, useState, useTransition, type FormEvent } from "react";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { endHomework, giveHomework } from "@/lib/classroom/teacher-actions";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { errorText } from "./client";
import { Sheet } from "./Sheet";
import type { ClassroomDetailData, HoodView } from "./types";

/**
 * Ödev ver penceresi (Sinif-Detay-Son): bir mahalle, odaları ve isteğe bağlı son tarih.
 * "Puanlanmaz, sadece kimin bitirdiği görünür." Aynı anda tek ödev: başka mahalle seçilirse açık
 * ödev geçmişe taşınır. Açık ödevin mahallesi seçiliyken odaları ve son tarihi kaydedilir ya da
 * ödev bitirilir. Seçilen odayı açan eğitim kendiliğinden işaretlenir ve kaldırılamaz (15 Ekim,
 * Murat); sunucu aynı kuralı lib/classroom/homework.ts ile yeniden uygular.
 */
export function HomeworkDialog({
  hoodId,
  data,
  onClose,
  onDone,
}: {
  /** Açılınca seçili gelen mahalle; null ise pencere kapalı. */
  hoodId: string | null;
  data: ClassroomDetailData;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const h = getMessages().classroom.detail.homework;
  const titleId = useId();
  return (
    <Sheet
      open={hoodId !== null}
      onClose={onClose}
      labelledBy={titleId}
      closeLabel={h.close}
      className="lg:max-w-[560px]"
      title={
        <div className="flex flex-col gap-0.5">
          <h2 id={titleId} className="m-0 font-heading text-[22px] font-bold break-words">
            {format(h.title, { name: data.name })}
          </h2>
          <p className="m-0 text-[13px] leading-normal text-fg-3">{h.text}</p>
        </div>
      }
    >
      {hoodId !== null ? <HomeworkForm key={hoodId} initialHood={hoodId} data={data} onDone={onDone} /> : null}
    </Sheet>
  );
}

function HomeworkForm({ initialHood, data, onDone }: { initialHood: string; data: ClassroomDetailData; onDone: (message: string) => void }) {
  const t = getMessages().classroom;
  const h = t.detail.homework;
  const ids = { due: useId(), hint: useId() };
  const current = data.homework;
  const [hoodId, setHoodId] = useState(initialHood);
  const [picked, setPicked] = useState(() => initialPick(data, initialHood));
  const [due, setDue] = useState(current && current.neighborhoodId === initialHood ? current.dueInput : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = data.hoods.find((x) => x.id === hoodId) ?? null;
  const same = current !== null && current.neighborhoodId === hoodId;
  const labs = useMemo(() => selected?.labs ?? [], [selected]);
  // Seçili odaları açan eğitimler: işaretli gelir, kaldırılamaz.
  const required = useMemo(() => {
    const gateOf = new Map(labs.map((lab) => [lab.id, lab.gate]));
    const out = new Set<string>();
    for (const id of picked) {
      for (let gate = gateOf.get(id) ?? null; gate && !out.has(gate); gate = gateOf.get(gate) ?? null) out.add(gate);
    }
    return out;
  }, [labs, picked]);
  const chosen = labs.filter((lab) => picked.has(lab.id) || required.has(lab.id));
  const allChosen = labs.length > 0 && chosen.length === labs.length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!selected || selected.labCount === 0 || pending) return;
    if (chosen.length === 0) {
      setError(t.errors.noRooms);
      return;
    }
    // Tarih kutusu "YYYY-AA-GG" verir; sınırlar aynı biçimde, sözlük sırasıyla karşılaştırılır.
    if (due && (due < data.dueBounds.min || due > data.dueBounds.max)) {
      setError(t.errors.dueDate);
      return;
    }
    startTransition(async () => {
      const result = await giveHomework({ classroomId: data.id, neighborhoodId: selected.id, labIds: chosen.map((lab) => lab.id), due });
      if (!result.ok) {
        setError(errorText(result.error));
        return;
      }
      onDone(result.result === "created" ? format(t.toasts.homeworkGiven, { name: selected.name }) : t.toasts.dueSaved);
    });
  }

  function end() {
    setError(null);
    startTransition(async () => {
      const result = await endHomework({ classroomId: data.id });
      if (result.ok) onDone(t.toasts.homeworkEnded);
      else setError(errorText(result.error));
    });
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">{h.neighborhoods}</legend>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {data.hoods.map((hood) => {
            const tone = toneOf(hood.color);
            const isSelected = hood.id === hoodId;
            const disabled = hood.labCount === 0;
            return (
              <label
                key={hood.id}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border-[1.5px] px-3.5 py-3 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent",
                  isSelected ? cn(tone.border, tone.soft) : "border-line bg-surface-deep",
                  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                )}
              >
                <input
                  type="radio"
                  name="neighborhood"
                  value={hood.id}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => {
                    setHoodId(hood.id);
                    setPicked(initialPick(data, hood.id));
                    setError(null);
                  }}
                  className="sr-only"
                />
                <span aria-hidden="true" className={cn("size-3 flex-none rounded-full", tone.fill)} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{hood.name}</span>
                  <span className="text-xs text-fg-3">{disabled ? h.noLabs : format(h.option, { labs: hood.labCount, pct: hood.pct })}</span>
                </span>
                {hood.current ? <span className="rounded-full bg-accent px-[7px] py-0.5 text-[10px] font-bold text-on-accent">{h.open}</span> : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      {labs.length > 0 ? (
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-bold text-fg-2">{h.rooms}</legend>
          <span className="-mt-1 text-xs leading-normal text-fg-3">{h.roomsHint}</span>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-fg-2" aria-live="polite">
              {format(h.roomCount, { count: chosen.length })}
            </span>
            <button
              type="button"
              onClick={() => {
                setPicked(allChosen ? new Set() : new Set(labs.map((lab) => lab.id)));
                setError(null);
              }}
              className="h-10 cursor-pointer rounded-[10px] px-2.5 text-[13px] font-bold text-accent-light hover:bg-surface-raised"
            >
              {allChosen ? h.none : h.all}
            </button>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {labs.map((lab) => {
              const locked = required.has(lab.id);
              const on = locked || picked.has(lab.id);
              return (
                <li key={lab.id} className={cn(!lab.training && "pl-5")}>
                  <label
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-accent",
                      on ? "border-line-strong bg-surface-raised" : "border-line bg-surface-deep",
                      locked ? "cursor-not-allowed" : "cursor-pointer",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={locked}
                      onChange={() => {
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (next.has(lab.id)) next.delete(lab.id);
                          else next.add(lab.id);
                          return next;
                        });
                        setError(null);
                      }}
                      className="size-[18px] flex-none accent-accent"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-bold break-words">{lab.name}</span>
                      <span className="text-xs text-fg-3">{locked ? h.required : !lab.training ? h.scenario : lab.gate === null ? h.basic : h.training}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.due} className="text-sm font-bold text-fg-2">
          {h.due}
        </label>
        <span className="relative block">
          <CalendarDays className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-4" strokeWidth={2} aria-hidden="true" />
          <input
            id={ids.due}
            type="date"
            name="due"
            value={due}
            min={data.dueBounds.min}
            max={data.dueBounds.max}
            onChange={(e) => {
              setDue(e.target.value);
              setError(null);
            }}
            aria-describedby={ids.hint}
            className="h-[50px] w-full rounded-xl border border-line bg-canvas pr-3.5 pl-10 text-base text-fg focus:border-accent focus:outline-none"
          />
        </span>
        <span id={ids.hint} className="text-xs text-fg-3">
          {h.dueHint}
        </span>
      </div>

      <p className="m-0 flex gap-2.5 rounded-xl border border-card bg-surface-raised px-3.5 py-3 text-[13px] leading-normal text-fg-3">
        <Info className="mt-0.5 size-4 flex-none text-accent-light" strokeWidth={2} aria-hidden="true" />
        <span>
          {same ? h.endNote : current ? format(h.visibleReplaces, { name: current.name }) : h.visible}
        </span>
      </p>

      {error ? (
        <p role="alert" className="m-0 text-[13px] font-medium text-danger-fg">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !selected || selected.labCount === 0 || chosen.length === 0}
        className="flex h-[50px] cursor-pointer items-center justify-center rounded-xl bg-accent px-3 text-base font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? h.saving : same ? h.save : format(h.give, { name: selected?.name ?? "" })}
      </button>
      {same ? (
        <button
          type="button"
          onClick={end}
          disabled={pending}
          className="h-10 cursor-pointer rounded-xl text-sm font-bold text-danger-fg hover:bg-danger/8 disabled:cursor-wait"
        >
          {h.end}
        </button>
      ) : null}
    </form>
  );
}

/** Pencere açılınca ya da mahalle değişince seçili odalar: açık ödevin mahallesiyse ödevin odaları, değilse hepsi. */
function initialPick(data: ClassroomDetailData, hoodId: string): Set<string> {
  const hood: HoodView | undefined = data.hoods.find((x) => x.id === hoodId);
  if (data.homework && data.homework.neighborhoodId === hoodId) return new Set(data.homework.labs.map((lab) => lab.id));
  return new Set(hood?.labs.map((lab) => lab.id) ?? []);
}
