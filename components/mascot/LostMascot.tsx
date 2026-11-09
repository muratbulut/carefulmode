"use client";

import { useRef, useState } from "react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Mascot } from "./Mascot";

/** "Açılmaya çalışır" tepkisinin süresi (mascot.css, mc-try). */
const TRY_MS = 1200;

/**
 * 404'teki sıfır: kapalı düğme. Gözü etrafa bakıp kaybolan sayfayı arar; dokununca açılmaya
 * çalışır ama açılamaz.
 */
export function LostMascot({ className }: { className?: string }) {
  const t = getMessages().mascot;
  const [trying, setTrying] = useState(false);
  const timer = useRef<number | null>(null);

  function poke() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setTrying(false);
    window.requestAnimationFrame(() => setTrying(true));
    timer.current = window.setTimeout(() => setTrying(false), TRY_MS + 50);
  }

  return (
    <button type="button" onClick={poke} aria-label={t.pet} className={cn("mc-button cursor-pointer rounded-full leading-none", className)}>
      <Mascot mood="off" reaction={trying ? "try" : null} className="block h-auto w-full" />
    </button>
  );
}
