"use client";

import Link from "next/link";
import { ClipboardList, Info, School, User, Users, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { format, getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { useUsers } from "../context";
import { Pager, UrlSearch } from "../ListControls";
import type { AdminSchool, SchoolsOverview } from "../types";
import { SchoolCard } from "./SchoolCard";

const tones = {
  accent: "bg-accent/12 text-accent-fg",
  success: "bg-success/12 text-success-fg",
  warning: "bg-warning/12 text-warning-fg",
  purple: "bg-purple/12 text-purple-fg",
} as const;

/**
 * Okullar görünümü (Kullanicilar-Son-Okullar): dört sayı (talep bekleyen Talepler'e gider),
 * "Okul sorumlusu ne görür?" kutusu, okul araması ve okul kartları (ad sırasıyla sayfa sayfa;
 * sayfanın ilki açık gelir). Öğrenci adı yok, yalnızca toplamlar.
 */
export function SchoolsView({ overview }: { overview: SchoolsOverview }) {
  const t = getMessages().adminUsers;

  return (
    <div className="flex flex-col gap-3.5 [animation:fade-in_.2s_ease-out_both] lg:gap-[22px]">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3.5">
        <Count Icon={School} tone="accent" value={overview.summary.schools} label={t.schools.summary.schools} />
        <Count Icon={Users} tone="success" value={overview.summary.teachers} label={t.schools.summary.teachers} />
        <Link href={paths.adminApplications} className="flex no-underline">
          <Count
            Icon={ClipboardList}
            tone="warning"
            value={overview.summary.pending}
            label={t.schools.summary.pending}
            className="flex-1 border-warning/35 hover:border-warning/60"
          />
        </Link>
        <Count Icon={User} tone="purple" value={overview.summary.students} label={t.schools.summary.students} />
      </div>

      <p className="m-0 flex gap-3 rounded-[14px] border border-card bg-surface-deep px-4 py-3.5 text-[13px] leading-[1.55] text-fg-2">
        <Info className="mt-0.5 size-4 flex-none text-accent-fg" strokeWidth={2} aria-hidden="true" />
        <span>
          <b className="text-fg">{t.schools.privacyTitle}</b> {t.schools.privacyText}
        </span>
      </p>

      {overview.summary.schools > 0 ? <UrlSearch base={{ view: "okullar" }} value={overview.search} placeholder={t.search.schools} /> : null}

      {overview.schools.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-line p-7 text-center text-[13px] leading-normal text-fg-3">
          {overview.search ? t.schools.noMatch : t.schools.empty}
        </div>
      ) : (
        // Sayfa ya da arama değişince açık kartlar sıfırlanır (yeni sayfanın ilki açık).
        <SchoolList key={`${overview.page}:${overview.search}`} schools={overview.schools} />
      )}

      <Pager base={{ view: "okullar" }} info={overview} />

      {overview.pendingNoSchool > 0 ? (
        <span className="text-[13px] leading-normal text-fg-3">{format(t.schools.otherPending, { n: overview.pendingNoSchool })}</span>
      ) : null}
    </div>
  );
}

/** Sayfadaki okul kartları; ilki açık gelir, her kart ayrı açılıp kapanır. */
function SchoolList({ schools }: { schools: AdminSchool[] }) {
  const { teachers } = useUsers();
  const [open, setOpen] = useState<string[]>(() => (schools[0] ? [schools[0].id] : []));
  const byId = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const toggle = (id: string) => setOpen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  return (
    <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
      {schools.map((school) => (
        <li key={school.id}>
          <SchoolCard
            school={school}
            teachers={school.teacherIds.map((id) => byId.get(id)).filter((x) => x !== undefined)}
            open={open.includes(school.id)}
            onToggle={() => toggle(school.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function Count({
  Icon,
  tone,
  value,
  label,
  className,
}: {
  Icon: LucideIcon;
  tone: keyof typeof tones;
  value: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-[18px] border border-line bg-surface p-3 text-fg lg:p-4", className)}>
      <span className={cn("flex size-9 flex-none items-center justify-center rounded-xl lg:size-[42px]", tones[tone])}>
        <Icon className="size-[18px] lg:size-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="font-heading text-[22px] leading-[1.1] lg:text-[26px]">{value}</b>
        <span className="text-xs text-fg-3">{label}</span>
      </span>
    </div>
  );
}
