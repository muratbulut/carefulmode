"use client";

import { ArrowDown, ArrowRight, Check, GripVertical, X } from "lucide-react";
import { useState } from "react";
import type { ClientCard } from "@/lib/lab/client";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { cardIconMap } from "./card-icons";
import { type Placement } from "./cards";
import { CardTag, CardTitle, Mark, rowTones, toneAt } from "./common";
import { DragGhost, draggable, useDragDrop } from "./drag";
import { HelpButton, HelpDialog, MatchDemo, useHelp } from "./help";
import { CheckButton, PlacementResultBox } from "./placement";

type MatchCard = Extract<ClientCard, { type: "match" }>;

/**
 * Eşleştirme (Tur 7 A, Murat 1 Kasım): soldaki her bilgi ve onun yeri aynı hizada, aynı boyda; altta
 * seçenek tepsisi. Seçili yere tepsiden dokunarak ya da seçeneği tutup yere sürükleyerek konur;
 * sonra sıradaki boş yer seçilir. Bütün yerler dolunca "Kontrol et". Doğru eşler tarayıcıda yoktur,
 * her yerin doğru olup olmadığını sürücü (sunucu) söyler. Bir kez kontrol edilir.
 */
export function MatchView({ card, placed, busy, onCheck }: { card: MatchCard; placed: Placement | null; busy: boolean; onCheck: (picks: number[]) => void }) {
  const t = getMessages().lab.training;
  const m = t.place;
  const count = card.lefts.length;
  const [picks, setPicks] = useState<(number | null)[]>(() => placed?.picks ?? Array.from({ length: count }, () => null));
  const [active, setActive] = useState<number | null>(placed ? null : 0);
  const [said, setSaid] = useState("");
  const done = placed !== null;
  const shown: (number | null)[] = placed?.picks ?? picks;
  const full = picks.every((p) => p !== null);
  const help = useHelp("match", done);
  // Bire bir eşleştirmede (sağdakiler hep farklıysa) her seçenek tek yere gider; aynı sağın birden
  // çok kez yazıldığı eşleştirmede aynı seçenek birden çok yere gelebilir.
  const single = card.bank.length >= count;
  const { drag, down, quiet, rootProps } = useDragDrop({
    enabled: !done && !busy,
    onDrop: (option, target) => {
      put(option, target);
      setSaid(format(m.moved, { n: target + 1, text: card.bank[option] ?? "" }));
    },
  });

  function select(slot: number) {
    if (done) return;
    // Seçili ve dolu yere yeniden dokunmak onu boşaltır.
    if (active === slot && picks[slot] !== null) setPicks(picks.map((p, i) => (i === slot ? null : p)));
    else setActive(slot);
  }

  function choose(option: number, at: number) {
    if (done || busy || quiet(option, at)) return;
    const target = active ?? picks.findIndex((p) => p === null);
    if (target >= 0) put(option, target);
  }

  function put(option: number, target: number) {
    const next = picks.map((p, i) => (i === target ? option : single && p === option ? null : p));
    setPicks(next);
    const after = next.findIndex((p, i) => p === null && i > target);
    const first = next.findIndex((p) => p === null);
    setActive(after >= 0 ? after : first >= 0 ? first : null);
  }

  const waiting = drag !== null;

  return (
    <div className="flex flex-col gap-4 lg:gap-5" {...rootProps}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex">
          <CardTag>{t.tags.match}</CardTag>
        </span>
        <HelpButton onClick={help.show} />
      </div>
      <CardTitle>{card.title}</CardTitle>
      <p className="-mt-1.5 text-[15px] text-fg-3">{card.hint || m.matchHint}</p>

      <ol className="flex flex-col gap-2.5">
        {card.lefts.map((left, i) => {
          const tone = toneAt(rowTones, i);
          const icon = card.icons[i];
          const Icon = icon ? cardIconMap[icon] : null;
          const pick = shown[i];
          const value = pick !== null && pick !== undefined ? (card.bank[pick] ?? null) : null;
          const verdict = placed ? placed.result.slots[i] : null;
          const right = placed ? (card.bank[placed.result.answer[i]] ?? null) : null;
          const isActive = !done && active === i;
          const over = drag?.over === i;
          return (
            <li
              key={i}
              className="flex flex-col gap-1 rounded-2xl border border-card bg-surface-deep p-2 lg:grid lg:grid-cols-[minmax(0,1fr)_28px_minmax(0,1.15fr)] lg:items-stretch lg:gap-2.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
            >
              <span className="flex min-h-[58px] items-center gap-3 rounded-[14px] px-1.5 py-1 lg:min-h-[76px] lg:border lg:border-card lg:bg-surface-deep lg:px-3.5 lg:py-2.5">
                <span className={cn("flex size-10 flex-none items-center justify-center rounded-xl font-mono text-sm font-bold", tone.soft, tone.text)}>
                  {Icon ? <Icon className="size-5" strokeWidth={2.2} aria-hidden="true" /> : i + 1}
                </span>
                <span className="text-[15px] leading-snug font-bold">{left}</span>
              </span>
              <span aria-hidden="true" className={cn("flex items-center justify-center transition-colors", value !== null ? tone.text : "text-line-strong")}>
                <ArrowDown className="size-4 lg:hidden" strokeWidth={2.6} />
                <ArrowRight className="hidden size-[22px] lg:block" strokeWidth={2.4} />
              </span>
              <span className="flex flex-col gap-1">
                <button
                  type="button"
                  data-slot={i}
                  data-drop={i}
                  aria-pressed={isActive}
                  aria-label={format(m.slotLabel, { n: i + 1, value: value ?? m.empty })}
                  disabled={done || busy}
                  onClick={() => select(i)}
                  className={cn(
                    "flex min-h-[58px] w-full cursor-pointer items-center gap-2.5 rounded-[14px] border-2 px-3.5 py-2 text-left text-[15px] leading-snug font-bold transition-[background-color,border-color] duration-200 disabled:cursor-default lg:min-h-[76px]",
                    verdict === true
                      ? "border-success bg-success/10 text-fg"
                      : verdict === false
                        ? "border-danger bg-danger/10 text-fg [animation:shake_.4s_ease-in-out]"
                        : over
                          ? "border-accent bg-accent/20 text-fg"
                          : isActive
                            ? cn("border-accent bg-accent/12", value === null ? "text-accent-fg" : "text-fg")
                            : value !== null
                              ? cn(tone.edge, tone.wash, "text-fg")
                              : waiting
                                ? "border-dashed border-accent bg-accent/6 text-accent-fg"
                                : "border-dashed border-line-strong bg-canvas text-fg-3",
                  )}
                >
                  {value !== null ? (
                    <>
                      <span className="flex-1 [animation:pop_.2s_ease-out_both]">{value}</span>
                      {verdict === true ? (
                        <Mark tone="bg-success">
                          <Check className="size-[15px]" strokeWidth={3} aria-hidden="true" />
                        </Mark>
                      ) : verdict === false ? (
                        <Mark tone="bg-danger">
                          <X className="size-[15px]" strokeWidth={3} aria-hidden="true" />
                        </Mark>
                      ) : null}
                    </>
                  ) : (
                    <span className="flex-1 font-medium">{isActive ? m.pick : waiting ? m.dropHere : m.none}</span>
                  )}
                </button>
                {verdict === false && right ? <span className="pl-1 text-sm font-bold text-success-fg [animation:rise_.4s_ease-out_both]">{format(m.right, { answer: right })}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      {!done ? (
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-3.5 shadow-floating">
          <div className="flex items-center justify-between gap-2">
            <span aria-hidden="true" className="text-xs font-bold tracking-[0.8px] text-fg-3">
              {m.tray}
            </span>
            <span className="text-[13px] text-fg-3">{active !== null ? format(m.trayFor, { n: active + 1 }) : m.trayIdle}</span>
          </div>
          <div role="group" aria-label={m.bank} className="grid gap-2 lg:grid-cols-2">
            {card.bank.map((text, o) => {
              const at = picks.indexOf(o);
              const here = active !== null && picks[active] === o;
              return (
                <button
                  key={o}
                  type="button"
                  data-option={o}
                  disabled={busy}
                  onClick={(e) => choose(o, e.timeStamp)}
                  onPointerDown={(e) => down(o, e)}
                  onContextMenu={(e) => e.preventDefault()}
                  className={cn(
                    draggable,
                    "flex min-h-14 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[15px] leading-snug font-bold transition-[background-color,border-color,opacity] duration-200 disabled:opacity-60",
                    drag?.item === o && "opacity-40",
                    here
                      ? "border-2 border-accent bg-accent text-on-accent"
                      : at >= 0
                        ? "border-dashed border-line-strong bg-transparent text-fg-3"
                        : "border-line-strong bg-card text-fg hover:border-accent/60",
                  )}
                >
                  <GripVertical className={cn("size-4 flex-none", here ? "text-on-accent" : "text-fg-4")} strokeWidth={2.4} aria-hidden="true" />
                  <span className="flex-1">{text}</span>
                  {at >= 0 ? (
                    <span aria-hidden="true" title={format(m.where, { n: at + 1 })} className="flex size-6 flex-none items-center justify-center rounded-full bg-card font-mono text-xs text-fg-2 [animation:pop_.25s_ease-out_both]">
                      {at + 1}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!done ? <CheckButton full={full} busy={busy} onCheck={() => full && onCheck(picks.filter((p): p is number => p !== null))} /> : <PlacementResultBox placed={placed} count={count} />}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      {drag && card.bank[drag.item] !== undefined ? (
        <DragGhost drag={drag} className="flex min-h-14 items-center rounded-xl px-3.5 py-2 text-[15px] leading-snug">
          {card.bank[drag.item]}
        </DragGhost>
      ) : null}
      {help.open ? <HelpDialog kind="match" demo={<MatchDemo />} onClose={help.close} /> : null}
    </div>
  );
}
