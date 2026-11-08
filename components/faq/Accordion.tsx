"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AccordionTone = "accent" | "success" | "purple" | "warning";

export type AccordionItem = {
  id: string;
  question: ReactNode;
  answer: ReactNode;
  /** Sorunun üstündeki küçük konu etiketi (SSS'de başka gruptan gelen sorularda). */
  topic?: { label: string; tone: AccordionTone };
};

const toneText: Record<AccordionTone, string> = {
  accent: "text-accent-fg",
  success: "text-success-fg",
  purple: "text-purple-fg",
  warning: "text-warning-fg",
};

const toneDot: Record<AccordionTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  purple: "bg-purple",
  warning: "bg-warning",
};

type Props = {
  items: AccordionItem[];
  /** Açık sorunun kimliği. Verilirse akordeon dışarıdan yönetilir (SSS'de bütün listeler tek açık soru paylaşır). */
  openId?: string | null;
  /** Kendi başına çalışırken ilk açık gelen soru. */
  defaultOpenId?: string | null;
  onOpenChange?: (id: string | null) => void;
  /** Soruların başlık düzeyi; sayfadaki başlık sırasına göre verilir. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/**
 * Soru-cevap akordeonu (SSS-Son, Ogretmen-Tanitim-Son). Her soru bir başlığın içinde düğmedir
 * (aria-expanded, aria-controls); aynı anda bir cevap açık kalır. Cevaplar sayfada hep durur,
 * kapalıyken gizlidir; tarayıcıda JavaScript kapalıysa hepsi açık görünür.
 */
export function Accordion({ items, openId, defaultOpenId = null, onOpenChange, headingLevel = 3, className }: Props) {
  const [ownOpenId, setOwnOpenId] = useState<string | null>(defaultOpenId);
  const current = openId !== undefined ? openId : ownOpenId;
  const baseId = useId();
  const Heading = `h${headingLevel}` as const;

  function toggle(id: string) {
    const next = current === id ? null : id;
    if (openId === undefined) setOwnOpenId(next);
    onOpenChange?.(next);
  }

  return (
    <div className={cn("rounded-[20px] border border-line bg-surface px-3.5 py-1 lg:px-6", className)}>
      {items.map((item) => {
        const open = current === item.id;
        const buttonId = `${baseId}-${item.id}-q`;
        const panelId = `${baseId}-${item.id}-a`;
        return (
          <div key={item.id} data-faq-item={item.id} className="border-b border-card last:border-b-0">
            <Heading className="m-0 text-[15px] font-bold lg:text-[17px]">
              <button
                type="button"
                id={buttonId}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="group flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-1 py-3.5 text-left font-[inherit] text-fg lg:py-[18px]"
              >
                <span className="flex flex-col gap-1">
                  {item.topic ? (
                    <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold", toneText[item.topic.tone])}>
                      <span className={cn("size-[7px] rounded-full", toneDot[item.topic.tone])} aria-hidden="true" />
                      {item.topic.label}
                    </span>
                  ) : null}
                  <span className="leading-[1.4] transition-colors group-hover:text-accent-fg">{item.question}</span>
                </span>
                <ChevronDown
                  className={cn("size-[18px] flex-none text-fg-3 transition-transform duration-250", open && "rotate-180")}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            </Heading>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn(open ? "block animate-[fade-up_0.2s_ease-out_both]" : "hidden noscript:block")}
            >
              <p className="m-0 max-w-[760px] px-1 pb-[18px] text-sm leading-[1.65] text-fg-2 lg:text-base">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
