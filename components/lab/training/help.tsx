"use client";

import { ArrowRight, Check, CircleHelp, Hand, Tag, X } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** "Nasıl oynanır" penceresi olan kart türleri (sürükle bırakla oynananlar). */
export type HelpKind = "sort" | "match" | "fill";

// Pencere her kart türünde öğrencinin karşısına bir kez çıkar (bu tarayıcıda); sonra başlıktaki
// düğmeyle yeniden açılır. Yalnızca "gösterildi" bilgisi tutulur.
const helpKey = (kind: HelpKind) => `lab-help-${kind}`;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function seen(kind: HelpKind) {
  try {
    return window.localStorage.getItem(helpKey(kind)) === "1";
  } catch {
    return false;
  }
}

function markSeen(kind: HelpKind) {
  try {
    window.localStorage.setItem(helpKey(kind), "1");
  } catch {
    // Depolama kapalıysa pencere bu kartta kapalı kalır (bileşenin kendi durumu).
  }
  listeners.forEach((listener) => listener());
}

/** Pencerenin açık olup olmadığı: ilk girişte kendiliğinden (kontrol edilmiş kartta değil), sonra düğmeyle. */
export function useHelp(kind: HelpKind, done: boolean) {
  const shown = useSyncExternalStore(subscribe, () => seen(kind), () => true);
  const [dismissed, setDismissed] = useState(false);
  const [asked, setAsked] = useState(false);
  return {
    open: asked || (!shown && !dismissed && !done),
    show: () => setAsked(true),
    close: () => {
      markSeen(kind);
      setDismissed(true);
      setAsked(false);
    },
  };
}

/** Kartın başlığındaki "Nasıl oynanır?" düğmesi. */
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-bold text-accent-fg">
      <CircleHelp className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
      {getMessages().lab.training.help.open}
    </button>
  );
}

const primary =
  "flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-[17px] font-bold text-on-accent transition-[filter,opacity] hover:brightness-110";

/**
 * "Nasıl oynanır" penceresi (Tur 6): küçük sahnede el bir öğeyi yerine taşır, altında adımlar.
 * Telefonda alttan açılır, masaüstünde ortada. Sayfanın gövdesine açılır: kartın giriş animasyonu
 * (transform) sabit konumlu öğeleri kartın içine hapsederdi.
 */
export function HelpDialog({ kind, demo, onClose }: { kind: HelpKind; demo: ReactNode; onClose: () => void }) {
  const all = getMessages().lab.training.help;
  const h = all[kind];
  const titleId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const close = useEffectEvent(onClose);

  useEffect(() => {
    button.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim [animation:fade-in_.2s_ease-out_both] lg:items-center lg:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-card [animation:slide-up_.3s_cubic-bezier(.2,.8,.2,1)_both] lg:max-w-[480px] lg:rounded-3xl lg:p-7 lg:[animation:pop_.25s_ease-out_both]"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold tracking-[0.8px] text-accent-fg">{all.kicker}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={all.close}
            className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-deep text-fg-2"
          >
            <X className="size-5" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        <h2 id={titleId} className="-mt-1 font-heading text-2xl leading-tight font-bold">
          {h.title}
        </h2>
        <div aria-hidden="true" className="rounded-2xl border border-card bg-surface-deep py-2">
          {demo}
        </div>
        <ol className="flex flex-col gap-2.5">
          {h.steps.map((step, i) => (
            <li key={step} className="flex items-start gap-2.5 text-[15px] leading-snug text-fg-2">
              <span className="flex size-6 flex-none items-center justify-center rounded-full bg-card font-mono text-xs font-bold text-fg">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <button ref={button} type="button" onClick={onClose} className={primary}>
          {all.start}
          <ArrowRight className="size-5" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Pencerenin sahnesi (300x196): üstte ortada bir öğe, el onu tutup `to` noktasına (sahnedeki yerin
 * ortası) taşır, yerin köşesinde onay belirir. Sahnenin geri kalanı (yer `drag-demo-target` sınıfıyla)
 * `children`. Öğe genel bir örnektir, kartın cevabını ele vermez. Hareketi azalt açıksa animasyon
 * durur, öğe yerinde görünür (temel stil son hal, `globals.css`).
 */
export function DemoStage({ label, to, ok, children }: { label: string; to: { x: number; y: number }; ok: { left: number; top: number }; children: ReactNode }) {
  // Öğe 104x36, sol üstü (98, 14): ortası (150, 32).
  const stage = { "--demo-dx": `${Math.round(to.x - 150)}px`, "--demo-dy": `${Math.round(to.y - 32)}px` } as CSSProperties;
  return (
    <div className="relative mx-auto h-[196px] w-[300px]" style={stage}>
      {children}
      <span className="drag-demo-ok absolute flex size-[22px] items-center justify-center rounded-full bg-success text-on-accent" style={ok}>
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      <div className="drag-demo-chip absolute top-[14px] left-[98px] flex h-9 w-[104px] items-center gap-1.5 rounded-[10px] border-2 border-accent bg-card px-2 text-xs font-bold shadow-floating">
        <Tag className="size-3.5 flex-none text-accent-fg" strokeWidth={2.2} />
        <span className="truncate">{label}</span>
      </div>
      <Hand className="drag-demo-hand absolute top-[30px] left-[168px] size-[30px] text-fg" strokeWidth={1.8} />
    </div>
  );
}

const bar = "absolute h-2.5 rounded-full bg-line-strong";

/** Eşleştirmenin sahnesi: bir satır (numara ve soldaki metin) ve sağında boş yer. */
export function MatchDemo() {
  const h = getMessages().lab.training.help.match;
  return (
    <DemoStage label={h.demoItem} to={{ x: 220, y: 144 }} ok={{ left: 270, top: 114 }}>
      <div className="absolute top-[106px] left-[6px] h-[76px] w-[288px] rounded-xl border border-card bg-surface" />
      <span className="absolute top-[132px] left-[18px] size-6 rounded-full bg-card" />
      <span className={cn(bar, "top-[130px] left-[52px] w-[84px]")} />
      <span className={cn(bar, "top-[148px] left-[52px] w-14 opacity-60")} />
      <span className="drag-demo-target absolute top-[124px] left-[156px] h-10 w-32 rounded-[10px] border-2 border-dashed border-line-strong text-accent-fg" />
    </DemoStage>
  );
}

/** Boşluk doldurmanın sahnesi: iki satırlık bir cümle ve ortasında boşluk. */
export function FillDemo() {
  const h = getMessages().lab.training.help.fill;
  return (
    <DemoStage label={h.demoItem} to={{ x: 150, y: 128 }} ok={{ left: 192, top: 102 }}>
      <div className="absolute top-[98px] left-[6px] h-[90px] w-[288px] rounded-xl border border-card bg-surface" />
      <span className={cn(bar, "top-[123px] left-[20px] w-[66px]")} />
      <span className="drag-demo-target absolute top-[112px] left-[96px] h-8 w-[108px] rounded-lg border-2 border-dashed border-line-strong text-accent-fg" />
      <span className={cn(bar, "top-[123px] left-[214px] w-[66px]")} />
      <span className={cn(bar, "top-[160px] left-[20px] w-[180px]")} />
    </DemoStage>
  );
}
