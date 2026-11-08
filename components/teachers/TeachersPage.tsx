import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Flag, GraduationCap, Lock, Monitor, PenLine, UserRound, type LucideIcon } from "lucide-react";
import { PageBackground } from "@/components/background/PageBackground";
import { Accordion } from "@/components/faq/Accordion";
import { renderAnswer } from "@/components/faq/answer";
import { faqHref } from "@/components/faq/questions";
import { brand } from "@/lib/brand";
import { format, getMessages, rich } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Chalkboard } from "./Chalkboard";
import { LessonTour } from "./LessonTour";
import { RequestLink } from "./RequestLink";

const secondaryClass =
  "inline-flex h-[50px] items-center justify-center rounded-xl border border-line bg-card px-6 text-[17px] font-bold text-fg no-underline transition-colors hover:border-accent lg:h-[52px]";

const sectionHeading = "m-0 font-heading text-[26px] leading-[1.15] font-bold tracking-[-0.5px] lg:text-4xl";

/**
 * Öğretmenler için tanıtım sayfası (Tur 3, ekran 3 = T4 "İki ekran, bir ders"; tahta
 * Ogretmen-Tanitim-Son; 4 Kasım revizesi Tur 8 tuvali). Bilgi verir, bir şey yaptırmaz: kahraman
 * (solda yazı, sağda tahta), kendiliğinden oynayan iki ekran, gizlilik şeridi, veliler için üç
 * güvence, dört adım, kısa SSS ve kapanış.
 */
export function TeachersPage() {
  const t = getMessages().teachersPage;
  return (
    <>
      <PageBackground />
      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-10 px-4 pt-4 pb-10 lg:gap-[72px] lg:px-6 lg:pt-10 lg:pb-[88px]">
        <header className="grid grid-cols-1 items-center gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,580px)] lg:gap-14 lg:pt-6">
          <div className="flex min-w-0 flex-col items-start gap-4 lg:gap-5">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/12 px-3 py-1.5 text-[13px] font-bold tracking-[1px] text-accent-light">
              <span className="size-2 rounded-full bg-success" aria-hidden="true" />
              {t.eyebrow}
            </span>
            <h1 className="m-0 font-heading text-[34px] leading-[1.06] font-bold tracking-[-0.5px] text-balance lg:text-5xl lg:tracking-[-1px]">
              {rich(t.heading, { accent: (chunk) => <span className="text-accent-fg">{chunk}</span> })}
            </h1>
            <p className="m-0 max-w-[600px] text-base leading-[1.6] text-fg-2 lg:text-lg">{t.lead}</p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
              <RequestLink />
              <Link href={routes.labs} className={secondaryClass}>
                {t.tryFirst}
              </Link>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <Chalkboard />
          </div>
        </header>

        <LessonTour />

        <Privacy />

        <Parents />

        <Steps />

        <section aria-labelledby="teachers-faq" className="flex flex-col gap-4 lg:gap-5">
          <h2 id="teachers-faq" className={sectionHeading}>
            {t.faq.heading}
          </h2>
          <Accordion
            defaultOpenId="0"
            headingLevel={3}
            items={t.faq.items.map((item, i) => ({
              id: String(i),
              question: format(item.q, { brand: brand.name }),
              answer: renderAnswer(item.a),
            }))}
          />
          <Link
            href={faqHref("teachers")}
            className="-my-2 inline-flex min-h-10 items-center gap-1.5 self-start text-[15px] font-bold text-accent-fg no-underline hover:underline"
          >
            {t.faq.more}
            <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </section>

        <section className="flex flex-col items-stretch gap-[18px] rounded-3xl border border-line bg-surface bg-[radial-gradient(60%_120%_at_50%_0%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_70%)] p-6 text-center lg:items-center lg:p-12">
          <h2 className="m-0 font-heading text-[26px] leading-[1.15] font-bold lg:text-4xl">{t.closing.heading}</h2>
          <p className="m-0 text-[15px] text-fg-2 lg:text-[17px]">{t.closing.text}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <RequestLink />
            <Link href={routes.roadmap} className={secondaryClass}>
              {t.studentView}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

/** Gizlilik 2 (tek şerit, 4 Kasım): kilit, tek cümle ve dört etiket. */
function Privacy() {
  const t = getMessages().teachersPage.privacy;
  return (
    <section aria-labelledby="teachers-privacy" className="flex flex-col items-start gap-4 rounded-[18px] border border-line bg-surface p-5 sm:flex-row sm:gap-[22px] lg:px-7 lg:py-6">
      <span className="flex size-[52px] flex-none items-center justify-center rounded-2xl bg-success/16 text-success-fg lg:size-[58px]">
        <Lock className="size-6 lg:size-7" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 id="teachers-privacy" className="m-0 font-heading text-[19px] leading-[1.25] font-bold lg:text-[21px]">
          {t.heading}
        </h2>
        <p className="m-0 text-[15px] leading-normal text-fg-2">{t.lead}</p>
        <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-2 p-0">
          {t.see.map((item) => (
            <li key={item} className="inline-flex min-h-[30px] items-center rounded-full bg-success/14 px-[11px] text-[13px] font-bold text-success-fg">
              {item}
            </li>
          ))}
          {t.notSee.map((item) => (
            <li key={item} className="inline-flex min-h-[30px] items-center rounded-full bg-danger/14 px-[11px] text-[13px] font-bold text-danger-fg">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const parentCards: { Icon: LucideIcon; box: string }[] = [
  { Icon: ArrowUpRight, box: "bg-accent/16 text-accent-fg" },
  { Icon: PenLine, box: "bg-purple/18 text-purple-fg" },
  { Icon: Check, box: "bg-success/16 text-success-fg" },
];

/** Veliler A (4 Kasım): üç güvence kartı. Öğretmen velilere bu sayfayı gösterebilir. */
function Parents() {
  const t = getMessages().teachersPage.parents;
  return (
    <section aria-labelledby="teachers-parents" className="flex flex-col gap-5 lg:gap-7">
      <div className="flex max-w-[760px] flex-col items-start gap-3">
        <span className="inline-flex h-7 items-center rounded-full bg-pink/14 px-3 text-xs font-bold tracking-[1px] text-pink-fg">{t.eyebrow}</span>
        <h2 id="teachers-parents" className={sectionHeading}>
          {t.heading}
        </h2>
        <p className="m-0 text-[15px] leading-[1.6] text-fg-2 lg:text-base">{t.lead}</p>
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-3 lg:gap-[18px]">
        {t.cards.map((card, i) => {
          const { Icon, box } = parentCards[i];
          return (
            <li key={card.title} className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-5 lg:px-[22px] lg:pt-[22px] lg:pb-6">
              <span className={cn("flex size-11 items-center justify-center rounded-xl", box)}>
                <Icon className="size-5" strokeWidth={2.2} aria-hidden="true" />
              </span>
              <h3 className="m-0 font-heading text-lg leading-[1.3] font-bold">{card.title}</h3>
              <p className="m-0 text-sm leading-[1.55] text-fg-2">{card.text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const stepIcons: LucideIcon[] = [UserRound, GraduationCap, Monitor, Flag];

function Steps() {
  const t = getMessages().teachersPage.steps;
  return (
    <section aria-labelledby="teachers-steps" className="flex flex-col gap-4 lg:gap-5">
      <h2 id="teachers-steps" className={sectionHeading}>
        {t.heading}
      </h2>
      <ol className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {t.items.map((item, i) => {
          const Icon = stepIcons[i];
          return (
            <li key={item.title} className="flex flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-4 lg:p-[22px]">
              <span className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent/12 text-accent-fg">
                  <Icon className="size-[22px]" strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="font-mono text-[13px] font-bold text-line-strong" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </span>
              <h3 className="m-0 text-[17px] font-bold">{item.title}</h3>
              <p className="m-0 text-sm leading-[1.55] text-fg-3">{item.text}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
