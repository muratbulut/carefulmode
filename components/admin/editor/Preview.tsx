"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Paperclip, PlayCircle, ShieldAlert, User } from "lucide-react";
import { signNumber } from "@/lib/admin/editor-model";
import { format, getMessages } from "@/lib/i18n";
import type { EditorSection } from "@/lib/lab/checklist";
import { fillParts, paragraphs, reportScale, usesTrapPage, type Card, type Item, type ScenarioContent, type ScenarioTemplate, type TrainingContent } from "@/lib/lab/content";
import type { ScenarioReport } from "@/lib/lab/scoring";
import { cn } from "@/lib/utils";
import { SenderAvatar } from "./ItemsForm";
import { letter, taskKindClass } from "./TasksForm";
import { sortColorClass, cardIconMap } from "@/components/lab/training/card-icons";
import { cardKindClass } from "./CardsForm";

// Sağ sütundaki önizleme (Lab-Duzenle-Son): öğrencinin göreceğinin küçük resmi. Kırmızı
// numaralar işaretlerin yeridir; labda görünmez, yalnızca raporda çıkar.

export function Kicker({ icon = true, children }: { icon?: boolean; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-xs font-bold tracking-[1px] text-fg-4">
      {icon ? <User className="size-3.5" strokeWidth={2.2} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function SignBadge({ n }: { n: number | null }) {
  const t = getMessages().admin.editor.previewPane;
  if (n === null) return null;
  return (
    <span
      role="img"
      aria-label={format(t.sign, { n })}
      className="inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-scene-red text-xs font-extrabold text-scene-white ring-3 ring-scene-red/25"
    >
      {n}
    </span>
  );
}

/** **kalın** parçalarını kalın yazar (mail metninde yazılabilir). */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <b key={i}>{part.slice(2, -2)}</b> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function MailPreview({ item, template }: { item: Item; template: ScenarioTemplate }) {
  const t = getMessages().admin.editor;
  const name = item.sender.trim() || t.items.untitled[template];
  const sender = signNumber(item, "sender");
  const text = signNumber(item, "text");
  const link = signNumber(item, template === "INBOX" ? "link" : "ask");
  const body = paragraphs(item.body);

  if (template === "MESSAGING") {
    return (
      <div className="flex flex-col overflow-hidden rounded-[18px] bg-scene-paper text-sm text-scene-ink">
        <span className="flex items-center gap-2.5 border-b border-scene-line bg-scene-white px-3.5 py-2.5">
          <SenderAvatar name={name} className="size-[34px]" />
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="truncate">{name}</b>
            <span className="flex items-center gap-1.5 text-xs break-all text-scene-ink-muted">
              {item.address}
              <SignBadge n={sender} />
            </span>
          </span>
        </span>
        <div className="flex flex-col gap-1.5 px-3.5 pt-4 pb-[18px]">
          {item.time ? <span className="self-center text-[11px] text-scene-ink-muted">{item.time}</span> : null}
          <span className="flex items-end gap-1.5">
            <span className="flex max-w-[82%] flex-col gap-2 rounded-[16px_16px_16px_4px] bg-scene-white px-3 py-2.5 leading-normal text-scene-ink-2 shadow-sm">
              {body.length ? (
                body.map((p, i) => (
                  <span key={i}>
                    <Bold text={p} />
                  </span>
                ))
              ) : (
                <span className="h-5" />
              )}
              {item.link?.url ? <span className="font-mono text-xs break-all text-scene-blue">{item.link.url}</span> : null}
            </span>
            <span className="flex flex-col gap-1">
              <SignBadge n={text} />
              <SignBadge n={link} />
            </span>
          </span>
        </div>
        <span className="flex items-center gap-2 border-t border-scene-line bg-scene-white px-3 py-2.5">
          <span className="flex h-[34px] flex-1 items-center rounded-full bg-scene-paper px-3.5 text-[13px] text-scene-ink-faint">
            {t.previewPane.typeMessage}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[14px] bg-scene-white p-[18px] text-sm text-scene-ink">
      <span className="flex items-center gap-2.5">
        <SenderAvatar name={name} className="size-9 text-sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="truncate">{name}</b>
          <span className="flex items-center gap-1.5 text-[13px] break-all text-scene-ink-2">
            {item.address}
            <SignBadge n={sender} />
          </span>
        </span>
        {item.time ? <span className="flex-none text-xs text-scene-ink-muted">{item.time}</span> : null}
      </span>
      {item.subject ? <b className="text-lg leading-[1.3]">{item.subject}</b> : null}
      <span className="flex items-start gap-1.5 leading-[1.6] text-scene-ink-2">
        <span className="flex flex-1 flex-col gap-2">
          {body.map((p, i) => (
            <span key={i}>
              <Bold text={p} />
            </span>
          ))}
        </span>
        <SignBadge n={text} />
      </span>
      {item.link?.url ? (
        <span className="flex items-center gap-1.5">
          <span className="rounded-md border border-scene-line bg-scene-paper px-1.5 py-[3px] font-mono text-xs break-all text-scene-ink-2">{item.link.url}</span>
          <SignBadge n={link} />
        </span>
      ) : null}
      {item.attachment?.name ? (
        <span className="flex items-center gap-1.5 text-xs text-scene-ink-muted">
          <Paperclip className="size-3.5" strokeWidth={2} aria-hidden="true" />
          {format(t.previewPane.attachment, { name: item.attachment.name, size: item.attachment.size })}
        </span>
      ) : null}
      {item.footer ? <span className="text-xs leading-normal text-scene-ink-muted">{item.footer}</span> : null}
    </div>
  );
}

/** Sağ sütun, senaryo labı: seçili bölüme göre öğrencinin gördüğü. */
export function ScenarioPreview({
  content,
  template,
  section,
  itemIndex,
  taskIndex,
  report,
}: {
  content: ScenarioContent;
  template: ScenarioTemplate;
  section: EditorSection;
  itemIndex: number;
  taskIndex: number;
  report: ScenarioReport;
}) {
  const t = getMessages();
  const p = t.admin.editor.previewPane;

  if (section === "cover") {
    return (
      <>
        <Kicker>{p.kickers.cover}</Kicker>
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-[18px]">
          <span className="text-xs font-bold tracking-[1px] text-accent-light">{p.start.kicker}</span>
          <b className="font-heading text-lg">{p.start.text}</b>
          {content.reminders.filter((r) => r.trim()).map((r, i) => (
            <span key={i} className="flex gap-2 text-sm leading-normal text-fg-2">
              <CheckCircle2 className="mt-0.5 size-4 flex-none text-accent-fg" strokeWidth={2.2} aria-hidden="true" />
              {r}
            </span>
          ))}
        </div>
      </>
    );
  }

  if (section === "items") {
    const item = content.items[itemIndex];
    return (
      <>
        <Kicker>{p.kickers.items[template]}</Kicker>
        {item ? <MailPreview item={item} template={template} /> : <Empty>{p.nothing[template]}</Empty>}
        {item?.kind === "fake" ? <span className="text-xs text-fg-4">{p.signsNote}</span> : null}
      </>
    );
  }

  if (section === "trap") {
    const fake = content.items.find((i) => i.kind === "fake");
    const trap = content.trap;
    // Mesajlaşmada sayfa başlığı yazılınca sahte mesajdaki bağlantı sahte sayfayı açar (M1).
    const page = usesTrapPage(content, template);
    return (
      <>
        <Kicker>{p.kickers.trap[page ? "INBOX" : template]}</Kicker>
        {page ? (
          <div className="flex flex-col overflow-hidden rounded-[14px] bg-scene-white text-scene-ink">
            <span className="flex items-center gap-2 border-b border-scene-line bg-scene-paper px-3 py-2 font-mono text-xs break-all text-scene-red">
              <ShieldAlert className="size-3.5 flex-none" strokeWidth={2.2} aria-hidden="true" />
              {format(p.notSecure, { url: trap.url || content.items.find((i) => i.kind === "fake" && i.link)?.link?.url || "" })}
            </span>
            <div className="flex flex-col gap-2.5 p-[18px]">
              <b className="text-[17px]">{trap.title}</b>
              {trap.text ? <span className="text-[13px] leading-normal text-scene-ink-2">{trap.text}</span> : null}
              <span className="flex h-10 items-center rounded-lg border border-scene-line px-3 text-sm text-scene-ink-faint">{trap.ask}</span>
              <span className="flex h-10 items-center justify-center rounded-lg bg-scene-blue text-sm font-bold text-scene-white">{p.verify}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-[18px] bg-scene-paper px-3.5 py-4 text-sm text-scene-ink">
            <span className="flex items-center gap-2 text-xs font-bold text-scene-ink-2">
              <SenderAvatar name={fake?.sender || "?"} className="size-[22px] text-[11px]" />
              {fake?.sender}
            </span>
            <span className="max-w-[82%] self-start rounded-[16px_16px_16px_4px] bg-scene-white px-3 py-2.5 leading-normal">
              {fake ? paragraphs(fake.body)[0] : p.noFake[template]}
            </span>
            <span className="max-w-[70%] self-end rounded-[16px_16px_4px_16px] border border-dashed border-scene-blue/60 bg-scene-blue/15 px-3 py-2.5 font-mono text-[13px] text-scene-blue">
              {trap.secret || trap.ask}
            </span>
            <span className="self-end text-[11px] text-scene-ink-muted">{p.sendIf}</span>
          </div>
        )}
        <div className="flex gap-2.5 rounded-xl border border-alarm-pink/35 bg-alarm-pink/7 px-3.5 py-3 text-[13px] leading-normal text-alarm-pink-soft">
          <ShieldAlert className="mt-0.5 size-4 flex-none text-alarm-pink" strokeWidth={2.2} aria-hidden="true" />
          <span>{t.lab.hacked.lines[trap.kind]}</span>
        </div>
      </>
    );
  }

  if (section === "tasks") {
    const task = content.tasks[taskIndex];
    const k = t.admin.editor.tasks;
    return (
      <>
        <Kicker icon={false}>{p.kickers.tasks}</Kicker>
        {task ? (
          <div className="flex flex-col gap-2.5 rounded-[14px] border border-accent/45 bg-surface p-3.5">
            <span className="flex items-center gap-2">
              <span className="flex size-[26px] items-center justify-center rounded-full bg-accent text-[13px] font-extrabold text-on-accent">{taskIndex + 1}</span>
              <span className={cn("flex-none rounded-md px-[7px] py-[3px] text-[11px] font-extrabold tracking-[0.8px]", taskKindClass[task.type])}>
                {k.kinds[task.type]}
              </span>
            </span>
            <b className="text-[15px] leading-[1.4]">{task.text}</b>
            {task.type === "question" ? (
              <div className="flex flex-col gap-1.5">
                {task.options.map((o, i) => (
                  <span key={i} className="flex min-h-10 items-center gap-2.5 rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm">
                    <span aria-hidden="true" className="size-[22px] flex-none rounded-full border-2 border-line-strong" />
                    <span className="flex-1">{o.text}</span>
                    <span className="sr-only">{letter(i)}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[13px] text-fg-3">
                {task.type === "review" ? k.reviewNote[template] : task.type === "mission" ? k.missionNote[template] : k.actionNote[template]}
              </span>
            )}
          </div>
        ) : (
          <Empty>{p.noTask}</Empty>
        )}
      </>
    );
  }

  return (
    <>
      <Kicker icon={false}>{p.kickers.report}</Kicker>
      <ReportSummary content={content} template={template} report={report} />
    </>
  );
}

/** Rapor özeti: 10 üzerinden puan halkası, durum, başlık ve "Bir dahaki sefere" ipuçları. */
export function ReportSummary({ content, template, report }: { content: ScenarioContent; template: ScenarioTemplate; report: ScenarioReport }) {
  const t = getMessages();
  const p = t.admin.editor.previewPane;
  const tone = { safe: "var(--success)", risky: "var(--warning)", hacked: "var(--alarm-pink)" }[report.status];
  const chip = { safe: "bg-success/12 text-success-fg", risky: "bg-warning/12 text-warning-fg", hacked: "bg-alarm-pink/12 text-alarm-pink" }[report.status];
  const tips = [
    ...report.tips.map((i) => content.tips[i]?.text ?? ""),
    ...t.lab.report.genericTips[template].slice(0, report.genericTips),
  ].filter(Boolean);
  const degrees = Math.round((Math.min(reportScale, report.score) / reportScale) * 360);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-[18px]">
      <span className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex size-[74px] flex-none items-center justify-center rounded-full"
          style={{ background: `conic-gradient(${tone} ${degrees}deg, var(--card) 0)` }}
        >
          <span className="flex size-[58px] flex-col items-center justify-center rounded-full bg-surface leading-none">
            <b className="text-xl">{report.score}</b>
            <span className="text-[11px] text-fg-4">{p.scoreOf}</span>
          </span>
        </span>
        <span className="flex flex-col gap-1">
          <span className={cn("self-start rounded-full px-[9px] py-[3px] text-xs font-bold", chip)}>{t.lab.report.status[report.status]}</span>
          <b className="font-heading text-[17px] leading-[1.3]">{t.lab.report.titles[template][report.title]}</b>
          <span className="sr-only">{format(t.admin.editor.previewPane.scoreLabel, { n: report.score })}</span>
        </span>
      </span>
      <span className="text-xs font-bold tracking-[1px] text-fg-4">{p.nextTime}</span>
      {tips.map((tip, i) => (
        <span key={i} className="flex gap-2 text-sm leading-normal text-fg-2">
          <CheckCircle2 className="mt-0.5 size-4 flex-none text-accent-fg" strokeWidth={2.2} aria-hidden="true" />
          {tip}
        </span>
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="m-0 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-fg-3">{children}</p>;
}

/** Sağ sütun, eğitim labı: kapakta lab kartı, kartlarda seçili kart. */
export function TrainingPreview({ content, section, cardIndex }: { content: TrainingContent; section: EditorSection; cardIndex: number }) {
  const t = getMessages();
  const p = t.admin.editor.previewPane;
  if (section !== "cards") {
    const meta = content.meta;
    const info = [t.lab.difficulty[meta.difficulty], format(t.lab.durationShort, { n: meta.durationMin })].join(" · ");
    return (
      <>
        <Kicker icon={false}>{p.kickers.catalog}</Kicker>
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-[18px]">
          <span className="text-xs font-bold tracking-[1px] text-accent-light">{t.lab.kindsUpper.TRAINING}</span>
          <b className="font-heading text-lg">{meta.name}</b>
          {meta.title ? <span className="text-sm font-bold text-fg-2">{meta.title}</span> : null}
          {meta.summary ? <span className="text-sm leading-normal text-fg-3">{meta.summary}</span> : null}
          <span className="text-xs text-fg-4">{info}</span>
        </div>
      </>
    );
  }
  const card = content.cards[cardIndex];
  return (
    <>
      <Kicker>{p.kickers.card}</Kicker>
      {card ? <CardPreview card={card} /> : <Empty>{p.noCard}</Empty>}
    </>
  );
}

function CardPreview({ card }: { card: Card }) {
  const t = getMessages();
  const p = t.admin.editor.previewPane;
  const tag = <span className={cn("self-start rounded-md px-[7px] py-[3px] text-[11px] font-extrabold tracking-[0.8px]", cardKindClass[card.type])}>{t.lab.training.tags[card.type]}</span>;

  switch (card.type) {
    case "info":
      return (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-[18px]">
          {tag}
          <b className="font-heading text-lg leading-[1.3]">{card.title}</b>
          {card.paragraphs.filter(Boolean).map((x, i) => (
            <span key={i} className="text-sm leading-normal text-fg-2">
              {x}
            </span>
          ))}
          {card.points.map((x, i) => (
            <span key={i} className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface-deep p-2.5 text-sm">
              <b>{x.title}</b>
              <span className="text-fg-3">{x.text}</span>
            </span>
          ))}
        </div>
      );
    case "clickFind": {
      const spot = (part: string) => {
        const index = card.spots.findIndex((s) => s.part === part);
        return index < 0 ? null : index + 1;
      };
      return (
        <div className="flex flex-col gap-2.5">
          {tag}
          <b className="font-heading text-lg leading-[1.3]">{card.title}</b>
          {card.hint ? <span className="text-sm text-fg-3">{card.hint}</span> : null}
          <div className="flex flex-col gap-2.5 rounded-[14px] bg-scene-white p-4 text-sm text-scene-ink">
            <span className="flex items-center gap-1.5">
              <b>{card.mail.sender}</b>
              <SignBadge n={spot("sender")} />
            </span>
            <span className="flex items-center gap-1.5 text-[13px] break-all text-scene-ink-2">
              {card.mail.address}
              <SignBadge n={spot("address")} />
            </span>
            <span className="flex items-center gap-1.5">
              <b className="text-base">{card.mail.subject}</b>
              <SignBadge n={spot("subject")} />
            </span>
            {card.mail.paragraphs.map((x, i) => (
              <span key={i} className="flex items-start gap-1.5 leading-normal text-scene-ink-2">
                <span className="flex-1">{x}</span>
                <SignBadge n={spot(`p${i}`)} />
              </span>
            ))}
            {card.mail.button ? (
              <span className="flex items-center gap-1.5">
                <span className="rounded-lg bg-scene-blue px-3 py-2 text-[13px] font-bold text-scene-white">{card.mail.button}</span>
                <SignBadge n={spot("button")} />
              </span>
            ) : null}
            {card.mail.footer ? (
              <span className="flex items-center gap-1.5 text-xs text-scene-ink-muted">
                {card.mail.footer}
                <SignBadge n={spot("footer")} />
              </span>
            ) : null}
          </div>
        </div>
      );
    }
    case "quiz":
      return <QuizPreview tag={tag} question={card.question} options={card.options} answer={card.answer} explain={card.explain} />;
    case "video":
      return (
        <div className="flex flex-col gap-2.5">
          {tag}
          <b className="font-heading text-lg leading-[1.3]">{card.title}</b>
          <span className="flex aspect-video items-center justify-center rounded-[14px] border border-line bg-surface-deep text-fg-3">
            <PlayCircle className="size-10" strokeWidth={1.6} aria-hidden="true" />
          </span>
          <span className="font-mono text-xs break-all text-fg-4">{card.src || p.noVideo}</span>
          {card.question ? (
            <>
              <span className="text-xs font-bold text-warning-fg">{format(p.videoAt, { at: card.question.at })}</span>
              <QuizPreview question={card.question.question} options={card.question.options} answer={card.question.answer} explain={card.question.explain} />
            </>
          ) : null}
        </div>
      );
    case "match":
      return (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-[18px]">
          {tag}
          <b className="font-heading text-lg leading-[1.3]">{card.title}</b>
          {card.hint ? <span className="text-sm text-fg-3">{card.hint}</span> : null}
          {card.pairs.map((pair, i) => (
            <span key={i} className="grid grid-cols-2 gap-2 rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm">
              <b className="min-w-0 break-words">{pair.left}</b>
              <span className="min-w-0 break-words text-success-fg">{pair.right}</span>
            </span>
          ))}
          {card.explain ? <span className="text-sm leading-normal text-fg-3">{card.explain}</span> : null}
        </div>
      );
    case "sort":
      // Yazarın gördüğü hali: her kutu ve içine girecek bilgiler (öğrenci bilgileri karışık değil, sırayla görür).
      return (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-[18px]">
          {tag}
          <b className="font-heading text-lg leading-[1.3]">{card.title}</b>
          {card.hint ? <span className="text-sm text-fg-3">{card.hint}</span> : null}
          {card.bins.map((bin, b) => {
            const color = sortColorClass[bin.color];
            const Icon = cardIconMap[bin.icon];
            return (
              <span key={b} className={cn("flex flex-col gap-1.5 rounded-xl border-2 p-2.5", color.idle)}>
                <span className="flex items-center gap-2">
                  <span className={cn("flex size-7 flex-none items-center justify-center rounded-lg", color.icon)}>
                    <Icon className="size-4" strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <b className={cn("text-sm", color.text)}>{bin.label}</b>
                  {bin.note ? <span className="min-w-0 truncate text-xs text-fg-3">{bin.note}</span> : null}
                </span>
                {card.items.map((item, i) => {
                  if (item.bin !== b) return null;
                  const ItemIcon = cardIconMap[item.icon];
                  return (
                    <span key={i} className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-2 py-1.5 text-sm">
                      <ItemIcon className="size-4 flex-none text-fg-3" strokeWidth={2.2} aria-hidden="true" />
                      {item.text}
                    </span>
                  );
                })}
              </span>
            );
          })}
          {card.explain ? <span className="text-sm leading-normal text-fg-3">{card.explain}</span> : null}
        </div>
      );
    case "fill": {
      const words = [...card.sentences.flatMap((x) => fillParts(x).answers), ...card.extra].filter(Boolean);
      return (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-[18px]">
          {tag}
          <b className="font-heading text-lg leading-[1.3]">{card.title}</b>
          {card.hint ? <span className="text-sm text-fg-3">{card.hint}</span> : null}
          {card.sentences.map((x, i) => {
            const { texts, answers } = fillParts(x);
            return (
              <span key={i} className="text-sm leading-relaxed text-fg-2">
                {texts.map((text, j) => (
                  <span key={j}>
                    {text}
                    {j < answers.length ? <b className="rounded-md bg-success/12 px-1.5 py-0.5 text-success-fg">{answers[j]}</b> : null}
                  </span>
                ))}
              </span>
            );
          })}
          <span className="text-xs text-fg-4">{format(p.wordBank, { words: [...new Set(words)].join(", ") })}</span>
          {card.explain ? <span className="text-sm leading-normal text-fg-3">{card.explain}</span> : null}
        </div>
      );
    }
  }
}

function QuizPreview({ tag, question, options, answer, explain }: { tag?: ReactNode; question: string; options: string[]; answer: number; explain: string }) {
  const p = getMessages().admin.editor.previewPane;
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-[18px]">
      {tag}
      <b className="text-[15px] leading-[1.4]">{question}</b>
      {options.map((o, i) => (
        <span
          key={i}
          className={cn(
            "flex min-h-10 items-center gap-2.5 rounded-[10px] border bg-canvas px-3 py-2 text-sm",
            i === answer ? "border-success/60" : "border-line",
          )}
        >
          <b className="w-4 flex-none text-fg-3">{letter(i)}</b>
          <span className="flex-1">{o}</span>
          {i === answer ? (
            <span className="flex items-center gap-1 text-xs font-bold text-success-fg">
              <CheckCircle2 className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
              {p.correct}
            </span>
          ) : null}
        </span>
      ))}
      {explain ? <span className="text-[13px] leading-normal text-fg-3">{explain}</span> : null}
    </div>
  );
}
