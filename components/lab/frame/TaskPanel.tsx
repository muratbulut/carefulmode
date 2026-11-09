"use client";

import { Check, ChevronDown, ChevronUp, Flag, Lock, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ClientMission, ClientTask } from "@/lib/lab/client";
import type { ScenarioTemplate } from "@/lib/lab/content";
import { format, getMessages, rich } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { MissionPoints } from "../mission/MissionPoints";
import { cardIconMap } from "../training/card-icons";

export type TaskPanelProps = {
  template: ScenarioTemplate;
  tasks: ClientTask[];
  done: boolean[];
  current: number;
  finished: boolean;
  answers: Record<string, number>;
  opened: number;
  itemCount: number;
  finishing: boolean;
  onReviewDone: () => void;
  onAnswer: (task: string, option: number) => void;
  onFinish: () => void;
  /** Görevli oda: panelin üstündeki istek ve kart (arama kabul edilince yerleşir), "Tekrar dinle". */
  mission?: ClientMission | null;
  missionShown?: boolean;
  onReplay?: () => void;
};

/** Görevli odada panelin en üstündeki "Annenin isteği" kutusu ve annenin kartı. */
function MissionBox({ mission, onReplay }: { mission: ClientMission; onReplay?: () => void }) {
  const t = getMessages().lab.mission;
  return (
    <section
      aria-label={format(t.request, { owner: mission.owner })}
      className="flex flex-col gap-2 rounded-2xl border border-orange/55 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--orange)_14%,transparent),color-mix(in_srgb,var(--orange)_4%,transparent))] p-3 [animation:fade-up_.5s_ease-out_both]"
      data-testid="mission-box"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.8px] text-orange-fg">{format(t.request, { owner: mission.owner }).toLocaleUpperCase("tr")}</span>
        {onReplay ? (
          <button type="button" onClick={onReplay} className="flex min-h-8 cursor-pointer items-center gap-1 text-xs font-bold text-accent-fg">
            <Play className="size-3" strokeWidth={2.6} aria-hidden="true" />
            {t.replay}
          </button>
        ) : null}
      </div>
      <span className="text-[15px] font-bold text-fg">{mission.title}</span>
      <MissionPoints points={mission.points} icons={mission.pointIcons} tone="panel" />
      {mission.card ? (
        <div className="grid gap-0.5 rounded-xl border border-line-strong bg-[linear-gradient(135deg,var(--card),var(--line-strong))] px-3 py-2.5 font-mono text-xs text-fg [animation:fade-up_.5s_ease-out_.2s_both]">
          <span className="text-fg-3">{format(t.card, { owner: mission.owner })}</span>
          <span className="text-sm tracking-[0.08em]">{mission.card.number}</span>
          <span className="flex justify-between">
            <span>{format(t.expiry, { expiry: mission.card.expiry })}</span>
            <span>{t.cvv}</span>
          </span>
        </div>
      ) : null}
      {mission.sale ? <ListingCard sale={mission.sale} /> : null}
    </section>
  );
}

/** Satış görevinde panelin üstündeki ilan: ürün, fiyat ve pazar yeri. */
function ListingCard({ sale }: { sale: NonNullable<ClientMission["sale"]> }) {
  const t = getMessages().lab.mission;
  const Icon = cardIconMap[sale.icon];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-surface px-3 py-2.5 [animation:fade-up_.5s_ease-out_.2s_both]" data-testid="mission-listing">
      <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-lg bg-line text-fg-2">
        <Icon className="size-5" strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-bold tracking-[0.6px] text-fg-3">{format(t.listing, { platform: sale.platform }).toLocaleUpperCase("tr")}</span>
        <span className="truncate text-[13px] font-bold text-fg">{sale.product}</span>
        <span className="font-mono text-[13px] text-fg-2">{sale.price}</span>
      </span>
    </div>
  );
}

const primary =
  "flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-bold text-on-accent transition-[filter,opacity] hover:brightness-110 disabled:cursor-default disabled:opacity-45 disabled:hover:brightness-100";

/** Görev listesi: masaüstünde sağ sütunda, telefonda alttan açılan pencerede aynı içerik. */
function TaskList(props: TaskPanelProps) {
  const t = getMessages().lab.frame;
  const { template, tasks, done, current, finished, answers, opened, itemCount, finishing } = props;
  const [picked, setPicked] = useState<Record<string, number>>({});

  const m = getMessages().lab.mission;

  return (
    <div className="flex flex-col gap-3.5">
      {props.mission && props.missionShown ? <MissionBox mission={props.mission} onReplay={props.onReplay} /> : null}
      <p className="flex items-start gap-2.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-[13px] leading-normal text-fg-3">
        <Flag className="mt-0.5 size-3.5 flex-none text-warning-fg" strokeWidth={2.2} aria-hidden="true" />
        {t.note}
      </p>
      <ol aria-label={t.tasksTitle} className="flex flex-col gap-2.5">
        {tasks.map((task, i) => {
          const isDone = done[i];
          const isCurrent = i === current;
          const locked = !isDone && !isCurrent;
          const choice = picked[task.id];
          return (
            <li
              key={task.id}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex flex-col gap-2.5 rounded-2xl border p-3.5 transition-colors duration-300",
                isCurrent ? "border-accent/55 bg-accent/[0.06]" : "border-line bg-surface",
              )}
            >
              <div className="flex items-start gap-3">
                {isDone ? (
                  <span className="flex size-7 flex-none items-center justify-center rounded-full bg-success/16 text-success-fg">
                    <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
                  </span>
                ) : isCurrent ? (
                  <span className="flex size-7 flex-none items-center justify-center rounded-full border-2 border-accent font-mono text-[13px] font-bold text-accent-fg">
                    {i + 1}
                  </span>
                ) : (
                  <span className="flex size-7 flex-none items-center justify-center rounded-full border border-line text-fg-4">
                    <Lock className="size-3.5" strokeWidth={2.2} aria-label={t.lockedTask} />
                  </span>
                )}
                <div className={cn("flex flex-1 flex-col gap-1", locked && "blur-[2.5px] select-none")} aria-hidden={locked || undefined}>
                  <span
                    className={cn(
                      "text-[11px] font-bold tracking-[0.6px]",
                      task.type === "question" ? "text-warning-fg" : task.type === "mission" ? "text-orange-fg" : "text-fg-3",
                    )}
                  >
                    {task.type === "question"
                      ? t.question
                      : task.type === "mission"
                        ? format(m.task, { owner: props.mission?.owner ?? "" }).toLocaleUpperCase("tr")
                        : t.doInApp}
                  </span>
                  <span className={cn("text-[15px] leading-snug font-bold", locked ? "text-fg-4" : "text-fg")}>{task.text}</span>
                </div>
              </div>

              {isCurrent && task.type === "review" ? (
                <div className="flex flex-col gap-2.5 pl-10 [animation:pop_.25s_ease-out_both]">
                  <p className="rounded-xl border border-card bg-surface-deep px-3 py-2.5 text-[13px] leading-normal text-fg-3">
                    {rich(t.reviewNote[template], { b: (chunk) => <b className="text-fg">{chunk}</b> })}
                  </p>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold whitespace-nowrap text-fg-3">{t.opened[template]}</span>
                    <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-card">
                      <span className="block h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(opened / Math.max(itemCount, 1)) * 100}%` }} />
                    </span>
                    <span className="font-mono text-xs font-bold text-fg-2">{format(t.openedCount, { n: opened, total: itemCount })}</span>
                  </div>
                  <button type="button" disabled={opened < itemCount} onClick={props.onReviewDone} className={primary}>
                    {opened < itemCount ? t.openAllFirst[template] : t.reviewDone}
                  </button>
                </div>
              ) : null}

              {isCurrent && task.type === "mission" && props.mission ? (
                <p className="ml-10 rounded-xl border border-card bg-surface-deep px-3 py-2.5 text-[13px] leading-normal text-fg-3 [animation:pop_.25s_ease-out_both]">
                  {props.mission.sale ? format(m.saleNote, { platform: props.mission.sale.platform }) : format(m.taskNote, { owner: props.mission.owner })}
                </p>
              ) : null}

              {isCurrent && task.type === "question" ? (
                <div className="flex flex-col gap-2 pl-10 [animation:pop_.25s_ease-out_both]" role="radiogroup" aria-label={task.text}>
                  {task.options.map((option, o) => (
                    <button
                      key={o}
                      type="button"
                      role="radio"
                      aria-checked={choice === o}
                      onClick={() => setPicked((p) => ({ ...p, [task.id]: o }))}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm leading-snug text-fg",
                        choice === o ? "border-accent bg-accent/10" : "border-line bg-surface-deep",
                      )}
                    >
                      <span className={cn("flex size-[18px] flex-none items-center justify-center rounded-full border-2", choice === o ? "border-accent" : "border-line")}>
                        <span className={cn("size-2 rounded-full", choice === o ? "bg-accent" : "bg-transparent")} />
                      </span>
                      {option}
                    </button>
                  ))}
                  <button type="button" disabled={choice === undefined} onClick={() => choice !== undefined && props.onAnswer(task.id, choice)} className={primary}>
                    {t.sendAnswer}
                  </button>
                </div>
              ) : null}

              {isDone && task.type === "question" && answers[task.id] !== undefined ? (
                <p className="pl-10 text-[13px] text-fg-3">{task.options[answers[task.id]]}</p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {finished ? (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-success/45 bg-success/[0.07] p-4 [animation:pop_.25s_ease-out_both]">
          <span className="flex items-center gap-2 font-bold">
            <Check className="size-4 text-success-fg" strokeWidth={2.6} aria-hidden="true" />
            {t.allDone}
          </span>
          <p className="text-[13px] leading-normal text-fg-3">{t.allDoneText}</p>
          <button type="button" onClick={props.onFinish} disabled={finishing} className={primary}>
            {finishing ? t.finishing : t.finish}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Masaüstünde sağdaki görev paneli (340 px). */
export function TaskAside(props: TaskPanelProps & { footer: string }) {
  const t = getMessages().lab.frame;
  const n = Math.min(props.current + 1, props.tasks.length);
  return (
    <aside aria-label={t.tasksTitle} className="hidden w-[340px] flex-none flex-col gap-3.5 overflow-y-auto pr-1.5 lg:flex lg:max-h-[var(--lab-height)]">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-bold">{t.tasksTitle}</h2>
        <span className="font-mono font-bold text-fg-3">{format(t.openedCount, { n, total: props.tasks.length })}</span>
      </div>
      <TaskList {...props} />
      <p className="flex items-start gap-2 text-xs leading-normal text-fg-4">
        <Lock className="mt-0.5 size-3 flex-none" strokeWidth={2.2} aria-hidden="true" />
        {props.footer}
      </p>
    </aside>
  );
}

/** Telefonda alttaki görev şeridi; dokununca görevler alttan açılır. Bütün görevler bitince kendiliğinden açılır. */
export function TaskSheet(props: TaskPanelProps & { footer: string }) {
  const t = getMessages().lab.frame;
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const wasFinished = useRef(props.finished);
  const n = Math.min(props.current + 1, props.tasks.length);
  const currentText = props.finished ? t.allDone : (props.tasks[props.current]?.text ?? "");

  useEffect(() => {
    if (props.finished && !wasFinished.current) {
      setOpen(true);
      setClosing(false);
    }
    wasFinished.current = props.finished;
  }, [props.finished]);

  function close() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false);
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 220);
  }

  const strip = (
    <button
      type="button"
      aria-expanded={open && !closing}
      onClick={() => (open && !closing ? close() : (setOpen(true), setClosing(false)))}
      className="flex min-h-16 w-full flex-none cursor-pointer items-center gap-2.5 border-t border-line bg-surface px-3.5 py-2.5 text-left text-fg lg:hidden"
    >
      <span className="flex h-7 flex-none items-center rounded-full bg-accent/12 px-2.5 text-[13px] font-bold text-accent-light">{format(t.task, { n, total: props.tasks.length })}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{currentText}</span>
      <span className="sr-only">{open ? t.closeTasks : t.openTasks}</span>
      {open && !closing ? <ChevronDown className="size-5 text-fg-3" aria-hidden="true" /> : <ChevronUp className="size-5 text-fg-3" aria-hidden="true" />}
    </button>
  );

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            aria-hidden="true"
            onClick={close}
            className={cn("absolute inset-0 bg-scrim", closing ? "[animation:fade-out_.22s_ease-in_both]" : "[animation:fade-in_.2s_ease-out_both]")}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.tasksTitle}
            className={cn(
              "absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-line bg-canvas",
              closing ? "[animation:sheet-down_.22s_ease-in_both]" : "[animation:slide-up_.28s_cubic-bezier(.2,.8,.2,1)_both]",
            )}
          >
            <div className="flex flex-none items-center justify-between px-4 pt-4 pb-2">
              <h2 className="font-heading text-xl font-bold">
                {t.tasksTitle} <span className="font-mono text-base text-fg-3">{format(t.openedCount, { n, total: props.tasks.length })}</span>
              </h2>
              <button type="button" onClick={close} aria-label={t.closeTasks} className="flex size-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface">
                <ChevronDown className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
              <TaskList {...props} />
              <p className="mt-3 flex items-start gap-2 text-xs leading-normal text-fg-4">
                <Lock className="mt-0.5 size-3 flex-none" strokeWidth={2.2} aria-hidden="true" />
                {props.footer}
              </p>
            </div>
            {strip}
          </div>
        </div>
      ) : null}
      {strip}
    </>
  );
}
