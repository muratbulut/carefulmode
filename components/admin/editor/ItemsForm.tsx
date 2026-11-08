"use client";

import type { ReactNode } from "react";
import { Paperclip } from "lucide-react";
import { blankItem, colorIndex, freeSignPlaces, moveItem, nextId } from "@/lib/admin/editor-model";
import { format, getMessages } from "@/lib/i18n";
import type { ScenarioContent, ScenarioTemplate } from "@/lib/lab/content";
import { cn } from "@/lib/utils";
import { avatarColors } from "../colors";
import { AddButton, Group, IconButton, inputClass, PickRow, RowTools, SelectField, TextAreaField, TextField } from "./fields";
import type { Edit, Say } from "./types";

/** Öğenin listede görünen başlığı: konu, yoksa metnin ilk satırı. */
export function itemHeadline(item: { subject: string; body: string }) {
  return item.subject.trim() || item.body.trim().split("\n")[0] || "";
}

export function SenderAvatar({ name, className }: { name: string; className?: string }) {
  const letter = name.trim().charAt(0).toLocaleUpperCase("tr");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-[30px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-scene-white",
        avatarColors[colorIndex(name.trim(), avatarColors.length)],
        className,
      )}
    >
      {letter}
    </span>
  );
}

/** Gelen kutusu / Mesajlar: öğe listesi ve seçili öğenin formu (Lab-Duzenle-Son, -SMS). */
export function ItemsForm({
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
  const m = e.items;
  const items = content.items;
  const item = items[index];

  const add = () => {
    edit((d) => void d.items.push(blankItem(nextId("item", d.items.map((x) => x.id)))));
    setIndex(items.length);
    say(m.added[template]);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => {
          const name = it.sender.trim() || m.untitled[template];
          return (
            <PickRow key={it.id} selected={i === index} onClick={() => setIndex(i)}>
              <SenderAvatar name={name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-sm">{itemHeadline(it) || name}</b>
                <span className="truncate text-xs text-fg-3">{name}</span>
              </span>
              <span
                className={cn(
                  "flex-none rounded-full px-2 py-[3px] text-[11px] font-bold",
                  it.kind === "fake" ? "bg-danger/14 text-danger-fg" : "bg-success/14 text-success-fg",
                )}
              >
                {m.kinds[it.kind]}
              </span>
            </PickRow>
          );
        })}
        <AddButton onClick={add} disabled={items.length >= 8}>
          {m.add[template]}
        </AddButton>
      </div>

      {!item ? (
        <p className="m-0 text-sm text-fg-3">{m.empty[template]}</p>
      ) : (
        <ItemFields
          key={item.id}
          content={content}
          template={template}
          edit={edit}
          index={index}
          tools={
            <div className="flex items-center justify-between gap-2 border-t border-card pt-3">
              <span className="text-xs font-bold tracking-[0.5px] text-fg-3">{format(m.position[template], { n: index + 1, total: items.length })}</span>
              <RowTools
                labels={{ up: e.moveUp, down: e.moveDown, remove: m.remove[template] }}
                up={
                  index > 0
                    ? () => {
                        edit((d) => void (d.items = moveItem(d.items, index, -1)));
                        setIndex(index - 1);
                      }
                    : undefined
                }
                down={
                  index < items.length - 1
                    ? () => {
                        edit((d) => void (d.items = moveItem(d.items, index, 1)));
                        setIndex(index + 1);
                      }
                    : undefined
                }
                remove={() => {
                  edit((d) => void d.items.splice(index, 1));
                  setIndex(Math.max(0, index - 1));
                  say(m.removed[template]);
                }}
              />
            </div>
          }
        />
      )}
    </>
  );
}

function ItemFields({
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
  const t = getMessages();
  const m = t.admin.editor.items;
  const item = content.items[index];
  const set = (change: (it: ScenarioContent["items"][number]) => void) => edit((d) => change(d.items[index]));
  const inbox = template === "INBOX";
  const free = freeSignPlaces(template, item);

  return (
    <>
      {tools}
      <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        <TextField label={m.senderName[template]} value={item.sender} maxLength={60} onChange={(v) => set((it) => void (it.sender = v.target.value))} />
        <TextField
          label={m.address[template]}
          value={item.address}
          maxLength={80}
          mono
          onChange={(v) => set((it) => void (it.address = v.target.value))}
        />
      </div>
      <div className={cn("grid gap-3", inbox ? "grid-cols-[minmax(0,1fr)_96px] @md:grid-cols-[minmax(0,1fr)_96px_150px]" : "grid-cols-[96px_minmax(0,1fr)]")}>
        {inbox ? (
          <TextField label={m.subject} value={item.subject} maxLength={120} onChange={(v) => set((it) => void (it.subject = v.target.value))} />
        ) : null}
        <TextField
          label={m.time}
          value={item.time}
          maxLength={20}
          placeholder={m.timePlaceholder}
          onChange={(v) => set((it) => void (it.time = v.target.value))}
        />
        <SelectField
          label={m.kind[template]}
          value={item.kind}
          className={inbox ? "col-span-2 @md:col-span-1" : undefined}
          options={(["fake", "real"] as const).map((k) => ({ value: k, label: m.kindOptions[k] }))}
          onChange={(v) =>
            set((it) => {
              it.kind = v.target.value === "fake" ? "fake" : "real";
              // Gerçek öğede işaret olmaz (raporda yalnızca sahtelerin işaretleri gösterilir).
              if (it.kind === "real") it.signs = [];
            })
          }
        />
      </div>
      <TextAreaField
        label={m.body}
        hint={m.bodyHint}
        rows={5}
        value={item.body}
        maxLength={1200}
        onChange={(v) => set((it) => void (it.body = v.target.value))}
      />

      <Group title={m.link} hint={m.linkHint}>
        {item.link ? (
          <div className="flex items-start gap-2">
            <span className="grid min-w-0 flex-1 grid-cols-1 gap-2 @md:grid-cols-[minmax(0,1fr)_150px]">
              <input
                aria-label={m.linkUrl}
                value={item.link.url}
                maxLength={120}
                placeholder={m.linkUrlPlaceholder}
                onChange={(v) => {
                  const url = v.target.value.replace(/[\s<>"']/g, "");
                  set((it) => void (it.link = { url, text: it.link?.text ?? "" }));
                }}
                className={cn(inputClass, "h-11 font-mono text-[15px]")}
              />
              <input
                aria-label={m.linkText}
                placeholder={m.linkText}
                value={item.link.text}
                maxLength={40}
                onChange={(v) => set((it) => void (it.link = { url: it.link?.url ?? "", text: v.target.value }))}
                className={cn(inputClass, "h-11 text-[15px]")}
              />
            </span>
            <IconButton label={m.removeLink} icon="delete" tone="danger" onClick={() => set((it) => void (it.link = null))} />
          </div>
        ) : (
          <AddButton onClick={() => set((it) => void (it.link = { url: "", text: "" }))}>{m.addLink}</AddButton>
        )}
      </Group>

      {inbox ? (
        <>
          <TextField
            label={m.footer}
            hint={m.footerHint}
            value={item.footer}
            maxLength={300}
            onChange={(v) => set((it) => void (it.footer = v.target.value))}
          />
          <Group title={m.attachment}>
            {item.attachment ? (
              <div className="flex items-center gap-2">
                <Paperclip className="size-4 flex-none text-fg-3" strokeWidth={2} aria-hidden="true" />
                <input
                  aria-label={m.attachmentName}
                  placeholder={m.attachmentName}
                  value={item.attachment.name}
                  maxLength={60}
                  onChange={(v) => set((it) => void (it.attachment = { name: v.target.value, size: it.attachment?.size ?? "" }))}
                  className={cn(inputClass, "h-11 min-w-0 flex-1 font-mono text-[15px]")}
                />
                <input
                  aria-label={m.attachmentSize}
                  placeholder={m.attachmentSize}
                  value={item.attachment.size}
                  maxLength={20}
                  onChange={(v) => set((it) => void (it.attachment = { name: it.attachment?.name ?? "", size: v.target.value }))}
                  className={cn(inputClass, "h-11 w-[96px] flex-none text-[15px]")}
                />
                <IconButton label={m.removeAttachment} icon="delete" tone="danger" onClick={() => set((it) => void (it.attachment = null))} />
              </div>
            ) : (
              <AddButton onClick={() => set((it) => void (it.attachment = { name: "", size: "" }))}>{m.addAttachment}</AddButton>
            )}
          </Group>
        </>
      ) : null}

      {item.kind === "fake" ? (
        <Group title={m.signs} hint={format(m.signsHint, { item: m.signItem[template] })}>
          {item.signs.map((sign, j) => (
            <div key={`${sign.at}-${j}`} className="flex flex-col gap-2 rounded-xl border border-line bg-surface-deep p-2.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-[22px] flex-none items-center justify-center rounded-full bg-scene-red text-xs font-extrabold text-scene-white"
                >
                  {j + 1}
                </span>
                <span className="w-[64px] flex-none text-xs font-bold text-fg-3">{m.places[sign.at]}</span>
                <input
                  aria-label={format(m.signText, { n: j + 1 })}
                  placeholder={m.signPlaceholder}
                  value={sign.text}
                  maxLength={300}
                  onChange={(v) => set((it) => void (it.signs[j].text = v.target.value))}
                  className={cn(inputClass, "h-11 min-w-0 flex-1 text-[15px]")}
                />
                <IconButton
                  label={format(m.removeSign, { n: j + 1 })}
                  icon="delete"
                  tone="danger"
                  onClick={() => set((it) => void it.signs.splice(j, 1))}
                />
              </div>
              <input
                aria-label={format(m.signQuote, { n: j + 1 })}
                placeholder={m.signQuotePlaceholder}
                value={sign.quote}
                maxLength={120}
                onChange={(v) => set((it) => void (it.signs[j].quote = v.target.value))}
                className={cn(inputClass, "h-10 text-sm")}
              />
            </div>
          ))}
          {free.length ? (
            <div className="flex flex-wrap gap-2">
              {free.map((place) => (
                <button
                  key={place}
                  type="button"
                  onClick={() => set((it) => void it.signs.push({ at: place, text: "", quote: "" }))}
                  className="h-9 rounded-[10px] border border-dashed border-line-strong px-3 text-[13px] font-bold text-fg-2 hover:border-accent"
                >
                  {format(m.addSign, { place: m.places[place] })}
                </button>
              ))}
            </div>
          ) : null}
        </Group>
      ) : null}

      <TextAreaField
        label={m.why}
        value={item.why}
        maxLength={400}
        rows={2}
        placeholder={format(m.whyPlaceholder, { item: m.signItem[template] })}
        onChange={(v) => set((it) => void (it.why = v.target.value))}
      />
    </>
  );
}
