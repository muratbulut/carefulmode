import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Eğitim kartlarının ortak parçaları: etiket, başlık, kilit notu ve satır renkleri (Tur 7).

export function CardTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center self-start rounded-full border border-accent/35 bg-accent/10 px-3 text-xs font-bold tracking-[0.8px] text-accent-fg">
      {children}
    </span>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h1 className="font-heading text-[26px] leading-tight font-bold tracking-[-0.4px] lg:text-[32px]">{children}</h1>;
}

/** "Devam için ... aç" notu: kart bitmeden Devam kilitliyken altta durur. */
export function LockHint({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-2 text-center text-sm text-fg-3">
      <Lock className="size-[15px] flex-none" strokeWidth={2.2} aria-hidden="true" />
      {children}
    </p>
  );
}

/**
 * Satır ve madde renkleri (temadaki renkler). text: yazı ve ikon, soft: ikon zemini, edge: açık
 * satırın kenarı, wash: açık satırın zemini, solid: dolu nokta ve rozet, ring: seçili kenar.
 */
export type Tone = { text: string; soft: string; edge: string; wash: string; solid: string; ring: string; pulse: string };

export const tones = {
  purple: {
    text: "text-purple-fg",
    soft: "bg-purple/14",
    edge: "border-purple/55",
    wash: "bg-purple/7",
    solid: "bg-purple",
    ring: "border-purple",
    pulse: "[--pulse:var(--purple)]",
  },
  accent: {
    text: "text-accent-fg",
    soft: "bg-accent/12",
    edge: "border-accent/55",
    wash: "bg-accent/7",
    solid: "bg-accent",
    ring: "border-accent",
    pulse: "[--pulse:var(--accent)]",
  },
  warning: {
    text: "text-warning-fg",
    soft: "bg-warning/13",
    edge: "border-warning/55",
    wash: "bg-warning/7",
    solid: "bg-warning",
    ring: "border-warning",
    pulse: "[--pulse:var(--warning)]",
  },
  pink: {
    text: "text-pink-fg",
    soft: "bg-pink/13",
    edge: "border-pink/55",
    wash: "bg-pink/7",
    solid: "bg-pink",
    ring: "border-pink",
    pulse: "[--pulse:var(--pink)]",
  },
  danger: {
    text: "text-danger-fg",
    soft: "bg-danger/14",
    edge: "border-danger/55",
    wash: "bg-danger/7",
    solid: "bg-danger",
    ring: "border-danger",
    pulse: "[--pulse:var(--danger)]",
  },
  success: {
    text: "text-success-fg",
    soft: "bg-success/13",
    edge: "border-success/55",
    wash: "bg-success/7",
    solid: "bg-success",
    ring: "border-success",
    pulse: "[--pulse:var(--success)]",
  },
} satisfies Record<string, Tone>;

/** Eşleştirme satırları ve keşfet alanları sırayla bu renkleri alır. */
export const rowTones: Tone[] = [tones.purple, tones.accent, tones.warning, tones.pink];

export const toneAt = (list: Tone[], i: number) => list[i % list.length];

/** Rozet içindeki küçük onay ya da çarpı. */
export function Mark({ tone, children, className }: { tone: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn("flex size-6 flex-none items-center justify-center rounded-full text-on-accent [animation:pop_.25s_ease-out_both]", tone, className)}>
      {children}
    </span>
  );
}
