"use client";

import { ArrowLeft, ClipboardList, X } from "lucide-react";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** SİMÜLASYON rozeti (kesik çizgili, nefes alan nokta). */
export function SimulationBadge({ short }: { short?: boolean }) {
  const t = getMessages().lab;
  return (
    <span className="inline-flex h-[26px] flex-none items-center gap-1.5 rounded-full border border-dashed border-warning px-2.5 text-[11px] font-bold tracking-[0.8px] text-warning-fg">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-warning [animation:breathe-dot_2s_ease-in-out_infinite]" />
      {short ? t.simulationShort : t.simulation}
    </span>
  );
}

/**
 * Lab çerçevesinin üst şeridi (Lab-Cerceve). Masaüstünde Çık, lab türü ve adı, SİMÜLASYON,
 * rapora yazılan karar sayısı ve görev ilerlemesi; telefonda kapat, ad ve SİM.
 */
export function LabBar({
  kicker,
  title,
  decisions,
  taskNo,
  total,
  done,
  onExit,
}: {
  kicker: string;
  title: string;
  decisions: number;
  taskNo: number;
  total: number;
  /** Görev parçaları: bitti, şu an, sırada. */
  done: boolean[];
  onExit: () => void;
}) {
  const t = getMessages().lab.frame;
  const current = done.indexOf(false);
  return (
    <>
      {/* Masaüstü */}
      <div className="hidden border-b border-card bg-surface-deep lg:block">
        <div className="mx-auto flex max-w-[1360px] items-center gap-5 px-6 py-2.5">
          <button type="button" onClick={onExit} className="inline-flex min-h-11 flex-none cursor-pointer items-center gap-1.5 text-sm font-bold text-accent-fg">
            <ArrowLeft className="size-4" strokeWidth={2.2} aria-hidden="true" />
            {t.exit}
          </button>
          <span aria-hidden="true" className="h-7 w-px bg-line" />
          <div className="flex min-w-0 flex-col gap-px">
            <span className="text-[11px] font-bold tracking-[0.8px] text-accent-fg">{kicker}</span>
            <h1 className="truncate font-bold">{title}</h1>
          </div>
          <SimulationBadge />
          <div className="flex flex-1 items-center justify-end gap-3.5">
            <span
              key={decisions}
              className="inline-flex h-[30px] items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] text-fg-2 [animation:bump_.5s_ease-out]"
            >
              <ClipboardList className="size-3.5 text-accent-fg" strokeWidth={2.2} aria-hidden="true" />
              {t.decisions}
              <b className="font-mono text-fg">{decisions}</b>
            </span>
            <span aria-hidden="true" className="h-7 w-px bg-line" />
            <span aria-hidden="true" className="grid w-[200px] gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))` }}>
              {done.map((d, i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition-colors duration-300", d ? "bg-accent" : i === current ? "bg-accent-light" : "bg-card")} />
              ))}
            </span>
            <span className="text-sm font-bold text-fg-3">{format(t.task, { n: taskNo, total })}</span>
          </div>
        </div>
      </div>

      {/* Telefon */}
      <div className="flex flex-none items-center gap-3 border-b border-card bg-canvas px-3 py-2.5 lg:hidden">
        <button
          type="button"
          onClick={onExit}
          aria-label={t.exitLabel}
          className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-surface text-fg-2"
        >
          <X className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-bold">{title}</h1>
        <SimulationBadge short />
      </div>
    </>
  );
}
