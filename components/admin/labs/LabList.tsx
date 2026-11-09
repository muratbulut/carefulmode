"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Eye, Lock, Pencil, Plus, ShieldCheck, Users, X, type LucideIcon } from "lucide-react";
import { Dialog } from "@/components/profile/Dialog";
import type { LabStatus } from "@/lib/generated/prisma/enums";
import { moveLab, publishLab, setLabVisibility, undoPublish, type ActionError } from "@/lib/admin/lab-actions";
import type { AdminLabRow, AdminNeighborhood } from "@/lib/admin/lab-data";
import { format, getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { neighborhoodColor, statusColors } from "../colors";
import { nextToast, UndoToast, type ToastData } from "../UndoToast";

const statuses: LabStatus[] = ["PUBLISHED", "DRAFT", "HIDDEN"];

type Confirm = { kind: "hide" | "publish"; row: AdminLabRow; neighborhood: AdminNeighborhood } | null;

const thousands = (n: number) => n.toLocaleString("tr-TR");
/** Bu yüzde ve üstü yeşil, altı sarı. */
const noticedGoodFrom = 60;

/**
 * Lablar-Son: durum kutuları (filtre), mahalle mahalle lab listesi, sıra okları, yayınla /
 * gizle düğmesi ve her işlemden sonra 5 saniyelik "Geri al". Öğrenci adı yok, yalnızca toplamlar.
 */
export function LabList({
  neighborhoods,
  canEdit,
  canPublish,
}: {
  neighborhoods: AdminNeighborhood[];
  canEdit: boolean;
  canPublish: boolean;
}) {
  const t = getMessages().admin;
  const l = t.list;
  const [filter, setFilter] = useState<LabStatus | null>(null);
  const [open, setOpen] = useState<string[]>(() => (neighborhoods[0] ? [neighborhoods[0].id] : []));
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const all = neighborhoods.flatMap((n) => n.labs);
  const count = (status: LabStatus) => all.filter((r) => r.status === status).length;
  const allOpen = open.length === neighborhoods.length;

  const say = (message: string, undo?: () => void) => setToast(nextToast({ message, undo }));
  const fail = (error: ActionError) => setToast(nextToast({ message: t.errors[error], tone: "error" }));

  function run(task: () => Promise<void>) {
    startTransition(async () => {
      try {
        await task();
      } catch {
        fail("failed");
      }
    });
  }

  function hide(row: AdminLabRow, reason: string) {
    setConfirm(null);
    run(async () => {
      const result = await setLabVisibility(row.id, false, reason);
      if (!result.ok) return fail(result.error);
      say(format(l.toasts.hidden, { name: row.name }), () => undo(() => setLabVisibility(row.id, true)));
    });
  }

  function unhide(row: AdminLabRow) {
    run(async () => {
      const result = await setLabVisibility(row.id, true);
      if (!result.ok) return fail(result.error);
      say(format(l.toasts.published, { name: row.name }), () => undo(() => setLabVisibility(row.id, false, row.hideNote ?? "")));
    });
  }

  function publish(row: AdminLabRow) {
    setConfirm(null);
    run(async () => {
      // Yalnızca listede görülen taslak yayınlanır: bu arada değiştiyse liste yenilenir (D9).
      const result = await publishLab(row.id, { revision: row.revision });
      if (!result.ok && result.error === "conflict") {
        setToast(nextToast({ message: format(l.toasts.conflict, { name: row.name }), tone: "error" }));
        router.refresh();
        return;
      }
      if (!result.ok) return fail(result.error);
      say(format(l.toasts.published, { name: row.name }), () => undo(() => undoPublish(row.id, result.version)));
    });
  }

  function move(row: AdminLabRow, direction: -1 | 1) {
    run(async () => {
      const result = await moveLab(row.id, direction);
      if (!result.ok) return fail(result.error);
      say(format(l.toasts.moved, { name: row.name, n: result.position }), () => undo(() => moveLab(row.id, direction === 1 ? -1 : 1)));
    });
  }

  function undo(action: () => Promise<{ ok: true } | { ok: false; error: ActionError }>) {
    run(async () => {
      const result = await action();
      if (!result.ok) return fail(result.error);
      say(l.toasts.undone);
    });
  }

  const toggleGroup = (id: string) => setOpen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <main className="flex flex-col gap-[22px] px-4 pt-6 pb-16 lg:px-9 lg:pt-8 lg:pb-[72px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-heading text-[28px] leading-[1.1] font-bold lg:text-[34px]">{l.title}</h1>
          <p className="m-0 max-w-[640px] text-[15px] leading-[1.55] text-fg-3">{l.intro}</p>
        </div>
        {canEdit ? (
          <Link
            href={paths.adminNewLab}
            className="inline-flex h-[46px] items-center gap-2 self-start rounded-xl bg-accent px-[18px] text-[15px] font-bold text-on-accent no-underline lg:self-auto"
          >
            <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
            {l.newLab}
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2.5 lg:gap-3.5">
        {statuses.map((status) => {
          const on = filter === status;
          return (
            <button
              key={status}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={format(l.filterLabel, { status: t.status[status] })}
              onClick={() => setFilter(on ? null : status)}
              className={cn(
                "flex flex-col gap-1 rounded-2xl border px-3.5 py-3 text-left transition-colors lg:px-[18px] lg:py-4",
                on ? cn("bg-card", statusColors[status].tile) : "border-line bg-surface",
              )}
            >
              <span className="flex items-center gap-2 text-[13px] text-fg-3">
                <span aria-hidden="true" className={cn("size-2 rounded-full", statusColors[status].dot)} />
                {t.status[status]}
              </span>
              <b className="font-heading text-[26px] lg:text-[30px]">{count(status)}</b>
            </button>
          );
        })}
      </div>

      {filter ? (
        <div className="flex items-center gap-2.5 text-sm text-fg-2 [animation:fade-in_.2s_ease-out_both]">
          <span>{l.filterOn[filter]}</span>
          <button type="button" onClick={() => setFilter(null)} className="h-8 rounded-lg px-2.5 text-sm font-bold text-accent-fg">
            {l.showAll}
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2.5">
        <span className="text-[13px] text-fg-3">{format(l.summary, { labs: all.length, neighborhoods: neighborhoods.length })}</span>
        {filter ? null : (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? [] : neighborhoods.map((n) => n.id))}
            className="h-9 rounded-[10px] border border-line bg-surface px-3 text-[13px] font-bold text-fg-2"
          >
            {allOpen ? l.closeAll : l.openAll}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        {neighborhoods.map((n) => {
          const rows = filter ? n.labs.filter((r) => r.status === filter) : n.labs;
          if (filter && rows.length === 0) return null;
          const isOpen = filter !== null || open.includes(n.id);
          const color = neighborhoodColor(n.color);
          const extra = [
            n.drafts ? format(l.groupDrafts, { n: n.drafts }) : "",
            n.hidden ? format(l.groupHidden, { n: n.hidden }) : "",
          ].filter(Boolean);
          const panel = `admin-group-${n.id}`;
          return (
            <section key={n.id} aria-label={n.name} className="overflow-hidden rounded-[20px] border border-line bg-surface">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => (filter ? undefined : toggleGroup(n.id))}
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-4 text-left lg:px-[18px]"
                >
                  <ChevronDown
                    className={cn("size-5 flex-none text-fg-3 transition-transform duration-200", isOpen && "rotate-180")}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  <span aria-hidden="true" className={cn("size-3 flex-none rounded-[4px]", color.dot)} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-3.5">
                    <b className="font-heading text-[17px] lg:text-[19px]">{n.name}</b>
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="text-[13px] text-fg-3">
                        {format(l.groupPublished, { published: n.publishedLabs, total: n.labCount })}
                      </span>
                      <span className="hidden text-[13px] text-fg-4 sm:inline">{format(l.groupFinished, { n: thousands(n.finished) })}</span>
                      {extra.length ? <span className="text-xs font-bold text-warning-fg">{extra.join(" · ")}</span> : null}
                    </span>
                  </span>
                </button>
                {canEdit ? (
                  <Link
                    href={`${paths.adminNewLab}?mahalle=${encodeURIComponent(n.slug)}`}
                    aria-label={format(l.addLabTo, { name: n.name })}
                    className="mr-3 inline-flex size-9 flex-none items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-line-strong text-[13px] font-bold text-fg-2 no-underline lg:mr-4 lg:w-auto lg:px-3"
                  >
                    <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
                    <span className="hidden lg:inline">{l.addLab}</span>
                  </Link>
                ) : null}
              </div>
              {isOpen ? (
                <div id={panel} className="[animation:fade-in_.2s_ease-out_both]">
                  {rows.length === 0 ? (
                    <p className="m-0 border-t border-card px-[18px] py-4 text-sm text-fg-3">{l.empty}</p>
                  ) : (
                    rows.map((row) => {
                      // Sıra okları labın kendi grubunda taşır (ileri eğitimler, aynı eğitimin senaryoları).
                      const siblings = row.group ? n.labs.filter((r) => r.group === row.group) : [];
                      const index = siblings.findIndex((s) => s.id === row.id);
                      return (
                        <LabRow
                          key={row.id}
                          row={row}
                          chip={color.chip}
                          canUp={canPublish && !pending && index > 0}
                          canDown={canPublish && !pending && index >= 0 && index < siblings.length - 1}
                          canPublish={canPublish && !pending}
                          onMove={(direction) => move(row, direction)}
                          onToggle={() => {
                            if (row.status === "HIDDEN") unhide(row);
                            else {
                              setNote("");
                              setConfirm({ kind: row.status === "PUBLISHED" ? "hide" : "publish", row, neighborhood: n });
                            }
                          }}
                        />
                      );
                    })
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <Dialog open={confirm?.kind === "hide"} onClose={() => setConfirm(null)} labelledBy="admin-hide-title" className="max-w-[500px]">
        {confirm?.kind === "hide" ? (
          <>
            <DialogHead id="admin-hide-title" title={format(l.hideDialog.title, { name: confirm.row.name })} onClose={() => setConfirm(null)} />
            <div className="flex flex-col gap-2.5">
              {confirm.row.assignedClasses > 0 ? (
                <InfoLine Icon={AlertTriangle} tone="text-warning-fg">
                  {format(l.hideDialog.assigned, { n: confirm.row.assignedClasses })}
                </InfoLine>
              ) : null}
              {confirm.row.inProgress > 0 ? (
                <InfoLine Icon={Users} tone="text-accent-fg">
                  {format(l.hideDialog.inProgress, { n: confirm.row.inProgress })}
                </InfoLine>
              ) : null}
              <InfoLine Icon={ShieldCheck} tone="text-success-fg">
                {l.hideDialog.kept}
              </InfoLine>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-fg-2">
              {l.hideDialog.reason}
              <span className="-mt-1 text-xs font-medium text-fg-4">{l.hideDialog.reasonHint}</span>
              <input
                type="text"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder={l.hideDialog.reasonPlaceholder}
                className="h-[46px] w-full rounded-xl border border-line bg-canvas px-3.5 text-base font-normal text-fg placeholder:text-fg-4"
              />
            </label>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setConfirm(null)} className="h-12 flex-1 rounded-xl border border-line bg-surface-raised text-[15px] font-bold text-fg">
                {l.hideDialog.cancel}
              </button>
              <button
                type="button"
                onClick={() => hide(confirm.row, note)}
                className="h-12 flex-1 rounded-xl bg-warning text-[15px] font-bold text-on-warning"
              >
                {l.hideDialog.confirm}
              </button>
            </div>
          </>
        ) : null}
      </Dialog>

      <Dialog open={confirm?.kind === "publish"} onClose={() => setConfirm(null)} labelledBy="admin-publish-title" className="max-w-[500px]">
        {confirm?.kind === "publish" ? (
          <>
            <DialogHead
              id="admin-publish-title"
              title={format(l.publishDialog.title, { name: confirm.row.name })}
              onClose={() => setConfirm(null)}
            />
            {confirm.row.ready ? (
              <>
                <div className="flex flex-col gap-2.5">
                  <InfoLine Icon={Eye} tone="text-accent-fg">
                    {confirm.row.type === "TRAINING"
                      ? format(confirm.row.basic ? l.publishDialog.positionTraining : l.publishDialog.positionAdvanced, {
                          neighborhood: confirm.neighborhood.name,
                        })
                      : format(l.publishDialog.position, {
                          neighborhood: confirm.neighborhood.name,
                          n:
                            confirm.neighborhood.labs
                              .filter((r) => r.type === "SCENARIO" && (r.status === "PUBLISHED" || r.id === confirm.row.id))
                              .findIndex((r) => r.id === confirm.row.id) + 1,
                        })}
                  </InfoLine>
                  <InfoLine Icon={ShieldCheck} tone="text-success-fg">
                    {l.publishDialog.silent}
                  </InfoLine>
                </div>
                <Link
                  href={paths.adminLabPreview(confirm.row.id)}
                  className="-my-2.5 inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-accent-fg no-underline"
                >
                  <Eye className="size-4" strokeWidth={2.2} aria-hidden="true" />
                  {l.publishDialog.preview}
                </Link>
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => setConfirm(null)} className="h-12 flex-1 rounded-xl border border-line bg-surface-raised text-[15px] font-bold text-fg">
                    {l.publishDialog.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => publish(confirm.row)}
                    className="h-12 flex-1 rounded-xl bg-success text-[15px] font-bold text-on-accent"
                  >
                    {l.publishDialog.confirm}
                  </button>
                </div>
              </>
            ) : (
              <>
                <InfoLine Icon={AlertTriangle} tone="text-warning-fg">
                  {l.publishDialog.notReady}
                </InfoLine>
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => setConfirm(null)} className="h-12 flex-1 rounded-xl border border-line bg-surface-raised text-[15px] font-bold text-fg">
                    {l.publishDialog.cancel}
                  </button>
                  <Link
                    href={paths.adminLab(confirm.row.id)}
                    className="flex h-12 flex-1 items-center justify-center rounded-xl bg-accent text-[15px] font-bold text-on-accent no-underline"
                  >
                    {l.publishDialog.openEditor}
                  </Link>
                </div>
              </>
            )}
          </>
        ) : null}
      </Dialog>

      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

function DialogHead({ id, title, onClose }: { id: string; title: string; onClose: () => void }) {
  const t = getMessages().admin;
  return (
    <div className="flex items-start justify-between gap-2.5">
      <h2 id={id} className="m-0 font-heading text-[21px] leading-[1.25] font-bold">
        {title}
      </h2>
      <button type="button" onClick={onClose} aria-label={t.close} className="flex size-10 flex-none items-center justify-center rounded-xl text-fg-3 hover:text-fg">
        <X className="size-5" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

function InfoLine({ Icon, tone, children }: { Icon: LucideIcon; tone: string; children: ReactNode }) {
  return (
    <span className="flex gap-2.5 text-sm leading-normal text-fg-2">
      <Icon className={cn("mt-0.5 size-4 flex-none", tone)} strokeWidth={2.2} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

function LabRow({
  row,
  chip,
  canUp,
  canDown,
  canPublish,
  onMove,
  onToggle,
}: {
  row: AdminLabRow;
  chip: string;
  canUp: boolean;
  canDown: boolean;
  canPublish: boolean;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
}) {
  const t = getMessages();
  const l = t.admin.list;
  const training = row.type === "TRAINING";
  const draft = row.status === "DRAFT";
  const status = row.publishedVersion && !draft ? format(t.admin.statusVersion, { status: t.admin.status[row.status], version: row.publishedVersion }) : t.admin.status[row.status];
  const meta = [
    training ? format(l.cards, { n: row.cardCount }) : `${t.admin.newLab.templates[row.template].title} · ${t.lab.difficulty[row.difficulty]}`,
    format(t.lab.durationShort, { n: row.durationMin }),
    row.gateName ? format(l.gateMeta, { name: row.gateName }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const assigned = row.status === "PUBLISHED" && row.assignedClasses > 0 ? `· ${format(l.assigned, { n: row.assignedClasses })}` : null;
  const finished = draft ? null : `· ${format(l.finishedCount, { n: thousands(row.finished) })}`;

  return (
    <div className="flex items-center gap-2.5 border-t border-card px-3 py-3 lg:gap-3.5 lg:px-4">
      {row.basic ? (
        <span className="flex w-[30px] flex-none justify-center text-fg-4 max-lg:w-10">
          <Lock className="size-4" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">{l.fixedFirst}</span>
        </span>
      ) : (
        // Telefonda sıra okları 40 px'lik dokunma alanı alır (masaüstünde 30×24).
        <span className="flex flex-none flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={!canUp}
            aria-label={format(l.moveUp, { name: row.name })}
            className="flex h-6 w-[30px] items-center justify-center rounded-md text-fg-2 disabled:text-line-strong max-lg:size-10"
          >
            <ChevronUp className="size-4" strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={!canDown}
            aria-label={format(l.moveDown, { name: row.name })}
            className="flex h-6 w-[30px] items-center justify-center rounded-md text-fg-2 disabled:text-line-strong max-lg:size-10"
          >
            <ChevronDown className="size-4" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("flex-none rounded-[7px] px-[7px] py-[3px] font-mono text-xs font-bold", chip)}>{row.code}</span>
          <b className="min-w-0 text-[15px] break-words">{row.name}</b>
          {training ? (
            <span className="flex-none rounded-md border border-line px-[7px] py-0.5 text-[11px] font-bold tracking-[0.5px] text-fg-3">
              {row.basic ? l.trainingTag : l.advancedTag}
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-3">
          <span>{meta}</span>
          {assigned ? <span className="font-bold text-accent-fg">{assigned}</span> : null}
          {finished ? <span className="lg:hidden">{finished}</span> : null}
          {row.status === "PUBLISHED" ? null : (
            <span className={cn("rounded-full px-2 py-px font-bold lg:hidden", statusColors[row.status].badge)}>{status}</span>
          )}
        </span>
        {row.hideNote ? <span className="text-xs leading-[1.45] text-warning-fg">{format(l.note, { note: row.hideNote })}</span> : null}
        {row.unreadable ? (
          <span className="text-xs font-bold text-warning-fg">{l.unreadable}</span>
        ) : row.unpublishedChanges ? (
          <span className="text-xs font-bold text-warning-fg">{l.unpublished}</span>
        ) : null}
      </span>

      <span className="hidden w-[84px] flex-none flex-col items-end gap-px lg:flex">
        <b className="text-sm">{draft ? l.none : thousands(row.finished)}</b>
        <span className="text-[11px] text-fg-4">{l.finished}</span>
      </span>
      <NoticedColumn value={row.noticed?.first ?? null} label={l.noticedFirst} />
      <NoticedColumn value={row.noticed?.last ?? null} label={l.noticedLast} />
      <span
        className={cn(
          "hidden h-6 flex-none items-center gap-1.5 rounded-full px-[9px] text-xs font-bold lg:inline-flex",
          statusColors[row.status].badge,
        )}
      >
        <span aria-hidden="true" className={cn("size-[7px] rounded-full", statusColors[row.status].dot)} />
        {status}
      </span>
      <Link
        href={paths.adminLab(row.id)}
        aria-label={format(l.editLabel, { name: row.name })}
        className="inline-flex size-10 flex-none items-center justify-center gap-1.5 rounded-[10px] border border-line bg-surface-raised text-[13px] font-bold text-fg-2 no-underline lg:h-[34px] lg:w-auto lg:px-3"
      >
        <Pencil className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
        <span className="hidden lg:inline">{l.edit}</span>
      </Link>
      <span className="flex flex-none justify-end lg:w-[76px]">
        {draft ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={!canPublish}
            aria-label={format(l.publishLabel, { name: row.name })}
            className="h-8 rounded-[10px] border border-success/50 px-3 text-[13px] font-bold text-success-fg disabled:opacity-50 max-lg:h-10"
          >
            {l.publish}
          </button>
        ) : training && row.status === "PUBLISHED" ? null : (
          <button
            type="button"
            role="switch"
            aria-checked={row.status === "PUBLISHED"}
            aria-label={format(row.status === "PUBLISHED" ? l.hideLabel : l.showLabel, { name: row.name })}
            onClick={onToggle}
            disabled={!canPublish}
            className={cn(
              "relative h-7 w-12 flex-none rounded-full transition-colors duration-200 after:absolute after:-inset-y-1.5 after:inset-x-0 disabled:opacity-50",
              row.status === "PUBLISHED" ? "bg-success" : "bg-line",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-knob shadow-[0_1px_3px_var(--shadow-color-soft)] transition-transform duration-200",
                row.status === "PUBLISHED" && "translate-x-5",
              )}
            />
          </button>
        )}
      </span>
    </div>
  );
}

/** Tuzağı fark eden yüzdesi (ilk seferde ya da tekrar sonrası); yalnızca masaüstünde, senaryo labında. */
function NoticedColumn({ value, label }: { value: number | null; label: string }) {
  const l = getMessages().admin.list;
  return (
    <span className="hidden w-[92px] flex-none flex-col items-end gap-px text-right lg:flex">
      <b className={cn("text-sm", value === null ? "text-fg-4" : value >= noticedGoodFrom ? "text-success-fg" : "text-warning-fg")}>
        {value === null ? l.none : format(l.percent, { n: value })}
      </b>
      <span className="text-[11px] leading-tight text-fg-4">{label}</span>
    </span>
  );
}
