import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Yuvarlak ilerleme halkası; ortasına metin konur (mahalle kartı "3/7", önceki deneme puanı). */
export function ProgressRing({
  value,
  size = 60,
  stroke = 6,
  strokeClass,
  trackClass = "stroke-card",
  className,
  children,
}: {
  /** 0-1 */
  value: number;
  size?: number;
  stroke?: number;
  strokeClass: string;
  trackClass?: string;
  className?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <span className={cn("relative flex flex-none items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} />
        {clamped > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={length}
            strokeDashoffset={length * (1 - clamped)}
            className={cn("transition-[stroke-dashoffset] duration-700", strokeClass)}
          />
        ) : null}
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

/** Yatay ilerleme çubuğu. */
export function ProgressBar({ value, fillClass, className, trackClass = "bg-card" }: { value: number; fillClass: string; className?: string; trackClass?: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className={cn("block h-2 overflow-hidden rounded-full", trackClass, className)}>
      {percent > 0 ? <span className={cn("block h-full rounded-full anim-bar-in", fillClass)} style={{ width: `${percent}%` }} /> : null}
    </span>
  );
}
