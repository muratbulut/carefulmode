import type { Metadata } from "next";
import Link from "next/link";
import { PageBackground } from "@/components/background/PageBackground";
import { brand } from "@/lib/brand";
import { getLegalDocument, legalDocumentKeys, type LegalDocumentKey } from "@/lib/content/legal";
import { format, getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { LegalSections } from "./LegalSections";
import { PrintButtons } from "./PrintButtons";

/**
 * Yasal sayfaların ortak şablonu (Tur 5, Y2 "Kısaca + tam metin"): üstte üç belge,
 * TASLAK etiketi ve tarih, başlık, yazdır / PDF, taslak notu ve bölümler.
 */
export function LegalPage({ doc }: { doc: LegalDocumentKey }) {
  const t = getMessages();
  const content = getLegalDocument(doc);
  const sections = content.sections.map((section) => ({
    title: format(section.title, { brand: brand.name }),
    short: format(section.short, { brand: brand.name }),
    full: format(section.full, { brand: brand.name }),
  }));

  return (
    <>
      <div className="print:hidden">
        <PageBackground />
      </div>
      <section className="relative mx-auto flex max-w-[1200px] flex-col gap-[18px] px-4 pt-[18px] pb-8 md:gap-6 md:px-6 md:pt-9 md:pb-[72px]">
        <nav aria-label={t.legal.documents} className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line print:hidden">
          {legalDocumentKeys.map((key) => {
            const active = key === doc;
            return (
              <Link
                key={key}
                href={routes[key]}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-11 flex-none items-center border-b-2 px-3 text-[15px] font-bold whitespace-nowrap no-underline transition-colors md:px-4",
                  active ? "border-accent text-fg" : "border-transparent text-fg-3 hover:text-fg",
                )}
              >
                <span className="md:hidden">{t.legal.tabs[key]}</span>
                <span className="hidden md:inline">{t.pages[key]}</span>
              </Link>
            );
          })}
        </nav>

        <article className="flex max-w-[1080px] flex-col gap-[18px] md:gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3.5">
            <div className="flex flex-col gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full bg-warning/14 px-[9px] text-[11px] font-extrabold tracking-[1px] text-warning-fg">
                  {t.legal.draft}
                </span>
                <span className="text-[13px] text-fg-4">{format(t.legal.updated, { date: content.updated, version: content.version })}</span>
              </span>
              <h1 className="m-0 font-heading text-[28px] leading-[1.1] font-bold md:text-[40px]">{t.pages[doc]}</h1>
            </div>
            <PrintButtons />
          </div>

          <p className="m-0 rounded-xl border border-card bg-surface-deep px-3.5 py-3 text-[13px] leading-normal text-fg-3">{t.legal.draftNotice}</p>

          <LegalSections sections={sections} />
        </article>
      </section>
    </>
  );
}

export function legalMetadata(doc: LegalDocumentKey): Metadata {
  const t = getMessages();
  return {
    title: t.pages[doc],
    // Metinler taslak; hukuki kontrolden geçene kadar arama motorlarına kapalı.
    robots: { index: false, follow: true },
  };
}
