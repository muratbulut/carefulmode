"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, Check, ChevronRight, FileCode, Play, ShieldCheck, Users, X } from "lucide-react";
import { Dialog } from "@/components/profile/Dialog";
import { Spinner } from "@/components/status/Spinner";
import { checklistFor, sameContent } from "@/lib/admin/compare";
import { publishLab, saveLabDraft, undoPublish, type ActionError } from "@/lib/admin/lab-actions";
import type { AdminLab } from "@/lib/admin/lab-data";
import { defaultTryPath, mergeTryPath, reportForPath, type TryPath } from "@/lib/admin/try-path";
import { format, getMessages } from "@/lib/i18n";
import type { EditorSection } from "@/lib/lab/checklist";
import type { LabContent, ScenarioContent, ScenarioTemplate, Template, TrainingContent } from "@/lib/lab/content";
import { paths } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { neighborhoodColor, statusColors } from "../colors";
import { nextToast, UndoToast, type ToastData } from "../UndoToast";
import { CardsForm } from "./CardsForm";
import { CoverForm } from "./CoverForm";
import { GatePicker } from "./GatePicker";
import { ItemsForm } from "./ItemsForm";
import { Kicker, ScenarioPreview, TrainingPreview } from "./Preview";
import { ReportForm } from "./ReportForm";
import { TasksForm } from "./TasksForm";
import { TrapForm } from "./TrapForm";
import { TryPanel } from "./TryPanel";
import type { Edit } from "./types";

const scenarioSections: EditorSection[] = ["cover", "items", "trap", "tasks", "report"];
const trainingSections: EditorSection[] = ["cover", "cards"];
/** Tailwind "lg" kırılımı: üç sütunlu masaüstü düzeni. */
const desktopQuery = "(min-width: 64rem)";

type Pending = { kind: "save" } | { kind: "publish" } | { kind: "preview" };

/**
 * Lab düzenleme (Lab-Duzenle-Son, -SMS, -Mobil): solda bölümler ve "Yayına hazır mı?", ortada
 * form, sağda önizleme ve "Öğrenci gibi dene". Telefonda bölüm listesi; bölüm kendi sayfasında
 * açılır. Form içeriği tarayıcıda tutulur; "Kaydet" taslağı, "vN olarak yayınla" yeni sürümü yazar.
 */
export function LabEditor({ lab, canEdit, canPublish }: { lab: AdminLab; canEdit: boolean; canPublish: boolean }) {
  const t = getMessages();
  const e = t.admin.editor;
  const router = useRouter();
  const template: Template = lab.template;
  const scenario = template !== "TRAINING";

  const [content, setContent] = useState<LabContent>(lab.draft);
  const [saved, setSaved] = useState<LabContent>(lab.draft);
  const [revision, setRevision] = useState(lab.revision);
  const [section, setSection] = useState<EditorSection>(scenario ? "items" : "cards");
  const [itemIndex, setItemIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [tab, setTab] = useState<"preview" | "try">("preview");
  const [mobile, setMobile] = useState<null | "section" | "try">(null);
  const [tryPath, setTryPath] = useState<TryPath>(() => (scenario ? defaultTryPath(lab.draft as ScenarioContent) : { items: {}, answers: {} }));
  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [conflict, setConflict] = useState<Pending | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "publish">(null);
  const [, startTransition] = useTransition();
  const leaving = useRef(false);
  const mobileBack = useRef<HTMLButtonElement>(null);

  const dirty = !sameContent(content, saved);
  const checklist = checklistFor(template, content);
  const okCount = checklist.filter((c) => c.ok).length;
  const ready = okCount === checklist.length;
  const changed = lab.published === null || !sameContent(content, lab.published);
  // Kaydedilmiş taslak şemaya uymuyorsa (D8) form yalnızca okunur: kaydetme ve yayınlama onun
  // üstüne yazmaz (sunucu da reddeder). Form o zaman yayındaki sürümü ya da boş taslağı gösterir.
  const unreadable = lab.draftIssues !== null;
  const editable = canEdit && !unreadable;
  const publishable = canPublish && !unreadable && ready && changed && busy === null;
  const previewHref = paths.adminLabPreview(lab.id);

  const scenarioContent = scenario ? (content as ScenarioContent) : null;
  const path = scenarioContent ? mergeTryPath(scenarioContent, tryPath) : tryPath;
  const report = scenarioContent ? reportForPath(scenarioContent, template as ScenarioTemplate, path) : null;

  const edit: Edit<LabContent> = (change) =>
    setContent((prev) => {
      const next = structuredClone(prev);
      change(next);
      return next;
    });
  const say = (message: string) => setToast(nextToast({ message }));
  const fail = (error: ActionError) => setToast(nextToast({ message: t.admin.errors[error], tone: "error" }));

  function save(force = false, then?: () => void) {
    const snapshot = content;
    setBusy("save");
    startTransition(async () => {
      try {
        const result = await saveLabDraft(lab.id, snapshot, revision, force);
        if (!result.ok) {
          if (result.error === "conflict") setConflict(then ? { kind: "preview" } : { kind: "save" });
          else fail(result.error);
          return;
        }
        setSaved(snapshot);
        setRevision(result.revision);
        if (then) then();
        else say(lab.publishedVersion ? format(e.toasts.saved, { version: lab.publishedVersion }) : e.toasts.savedDraft);
      } catch {
        fail("failed");
      } finally {
        setBusy(null);
      }
    });
  }

  function publish(force = false) {
    const snapshot = content;
    setConfirmPublish(false);
    setBusy("publish");
    startTransition(async () => {
      try {
        const result = await publishLab(lab.id, canEdit ? { content: snapshot, revision, force } : { revision, force });
        if (!result.ok) {
          if (result.error === "conflict") setConflict({ kind: "publish" });
          else fail(result.error);
          return;
        }
        setSaved(snapshot);
        setRevision(result.revision);
        const version = result.version;
        setToast(
          nextToast({
            message: format(e.toasts.published, { name: snapshot.meta.name, version }),
            undo: () =>
              startTransition(async () => {
                const undone = await undoPublish(lab.id, version);
                if (!undone.ok) fail(undone.error);
                else say(e.toasts.unpublished);
              }),
          }),
        );
      } catch {
        fail("failed");
      } finally {
        setBusy(null);
      }
    });
  }

  function preview() {
    if (!dirty || !canEdit) {
      leaving.current = true;
      router.push(previewHref);
      return;
    }
    save(false, () => {
      leaving.current = true;
      router.push(previewHref);
    });
  }

  // Kaydedilmemiş değişiklik varken sekmeyi kapatmak ya da sayfadan bir bağlantıyla çıkmak sorulur.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      event.stopPropagation();
      if (url.pathname === previewHref) {
        preview();
        return;
      }
      setLeaveTo(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  });

  // Telefonda bölüm sayfası açılınca odak "Bölümler" düğmesine gider; ekran masaüstü
  // genişliğine çıkarsa sayfa kapanır (masaüstünde üç sütun hep görünür).
  useEffect(() => {
    if (mobile) mobileBack.current?.focus();
  }, [mobile]);
  useEffect(() => {
    const query = window.matchMedia(desktopQuery);
    const onChange = () => {
      if (query.matches) setMobile(null);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Ctrl/Cmd + S taslağı kaydeder.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (canEdit && dirty && busy === null) save();
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const sections = scenario ? scenarioSections : trainingSections;
  const sectionTitle = (s: EditorSection) =>
    s === "cover"
      ? e.sections.cover[template]
      : s === "items"
        ? e.sections.items[template as ScenarioTemplate]
        : s === "trap"
          ? e.sections.trap[template as ScenarioTemplate]
          : e.sections[s];
  const counts: Partial<Record<EditorSection, number>> = scenarioContent
    ? { items: scenarioContent.items.length, tasks: scenarioContent.tasks.length }
    : { cards: (content as TrainingContent).cards.length };
  const sectionOk = (s: EditorSection) => checklist.filter((c) => c.section === s).every((c) => c.ok);
  const onPhone = () => !window.matchMedia(desktopQuery).matches;
  const go = (s: EditorSection) => {
    setSection(s);
    setTab("preview");
    if (onPhone()) setMobile("section");
  };

  const color = neighborhoodColor(lab.neighborhood.color);
  const statusText =
    lab.publishedVersion && lab.status !== "DRAFT"
      ? format(t.admin.statusVersion, { status: t.admin.status[lab.status], version: lab.publishedVersion })
      : t.admin.status[lab.status];
  const hint = unreadable
    ? e.hints.unreadable
    : !canEdit
    ? e.hints.readOnly
    : !canPublish
      ? e.hints.noPublish
      : !changed
        ? e.hints.unchanged
        : !ready
          ? e.hints.notReady
          : e.hints.ready;

  const itemMax = scenarioContent ? Math.max(0, scenarioContent.items.length - 1) : 0;
  const taskMax = scenarioContent ? Math.max(0, scenarioContent.tasks.length - 1) : 0;
  const cardMax = scenarioContent ? 0 : Math.max(0, (content as TrainingContent).cards.length - 1);
  const ii = Math.min(itemIndex, itemMax);
  const ti = Math.min(taskIndex, taskMax);
  const ci = Math.min(cardIndex, cardMax);
  const editScenario = edit as unknown as Edit<ScenarioContent>;
  const editTraining = edit as unknown as Edit<TrainingContent>;

  const form = (
    <fieldset disabled={!editable} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      {section === "cover" ? <CoverForm content={content} template={template} edit={edit} /> : null}
      {scenarioContent && section === "items" ? (
        <ItemsForm content={scenarioContent} template={template as ScenarioTemplate} edit={editScenario} index={ii} setIndex={setItemIndex} say={say} />
      ) : null}
      {scenarioContent && section === "trap" ? <TrapForm content={scenarioContent} template={template as ScenarioTemplate} edit={editScenario} /> : null}
      {scenarioContent && section === "tasks" ? (
        <TasksForm content={scenarioContent} template={template as ScenarioTemplate} edit={editScenario} index={ti} setIndex={setTaskIndex} say={say} />
      ) : null}
      {scenarioContent && report && section === "report" ? (
        <ReportForm content={scenarioContent} template={template as ScenarioTemplate} edit={editScenario} shown={report.tips} />
      ) : null}
      {!scenarioContent && section === "cards" ? (
        <CardsForm content={content as TrainingContent} edit={editTraining} index={ci} setIndex={setCardIndex} say={say} />
      ) : null}
    </fieldset>
  );

  const paneKey = `${tab}-${section}`;
  const tabId = `admin-tab-${tab}`;
  const previewPane = scenarioContent && report ? (
    tab === "try" ? (
      <TryPanel content={scenarioContent} template={template as ScenarioTemplate} path={path} report={report} onChange={setTryPath} previewHref={previewHref} />
    ) : (
      <ScenarioPreview content={scenarioContent} template={template as ScenarioTemplate} section={section} itemIndex={ii} taskIndex={ti} report={report} />
    )
  ) : (
    <TrainingPreview content={content as TrainingContent} section={section} cardIndex={ci} />
  );

  return (
    <main className="flex flex-col gap-[22px] px-4 pt-6 pb-16 lg:px-9 lg:pt-8 lg:pb-[72px]">
      {/* Üst bölüm: geri, kod ve durum, ad, düğmeler */}
      <div className="flex flex-col gap-3.5">
        <Link
          href={paths.adminLabs}
          className="inline-flex h-[38px] items-center gap-1 self-stretch rounded-[10px] border border-line bg-surface pr-3 pl-1.5 text-sm font-bold text-fg no-underline"
        >
          <ArrowLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
          {e.back}
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-[7px] px-2 py-[3px] font-mono text-xs font-bold", color.chip)}>{lab.code}</span>
              <span className="text-[13px] text-fg-3">
                {format(e.meta, {
                  neighborhood: lab.neighborhood.name,
                  difficulty: t.lab.difficulty[content.meta.difficulty],
                  duration: content.meta.durationMin,
                })}
              </span>
              <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-[9px] text-xs font-bold", statusColors[lab.status].badge)}>
                {statusText}
              </span>
              {dirty ? (
                <span className="inline-flex h-6 items-center rounded-full bg-warning/12 px-[9px] text-xs font-bold text-warning-fg">{e.dirty}</span>
              ) : null}
            </span>
            <h1 className="m-0 font-heading text-[26px] leading-[1.15] font-bold break-words lg:text-[32px]">{content.meta.name || lab.slug}</h1>
            {lab.gate ? <GatePicker labId={lab.id} gate={lab.gate} canPublish={canPublish} onSaved={say} onError={fail} /> : null}
          </div>
          <div className="flex flex-col gap-1.5 lg:items-end">
            <div className="flex flex-wrap gap-2">
              <Link
                href={previewHref}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-raised px-3.5 text-sm font-bold text-fg no-underline lg:flex-none"
              >
                <Play className="size-4 text-accent-fg" strokeWidth={2.2} aria-hidden="true" />
                {e.preview}
              </Link>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => save()}
                  disabled={!dirty || busy !== null}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface-raised px-3.5 text-sm font-bold text-fg disabled:text-fg-4 lg:flex-none"
                >
                  {busy === "save" ? <Spinner /> : null}
                  {busy === "save" ? e.saving : e.save}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmPublish(true)}
                disabled={!publishable}
                className={cn(
                  "inline-flex h-11 basis-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors lg:basis-auto",
                  publishable ? "bg-success text-on-accent" : "bg-card text-fg-4",
                )}
              >
                {busy === "publish" ? <Spinner /> : null}
                {busy === "publish" ? e.publishing : format(e.publish, { version: lab.nextVersion })}
              </button>
            </div>
            <span className="text-xs text-fg-4" aria-live="polite">
              {hint}
            </span>
          </div>
        </div>
      </div>

      {lab.sourceFile ? (
        <div className="flex gap-3 rounded-2xl border border-accent/40 bg-accent/8 px-4 py-3.5">
          <FileCode className="mt-0.5 size-5 flex-none text-accent" strokeWidth={2.2} aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-1.5 text-sm leading-normal text-fg-2">
            <b className="text-[15px] text-fg">{e.fromFile.title}</b>
            <span className="break-words">{format(e.fromFile.text, { file: lab.sourceFile })}</span>
          </div>
        </div>
      ) : null}

      {lab.draftIssues ? (
        <div role="alert" className="flex gap-3 rounded-2xl border border-warning/45 bg-warning/8 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 size-5 flex-none text-warning-fg" strokeWidth={2.2} aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-1.5 text-sm leading-normal text-fg-2">
            <b className="text-[15px] text-fg">{e.unreadable.title}</b>
            <span>{e.unreadable.text}</span>
            <span>{lab.published ? e.unreadable.showsPublished : e.unreadable.showsEmpty}</span>
            <span className="text-xs text-fg-3">
              {e.unreadable.fields} <code className="font-mono break-all text-fg-2">{lab.draftIssues.join(", ")}</code>
            </span>
          </div>
        </div>
      ) : null}

      {/* Form sütunu dar kalmasın: 1280 px altında önizleme formun altına iner, 1440 px altında yan
          sütunlar daralır. Formun içindeki ızgaralar ekrana değil bu sütunun genişliğine (@container) bakar. */}
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,320px)] min-[1440px]:grid-cols-[250px_minmax(0,1fr)_minmax(0,380px)]">
        {/* Sol: şablon, bölümler, yayına hazırlık */}
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-4">
          <div className="flex flex-col gap-1 rounded-[14px] border border-dashed border-line bg-surface-raised px-3.5 py-3">
            <span className="flex items-center gap-2 text-[13px] font-bold text-fg">
              <span aria-hidden="true" className={cn("size-2 rounded-full", color.dot)} />
              {e.templates[template].name}
            </span>
            <span className="text-xs leading-[1.45] text-fg-4">{e.templates[template].text}</span>
          </div>
          <nav aria-label={e.sectionsLabel} className="flex flex-col gap-0.5 rounded-[20px] border border-line bg-surface p-1.5 lg:p-2">
            {sections.map((s) => {
              const on = s === section;
              const ok = sectionOk(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => go(s)}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "flex h-[52px] items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-bold lg:h-[46px]",
                    on ? "bg-card text-fg shadow-[inset_3px_0_0_var(--accent)]" : "text-fg-2 hover:bg-surface-raised",
                  )}
                >
                  <span className="flex-1">{sectionTitle(s)}</span>
                  {counts[s] !== undefined ? <span className="text-xs font-medium text-fg-4">{counts[s]}</span> : null}
                  {ok ? (
                    <Check className="size-4 text-success-fg" strokeWidth={2.6} aria-hidden="true" />
                  ) : (
                    <span className="size-2 rounded-full bg-warning">
                      <span className="sr-only">{e.sectionMissing}</span>
                    </span>
                  )}
                  <ChevronRight className="size-4 text-fg-4 lg:hidden" strokeWidth={2} aria-hidden="true" />
                </button>
              );
            })}
          </nav>
          {scenarioContent ? (
            <button
              type="button"
              onClick={() => {
                setTab("try");
                setMobile("try");
              }}
              className="flex h-[52px] items-center gap-2.5 rounded-[14px] border border-accent/40 bg-surface-raised px-3.5 text-left text-[15px] font-bold text-fg lg:hidden"
            >
              <Play className="size-4 text-accent-fg" strokeWidth={2.2} aria-hidden="true" />
              <span className="flex-1">{e.previewPane.tabs.try}</span>
              <ChevronRight className="size-4 text-fg-4" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
          {/* Telefonda maddeler 40 px yüksek (dokunulunca ilgili bölüm açılır); aradaki boşluk onun içinde. */}
          <div role="group" aria-labelledby="admin-ready-title" className="flex flex-col gap-1 rounded-2xl border border-card bg-surface-deep px-4 py-3.5 max-lg:gap-0">
            <span className="mb-1 flex items-center justify-between">
              <b id="admin-ready-title" className="text-sm">
                {e.ready}
              </b>
              <span className={cn("text-[13px] font-bold", ready ? "text-success-fg" : "text-accent-fg")}>
                {format(e.readyCount, { ok: okCount, total: checklist.length })}
              </span>
            </span>
            {checklist.map((item) => {
              const text = (e.checklist[template] as Record<string, string>)[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.section)}
                  aria-label={format(e.checkLabel, { item: text, state: item.ok ? e.checkOk : e.checkMissing })}
                  className="flex items-center gap-2.5 px-0.5 py-[5px] text-left text-[13px] max-lg:min-h-10"
                >
                  {item.ok ? (
                    <Check className="size-[15px] flex-none text-success-fg" strokeWidth={2.8} aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" className="size-[15px] flex-none rounded-full border-2 border-warning" />
                  )}
                  <span className={item.ok ? "text-success-fg" : "text-warning-fg"}>{text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orta ve sağ: telefonda bölüm kendi sayfasında açılır */}
        <div
          role={mobile ? "dialog" : undefined}
          aria-modal={mobile ? true : undefined}
          aria-label={mobile ? (mobile === "try" ? e.previewPane.tabs.try : sectionTitle(section)) : undefined}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMobile(null);
          }}
          className={cn(
            mobile ? "fixed inset-0 z-40 flex flex-col overflow-y-auto bg-canvas [animation:slide-in-page_.3s_cubic-bezier(.2,.8,.2,1)_both]" : "hidden",
            "lg:static lg:contents",
          )}
        >
          <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-card bg-surface-deep px-3.5 py-3 lg:hidden">
            <button
              ref={mobileBack}
              type="button"
              onClick={() => setMobile(null)}
              className="inline-flex h-10 flex-none items-center gap-1 rounded-xl border border-line bg-surface pr-3 pl-1.5 text-sm font-bold text-fg"
            >
              <ArrowLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
              {e.backToSections}
            </button>
            <b className="min-w-0 truncate text-base">{mobile === "try" ? e.previewPane.tabs.try : sectionTitle(section)}</b>
          </div>
          <div className="flex flex-col gap-4 p-4 lg:contents">
            <section
              aria-labelledby="admin-section-title"
              className={cn(
                "@container flex min-w-0 flex-col gap-4 rounded-[20px] border border-line bg-surface p-4 lg:p-6",
                mobile === "try" && "hidden lg:flex",
              )}
            >
              <h2 id="admin-section-title" className="m-0 font-heading text-[22px] font-bold">
                {sectionTitle(section)}
              </h2>
              {form}
            </section>
            <aside aria-label={e.previewPane.tabsLabel} className="order-first flex min-w-0 flex-col gap-2.5 lg:order-none lg:col-start-2 xl:sticky xl:top-4 xl:col-start-auto">
              {scenarioContent ? (
                <div role="tablist" aria-label={e.previewPane.tabsLabel} className="hidden gap-1 rounded-xl border border-card bg-surface-deep p-1 lg:flex">
                  {(["preview", "try"] as const).map((key) => (
                    <button
                      key={key}
                      id={`admin-tab-${key}`}
                      type="button"
                      role="tab"
                      aria-selected={tab === key}
                      aria-controls="admin-preview-panel"
                      onClick={() => setTab(key)}
                      className={cn("h-[38px] flex-1 rounded-[10px] text-sm font-bold", tab === key ? "bg-card text-fg" : "text-fg-3 hover:text-fg")}
                    >
                      {e.previewPane.tabs[key]}
                    </button>
                  ))}
                </div>
              ) : (
                <Kicker icon={false}>{e.previewPane.tabsLabel}</Kicker>
              )}
              <div
                key={paneKey}
                id="admin-preview-panel"
                role={scenarioContent ? "tabpanel" : undefined}
                aria-labelledby={scenarioContent ? tabId : undefined}
                className="flex flex-col gap-2.5 [animation:fade-in_.2s_ease-out_both]"
              >
                {previewPane}
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Dialog open={confirmPublish} onClose={() => setConfirmPublish(false)} labelledBy="admin-publish-version-title" className="max-w-[500px]">
        <div className="flex items-start justify-between gap-2.5">
          <h2 id="admin-publish-version-title" className="m-0 font-heading text-[21px] leading-[1.25] font-bold">
            {format(e.publishDialog.title, { name: content.meta.name, version: lab.nextVersion })}
          </h2>
          <button
            type="button"
            onClick={() => setConfirmPublish(false)}
            aria-label={t.admin.close}
            className="flex size-10 flex-none items-center justify-center rounded-xl text-fg-3 hover:text-fg"
          >
            <X className="size-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-col gap-2.5 text-sm leading-normal text-fg-2">
          <span className="flex gap-2.5">
            <Users className="mt-0.5 size-4 flex-none text-accent-fg" strokeWidth={2.2} aria-hidden="true" />
            <span>
              {lab.publishedVersion === null
                ? e.publishDialog.first
                : lab.type === "TRAINING"
                  ? lab.inProgress > 0
                    ? format(e.publishDialog.trainingInProgress, { n: lab.inProgress })
                    : format(e.publishDialog.noneInProgress, { version: lab.nextVersion })
                  : lab.inProgress > 0
                    ? format(e.publishDialog.inProgress, { n: lab.inProgress, current: lab.publishedVersion, version: lab.nextVersion })
                    : format(e.publishDialog.noneInProgress, { version: lab.nextVersion })}
            </span>
          </span>
          {lab.status === "HIDDEN" ? (
            <span className="flex gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 flex-none text-warning-fg" strokeWidth={2.2} aria-hidden="true" />
              <span>{e.publishDialog.hidden}</span>
            </span>
          ) : null}
          {lab.publishedVersion !== null ? (
            <span className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 flex-none text-success-fg" strokeWidth={2.2} aria-hidden="true" />
              <span>{e.publishDialog.kept}</span>
            </span>
          ) : null}
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => setConfirmPublish(false)} className="h-12 flex-1 rounded-xl border border-line bg-surface-raised text-[15px] font-bold text-fg">
            {e.publishDialog.cancel}
          </button>
          <button type="button" onClick={() => publish()} className="h-12 flex-1 rounded-xl bg-success text-[15px] font-bold text-on-accent">
            {e.publishDialog.confirm}
          </button>
        </div>
      </Dialog>

      <Dialog open={conflict !== null} onClose={() => setConflict(null)} labelledBy="admin-conflict-title" className="max-w-[500px]">
        <h2 id="admin-conflict-title" className="m-0 font-heading text-[21px] leading-[1.25] font-bold">
          {e.conflictDialog.title}
        </h2>
        <p className="m-0 text-sm leading-normal text-fg-2">{e.conflictDialog.text}</p>
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              leaving.current = true;
              window.location.reload();
            }}
            className="h-12 flex-1 rounded-xl border border-line bg-surface-raised px-3 text-sm font-bold text-fg"
          >
            {e.conflictDialog.reload}
          </button>
          <button
            type="button"
            onClick={() => {
              const pending = conflict;
              setConflict(null);
              if (pending?.kind === "publish") publish(true);
              else if (pending?.kind === "preview")
                save(true, () => {
                  leaving.current = true;
                  router.push(previewHref);
                });
              else save(true);
            }}
            className="h-12 flex-1 rounded-xl bg-warning px-3 text-sm font-bold text-on-warning"
          >
            {e.conflictDialog.overwrite}
          </button>
        </div>
      </Dialog>

      <Dialog open={leaveTo !== null} onClose={() => setLeaveTo(null)} labelledBy="admin-leave-title" className="max-w-[460px]">
        <h2 id="admin-leave-title" className="m-0 font-heading text-[21px] leading-[1.25] font-bold">
          {e.leaveDialog.title}
        </h2>
        <p className="m-0 text-sm leading-normal text-fg-2">{e.leaveDialog.text}</p>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => setLeaveTo(null)} className="h-12 flex-1 rounded-xl bg-accent text-[15px] font-bold text-on-accent">
            {e.leaveDialog.stay}
          </button>
          <button
            type="button"
            onClick={() => {
              const href = leaveTo;
              setLeaveTo(null);
              leaving.current = true;
              if (href) router.push(href);
            }}
            className="h-12 flex-1 rounded-xl border border-line bg-surface-raised text-[15px] font-bold text-fg"
          >
            {e.leaveDialog.leave}
          </button>
        </div>
      </Dialog>

      <UndoToast toast={toast} onClose={() => setToast(null)} />
    </main>
  );
}
