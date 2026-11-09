"use client";

import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getMessages } from "@/lib/i18n";
import { toClientScenario, toClientTraining } from "@/lib/lab/client";
import type { ScenarioContent, ScenarioTemplate, TrainingContent } from "@/lib/lab/content";
import { buildReportView } from "@/lib/lab/report";
import type { ScenarioReport } from "@/lib/lab/scoring";
import { ScenarioPlayer } from "../frame/ScenarioPlayer";
import { ReportScreen } from "../report/ReportScreen";
import { TrainingPlayer } from "../training/TrainingPlayer";
import { localDriver, localTrainingDriver, previewVersion } from "./local-driver";

type Common = { exitHref: string; playHref: string };

export type LabPreviewProps =
  | (Common & { kind: "scenario"; content: ScenarioContent; template: ScenarioTemplate; topic: string; avatar: string })
  | (Common & { kind: "training"; content: TrainingContent });

/**
 * Önizlemenin ince üst şeridi (masaüstü): bunun bir deneme olduğunu ve forma dönüşü gösterir.
 * Telefonda oynatıcı ekranı tam kaplar; oradaki kapat düğmesi zaten forma döner.
 */
function PreviewBar({ exitHref }: { exitHref: string }) {
  const t = getMessages().lab.preview;
  return (
    <div className="flex flex-none items-center gap-3 border-b border-accent/30 bg-accent/10 px-4 py-2 text-sm max-lg:hidden">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.8px] text-accent-fg">
        <Eye className="size-4" strokeWidth={2.2} aria-hidden="true" />
        {t.badge}
      </span>
      <span className="min-w-0 flex-1 truncate text-fg-2">{t.note}</span>
      <Link href={exitHref} className="ml-auto inline-flex min-h-9 items-center gap-1.5 font-bold text-accent-fg no-underline">
        <ArrowLeft className="size-4" strokeWidth={2.2} aria-hidden="true" />
        {t.back}
      </Link>
    </div>
  );
}

/**
 * Yönetimdeki "Öğrenci gibi dene": taslak, öğrencinin oynatıcısında açılır; kararlar sunucuya
 * değil tarayıcıdaki sürücüye gider (local-driver.ts), rapor sayfa değiştirmeden gösterilir ve
 * "Tekrar dene" her şeyi sıfırlar. Hiçbir şey kaydedilmez.
 */
export function LabPreview(props: LabPreviewProps) {
  const [round, setRound] = useState(0);
  const restart = () => {
    window.scrollTo(0, 0);
    setRound((r) => r + 1);
  };
  return (
    <main id="content" className="flex min-h-dvh flex-col">
      <PreviewBar exitHref={props.exitHref} />
      {props.kind === "scenario" ? <ScenarioRound key={round} {...props} onRestart={restart} /> : <TrainingRound key={round} {...props} />}
    </main>
  );
}

function ScenarioRound({
  content,
  template,
  topic,
  avatar,
  exitHref,
  playHref,
  onRestart,
}: Extract<LabPreviewProps, { kind: "scenario" }> & { onRestart: () => void }) {
  const t = getMessages().lab.preview;
  const [report, setReport] = useState<ScenarioReport | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [driver] = useState(() => localDriver(content, template, setReport));
  const [scenario] = useState(() => toClientScenario(content, template));

  if (showReport && report) {
    return (
      <ReportScreen
        view={buildReportView(content, template, report)}
        lab={{ name: content.meta.name, title: content.meta.title || content.meta.name, topic }}
        backHref={exitHref}
        crumbs={[]}
        facts={null}
        history={null}
        actions={{ next: { href: exitHref, label: t.back }, retry: playHref }}
        onRetry={onRestart}
      />
    );
  }
  return (
    <ScenarioPlayer
      driver={driver}
      scenario={scenario}
      version={previewVersion}
      avatar={avatar}
      resume={null}
      exitHref={exitHref}
      playHref={playHref}
      onReport={() => {
        window.scrollTo(0, 0);
        setShowReport(true);
      }}
    />
  );
}

function TrainingRound({ content, exitHref, playHref }: Extract<LabPreviewProps, { kind: "training" }>) {
  const [driver] = useState(() => localTrainingDriver(content));
  const [cards] = useState(() => toClientTraining(content));
  return (
    <TrainingPlayer
      driver={driver}
      title={content.meta.title || content.meta.name}
      cards={cards}
      startIndex={0}
      exitHref={exitHref}
      playHref={playHref}
      scenarios={[]}
      roadmapHref={exitHref}
    />
  );
}
