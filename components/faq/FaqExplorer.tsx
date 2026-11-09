"use client";

import { Check, ChevronDown, Link2, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { brand } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { plainAnswer, renderAnswer } from "./answer";
import {
  faqHref,
  faqQuestions,
  faqTopics,
  normalizeQuery,
  questionBySlug,
  questionsOf,
  type FaqQuestion,
  type FaqQuestionId,
  type FaqTopic,
} from "./questions";

const t = getMessages().faq;

/** Konuların rengi (tuvaldeki gibi: Genel camgöbeği, Odalar pembe, Öğrenciler yeşil, Öğretmenler mor, Gizlilik sarı). */
const topicTone: Record<FaqTopic, { dot: string; text: string; ring: string; chip: string }> = {
  general: { dot: "bg-accent", text: "text-accent-fg", ring: "lg:border-accent lg:bg-accent/12", chip: "max-lg:border-accent max-lg:bg-accent max-lg:text-on-accent" },
  rooms: { dot: "bg-pink", text: "text-pink-fg", ring: "lg:border-pink lg:bg-pink/12", chip: "max-lg:border-pink max-lg:bg-pink max-lg:text-on-accent" },
  students: { dot: "bg-success", text: "text-success-fg", ring: "lg:border-success lg:bg-success/12", chip: "max-lg:border-success max-lg:bg-success max-lg:text-on-accent" },
  teachers: { dot: "bg-purple", text: "text-purple-fg", ring: "lg:border-purple lg:bg-purple/12", chip: "max-lg:border-purple max-lg:bg-purple max-lg:text-on-accent" },
  privacy: { dot: "bg-warning", text: "text-warning-fg", ring: "lg:border-warning lg:bg-warning/12", chip: "max-lg:border-warning max-lg:bg-warning max-lg:text-on-warning" },
};

const questionText = (id: FaqQuestionId) => format(t.items[id].q, { brand: brand.name });

/** Aramada bakılan metin: soru ve etiketsiz cevap, Türkçe küçük harfle. */
const searchIndex = faqQuestions.map((q) => ({ q, text: normalizeQuery(`${questionText(q.id)} ${plainAnswer(t.items[q.id].a)}`) }));

export function searchFaq(query: string): FaqQuestion[] {
  const needle = normalizeQuery(query);
  if (!needle) return [];
  return searchIndex.filter((entry) => entry.text.includes(needle)).map((entry) => entry.q);
}

type Props = {
  initialTopic: FaqTopic;
  /** "Cevabını bulamadın mı?" kutusu: masaüstünde soldaki sütunda, telefonda en altta. */
  contact: ReactNode;
  noScriptList?: boolean;
};

/**
 * SSS'nin konu ve soru bölümü (4 Kasım, tasarım B "Yanda konular"). Masaüstünde solda arama, beş
 * konu (her birinin soru sayısıyla) ve iletişim kutusu; sağda açık konunun soruları. Telefonda
 * konular yana kaydırılan bir şerit. Aynı anda bir konu ve bir cevap açık; arama bütün konularda
 * arar. Açık konu adrese yazılır (/sss?konu=odalar), her sorunun kendi bağlantısı var (/sss#arayan-kim).
 */
export function FaqExplorer({ initialTopic, contact, noScriptList = false }: Props) {
  const [topic, setTopic] = useState<FaqTopic>(initialTopic);
  const [openId, setOpenId] = useState<FaqQuestionId | null>(null);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<{ id: FaqQuestionId; ok: boolean } | null>(null);
  const baseId = useId();
  const headingId = `${baseId}-heading`;

  // Sorunun bağlantısıyla gelince (#slug) konusu ve cevabı açılır, soru ekrana kayar.
  useEffect(() => {
    function openFromHash() {
      const question = questionBySlug(decodeURIComponent(window.location.hash.slice(1)));
      if (!question) return;
      setQuery("");
      setTopic(question.topic);
      setOpenId(question.id);
      requestAnimationFrame(() => document.getElementById(question.slug)?.scrollIntoView({ block: "start" }));
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const hits = useMemo(() => searchFaq(query), [query]);
  const searching = normalizeQuery(query) !== "";
  const shown = searching ? hits : questionsOf(topic);

  function pickTopic(next: FaqTopic) {
    setTopic(next);
    setQuery("");
    setOpenId(null);
    window.history.replaceState(null, "", faqHref(next));
  }

  async function copyLink(question: FaqQuestion) {
    const url = `${window.location.origin}${faqHref(null)}#${question.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied({ id: question.id, ok: true });
    } catch {
      setCopied({ id: question.id, ok: false });
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-[18px] [grid-template-areas:'search'_'topics'_'main'_'contact'] lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-8 lg:gap-y-4 lg:[grid-template-areas:'search_main'_'topics_main'_'contact_main']">
      <div className="relative [grid-area:search] noscript:hidden">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-4" strokeWidth={2.2} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpenId(null);
          }}
          placeholder={t.search.placeholder}
          aria-label={t.search.label}
          className="h-[50px] w-full rounded-[14px] border border-line bg-surface pr-12 pl-[46px] font-[inherit] text-base text-fg placeholder:text-fg-4 focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={t.search.clear}
            className="absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-fg-3 hover:bg-card hover:text-fg"
          >
            <X className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav aria-label={t.topicsLabel} className="min-w-0 [grid-area:topics] noscript:hidden">
        <ul className="-mx-4 flex list-none gap-2 overflow-x-auto px-4 pt-0.5 pb-1.5 lg:m-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-[18px] lg:border lg:border-line lg:bg-surface lg:p-2">
          {faqTopics.map((key) => {
            const on = !searching && topic === key;
            const tone = topicTone[key];
            const info = t.topics[key];
            return (
              <li key={key} className="flex-none">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickTopic(key)}
                  className={cn(
                    "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-full border px-3.5 text-left font-[inherit] text-sm font-bold text-fg transition-colors lg:min-h-11 lg:gap-3 lg:rounded-xl lg:px-3.5 lg:py-3",
                    on ? cn(tone.ring, tone.chip) : "border-line bg-surface hover:border-line-strong lg:border-transparent lg:bg-transparent lg:hover:border-transparent lg:hover:bg-card",
                  )}
                >
                  <span aria-hidden="true" className={cn("size-2 flex-none rounded-full lg:size-2.5", tone.dot, on && "max-lg:bg-on-accent/70")} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="whitespace-nowrap lg:text-[15px]">{info.name}</span>
                    <span className="hidden text-xs font-normal text-fg-3 lg:block">{format(info.hint, { brand: brand.name })}</span>
                  </span>
                  <span className="hidden h-6 min-w-[26px] flex-none items-center justify-center rounded-full bg-surface-deep px-1.5 text-xs text-fg-3 lg:flex">
                    <span aria-hidden="true">{questionsOf(key).length}</span>
                    <span className="sr-only">{format(t.count, { n: questionsOf(key).length })}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2.5 [grid-area:main] noscript:hidden">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-0.5 py-1">
          <span aria-hidden="true" className={cn("size-[9px] flex-none self-center rounded-full", searching ? "bg-fg-4" : topicTone[topic].dot)} />
          <h2 id={headingId} className="m-0 font-heading text-lg font-bold lg:text-xl">
            {searching ? format(t.search.results, { query: query.trim(), n: hits.length }) : t.topics[topic].name}
          </h2>
          <span className="text-[13px] text-fg-3">{searching ? t.search.resultsHint : format(t.topics[topic].hint, { brand: brand.name })}</span>
        </div>
        {shown.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {shown.map((question) => (
              <QuestionRow
                key={question.id}
                question={question}
                open={openId === question.id}
                onToggle={() => setOpenId(openId === question.id ? null : question.id)}
                copied={copied?.id === question.id ? copied.ok : null}
                onCopy={() => copyLink(question)}
                showTopic={searching}
              />
            ))}
          </ul>
        ) : (
          <p className="m-0 rounded-2xl border border-dashed border-line-strong p-6 text-center text-[15px] leading-relaxed text-fg-3">{t.search.empty}</p>
        )}
      </section>

      <div className="[grid-area:contact]">{contact}</div>

      {/* JavaScript kapalıysa konu seçimi çalışmaz: bütün sorular konu konu, cevaplarıyla açık görünür. */}
      {noScriptList ? (
        <div className="hidden flex-col gap-7 [grid-area:main] noscript:flex">
          {faqTopics.map((key) => (
            <section key={key} className="flex flex-col gap-2.5">
              <h2 className="m-0 font-heading text-[22px] font-bold">{t.topics[key].name}</h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {questionsOf(key).map((question) => (
                  <QuestionRow key={question.id} question={question} open onToggle={() => {}} copied={null} onCopy={() => {}} showTopic={false} idPrefix="tum-" />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type RowProps = {
  question: FaqQuestion;
  open: boolean;
  onToggle: () => void;
  /** Bağlantı kopyalandı mı (true), kopyalanamadı mı (false), yoksa hiç basılmadı mı (null). */
  copied: boolean | null;
  onCopy: () => void;
  /** Arama sonuçlarında sorunun konusu da yazar. */
  showTopic: boolean;
  /** JavaScript kapalıyken çizilen tam listede kimlikler çakışmasın diye. */
  idPrefix?: string;
};

/** Tek soru: başlığın içinde düğme (aria-expanded), altında cevap, konu etiketi ve bağlantı kopyalama. */
function QuestionRow({ question, open, onToggle, copied, onCopy, showTopic, idPrefix = "" }: RowProps) {
  const tone = topicTone[question.topic];
  const buttonId = `${idPrefix}soru-${question.slug}`;
  const panelId = `${idPrefix}cevap-${question.slug}`;
  return (
    <li
      id={idPrefix + question.slug}
      data-faq-item={question.id}
      className={cn("scroll-mt-24 overflow-hidden rounded-[14px] border transition-colors", open ? "border-line-strong bg-card" : "border-line bg-surface")}
    >
      <h3 className="m-0 text-[15px] font-semibold lg:text-base">
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="group flex min-h-[54px] w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-4 py-3.5 text-left font-[inherit] text-fg lg:px-[18px]"
        >
          <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", tone.dot)} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {showTopic ? <span className={cn("text-xs font-bold", tone.text)}>{t.topics[question.topic].name}</span> : null}
            <span className="leading-[1.35] transition-colors group-hover:text-accent-fg">{questionText(question.id)}</span>
          </span>
          {question.isNew ? <span className="flex-none rounded-full bg-pink/16 px-[9px] py-[3px] text-[11px] font-bold tracking-[0.6px] text-pink-fg">{t.new}</span> : null}
          <ChevronDown className={cn("size-[18px] flex-none text-fg-3 transition-transform duration-200", open && "rotate-180")} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={buttonId} className={cn(open ? "flex animate-[fade-up_0.2s_ease-out_both]" : "hidden noscript:flex", "flex-col gap-3 px-4 pb-[18px] lg:pr-[18px] lg:pl-[38px]")}>
        <p className="m-0 max-w-[760px] text-[15px] leading-[1.65] text-fg-2">{renderAnswer(t.items[question.id].a)}</p>
        <div className="flex flex-wrap items-center gap-2 noscript:hidden">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-deep px-2.5 text-xs font-bold text-fg-3">
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone.dot)} />
            {t.topics[question.topic].name}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[10px] border-0 bg-transparent px-3 font-[inherit] text-[13px] font-bold text-accent-fg hover:bg-accent/10"
          >
            {copied ? <Check className="size-[15px]" strokeWidth={2.4} aria-hidden="true" /> : <Link2 className="size-[15px]" strokeWidth={2.2} aria-hidden="true" />}
            <span aria-live="polite">{copied === true ? t.copied : copied === false ? t.copyFailed : t.copyLink}</span>
          </button>
        </div>
      </div>
    </li>
  );
}
