"use client";

import { CheckCheck, Eye, Info, Plus, TriangleAlert, User, Users, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { ClassCard } from "@/components/classroom/ClassCard";
import { SummaryBox } from "@/components/classroom/SummaryBox";
import { Loading } from "@/components/status/Loading";
import { format, getMessages } from "@/lib/i18n";
import type { GazeView } from "./types";

export type GazeState = { id: string; name: string; data: GazeView | null };

const noop = () => {};

/**
 * "Öğretmenin gözünden" (Kullanicilar-Son): öğretmenin Sınıflarım ekranı (özet kutuları, sınıf
 * kartları, dikkat isteyenler), salt okunur. Üstte sarı şerit: kimin ekranı, "sadece bakıyorsun",
 * "bu bakış kayıtlara yazıldı". Sınıf kodu, sınıfa git ve öğrenci adları yok. Tam ekran pencere.
 */
export function GazeOverlay({ state, onClose, overlay }: { state: GazeState | null; onClose: () => void; overlay?: ReactNode }) {
  const t = getMessages().adminUsers.gaze;
  const ref = useRef<HTMLDialogElement>(null);
  const open = state !== null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={state ? format(t.banner, { name: state.name }) : t.label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-full max-w-full border-0 bg-canvas p-0 text-fg backdrop:bg-scrim open:flex open:flex-col open:[animation:fade-in_.2s_ease-out_both]"
    >
      {state ? (
        <>
          <div className="flex flex-none items-center gap-3 bg-warning px-4 py-3 text-on-warning lg:px-6">
            <Eye className="size-5 flex-none" strokeWidth={2.2} aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-[15px] break-words">{format(t.banner, { name: state.name })}</b>
              <span className="text-xs font-semibold">{t.bannerText}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-[38px] flex-none cursor-pointer items-center gap-1.5 rounded-[10px] border-0 bg-on-warning px-3 font-[inherit] text-sm font-bold text-warning"
            >
              <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
              {t.close}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-10 lg:px-10 lg:pt-8">
            {state.data ? <GazeBody view={state.data} /> : <Loading className="mx-auto max-w-[1100px]" text={t.loading} />}
          </div>
        </>
      ) : null}
      {overlay}
    </dialog>
  );
}

function GazeBody({ view }: { view: GazeView }) {
  const t = getMessages().adminUsers.gaze;
  const c = getMessages().classroom;
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 lg:gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] text-fg-3">{format(t.hello, { name: view.firstName })}</span>
        <h2 className="m-0 font-heading text-[28px] leading-[1.1] font-bold lg:text-[32px]">{c.title}</h2>
      </div>

      <div className="grid grid-cols-3 gap-2.5 lg:gap-3.5">
        <SummaryBox compact Icon={Users} tone="accent" value={view.summary.classes} label={c.summary.classes} />
        <SummaryBox compact Icon={User} tone="purple" value={view.summary.students} label={c.summary.students} />
        <SummaryBox compact Icon={CheckCheck} tone="success" value={view.summary.week} label={c.summary.week} />
      </div>

      {view.classes.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-[20px] border-2 border-dashed border-line px-4 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-card">
            <Plus className="size-[22px] text-accent-fg" strokeWidth={2.4} aria-hidden="true" />
          </span>
          <b className="text-[15px]">{t.emptyTitle}</b>
          <span className="max-w-[340px] text-[13px] text-fg-3">{t.emptyText}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-3.5">
              {view.classes.map((card) => (
                <ClassCard key={card.id} card={{ ...card, code: "", qr: { size: 0, bits: "" } }} onCopy={noop} onProject={noop} readOnly />
              ))}
            </div>
            <span className="text-xs text-fg-4">{t.classOnly}</span>
          </div>
          <section
            aria-labelledby="gaze-attention"
            className="flex flex-col gap-2.5 rounded-[20px] border border-warning/30 bg-surface p-4 max-lg:order-first"
          >
            <h3 id="gaze-attention" className="m-0 text-[15px] font-bold">
              {c.attention.title}
            </h3>
            {view.attention.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {view.attention.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5 rounded-[14px] border border-card bg-surface-deep p-3">
                    <span className="flex size-[30px] flex-none items-center justify-center rounded-[10px] bg-warning/14">
                      <TriangleAlert className="size-4 text-warning-fg" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <b className="text-sm break-words">{item.name}</b>
                      <span className="text-[13px] leading-[1.45] text-fg-2">{item.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[13px] leading-[1.45] text-fg-2">{c.attention.none}</p>
            )}
          </section>
        </div>
      )}

      <p className="m-0 flex items-start gap-2.5 rounded-[14px] border border-line bg-surface-deep px-4 py-3.5 text-[13px] leading-normal text-fg-3">
        <Info className="mt-px size-4 flex-none" strokeWidth={2} aria-hidden="true" />
        <span>{t.privacy}</span>
      </p>
    </div>
  );
}
