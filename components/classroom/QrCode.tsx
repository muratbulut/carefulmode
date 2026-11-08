"use client";

import { useMemo } from "react";
import { qrPath, type QrData } from "@/lib/classroom/teacher-rules";
import { cn } from "@/lib/utils";

/**
 * Katılma bağlantısının QR kodu. Modüller sunucuda hesaplanır (lib/classroom/teacher.ts), burada
 * tek bir SVG yoluyla çizilir. Okunabilsin diye iki temada da açık zemin, koyu modül (--qr-*).
 */
export function QrCode({ qr, label, className }: { qr: QrData; label: string; className?: string }) {
  const d = useMemo(() => qrPath(qr), [qr]);
  // Kenarda birer modül boşluk; kutunun dolgusuyla birlikte okuyucuya yeter.
  const box = `-1 -1 ${qr.size + 2} ${qr.size + 2}`;
  return (
    <span className={cn("flex flex-none rounded-2xl bg-qr-bg p-2", className)}>
      <svg viewBox={box} role="img" aria-label={label} shapeRendering="crispEdges" className="size-full text-qr-fg">
        <path d={d} fill="currentColor" />
      </svg>
    </span>
  );
}
