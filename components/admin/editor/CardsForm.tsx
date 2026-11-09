"use client";

import { useId, type ReactNode } from "react";
import { blankCard, moveItem, nextId } from "@/lib/admin/editor-model";
import { format, getMessages } from "@/lib/i18n";
import { cardIcons, infoLayouts, quizArts, sortColors, type Card, type CardIcon, type CardType, type TrainingContent } from "@/lib/lab/content";
import { cn } from "@/lib/utils";
import { AddButton, Group, IconButton, inputClass, PickRow, RowTools, SelectField, TextAreaField, TextField } from "./fields";
import { letter } from "./TasksForm";
import type { Edit, Say } from "./types";

const cardTypes: CardType[] = ["info", "clickFind", "quiz", "video", "match", "sort", "fill"];

export const cardKindClass: Record<CardType, string> = {
  info: "bg-accent/12 text-accent-fg",
  clickFind: "bg-purple/12 text-purple-fg",
  quiz: "bg-warning/12 text-warning-fg",
  video: "bg-success/12 text-success-fg",
  match: "bg-orange/12 text-orange-fg",
  sort: "bg-danger/12 text-danger-fg",
  fill: "bg-pink/12 text-pink-fg",
};

export function cardTitle(card: Card) {
  return card.type === "quiz" ? card.question : card.title;
}

/** Eğitim labının kartları: liste, kart ekleme ve seçili kartın türüne göre formu. */
export function CardsForm({
  content,
  edit,
  index,
  setIndex,
  say,
}: {
  content: TrainingContent;
  edit: Edit<TrainingContent>;
  index: number;
  setIndex: (index: number) => void;
  say: Say;
}) {
  const e = getMessages().admin.editor;
  const c = e.cards;
  const cards = content.cards;
  const card = cards[index];

  const add = (type: CardType) => {
    edit((d) => void d.cards.push(blankCard(nextId(type.toLowerCase(), d.cards.map((x) => x.id)), type)));
    setIndex(cards.length);
    say(c.added);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {cards.map((it, i) => (
          <PickRow key={it.id} selected={i === index} onClick={() => setIndex(i)}>
            <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-card text-[13px] font-extrabold text-fg-2">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">{cardTitle(it).trim() || c.untitled}</span>
            <span className={cn("flex-none rounded-md px-[7px] py-[3px] text-[11px] font-extrabold", cardKindClass[it.type])}>{c.types[it.type]}</span>
          </PickRow>
        ))}
        {cards.length === 0 ? <p className="m-0 text-sm text-fg-3">{c.empty}</p> : null}
        {/* Telefonda tek sütun: "+ Tıkla-bul kartı" gibi adlar iki sütunda iki satıra kırılıyordu. */}
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
          {cardTypes.map((type) => (
            <AddButton key={type} onClick={() => add(type)} disabled={cards.length >= 20}>
              {format(c.add, { type: c.types[type] })}
            </AddButton>
          ))}
        </div>
      </div>

      {card ? (
        <>
          <div className="flex items-center gap-2.5 border-t border-card pt-3">
            <span className={cn("flex-none rounded-md px-[7px] py-[3px] text-[11px] font-extrabold", cardKindClass[card.type])}>{c.types[card.type]}</span>
            <span className="min-w-0 flex-1 text-[13px] font-bold text-fg-3">{format(c.header, { n: index + 1, type: c.types[card.type] })}</span>
            <RowTools
              labels={{ up: e.moveUp, down: e.moveDown, remove: c.remove }}
              up={
                index > 0
                  ? () => {
                      edit((d) => void (d.cards = moveItem(d.cards, index, -1)));
                      setIndex(index - 1);
                    }
                  : undefined
              }
              down={
                index < cards.length - 1
                  ? () => {
                      edit((d) => void (d.cards = moveItem(d.cards, index, 1)));
                      setIndex(index + 1);
                    }
                  : undefined
              }
              remove={() => {
                edit((d) => void d.cards.splice(index, 1));
                setIndex(Math.max(0, index - 1));
                say(c.removed);
              }}
            />
          </div>
          <CardFields key={card.id} card={card} edit={(change) => edit((d) => change(d.cards[index]))} />
        </>
      ) : null}
    </>
  );
}

function CardFields({ card, edit }: { card: Card; edit: Edit<Card> }) {
  const c = getMessages().admin.editor.cards;
  switch (card.type) {
    case "info":
      return (
        <>
          <TextField label={c.title} value={card.title} maxLength={120} onChange={(v) => edit((d) => d.type === "info" && void (d.title = v.target.value))} />
          <SelectField
            label={c.layout}
            hint={c.layoutHint}
            value={card.layout ?? "list"}
            options={infoLayouts.map((value) => ({ value, label: c.layouts[value] }))}
            onChange={(v) =>
              edit((d) => {
                if (d.type !== "info") return;
                const layout = v.target.value as (typeof infoLayouts)[number];
                if (layout === "list") delete d.layout;
                else d.layout = layout;
              })
            }
          />
          <StringList
            title={c.paragraphs}
            values={card.paragraphs}
            max={4}
            multiline
            label={(n) => format(c.paragraph, { n })}
            removeLabel={(n) => format(c.removeParagraph, { n })}
            addLabel={c.addParagraph}
            maxLength={500}
            onChange={(values) => edit((d) => d.type === "info" && void (d.paragraphs = values))}
          />
          <Group title={c.points}>
            {card.points.map((point, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-line bg-surface-deep p-2.5">
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <input
                    aria-label={format(c.pointTitle, { n: i + 1 })}
                    value={point.title}
                    maxLength={80}
                    onChange={(v) => edit((d) => d.type === "info" && void (d.points[i].title = v.target.value))}
                    className={cn(inputClass, "h-11 font-bold")}
                  />
                  <input
                    aria-label={format(c.pointText, { n: i + 1 })}
                    value={point.text}
                    maxLength={240}
                    onChange={(v) => edit((d) => d.type === "info" && void (d.points[i].text = v.target.value))}
                    className={cn(inputClass, "h-11 text-[15px]")}
                  />
                  <IconSelect
                    label={format(c.pointIcon, { n: i + 1 })}
                    empty={c.iconDefault}
                    value={point.icon}
                    onChange={(icon) => edit((d) => d.type === "info" && setIcon(d.points[i], icon))}
                  />
                </span>
                <IconButton
                  label={format(c.removePoint, { n: i + 1 })}
                  icon="delete"
                  tone="danger"
                  onClick={() => edit((d) => d.type === "info" && void d.points.splice(i, 1))}
                />
              </div>
            ))}
            {card.points.length < 4 ? (
              <AddButton onClick={() => edit((d) => d.type === "info" && void d.points.push({ title: "", text: "" }))}>{c.addPoint}</AddButton>
            ) : null}
          </Group>
        </>
      );

    case "clickFind": {
      const mail = card.mail;
      const parts = [
        ...(["sender", "address", "subject"] as const).map((p) => ({ value: p, label: c.parts[p] })),
        ...mail.paragraphs.map((_, i) => ({ value: `p${i}`, label: format(c.parts.paragraph, { n: i + 1 }) })),
        ...(["button", "footer"] as const).map((p) => ({ value: p, label: c.parts[p] })),
      ];
      const setMail = (change: (m: typeof mail) => void) => edit((d) => d.type === "clickFind" && change(d.mail));
      return (
        <>
          <TextField label={c.title} value={card.title} maxLength={120} onChange={(v) => edit((d) => d.type === "clickFind" && void (d.title = v.target.value))} />
          <TextField
            label={c.hint}
            value={card.hint}
            maxLength={160}
            placeholder={c.hintPlaceholder}
            onChange={(v) => edit((d) => d.type === "clickFind" && void (d.hint = v.target.value))}
          />
          <Group title={c.mail}>
            <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
              <TextField label={c.mailSender} value={mail.sender} maxLength={60} onChange={(v) => setMail((m) => void (m.sender = v.target.value))} />
              <TextField label={c.mailAddress} mono value={mail.address} maxLength={80} onChange={(v) => setMail((m) => void (m.address = v.target.value))} />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
              <TextField label={c.mailSubject} value={mail.subject} maxLength={120} onChange={(v) => setMail((m) => void (m.subject = v.target.value))} />
              <TextField label={c.mailTime} value={mail.time} maxLength={20} onChange={(v) => setMail((m) => void (m.time = v.target.value))} />
            </div>
            <StringList
              title={c.paragraphs}
              values={mail.paragraphs}
              max={6}
              multiline
              label={(n) => format(c.paragraph, { n })}
              removeLabel={(n) => format(c.removeParagraph, { n })}
              addLabel={c.addParagraph}
              maxLength={400}
              onChange={(values) => setMail((m) => void (m.paragraphs = values))}
            />
            <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
              <TextField label={c.mailButton} value={mail.button} maxLength={40} onChange={(v) => setMail((m) => void (m.button = v.target.value))} />
              <TextField label={c.mailFooter} value={mail.footer} maxLength={200} onChange={(v) => setMail((m) => void (m.footer = v.target.value))} />
            </div>
          </Group>
          <Group title={c.spots} hint={c.spotsHint}>
            {card.spots.map((spot, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-xl border border-line bg-surface-deep p-2.5">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-[22px] flex-none items-center justify-center rounded-full bg-scene-red text-xs font-extrabold text-scene-white"
                  >
                    {i + 1}
                  </span>
                  <select
                    aria-label={format(c.spotPart, { n: i + 1 })}
                    value={spot.part}
                    onChange={(v) => edit((d) => d.type === "clickFind" && void (d.spots[i].part = v.target.value))}
                    className={cn(inputClass, "h-10 min-w-0 flex-1 px-2.5 text-sm")}
                  >
                    {parts.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <IconButton
                    label={format(c.removeSpot, { n: i + 1 })}
                    icon="delete"
                    tone="danger"
                    onClick={() => edit((d) => d.type === "clickFind" && void d.spots.splice(i, 1))}
                  />
                </div>
                <input
                  aria-label={format(c.spotText, { n: i + 1 })}
                  value={spot.text}
                  maxLength={300}
                  onChange={(v) => edit((d) => d.type === "clickFind" && void (d.spots[i].text = v.target.value))}
                  className={cn(inputClass, "h-11 text-[15px]")}
                />
              </div>
            ))}
            {card.spots.length < 5 ? (
              <AddButton
                onClick={() =>
                  edit((d) => {
                    if (d.type !== "clickFind") return;
                    const used = new Set(d.spots.map((s) => s.part));
                    d.spots.push({ part: parts.find((p) => !used.has(p.value))?.value ?? "sender", text: "" });
                  })
                }
              >
                {c.addSpot}
              </AddButton>
            ) : null}
          </Group>
        </>
      );
    }

    case "quiz":
      return (
        <>
          <QuizFields
            quiz={card}
            edit={(change) =>
              edit((d) => {
                if (d.type === "quiz") change(d);
              })
            }
          />
          <SelectField
            label={c.art}
            value={card.art ?? "none"}
            options={[{ value: "none", label: c.arts.none }, ...quizArts.map((value) => ({ value, label: c.arts[value] }))]}
            onChange={(v) =>
              edit((d) => {
                if (d.type !== "quiz") return;
                const art = v.target.value;
                if (art === "none") delete d.art;
                else d.art = art as (typeof quizArts)[number];
              })
            }
          />
        </>
      );

    case "video":
      return (
        <>
          <TextField label={c.title} value={card.title} maxLength={120} onChange={(v) => edit((d) => d.type === "video" && void (d.title = v.target.value))} />
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
            <TextField
              label={c.src}
              hint={c.srcHint}
              mono
              value={card.src}
              maxLength={200}
              onChange={(v) => {
                const src = v.target.value.replace(/[^\w\-./]/g, "");
                edit((d) => d.type === "video" && void (d.src = src));
              }}
            />
            <TextField
              label={c.duration}
              value={card.duration}
              maxLength={10}
              placeholder={c.durationPlaceholder}
              onChange={(v) => edit((d) => d.type === "video" && void (d.duration = v.target.value))}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-fg-2">
            <input
              type="checkbox"
              checked={card.question !== null}
              onChange={(v) =>
                edit((d) => {
                  if (d.type !== "video") return;
                  d.question = v.target.checked ? { question: "", options: ["", "", ""], answer: 0, explain: "", at: 0 } : null;
                })
              }
              className="size-[18px] accent-accent"
            />
            {c.videoQuestion}
          </label>
          {card.question ? (
            <>
              <TextField
                label={c.at}
                type="number"
                inputMode="numeric"
                min={0}
                max={3600}
                value={card.question.at}
                onChange={(v) => {
                  const at = Math.round(Number(v.target.value));
                  if (Number.isFinite(at) && v.target.value !== "") {
                    edit((d) => d.type === "video" && d.question !== null && void (d.question.at = Math.min(3600, Math.max(0, at))));
                  }
                }}
              />
              <QuizFields
                quiz={card.question}
                edit={(change) =>
                  edit((d) => {
                    if (d.type === "video" && d.question) change(d.question);
                  })
                }
              />
            </>
          ) : null}
        </>
      );

    case "match":
      return (
        <>
          <TextField label={c.title} value={card.title} maxLength={120} onChange={(v) => edit((d) => d.type === "match" && void (d.title = v.target.value))} />
          <TextField label={c.hint} value={card.hint} maxLength={160} onChange={(v) => edit((d) => d.type === "match" && void (d.hint = v.target.value))} />
          <Group title={c.pairs}>
            <p className="m-0 text-[13px] text-fg-3">{c.pairsHint}</p>
            {card.pairs.map((pair, i) => (
              <div key={i} className="flex items-start gap-2 rounded-xl border border-line bg-surface-deep p-2.5">
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <input
                    aria-label={format(c.pairLeft, { n: i + 1 })}
                    value={pair.left}
                    maxLength={80}
                    onChange={(v) => edit((d) => d.type === "match" && void (d.pairs[i].left = v.target.value))}
                    className={cn(inputClass, "h-11 font-bold")}
                  />
                  <input
                    aria-label={format(c.pairRight, { n: i + 1 })}
                    value={pair.right}
                    maxLength={160}
                    onChange={(v) => edit((d) => d.type === "match" && void (d.pairs[i].right = v.target.value))}
                    className={cn(inputClass, "h-11 text-[15px]")}
                  />
                  <IconSelect
                    label={format(c.pairIcon, { n: i + 1 })}
                    empty={c.iconNumber}
                    value={pair.icon}
                    onChange={(icon) => edit((d) => d.type === "match" && setIcon(d.pairs[i], icon))}
                  />
                </span>
                {card.pairs.length > 2 ? (
                  <IconButton
                    label={format(c.removePair, { n: i + 1 })}
                    icon="delete"
                    tone="danger"
                    onClick={() => edit((d) => d.type === "match" && void d.pairs.splice(i, 1))}
                  />
                ) : null}
              </div>
            ))}
            {card.pairs.length < 6 ? (
              <AddButton onClick={() => edit((d) => d.type === "match" && void d.pairs.push({ left: "", right: "" }))}>{c.addPair}</AddButton>
            ) : null}
          </Group>
          <TextAreaField
            label={c.placeExplain}
            value={card.explain}
            maxLength={400}
            rows={2}
            onChange={(v) => edit((d) => d.type === "match" && void (d.explain = v.target.value))}
          />
        </>
      );

    case "sort":
      return <SortFields card={card} edit={edit} />;

    case "fill":
      return (
        <>
          <TextField label={c.title} value={card.title} maxLength={120} onChange={(v) => edit((d) => d.type === "fill" && void (d.title = v.target.value))} />
          <TextField label={c.hint} value={card.hint} maxLength={160} onChange={(v) => edit((d) => d.type === "fill" && void (d.hint = v.target.value))} />
          <p className="m-0 text-[13px] text-fg-3">{c.sentencesHint}</p>
          <StringList
            title={c.sentences}
            values={card.sentences}
            max={6}
            multiline
            label={(n) => format(c.sentence, { n })}
            removeLabel={(n) => format(c.removeSentence, { n })}
            addLabel={c.addSentence}
            maxLength={300}
            onChange={(values) => edit((d) => d.type === "fill" && void (d.sentences = values))}
          />
          <StringList
            title={c.extra}
            values={card.extra}
            max={6}
            label={(n) => format(c.extraWord, { n })}
            removeLabel={(n) => format(c.removeExtra, { n })}
            addLabel={c.addExtra}
            maxLength={40}
            onChange={(values) => edit((d) => d.type === "fill" && void (d.extra = values))}
          />
          <TextAreaField
            label={c.placeExplain}
            value={card.explain}
            maxLength={400}
            rows={2}
            onChange={(v) => edit((d) => d.type === "fill" && void (d.explain = v.target.value))}
          />
        </>
      );
  }
}

/** Kutulara ayırma: kutular (ad, not, renk, ikon) ve bilgiler (metin, ikon, doğru kutu). */
function SortFields({ card, edit }: { card: Extract<Card, { type: "sort" }>; edit: Edit<Card> }) {
  const c = getMessages().admin.editor.cards;
  const sort = (change: (d: Extract<Card, { type: "sort" }>) => void) => edit((d) => d.type === "sort" && void change(d));
  const select = cn(inputClass, "h-10 min-w-0 flex-1 px-2.5 text-sm");
  const iconOptions = cardIcons.map((icon) => (
    <option key={icon} value={icon}>
      {c.icons[icon]}
    </option>
  ));
  return (
    <>
      <TextField label={c.title} value={card.title} maxLength={120} onChange={(v) => sort((d) => void (d.title = v.target.value))} />
      <TextField label={c.hint} value={card.hint} maxLength={160} onChange={(v) => sort((d) => void (d.hint = v.target.value))} />
      <Group title={c.bins} hint={c.binsHint}>
        {card.bins.map((bin, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-line bg-surface-deep p-2.5">
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <input
                aria-label={format(c.binLabel, { n: i + 1 })}
                placeholder={c.binLabelPlaceholder}
                value={bin.label}
                maxLength={40}
                onChange={(v) => sort((d) => void (d.bins[i].label = v.target.value))}
                className={cn(inputClass, "h-11 font-bold")}
              />
              <input
                aria-label={format(c.binNote, { n: i + 1 })}
                placeholder={c.binNotePlaceholder}
                value={bin.note}
                maxLength={80}
                onChange={(v) => sort((d) => void (d.bins[i].note = v.target.value))}
                className={cn(inputClass, "h-11 text-[15px]")}
              />
              <span className="flex gap-2">
                <select
                  aria-label={format(c.binColor, { n: i + 1 })}
                  value={bin.color}
                  onChange={(v) => sort((d) => void (d.bins[i].color = v.target.value as (typeof sortColors)[number]))}
                  className={select}
                >
                  {sortColors.map((color) => (
                    <option key={color} value={color}>
                      {c.colors[color]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={format(c.binIcon, { n: i + 1 })}
                  value={bin.icon}
                  onChange={(v) => sort((d) => void (d.bins[i].icon = v.target.value as (typeof cardIcons)[number]))}
                  className={select}
                >
                  {iconOptions}
                </select>
              </span>
            </span>
            {card.bins.length > 2 ? (
              <IconButton
                label={format(c.removeBin, { n: i + 1 })}
                icon="delete"
                tone="danger"
                onClick={() =>
                  sort((d) => {
                    d.bins.splice(i, 1);
                    // Silinen kutudaki bilgiler ilk kutuya geçer, sonrakilerin numarası bir azalır.
                    for (const item of d.items) item.bin = item.bin === i ? 0 : item.bin > i ? item.bin - 1 : item.bin;
                  })
                }
              />
            ) : null}
          </div>
        ))}
        {card.bins.length < 4 ? (
          <AddButton onClick={() => sort((d) => void d.bins.push({ label: "", note: "", color: "blue", icon: "shield" }))}>{c.addBin}</AddButton>
        ) : null}
      </Group>
      <Group title={c.items} hint={c.itemsHint}>
        {card.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-line bg-surface-deep p-2.5">
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <input
                aria-label={format(c.itemText, { n: i + 1 })}
                value={item.text}
                maxLength={80}
                onChange={(v) => sort((d) => void (d.items[i].text = v.target.value))}
                className={cn(inputClass, "h-11 font-bold")}
              />
              <span className="flex gap-2">
                <select
                  aria-label={format(c.itemIcon, { n: i + 1 })}
                  value={item.icon}
                  onChange={(v) => sort((d) => void (d.items[i].icon = v.target.value as (typeof cardIcons)[number]))}
                  className={select}
                >
                  {iconOptions}
                </select>
                <select
                  aria-label={format(c.itemBin, { n: i + 1 })}
                  value={item.bin}
                  onChange={(v) => sort((d) => void (d.items[i].bin = Number(v.target.value)))}
                  className={cn(select, "border-success/60")}
                >
                  {card.bins.map((bin, b) => (
                    <option key={b} value={b}>
                      {bin.label.trim() || format(c.binOption, { n: b + 1 })}
                    </option>
                  ))}
                </select>
              </span>
            </span>
            {card.items.length > 2 ? (
              <IconButton label={format(c.removeItem, { n: i + 1 })} icon="delete" tone="danger" onClick={() => sort((d) => void d.items.splice(i, 1))} />
            ) : null}
          </div>
        ))}
        {card.items.length < 8 ? <AddButton onClick={() => sort((d) => void d.items.push({ text: "", icon: "tag", bin: 0 }))}>{c.addItem}</AddButton> : null}
      </Group>
      <TextAreaField label={c.placeExplain} value={card.explain} maxLength={400} rows={2} onChange={(v) => sort((d) => void (d.explain = v.target.value))} />
    </>
  );
}

type Quiz = { question: string; options: string[]; answer: number; explain: string };

function QuizFields({ quiz, edit }: { quiz: Quiz; edit: Edit<Quiz> }) {
  const c = getMessages().admin.editor.cards;
  const group = useId();
  return (
    <>
      <TextAreaField label={c.question} value={quiz.question} maxLength={240} rows={2} onChange={(v) => edit((d) => void (d.question = v.target.value))} />
      <Group title={c.answer}>
        {quiz.options.map((option, i) => (
          <div key={i} className="flex items-center gap-2">
            <label className="flex flex-none cursor-pointer items-center gap-1.5 text-sm font-extrabold text-fg-3">
              <input
                type="radio"
                name={group}
                checked={quiz.answer === i}
                onChange={() => edit((d) => void (d.answer = i))}
                aria-label={format(c.answerOption, { letter: letter(i) })}
                className="size-4 accent-success"
              />
              <span aria-hidden="true">{letter(i)}</span>
            </label>
            <input
              aria-label={format(c.option, { letter: letter(i) })}
              value={option}
              maxLength={160}
              onChange={(v) => edit((d) => void (d.options[i] = v.target.value))}
              className={cn(inputClass, "h-11 min-w-0 flex-1 text-[15px]", quiz.answer === i && "border-success/60")}
            />
            {quiz.options.length > 2 ? (
              <IconButton
                label={format(c.removeOption, { letter: letter(i) })}
                icon="delete"
                tone="danger"
                onClick={() =>
                  edit((d) => {
                    d.options.splice(i, 1);
                    if (d.answer >= d.options.length) d.answer = d.options.length - 1;
                    else if (d.answer > i) d.answer -= 1;
                  })
                }
              />
            ) : null}
          </div>
        ))}
        {quiz.options.length < 4 ? <AddButton onClick={() => edit((d) => void d.options.push(""))}>{c.addOption}</AddButton> : null}
      </Group>
      <TextAreaField label={c.explain} value={quiz.explain} maxLength={400} rows={2} onChange={(v) => edit((d) => void (d.explain = v.target.value))} />
    </>
  );
}

/** Metin listesi (paragraflar): ekle, sil, en fazla `max` satır. */
function StringList({
  title,
  values,
  max,
  multiline,
  label,
  removeLabel,
  addLabel,
  maxLength,
  onChange,
}: {
  title: string;
  values: string[];
  max: number;
  multiline?: boolean;
  label: (n: number) => string;
  removeLabel: (n: number) => string;
  addLabel: ReactNode;
  maxLength: number;
  onChange: (values: string[]) => void;
}) {
  return (
    <Group title={title}>
      {values.map((value, i) => (
        <span key={i} className="flex items-start gap-2">
          {multiline ? (
            <textarea
              aria-label={label(i + 1)}
              value={value}
              rows={2}
              maxLength={maxLength}
              onChange={(v) => onChange(values.map((x, j) => (j === i ? v.target.value : x)))}
              className={cn(inputClass, "min-h-[72px] resize-y py-2.5 text-[15px] leading-normal")}
            />
          ) : (
            <input
              aria-label={label(i + 1)}
              value={value}
              maxLength={maxLength}
              onChange={(v) => onChange(values.map((x, j) => (j === i ? v.target.value : x)))}
              className={cn(inputClass, "h-11")}
            />
          )}
          <IconButton label={removeLabel(i + 1)} icon="delete" tone="danger" onClick={() => onChange(values.filter((_, j) => j !== i))} />
        </span>
      ))}
      {values.length < max ? <AddButton onClick={() => onChange([...values, ""])}>{addLabel}</AddButton> : null}
    </Group>
  );
}

/** İkonu yazar ya da (boş seçilince) siler: alan isteğe bağlıdır, boşsa düzenin varsayılanı. */
function setIcon(target: { icon?: CardIcon }, icon: CardIcon | null) {
  if (icon) target.icon = icon;
  else delete target.icon;
}

/** Madde ve eş satırındaki ikon seçimi; boş seçenek varsayılanı (ya da numarayı) bırakır. */
function IconSelect({ label, empty, value, onChange }: { label: string; empty: string; value: CardIcon | undefined; onChange: (icon: CardIcon | null) => void }) {
  const c = getMessages().admin.editor.cards;
  return (
    <select aria-label={label} value={value ?? ""} onChange={(v) => onChange((v.target.value || null) as CardIcon | null)} className={cn(inputClass, "h-10 px-2.5 text-sm")}>
      <option value="">{empty}</option>
      {cardIcons.map((icon) => (
        <option key={icon} value={icon}>
          {c.icons[icon]}
        </option>
      ))}
    </select>
  );
}
