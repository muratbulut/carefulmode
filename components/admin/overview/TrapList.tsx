import { Flame } from "lucide-react";
import type { TrapView } from "@/lib/admin/overview";
import { trapMinSample } from "@/lib/admin/overview-model";
import { format, getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";

/**
 * En çok tuzağa düşülen lablar (Özet ve Canlı nabız): hacklenerek bitenlerin payı, mahalle ve en
 * çok kaçırılan işaret. Yalnızca toplam; kimin düştüğü görünmez.
 */
export function TrapList({ traps, className }: { traps: TrapView[]; className?: string }) {
  const t = getMessages().adminOverview.traps;
  return (
    <section className={cn("flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-4 lg:p-5", className)} data-testid="trap-list">
      <span className="flex items-center gap-2">
        <Flame className="size-[18px] flex-none text-danger-fg" strokeWidth={2} aria-hidden="true" />
        <h2 className="m-0 text-base font-bold">{t.title}</h2>
      </span>
      <p className="m-0 text-xs leading-normal text-fg-4">{t.intro}</p>
      {traps.length === 0 ? (
        <p className="m-0 rounded-[14px] border border-dashed border-line px-3.5 py-4 text-center text-[13px] text-fg-3">
          {format(t.empty, { n: trapMinSample })}
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {traps.map((trap) => (
            <li key={trap.name} className="flex flex-col gap-1.5 border-t border-card py-2.5">
              <span className="flex items-baseline gap-2.5">
                <b className="min-w-0 flex-1 text-sm">{trap.name}</b>
                <b className="flex-none text-sm text-danger-fg" aria-label={format(t.fellLabel, { n: trap.rate })}>
                  {format(t.fell, { n: trap.rate })}
                </b>
              </span>
              <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-card">
                <span className="block h-full rounded-full bg-gradient-to-r from-danger/60 to-danger" style={{ width: `${trap.rate}%` }} />
              </span>
              <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-fg-3">
                <span className={cn("font-bold", toneOf(trap.neighborhood.color).text)}>{trap.neighborhood.name}</span>
                <span>{trap.finished}</span>
                {trap.missed ? <span>{rich(t.missed, { b: () => <b className="text-fg">{trap.missed}</b> })}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
