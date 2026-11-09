"use client";

import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

function SkeletonCard() {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5">
      <span className="skeleton block h-20 w-full rounded-xl" />
      <span className="skeleton block h-3.5 w-[70%] rounded-lg" />
      <span className="skeleton block h-3 w-[45%] rounded-lg" />
    </div>
  );
}

/**
 * Yükleniyor durumu: içeriğin yerini tutan gri bloklar (dönen çark yerine).
 * 10 saniye sürerse "Hâlâ yükleniyor" satırı çıkar.
 */
export function Loading({ text, cardCount = 3, className }: { text?: string; cardCount?: number; className?: string }) {
  const t = getMessages();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col gap-3 rounded-[20px] border border-card bg-surface-deep p-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row">
        {Array.from({ length: cardCount }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <span className="flex items-center gap-2 text-[13px] text-fg-3">
        <Spinner />
        {slow ? t.status.stillLoading : (text ?? t.status.loading)}
      </span>
    </div>
  );
}
