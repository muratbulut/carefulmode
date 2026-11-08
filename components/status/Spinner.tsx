import { cn } from "@/lib/utils";

/** Küçük dönen halka; "Deniyor…" ve "yükleniyor" satırlarında. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-3.5 rounded-full border-2 border-line border-t-accent anim-spinner", className)}
    />
  );
}
