"use client";

import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRevealSelected } from "@/components/common/ScrollStrip";
import type { AuditPerson } from "@/lib/admin/audit-log";
import { auditHref, auditKindList, maxQueryLength, kindParams, type AuditFilters } from "@/lib/admin/audit-url";
import { getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { kindTones } from "./kinds";

/**
 * Kayıt defterinin süzgeçleri (Kayit-Defteri): arama, tür ve kişi. Hepsi adreste durur
 * (?ara=&tur=&kisi=). Arama yazarken kısa bir beklemeden sonra liste kendiliğinden süzülür;
 * JavaScript yoksa form normal gönderilir.
 */
export function AuditFilterBar({ filters, people }: { filters: AuditFilters; people: AuditPerson[] }) {
  const t = getMessages().adminAudit;
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const chipStrip = useRevealSelected<HTMLElement>(filters.kind);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const submitSoon = (delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => form.current?.requestSubmit(), delay);
  };

  const chips: { key: string; label: string; href: string; on: boolean; tone: string }[] = [
    { key: "all", label: t.all, href: auditHref({ ...filters, kind: null, cursor: null }), on: !filters.kind, tone: "border-accent" },
    ...auditKindList.map((kind) => ({
      key: kindParams[kind],
      label: t.kinds[kind],
      href: auditHref({ ...filters, kind, cursor: null }),
      on: filters.kind === kind,
      tone: kindTones[kind].border,
    })),
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <Form ref={form} action={paths.adminAudit} replace role="search" className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
        {filters.kind ? <input type="hidden" name="tur" value={kindParams[filters.kind]} /> : null}
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{t.search.label}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-fg-4" strokeWidth={2} aria-hidden="true" />
          <input
            type="search"
            name="ara"
            defaultValue={filters.query}
            maxLength={maxQueryLength}
            placeholder={t.search.placeholder}
            onChange={() => submitSoon(400)}
            className="h-[50px] w-full rounded-xl border border-line bg-canvas pr-3.5 pl-11 text-base text-fg placeholder:text-fg-4 focus:border-accent focus:outline-none lg:text-[15px]"
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] font-bold text-fg-3">
          <span className="flex-none">{t.personLabel}</span>
          <select
            name="kisi"
            defaultValue={filters.person ?? ""}
            onChange={() => submitSoon(0)}
            className="h-[42px] min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-fg focus:border-accent focus:outline-none lg:w-[220px] lg:flex-none"
          >
            <option value="">{t.everyone}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="sr-only">
          {t.search.submit}
        </button>
      </Form>
      <nav ref={chipStrip} aria-label={t.kindLabel} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <ul className="m-0 flex list-none gap-2 p-0 lg:flex-wrap">
          {chips.map((chip) => (
            <li key={chip.key} className="flex-none">
              <Link
                href={chip.href}
                aria-current={chip.on ? "true" : undefined}
                className={cn(
                  "inline-flex h-[34px] items-center rounded-full border px-3 text-[13px] font-bold whitespace-nowrap no-underline max-lg:h-10",
                  chip.on ? cn("bg-card text-fg", chip.tone) : "border-line bg-transparent text-fg-3 hover:text-fg",
                )}
              >
                {chip.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
