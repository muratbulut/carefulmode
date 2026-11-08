"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usersHref, type PageInfo, type UsersQuery } from "@/lib/admin/users-model";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SearchBox } from "./TeacherBits";

/** Listenin adresteki yeri: görünüm ve sekme (arama ve sayfa bunun üstüne yazılır). */
type ListBase = Pick<Partial<UsersQuery>, "view" | "tab">;

/**
 * Adrese yazılan arama (?ara=): yazınca kısa bir bekleme sonra liste sunucudan yeniden gelir ve
 * 1. sayfaya döner. Açık çekmece adresten düşer.
 */
export function UrlSearch({ base, value, placeholder }: { base: ListBase; value: string; placeholder: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <SearchBox
      value={value}
      placeholder={placeholder}
      busy={pending}
      onSearch={(next) => startTransition(() => router.replace(usersHref({ ...base, search: next.trim() }), { scroll: false }))}
    />
  );
}

/** Sayfa gezgini: "26–50 · toplam 73", önceki ve sonraki sayfa. Tek sayfada görünmez. */
export function Pager({ base, info }: { base: ListBase; info: PageInfo }) {
  const t = getMessages().adminUsers.pager;
  if (info.pages <= 1) return null;
  const href = (page: number) => usersHref({ ...base, search: info.search, page });
  return (
    <nav aria-label={t.label} className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-[13px] text-fg-3">{format(t.range, { from: info.from, to: info.to, total: info.total.toLocaleString("tr-TR") })}</span>
      <span className="flex items-center gap-2">
        <PageLink href={info.page > 1 ? href(info.page - 1) : null} label={t.previous}>
          <ChevronLeft className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </PageLink>
        <span className="text-[13px] font-bold">{format(t.page, { page: info.page, pages: info.pages })}</span>
        <PageLink href={info.page < info.pages ? href(info.page + 1) : null} label={t.next}>
          <ChevronRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
        </PageLink>
      </span>
    </nav>
  );
}

function PageLink({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  const className = "flex size-10 items-center justify-center rounded-xl border border-line bg-surface text-fg-2";
  if (!href) {
    return (
      <span aria-hidden="true" className={cn(className, "opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cn(className, "hover:border-accent hover:text-fg")}>
      {children}
    </Link>
  );
}
