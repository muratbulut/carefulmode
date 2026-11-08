import { ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { initialOf, matchesSearch, type StudentStatus } from "@/lib/classroom/teacher-rules";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ClassroomDetailData, StudentView } from "./types";

type Filter = "all" | StudentStatus;
const filters: Filter[] = ["all", "finished", "inProgress", "notStarted"];

const statusColor: Record<StudentStatus, string> = {
  finished: "text-success-fg",
  inProgress: "text-fg-3",
  notStarted: "text-warning-fg",
};
const countColor: Record<StudentStatus, string> = {
  finished: "text-success-fg",
  inProgress: "text-fg-2",
  notStarted: "text-warning-fg",
};

const doneCount = (s: StudentView) => s.homework.filter(Boolean).length;

/**
 * Sınıf detayı > Öğrenciler (D2): arama, ödevdeki duruma göre süzgeç (bitirdi, devam ediyor,
 * başlamadı) ve sıralama. Satıra dokununca öğrenci çekmecesi açılır. Satırda yalnızca hangi
 * labları bitirdiği görünür; puan yok.
 */
export function StudentsTab({ data, onOpenStudent }: { data: ClassroomDetailData; onOpenStudent: (id: string) => void }) {
  const t = getMessages().classroom;
  const s = t.detail.students;
  const hw = data.homework;
  const tone = hw ? toneOf(hw.color) : null;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [leastFirst, setLeastFirst] = useState(false);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: data.students.length, finished: 0, inProgress: 0, notStarted: 0 };
    for (const student of data.students) if (student.status) result[student.status]++;
    return result;
  }, [data.students]);

  const list = useMemo(() => {
    const progress = (x: StudentView) => (hw ? doneCount(x) : x.total);
    return data.students
      .filter((x) => matchesSearch(x.name, query) && (filter === "all" || x.status === filter))
      .sort((a, b) => (leastFirst ? progress(a) - progress(b) : 0) || a.name.localeCompare(b.name, "tr"));
  }, [data.students, query, filter, leastFirst, hw]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative block min-w-0 flex-[1_1_240px]">
          <span className="sr-only">{s.search}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-fg-4" strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.search}
            className="h-11 w-full rounded-xl border border-line bg-canvas pr-3.5 pl-10 text-base text-fg placeholder:text-fg-4 focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => setLeastFirst((v) => !v)}
          className="inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-[10px] border border-line px-3 text-[13px] font-bold text-fg-2 hover:text-fg"
        >
          <ArrowUpDown className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {leastFirst ? s.sortByLeast : s.sortByName}
        </button>
      </div>

      {hw ? (
        <div role="group" aria-label={s.filtersLabel} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 lg:mx-0 lg:px-0">
          {filters.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "h-[34px] flex-none cursor-pointer rounded-full border px-3 text-[13px] font-bold whitespace-nowrap max-lg:h-10",
                filter === key ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-fg-2",
              )}
            >
              {format(s.filterCount, { label: s.filters[key], count: counts[key] })}
            </button>
          ))}
        </div>
      ) : null}

      <span className="text-[13px] text-fg-3">
        {hw ? format(s.line, { name: hw.name, count: list.length }) : format(s.lineNoHomework, { count: list.length })}
      </span>

      {list.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {list.map((student) => {
            const done = doneCount(student);
            return (
              <li key={student.id}>
                <button
                  type="button"
                  onClick={() => onOpenStudent(student.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-left text-fg hover:border-accent"
                >
                  <span aria-hidden="true" className="flex size-9 flex-none items-center justify-center rounded-full bg-card font-bold text-accent-light">
                    {initialOf(student.name)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="truncate text-[15px] font-bold">{student.name}</span>
                    <span className="text-xs text-fg-3">{student.last ? format(s.lastLab, { time: student.last }) : s.lastLabNone}</span>
                  </span>
                  {hw && tone && student.status ? (
                    <>
                      <span className={cn("sr-only text-right text-xs font-bold lg:not-sr-only lg:min-w-24", statusColor[student.status])}>
                        {s.filters[student.status]}
                      </span>
                      <span aria-hidden="true" className="flex flex-none gap-1">
                        {student.homework.map((isDone, i) => (
                          <span key={i} className={cn("size-2.5 rounded-[3px]", isDone ? tone.fill : "bg-line")} />
                        ))}
                      </span>
                      <b className={cn("w-[34px] flex-none text-right text-[13px]", countColor[student.status])}>
                        <span aria-hidden="true">{format(s.progress, { done, total: student.homework.length })}</span>
                        <span className="sr-only">{format(s.progressLabel, { done, total: student.homework.length })}</span>
                      </b>
                    </>
                  ) : (
                    <b className="flex-none text-[13px] text-fg-2">
                      <span aria-hidden="true">{format(s.allLabs, { done: student.total, total: data.labTotal })}</span>
                      <span className="sr-only">{format(s.allLabsLabel, { done: student.total })}</span>
                    </b>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 rounded-[14px] border border-dashed border-line p-5 text-center text-sm text-fg-3">{s.noMatch}</p>
      )}
    </div>
  );
}
