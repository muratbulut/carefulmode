import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import type { PulseData } from "@/lib/admin/pulse";
import { liveWindowMinutes } from "@/lib/admin/pulse-model";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PrivacyNote } from "../overview/PrivacyNote";
import { TrapList } from "../overview/TrapList";
import { PulseFeed } from "./PulseFeed";
import { LiveControls, PulseRefresher } from "./PulseRefresher";

/**
 * Canlı nabız (CanliNabiz-Son): solda şu an labda olanlar, mahalle dağılımı ve son bir saat;
 * sağda isimsiz akış. Toplantıda ekrana yansıtmak için büyük sayılar; 15 saniyede bir yenilenir.
 * En çok tuzağa düşülen lablar masaüstünde solda, telefonda yok (tahtadaki gibi).
 */
export function PulseView({ data }: { data: PulseData }) {
  const t = getMessages().adminPulse;
  const nf = (n: number) => n.toLocaleString("tr-TR");
  const spark = Math.max(1, ...data.hour.buckets);
  const widest = Math.max(1, data.live, ...data.neighborhoods.map((n) => n.count));

  return (
    <PulseRefresher>
      <main className="flex flex-col gap-3.5 px-4 pt-4 pb-10 lg:gap-[22px] lg:px-9 lg:pt-8 lg:pb-[72px]">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-heading text-[26px] leading-[1.1] font-bold lg:text-[34px]">{t.title}</h1>
          <p className="m-0 max-w-[640px] text-sm leading-[1.55] text-fg-3 lg:text-[15px]">{t.intro}</p>
        </div>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2 lg:gap-[22px]">
          <div className="flex min-w-0 flex-col gap-3.5 lg:gap-[18px]">
            <section
              aria-label={t.live}
              className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface bg-[radial-gradient(120%_120%_at_0%_0%,color-mix(in_oklab,var(--color-success)_12%,transparent),transparent_55%)] p-[18px] lg:p-[26px]"
            >
              <LiveControls />
              <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <b className="font-heading text-[64px] leading-[0.9] tabular-nums lg:text-[88px]" data-testid="pulse-live">
                  {nf(data.live)}
                </b>
                <span className="text-base text-fg-2 lg:text-[19px]">{t.liveCount}</span>
              </p>
              <span className="-mt-2 text-xs text-fg-4">{format(t.liveHint, { n: liveWindowMinutes })}</span>
              <ul aria-label={t.byNeighborhood} className="m-0 flex list-none flex-col gap-2 p-0">
                {data.neighborhoods.map((n) => {
                  const tone = toneOf(n.color);
                  return (
                    <li key={n.name} className="flex items-center gap-2.5 text-[13px]">
                      <span className="sr-only">{format(t.neighborhoodCount, { name: n.name, n: n.count })}</span>
                      <span aria-hidden="true" className={cn("w-[120px] flex-none truncate font-bold lg:w-[150px]", tone.text)}>
                        {n.name}
                      </span>
                      <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-card">
                        <span
                          className={cn("block h-full rounded-full transition-[width] duration-500", tone.fill)}
                          style={{ width: `${Math.round((n.count / widest) * 100)}%` }}
                        />
                      </span>
                      <b aria-hidden="true" className="w-7 flex-none text-right tabular-nums">
                        {nf(n.count)}
                      </b>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-end gap-3.5 border-t border-card pt-3">
                <span className="flex flex-none flex-col gap-0.5">
                  <span className="text-xs font-bold tracking-[0.8px] text-fg-4">{t.lastHour}</span>
                  <span className="flex items-baseline gap-1.5">
                    <b className="font-heading text-[26px] tabular-nums" data-testid="pulse-hour">
                      {nf(data.hour.finished)}
                    </b>
                    <span className="text-[13px] text-fg-3">{t.finishedInHour}</span>
                  </span>
                </span>
                <div role="img" aria-label={format(t.spark, { values: data.hour.buckets.join(", ") })} className="flex h-12 flex-1 items-end gap-[3px]">
                  {data.hour.buckets.map((value, i) => (
                    <span
                      key={i}
                      className={cn("block flex-1 rounded-[3px]", i === data.hour.buckets.length - 1 ? "bg-accent" : "bg-accent/35")}
                      style={{ height: `${Math.max(6, Math.round((value / spark) * 100))}%` }}
                    />
                  ))}
                </div>
              </div>
            </section>
            <TrapList traps={data.traps} className="hidden lg:flex" />
          </div>
          <PulseFeed items={data.feed} />
        </div>
        <PrivacyNote />
      </main>
    </PulseRefresher>
  );
}
