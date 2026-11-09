"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, CalendarX2, CircleCheck, ExternalLink, Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ArticleViewData } from "@/components/news/ArticleView";
import { Dialog } from "@/components/profile/Dialog";
import { Spinner } from "@/components/status/Spinner";
import { brand } from "@/lib/brand";
import { format, getMessages, rich } from "@/lib/i18n";
import { roomArtOf } from "@/lib/lab/art";
import { labHref } from "@/lib/lab/route";
import {
  saveArticleDraft,
  saveLiveArticle,
  scheduleArticle,
  undoSchedule,
  undoUnschedule,
  unscheduleArticle,
  type ArticleInput,
  type NewsActionError,
} from "@/lib/news/actions";
import {
  checkSourceUrl,
  linesOf,
  newsLimits,
  readiness,
  readingMinutes,
  trustedDomains,
  type ArticleContent,
  type ArticleState,
  type ReadinessKey,
  type Sign,
} from "@/lib/news/content";
import type { EditorArticle, EditorOptions } from "@/lib/news/data";
import { paths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { inputClass } from "../editor/fields";
import { nextToast, UndoToast, type ToastData } from "../UndoToast";
import { ArticlePreview } from "./ArticlePreview";
import { CoverField, type CoverMeta, type SavedCover } from "./CoverField";
import { stateBadge, tabParams } from "./shared";

/** Formun tarayıcıdaki hali. Seçilmemiş konu, lab ve hafta boş metindir. */
type Form = {
  title: string;
  summary: string;
  whatsHappening: string;
  exampleSender: string;
  exampleText: string;
  signs: Sign[];
  /** "Ne yapmalısın?": her satır bir madde. */
  actionsText: string;
  takeaways: string[];
  neighborhoodId: string;
  relatedLabId: string;
  sourceName: string;
  sourceUrl: string;
  week: string;
  /** Kapağın odak noktası, alt metni ve kaynağı (görselin kendisi hemen yüklenir, formda değil). */
  cover: CoverMeta;
};

/** Sunucudaki hal: kimlik (ilk kayıttan sonra), durum ve yayın haftası. */
type Saved = { id: string | null; state: ArticleState; week: string | null };

function formOf(article: EditorArticle | null): Form {
  const c = article?.content;
  return {
    title: article?.title ?? "",
    summary: article?.summary ?? "",
    whatsHappening: c?.whatsHappening ?? "",
    exampleSender: c?.example?.sender ?? "",
    exampleText: c?.example?.text ?? "",
    signs: c?.signs.map((s) => ({ ...s })) ?? Array.from({ length: 3 }, () => ({ sign: "", explanation: "" })),
    actionsText: c?.actions.join("\n") ?? "",
    takeaways: c?.takeaways.slice() ?? ["", "", ""],
    neighborhoodId: article?.neighborhoodId ?? "",
    relatedLabId: article?.relatedLabId ?? "",
    sourceName: article?.sourceName ?? "",
    sourceUrl: article?.sourceUrl ?? "",
    week: article?.week ?? "",
    cover: {
      focusX: article?.coverFocusX ?? 50,
      focusY: article?.coverFocusY ?? 50,
      alt: article?.coverAlt ?? "",
      credit: article?.coverCredit ?? "",
    },
  };
}

function contentOf(form: Form): ArticleContent {
  return {
    whatsHappening: form.whatsHappening,
    example: form.exampleSender.trim() || form.exampleText.trim() ? { sender: form.exampleSender, text: form.exampleText } : null,
    signs: form.signs,
    actions: linesOf(form.actionsText),
    takeaways: form.takeaways,
  };
}

function inputOf(form: Form, id: string | null): ArticleInput {
  return {
    id,
    title: form.title,
    summary: form.summary,
    content: contentOf(form),
    neighborhoodId: form.neighborhoodId || null,
    relatedLabId: form.relatedLabId || null,
    sourceName: form.sourceName,
    sourceUrl: form.sourceUrl,
    week: form.week || null,
    cover: form.cover,
  };
}

/**
 * Kaydedilmemiş değişiklik denetimi için formun izi. Yayın haftası sayılmaz: taslakta hafta
 * kaydedilmez, yalnızca "Planla" ile kullanılır.
 */
const snapshot = (form: Form) => JSON.stringify({ ...form, week: "" });

/**
 * Gündem düzenleyicisi (Gundem-Son, E1): tam sayfa form, sağda "Yayına hazır mı?" ve üç düğme:
 * Taslak kaydet / Önizle / Planla. Taslak eksikle kaydedilir; planlamak için zorunlu maddeler ve
 * yayın haftası gerekir. Önizleme öğrencinin haber sayfasını tam ekran açar (Gundem-Son-Onizleme).
 * Telefonda liste formun altına iner. Her işlemden sonra 5 saniyelik "Geri al".
 */
export function ArticleEditor({ article, options }: { article: EditorArticle | null; options: EditorOptions }) {
  const t = getMessages();
  const n = t.news.admin;
  const e = n.editor;
  const router = useRouter();
  const titleRef = useRef<HTMLInputElement>(null);
  const sourceStatusId = useId();
  const leaving = useRef(false);

  const [form, setForm] = useState<Form>(() => formOf(article));
  const [saved, setSaved] = useState(() => snapshot(formOf(article)));
  const [server, setServer] = useState<Saved>({ id: article?.id ?? null, state: article?.state ?? "draft", week: article?.week ?? null });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "plan" | "unschedule">(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cover, setCover] = useState<SavedCover | null>(article?.cover ?? null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const live = server.state === "live";
  const dirty = snapshot(form) !== saved;
  const neighborhood = options.neighborhoods.find((x) => x.id === form.neighborhoodId) ?? null;
  const lab = neighborhood?.labs.find((l) => l.id === form.relatedLabId) ?? null;
  const content = contentOf(form);
  const actionLines = content.actions;
  const actionsError =
    actionLines.length > newsLimits.actions
      ? format(e.actionsTooMany, { n: newsLimits.actions })
      : actionLines.some((line) => line.length > newsLimits.action)
        ? format(e.actionTooLong, { n: newsLimits.action })
        : null;
  const week = live ? server.week : form.week || null;
  const check = readiness({
    title: form.title,
    summary: form.summary,
    content,
    neighborhoodId: form.neighborhoodId || null,
    relatedLabId: lab?.published ? lab.id : null,
    sourceName: form.sourceName,
    sourceUrl: form.sourceUrl,
    week,
  });
  const weekInfo = options.weeks.find((w) => w.key === week) ?? null;
  const weekDay = weekInfo?.day ?? (live ? (article?.weekLabel?.day ?? null) : null);
  const weekDate = weekInfo?.date ?? (live ? (article?.weekLabel?.date ?? null) : null);
  const takenBy = !live && weekInfo?.takenBy && weekInfo.takenBy.id !== server.id ? weekInfo.takenBy : null;
  const planOk = check.ready && !actionsError && busy === null;
  const planLabel = live ? e.publishChanges : weekDay ? format(e.planFor, { date: weekDay }) : e.plan;
  const source = checkSourceUrl(form.sourceUrl);

  const hint = live
    ? check.ready
      ? e.hints.live
      : e.hints.liveNotReady
    : !check.contentReady
      ? e.hints.notReady
      : !form.week
        ? e.hints.noWeek
        : takenBy
          ? e.hints.bump
          : server.state === "scheduled" && form.week === server.week && weekDay
            ? format(e.hints.scheduled, { date: weekDay })
            : e.hints.ready;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const say = (message: string, undo?: () => void) => setToast(nextToast({ message, undo }));
  const fail = (error: NewsActionError) => setToast(nextToast({ message: n.errors[error], tone: "error" }));

  /** İlk kayıtta adres /yonetim/gundem/yeni yerine haberin kendi adresi olur (sayfa yenilenmez). */
  function adopt(id: string) {
    if (server.id === id) return;
    window.history.replaceState(null, "", paths.adminArticle(id));
  }

  function run(kind: "draft" | "plan" | "unschedule", task: () => Promise<void>) {
    setBusy(kind);
    startTransition(async () => {
      try {
        await task();
      } catch {
        fail("failed");
      } finally {
        setBusy(null);
      }
    });
  }

  /** Geri alınca formdaki hafta ve durum sunucudaki hale döner. */
  function restore(state: ArticleState, restoredWeek: string | null) {
    setServer((s) => ({ ...s, state, week: restoredWeek }));
    setForm((f) => ({ ...f, week: restoredWeek ?? "" }));
  }

  function saveDraft() {
    if (live) return publishLive();
    if (!form.title.trim()) {
      setTried(true);
      titleRef.current?.focus();
      return;
    }
    if (actionsError) return;
    const sent = form;
    run("draft", async () => {
      const result = await saveArticleDraft(inputOf(sent, server.id));
      if (!result.ok) return fail(result.error);
      const id = result.id;
      adopt(id);
      setServer({ id, state: "draft", week: null });
      setForm((f) => ({ ...f, week: "" }));
      setSaved(snapshot(sent));
      setTried(false);
      if (result.unscheduled) {
        say(n.toasts.savedUnscheduled, () =>
          run("draft", async () => {
            const undone = await undoUnschedule(id);
            if (!undone.ok) return fail(undone.error);
            restore(undone.state, undone.week);
            say(n.toasts.undone);
          }),
        );
      } else say(n.toasts.saved);
    });
  }

  function plan() {
    if (live) return publishLive();
    if (!planOk) return;
    const sent = form;
    const day = weekDay ?? "";
    run("plan", async () => {
      const result = await scheduleArticle(inputOf(sent, server.id));
      if (!result.ok) return fail(result.error);
      const id = result.id;
      adopt(id);
      setServer({ id, state: "scheduled", week: result.week });
      setSaved(snapshot(sent));
      const bumped = result.bumped[0];
      const message = bumped ? format(n.toasts.scheduledBumped, { date: day, title: bumped.title }) : format(n.toasts.scheduled, { date: day });
      say(message, () =>
        run("plan", async () => {
          const undone = await undoSchedule(id);
          if (!undone.ok) return fail(undone.error);
          restore(undone.state, undone.week);
          say(n.toasts.undone);
        }),
      );
    });
  }

  function publishLive() {
    if (!server.id || !check.ready || actionsError) return;
    const sent = form;
    const id = server.id;
    run("plan", async () => {
      const result = await saveLiveArticle(inputOf(sent, id));
      if (!result.ok) return fail(result.error);
      setSaved(snapshot(sent));
      say(n.toasts.liveSaved);
    });
  }

  function unschedule() {
    if (!server.id || server.state === "draft") return;
    const id = server.id;
    const title = form.title.trim();
    run("unschedule", async () => {
      const result = await unscheduleArticle(id);
      if (!result.ok) return fail(result.error);
      restore("draft", null);
      say(format(result.wasLive ? n.toasts.unpublished : n.toasts.unscheduled, { title }), () =>
        run("unschedule", async () => {
          const undone = await undoUnschedule(id);
          if (!undone.ok) return fail(undone.error);
          restore(undone.state, undone.week);
          say(n.toasts.undone);
        }),
      );
    });
  }

  // Kaydedilmemiş değişiklik varken sekmeyi kapatmak ya da bir bağlantıyla çıkmak sorulur.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  });

  // Ctrl/Cmd + S kaydeder.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (busy === null) saveDraft();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const heading = !server.id ? e.titleNew : live ? e.titleLive : e.titleEdit;
  const doneCount = check.items.filter((i) => i.ok).length;
  const missingLabels = check.items.filter((i) => i.required && !i.ok && !(live && i.key === "week")).map((i) => e.checks[i.key]);

  const previewData: ArticleViewData = (() => {
    const ph = n.preview.placeholders;
    return {
      title: form.title.trim() || ph.title,
      summary: form.summary.trim() || ph.summary,
      date: weekDate ?? ph.date,
      minutes: readingMinutes(content),
      topic: neighborhood ? { name: neighborhood.name, topic: neighborhood.topic, color: neighborhood.color, icon: neighborhood.icon } : null,
      content: {
        ...content,
        whatsHappening: content.whatsHappening.trim() || ph.whatsHappening,
        signs: content.signs.map((s) => ({ sign: s.sign.trim() || ph.empty, explanation: s.explanation })),
      },
      sourceName: form.sourceName.trim() || ph.source,
      sourceUrl: source.ok ? source.href : null,
      cover: cover ? { ...cover, ...form.cover } : null,
      lab:
        lab?.published && neighborhood
          ? {
              name: lab.name,
              href: labHref(lab),
              district: neighborhood.name,
              difficulty: lab.difficulty,
              durationMin: lab.durationMin,
              icon: neighborhood.icon,
              color: neighborhood.color,
              art: roomArtOf(lab.slug),
              done: false,
            }
          : null,
    };
  })();

  return (
    <main className="flex flex-col gap-[18px] px-4 pt-5 pb-16 lg:gap-[22px] lg:px-9 lg:pt-8 lg:pb-[72px]">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`${paths.adminNews}?sekme=${tabParams[server.state]}`}
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-line bg-surface pr-3 pl-1.5 text-sm font-bold text-fg no-underline"
        >
          <ArrowLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          {e.back}
        </Link>
        <span className="text-[13px] font-bold text-accent-fg lg:hidden">{format(e.checklistReady, { done: doneCount, total: check.items.length })}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-6 rounded-[20px] border border-line bg-surface p-4 lg:p-[26px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="m-0 font-heading text-xl leading-tight font-bold lg:text-2xl">{heading}</h1>
            <span className={cn("inline-flex h-6 items-center rounded-full px-[9px] text-xs font-bold", stateBadge[server.state])}>{n.states[server.state]}</span>
            {dirty ? <span className="inline-flex h-6 items-center rounded-full bg-warning/12 px-[9px] text-xs font-bold text-warning-fg">{e.dirty}</span> : null}
          </div>

          <div className="flex flex-col gap-4">
            <Field label={e.title} count={[form.title.length, newsLimits.title]} error={tried && !form.title.trim() ? e.titleMissing : null}>
              {(id, describedBy) => (
                <input
                  ref={titleRef}
                  id={id}
                  type="text"
                  value={form.title}
                  maxLength={newsLimits.title}
                  placeholder={e.titlePlaceholder}
                  aria-describedby={describedBy}
                  aria-invalid={tried && !form.title.trim()}
                  onChange={(ev) => set("title", ev.target.value)}
                  className={cn(inputClass, "h-[46px] text-[15px]")}
                />
              )}
            </Field>
            <Field label={e.summary} count={[form.summary.length, newsLimits.summary]}>
              {(id, describedBy) => (
                <textarea
                  id={id}
                  rows={2}
                  value={form.summary}
                  maxLength={newsLimits.summary}
                  placeholder={e.summaryPlaceholder}
                  aria-describedby={describedBy}
                  onChange={(ev) => set("summary", ev.target.value)}
                  className={cn(inputClass, "resize-y py-3 text-[15px] leading-normal")}
                />
              )}
            </Field>
            <Field label={e.whatsHappening} hint={e.whatsHappeningHint}>
              {(id, describedBy) => (
                <textarea
                  id={id}
                  rows={5}
                  value={form.whatsHappening}
                  maxLength={newsLimits.whatsHappening}
                  aria-describedby={describedBy}
                  onChange={(ev) => set("whatsHappening", ev.target.value)}
                  className={cn(inputClass, "resize-y py-3 text-[15px] leading-normal")}
                />
              )}
            </Field>
          </div>

          <Section title={n.cover.section} hint={n.cover.sectionHint}>
            <CoverField
              articleId={server.id}
              cover={cover}
              onCover={setCover}
              meta={form.cover}
              onMeta={(meta) => set("cover", meta)}
              topic={neighborhood ? { color: neighborhood.color, icon: neighborhood.icon } : null}
              onError={(error) => setToast(nextToast({ message: n.errors[error], tone: "error" }))}
              onDone={(message) => say(message)}
            />
          </Section>

          <Section title={e.signsSection}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Field label={e.exampleSender} className="sm:flex-[1_1_180px]">
                {(id) => (
                  <input
                    id={id}
                    type="text"
                    value={form.exampleSender}
                    maxLength={newsLimits.sender}
                    placeholder={e.exampleSenderPlaceholder}
                    onChange={(ev) => set("exampleSender", ev.target.value)}
                    className={cn(inputClass, "h-[46px] text-[15px]")}
                  />
                )}
              </Field>
              <Field label={e.exampleText} className="sm:flex-[2_1_300px]">
                {(id) => (
                  <textarea
                    id={id}
                    rows={2}
                    value={form.exampleText}
                    maxLength={newsLimits.exampleText}
                    placeholder={e.exampleTextPlaceholder}
                    onChange={(ev) => set("exampleText", ev.target.value)}
                    className={cn(inputClass, "resize-y py-3 text-[15px] leading-normal")}
                  />
                )}
              </Field>
            </div>
            <Group title={e.signs}>
              {form.signs.map((s, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="flex size-[26px] flex-none items-center justify-center rounded-full bg-danger/16 text-[13px] font-bold text-danger-fg">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      aria-label={format(e.sign, { n: i + 1 })}
                      value={s.sign}
                      maxLength={newsLimits.sign}
                      placeholder={e.signPlaceholder}
                      onChange={(ev) => set("signs", form.signs.map((x, j) => (j === i ? { ...x, sign: ev.target.value } : x)))}
                      className={cn(inputClass, "h-11 text-sm")}
                    />
                  </span>
                  <input
                    type="text"
                    aria-label={format(e.signExplanation, { n: i + 1 })}
                    value={s.explanation}
                    maxLength={newsLimits.explanation}
                    placeholder={e.explanationPlaceholder}
                    onChange={(ev) => set("signs", form.signs.map((x, j) => (j === i ? { ...x, explanation: ev.target.value } : x)))}
                    className={cn(inputClass, "h-11 text-sm")}
                  />
                </div>
              ))}
            </Group>
            <Field label={e.actions} hint={e.actionsHint} error={actionsError}>
              {(id, describedBy) => (
                <textarea
                  id={id}
                  rows={3}
                  value={form.actionsText}
                  maxLength={newsLimits.action * newsLimits.actions + newsLimits.actions}
                  placeholder={e.actionsPlaceholder}
                  aria-describedby={describedBy}
                  aria-invalid={!!actionsError}
                  onChange={(ev) => set("actionsText", ev.target.value)}
                  className={cn(inputClass, "resize-y py-3 text-[15px] leading-normal")}
                />
              )}
            </Field>
            <Group title={e.takeaways}>
              {form.takeaways.map((value, i) => (
                <input
                  key={i}
                  type="text"
                  aria-label={format(e.takeaway, { n: i + 1 })}
                  value={value}
                  maxLength={newsLimits.takeaway}
                  placeholder={e.takeawayPlaceholder}
                  onChange={(ev) => set("takeaways", form.takeaways.map((x, j) => (j === i ? ev.target.value : x)))}
                  className={cn(inputClass, "h-11 text-sm")}
                />
              ))}
            </Group>
          </Section>

          <Section title={e.sourceSection} hint={format(e.sourceHint, { brand: brand.name })}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Field label={e.sourceName} className="sm:flex-[1_1_220px]">
                {(id) => (
                  <input
                    id={id}
                    type="text"
                    value={form.sourceName}
                    maxLength={newsLimits.sourceName}
                    placeholder={e.sourceNamePlaceholder}
                    onChange={(ev) => set("sourceName", ev.target.value)}
                    className={cn(inputClass, "h-[46px] text-[15px]")}
                  />
                )}
              </Field>
              <Field label={e.sourceUrl} className="sm:flex-[2_1_300px]">
                {(id) => (
                  <input
                    id={id}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={form.sourceUrl}
                    maxLength={newsLimits.sourceUrl}
                    placeholder={e.sourceUrlPlaceholder}
                    aria-describedby={sourceStatusId}
                    aria-invalid={!source.ok && source.problem !== "empty"}
                    onChange={(ev) => set("sourceUrl", ev.target.value)}
                    className={cn(inputClass, "h-[46px] font-mono text-sm")}
                  />
                )}
              </Field>
            </div>
            <SourceStatus id={sourceStatusId} url={form.sourceUrl} />
          </Section>

          <Section title={e.linkSection}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Field label={e.topic} className="sm:flex-1">
                {(id) => (
                  <select
                    id={id}
                    value={form.neighborhoodId}
                    onChange={(ev) => {
                      const next = ev.target.value;
                      const keepLab = options.neighborhoods.find((x) => x.id === next)?.labs.some((l) => l.id === form.relatedLabId);
                      setForm((f) => ({ ...f, neighborhoodId: next, relatedLabId: keepLab ? f.relatedLabId : "" }));
                    }}
                    className={cn(inputClass, "h-[46px] pr-8 text-[15px]")}
                  >
                    <option value="">{e.topicNone}</option>
                    {options.neighborhoods.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.topic}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={e.lab} hint={neighborhood ? undefined : e.labNeedsTopic} className="sm:flex-1">
                {(id, describedBy) => (
                  <select
                    id={id}
                    value={form.relatedLabId}
                    disabled={!neighborhood}
                    aria-describedby={describedBy}
                    onChange={(ev) => set("relatedLabId", ev.target.value)}
                    className={cn(inputClass, "h-[46px] pr-8 text-[15px]")}
                  >
                    <option value="">{e.labNone}</option>
                    {(neighborhood?.labs ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.published ? l.name : format(e.labHidden, { name: l.name })}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <Field label={e.week} hint={live ? e.weekLive : undefined}>
              {(id, describedBy) =>
                live ? (
                  <select id={id} value="live" disabled aria-describedby={describedBy} className={cn(inputClass, "h-[46px] pr-8 text-[15px]")}>
                    <option value="live">{format(e.weekOption, { date: weekDay ?? "" })}</option>
                  </select>
                ) : (
                  <select
                    id={id}
                    value={form.week}
                    aria-describedby={describedBy}
                    onChange={(ev) => set("week", ev.target.value)}
                    className={cn(inputClass, "h-[46px] pr-8 text-[15px]")}
                  >
                    <option value="">{e.weekNone}</option>
                    {options.weeks.map((w) => (
                      <option key={w.key} value={w.key}>
                        {w.takenBy && w.takenBy.id !== server.id
                          ? format(e.weekTaken, { date: w.day, title: short(w.takenBy.title || n.untitled) })
                          : format(e.weekOption, { date: w.day })}
                      </option>
                    ))}
                  </select>
                )
              }
            </Field>
          </Section>
        </div>

        <div className="flex flex-col gap-3.5 lg:sticky lg:top-4">
          <section aria-labelledby="news-ready-title" className="flex flex-col gap-1.5 rounded-2xl border border-card bg-surface-deep p-4">
            <span className="mb-1 flex items-center justify-between gap-3">
              <h2 id="news-ready-title" className="m-0 text-[15px] font-bold">
                {e.checklist}
              </h2>
              <span className={cn("text-[13px] font-bold", check.ready ? "text-success-fg" : "text-accent-fg")}>
                {format(e.checklistCount, { done: doneCount, total: check.items.length })}
              </span>
            </span>
            <ul className="m-0 flex list-none flex-col p-0">
              {check.items.map((item) => (
                <CheckRow key={item.key} label={e.checks[item.key]} ok={item.ok} required={item.required} itemKey={item.key} />
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {!live ? (
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={busy !== null}
                  className="inline-flex h-12 flex-[1_1_120px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface-deep text-[15px] font-bold text-fg disabled:opacity-60"
                >
                  {busy === "draft" ? <Spinner /> : null}
                  {e.saveDraft}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex h-12 flex-[1_1_120px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-accent/45 bg-transparent text-[15px] font-bold text-accent-fg"
              >
                <Eye className="size-4" strokeWidth={2.2} aria-hidden="true" />
                {e.preview}
              </button>
              <button
                type="button"
                onClick={plan}
                disabled={!planOk}
                className={cn(
                  "inline-flex h-12 flex-[1_1_120px] items-center justify-center gap-2 rounded-xl border-0 px-3 text-[15px] font-bold",
                  planOk ? "cursor-pointer bg-success text-on-accent" : "bg-card text-fg-4",
                )}
              >
                {busy === "plan" ? <Spinner /> : null}
                {planLabel}
              </button>
            </div>
            <span aria-live="polite" className={cn("text-xs leading-normal", check.ready && !takenBy ? "text-success-fg" : takenBy ? "text-warning-fg" : "text-fg-3")}>
              {hint}
            </span>
            {server.id && server.state !== "draft" ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <button
                  type="button"
                  onClick={unschedule}
                  disabled={busy !== null}
                  className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[13px] font-bold text-fg-3 hover:text-danger-fg disabled:opacity-60"
                >
                  <CalendarX2 className="size-4" strokeWidth={2} aria-hidden="true" />
                  {live ? n.unpublish : n.unschedule}
                </button>
                {live && article?.slug ? (
                  <Link href={paths.article(article.slug)} target="_blank" className="inline-flex items-center gap-1.5 text-[13px] font-bold text-accent-fg no-underline hover:underline">
                    <ExternalLink className="size-4" strokeWidth={2} aria-hidden="true" />
                    {n.openPublic}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {previewOpen ? (
        <ArticlePreview
          data={previewData}
          missing={missingLabels}
          planLabel={planLabel}
          canPlan={planOk}
          onPlan={() => {
            setPreviewOpen(false);
            plan();
          }}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}

      <Dialog open={leaveTo !== null} onClose={() => setLeaveTo(null)} labelledBy="news-leave-title" className="max-w-[460px]">
        <h2 id="news-leave-title" className="m-0 font-heading text-[21px] leading-[1.25] font-bold">
          {e.leaveTitle}
        </h2>
        <p className="m-0 text-sm leading-normal text-fg-2">{e.leaveText}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setLeaveTo(null)} className="h-12 flex-1 cursor-pointer rounded-xl border-0 bg-accent text-[15px] font-bold text-on-accent">
            {e.stay}
          </button>
          <button
            type="button"
            onClick={() => {
              const href = leaveTo;
              setLeaveTo(null);
              if (!href) return;
              leaving.current = true;
              router.push(href);
            }}
            className="h-12 flex-1 cursor-pointer rounded-xl border border-line bg-surface-deep text-[15px] font-bold text-fg"
          >
            {e.discard}
          </button>
        </div>
      </Dialog>

      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}

/** "dolu: ..." seçeneğinde başlığın ilk 24 harfi. */
function short(title: string) {
  return title.length > 24 ? `${title.slice(0, 24)}…` : title;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3.5 border-t border-card pt-5">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="m-0 font-heading text-lg font-bold">
          {title}
        </h2>
        {hint ? <span className="text-[13px] leading-normal text-fg-4">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2">
      <span id={id} className="text-sm font-bold text-fg-2">
        {title}
      </span>
      {children}
    </div>
  );
}

/** Etiketli alan: sağda harf sayacı, altta açıklama ya da hata. */
function Field({
  label,
  hint,
  error,
  count,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  count?: [number, number];
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const t = getMessages().news.admin.editor;
  const id = useId();
  const note = error ?? hint;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold text-fg-2">
          {label}
        </label>
        {count ? <span className="text-xs text-fg-4">{format(t.counter, { n: count[0], max: count[1] })}</span> : null}
      </span>
      {children(id, note ? `${id}-note` : undefined)}
      {note ? (
        <span id={`${id}-note`} className={cn("text-xs leading-[1.45]", error ? "text-danger-fg" : "text-fg-4")}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

function CheckRow({ label, ok, required, itemKey }: { label: string; ok: boolean; required: boolean; itemKey: ReadinessKey }) {
  const s = getMessages().news.admin.editor.checkState;
  return (
    <li data-check={itemKey} className="flex items-center gap-2.5 py-1 text-sm">
      {ok ? (
        <CircleCheck className="size-4 flex-none text-success-fg" strokeWidth={2.4} aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className={cn("size-4 flex-none rounded-full border-2", required ? "border-warning" : "border-fg-4")} />
      )}
      <span className={cn("flex-1", ok ? "text-success-fg" : required ? "text-warning-fg" : "text-fg-4")}>{label}</span>
      <span className="sr-only">{ok ? s.ok : required ? s.missing : s.optional}</span>
    </li>
  );
}

/** Kaynak adresinin durumu: güvenilir listede mi, değilse neden (Gundem-Son). */
function SourceStatus({ id, url }: { id: string; url: string }) {
  const e = getMessages().news.admin.editor;
  const check = checkSourceUrl(url);
  if (check.ok) {
    return (
      <span id={id} className="flex items-center gap-2 text-[13px] text-success-fg">
        <ShieldCheck className="size-4 flex-none" strokeWidth={2} aria-hidden="true" />
        <span>{rich(e.sourceOk, { b: () => <b>{check.host}</b> })}</span>
      </span>
    );
  }
  if (check.problem === "empty") {
    return (
      <span id={id} className="text-xs text-fg-4">
        {format(e.trustedList, { list: trustedDomains.join(", ") })}
      </span>
    );
  }
  return (
    <div id={id} role="alert" className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/8 px-3.5 py-3 text-[13px] leading-normal text-warning-fg">
      <ShieldAlert className="mt-px size-4 flex-none" strokeWidth={2} aria-hidden="true" />
      <span>{e.sourceProblems[check.problem]}</span>
    </div>
  );
}
