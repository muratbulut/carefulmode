import type { OverviewData } from "@/lib/admin/overview";
import { format, getMessages } from "@/lib/i18n";
import { Numbers } from "./Numbers";
import { PendingCards, PendingHeadline, PendingProvider } from "./PendingWork";
import { PrivacyNote } from "./PrivacyNote";
import { RecentAudit } from "./RecentAudit";
import { StudentView } from "./StudentView";
import { TrapList } from "./TrapList";
import { WeeklyChart } from "./WeeklyChart";

/**
 * Yönetim özeti (Ozet-Son, Ozet-Son-Bitti). Masaüstünde iki sütun: solda bekleyen işler, sayılar,
 * grafik ve en çok tuzağa düşülen lablar; sağda öğrencinin bu hafta gördükleri, son kayıtlar ve
 * gizlilik notu. Telefonda hepsi alt alta. Her şey toplam sayıdır.
 */
export function OverviewView({ data }: { data: OverviewData }) {
  const t = getMessages().adminOverview;
  return (
    <PendingProvider cards={data.cards} storageKey={data.snoozeKey}>
      <main className="flex flex-col gap-3.5 px-4 pt-4 pb-10 lg:gap-[22px] lg:px-9 lg:pt-8 lg:pb-[72px]">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs tracking-[0.8px] text-fg-4">{data.eyebrow}</span>
          <h1 className="m-0 font-heading text-[26px] leading-[1.1] font-bold lg:text-[34px]">{format(t.hello, { name: data.name })}</h1>
          <PendingHeadline />
        </div>
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-[22px]">
          <div className="flex min-w-0 flex-col gap-3.5 lg:gap-[18px]">
            <PendingCards />
            <Numbers kpis={data.kpis} />
            <WeeklyChart series={data.chart} />
            <TrapList traps={data.traps} />
          </div>
          <div className="flex min-w-0 flex-col gap-3.5 lg:gap-4">
            <StudentView seeing={data.seeing} />
            {data.log ? <RecentAudit entries={data.log} /> : null}
            <PrivacyNote />
          </div>
        </div>
      </main>
    </PendingProvider>
  );
}
