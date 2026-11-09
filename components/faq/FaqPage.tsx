import { Mail } from "lucide-react";
import type { ReactNode } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { brand } from "@/lib/brand";
import { format, getMessages, rich } from "@/lib/i18n";
import { plainAnswer } from "./answer";
import { faqQuestions, faqTopics } from "./questions";

/**
 * SSS sayfasının statik çerçevesi (4 Kasım, tasarım B): solda başlık, altında konular ve sorular
 * (`children`, istek anında gelir).
 */
export function FaqPage({ children }: { children: ReactNode }) {
  const t = getMessages().faq;
  return (
    <>
      <PageBackground />
      <section className="relative mx-auto flex max-w-[1200px] flex-col gap-6 px-4 pt-[18px] pb-10 lg:gap-8 lg:px-6 lg:pt-12 lg:pb-[88px]">
        <header className="flex flex-col items-start gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/12 px-3 py-1.5 text-[13px] font-bold tracking-[1px] text-accent-light">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            {t.eyebrow}
          </span>
          <h1 className="m-0 font-heading text-[32px] leading-[1.1] font-bold tracking-[-1px] lg:text-[44px]">
            {rich(t.heading, { accent: (chunk) => <span className="text-accent-fg">{chunk}</span> })}
          </h1>
          <p className="m-0 text-[15px] text-fg-2 lg:text-[17px]">{format(t.lead, { total: faqQuestions.length, topics: faqTopics.length })}</p>
        </header>

        {children}
      </section>
      <FaqStructuredData />
    </>
  );
}

/** "Cevabını bulamadın mı?": masaüstünde konuların altında, telefonda sayfanın sonunda. */
export function ContactCard() {
  const t = getMessages().faq.contact;
  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface bg-[radial-gradient(80%_140%_at_0%_0%,color-mix(in_oklab,var(--accent)_12%,transparent),transparent_70%)] p-5 lg:p-[18px]">
      <span className="flex items-center gap-2.5">
        <span className="flex size-9 flex-none items-center justify-center rounded-xl bg-accent/12 text-accent-fg">
          <Mail className="size-[18px]" strokeWidth={2} aria-hidden="true" />
        </span>
        <b className="font-heading text-[17px]">{t.title}</b>
      </span>
      <span className="text-sm leading-normal text-fg-2">{t.text}</span>
      {/* Adres gelince bağlantı (mailto) olacak; şimdilik yasal metinlerle aynı yer tutucu. */}
      <span className="font-mono text-[15px] font-bold break-all text-accent-fg select-all">{t.email}</span>
    </div>
  );
}

/** Arama motorları için soru-cevap listesi (FAQPage). Metinler bizim sözlüğümüzden gelir. */
function FaqStructuredData() {
  const t = getMessages().faq;
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqQuestions.map((q) => ({
      "@type": "Question",
      name: format(t.items[q.id].q, { brand: brand.name }),
      acceptedAnswer: { "@type": "Answer", text: plainAnswer(t.items[q.id].a) },
    })),
  };
  // "<" kaçırılır: metin hiçbir zaman betik etiketini kapatamaz.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
