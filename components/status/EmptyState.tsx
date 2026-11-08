import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconBox, type Tone } from "./StatusCard";

/** Boş sayfa yerine ne olduğunu ve sıradaki adımı söyleyen kutu. */
export function EmptyState({
  Icon,
  tone = "accent",
  title,
  children,
  action,
  className,
}: {
  Icon: LucideIcon;
  tone?: Tone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-3.5 py-[18px] text-center", className)}>
      <IconBox Icon={Icon} tone={tone} className="size-12 rounded-2xl" />
      <b className="text-[15px]">{title}</b>
      {children ? <span className="text-[13px] leading-[1.45] text-fg-3">{children}</span> : null}
      {action}
    </div>
  );
}
