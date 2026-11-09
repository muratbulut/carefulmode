import Link from "next/link";
import { Check, FileText, Mail } from "lucide-react";
import { applicationsHref, type ApplicationTab } from "@/lib/admin/application-rules";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { levelChip, Tag } from "./parts";
import type { ApplicationRow } from "./types";

/**
 * Sekmedeki talepler (Talepler-Son, solda; telefonda tek sütun). Satır bir bağlantıdır: seçili
 * talep adrese yazılır, telefonda ayrıntı sayfası açılır. Satırda kurumsal e-posta ve belge
 * işaretleri, "Bilgi: Güçlü / Orta / Zayıf", YENİ OKUL, CEVAP GELDİ ve 18 YAŞ ALTI etiketleri.
 */
export function ApplicationList({
  tab,
  rows,
  selectedId,
  searching,
  limit,
}: {
  tab: ApplicationTab;
  rows: ApplicationRow[];
  selectedId: string | null;
  searching: boolean;
  limit: number | null;
}) {
  const t = getMessages().adminApplications;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-[18px] border border-dashed border-line px-4 py-9 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/14">
          <Check className="size-6 text-success-fg" strokeWidth={2.6} aria-hidden="true" />
        </span>
        <span className="text-[15px] text-fg-2">{searching ? t.empty.search : t.empty[tab]}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul aria-label={t.tabs[tab]} className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((row) => {
          const on = row.id === selectedId;
          return (
            <li key={row.id}>
              <Link
                href={applicationsHref(tab, row.id)}
                scroll={false}
                prefetch={false}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border px-3.5 py-3 text-fg no-underline transition-colors",
                  on ? "lg:border-accent lg:bg-card" : "",
                  "border-line bg-surface hover:border-line-strong",
                )}
              >
                <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-full border border-line bg-card text-xl">
                  {row.avatar}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="flex items-center justify-between gap-2">
                    <b className="truncate text-[15px]">{row.name}</b>
                    <span className="flex-none text-xs whitespace-nowrap text-fg-4">{row.when}</span>
                  </span>
                  <span className="truncate text-[13px] text-fg-3">{format(t.rowSchool, { school: row.school, subject: row.subject })}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2">
                    <Mail className={cn("size-[15px]", row.hasEmail ? "text-success-fg" : "text-line-strong")} strokeWidth={2} aria-hidden="true" />
                    <span className="sr-only">{row.hasEmail ? t.rowEmail.yes : t.rowEmail.no}</span>
                    <FileText className={cn("size-[15px]", row.hasDocument ? "text-success-fg" : "text-line-strong")} strokeWidth={2} aria-hidden="true" />
                    <span className="sr-only">{row.hasDocument ? t.rowDocument.yes : t.rowDocument.no}</span>
                    <span className={cn("inline-flex h-6 flex-none items-center rounded-full px-[9px] text-xs font-bold", levelChip[row.level])}>
                      {format(t.level, { level: t.levels[row.level] })}
                    </span>
                    {row.newSchool ? <Tag tone="warning">{t.newSchoolTag}</Tag> : null}
                    {row.answered ? <Tag tone="success">{t.answeredTag}</Tag> : null}
                    {row.minor ? <Tag tone="warning">{t.minorTag}</Tag> : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {limit ? <p className="m-0 px-1 text-xs text-fg-4">{format(t.limited, { n: limit })}</p> : null}
    </div>
  );
}
