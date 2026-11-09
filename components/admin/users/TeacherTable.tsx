"use client";

import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { SetupBar, SignalChip, TeacherAvatar } from "@/components/school/TeacherList";
import { hintText } from "@/lib/admin/users-model";
import { format, getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useUsers } from "./context";
import { Pager, UrlSearch } from "./ListControls";
import { classSummary, TeacherTags } from "./TeacherBits";
import type { AdminTeacher, TeacherPage } from "./types";

const columns = "grid grid-cols-[1.5fr_1.4fr_1fr_1.5fr_92px] gap-4";

/**
 * Öğretmenler sekmesi (Kullanicilar-Son): bekleyen talepler bağlantısı, arama (ad, okul, branş),
 * masaüstünde tablo, telefonda kartlar; ad sırasıyla sayfa sayfa. Kurulum çubuğu ve işaret
 * Okulum'la aynı kuraldan gelir. Satırı açınca öğretmen çekmecesi açılır.
 */
export function TeacherTable({ pending, data }: { pending: number; data: TeacherPage }) {
  const t = getMessages().adminUsers;
  const { openTeacher } = useUsers();
  const shown = data.rows;

  return (
    <div className="flex flex-col gap-3.5 [animation:fade-in_.2s_ease-out_both]">
      <Link
        href={paths.adminApplications}
        className="flex items-center gap-3 rounded-[14px] border border-warning/30 bg-warning/8 px-4 py-3 text-fg no-underline hover:border-warning/60"
      >
        <ClipboardList className="size-[18px] flex-none text-warning-fg" strokeWidth={2} aria-hidden="true" />
        <span className="flex-1 text-sm font-bold">{pending > 0 ? format(t.teachers.pending, { n: pending }) : t.teachers.pendingNone}</span>
        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-warning-fg">
          {t.teachers.pendingLink}
          <ChevronRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </span>
      </Link>

      <UrlSearch base={{ tab: "ogretmenler" }} value={data.search} placeholder={t.search.teachers} />

      {shown.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-line p-7 text-center text-[13px] leading-normal text-fg-3">
          {data.search ? t.teachers.noMatch : t.teachers.empty}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-[20px] border border-line bg-surface max-lg:hidden">
            <div aria-hidden="true" className={cn(columns, "px-[18px] py-3 text-xs font-bold tracking-[.8px] text-fg-4")}>
              <span>{t.teachers.columns.teacher}</span>
              <span>{t.teachers.columns.school}</span>
              <span>{t.teachers.columns.classes}</span>
              <span>{t.teachers.columns.setup}</span>
              <span />
            </div>
            <ul className="m-0 list-none p-0">
              {shown.map((teacher) => (
                <li key={teacher.id} className={cn(columns, "items-center border-t border-line px-[18px] py-3.5")}>
                  <span className="flex min-w-0 items-center gap-3">
                    <TeacherAvatar emoji={teacher.avatar} />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <b className="truncate text-[15px]">{teacher.name}</b>
                      <TeacherTags teacher={teacher} />
                      <span className="truncate text-xs text-fg-3">{teacher.subject || t.teachers.noSubject}</span>
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm">{teacher.school?.name ?? t.teachers.noSchool}</span>
                    <span className="truncate text-xs text-fg-4">{schoolMeta(teacher)}</span>
                  </span>
                  <span className="text-sm text-fg-2">{classSummary(teacher)}</span>
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="flex items-center gap-2.5">
                      <SetupBar step={teacher.step} signal={teacher.signal} />
                      <SignalChip signal={teacher.signal} />
                    </span>
                    <span className="text-xs text-fg-3">{hintText(teacher.hint)}</span>
                  </span>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={format(t.teachers.openLabel, { name: teacher.name })}
                    onClick={() => openTeacher(teacher.id)}
                    className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 justify-self-end rounded-[10px] border border-line bg-transparent px-3 font-[inherit] text-[13px] font-bold text-fg-2 hover:border-accent hover:text-fg"
                  >
                    {t.teachers.open}
                    <ChevronRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
            {shown.map((teacher) => (
              <li key={teacher.id}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => openTeacher(teacher.id)}
                  className="flex w-full cursor-pointer flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-3.5 text-left font-[inherit] text-fg hover:border-accent"
                >
                  <span className="flex w-full items-center gap-3">
                    <TeacherAvatar emoji={teacher.avatar} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <b className="truncate text-[15px]">{teacher.name}</b>
                      <TeacherTags teacher={teacher} />
                      <span className="truncate text-xs text-fg-3">
                        {format(t.teachers.schoolLine, { school: teacher.school?.name ?? t.teachers.noSchool, subject: teacher.subject || t.teachers.noSubject })}
                      </span>
                    </span>
                    <SignalChip signal={teacher.signal} />
                  </span>
                  <span className="flex w-full items-center gap-2.5">
                    <SetupBar step={teacher.step} signal={teacher.signal} />
                    <span className="text-xs whitespace-nowrap text-fg-3">{classSummary(teacher)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Pager base={{ tab: "ogretmenler" }} info={data} />

      <span className="text-[13px] leading-normal text-fg-3">{t.teachers.note}</span>
    </div>
  );
}

function schoolMeta(teacher: AdminTeacher) {
  const t = getMessages().adminUsers;
  const when = teacher.lastSeen ?? t.never;
  return teacher.school ? format(t.teachers.schoolMeta, { place: teacher.school.place, when }) : format(t.teachers.schoolMeta, { place: t.never, when });
}
