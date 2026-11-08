"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { SwitchTrack } from "@/components/common/SwitchTrack";
import type { LegalSection } from "@/lib/content/legal";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Masaüstünde "Kısaca" solda, tam metin sağda; başlık satırı da aynı ızgarayı kullanır.
const grid = "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] md:gap-8";

/**
 * Belgenin bölümleri ve "Sadece kısaca oku" düğmesi. Masaüstünde tam metin "Kısaca"nın
 * yanında durur; telefonda her bölümde "Tam metin" ile açılır. Yazdırırken tam metin hep görünür.
 */
export function LegalSections({ sections }: { sections: LegalSection[] }) {
  const t = getMessages().legal;
  const id = useId();
  const [shortOnly, setShortOnly] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());

  function toggleSection(index: number) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-[18px] md:gap-4">
      <div className={cn("flex items-center py-1", grid, "md:items-center")}>
        <span aria-hidden="true" className="hidden text-xs font-bold tracking-[0.8px] text-fg-4 md:block">
          {t.short}
        </span>
        <div className="flex flex-1 items-center justify-between gap-4">
          <span aria-hidden="true" className={cn("hidden text-xs font-bold tracking-[0.8px] text-fg-4 md:pl-6", !shortOnly && "md:block")}>
            {t.full}
          </span>
          {/* Dokunma alanı 40 px; eksi kenar boşluğu satırın yüksekliğini değiştirmez. */}
          <button
            type="button"
            role="switch"
            aria-checked={shortOnly}
            onClick={() => setShortOnly((value) => !value)}
            className="-my-1.5 inline-flex min-h-10 cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 font-[inherit] text-sm font-bold text-fg md:ml-auto print:hidden"
          >
            <SwitchTrack on={shortOnly} />
            {t.shortOnly}
          </button>
        </div>
      </div>

      <div className="flex flex-col">
        {sections.map((section, index) => {
          const headingId = `${id}-heading-${index}`;
          const fullId = `${id}-full-${index}`;
          const expanded = open.has(index);
          return (
            <section
              key={section.title}
              aria-labelledby={headingId}
              className={cn("flex flex-col gap-2.5 border-t border-card py-4 md:items-start md:py-[22px]", grid)}
            >
              <div className="flex flex-col gap-2.5">
                <span aria-hidden="true" className="hidden text-xs font-bold tracking-[0.8px] text-fg-4 md:block">
                  {index + 1}
                </span>
                <h2 id={headingId} className="m-0 font-heading text-lg font-bold md:text-[22px]">
                  <span className="md:hidden">{format(t.number, { n: index + 1 })}</span>
                  {section.title}
                </h2>
                <p className="m-0 flex items-start gap-2.5 rounded-[14px] border border-accent/28 bg-accent/7 px-3.5 py-3 md:block md:rounded-none md:border-0 md:bg-transparent md:p-0">
                  <span className="mt-px flex-none text-[11px] font-extrabold tracking-[1px] text-accent-light md:sr-only">{t.short}</span>
                  <span className="text-[15px] leading-normal text-fg md:text-[17px] md:leading-[1.55]">{section.short}</span>
                </p>
                {shortOnly ? null : (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={fullId}
                    onClick={() => toggleSection(index)}
                    className="-my-2.5 inline-flex min-h-10 cursor-pointer items-center gap-1.5 self-start border-0 bg-transparent p-0 font-[inherit] text-[13px] font-bold text-fg-3 md:hidden print:hidden"
                  >
                    {t.fullText}
                    <ChevronDown
                      className={cn("size-3.5 transition-transform duration-200", expanded && "rotate-180")}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
              <p
                id={fullId}
                className={cn(
                  "m-0 text-sm leading-[1.7] text-fg-2 md:border-l md:border-line md:pl-6 md:leading-[1.75] md:text-fg-3 print:block",
                  shortOnly ? "hidden" : expanded ? "block [animation:fade-up_.2s_ease-out_both]" : "hidden md:block",
                )}
              >
                {section.full}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
