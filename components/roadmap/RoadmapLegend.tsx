import { Check, Lock } from "lucide-react";
import { getMessages } from "@/lib/i18n";
import type { LabState } from "@/lib/lab/route";
import { cn } from "@/lib/utils";

const order: LabState[] = ["done", "next", "open", "locked"];

/** Lab durumlarının küçük işaretleri: Bitti, Sıradaki, Açık, Kilitli (Sehir-H4-Yakinlas). */
export function StateMark({ state, className }: { state: LabState; className?: string }) {
  const base = "flex size-5 flex-none items-center justify-center rounded-full";
  switch (state) {
    case "done":
      return (
        <span className={cn(base, "bg-success/16", className)}>
          <Check className="size-3 text-success-fg" strokeWidth={3} aria-hidden="true" />
        </span>
      );
    case "next":
      return (
        <span className={cn(base, "border-2 border-accent", className)}>
          <span className="size-[7px] rounded-full bg-accent anim-breathe-fast" />
        </span>
      );
    case "open":
      return <span className={cn(base, "border-2 border-accent opacity-70", className)} />;
    case "locked":
      return (
        <span className={cn(base, "border border-line", className)}>
          <Lock className="size-2.5 text-fg-4" strokeWidth={2.4} aria-hidden="true" />
        </span>
      );
  }
}

export function RoadmapLegend({ className }: { className?: string }) {
  const t = getMessages().roadmap;
  return (
    <ul aria-label={t.legend} className={cn("m-0 flex list-none flex-wrap gap-x-[18px] gap-y-2 p-0 text-[13px] text-fg-3", className)}>
      {order.map((state) => (
        <li key={state} className="inline-flex items-center gap-2">
          <StateMark state={state} />
          {t.states[state]}
        </li>
      ))}
    </ul>
  );
}
