import { cn } from "@/lib/utils";

/**
 * Aç-kapa düğmesinin görünen kısmı (48×28 ray ve top). Düğmenin kendisi değildir:
 * role="switch" ve aria-checked taşıyan <button> içine konur.
 */
export function SwitchTrack({ on, className }: { on: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative h-7 w-12 flex-none rounded-full transition-colors duration-200", on ? "bg-accent" : "bg-line", className)}
    >
      <span
        className={cn(
          "absolute top-[3px] left-[3px] size-[22px] rounded-full bg-knob shadow-[0_1px_3px_var(--shadow-color-soft)] transition-transform duration-200",
          on && "translate-x-5",
        )}
      />
    </span>
  );
}
