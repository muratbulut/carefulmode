import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  accent: "bg-accent/12 text-accent-fg",
  violet: "bg-purple/14 text-purple-fg",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning-fg",
  danger: "bg-danger/12 text-danger-fg",
} as const;

/** Profil bölümünün kartı: ikon, başlık, kısa açıklama ve içerik (tahta: Profil-P2-Son). */
export function SectionCard({
  Icon,
  tone = "accent",
  title,
  lead,
  danger = false,
  children,
}: {
  Icon: LucideIcon;
  tone?: keyof typeof tones;
  title: string;
  lead?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-4 rounded-[20px] border bg-surface p-4 sm:p-6 anim-slide-in",
        danger ? "border-danger/35" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 flex-none items-center justify-center rounded-[10px]", tones[tone])}>
          <Icon className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-[21px] leading-tight font-bold">{title}</h2>
          {lead ? <p className="text-sm leading-normal text-fg-3">{lead}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
