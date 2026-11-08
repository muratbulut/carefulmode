import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** İkon kutusunun renk tonları; zemin ikon renginin saydam hâlidir. */
const tones = {
  accent: "text-accent-fg bg-accent/12",
  warning: "text-warning bg-warning/12",
  danger: "text-danger bg-danger/12",
  purple: "text-purple bg-purple/12",
  success: "text-success-fg bg-success/12",
} as const;

export type Tone = keyof typeof tones;

export function IconBox({ Icon, tone, className }: { Icon: LucideIcon; tone: Tone; className?: string }) {
  return (
    <span className={cn("flex size-11 flex-none items-center justify-center rounded-[14px]", tones[tone], className)}>
      <Icon className="size-[22px]" strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

/**
 * Durum ekranlarının ortak kalıbı (Tur 5, Durumlar-Son): sakin, suçlamayan,
 * sıradaki adımı söyleyen kısa bir kart.
 */
export function StatusCard({
  Icon,
  tone,
  title,
  children,
  action,
  className,
  role,
}: {
  Icon: LucideIcon;
  tone: Tone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className={cn("flex flex-col gap-3 rounded-[20px] border border-card bg-surface-deep p-5", className)}
    >
      <div className="flex items-start gap-3">
        <IconBox Icon={Icon} tone={tone} />
        <span className="flex flex-col gap-1">
          <b className="text-[15px]">{title}</b>
          {children ? <span className="text-[13px] leading-[1.45] text-fg-2">{children}</span> : null}
        </span>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2.5">{action}</div> : null}
    </div>
  );
}
