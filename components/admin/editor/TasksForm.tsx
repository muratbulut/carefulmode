"use client";

import type { ReactNode } from "react";
import { blankTask, moveItem, nextId, taskMax } from "@/lib/admin/editor-model";
import { format, getMessages } from "@/lib/i18n";
import { maxScore, rawTotal, type ScenarioContent, type ScenarioTemplate, type TaskType } from "@/lib/lab/content";
import { cn } from "@/lib/utils";
import { AddButton, Group, IconButton, inputClass, PickRow, RowTools, TextAreaField, TextField } from "./fields";
import type { Edit, Say } from "./types";

export const taskKindClass: Record<TaskType, string> = {
  action: "bg-accent/12 text-accent-fg",
  review: "bg-purple/12 text-purple-fg",
  question: "bg-warning/12 text-warning-fg",
  mission: "bg-orange/12 text-orange-fg",
};

export const letter = (index: number) => String.fromCharCode(65 + index);

/** Görevler: liste, toplam puan ve seçili görevin formu (Lab-Duzenle-Son "Görevler"). */
export function TasksForm({
  content,
  template,
  edit,
  index,
  setIndex,
  say,
}: {
  content: ScenarioContent;
  template: ScenarioTemplate;
  edit: Edit<ScenarioContent>;
  index: number;
  setIndex: (index: number) => void;
  say: Say;
}) {
  const e = getMessages().admin.editor;
  const k = e.tasks;
  const tasks = content.tasks;
  const task = tasks[index];
  const total = maxScore(content);

  const add = (type: TaskType) => {
    edit((d) => void d.tasks.push(blankTask(nextId(type, d.tasks.map((x) => x.id)), type)));
    setIndex(tasks.length);
    say(k.added);
  };
  const has = (type: TaskType) => tasks.some((x) => x.type === type);

  return (
    <>
      <div className="flex flex-col gap-2">
        {tasks.map((tk, i) => (
          <PickRow key={tk.id} selected={i === index} onClick={() => setIndex(i)}>
            <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-card text-[13px] font-extrabold text-fg-2">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{tk.text.trim() || k.untitled}</span>
            <span className={cn("flex-none rounded-md px-[7px] py-[3px] text-[11px] font-extrabold tracking-[0.8px]", taskKindClass[tk.type])}>
              {k.kinds[tk.type]}
            </span>
          </PickRow>
        ))}
        <div className="flex flex-wrap gap-2">
          {has("action") ? null : (
            <AddButton onClick={() => add("action")} disabled={tasks.length >= 8} className="flex-1">
              {k.addAction}
            </AddButton>
          )}
          {has("review") ? null : (
            <AddButton onClick={() => add("review")} disabled={tasks.length >= 8} className="flex-1">
              {k.addReview}
            </AddButton>
          )}
          <AddButton onClick={() => add("question")} disabled={tasks.length >= 8} className="flex-1">
            {k.addQuestion}
          </AddButton>
        </div>
        <span className={cn("text-[13px] font-bold", total === rawTotal ? "text-success-fg" : "text-warning-fg")}>
          {format(k.total, { n: total })}
        </span>
      </div>

      {!task ? (
        <p className="m-0 text-sm text-fg-3">{k.empty}</p>
      ) : (
        <TaskFields
          key={task.id}
          content={content}
          template={template}
          edit={edit}
          index={index}
          tools={
            <RowTools
              labels={{ up: e.moveUp, down: e.moveDown, remove: k.remove }}
              up={
                index > 0
                  ? () => {
                      edit((d) => void (d.tasks = moveItem(d.tasks, index, -1)));
                      setIndex(index - 1);
                    }
                  : undefined
              }
              down={
                index < tasks.length - 1
                  ? () => {
                      edit((d) => void (d.tasks = moveItem(d.tasks, index, 1)));
                      setIndex(index + 1);
                    }
                  : undefined
              }
              remove={() => {
                edit((d) => void d.tasks.splice(index, 1));
                setIndex(Math.max(0, index - 1));
                say(k.removed);
              }}
            />
          }
        />
      )}
    </>
  );
}

function TaskFields({
  content,
  template,
  edit,
  index,
  tools,
}: {
  content: ScenarioContent;
  template: ScenarioTemplate;
  edit: Edit<ScenarioContent>;
  index: number;
  tools: ReactNode;
}) {
  const k = getMessages().admin.editor.tasks;
  const task = content.tasks[index];
  const set = (change: (draft: ScenarioContent["tasks"][number]) => void) => edit((d) => change(d.tasks[index]));
  const max = taskMax(task, content.items);

  return (
    <>
      <div className="flex items-center gap-2.5 border-t border-card pt-3">
        <span className={cn("flex-none rounded-md px-[7px] py-[3px] text-[11px] font-extrabold tracking-[0.8px]", taskKindClass[task.type])}>
          {k.kinds[task.type]}
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-bold text-fg-3">
          {task.type === "action" ? format(k.headerNoPoints, { n: index + 1 }) : format(k.header, { n: index + 1, max })}
        </span>
        {tools}
      </div>
      <TextField
        label={k.text}
        value={task.text}
        maxLength={200}
        placeholder={task.type === "question" ? k.textPlaceholder.question : k.textPlaceholder[task.type][template]}
        onChange={(v) => set((d) => void (d.text = v.target.value))}
      />

      {task.type === "question" ? (
        <Group title={k.options} hint={k.optionsHint}>
          {task.options.map((option, j) => {
            const best = option.points === max && max > 0;
            return (
              <div key={j} className="flex items-center gap-2">
                <span aria-hidden="true" className="w-5 flex-none text-center text-sm font-extrabold text-fg-3">
                  {letter(j)}
                </span>
                <input
                  aria-label={format(k.option, { letter: letter(j) })}
                  value={option.text}
                  maxLength={160}
                  onChange={(v) => set((d) => void (d.options[j].text = v.target.value))}
                  className={cn(inputClass, "h-11 min-w-0 flex-1 text-[15px]")}
                />
                <select
                  aria-label={format(k.optionPoints, { letter: letter(j) })}
                  value={option.points}
                  onChange={(v) => set((d) => void (d.options[j].points = Number(v.target.value)))}
                  className={cn(
                    inputClass,
                    "h-11 w-[104px] flex-none px-2.5 text-sm font-bold",
                    best ? "text-success-fg" : option.points > 0 ? "text-warning-fg" : "text-fg-4",
                  )}
                >
                  {[0, 1, 2, 3, 4].map((p) => (
                    <option key={p} value={p}>
                      {format(k.points, { n: p })}
                    </option>
                  ))}
                </select>
                {task.options.length > 3 ? (
                  <IconButton label={format(k.removeOption, { letter: letter(j) })} icon="delete" tone="danger" onClick={() => set((d) => void d.options.splice(j, 1))} />
                ) : null}
              </div>
            );
          })}
          {task.options.length < 4 ? (
            <AddButton onClick={() => set((d) => void d.options.push({ text: "", points: 0 }))}>{k.addOption}</AddButton>
          ) : null}
        </Group>
      ) : (
        <p className="m-0 rounded-xl border border-line bg-surface-deep px-3.5 py-3 text-[13px] leading-normal text-fg-3">
          {task.type === "review" ? k.reviewNote[template] : task.type === "mission" ? k.missionNote[template] : k.actionNote[template]}
        </p>
      )}

      {/* "Doğrusu" ve "Neden?" yalnızca soruda: raporda BİLDİR görevinin kendi satırı yok, mail ve
          mesaj satırları kendi metinlerini kullanır (sabah soruları 25b). */}
      {task.type !== "question" && task.type !== "mission" ? null : (
        <>
          <TextAreaField label={k.right} value={task.right} maxLength={300} rows={2} onChange={(v) => set((d) => void (d.right = v.target.value))} />
          <TextAreaField label={k.why} value={task.why} maxLength={400} rows={2} onChange={(v) => set((d) => void (d.why = v.target.value))} />
        </>
      )}
    </>
  );
}
