import { Castle, CreditCard, Download, HeartHandshake, LockKeyhole, Mail, type LucideIcon } from "lucide-react";
import type { NeighborhoodColor, NeighborhoodIconName } from "@/lib/content/landing";
import { cn } from "@/lib/utils";

const icons: Record<NeighborhoodIconName, LucideIcon> = {
  castle: Castle,
  lock: LockKeyhole,
  mail: Mail,
  download: Download,
  card: CreditCard,
  heart: HeartHandshake,
};

// Tailwind sınıfları tam yazılmalı (dinamik sınıf adı üretilmez).
export const neighborhoodColors: Record<NeighborhoodColor, { text: string; bg: string }> = {
  success: { text: "text-success-fg", bg: "bg-success/12" },
  accent: { text: "text-accent-fg", bg: "bg-accent/12" },
  purple: { text: "text-purple-fg", bg: "bg-purple/12" },
  warning: { text: "text-warning-fg", bg: "bg-warning/12" },
  pink: { text: "text-pink-fg", bg: "bg-pink/12" },
};

export function NeighborhoodIcon({ icon, color, className }: { icon: NeighborhoodIconName; color: NeighborhoodColor; className?: string }) {
  const Icon = icons[icon];
  const c = neighborhoodColors[color];
  return (
    <span className={cn("flex size-12 flex-none items-center justify-center rounded-[14px]", c.bg, className)}>
      <Icon className={cn("size-[22px]", c.text)} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}
