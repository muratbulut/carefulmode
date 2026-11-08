"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RetryButton } from "./RetryButton";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

async function canReachServer() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

/** Bağlantı koptu uyarısının görünümü (önizleme sayfası da kullanır). */
export function ConnectionAlert({ className, onRetry = canReachServer }: { className?: string; onRetry?: () => Promise<boolean> }) {
  const t = getMessages();
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-[14px] border border-warning/35 bg-[color-mix(in_oklab,var(--warning)_8%,var(--canvas))] px-3.5 py-3",
        className,
      )}
    >
      <WifiOff className="size-5 flex-none text-warning" strokeWidth={2} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <b className="text-sm">{t.status.offlineTitle}</b>
        <span className="text-[13px] leading-[1.45] text-fg-2">{t.status.offlineText}</span>
      </span>
      <RetryButton onRetry={onRetry} />
    </div>
  );
}

/**
 * Bağlantı koptuğunda sayfanın üstünde ince şerit. Sayfa kapanmaz, ilerleme kaybolmaz;
 * bağlantı gelince şerit kendiliğinden gider.
 */
export function ConnectionBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (online) return null;
  return <ConnectionAlert className="fixed inset-x-3 top-3 z-50 mx-auto max-w-[680px] shadow-toast" />;
}
