"use client";

import { Check, CircleCheck, GraduationCap, Info, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Notice } from "@/components/auth/fields";
import { format, getMessages, rich } from "@/lib/i18n";
import { paths, routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ApplicationForm } from "./teaching/ApplicationForm";
import { InfoRequestForm } from "./teaching/InfoRequestForm";
import { InfoBox, Panel, PanelTitle, SummaryList, WithdrawButton, primaryButton, secondaryButton } from "./teaching/parts";
import type { ApplicationSummary, TeachingSectionData } from "./teaching/types";
import { SectionCard } from "./SectionCard";

export type { TeachingSectionData } from "./teaching/types";

// "İlk sınıfını oluştur" ve "Yeni sınıf oluştur": Sınıflarım yeni sınıf penceresi açık gelir.
const newClassHref = paths.newClass;

/**
 * Profil > Öğretmenlik (Tur 3 ve Tur 4, ekran 17; tahtalar: Ogretmenlik-Son, -Son-Bilgi, -Onay,
 * -Ret). Talep yoksa kısa açıklama ve "Öğretmenlik talebi oluştur"; sonra sırasıyla inceleniyor,
 * bilgi istendi, onaylandı ya da onaylanmadı halleri. Doğrulanmamış e-postayla talep gönderilemez.
 */
export function TeachingSection({
  data,
  emailVerified,
  onDone,
}: {
  data: TeachingSectionData;
  emailVerified: boolean;
  onDone: (message: string) => void;
}) {
  const t = getMessages().teaching;
  // Davet bağlantısıyla gelindiyse form açık başlar.
  const [formOpen, setFormOpen] = useState(data.state === "none" && data.invited);
  const [round, setRound] = useState(0);
  const [focusForm, setFocusForm] = useState(false);
  const canApply = data.state === "none" || data.state === "rejected";

  function openForm() {
    setRound((n) => n + 1);
    setFocusForm(true);
    setFormOpen(true);
  }

  const finish = (message: string) => {
    setFormOpen(false);
    onDone(message);
  };

  function body() {
    if (canApply && !emailVerified) {
      return (
        <>
          <p className="text-sm leading-[1.55] text-fg-2">{t.intro}</p>
          <Notice tone="warn">
            <span className="flex flex-col items-start gap-1">
              {t.verifyFirst}
              <Link href={routes.verify} className="font-bold">
                {t.verifyNow}
              </Link>
            </span>
          </Notice>
        </>
      );
    }
    if (canApply && formOpen) {
      return (
        <ApplicationForm key={round} draft={data.draft} autoFocus={focusForm} onCancel={() => setFormOpen(false)} onDone={finish} />
      );
    }
    switch (data.state) {
      case "none":
        return (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="text-sm leading-[1.55] text-fg-2 sm:flex-[1_1_240px]">{t.intro}</p>
            <button type="button" onClick={openForm} className={cn(secondaryButton, "self-start sm:self-auto")}>
              {t.open}
            </button>
          </div>
        );
      case "pending":
        return <PendingPanel application={data.application} answeredOn={data.answeredOn} onDone={onDone} />;
      case "info":
        return <InfoRequestForm application={data.application} question={data.question} askedAt={data.askedAt} onDone={onDone} />;
      case "approved":
        return <ApprovedPanel approvedOn={data.approvedOn} school={data.school} documentDeleted={data.documentDeleted} hasClass={data.hasClass} />;
      case "rejected": {
        const subtitle = data.documentDeleted
          ? data.decidedOn
            ? format(t.rejected.deletedOn, { date: data.decidedOn })
            : t.rejected.deleted
          : data.decidedOn;
        return (
          <Panel tone="danger" className="gap-3">
            <PanelTitle title={t.rejected.title} subtitle={subtitle} />
            {data.note ? (
              <InfoBox Icon={Info} tone="danger" deep>
                <b className="mr-1 text-fg">{t.rejected.note}</b>
                {data.note}
              </InfoBox>
            ) : null}
            <button type="button" onClick={openForm} className={cn(secondaryButton, "self-start")}>
              {t.rejected.again}
            </button>
          </Panel>
        );
      }
    }
  }

  return (
    <SectionCard Icon={GraduationCap} tone="warning" title={t.title}>
      {body()}
    </SectionCard>
  );
}

/** İnceleniyor: Gönderildi → (Bilgi istendi, cevapladın) → İnceleniyor → Sonuç. */
function PendingPanel({ application, answeredOn, onDone }: { application: ApplicationSummary; answeredOn: string | null; onDone: (message: string) => void }) {
  const t = getMessages().teaching;
  const p = t.pending;
  const steps: { title: string; detail: string; mark: "done" | "now" | "later" }[] = [
    { title: p.sent, detail: application.sentOn, mark: "done" },
    ...(answeredOn ? [{ title: p.answered, detail: answeredOn, mark: "done" as const }] : []),
    { title: p.reviewing, detail: p.reviewingHint, mark: "now" },
    { title: p.result, detail: p.resultHint, mark: "later" },
  ];
  return (
    <Panel tone="warning">
      <PanelTitle title={p.title} />
      <ol aria-label={p.steps} className="flex flex-col">
        {steps.map((step, index) => (
          <li key={step.title} className="flex flex-col" aria-current={step.mark === "now" ? "step" : undefined}>
            {index > 0 ? <span aria-hidden="true" className="my-1 ml-3 h-3 w-0.5 bg-line" /> : null}
            <div className="flex items-start gap-3">
              <StepMark mark={step.mark} />
              <span className="flex flex-col gap-0.5 pt-[3px]">
                <span className={step.mark === "later" ? "text-sm font-bold text-fg-4" : "text-sm font-bold text-fg"}>{step.title}</span>
                <span className="text-xs text-fg-3">{step.detail}</span>
              </span>
            </div>
          </li>
        ))}
      </ol>
      <SummaryList
        rows={[
          [t.summary.school, application.school],
          [t.summary.subject, application.subject],
          [t.summary.email, application.institutionalEmail ?? t.summary.none],
          [
            t.summary.document,
            application.document
              ? format(application.document.deleted ? t.summary.documentDeletedValue : t.summary.documentValue, {
                  name: application.document.name,
                  size: application.document.size,
                })
              : t.summary.none,
          ],
        ]}
      />
      <div>
        <WithdrawButton onDone={onDone} />
      </div>
    </Panel>
  );
}

function StepMark({ mark }: { mark: "done" | "now" | "later" }) {
  if (mark === "done") {
    return (
      <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-success/16">
        <Check className="size-3.5 text-success" strokeWidth={2.8} aria-hidden="true" />
      </span>
    );
  }
  if (mark === "now") {
    return (
      <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-warning/16">
        <span className="size-2.5 rounded-full bg-warning motion-safe:animate-pulse" />
      </span>
    );
  }
  return <span className="size-[26px] flex-none rounded-full border-[1.5px] border-dashed border-line-strong" />;
}

/**
 * Onaylandı: "Öğretmen hesabın açık" ve Sınıflarım bağlantıları. Hiç sınıfı yoksa öne çıkan düğme
 * "İlk sınıfını oluştur", sınıfı varsa "Sınıflarım'a git" (yanında "Yeni sınıf oluştur").
 */
function ApprovedPanel({
  approvedOn,
  school,
  documentDeleted,
  hasClass,
}: {
  approvedOn: string | null;
  school: string | null;
  documentDeleted: boolean;
  hasClass: boolean;
}) {
  const t = getMessages().teaching.approved;
  const subtitle = approvedOn ? (school ? format(t.onSchool, { date: approvedOn, school }) : format(t.on, { date: approvedOn })) : school;
  const primary = cn(primaryButton, "bg-accent text-on-accent hover:brightness-110");
  return (
    <Panel tone="success">
      <div className="flex items-center gap-3">
        <span className="flex size-10 flex-none items-center justify-center rounded-full bg-success/16">
          <CircleCheck className="size-5 text-success" strokeWidth={2.4} aria-hidden="true" />
        </span>
        <PanelTitle title={t.title} subtitle={subtitle} />
      </div>
      <p className="text-sm leading-[1.55] text-fg-2">
        {rich(hasClass ? t.textWithClasses : t.text, { b: (chunk) => <b className="text-fg">{chunk}</b> })}
        {documentDeleted ? <span className="ml-1">{t.documentDeleted}</span> : null}
      </p>
      {hasClass ? (
        <div className="flex flex-wrap gap-2.5">
          <Link href={routes.classes} className={primary}>
            {t.classes}
          </Link>
          <Link href={newClassHref} className={secondaryButton}>
            <Plus className="size-[17px]" strokeWidth={2.4} aria-hidden="true" />
            {t.newClass}
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          <Link href={newClassHref} className={primary}>
            <Plus className="size-[17px]" strokeWidth={2.4} aria-hidden="true" />
            {t.firstClass}
          </Link>
          <Link href={routes.classes} className={secondaryButton}>
            {t.classes}
          </Link>
        </div>
      )}
    </Panel>
  );
}
