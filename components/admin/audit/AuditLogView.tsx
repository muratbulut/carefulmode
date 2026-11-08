import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import type { AuditEntryView, AuditPage, Seer } from "@/lib/admin/audit-log";
import { auditHref, type AuditFilters } from "@/lib/admin/audit-url";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AuditFilterBar } from "./AuditFilterBar";
import { kindTones } from "./kinds";

/** "Bu sayfayı görenler" kutusunda ilk bu kadar kişi görünür (masaüstü, telefon), kalanı açılır. */
const seersShown = 12;
const seersShownPhone = 3;

/**
 * Kayıt defteri (Kayit-Defteri): kim, neyi, ne zaman yaptı. Masaüstünde tablo (zaman, kim, tür,
 * ne yaptı), telefonda kartlar. Süzgeçler adreste; sayfa başına 50 kayıt, "Daha eski kayıtlar"
 * ile devam edilir. Kayıtlar yalnızca okunur.
 */
export function AuditLogView({ page, filters }: { page: AuditPage; filters: AuditFilters }) {
  const t = getMessages().adminAudit;
  return (
    <main className="flex flex-col gap-3.5 px-4 pt-4 pb-10 lg:gap-[22px] lg:px-9 lg:pt-8 lg:pb-[72px]">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-heading text-[26px] leading-[1.1] font-bold lg:text-[34px]">{t.title}</h1>
          <p className="m-0 max-w-[640px] text-sm leading-[1.55] text-fg-3 lg:text-[15px]">{t.intro}</p>
        </div>
        <span className="flex-none text-[13px] text-fg-3" data-testid="audit-count">
          {format(t.count, { n: page.total.toLocaleString("tr-TR") })}
        </span>
      </div>

      <Seers seers={page.seers} />
      <AuditFilterBar filters={filters} people={page.people} />

      {page.entries.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-line p-7 text-center text-[13px] text-fg-3">{t.empty}</p>
      ) : (
        <>
          <EntryTable entries={page.entries} />
          <EntryCards entries={page.entries} />
        </>
      )}

      {filters.cursor || page.older ? (
        <nav className="flex flex-wrap items-center justify-between gap-2.5">
          {filters.cursor ? (
            <Link
              href={auditHref({ ...filters, cursor: null })}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-sm font-bold text-fg no-underline hover:border-line-strong"
            >
              <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
              {t.newest}
            </Link>
          ) : (
            <span />
          )}
          {page.older ? (
            <Link
              href={auditHref({ ...filters, cursor: page.older })}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-sm font-bold text-fg no-underline hover:border-line-strong"
            >
              {t.older}
              <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}

function Seers({ seers }: { seers: Seer[] }) {
  const t = getMessages().adminAudit;
  const chip = (seer: Seer, key: string, className?: string) => (
    <li key={key} className={cn("inline-flex h-[34px] items-center gap-2 rounded-full border border-line bg-surface py-0 pr-2.5 pl-1 text-[13px]", className)}>
      <span aria-hidden="true" className="flex size-[26px] items-center justify-center rounded-full border border-line bg-card text-[13px]">
        {seer.avatar}
      </span>
      <b>{seer.name}</b>
      <span className="text-fg-4">{seer.admin ? t.seers.admin : t.seers.team}</span>
    </li>
  );
  // Telefonda ilk üç kişi, masaüstünde ilk on iki kişi görünür; kalanlar "+N kişi daha" ile açılır.
  // 3-12 arasındakiler iki yerde durur: masaüstünde listede, telefonda açılan bölümde.
  const middle = seers.slice(seersShownPhone, seersShown);
  const rest = seers.slice(seersShown);
  return (
    <section aria-labelledby="audit-seers" className="flex flex-col gap-2.5 rounded-2xl border border-card bg-surface-raised px-4 py-3.5" data-testid="audit-seers">
      <h2 id="audit-seers" className="m-0 flex items-center gap-2 text-[13px] font-bold text-fg-2">
        <Lock className="size-[15px] text-fg-4" strokeWidth={2} aria-hidden="true" />
        {t.seers.title}
      </h2>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {seers.slice(0, seersShownPhone).map((seer, i) => chip(seer, `a${i}`))}
        {middle.map((seer, i) => chip(seer, `b${i}`, "hidden lg:inline-flex"))}
      </ul>
      {middle.length + rest.length > 0 ? (
        <details className={cn(rest.length === 0 && "lg:hidden")}>
          <summary className="-my-2.5 cursor-pointer py-2.5 text-[13px] font-bold text-accent-fg">
            <span className="lg:hidden">{format(t.seers.more, { n: middle.length + rest.length })}</span>
            <span className="hidden lg:inline">{format(t.seers.more, { n: rest.length })}</span>
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
            {middle.map((seer, i) => chip(seer, `c${i}`, "lg:hidden"))}
            {rest.map((seer, i) => chip(seer, `d${i}`))}
          </ul>
        </details>
      ) : null}
      <span className="text-xs text-fg-4">{t.seers.hint}</span>
    </section>
  );
}

function KindChip({ entry, className }: { entry: AuditEntryView; className?: string }) {
  const t = getMessages().adminAudit;
  return (
    <span className={cn("inline-flex items-center rounded-full px-[9px] py-[3px] text-xs font-bold", kindTones[entry.kind].chip, className)}>
      {t.kinds[entry.kind]}
    </span>
  );
}

function When({ entry }: { entry: AuditEntryView }) {
  return (
    <time dateTime={entry.at} title={entry.whenFull}>
      {entry.when}
    </time>
  );
}

/** Masaüstü: tablo. */
function EntryTable({ entries }: { entries: AuditEntryView[] }) {
  const t = getMessages().adminAudit;
  return (
    <div className="hidden overflow-hidden rounded-[20px] border border-line bg-surface lg:block">
      <table className="w-full table-fixed border-collapse" data-testid="audit-table" aria-label={t.listLabel}>
        <colgroup>
          <col className="w-[156px]" />
          <col className="w-[226px]" />
          <col className="w-[128px]" />
          <col />
        </colgroup>
        <thead>
          <tr className="text-left text-xs font-bold tracking-[0.8px] text-fg-4">
            <th scope="col" className="py-3 pr-2 pl-[18px] font-bold">
              {t.columns.time}
            </th>
            <th scope="col" className="px-2 py-3 font-bold">
              {t.columns.who}
            </th>
            <th scope="col" className="px-2 py-3 font-bold">
              {t.columns.kind}
            </th>
            <th scope="col" className="py-3 pr-[18px] pl-2 font-bold">
              {t.columns.what}
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-t border-card align-middle" data-testid="audit-row">
              <td className="py-3 pr-2 pl-[18px] text-[13px] text-fg-3">
                <When entry={entry} />
              </td>
              <td className="px-2 py-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span aria-hidden="true" className="flex size-[30px] flex-none items-center justify-center rounded-full border border-line bg-card text-[15px]">
                    {entry.actor.avatar}
                  </span>
                  <b className="truncate text-sm">{entry.actor.name}</b>
                </span>
              </td>
              <td className="px-2 py-3">
                <KindChip entry={entry} />
              </td>
              <td className="py-3 pr-[18px] pl-2 text-sm leading-[1.45] text-fg-2 [overflow-wrap:anywhere]">{entry.sentence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Telefon: kartlar ("Ad S. · ne yaptı", altında tür ve zaman). */
function EntryCards({ entries }: { entries: AuditEntryView[] }) {
  const t = getMessages().adminAudit;
  return (
    <ol aria-label={t.listLabel} className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden" data-testid="audit-cards">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 rounded-[14px] border border-card bg-surface-raised p-3" data-testid="audit-row">
          <span aria-hidden="true" className="flex size-8 flex-none items-center justify-center rounded-full border border-line bg-card text-base">
            {entry.actor.avatar}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-sm leading-[1.45] text-fg-2 [overflow-wrap:anywhere]">
              <b className="text-fg">{entry.actor.name}</b> · {entry.sentence}
            </span>
            <span className="flex items-center gap-2 text-xs text-fg-4">
              <span className={cn("font-bold", kindTones[entry.kind].text)}>{t.kinds[entry.kind]}</span>
              <When entry={entry} />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
