import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  accent: "bg-accent/12 text-accent-fg",
  purple: "bg-purple/12 text-purple-fg",
  success: "bg-success/12 text-success-fg",
} as const;

/**
 * Özet kutusu (Sınıflarım: sınıf, öğrenci, bu hafta biten lab; sınıf detayı: öğrenci, ödev,
 * bu hafta). `compact`: telefonda üç kutu yan yana, ikon gizli.
 */
export function SummaryBox({
  Icon,
  tone,
  value,
  label,
  compact = false,
}: {
  Icon: LucideIcon;
  tone: keyof typeof tones;
  value: ReactNode;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-[18px] border border-line bg-surface lg:p-[18px]", compact ? "p-3" : "p-3.5")}>
      <span className={cn("size-[38px] flex-none items-center justify-center rounded-xl lg:flex lg:size-11", compact ? "hidden" : "flex", tones[tone])}>
        <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={cn("font-heading leading-[1.1] font-bold lg:text-[28px]", compact ? "text-xl" : "text-[22px]")}>{value}</span>
        <span className="text-xs text-fg-3">{label}</span>
      </span>
    </div>
  );
}
