"use client";

import { LoaderCircle, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AdminClass, AdminTeacher } from "./types";

/** "OKUL SORUMLUSU" ve "YÖNETİCİ" etiketleri (öğretmen satırı ve çekmece). */
export function TeacherTags({ teacher }: { teacher: AdminTeacher }) {
  const t = getMessages().adminUsers.teachers;
  if (!teacher.coordinatorOf && !teacher.isAdmin) return null;
  return (
    <span className="flex flex-wrap gap-x-2 text-[11px] font-extrabold tracking-[.5px]">
      {teacher.coordinatorOf ? <span className="text-warning-fg">{t.coordinator}</span> : null}
      {teacher.isAdmin ? <span className="text-purple-fg">{t.admin}</span> : null}
    </span>
  );
}

/** "Bilişim Teknolojileri · 2 sınıf · 57 öğrenci" gibi satırlardaki sınıf özeti. */
export function classSummary(teacher: Pick<AdminTeacher, "classes" | "students">) {
  const t = getMessages().adminUsers.teachers;
  return teacher.classes.length > 0 ? format(t.classSummary, { classes: teacher.classes.length, students: teacher.students }) : t.noClass;
}

/** Sınıfın kısa kartı: ad, düzey ve öğrenci sayısı, ödevin mahallesi ve yüzdesi. Öğrenci adı yok. */
export function ClassMini({ item, compact = false }: { item: AdminClass; compact?: boolean }) {
  const t = getMessages().adminUsers.drawer;
  const tone = item.topic ? toneOf(item.topic.color) : null;
  return (
    <li
      className={cn(
        "flex flex-col border border-card",
        compact ? "gap-1.5 rounded-xl bg-canvas px-3 py-2.5" : "gap-2 rounded-[14px] bg-surface-deep px-3.5 py-3",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <b className={cn("min-w-0 break-words", compact ? "text-sm" : "font-heading text-[17px]")}>{item.name}</b>
        <span className="flex-none text-xs text-fg-3">
          {item.level ? format(t.classMembers, { level: item.level, n: item.members }) : format(t.classMembersNoLevel, { n: item.members })}
        </span>
      </span>
      <span className="flex items-center justify-between gap-2">
        {compact ? (
          <span className={cn("text-xs font-bold", tone ? tone.text : "text-fg-4")}>{item.topic ? item.topic.name : t.noAssignment}</span>
        ) : (
          <span className={cn("inline-flex h-6 items-center rounded-full px-[9px] text-xs font-bold", tone ? cn(tone.chip, tone.text) : "bg-card text-fg-4")}>
            {item.topic ? item.topic.name : t.noAssignment}
          </span>
        )}
        {item.pct !== null ? <b className={compact ? "text-[13px]" : "text-sm"}>{format(t.pct, { pct: item.pct })}</b> : null}
      </span>
      {item.pct !== null && item.topic && tone ? (
        <span
          role="img"
          aria-label={format(t.progress, { topic: item.topic.name, pct: item.pct })}
          className={cn("block overflow-hidden rounded-full bg-card", compact ? "h-[5px]" : "h-1.5")}
        >
          <span className={cn("block h-full rounded-full", tone.fill)} style={{ width: `${item.pct}%` }} />
        </span>
      ) : null}
    </li>
  );
}

/**
 * Arama kutusu. Yazdıkça kısa bir bekleme sonra `onSearch` çağrılır (liste adresle sunucudan
 * gelir: UrlSearch). `busy` iken büyüteç yerine dönen halka (hareketi azalt açıksa dönmez).
 */
export function SearchBox({
  value,
  placeholder,
  onSearch,
  delay = 300,
  busy = false,
}: {
  value: string;
  placeholder: string;
  onSearch: (value: string) => void;
  delay?: number;
  busy?: boolean;
}) {
  const t = getMessages().adminUsers.search;
  const [text, setText] = useState(value);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <label className="relative block" aria-busy={busy}>
      <span className="pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2 text-fg-4">
        {busy ? (
          <LoaderCircle className="size-[18px] motion-safe:animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Search className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        )}
      </span>
      <input
        type="search"
        value={text}
        aria-label={t.label}
        placeholder={placeholder}
        maxLength={80}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onSearch(next), delay);
        }}
        className="h-[46px] w-full rounded-xl border border-line bg-canvas pr-3.5 pl-[42px] font-[inherit] text-base text-fg placeholder:text-fg-4 focus:border-accent focus:outline-none lg:text-[15px]"
      />
    </label>
  );
}
