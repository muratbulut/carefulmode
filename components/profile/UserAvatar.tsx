import { cn } from "@/lib/utils";

/** Yuvarlak avatar (şimdilik emoji). Süs olarak çizilir; adı yanında yazılı olur. */
export function UserAvatar({ emoji, ring = false, className }: { emoji: string; ring?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex flex-none items-center justify-center rounded-full bg-surface-deep leading-none select-none",
        ring ? "border-[3px] border-accent shadow-[0_0_0_4px_rgb(34_211_238/0.12)]" : "border border-line",
        className,
      )}
    >
      {emoji}
    </span>
  );
}
