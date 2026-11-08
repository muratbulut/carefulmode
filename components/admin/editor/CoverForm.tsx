"use client";

import { difficulties, type LabContent, type Template } from "@/lib/lab/content";
import { format, getMessages } from "@/lib/i18n";
import { AddButton, Group, IconButton, inputClass, SelectField, TextAreaField, TextField } from "./fields";
import type { Edit } from "./types";
import { cn } from "@/lib/utils";

/** Kapak: ad, başlık, kısa açıklama, hikâye, zorluk, süre, öğrenilecekler ve hatırlatma kartı. */
export function CoverForm({ content, template, edit }: { content: LabContent; template: Template; edit: Edit<LabContent> }) {
  const t = getMessages();
  const e = t.admin.editor;
  const c = e.cover;
  const meta = content.meta;
  const reminders = "reminders" in content ? content.reminders : null;

  return (
    <>
      <TextField label={c.name} value={meta.name} maxLength={80} onChange={(v) => edit((d) => void (d.meta.name = v.target.value))} />
      <TextField
        label={c.title}
        value={meta.title}
        maxLength={80}
        placeholder={c.titlePlaceholder}
        onChange={(v) => edit((d) => void (d.meta.title = v.target.value))}
      />
      <TextField
        label={c.summary}
        hint={c.summaryHint}
        value={meta.summary}
        maxLength={200}
        onChange={(v) => edit((d) => void (d.meta.summary = v.target.value))}
      />
      <TextAreaField
        label={c.story}
        hint={c.storyHint}
        value={meta.story}
        maxLength={800}
        onChange={(v) => edit((d) => void (d.meta.story = v.target.value))}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
        <SelectField
          label={c.difficulty}
          value={meta.difficulty}
          options={difficulties.map((d) => ({ value: d, label: t.lab.difficulty[d] }))}
          onChange={(v) => edit((d) => void (d.meta.difficulty = v.target.value as (typeof difficulties)[number]))}
        />
        <TextField
          label={c.duration}
          type="number"
          inputMode="numeric"
          min={1}
          max={60}
          value={meta.durationMin}
          onChange={(v) => {
            const n = Math.round(Number(v.target.value));
            if (Number.isFinite(n) && v.target.value !== "") edit((d) => void (d.meta.durationMin = Math.min(60, Math.max(1, n))));
          }}
        />
      </div>

      <Group title={c.learn} hint={c.learnHint}>
        {meta.learn.map((point, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-line bg-surface-deep p-2.5">
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <input
                aria-label={format(c.learnTitle, { n: i + 1 })}
                value={point.title}
                maxLength={80}
                onChange={(v) => edit((d) => void (d.meta.learn[i].title = v.target.value))}
                className={cn(inputClass, "h-11 font-bold")}
              />
              <input
                aria-label={format(c.learnText, { n: i + 1 })}
                value={point.text}
                maxLength={240}
                onChange={(v) => edit((d) => void (d.meta.learn[i].text = v.target.value))}
                className={cn(inputClass, "h-11 text-[15px]")}
              />
            </span>
            <IconButton label={format(c.removeLearn, { n: i + 1 })} icon="delete" tone="danger" onClick={() => edit((d) => void d.meta.learn.splice(i, 1))} />
          </div>
        ))}
        {meta.learn.length < 3 ? (
          <AddButton onClick={() => edit((d) => void d.meta.learn.push({ title: "", text: "" }))}>{c.addLearn}</AddButton>
        ) : null}
      </Group>

      {reminders && template !== "TRAINING" ? (
        <Group title={c.reminders} hint={c.remindersHint}>
          {reminders.map((reminder, i) => (
            <span key={i} className="flex items-center gap-2">
              <span aria-hidden="true" className="w-5 flex-none text-sm font-bold text-fg-3">
                {format(e.numbered, { n: i + 1 })}
              </span>
              <input
                aria-label={format(c.reminder, { n: i + 1 })}
                value={reminder}
                maxLength={160}
                onChange={(v) =>
                  edit((d) => {
                    if ("reminders" in d) d.reminders[i] = v.target.value;
                  })
                }
                className={cn(inputClass, "h-11")}
              />
              <IconButton
                label={format(c.removeReminder, { n: i + 1 })}
                icon="delete"
                tone="danger"
                onClick={() =>
                  edit((d) => {
                    if ("reminders" in d) d.reminders.splice(i, 1);
                  })
                }
              />
            </span>
          ))}
          {reminders.length < 4 ? (
            <AddButton
              onClick={() =>
                edit((d) => {
                  if ("reminders" in d) d.reminders.push("");
                })
              }
            >
              {c.addReminder}
            </AddButton>
          ) : null}
        </Group>
      ) : null}
    </>
  );
}
