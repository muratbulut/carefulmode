"use client";

import { ArrowRight, Check } from "lucide-react";
import { Fragment, useState } from "react";
import type { ClientCard } from "@/lib/lab/client";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RichLine } from "../scene/parts";
import { type Placement } from "./cards";
import { CardTag, CardTitle } from "./common";
import { DragGhost, draggable, useDragDrop } from "./drag";
import { FillDemo, HelpButton, HelpDialog, useHelp } from "./help";
import { CheckButton, PlacementResultBox } from "./placement";

type FillCard = Extract<ClientCard, { type: "fill" }>;

/**
 * Boşluk doldurma (Tur 7 B, Murat 1 Kasım): cümleler tek tek gelir. Öğrenci kelimeye dokunur ya da
 * kelimeyi boşluğa sürükler; cümle dolunca kendiliğinden geçilmez, öğrenci cümleyi yeniden okuyup
 * "Sonraki cümle" ile geçer (Murat, 3 Kasım), sonunda özet. Özette cümleye dokunup
 * geri dönülür, hazırsa "Kontrol et". Boşluk durağandır (kayan çizgi yok, Murat). Doğru kelimeler
 * tarayıcıda yoktur, sürücü (sunucu) söyler; bir kez kontrol edilir.
 */
export function FillView({ card, placed, busy, onCheck }: { card: FillCard; placed: Placement | null; busy: boolean; onCheck: (picks: number[]) => void }) {
  const t = getMessages().lab.training;
  const m = t.place;
  const total = card.sentences.length;
  // Her cümlenin ilk yerinin sırası; yerler bütün kartta baştan sona numaralıdır.
  const offsets: number[] = [];
  let count = 0;
  for (const texts of card.sentences) {
    offsets.push(count);
    count += texts.length - 1;
  }
  const slotsOf = (s: number) => Array.from({ length: Math.max(0, (card.sentences[s]?.length ?? 1) - 1) }, (_, i) => offsets[s] + i);
  const sentenceOf = (slot: number) => Math.max(0, offsets.filter((o) => o <= slot).length - 1);

  const [picks, setPicks] = useState<(number | null)[]>(() => placed?.picks ?? Array.from({ length: count }, () => null));
  const [cur, setCur] = useState(placed ? total : 0);
  const [active, setActive] = useState<number | null>(placed ? null : 0);
  const [said, setSaid] = useState("");
  const done = placed !== null;
  const shown: (number | null)[] = placed?.picks ?? picks;
  const full = picks.every((p) => p !== null);
  const inSummary = cur >= total;
  const help = useHelp("fill", done);
  const { drag, down, quiet, rootProps } = useDragDrop({
    enabled: !done && !busy && !inSummary,
    onDrop: (option, target) => {
      put(option, target);
      setSaid(format(m.moved, { n: target + 1, text: card.bank[option] ?? "" }));
    },
  });

  function go(s: number, all = picks) {
    if (done) return;
    setCur(s);
    const slots = slotsOf(s);
    setActive(s < total ? (slots.find((i) => all[i] === null) ?? slots[0] ?? null) : null);
  }

  function select(slot: number) {
    if (done) return;
    if (active === slot && picks[slot] !== null) setPicks(picks.map((p, i) => (i === slot ? null : p)));
    else setActive(slot);
  }

  function choose(option: number, at: number) {
    if (done || busy || inSummary || quiet(option, at)) return;
    const slots = slotsOf(cur);
    const target = active !== null && slots.includes(active) ? active : (slots.find((i) => picks[i] === null) ?? slots[0]);
    if (target !== undefined) put(option, target);
  }

  // Kelimeyi yere koyar; cümlede boş yer kaldıysa ona geçer. Cümle dolunca beklenir: öğrenci
  // "Sonraki cümle" ile kendisi geçer.
  function put(option: number, target: number) {
    const next = picks.map((p, i) => (i === target ? option : p));
    setPicks(next);
    const s = sentenceOf(target);
    const slots = slotsOf(s);
    const empty = slots.find((i) => i > target && next[i] === null) ?? slots.find((i) => next[i] === null);
    if (empty !== undefined) {
      setActive(empty);
      return;
    }
    setActive(null);
  }

  // Dolu cümleden sonra gidilecek yer: boş yeri olan sıradaki cümle (sonra baştakiler), yoksa özet.
  function nextStop() {
    const order = [...Array.from({ length: total - cur - 1 }, (_, k) => cur + 1 + k), ...Array.from({ length: cur }, (_, k) => k)];
    return order.find((k) => slotsOf(k).some((i) => picks[i] === null)) ?? total;
  }

  const word = (slot: number) => {
    const p = shown[slot];
    return p !== null && p !== undefined ? (card.bank[p] ?? null) : null;
  };
  const sentenceFull = (s: number) => slotsOf(s).every((i) => shown[i] !== null);
  const curPick = active !== null ? picks[active] : null;

  return (
    <div className="flex flex-col gap-4 lg:gap-5" {...rootProps}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex">
          <CardTag>{t.tags.fill}</CardTag>
        </span>
        <HelpButton onClick={help.show} />
      </div>
      <CardTitle>{card.title}</CardTitle>
      {card.hint ? <p className="-mt-1.5 text-[15px] text-fg-3">{card.hint}</p> : null}

      {/* Cümleler arasında gezinme */}
      <div role="group" aria-label={m.sentences} className="flex items-center gap-2">
        {card.sentences.map((_, s) => {
          const here = cur === s;
          const filled = sentenceFull(s);
          return (
            <button
              key={s}
              type="button"
              aria-label={format(m.sentenceLabel, { n: s + 1 })}
              aria-current={here ? "step" : undefined}
              disabled={done}
              onClick={() => go(s)}
              className={cn(
                "flex h-10 min-w-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border font-mono text-[13px] font-bold transition-[background-color,border-color] duration-200 disabled:cursor-default",
                here ? "border-2 border-accent bg-accent/14 text-accent-fg" : filled ? "border-line bg-accent/6 text-accent-fg" : "border-line bg-surface-deep text-fg-3",
              )}
            >
              {filled ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : null}
              {s + 1}
            </button>
          );
        })}
        <button
          type="button"
          aria-current={inSummary ? "step" : undefined}
          disabled={done}
          onClick={() => go(total)}
          className={cn(
            "flex h-10 flex-[1.3] cursor-pointer items-center justify-center rounded-xl border text-[13px] font-bold transition-[background-color,border-color] duration-200 disabled:cursor-default",
            inSummary ? "border-2 border-accent bg-accent/14 text-accent-fg" : "border-line bg-surface-deep text-fg-3",
          )}
        >
          {m.summary}
        </button>
      </div>

      {!inSummary ? (
        <>
          <div
            key={cur}
            className="flex min-h-[230px] flex-col justify-center gap-[18px] rounded-[22px] border border-line bg-[radial-gradient(120%_90%_at_0%_0%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_60%),var(--surface-deep)] p-5 [animation:slide-in_.3s_ease-out_both] lg:min-h-[220px] lg:p-7"
          >
            <span className="text-xs font-bold tracking-[0.8px] text-accent-fg">{format(m.sentence, { n: cur + 1 })}</span>
            <p className="font-heading text-[21px] leading-[1.7] font-medium text-fg lg:text-2xl">
              {card.sentences[cur].map((text, i) => {
                const slot = offsets[cur] + i;
                const last = i === card.sentences[cur].length - 1;
                const value = last ? null : word(slot);
                return (
                  <Fragment key={i}>
                    <RichLine text={text} />
                    {!last ? (
                      <button
                        type="button"
                        data-slot={slot}
                        data-drop={slot}
                        aria-pressed={active === slot}
                        aria-label={format(m.slotLabel, { n: slot + 1, value: value ?? m.blank })}
                        disabled={busy}
                        onClick={() => select(slot)}
                        className={cn(
                          "mx-1 inline-flex min-h-11 min-w-[130px] cursor-pointer items-center justify-center rounded-xl px-3.5 align-middle font-bold text-fg transition-[background-color,border-color,box-shadow] duration-200",
                          value === null
                            ? "bg-accent/10 bg-[linear-gradient(90deg,var(--accent)_50%,transparent_0)] bg-[length:12px_2px] bg-bottom bg-repeat-x"
                            : "border-2 border-accent bg-accent/16",
                          drag?.over === slot && "bg-accent/24",
                          active === slot && card.sentences[cur].length > 2 && "ring-2 ring-accent/60",
                        )}
                      >
                        {value !== null ? <span className="[animation:pop_.2s_ease-out_both]">{value}</span> : <span aria-hidden="true">{"\u00a0"}</span>}
                      </button>
                    ) : null}
                  </Fragment>
                );
              })}
            </p>
          </div>
          <div role="group" aria-label={m.bank} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {card.bank.map((text, o) => {
              const here = curPick === o;
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
                    "min-h-[54px] rounded-[14px] border px-3 text-[17px] font-bold transition-[transform,box-shadow,background-color,opacity] duration-150 active:translate-y-[3px] disabled:opacity-60",
                    drag?.item === o && "opacity-40",
                    here
                      ? "border-accent bg-accent text-on-accent shadow-[0_5px_0_color-mix(in_srgb,var(--accent)_45%,var(--canvas))] active:shadow-[0_2px_0_color-mix(in_srgb,var(--accent)_45%,var(--canvas))]"
                      : "border-line-strong bg-card text-fg shadow-[0_5px_0_var(--surface-deep)] hover:border-accent/60 active:shadow-[0_2px_0_var(--surface-deep)]",
                  )}
                >
                  {text}
                </button>
              );
            })}
          </div>
          {sentenceFull(cur) && !done ? (
            <button
              type="button"
              onClick={() => go(nextStop())}
              className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-accent bg-accent/14 text-base font-bold text-accent-fg transition-colors hover:bg-accent/22 [animation:pop_.25s_ease-out_both]"
            >
              {nextStop() >= total ? m.toSummary : m.nextSentence}
              <ArrowRight className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : null}
          <p className="text-center text-sm text-fg-3">{sentenceFull(cur) ? m.fillReread : m.fillTip}</p>
        </>
      ) : (
        <>
          <ol className="flex flex-col gap-2.5">
            {card.sentences.map((texts, s) => {
              const slots = slotsOf(s);
              const verdicts = placed ? slots.map((i) => placed.result.slots[i]) : null;
              const ok = verdicts ? verdicts.every(Boolean) : null;
              return (
                <li key={s}>
                  <button
                    type="button"
                    disabled={done}
                    onClick={() => go(s)}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 text-left text-base leading-relaxed text-fg-2 disabled:cursor-default",
                      ok === true ? "border-[1.5px] border-success/60 bg-success/7" : ok === false ? "border-[1.5px] border-danger/60 bg-danger/7" : "border-card bg-surface-deep",
                      done && (ok === false ? "[animation:shake_.4s_ease-in-out]" : "[animation:flip-in_.45s_cubic-bezier(.2,.8,.2,1)_both]"),
                    )}
                    style={done ? { animationDelay: `${s * 0.12}s` } : undefined}
                  >
                    <span
                      className={cn(
                        "flex size-7 flex-none items-center justify-center rounded-full font-mono text-xs font-bold",
                        ok === true ? "bg-success text-on-accent" : ok === false ? "bg-danger text-on-danger" : "bg-card text-fg-2",
                      )}
                    >
                      {s + 1}
                    </span>
                    <span className="flex flex-col gap-1">
                      <span>
                        {texts.map((text, i) => {
                          const slot = offsets[s] + i;
                          const last = i === texts.length - 1;
                          const value = last ? null : word(slot);
                          const verdict = placed && !last ? placed.result.slots[slot] : null;
                          return (
                            <Fragment key={i}>
                              <RichLine text={text} />
                              {!last ? (
                                <b
                                  className={cn(
                                    "rounded-md px-1.5 py-px",
                                    verdict === true
                                      ? "bg-success/14 text-success-fg"
                                      : verdict === false
                                        ? "bg-danger/14 text-danger-fg"
                                        : value === null
                                          ? "bg-warning/12 text-warning-fg"
                                          : "bg-accent/12 text-accent-fg",
                                  )}
                                >
                                  {value ?? m.emptyWord}
                                </b>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </span>
                      {placed
                        ? slots
                            .filter((i) => placed.result.slots[i] === false)
                            .map((i) => (
                              <span key={i} className="text-sm font-bold text-success-fg">
                                {format(m.right, { answer: card.bank[placed.result.answer[i]] ?? "" })}
                              </span>
                            ))
                        : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {!done ? (
            <>
              <p className="-mt-1 text-center text-sm text-fg-3">{m.summaryTip}</p>
              <CheckButton full={full} busy={busy} onCheck={() => full && onCheck(picks.filter((p): p is number => p !== null))} />
            </>
          ) : (
            <PlacementResultBox placed={placed} count={count} />
          )}
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      {drag && card.bank[drag.item] !== undefined ? (
        <DragGhost drag={drag} className="flex min-h-[54px] items-center justify-center rounded-[14px] px-3 text-[17px]">
          {card.bank[drag.item]}
        </DragGhost>
      ) : null}
      {help.open ? <HelpDialog kind="fill" demo={<FillDemo />} onClose={help.close} /> : null}
    </div>
  );
}
