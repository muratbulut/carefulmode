"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ArticleView, type ArticleViewData } from "@/components/news/ArticleView";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Device = "desktop" | "phone";
const devices: Device[] = ["desktop", "phone"];

/**
 * Haberin önizlemesi (Gundem-Son-Onizleme): öğrencinin göreceği haber sayfasının kendisi
 * (components/news/ArticleView) tam ekranda. Üstte "Düzenlemeye dön", eksik varsa sarı satır,
 * Bilgisayarda / Telefonda seçimi ve "Planla". Telefonda sağdan kayan tam sayfa; cihaz seçimi ve
 * planlama düzenleyicide kalır. Önizlemedeki bağlantı ve düğmeler çalışmaz (inert).
 */
export function ArticlePreview({
  data,
  missing,
  planLabel,
  canPlan,
  onPlan,
  onClose,
}: {
  data: ArticleViewData;
  missing: string[];
  planLabel: string;
  canPlan: boolean;
  onPlan: () => void;
  onClose: () => void;
}) {
  const t = getMessages().news.admin.preview;
  const [device, setDevice] = useState<Device>("desktop");
  const back = useRef<HTMLButtonElement>(null);

  // Açılınca odak "Düzenlemeye dön"e gelir; arkadaki sayfa kaymaz.
  useEffect(() => {
    back.current?.focus();
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  const ready = missing.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.dialog}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className="fixed inset-0 z-50 flex flex-col bg-canvas [animation:slide-in-page_.3s_cubic-bezier(.2,.8,.2,1)_both] lg:[animation:fade-in_.2s_ease-out_both]"
    >
      <div className="flex flex-none flex-wrap items-center gap-2.5 border-b border-card bg-surface-deep px-3 py-3 lg:gap-3.5 lg:px-6 lg:py-3.5">
        <button
          ref={back}
          type="button"
          onClick={onClose}
          className="inline-flex h-10 flex-none cursor-pointer items-center gap-1 rounded-xl border border-line bg-surface pr-3 pl-1.5 text-sm font-bold text-fg"
        >
          <ArrowLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          {t.back}
        </button>
        <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
          <b className="text-xs tracking-[1.5px] text-fg-4 lg:hidden">{t.kicker}</b>
          <b className="hidden text-[15px] lg:block">{t.title}</b>
          <span role="status" className={cn("inline-flex items-start gap-1.5 text-[13px] leading-snug font-bold", ready ? "text-success-fg" : "text-warning-fg")}>
            <span aria-hidden="true" className={cn("mt-1.5 size-[7px] flex-none rounded-full", ready ? "bg-success" : "bg-warning")} />
            {ready ? t.ready : format(t.missing, { items: missing.join(", ") })}
          </span>
        </span>
        <div role="group" aria-label={t.device} className="hidden grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 lg:grid">
          {devices.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              className={cn(
                "h-9 cursor-pointer rounded-[9px] border-0 px-3 text-[13px] font-bold",
                device === d ? "bg-accent text-on-accent" : "bg-transparent text-fg-2 hover:text-fg",
              )}
            >
              {t.devices[d]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onPlan}
          disabled={!canPlan}
          className={cn(
            "hidden h-10 flex-none items-center rounded-xl border-0 px-4 text-sm font-bold lg:inline-flex",
            canPlan ? "cursor-pointer bg-success text-on-accent" : "bg-card text-fg-4",
          )}
        >
          {planLabel}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 lg:px-6 lg:pt-7 lg:pb-12">
        <p className="m-0 mb-2.5 font-mono text-xs font-bold tracking-[1.5px] text-fg-4 uppercase lg:hidden">{t.title}</p>
        <div
          className={cn(
            "mx-auto w-full overflow-hidden rounded-[20px] border border-line bg-canvas p-4",
            device === "desktop"
              ? "lg:max-w-[1000px] lg:rounded-none lg:border-0 lg:p-0"
              : "lg:w-[390px] lg:max-w-full lg:rounded-[32px] lg:border-[6px] lg:border-scene-phone-edge lg:p-4",
          )}
        >
          <div inert>
            <ArticleView article={data} member others={[]} />
          </div>
        </div>
      </div>
    </div>
  );
}
