import { Lock } from "lucide-react";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Toplu ekranların altındaki not (Özet, Canlı nabız): her şey toplam sayıdır. */
export function PrivacyNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "m-0 flex items-start gap-2.5 rounded-[14px] border border-card bg-surface-deep px-4 py-3.5 text-xs leading-[1.55] text-fg-4",
        className,
      )}
    >
      <Lock className="mt-px size-4 flex-none" strokeWidth={2} aria-hidden="true" />
      <span>{getMessages().adminOverview.privacy}</span>
    </p>
  );
}
