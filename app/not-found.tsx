import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Mail, Map as MapIcon, Newspaper, type LucideIcon } from "lucide-react";
import { PageBackground } from "@/components/background/PageBackground";
import { VisitorShell } from "@/components/visitor/VisitorShell";
import { getMessages } from "@/lib/i18n";
import { routes, type HintKey } from "@/lib/navigation";

const t = getMessages();

export const metadata: Metadata = { title: t.pages.notFound };

const suggestions: { key: HintKey; Icon: LucideIcon }[] = [
  { key: "roadmap", Icon: MapIcon },
  { key: "labs", Icon: Mail },
  { key: "news", Icon: Newspaper },
];

/** 404 (Tur 5, D1 sade): büyük 404, kısa açıklama, iki düğme ve üç yol önerisi. */
export default function NotFound() {
  return (
    <VisitorShell background={<PageBackground />}>
      <section className="relative mx-auto max-w-[1200px] px-4 pt-7 pb-[72px] lg:px-6">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col items-center gap-5 pt-12 pb-8 text-center md:pt-[70px] md:pb-10">
            <span
              aria-hidden="true"
              className="bg-[linear-gradient(180deg,var(--fg),var(--line-strong))] bg-clip-text font-heading text-[120px] leading-[0.9] font-bold tracking-[-4px] text-transparent md:text-[160px]"
            >
              404
            </span>
            <h1 className="m-0 font-heading text-[28px] font-bold md:text-4xl">{t.notFound.heading}</h1>
            <p className="m-0 max-w-[520px] text-base leading-[1.55] text-fg-2 md:text-[17px]">
              {t.notFound.text}
            </p>
            <div className="flex w-full flex-col justify-center gap-2.5 sm:w-auto sm:flex-row">
              <Link
                href={routes.home}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-5 text-[15px] font-bold text-on-accent no-underline"
              >
                {t.notFound.home}
              </Link>
              <Link
                href={routes.labs}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-[18px] text-[15px] font-bold text-fg no-underline"
              >
                {t.notFound.labs}
              </Link>
            </div>
          </div>
          <nav aria-label={t.notFound.suggestions} className="mx-auto flex w-full max-w-[900px] flex-col gap-2.5 md:flex-row">
            {suggestions.map(({ key, Icon }) => (
              <Link
                key={key}
                href={routes[key]}
                className="flex flex-1 items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-fg no-underline transition-colors hover:border-accent"
              >
                <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-card">
                  <Icon className="size-5 text-accent-fg" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <b className="text-[15px]">{t.nav.links[key]}</b>
                  <span className="text-xs text-fg-3">{t.nav.hints[key]}</span>
                </span>
                <ChevronRight className="size-4 text-fg-4 md:hidden" strokeWidth={2} aria-hidden="true" />
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </VisitorShell>
  );
}
