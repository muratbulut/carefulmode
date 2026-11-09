import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AuditEntryView } from "@/lib/admin/audit-log";
import { getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { kindTones } from "../audit/kinds";

/** "Son kayıtlar" (Ozet-Son): kayıt defterini görebilen için en yeni beş kayıt; öğrenci adı yok. */
export function RecentAudit({ entries }: { entries: AuditEntryView[] }) {
  const t = getMessages();
  const a = t.adminAudit;
  return (
    <section className="flex flex-col rounded-[20px] border border-line bg-surface p-4 lg:p-5" data-testid="recent-audit">
      <span className="flex items-center justify-between gap-3 pb-1.5">
        <h2 className="m-0 text-base font-bold">{t.adminOverview.log.title}</h2>
        <Link href={paths.adminAudit} className="-my-2.5 inline-flex min-h-10 items-center gap-1 text-[13px] font-bold text-accent-fg no-underline hover:underline">
          {t.adminOverview.log.link}
          <ChevronRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
        </Link>
      </span>
      {entries.length === 0 ? (
        <p className="m-0 border-t border-card pt-3 text-[13px] text-fg-3">{t.adminOverview.log.empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-2.5 border-t border-card py-2.5">
              <span aria-hidden="true" className="flex size-8 flex-none items-center justify-center rounded-full bg-card text-base">
                {entry.actor.avatar}
              </span>
              <span className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[13px] leading-[1.45] [overflow-wrap:anywhere]">
                  <b>{entry.actor.name}</b> · {entry.sentence}
                </span>
                <span className="flex items-center gap-2 text-xs text-fg-4">
                  <span className={cn("inline-flex h-5 items-center rounded-full px-[7px] font-bold", kindTones[entry.kind].chip)}>{a.kinds[entry.kind]}</span>
                  <time dateTime={entry.at} title={entry.whenFull}>
                    {entry.when}
                  </time>
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
