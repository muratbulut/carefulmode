"use client";

import { format, getMessages, rich } from "@/lib/i18n";
import { tipConditions, type ScenarioContent, type ScenarioTemplate, type TipCondition } from "@/lib/lab/content";
import { cn } from "@/lib/utils";
import { AddButton, Group, IconButton, inputClass } from "./fields";
import type { Edit } from "./types";

/** Rapor: puan ve durum kuralı (bilgi) ve "Bir dahaki sefere" ipuçları. */
export function ReportForm({
  content,
  template,
  edit,
  shown,
}: {
  content: ScenarioContent;
  template: ScenarioTemplate;
  edit: Edit<ScenarioContent>;
  /** "Öğrenci gibi dene" yolunda rapora çıkan ipuçlarının sırası. */
  shown: number[];
}) {
  const r = getMessages().admin.editor.report;

  return (
    <>
      <p className="m-0 rounded-xl border border-line bg-surface-deep px-3.5 py-3 text-sm leading-[1.55] text-fg-2">
        {rich(r.scale[template], {
          safe: (chunk) => <b className="text-success-fg">{chunk}</b>,
          risky: (chunk) => <b className="text-warning-fg">{chunk}</b>,
          hacked: (chunk) => <b className="text-alarm-pink">{chunk}</b>,
        })}
      </p>
      <Group title={r.tips}>
        {content.tips.map((tip, i) => {
          const on = shown.includes(i);
          return (
            <div key={i} className={cn("flex flex-col gap-2 rounded-xl border bg-surface-deep p-2.5", on ? "border-success/45" : "border-line")}>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={format(r.whenLabel, { n: i + 1 })}
                  value={tip.when}
                  onChange={(v) => edit((d) => void (d.tips[i].when = v.target.value as TipCondition))}
                  className={cn(inputClass, "h-10 w-auto min-w-0 flex-1 px-2.5 text-sm font-bold")}
                >
                  {tipConditions.map((c) => (
                    <option key={c} value={c}>
                      {r.conditions[template][c]}
                    </option>
                  ))}
                </select>
                {on ? <span className="rounded-full bg-success/12 px-2 py-[3px] text-[11px] font-bold text-success-fg">{r.shown}</span> : null}
                <IconButton label={format(r.removeTip, { n: i + 1 })} icon="delete" tone="danger" onClick={() => edit((d) => void d.tips.splice(i, 1))} />
              </div>
              <input
                aria-label={format(r.tip, { n: i + 1 })}
                value={tip.text}
                maxLength={240}
                onChange={(v) => edit((d) => void (d.tips[i].text = v.target.value))}
                className={cn(inputClass, "h-11 text-[15px]")}
              />
            </div>
          );
        })}
        {content.tips.length < 8 ? (
          <AddButton onClick={() => edit((d) => void d.tips.push({ text: "", when: "always" }))}>{r.addTip}</AddButton>
        ) : null}
      </Group>
    </>
  );
}
