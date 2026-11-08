"use client";

import Link from "next/link";
import { CheckCheck, ChevronRight, Plus, TriangleAlert, User, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/status/EmptyState";
import { Toast } from "@/components/status/Toast";
import { format, getMessages } from "@/lib/i18n";
import { paths, routes } from "@/lib/navigation";
import { ClassCard, NewClassCard } from "./ClassCard";
import { copyText } from "./client";
import { CreateClassDialog } from "./CreateClassDialog";
import { ProjectionOverlay } from "./ProjectionOverlay";
import { SummaryBox } from "./SummaryBox";
import type { AttentionView, ClassesData, ProjectionTarget } from "./types";

/**
 * Sınıflarım (Tur 3, Murat kararı: C1 kartlar + C3 özet ve "Dikkat isteyenler"; tahtalar
 * Siniflarim-Son, -Mobil). Masaüstünde solda kartlar, sağda dikkat isteyenler; telefonda
 * özet, dikkat isteyenler, kartlar sırasıyla.
 */
export function ClassesView({ data, openCreate }: { data: ClassesData; openCreate: boolean }) {
  const t = getMessages().classroom;
  const [creating, setCreating] = useState(openCreate);
  const [projecting, setProjecting] = useState<ProjectionTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // "?yeni=1" pencereyi bir kez açar; adresten silinir ki sayfa yenilenince yeniden açılmasın.
  useEffect(() => {
    if (openCreate) window.history.replaceState(null, "", routes.classes);
  }, [openCreate]);

  async function copyCode(name: string, code: string) {
    setToast((await copyText(code)) ? format(t.toasts.classCodeCopied, { name, code }) : format(t.toasts.copyFailed, { code }));
  }

  const hasClasses = data.classes.length > 0;

  return (
    <div className="relative mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pt-5 pb-28 lg:gap-[22px] lg:px-6 lg:pt-9 lg:pb-[72px]">
      <header className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2 font-mono text-xs tracking-[2px] text-accent-light">
            <Users className="size-[15px]" strokeWidth={2} aria-hidden="true" />
            {t.eyebrow}
          </span>
          <h1 className="m-0 font-heading text-[30px] leading-[1.1] font-bold lg:text-[40px]">{t.title}</h1>
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.55] text-fg-2 lg:text-base">{t.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-11 flex-none cursor-pointer items-center gap-2 self-start rounded-xl bg-accent px-[18px] text-[15px] font-bold text-on-accent lg:h-12 lg:self-auto"
        >
          <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
          {t.newClass}
        </button>
      </header>

      {hasClasses ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 lg:gap-4">
            <SummaryBox Icon={Users} tone="accent" value={data.summary.classes} label={t.summary.classes} />
            <SummaryBox Icon={User} tone="purple" value={data.summary.students} label={t.summary.students} />
            <SummaryBox Icon={CheckCheck} tone="success" value={data.summary.week} label={t.summary.week} />
          </div>

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-5">
            <AttentionBox items={data.attention} />
            <section aria-labelledby="classes-title" className="flex flex-col gap-2.5 lg:order-first">
              <h2 id="classes-title" className="m-0 mt-1 text-base font-bold lg:mt-0">
                {t.yourClasses}
              </h2>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-[18px]">
                {data.classes.map((card) => (
                  <ClassCard key={card.id} card={card} onCopy={() => copyCode(card.name, card.code)} onProject={() => setProjecting(card)} />
                ))}
                <NewClassCard onClick={() => setCreating(true)} />
              </div>
            </section>
          </div>
        </>
      ) : (
        <EmptyState
          Icon={Users}
          title={t.empty.title}
          className="bg-surface py-10"
          action={
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-2 inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-accent px-[18px] text-[15px] font-bold text-on-accent"
            >
              <Plus className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
              {t.newClassCard}
            </button>
          }
        >
          {t.empty.text}
        </EmptyState>
      )}

      <CreateClassDialog
        open={creating}
        onClose={() => setCreating(false)}
        origin={data.origin}
        onToast={setToast}
        onProject={(target) => {
          setCreating(false);
          setProjecting(target);
        }}
      />
      <ProjectionOverlay target={projecting} onClose={() => setProjecting(null)} />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/** Dikkat isteyenler: sınıfın toplamından çıkan uyarılar; öğrenci adı ya da puanı yok. */
function AttentionBox({ items }: { items: AttentionView[] }) {
  const t = getMessages().classroom.attention;
  return (
    <section
      aria-labelledby="attention-title"
      className="relative flex flex-col gap-2.5 overflow-hidden rounded-[20px] border border-warning/30 bg-surface p-4 lg:sticky lg:top-4 lg:p-5"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -top-16 -left-16 size-48 rounded-full bg-warning/10 blur-3xl" />
      <span className="relative flex items-baseline justify-between gap-2">
        <h2 id="attention-title" className="m-0 text-base font-bold">
          {t.title}
        </h2>
        {items.length > 0 ? <span className="text-[13px] text-fg-3">{format(t.count, { count: items.length })}</span> : null}
      </span>
      {items.length > 0 ? (
        <ul className="relative m-0 flex list-none flex-col gap-2.5 p-0">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={paths.classroom(item.id)}
                className="flex items-center gap-3 rounded-[14px] border border-card bg-surface-raised px-3.5 py-3 text-fg no-underline hover:border-warning/50"
              >
                <span className="flex size-[34px] flex-none items-center justify-center rounded-[10px] bg-warning/14">
                  <TriangleAlert className="size-[17px] text-warning-fg" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="text-[15px] break-words">{item.name}</b>
                  <span className="text-[13px] leading-[1.45] text-fg-2">{item.text}</span>
                </span>
                <ChevronRight className="size-4 flex-none text-fg-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="relative m-0 text-[13px] leading-[1.45] text-fg-2">{t.none}</p>
      )}
      <p className="relative m-0 text-xs text-fg-4">{t.note}</p>
    </section>
  );
}
