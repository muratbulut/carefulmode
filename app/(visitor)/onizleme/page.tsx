import type { Metadata } from "next";
import { PageBackground } from "@/components/background/PageBackground";
import { Accordion } from "@/components/faq/Accordion";
import { renderAnswer } from "@/components/faq/answer";
import { StatusPreview } from "@/components/status/StatusPreview";
import { brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";

const t = getMessages();

export const metadata: Metadata = {
  title: t.pages.preview,
  robots: { index: false, follow: false },
};

/** Ekibin bileşenleri iki temada görmesi için önizleme sayfası. Arama motorlarına kapalı. */
export default function PreviewPage() {
  return (
    <>
      <PageBackground />
      <section className="relative mx-auto flex max-w-[1200px] flex-col gap-7 px-4 pt-7 pb-[72px] lg:px-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-[0.8px] text-fg-4">{t.preview.eyebrow}</span>
          <h1 className="m-0 font-heading text-[28px] font-bold lg:text-4xl">{t.pages.preview}</h1>
          <p className="m-0 max-w-[760px] text-base leading-[1.55] text-fg-3">{t.preview.lead}</p>
        </div>
        <StatusPreview />
        <AccordionPreview />
      </section>
    </>
  );
}

/** SSS ve Öğretmenler için sayfasındaki akordeon; ikinci soru başka gruptan gelir (konu etiketi). */
function AccordionPreview() {
  const f = t.faq;
  const items = [
    { id: "free", topic: undefined },
    { id: "whoSees", topic: { label: f.topics.students.name, tone: "success" as const } },
    { id: "dataStored", topic: { label: f.topics.privacy.name, tone: "warning" as const } },
  ] as const;
  return (
    <section className="flex flex-col gap-3">
      <span className="flex flex-col gap-0.5">
        <h2 className="m-0 text-[15px] font-bold">{f.preview.title}</h2>
        <span className="text-xs text-fg-4">{f.preview.description}</span>
      </span>
      <Accordion
        defaultOpenId="free"
        items={items.map(({ id, topic }) => ({
          id,
          question: format(f.items[id].q, { brand: brand.name }),
          answer: renderAnswer(f.items[id].a),
          topic,
        }))}
      />
    </section>
  );
}
