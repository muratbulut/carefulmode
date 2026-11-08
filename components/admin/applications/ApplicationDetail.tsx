"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  CircleUser,
  Clock,
  FileText,
  GraduationCap,
  Mail,
  School,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  checkApplies,
  checkKeys,
  countedChecks,
  minApprovalChecks,
  schoolSearchUrl,
  signalLevel,
  signalsOf,
  type ApplicationActionError,
  type CheckKey,
  type SignalFacts,
} from "@/lib/admin/application-rules";
import { approveTeacherApplication, rejectTeacherApplication, requestApplicationInfo } from "@/lib/admin/application-actions";
import { format, getMessages } from "@/lib/i18n";
import { cleanSchoolName, schoolNameOk } from "@/lib/school/names";
import { cn } from "@/lib/utils";
import { DocumentDialog, InfoDialog, RejectDialog } from "./dialogs";
import { FieldRow, levelChip, Tag } from "./parts";
import type { ApplicationDetail, SimilarSchool } from "./types";

export type Decision = { id: string; kind: "approved" | "rejected" | "info" };

type DialogKind = "reject" | "info" | "document" | null;

/**
 * Seçili talebin ayrıntısı (Talepler-Son sağ kutu, telefonda ayrıntı sayfası): bilgiler,
 * sinyaller, "Yeni okul" kutusu ("Bu okul mu?" eşlemesi ya da düzeltilen ad), soru-cevap geçmişi,
 * 4 maddelik kontrol listesi ve Onayla / Bilgi iste / Reddet. Kontroller ve eşleme yalnızca
 * tarayıcıda durur; onaylarken sunucuya gider ve sunucu yeniden denetler.
 */
export function ApplicationDetailView({
  app,
  onDecided,
  onToast,
  onError,
}: {
  app: ApplicationDetail;
  onDecided: (decision: Decision, message: string) => void;
  onToast: (message: string, undo?: () => void) => void;
  onError: (error: ApplicationActionError) => void;
}) {
  const t = getMessages().adminApplications;
  const [checks, setChecks] = useState<CheckKey[]>(app.checks);
  const [match, setMatch] = useState<SimilarSchool | null>(null);
  const [schoolName, setSchoolName] = useState(cleanSchoolName(app.typedSchoolName ?? ""));
  const [nameTried, setNameTried] = useState(false);
  const [needChecks, setNeedChecks] = useState(0);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [busy, startTransition] = useTransition();
  const nameId = useId();
  const nameErrorId = useId();

  const open = app.status === "PENDING" || app.status === "INFO_REQUESTED";
  const canDecide = open && !app.own;
  const facts = { hasEmail: !!app.institutionalEmail, hasDocument: !!app.document };
  const counted = countedChecks(checks, facts);
  const enough = counted.length >= minApprovalChecks;
  const newSchool = !app.school;
  const listedSchool = app.school ?? (match ? { id: match.id, name: match.name, teachers: match.teachers } : null);
  const signalFacts: SignalFacts = { ...facts, schoolListed: !!listedSchool, colleagues: listedSchool?.teachers ?? 0 };
  const level = signalLevel(signalFacts);
  const nameValid = schoolNameOk(schoolName);
  const shownSchool = listedSchool?.name ?? (cleanSchoolName(schoolName) || app.typedSchoolName || "");

  function run(task: () => Promise<void>) {
    startTransition(async () => {
      try {
        await task();
      } catch {
        onError("failed");
      }
    });
  }

  function approve() {
    if (!enough) {
      setNeedChecks((n) => n + 1);
      return;
    }
    if (newSchool && !match && !nameValid) {
      setNameTried(true);
      document.getElementById(nameId)?.focus();
      return;
    }
    run(async () => {
      const result = await approveTeacherApplication({
        applicationId: app.id,
        checks: counted,
        ...(newSchool ? (match ? { matchSchoolId: match.id } : { schoolName }) : {}),
      });
      if (!result.ok) return onError(result.error);
      onDecided(
        { id: app.id, kind: "approved" },
        result.schoolCreated
          ? format(t.toasts.approvedSchool, { name: app.name, school: result.schoolName })
          : format(t.toasts.approved, { name: app.name }),
      );
    });
  }

  function reject(note: string) {
    run(async () => {
      const result = await rejectTeacherApplication({ applicationId: app.id, note });
      if (!result.ok) return onError(result.error);
      setDialog(null);
      onDecided({ id: app.id, kind: "rejected" }, format(t.toasts.rejected, { name: app.name }));
    });
  }

  function askInfo(question: string) {
    run(async () => {
      const result = await requestApplicationInfo({ applicationId: app.id, question, checks: counted });
      if (!result.ok) return onError(result.error);
      setDialog(null);
      onDecided({ id: app.id, kind: "info" }, format(t.toasts.info, { name: app.name }));
    });
  }

  function pickSchool(school: SimilarSchool) {
    setMatch(school);
    onToast(format(t.newSchool.matchedToast, { name: app.name, school: school.name }), () => setMatch(null));
  }

  const toggle = (key: CheckKey) => setChecks((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <span aria-hidden="true" className="flex size-[52px] flex-none items-center justify-center rounded-full border border-line bg-card text-[26px]">
          {app.avatar}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="m-0 font-heading text-[22px] leading-tight font-bold [overflow-wrap:anywhere]">{app.name}</h2>
          <span className="text-[13px] text-fg-3">{app.requested}</span>
        </span>
      </div>

      <div>
        <FieldRow Icon={School} label={t.fields.school}>
          <span className="flex flex-wrap items-center gap-2">
            {listedSchool ? listedSchool.name : app.typedSchoolName}
            {!listedSchool ? <Tag tone="warning">{t.newSchoolTag}</Tag> : null}
          </span>
          <span className="block text-[13px] font-medium text-fg-3">{app.place}</span>
          {open && app.school?.coordinator ? (
            <Note Icon={ShieldCheck} tone="text-warning-fg">
              {format(app.school.coordinatorApproves ? t.coordinator.approves : t.coordinator.sees, { name: app.school.coordinator })}
            </Note>
          ) : null}
          {app.opinion ? (
            <Note Icon={app.opinion.kind === "ENDORSED" ? Check : AlertTriangle} tone={app.opinion.kind === "ENDORSED" ? "text-success-fg" : "text-warning-fg"}>
              {format(t.opinion[app.opinion.kind], { name: app.opinion.by ?? t.opinion.someone })}
            </Note>
          ) : null}
        </FieldRow>
        <FieldRow Icon={GraduationCap} label={t.fields.subject}>
          {app.subject}
        </FieldRow>
        <FieldRow Icon={Mail} label={t.fields.email}>
          {app.institutionalEmail ? app.institutionalEmail : <span className="text-fg-4">{t.none}</span>}
        </FieldRow>
        <FieldRow
          Icon={FileText}
          label={t.fields.document}
          action={
            app.document?.available ? (
              <button
                type="button"
                onClick={() => setDialog("document")}
                className="h-[34px] rounded-[10px] border border-line bg-surface px-3 text-[13px] font-bold text-accent-fg max-lg:h-10"
              >
                {t.viewDocument}
              </button>
            ) : null
          }
        >
          {app.document ? (
            <>
              {format(t.documentValue, { name: app.document.name, size: app.document.size })}
              {!app.document.available ? <span className="block text-[13px] font-medium text-fg-3">{t.documentDeleted}</span> : null}
            </>
          ) : (
            <span className="text-fg-4">{t.none}</span>
          )}
        </FieldRow>
        <FieldRow Icon={CircleUser} label={t.fields.account}>
          <span className="font-medium text-fg-2">{app.account}</span>
          {app.minorBirthYear !== null ? (
            <Note Icon={AlertTriangle} tone="text-warning-fg">
              {format(t.minorNote, { year: app.minorBirthYear })}
            </Note>
          ) : null}
        </FieldRow>
      </div>

      <section aria-label={t.signals.title} className="flex flex-col gap-2.5 rounded-[14px] border border-card bg-surface-deep px-4 py-3.5">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-sm">{t.signals.title}</b>
          <span className={cn("inline-flex h-6 items-center rounded-full px-[9px] text-xs font-bold", levelChip[level])}>
            {format(t.level, { level: t.levels[level] })}
          </span>
        </span>
        <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2">
          {signalsOf(signalFacts).map((signal) => {
            const text =
              signal.key === "colleagues"
                ? signal.ok
                  ? format(t.signals.colleagues.yes, { n: signalFacts.colleagues })
                  : t.signals.colleagues.no
                : t.signals[signal.key][signal.ok ? "yes" : "no"];
            return (
              <li key={signal.key} className="flex items-start gap-2 text-[13px] text-fg-2">
                {signal.ok ? (
                  <Check className="mt-px size-[15px] flex-none text-success-fg" strokeWidth={2.6} aria-hidden="true" />
                ) : (
                  <X className="mt-px size-[15px] flex-none text-warning-fg" strokeWidth={2.4} aria-hidden="true" />
                )}
                {text}
              </li>
            );
          })}
        </ul>
        <span className="text-xs text-fg-4">{t.signals.hint}</span>
      </section>

      {open && newSchool && !match ? (
        <div className="flex flex-col gap-3 rounded-[14px] border border-warning/35 bg-warning/6 px-4 py-3.5">
          <span className="flex items-start gap-2.5">
            <AlertTriangle className="mt-px size-[17px] flex-none text-warning-fg" strokeWidth={2} aria-hidden="true" />
            <span className="flex flex-col gap-[3px]">
              <b className="text-sm">{t.newSchool.title}</b>
              <span className="text-[13px] leading-normal text-fg-2">
                {t.newSchool.typed} <b className="text-fg">{app.typedSchoolName}</b> · {app.place}
              </span>
            </span>
          </span>
          {app.similar.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-warning-fg">{t.newSchool.similar}</span>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {app.similar.map((school) => (
                  <li key={school.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-deep px-3 py-2.5">
                    <School className="size-[18px] flex-none text-accent-fg" strokeWidth={2} aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <b className="text-sm [overflow-wrap:anywhere]">{school.name}</b>
                      <span className="text-xs text-fg-4">{format(t.newSchool.similarMeta, { place: app.place, n: school.teachers })}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => pickSchool(school)}
                      aria-label={format(t.newSchool.matchLabel, { name: school.name })}
                      disabled={!canDecide}
                      className="h-9 flex-none rounded-[10px] bg-accent px-3 text-[13px] font-bold text-on-accent disabled:opacity-50"
                    >
                      {t.newSchool.match}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <label htmlFor={nameId} className="flex flex-col gap-1.5 text-[13px] font-bold text-fg-2">
            {t.newSchool.name}
            <input
              id={nameId}
              type="text"
              value={schoolName}
              maxLength={120}
              disabled={!canDecide}
              onChange={(e) => setSchoolName(e.target.value)}
              aria-invalid={nameTried && !nameValid}
              aria-describedby={nameTried && !nameValid ? nameErrorId : undefined}
              className={cn(
                "h-11 w-full rounded-xl border bg-canvas px-3.5 text-[15px] font-normal text-fg disabled:opacity-60",
                nameTried && !nameValid ? "border-danger" : "border-line",
              )}
            />
            <span className="text-xs font-medium text-fg-4">{format(t.newSchool.nameHint, { place: app.place })}</span>
          </label>
          {nameTried && !nameValid ? (
            <p id={nameErrorId} className="-mt-1.5 mb-0 text-[13px] text-danger-fg">
              {t.newSchool.nameError}
            </p>
          ) : null}
        </div>
      ) : null}

      {open && match ? (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-success/35 bg-success/7 px-3.5 py-3 [animation:pop_.25s_ease-out_both]">
          <Check className="size-[17px] flex-none text-success-fg" strokeWidth={2.6} aria-hidden="true" />
          <span className="flex-[1_1_200px] text-[13px] leading-normal text-fg-2">
            <b className="text-fg">{t.newSchool.matched}</b> {format(t.newSchool.matchedTyped, { name: app.typedSchoolName ?? "" })}
          </span>
          <button type="button" onClick={() => setMatch(null)} className="h-[34px] flex-none px-2.5 text-[13px] font-bold text-fg-3 hover:text-fg">
            {t.newSchool.unmatch}
          </button>
        </div>
      ) : null}

      {app.history.length > 0 ? (
        <div className="flex flex-col gap-2.5 rounded-[14px] border border-card bg-surface-deep px-4 py-3.5">
          {app.history.map((round, i) => (
            <div key={`${round.askedAt}-${i}`} className={cn("flex flex-col gap-2.5", i > 0 && "border-t border-card pt-2.5")}>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-bold text-fg-2">{format(t.qa.asked, { when: round.askedAt })}</span>
                <span className="text-sm leading-normal whitespace-pre-line text-fg-2">{round.question}</span>
              </span>
              {round.answeredAt ? (
                <span className="flex flex-col gap-1 border-t border-card pt-2.5">
                  <span className="text-sm font-bold text-success-fg">{format(t.qa.answer, { when: round.answeredAt })}</span>
                  <span className="text-sm leading-normal whitespace-pre-line">{round.answer ?? t.qa.documentOnly}</span>
                </span>
              ) : null}
            </div>
          ))}
          {app.status === "INFO_REQUESTED" ? (
            <span className="flex items-start gap-2 border-t border-card pt-2.5 text-[13px] leading-normal text-warning-fg">
              <Clock className="mt-px size-[15px] flex-none" strokeWidth={2} aria-hidden="true" />
              <span>{t.qa.waiting}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {app.own && open ? (
        <p className="m-0 flex gap-2.5 rounded-xl border border-warning/35 bg-warning/6 px-3.5 py-3 text-sm leading-normal text-fg-2">
          <AlertTriangle className="mt-0.5 size-4 flex-none text-warning-fg" strokeWidth={2.2} aria-hidden="true" />
          {t.own}
        </p>
      ) : null}

      <section aria-label={t.checklist.title} className="flex flex-col gap-2 rounded-[14px] border border-card bg-surface-deep px-4 py-3.5">
        <span className="flex items-center justify-between gap-2">
          <b className="text-sm">{t.checklist.title}</b>
          <span className="text-[13px] font-bold text-accent-fg">{format(t.checklist.count, { n: counted.length, total: checkKeys.length })}</span>
        </span>
        {checkKeys.map((key) => {
          const applies = checkApplies(key, facts);
          const on = applies && checks.includes(key);
          return (
            <button
              key={key}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={!canDecide || !applies}
              onClick={() => toggle(key)}
              className="flex items-center gap-3 rounded-xl border border-card bg-surface-raised px-3 py-2.5 text-left text-sm text-fg disabled:cursor-not-allowed"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-[22px] flex-none items-center justify-center rounded-md border-2 transition-colors",
                  on ? "border-accent bg-accent text-on-accent" : "border-line-strong text-transparent",
                  !applies && "opacity-50",
                )}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <span className={cn("flex-1", !applies && "text-fg-3")}>{t.checklist.items[key]}</span>
              {!applies ? <span className="text-[11px] text-fg-4">{t.checklist.noInfo}</span> : null}
            </button>
          );
        })}
        {canDecide ? (
          enough ? (
            <span className="text-xs text-success-fg">{t.checklist.ready}</span>
          ) : (
            <span key={needChecks} className={cn("text-xs text-warning-fg", needChecks > 0 && "[animation:shake_.4s_ease-in-out]")}>
              {t.checklist.need}
            </span>
          )
        ) : null}
        <a
          href={schoolSearchUrl(shownSchool, app.district, app.province)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.checklist.searchLabel}
          className="-my-2.5 inline-flex min-h-10 items-center gap-1.5 self-start text-[13px] font-bold text-accent-fg no-underline"
        >
          <Search className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {t.checklist.search}
        </a>
      </section>

      {app.status === "APPROVED" ? (
        <div className="flex flex-col gap-1 rounded-xl border border-success/35 bg-success/8 px-3.5 py-3 text-sm">
          <span className="flex flex-wrap items-center gap-2.5">
            <Check className="size-4 flex-none text-success-fg" strokeWidth={2.6} aria-hidden="true" />
            <b>{t.decided.approved}</b>
            <span className="text-fg-3">{t.decided.approvedText}</span>
          </span>
          {app.decided ? <span className="pl-[26px] text-xs text-fg-4">{app.decided}</span> : null}
        </div>
      ) : null}
      {app.status === "REJECTED" ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-danger/35 bg-danger/7 px-3.5 py-3 text-sm">
          <b className="text-danger-fg">{t.decided.rejected}</b>
          <span className="leading-normal whitespace-pre-line text-fg-2">{app.rejectionNote}</span>
          {app.decided ? <span className="text-xs text-fg-4">{app.decided}</span> : null}
        </div>
      ) : null}

      {canDecide ? (
        <div className="flex flex-col gap-2.5 lg:flex-row">
          <button
            type="button"
            onClick={approve}
            disabled={busy}
            aria-disabled={!enough}
            className={cn(
              "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-3.5 text-[15px] font-bold transition-colors lg:order-last lg:flex-[1.3]",
              enough ? "bg-success text-on-accent" : "bg-card text-fg-4",
              busy && "opacity-60",
            )}
          >
            <Check className="size-[17px]" strokeWidth={2.6} aria-hidden="true" />
            {newSchool && !match ? t.actions.approveNewSchool : t.actions.approve}
          </button>
          <div className="flex gap-2.5 lg:contents">
            <ActionButton
              Icon={Mail}
              onClick={() => setDialog("info")}
              disabled={busy || app.status !== "PENDING"}
              className="border-line bg-surface-raised text-fg"
              iconClass="text-accent-fg"
            >
              {t.actions.info}
            </ActionButton>
            <ActionButton Icon={X} onClick={() => setDialog("reject")} disabled={busy} className="border-danger/45 text-danger-fg" iconClass="">
              {t.actions.reject}
            </ActionButton>
          </div>
        </div>
      ) : null}
      {canDecide && app.status === "INFO_REQUESTED" ? <span className="-mt-2 text-xs text-fg-4">{t.actions.infoWaiting}</span> : null}

      {canDecide ? (
        <>
          <RejectDialog open={dialog === "reject"} name={app.name} busy={busy} onClose={() => setDialog(null)} onSubmit={reject} />
          <InfoDialog open={dialog === "info"} name={app.name} busy={busy} onClose={() => setDialog(null)} onSubmit={askInfo} />
        </>
      ) : null}
      {app.document?.available ? (
        <DocumentDialog open={dialog === "document"} applicationId={app.id} document={app.document} onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function Note({ Icon, tone, children }: { Icon: LucideIcon; tone: string; children: ReactNode }) {
  return (
    <span className="mt-1 flex items-start gap-1.5 text-[13px] leading-[1.45] font-medium text-fg-2">
      <Icon className={cn("mt-0.5 size-[15px] flex-none", tone)} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}

function ActionButton({
  Icon,
  onClick,
  disabled,
  className,
  iconClass,
  children,
}: {
  Icon: LucideIcon;
  onClick: () => void;
  disabled: boolean;
  className: string;
  iconClass: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-3.5 text-[15px] font-bold disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      <Icon className={cn("size-[17px]", iconClass)} strokeWidth={2.2} aria-hidden="true" />
      {children}
    </button>
  );
}
