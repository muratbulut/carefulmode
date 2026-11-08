"use client";

import { Lightbulb, Pencil, Pin, Plus, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { inputClass } from "@/components/admin/editor/fields";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { format, getMessages, rich } from "@/lib/i18n";
import { archiveTip, pinTipDay, undoTipChange, type TipActionError } from "@/lib/tips/actions";
import type { AdminTip, AdminTipNeighborhood, TipAdminData } from "@/lib/tips/data";
import { dayLabel, weekdayLabel } from "@/lib/tips/format";
import { stripDays } from "@/lib/tips/rules";
import type { DayKey, TipStatus } from "@/lib/tips/schedule";
import { cn } from "@/lib/utils";
import { nextToast, UndoToast, type ToastData } from "../UndoToast";
import { TipEditor } from "./TipEditor";
import { TipSheet } from "./TipSheet";

const statusTone: Record<TipStatus, string> = {
  POOL: "bg-success/12 text-success-fg",
  DRAFT: "bg-fg-3/12 text-fg-3",
  ARCHIVED: "bg-fg-4/12 text-fg-4",
};

const thousands = (n: number) => n.toLocaleString("tr-TR");
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Yönetim · Günün ipucu (Tur 4, C3; tahtalar Ipucu-C3-Bugun ve -Mobil): üstte bugün öğrencilerin
 * gördüğü ipucu ve sayıları, ortada sıradaki 6 gün (bir güne basınca o günün ipucu seçilir),
 * altta havuz (mahalle süzgeci, arama). Her işlemden sonra 5 saniyelik "Geri al". Öğrenci adı
 * yok, yalnızca toplam sayılar.
 */
export function TipsAdmin({ data }: { data: TipAdminData }) {
  const t = getMessages().tips;
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [editing, setEditing] = useState<{ tipId: string | null } | null>(null);
  const [dayOpen, setDayOpen] = useState<DayKey | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [pending, startTransition] = useTransition();

  const tipOf = (id: string | null) => (id ? (data.tips.find((x) => x.id === id) ?? null) : null);
  const neighborhoodOf = (id: string | null) => (id ? (data.neighborhoods.find((n) => n.id === id) ?? null) : null);
  const todayId = data.todayTip?.id ?? null;
  const pool = data.tips.filter((x) => x.status === "POOL");
  const archived = data.tips.filter((x) => x.status === "ARCHIVED").length;
  const q = query.trim().toLocaleLowerCase("tr");
  const visible = data.tips.filter(
    (x) => (showArchive || x.status !== "ARCHIVED") && (!filter || x.neighborhoodId === filter) && (!q || x.text.toLocaleLowerCase("tr").includes(q)),
  );

  const say = (message: string, undoKey?: string | null) => setToast(nextToast({ message, undo: undoKey ? () => undo(undoKey) : undefined }));
  const fail = (error: TipActionError) => setToast(nextToast({ message: t.errors[error], tone: "error" }));

  function run(task: () => Promise<void>) {
    startTransition(async () => {
      try {
        await task();
      } catch {
        fail("failed");
      }
    });
  }

  function undo(key: string) {
    run(async () => {
      const result = await undoTipChange(key);
      if (!result.ok) return fail(result.error);
      say(t.toasts.undone);
    });
  }

  function pin(day: DayKey, tipId: string | null, current: boolean) {
    setDayOpen(null);
    if (current) return;
    run(async () => {
      const result = await pinTipDay(day, tipId);
      if (!result.ok) return fail(result.error);
      say(format(tipId ? t.toasts.pinned : t.toasts.auto, { date: dayLabel(day) }), result.undoKey);
    });
  }

  function archive(tip: AdminTip) {
    run(async () => {
      const result = await archiveTip(tip.id);
      if (!result.ok) return fail(result.error);
      setEditing(null);
      say(t.toasts.archived, result.undoKey);
    });
  }

  const editingTip = editing ? tipOf(editing.tipId) : null;
  const day = dayOpen ? data.plan.find((d) => d.day === dayOpen) : null;

  return (
    <main className="flex flex-col gap-[22px] px-4 pt-6 pb-16 lg:px-9 lg:pt-8 lg:pb-[72px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-heading text-[26px] leading-[1.1] font-bold lg:text-[34px]">{t.title}</h1>
          <p className="m-0 max-w-[640px] text-sm leading-[1.55] text-fg-3 lg:text-[15px]">{t.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ tipId: null })}
          className="inline-flex h-[46px] items-center gap-2 self-start rounded-xl bg-accent px-[18px] text-[15px] font-bold text-on-accent lg:self-auto"
        >
          <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
          {t.newTip}
        </button>
      </div>

      <TodaySection data={data} tip={tipOf(todayId)} neighborhood={neighborhoodOf(tipOf(todayId)?.neighborhoodId ?? null)} />

      <section aria-labelledby="tips-next" className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="tips-next" className="m-0 text-base font-bold">
            {t.next.title}
          </h2>
          <span className="text-[13px] text-fg-4">{t.next.hint}</span>
        </div>
        <ul className="-mx-4 flex list-none gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-6 lg:overflow-visible lg:p-0">
          {data.plan.slice(1, 1 + stripDays).map((d) => {
            const tip = tipOf(d.tipId);
            const tone = toneOf(neighborhoodOf(tip?.neighborhoodId ?? null)?.color ?? "");
            return (
              <li key={d.day} className="flex w-[240px] flex-none lg:w-auto lg:min-w-0">
                <button
                  type="button"
                  onClick={() => setDayOpen(d.day)}
                  disabled={pending}
                  className="relative flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-line bg-surface p-3.5 text-left text-fg transition-colors hover:border-line-strong"
                >
                  <span className="flex w-full items-center justify-between gap-1.5">
                    <b className="text-sm">{dayLabel(d.day)}</b>
                    {d.pinned ? (
                      <span className="flex text-accent-fg">
                        <Pin className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        <span className="sr-only">{t.next.pinned}</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="-mt-1.5 text-xs text-fg-4">{weekdayLabel(d.day)}</span>
                  <span aria-hidden="true" className={cn("h-[3px] w-7 rounded-full", tip ? tone.fill : "bg-line-strong")} />
                  <span className="line-clamp-3 text-[13px] leading-[1.45] text-fg-2">{tip?.text ?? t.next.empty}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="tips-pool" className="flex flex-col gap-2.5 lg:gap-0 lg:overflow-hidden lg:rounded-[20px] lg:border lg:border-line lg:bg-surface">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3.5 lg:px-[18px] lg:py-4">
          <h2 id="tips-pool" className="m-0 text-base font-bold">
            {format(t.pool.title, { n: pool.length })}
          </h2>
          <div className="flex flex-col gap-2.5 lg:flex-row lg:flex-wrap lg:items-center">
            <div role="group" aria-label={t.pool.filterLabel} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
              <FilterChip label={t.pool.all} dot="bg-accent" on={filter === null} onClick={() => setFilter(null)} />
              {data.neighborhoods.map((n) => (
                <FilterChip key={n.id} label={n.name} dot={toneOf(n.color).fill} on={filter === n.id} onClick={() => setFilter(filter === n.id ? null : n.id)} />
              ))}
            </div>
            <label className="relative block lg:w-[220px]">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[17px] -translate-y-1/2 text-fg-4" strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t.pool.searchLabel}
                placeholder={t.pool.searchPlaceholder}
                className={cn(inputClass, "h-[42px] pl-10 text-sm")}
              />
            </label>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="m-0 rounded-[14px] border border-line bg-surface px-4 py-4 text-sm text-fg-3 lg:rounded-none lg:border-0 lg:border-t lg:border-card lg:px-[18px]">
            {data.tips.length === 0 ? t.pool.emptyPool : t.pool.empty}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:gap-0">
            {visible.map((tip) => (
              <PoolRow key={tip.id} tip={tip} data={data} neighborhood={neighborhoodOf(tip.neighborhoodId)} onOpen={() => setEditing({ tipId: tip.id })} />
            ))}
          </ul>
        )}

        {archived > 0 ? (
          <button
            type="button"
            onClick={() => setShowArchive((s) => !s)}
            aria-pressed={showArchive}
            className="h-10 self-start rounded-[10px] px-1 text-[13px] font-bold text-fg-3 hover:text-fg lg:mx-[18px] lg:mb-3 lg:mt-1"
          >
            {showArchive ? t.pool.hideArchive : format(t.pool.showArchive, { n: archived })}
          </button>
        ) : null}
      </section>

      <TipSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        labelledBy="tips-editor-title"
        title={editingTip ? t.editor.editTitle : t.editor.newTitle}
        className="lg:max-w-[920px]"
      >
        {editing ? (
          <TipEditor
            key={editing.tipId ?? "new"}
            tip={editingTip}
            data={data}
            isToday={!!editingTip && editingTip.id === todayId}
            busy={pending}
            onSaved={(message, undoKey) => {
              setEditing(null);
              say(message, undoKey);
            }}
            onArchive={archive}
            onError={fail}
          />
        ) : null}
      </TipSheet>

      <TipSheet
        open={day != null}
        onClose={() => setDayOpen(null)}
        labelledBy="tips-day-title"
        kicker={t.day.kicker}
        title={day ? format(t.day.title, { date: dayLabel(day.day), weekday: weekdayLabel(day.day) }) : ""}
        className="lg:max-w-[520px]"
      >
        {day ? (
          <div role="group" aria-label={t.day.options} className="flex flex-col gap-2">
            <DayOption title={t.day.auto} sub={t.day.autoHint} dot="bg-fg-4" on={!day.pinned} disabled={pending} onClick={() => pin(day.day, null, !day.pinned)} />
            {pool.map((tip) => {
              const area = neighborhoodOf(tip.neighborhoodId);
              return (
                <DayOption
                  key={tip.id}
                  title={tip.text}
                  sub={area ? format(t.day.sub, { neighborhood: area.name, n: tip.shown }) : format(t.day.subPlain, { n: tip.shown })}
                  dot={toneOf(area?.color ?? "").fill}
                  on={day.pinned && day.tipId === tip.id}
                  disabled={pending}
                  onClick={() => pin(day.day, tip.id, day.pinned && day.tipId === tip.id)}
                />
              );
            })}
          </div>
        ) : null}
      </TipSheet>

      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function TodaySection({ data, tip, neighborhood }: { data: TipAdminData; tip: AdminTip | null; neighborhood: AdminTipNeighborhood | null }) {
  const t = getMessages().tips;
  const today = data.todayTip;
  if (!today || !tip) {
    return (
      <section aria-labelledby="tips-today" className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4 lg:p-6">
        <h2 id="tips-today" className="m-0 text-base font-bold">
          {t.today.emptyTitle}
        </h2>
        <p className="m-0 max-w-[640px] text-sm leading-normal text-fg-3">{t.today.emptyText}</p>
      </section>
    );
  }
  const lab = neighborhood?.labs.find((l) => l.id === tip.labId)?.name ?? null;
  const rate = today.views > 0 ? format(t.today.rate, { n: percent(today.reasonViews, today.views) }) : t.today.noRate;

  return (
    <section
      aria-labelledby="tips-today"
      className="grid grid-cols-1 gap-4 rounded-[20px] border border-line bg-surface p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-6 lg:p-6"
    >
      <div className="flex min-w-0 flex-col gap-3">
        <h2 id="tips-today" className="m-0 flex items-center gap-2 text-xs font-bold tracking-[1.5px] text-warning-fg">
          <span aria-hidden="true" className="size-2 rounded-full bg-success motion-safe:anim-breathe-fast" />
          {t.today.kicker}
        </h2>
        <div className="flex flex-col gap-3 rounded-[18px] border border-warning/35 bg-warning/8 p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-warning/16">
              <Lightbulb className="size-5 text-warning" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <b>{t.title}</b>
              <span className="text-xs text-fg-3">{dayLabel(data.today)}</span>
            </span>
          </div>
          <p className="m-0 text-[17px] leading-[1.55] [overflow-wrap:anywhere]">{tip.text}</p>
          <p className="m-0 rounded-xl bg-canvas/50 px-3.5 py-3 text-sm leading-[1.55] [overflow-wrap:anywhere] text-fg-2">
            <b className="text-warning-fg">{t.today.why}</b> {tip.reason}
          </p>
        </div>
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-3.5">
        <dl className="m-0 grid grid-cols-2 gap-2.5 lg:grid-cols-1 lg:gap-4">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-fg-3">{t.today.seen}</dt>
            <dd className="m-0 font-heading text-xl font-bold lg:text-[26px]">{thousands(today.views)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-fg-3">{t.today.reasonViewed}</dt>
            <dd className="m-0 flex flex-wrap items-baseline gap-x-2">
              <span className="font-heading text-xl font-bold lg:text-[26px]">{rate}</span>
              <span className="text-xs text-fg-4">{format(t.today.reasonCount, { n: thousands(today.reasonViews) })}</span>
            </dd>
          </div>
        </dl>
        <span className="flex flex-col gap-1 text-[13px] leading-normal text-fg-3">
          {neighborhood ? (
            <span>
              {lab
                ? rich(format(t.today.neighborhoodLab, { neighborhood: neighborhood.name }), {
                    b: (chunk) => <b className="text-fg">{format(chunk, { lab })}</b>,
                  })
                : format(t.today.neighborhoodOnly, { neighborhood: neighborhood.name })}
            </span>
          ) : null}
          <span>{format(t.today.shown, { n: Math.max(tip.shown, 1) })}</span>
        </span>
      </div>
    </section>
  );
}

function FilterChip({ label, dot, on, onClick }: { label: string; dot: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold text-fg transition-colors",
        on ? "border-accent bg-card" : "border-line bg-transparent hover:border-line-strong",
      )}
    >
      <span aria-hidden="true" className={cn("size-2 rounded-[3px]", dot)} />
      {label}
    </button>
  );
}

function StatusBadge({ status, className }: { status: TipStatus; className?: string }) {
  const t = getMessages().tips;
  return (
    <span className={cn("inline-flex h-[22px] flex-none items-center rounded-full px-2 text-xs font-bold", statusTone[status], className)}>
      {t.pool.status[status]}
    </span>
  );
}

/** Havuz satırı: masaüstünde tablo satırı, telefonda kart (Ipucu-C3-Bugun-Mobil). Satıra basınca düzenleyici açılır. */
function PoolRow({ tip, data, neighborhood, onOpen }: { tip: AdminTip; data: TipAdminData; neighborhood: AdminTipNeighborhood | null; onOpen: () => void }) {
  const t = getMessages().tips;
  const tone = toneOf(neighborhood?.color ?? "");
  const isToday = data.todayTip?.id === tip.id;
  const pinned = !!tip.pinnedDay && tip.pinnedDay > data.today;

  let next: string;
  if (isToday) next = t.pool.nextToday;
  else if (tip.status === "DRAFT") next = t.pool.draft;
  else if (tip.status === "ARCHIVED") next = t.pool.archived;
  else if (tip.nextDay) next = format(t.pool.nextDay, { date: dayLabel(tip.nextDay), weekday: weekdayLabel(tip.nextDay) });
  else if (pinned && tip.pinnedDay) next = format(t.pool.pinnedDay, { date: dayLabel(tip.pinnedDay) });
  else next = t.pool.noTurn;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="relative flex w-full flex-col gap-2 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-left text-fg transition-colors hover:border-line-strong lg:flex-row lg:items-center lg:gap-3.5 lg:rounded-none lg:border-0 lg:border-t lg:border-card lg:bg-transparent lg:px-[18px] lg:hover:bg-card/40"
      >
        <span className="flex w-full items-center gap-2 lg:w-[150px] lg:flex-none">
          {neighborhood ? (
            <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs font-bold", tone.text)}>
              <span aria-hidden="true" className={cn("size-2 flex-none rounded-[3px]", tone.fill)} />
              <span className="truncate">{neighborhood.name}</span>
            </span>
          ) : null}
          <span className="flex-1 lg:hidden" />
          <StatusBadge status={tip.status} className="lg:hidden" />
        </span>
        <span className="line-clamp-2 text-sm leading-[1.45] [overflow-wrap:anywhere] lg:line-clamp-none lg:min-w-0 lg:flex-1">{tip.text}</span>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-4 lg:contents">
          <span className={cn("inline-flex items-center gap-1 font-bold lg:w-[150px] lg:flex-none lg:text-[13px]", isToday ? "text-warning-fg" : "text-fg-3")}>
            {pinned ? (
              <>
                <Pin className="size-3.5 flex-none text-accent-fg" strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">{t.pool.pinnedIcon}</span>
              </>
            ) : null}
            {next}
          </span>
          <span className="lg:w-[130px] lg:flex-none lg:text-[13px] lg:text-fg-3">
            {tip.shown > 0 ? format(t.pool.why, { n: percent(tip.reasonViews, tip.views) }) : null}
          </span>
        </span>
        <span className="hidden lg:block lg:w-[80px] lg:flex-none">
          <StatusBadge status={tip.status} />
        </span>
        <span aria-hidden="true" className="hidden size-[38px] flex-none items-center justify-center rounded-[10px] border border-line bg-surface-raised text-fg-2 lg:flex">
          <Pencil className="size-4" strokeWidth={2} />
        </span>
      </button>
    </li>
  );
}

function DayOption({ title, sub, dot, on, disabled, onClick }: { title: string; sub: string; dot: string; on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-surface-deep p-3 text-left text-fg transition-colors disabled:opacity-60",
        on ? "border-accent" : "border-line hover:border-line-strong",
      )}
    >
      <span aria-hidden="true" className={cn("mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border-2", on ? "border-accent" : "border-line-strong")}>
        <span className={cn("size-2.5 rounded-full", on ? "bg-accent" : "bg-transparent")} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-sm leading-[1.45] [overflow-wrap:anywhere]">{title}</span>
        <span className="flex items-center gap-1.5 text-xs text-fg-3">
          <span aria-hidden="true" className={cn("size-[7px] flex-none rounded-[2px]", dot)} />
          {sub}
        </span>
      </span>
    </button>
  );
}
