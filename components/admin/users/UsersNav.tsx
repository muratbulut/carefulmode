import Link from "next/link";
import { ScrollStrip } from "@/components/common/ScrollStrip";
import { usersHref, type UserTab, type UserView } from "@/lib/admin/users-model";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { UsersCounts } from "./types";

/** Üstteki iki görünüm: Genel (kişiler) ve Okullar. Adres: ?gorunum=okullar. */
export function ViewSwitch({ view, counts }: { view: UserView; counts: UsersCounts }) {
  const t = getMessages().adminUsers.views;
  const items = [
    { view: "genel" as const, title: t.general, sub: format(t.generalCount, { n: counts.people.toLocaleString("tr-TR") }) },
    { view: "okullar" as const, title: t.schools, sub: format(t.schoolsCount, { n: counts.schools.toLocaleString("tr-TR") }) },
  ];
  return (
    <div role="tablist" aria-label={t.label} className="flex gap-2 lg:max-w-[520px]">
      {items.map((item) => {
        const selected = item.view === view;
        return (
          <Link
            key={item.view}
            role="tab"
            aria-selected={selected}
            href={usersHref({ view: item.view })}
            className={cn(
              "flex flex-1 flex-col items-start gap-0.5 rounded-[14px] border px-4 py-2.5 text-left no-underline",
              selected ? "border-accent bg-accent/10 text-fg" : "border-line bg-surface text-fg-2 hover:border-line-strong",
            )}
          >
            <b className="font-heading text-[17px] lg:text-[19px]">{item.title}</b>
            <span className="text-xs text-fg-4">{item.sub}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Genel görünümün sekmeleri: Öğrenciler, Öğretmenler, Yönetim ekibi. Adres: ?sekme=... */
export function UserTabs({ tab, counts }: { tab: UserTab; counts: UsersCounts }) {
  const t = getMessages().adminUsers.tabs;
  const items = [
    { tab: "ogrenciler" as const, title: t.students, n: counts.students },
    { tab: "ogretmenler" as const, title: t.teachers, n: counts.teachers },
    { tab: "ekip" as const, title: t.team, n: counts.team },
  ];
  return (
    <ScrollStrip role="tablist" aria-label={t.label} selected={tab} className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 lg:mx-0 lg:px-0">
      {items.map((item) => {
        const selected = item.tab === tab;
        return (
          <Link
            key={item.tab}
            role="tab"
            aria-selected={selected}
            href={usersHref({ tab: item.tab })}
            className={cn(
              "inline-flex h-11 flex-none items-center gap-2 rounded-t-[10px] border-b-2 px-3.5 text-[15px] font-bold whitespace-nowrap no-underline",
              selected ? "border-accent bg-surface text-fg" : "border-transparent text-fg-3 hover:text-fg",
            )}
          >
            {item.title}
            <span className="rounded-full bg-canvas px-[7px] py-0.5 text-xs font-bold text-fg-3">{item.n.toLocaleString("tr-TR")}</span>
          </Link>
        );
      })}
    </ScrollStrip>
  );
}
