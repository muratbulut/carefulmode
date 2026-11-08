import { Check, Lightbulb, Minus, X, type LucideIcon } from "lucide-react";
import type { ReportRowView } from "@/lib/lab/report";
import type { RowState } from "@/lib/lab/scoring";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const stateStyle: Record<RowState, { Icon: LucideIcon; dot: string; icon: string; points: string; row: string }> = {
  ok: { Icon: Check, dot: "border-success", icon: "text-success-fg", points: "text-success-fg", row: "" },
  part: { Icon: Minus, dot: "border-warning", icon: "text-warning-fg", points: "text-warning-fg", row: "bg-warning/[0.07] shadow-[inset_4px_0_0_var(--warning)]" },
  bad: { Icon: X, dot: "border-danger", icon: "text-danger-fg", points: "text-danger-fg", row: "bg-danger/[0.07] shadow-[inset_4px_0_0_var(--danger)]" },
  skip: { Icon: Minus, dot: "border-line-strong", icon: "text-fg-4", points: "text-fg-4", row: "" },
};

const tagTone: Record<ReportRowView["kind"], string> = {
  fake: "text-danger-fg",
  real: "text-success-fg",
  question: "text-warning-fg",
  mission: "text-orange-fg",
};

/**
 * "Odada ne oldu" (14. revize, 3 Kasım): kararlar sırayla, okunan bir liste. Hiçbir şeye dokunmak
 * gerekmez; doğru olmayan kararın "Doğrusu" ve "Neden"i kendiliğinden açıktır.
 */
export function ReportSteps({ rows }: { rows: ReportRowView[] }) {
  const t = getMessages().lab.report;
  return (
    <ol aria-label={t.rowsLabel} className="flex flex-col overflow-hidden rounded-[20px] border border-card bg-surface-deep">
      {rows.map((row) => {
        const style = stateStyle[row.state];
        const open = row.state !== "ok" && (row.right || row.why);
        return (
          <li key={row.key} data-state={row.state} className={cn("flex flex-col gap-3 border-t border-card px-4 py-3.5 first:border-t-0 lg:px-5", style.row)}>
            <div className="flex items-start gap-3">
              <span className={cn("flex size-[30px] flex-none items-center justify-center rounded-full border-2", style.dot)}>
                <style.Icon className={cn("size-4", style.icon)} strokeWidth={2.6} aria-hidden="true" />
                <span className="sr-only">{t.rowStates[row.state]}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn("text-[11px] font-bold tracking-[0.6px]", tagTone[row.kind])}>{row.tag}</span>
                <b className="text-[15px] lg:text-base">{row.title}</b>
                <span className="text-sm leading-snug text-fg-3">{row.did}</span>
              </span>
              <span className={cn("flex-none pt-0.5 font-mono text-sm font-bold", style.points)}>{format(t.pointsOf, { points: row.points, max: row.max })}</span>
            </div>
            {open ? (
              <div className="grid gap-2.5 lg:ml-[42px] lg:grid-cols-2">
                {row.right ? (
                  <div className="flex flex-col gap-1 rounded-xl border border-success/30 bg-success/[0.06] px-3.5 py-3">
                    <span className="text-[11px] font-bold tracking-[0.8px] text-success-fg">{t.right}</span>
                    <span className="text-[15px] leading-normal">{row.right}</span>
                  </div>
                ) : null}
                {row.why ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-card bg-surface px-3.5 py-3">
                    <Lightbulb className="mt-0.5 size-[18px] flex-none text-warning-fg" strokeWidth={2} aria-hidden="true" />
                    <span className="flex flex-col gap-1">
                      <span className="text-[11px] font-bold tracking-[0.8px] text-warning-fg">{t.why}</span>
                      <span className="text-[15px] leading-normal text-fg-2">{row.why}</span>
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
