"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { AlertTriangle, Play } from "lucide-react";
import { fakeChoicesFor, outcomePoints, realChoices, type TryPath } from "@/lib/admin/try-path";
import { format, getMessages } from "@/lib/i18n";
import type { ScenarioContent, ScenarioTemplate } from "@/lib/lab/content";
import type { FakeOutcome, RealOutcome, ScenarioReport } from "@/lib/lab/scoring";
import { cn } from "@/lib/utils";
import { Kicker, ReportSummary } from "./Preview";
import { letter } from "./TasksForm";

/**
 * "Öğrenci gibi dene" (Lab-Duzenle-Son): her öğe ve soru için öğrencinin ne yaptığını seç, rapor
 * anında değişir. Seçimler gerçek lab olaylarına çevrilip öğrencinin raporuyla aynı fonksiyonla
 * puanlanır (lib/admin/try-path.ts).
 */
export function TryPanel({
  content,
  template,
  path,
  report,
  onChange,
  previewHref,
}: {
  content: ScenarioContent;
  template: ScenarioTemplate;
  path: TryPath;
  report: ScenarioReport;
  onChange: (path: TryPath) => void;
  previewHref: string;
}) {
  const t = getMessages().admin.editor;
  const d = t.tryPanel;
  const questions = content.tasks.filter((task) => task.type === "question");

  return (
    <>
      <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-4">
        <span className="text-[13px] leading-normal text-fg-3">{d.intro}</span>
        {content.items.length === 0 ? <span className="text-sm text-fg-3">{d.noItems}</span> : null}
        {content.items.map((item) => {
          const name = item.sender.trim() || t.items.untitled[template];
          const fake = item.kind === "fake";
          const choices = (fake ? fakeChoicesFor(content) : realChoices) as readonly (FakeOutcome | RealOutcome)[];
          const chosen = path.items[item.id] ?? (fake ? "reported" : "kept");
          return (
            <Choices
              key={item.id}
              title={format(fake ? d.fakeLabel[template] : d.realLabel[template], { name })}
              options={choices.map((outcome) => ({
                value: outcome,
                label: fake ? d.fake[template][outcome as FakeOutcome] : d.real[template][outcome as RealOutcome],
                points: outcomePoints(item.kind, outcome, template),
              }))}
              selected={chosen}
              onSelect={(value) => onChange({ ...path, items: { ...path.items, [item.id]: value as FakeOutcome | RealOutcome } })}
            />
          );
        })}
        {content.mission
          ? content.tasks
              .filter((task) => task.type === "mission")
              .map((task) => (
                <Choices
                  key={task.id}
                  title={task.text.trim() || t.tasks.untitled}
                  options={[
                    { value: "done", label: (content.mission?.sale ? d.missionSale : d.mission).done, points: 1 },
                    { value: "undone", label: (content.mission?.sale ? d.missionSale : d.mission).undone, points: 0 },
                  ]}
                  selected={path.missionDone === false ? "undone" : "done"}
                  onSelect={(value) => onChange({ ...path, missionDone: value === "done" })}
                />
              ))
          : null}
        {questions.map((task) => (
          <Choices
            key={task.id}
            title={task.text.trim() || t.tasks.untitled}
            options={task.options.map((o, i) => ({ value: String(i), label: `${letter(i)}. ${o.text}`, points: o.points }))}
            selected={String(path.answers[task.id] ?? "")}
            onSelect={(value) => onChange({ ...path, answers: { ...path.answers, [task.id]: Number(value) } })}
          />
        ))}
      </div>
      {report.status === "hacked" ? (
        <div className="flex gap-2.5 rounded-xl border border-alarm-pink/35 bg-alarm-pink/7 px-3.5 py-3 text-[13px] leading-normal text-alarm-pink-soft">
          <AlertTriangle className="mt-0.5 size-4 flex-none text-alarm-pink" strokeWidth={2.2} aria-hidden="true" />
          {d.hackFirst}
        </div>
      ) : null}
      <Kicker icon={false}>{d.report}</Kicker>
      <ReportSummary content={content} template={template} report={report} />
      <Link href={previewHref} className="-my-2.5 inline-flex min-h-10 items-center gap-1.5 self-start text-sm font-bold text-accent-fg no-underline">
        <Play className="size-4" strokeWidth={2.2} aria-hidden="true" />
        {d.playAll}
      </Link>
    </>
  );
}

function Choices({
  title,
  options,
  selected,
  onSelect,
}: {
  title: ReactNode;
  options: { value: string; label: string; points: number }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const id = useId();
  const d = getMessages().admin.editor.tryPanel;
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-[13px] font-bold text-fg-2">
        {title}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === selected;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(o.value)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border px-2.5 py-1.5 text-left text-[13px] font-bold transition-colors",
                on ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-fg-2 hover:border-line-strong",
              )}
            >
              {o.label}
              <span className={cn("text-xs", on ? "text-on-accent/80" : "text-fg-4")}>{format(d.points, { n: o.points })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
