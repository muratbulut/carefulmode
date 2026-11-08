"use client";

import { Pause, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useState, useTransition, type ReactNode } from "react";
import { refreshSeconds } from "@/lib/admin/pulse-model";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Canlı nabız her 15 saniyede sunucudan yeniden çizilir (router.refresh: sayfa yerinde kalır,
// yalnızca veriler değişir). "Duraklat" yenilemeyi durdurur; sekme arka plandayken de yenilenmez.

type Live = { paused: boolean; toggle: () => void };

const LiveContext = createContext<Live | null>(null);

function useLive(): Live {
  const value = use(LiveContext);
  if (!value) throw new Error("PulseRefresher missing");
  return value;
}

export function PulseRefresher({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    }, refreshSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [paused, router]);

  return <LiveContext value={{ paused, toggle: () => setPaused((p) => !p) }}>{children}</LiveContext>;
}

/** "CANLI · ŞU AN" işareti ve Duraklat / Devam et düğmesi. Hareketi azalt açıksa nokta atmaz. */
export function LiveControls() {
  const t = getMessages().adminPulse;
  const { paused, toggle } = useLive();
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true" className="relative flex size-3 flex-none">
        {paused ? null : <span className="absolute inset-0 rounded-full bg-success opacity-60 motion-safe:animate-ping" />}
        <span className={cn("relative size-3 rounded-full", paused ? "bg-fg-4" : "bg-success")} />
      </span>
      <span className={cn("text-xs font-bold tracking-[1px]", paused ? "text-fg-4" : "text-success-fg")} data-testid="pulse-state">
        {paused ? t.paused : t.live}
      </span>
      <span className="flex-1" />
      <button
        type="button"
        onClick={toggle}
        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-bold text-fg hover:border-line-strong"
      >
        {paused ? (
          <Play className="size-4" strokeWidth={2.2} aria-hidden="true" />
        ) : (
          <Pause className="size-4" strokeWidth={2.2} aria-hidden="true" />
        )}
        {paused ? t.resume : t.pause}
      </button>
    </span>
  );
}
