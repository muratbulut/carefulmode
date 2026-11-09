"use client";

// Öğretmenlik bölümünün ortak parçaları: renkli durum kutusu, bilgi kutusu, gönderilen bilgilerin
// özeti, düğmeler ve talebi geri çekme penceresi (tahta: Ogretmenlik-Son).

import type { LucideIcon } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Notice } from "@/components/auth/fields";
import { Spinner } from "@/components/status/Spinner";
import { getMessages } from "@/lib/i18n";
import { withdrawApplication } from "@/lib/teacher/application-actions";
import { cn } from "@/lib/utils";
import { Dialog } from "../Dialog";

export const secondaryButton =
  "inline-flex h-11 flex-none cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface-raised px-4 text-sm font-bold text-fg no-underline transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButton =
  "inline-flex h-[46px] flex-none cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-[15px] font-bold no-underline transition-[background-color,color,filter] disabled:cursor-wait";

/** Ana düğme. Form eksikken soluk görünür ama basılabilir: basınca neyin eksik olduğu yazar (tahta böyle). */
export function PrimaryButton({ ready, pending, children }: { ready: boolean; pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(primaryButton, ready ? "bg-accent text-on-accent hover:brightness-110" : "bg-card text-fg-4")}
    >
      {pending ? (
        <>
          <Spinner tone={ready ? "onAccent" : "plain"} />
          {getMessages().auth.working}
        </>
      ) : (
        children
      )}
    </button>
  );
}

const panelTones = {
  accent: "border-accent/35 bg-accent/5",
  warning: "border-warning/35 bg-warning/6",
  success: "border-success/40 bg-success/7",
  danger: "border-danger-fg/40 bg-danger-fg/6",
} as const;

/** Durumun renkli kutusu (inceleniyor, bilgi istendi, onaylandı, onaylanmadı). */
export function Panel({ tone, children, className }: { tone: keyof typeof panelTones; children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-3.5 rounded-[14px] border p-4 anim-slide-in", panelTones[tone], className)}>{children}</div>;
}

export function PanelTitle({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-base font-bold">{title}</h3>
      {subtitle ? <p className="text-[13px] text-fg-3">{subtitle}</p> : null}
    </div>
  );
}

const infoTones = { accent: "text-accent-light", warning: "text-warning", danger: "text-danger-fg" } as const;

/** Simgeli küçük bilgi kutusu (gizlilik notu, yöneticinin sorusu ya da notu). */
export function InfoBox({
  Icon,
  tone = "accent",
  deep = false,
  className,
  children,
}: {
  Icon: LucideIcon;
  tone?: keyof typeof infoTones;
  deep?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-xl border border-card px-3.5 py-3 text-[13px] leading-normal text-fg-3",
        deep ? "bg-surface-deep" : "bg-surface-raised",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 flex-none", infoTones[tone])} strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

/** Gönderilen bilgilerin özeti: solda başlık, sağda değer. */
export function SummaryList({ rows }: { rows: [label: string, value: string][] }) {
  return (
    <dl className="flex flex-col gap-1.5 rounded-xl bg-surface-deep px-3.5 py-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 text-[13px]">
          <dt className="flex-none text-fg-3">{label}</dt>
          <dd className="min-w-0 text-right font-bold break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** "Talebi geri çek" düğmesi ve onay penceresi. Talep ve belgesi silinir. */
export function WithdrawButton({ onDone }: { onDone: (message: string) => void }) {
  const t = getMessages().teaching.withdraw;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const titleId = useId();

  const confirm = () =>
    startTransition(async () => {
      const result = await withdrawApplication();
      if (result.status === "ok") {
        setOpen(false);
        if (result.message) onDone(result.message);
      } else {
        setError(result.message ?? getMessages().auth.errors.generic);
      }
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={secondaryButton}
      >
        {t.button}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} labelledBy={titleId}>
        <h2 id={titleId} className="font-heading text-[22px] leading-tight font-bold">
          {t.title}
        </h2>
        <p className="text-[15px] leading-normal text-fg-3">{t.text}</p>
        {error ? (
          <Notice tone="bad" live="assertive">
            {error}
          </Notice>
        ) : null}
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-12 flex-1 cursor-pointer rounded-xl border border-line bg-card font-bold text-fg">
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            aria-busy={pending}
            className="h-12 flex-[2] cursor-pointer rounded-xl bg-danger font-bold text-on-danger transition-opacity disabled:cursor-wait disabled:opacity-60"
          >
            {t.confirm}
          </button>
        </div>
      </Dialog>
    </>
  );
}
