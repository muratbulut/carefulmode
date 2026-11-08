"use client";

import Link from "next/link";
import { FlaskConical, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { SignUpDialog, type SignUpTarget } from "@/components/roadmap/SignUpDialog";
import { EmptyState } from "@/components/status/EmptyState";
import { withNext } from "@/lib/account/shared";
import { format, getMessages, rich } from "@/lib/i18n";
import {
  catalogQuery,
  catalogSorts,
  difficultyFilters,
  emptyFilters,
  facetCount,
  filterLabs,
  kindFilters,
  sortLabs,
  statusFilters,
  type CatalogFilters,
  type CatalogSort,
  type FilterGroup,
} from "@/lib/lab/catalog";
import { labHref, type DistrictInfo, type LabView } from "@/lib/lab/route";
import { routes } from "@/lib/navigation";
import { FilterControl, type FilterOption } from "./FilterControl";
import { LabCard, LabRow } from "./LabCard";

type Tag = { group: FilterGroup; value: string; label: string; dot?: string };

/**
 * Lablar kataloğu (L1 + F1; tahtalar: Lablar-F1-Dugme, Lablar-Ziyaretci). Arama, açılır
 * süzgeçler ve sıralama tarayıcıda çalışır; seçimler adrese yazılır (lib/lab/catalog.ts).
 * Ziyaretçide durum süzgeci yoktur, kartlar kayıt penceresini açar.
 */
export function CatalogView({
  labs,
  districts,
  member,
  continueSlug,
  initial,
}: {
  labs: LabView[];
  districts: DistrictInfo[];
  member: boolean;
  continueSlug: string | null;
  initial: CatalogFilters;
}) {
  const t = getMessages();
  const c = t.catalog;
  const [filters, setFilters] = useState(initial);
  const [signUp, setSignUp] = useState<SignUpTarget | null>(null);

  // Seçimler adreste durur: bağlantı paylaşılınca ya da sayfa yenilenince aynı liste açılır.
  useEffect(() => {
    const next = window.location.pathname + catalogQuery(filters);
    if (next !== window.location.pathname + window.location.search) window.history.replaceState(null, "", next);
  }, [filters]);

  const results = useMemo(() => sortLabs(filterLabs(labs, filters), filters.sort, continueSlug), [labs, filters, continueSlug]);

  function toggle(group: FilterGroup, value: string) {
    setFilters((f) => {
      const list = f[group] as string[];
      return { ...f, [group]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });
  }

  const clearFilters = () => setFilters((f) => ({ ...emptyFilters(), sort: f.sort }));

  const groups: { group: FilterGroup; label: string; options: FilterOption[] }[] = [
    {
      group: "categories",
      label: c.filters.category,
      options: districts.map((d) => ({ value: d.slug, label: d.topic || d.name, dot: toneOf(d.color).fill, count: facetCount(labs, filters, "categories", d.slug) })),
    },
    {
      group: "kinds",
      label: c.filters.kind,
      options: kindFilters.map((k) => ({ value: k, label: c.kinds[k], count: facetCount(labs, filters, "kinds", k) })),
    },
    {
      group: "difficulties",
      label: c.filters.difficulty,
      options: difficultyFilters.map((d) => ({ value: d, label: t.lab.difficulty[d], count: facetCount(labs, filters, "difficulties", d) })),
    },
    ...(member
      ? [
          {
            group: "statuses" as const,
            label: c.filters.status,
            options: statusFilters.map((s) => ({ value: s, label: c.statuses[s], count: facetCount(labs, filters, "statuses", s) })),
          },
        ]
      : []),
  ];

  const tags: Tag[] = groups.flatMap(({ group, options }) =>
    (filters[group] as string[]).flatMap((value) => {
      const option = options.find((o) => o.value === value);
      return option ? [{ group, value, label: option.label, dot: option.dot }] : [];
    }),
  );

  const categoryCount = districts.length;
  const lead = member ? [c.lead, c.leadMobile] : [c.leadVisitor, c.leadVisitorMobile];

  function openSignUp(lab: LabView) {
    setSignUp({ name: lab.name, href: labHref(lab), icon: lab.district.icon, color: lab.district.color });
  }

  return (
    <div className="relative mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pt-6 pb-10 lg:gap-5 lg:px-6 lg:pt-10 lg:pb-[72px]">
      <header className="flex flex-col gap-2.5">
        <h1 className="m-0 font-heading text-[28px] leading-[1.05] font-bold lg:text-[44px]">{c.title}</h1>
        <p className="m-0 max-w-[720px] text-[15px] leading-[1.6] text-fg-2 lg:text-base">
          <span className="lg:hidden">{format(lead[1], { labs: labs.length, categories: categoryCount })}</span>
          <span className="hidden lg:inline">{format(lead[0], { labs: labs.length, categories: categoryCount })}</span>
        </p>
      </header>

      {!member ? (
        <div className="hidden flex-wrap items-center gap-4 rounded-[18px] border border-accent/35 bg-accent/7 px-5 py-4 lg:flex">
          <p className="m-0 flex-[1_1_420px] text-[15px] leading-normal text-fg-2">
            {rich(c.banner, { b: (chunk) => <b className="text-fg">{chunk}</b> })}
          </p>
          <Link
            href={withNext(routes.signUp, routes.labs)}
            className="inline-flex h-11 flex-none items-center rounded-xl bg-accent px-5 text-[15px] font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
          >
            {t.nav.links.signUp}
          </Link>
        </div>
      ) : null}

      {labs.length === 0 ? (
        <EmptyState Icon={FlaskConical} tone="accent" title={c.noLabs.title} className="bg-surface-deep py-8">
          {c.noLabs.text}
        </EmptyState>
      ) : (
        <>
          <div role="search" className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-fg-3" strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value.slice(0, 60) }))}
              aria-label={c.search}
              placeholder={c.searchPlaceholder}
              className="h-[50px] w-full rounded-xl border border-line bg-canvas pr-12 pl-[42px] text-base text-fg placeholder:text-fg-4 focus:border-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {filters.q ? (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, q: "" }))}
                aria-label={c.clearSearch}
                className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-fg-3 hover:bg-card"
              >
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div role="group" aria-label={c.filterGroup} className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
              <span className="mr-1 hidden flex-none items-center gap-1.5 text-sm font-bold text-fg-3 lg:inline-flex">
                <SlidersHorizontal className="size-4" strokeWidth={2} aria-hidden="true" />
                {c.filter}
              </span>
              {groups.map(({ group, label, options }) => (
                <FilterControl
                  key={group}
                  label={label}
                  options={options}
                  selected={filters[group] as string[]}
                  onToggle={(value) => toggle(group, value)}
                  resultCount={results.length}
                />
              ))}
            </div>
            <label className="flex flex-none items-center gap-2 text-sm text-fg-3 lg:ml-auto">
              {c.sort}
              <select
                value={filters.sort}
                onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as CatalogSort }))}
                aria-label={c.sortLabel}
                className="h-11 min-w-0 flex-1 cursor-pointer rounded-xl border border-line bg-canvas px-3 text-[15px] text-fg lg:w-[200px] lg:flex-none"
              >
                {catalogSorts.map((sort) => (
                  <option key={sort} value={sort}>
                    {c.sorts[sort]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {tags.length > 0 ? (
            <div aria-label={c.activeFilters} role="group" className="flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <button
                  key={`${tag.group}:${tag.value}`}
                  type="button"
                  onClick={() => toggle(tag.group, tag.value)}
                  aria-label={format(c.removeFilter, { name: tag.label })}
                  className="inline-flex h-8 cursor-pointer items-center gap-[7px] rounded-full border border-accent bg-accent/10 pr-2 pl-3 font-[inherit] text-[13px] font-bold text-fg"
                >
                  {tag.dot ? <span aria-hidden="true" className={`size-2 rounded-full ${tag.dot}`} /> : null}
                  {tag.label}
                  <X className="size-3.5 text-fg-3" strokeWidth={2} aria-hidden="true" />
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="h-8 cursor-pointer border-0 bg-transparent px-2 font-[inherit] text-[13px] font-bold text-accent-fg">
                {c.clearAll}
              </button>
            </div>
          ) : null}

          <p aria-live="polite" className="m-0 text-sm text-fg-3">
            {format(c.found, { n: results.length })}
          </p>

          {results.length === 0 ? (
            <EmptyState
              Icon={SearchX}
              tone="accent"
              title={c.empty.title}
              className="bg-surface-deep py-8"
              action={
                <button
                  type="button"
                  onClick={() => setFilters(emptyFilters())}
                  className="mt-2 inline-flex h-11 cursor-pointer items-center rounded-xl border-0 bg-accent px-5 font-[inherit] text-sm font-bold text-on-accent"
                >
                  {c.empty.clear}
                </button>
              }
            >
              {c.empty.text}
            </EmptyState>
          ) : (
            <>
              <ul aria-label={c.results} className="m-0 hidden list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0 lg:grid">
                {results.map((lab) => (
                  <li key={lab.slug} className="flex">
                    <LabCard lab={lab} member={member} here={lab.slug === continueSlug} onVisitor={openSignUp} />
                  </li>
                ))}
              </ul>
              <ul aria-label={c.results} className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
                {results.map((lab) => (
                  <li key={lab.slug}>
                    <LabRow lab={lab} member={member} here={lab.slug === continueSlug} onVisitor={openSignUp} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {!member ? (
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-accent/35 bg-accent/7 p-4 lg:hidden">
          <p className="m-0 text-sm leading-normal text-fg-2">{rich(c.banner, { b: (chunk) => <b className="text-fg">{chunk}</b> })}</p>
          <Link
            href={withNext(routes.signUp, routes.labs)}
            className="inline-flex h-12 items-center justify-center rounded-xl bg-accent text-base font-bold text-on-accent no-underline"
          >
            {t.nav.links.signUp}
          </Link>
        </div>
      ) : null}

      <SignUpDialog target={signUp} onClose={() => setSignUp(null)} />
    </div>
  );
}
