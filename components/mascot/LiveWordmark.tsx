"use client";

import { useRef } from "react";
import { Wordmark } from "@/lib/brand";
import { useEyeTracking } from "./useEyeTracking";
import "./mascot.css";

/**
 * Üst menüdeki isim hâli: O harfindeki maskotun gözü fareyi izler, arada kırpar. Tıklanınca ana
 * sayfa açılır, tepki vermez (tepkiler ana sayfadaki büyük maskotta). Şifre yazılırken ve ana sayfada
 * uyurken html'deki işaretlerle (data-mascot-eyes, data-mascot) o da gözünü kapatır.
 */
export function LiveWordmark({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEyeTracking(ref);
  return <Wordmark live ref={ref} className={className} />;
}
