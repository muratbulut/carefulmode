"use client";

import { ChevronRight } from "lucide-react";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useUsers } from "./context";
import { Pager, UrlSearch } from "./ListControls";
import type { StudentPage } from "./types";

const columns = "lg:grid lg:grid-cols-[1.4fr_1.6fr_.8fr_.9fr_.9fr_64px] lg:gap-4";

/**
 * Öğrenciler sekmesi (Kullanicilar-Son): arama (ad, sınıf, öğretmen), masaüstünde tablo, telefonda
 * satırlar; sayfa sayfa. Ad "Ad S." olarak gelir; e-posta, puan ve rapor yok. Satıra dokununca
 * kısa profil açılır.
 */
export function StudentList({ data }: { data: StudentPage }) {
  const t = getMessages().adminUsers;
  const s = t.students;
  const { openStudent } = useUsers();

  return (
    <div className="flex flex-col gap-3.5 [animation:fade-in_.2s_ease-out_both]">
      <UrlSearch base={{}} value={data.search} placeholder={t.search.students} />

      {data.rows.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-line p-7 text-center text-[13px] leading-normal text-fg-3">
          {data.search ? s.noMatch : s.empty}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
          <div aria-hidden="true" className={cn("hidden px-[18px] py-3 text-xs font-bold tracking-[.8px] text-fg-4", columns)}>
            <span>{s.columns.student}</span>
            <span>{s.columns.classTeacher}</span>
            <span>{s.columns.labs}</span>
            <span>{s.columns.joined}</span>
            <span>{s.columns.lastSeen}</span>
            <span />
          </div>
          <ul className="m-0 list-none p-0">
            {data.rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => openStudent(row.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 border-0 border-t border-line bg-transparent px-3.5 py-3 text-left font-[inherit] text-fg hover:bg-card/50 lg:items-center lg:px-[18px]",
                    columns,
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-full border border-line bg-card text-lg lg:size-[34px] lg:text-[17px]">
                      {row.avatar}
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <b className="truncate text-[15px]">{row.name}</b>
                      <span className={cn("truncate text-xs lg:hidden", row.classLabel ? "text-fg-2" : "text-fg-4")}>{row.classLabel ?? s.noClass}</span>
                    </span>
                  </span>
                  <span className={cn("hidden truncate text-sm lg:block", row.classLabel ? "text-fg-2" : "text-fg-4")}>{row.classLabel ?? s.noClass}</span>
                  <b className="hidden text-sm lg:block">{format(s.labs, { n: row.labs })}</b>
                  <span className="hidden text-sm text-fg-3 lg:block">{row.joined}</span>
                  <span className="hidden text-sm text-fg-3 lg:block">{row.lastSeen ?? t.never}</span>
                  <span className="flex flex-none flex-col items-end gap-0.5 lg:hidden">
                    <b className="text-[13px]">{format(s.labs, { n: row.labs })}</b>
                    <span className="text-[11px] text-fg-4">{row.lastSeen ?? t.never}</span>
                  </span>
                  <span className="inline-flex flex-none items-center gap-1 text-[13px] font-bold text-accent-fg lg:justify-self-end">
                    <span className="max-lg:sr-only">{s.open}</span>
                    <ChevronRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Pager base={{}} info={data} />

      <span className="text-[13px] text-fg-3 max-lg:hidden">{s.note}</span>
      <span className="text-[13px] text-fg-3 lg:hidden">{s.noteMobile}</span>
    </div>
  );
}
