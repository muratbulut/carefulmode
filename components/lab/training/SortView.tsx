"use client";

import { Check, GripVertical, Tag, X } from "lucide-react";
import { useState } from "react";
import type { ClientCard } from "@/lib/lab/client";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CardTag, CardTitle, type Placement } from "./cards";
import { DragGhost, draggable, useDragDrop } from "./drag";
import { DemoStage, HelpButton, HelpDialog, useHelp } from "./help";
import { sortColorClass, cardIconMap } from "./card-icons";

type SortCard = Extract<ClientCard, { type: "sort" }>;

const binColumns: Record<number, string> = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };

/**
 * Kutulara ayırma (Tur 6, kutulara ayırma yeni hali): renkli kutular ve ikonlu bilgiler. Öğrenci
 * bilgiyi tutup kutuya sürükler ya da önce bilgiye, sonra kutuya dokunur; kutudaki bilgiye dokununca
 * geri gelir. Hepsi yerleşince bir kez kontrol edilir; hangi bilginin hangi kutuya gittiğini sürücü
 * (sunucu) söyler. Seçimler sürücüye kutunun sırasıyla gider (eşleştirmeyle aynı yerleştirme).
 */
export function SortView({
  card,
  placed,
  busy,
  onCheck,
}: {
  card: SortCard;
  placed: Placement | null;
  busy: boolean;
  onCheck: (picks: number[]) => void;
}) {
  const t = getMessages().lab.training;
  const m = t.sort;
  const [picks, setPicks] = useState<(number | null)[]>(() => placed?.picks ?? card.items.map(() => null));
  const [sel, setSel] = useState<number | null>(null);
  const [said, setSaid] = useState("");

  const done = placed !== null;
  const shown: (number | null)[] = placed?.picks ?? picks;
  const left = picks.filter((p) => p === null).length;
  const help = useHelp("sort", done);
  const { drag, down, quiet, rootProps } = useDragDrop({ enabled: !done && !busy, onStart: () => setSel(null), onDrop: (item, bin) => put(item, bin) });
  const moving = drag?.item ?? sel;

  function put(item: number, bin: number) {
    setPicks((all) => all.map((p, i) => (i === item ? bin : p)));
    setSel(null);
    setSaid(format(m.moved, { text: card.items[item]?.text ?? "", bin: card.bins[bin]?.label ?? "" }));
  }

  function tapItem(i: number, at: number) {
    if (done || busy || quiet(i, at)) return;
    if (picks[i] !== null) {
      setPicks((all) => all.map((p, j) => (j === i ? null : p)));
      setSel(null);
      setSaid(format(m.back, { text: card.items[i]?.text ?? "" }));
    } else setSel(sel === i ? null : i);
  }

  function tapBin(b: number) {
    if (done || busy || sel === null) return;
    put(sel, b);
  }

  const right = placed ? placed.result.slots.filter(Boolean).length : 0;
  const ghost = drag ? card.items[drag.item] : null;
  const GhostIcon = ghost ? cardIconMap[ghost.icon] : Tag;

  return (
    <div className="flex flex-col gap-4 lg:gap-5" {...rootProps}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex">
          <CardTag>{t.tags.sort}</CardTag>
        </span>
        <HelpButton onClick={help.show} />
      </div>
      <CardTitle>{card.title}</CardTitle>
      <p className="-mt-1.5 text-[15px] text-fg-3">{card.hint || m.hint}</p>

      {!done && left > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-line bg-surface-deep p-3">
          <span className="text-xs font-bold tracking-[0.8px] text-fg-3">{format(m.trayLabel, { n: left })}</span>
          <div role="group" aria-label={m.tray} className="flex flex-wrap gap-2">
            {card.items.map((item, i) => {
              if (picks[i] !== null) return null;
              const Icon = cardIconMap[item.icon];
              return (
                <button
                  key={i}
                  type="button"
                  data-sort-item={i}
                  aria-pressed={sel === i}
                  aria-label={format(m.item, { text: item.text })}
                  disabled={busy}
                  onClick={(e) => tapItem(i, e.timeStamp)}
                  onPointerDown={(e) => down(i, e)}
                  onContextMenu={(e) => e.preventDefault()}
                  className={cn(
                    draggable,
                    "flex min-h-[52px] min-w-0 grow basis-[calc(50%-4px)] items-center gap-2.5 rounded-[14px] border-2 bg-card py-1.5 pr-2.5 pl-1.5 text-left text-[15px] leading-tight font-bold transition-[transform,box-shadow,border-color,opacity] duration-150 lg:grow-0 lg:basis-auto",
                    sel === i ? "-translate-y-0.5 border-accent bg-accent/12 shadow-floating" : "border-line hover:border-accent/60",
                    drag?.item === i && "opacity-40",
                  )}
                >
                  <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-accent/12 text-accent-fg">
                    <Icon className="size-5" strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">{item.text}</span>
                  <GripVertical className="size-4 flex-none text-fg-4" strokeWidth={2.2} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className={cn("flex flex-col gap-2.5 lg:grid lg:gap-3", binColumns[card.bins.length])}>
        {card.bins.map((bin, b) => {
          const color = sortColorClass[bin.color];
          const BinIcon = cardIconMap[bin.icon];
          const ready = !done && moving !== null;
          const inside = card.items.flatMap((item, i) => (shown[i] === b ? [{ item, i }] : []));
          return (
            <div
              key={b}
              data-sort-bin={b}
              data-drop={b}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-2xl border-2 transition-[background-color,border-color] duration-150",
                drag?.over === b ? color.over : ready ? color.ready : color.idle,
              )}
            >
              <button
                type="button"
                aria-label={format(m.bin, { bin: bin.label })}
                disabled={done || busy || sel === null}
                onClick={() => tapBin(b)}
                className="absolute inset-0 cursor-pointer disabled:cursor-default"
              />
              <div className={cn("pointer-events-none relative flex items-center gap-2.5 border-b px-3 py-2.5", color.head)}>
                <span className={cn("flex size-[34px] flex-none items-center justify-center rounded-[10px]", color.icon)}>
                  <BinIcon className="size-[18px]" strokeWidth={2.4} aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-px">
                  <b className={cn("font-heading text-base leading-tight", color.text)}>{bin.label}</b>
                  {bin.note ? <span className="text-[13px] leading-snug text-fg-2">{bin.note}</span> : null}
                </span>
              </div>
              <div className="pointer-events-none relative flex min-h-16 flex-col gap-1.5 p-2.5 lg:min-h-[180px]">
                {inside.map(({ item, i }) => {
                  const Icon = cardIconMap[item.icon];
                  const verdict = placed ? placed.result.slots[i] : null;
                  // Daha kapalı kutu (hoşgörülü kart): doğru sayılır, sarı çerçeve ve anlayışlı not.
                  const soft = placed?.result.soft?.[i] === true;
                  const answer = placed ? card.bins[placed.result.answer[i]]?.label : undefined;
                  return (
                    // Bir bilgi seçiliyken kutunun her yeri (içindeki bilgiler de) o bilgiyi koyar.
                    <span key={i} className={cn("flex flex-col gap-0.5", sel === null ? "pointer-events-auto" : "pointer-events-none")}>
                      <button
                        type="button"
                        data-sort-item={i}
                        aria-label={
                          verdict === null
                            ? format(m.placed, { text: item.text, bin: bin.label })
                            : format(m.placedDone, { text: item.text, bin: bin.label, verdict: verdict ? m.verdictOk : m.verdictWrong })
                        }
                        disabled={done || busy}
                        onClick={(e) => tapItem(i, e.timeStamp)}
                        onPointerDown={(e) => down(i, e)}
                        onContextMenu={(e) => e.preventDefault()}
                        className={cn(
                          draggable,
                          "flex min-h-10 items-center gap-2 rounded-[10px] border-2 py-1 pr-2.5 pl-1.5 text-left text-sm leading-tight font-bold",
                          soft ? "border-warning bg-warning/10" : verdict === true ? "border-success bg-success/10" : verdict === false ? "border-danger bg-danger/10" : "border-line bg-card",
                          drag?.item === i && "opacity-40",
                        )}
                      >
                        <span className="flex size-7 flex-none items-center justify-center rounded-lg bg-surface text-fg-2">
                          <Icon className="size-4" strokeWidth={2.2} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">{item.text}</span>
                        {verdict === true ? <Check className={cn("size-4 flex-none", soft ? "text-warning-fg" : "text-success-fg")} strokeWidth={2.6} aria-hidden="true" /> : null}
                        {verdict === false ? <X className="size-4 flex-none text-danger-fg" strokeWidth={2.6} aria-hidden="true" /> : null}
                      </button>
                      {verdict === false && answer ? <span className="text-[13px] font-bold text-success-fg">{format(m.right, { bin: answer })}</span> : null}
                      {soft && answer ? <span className="text-[13px] leading-snug font-bold text-warning-fg">{format(m.softItem, { bin: answer })}</span> : null}
                    </span>
                  );
                })}
                {!done && (inside.length === 0 || ready) ? (
                  <span className={cn("flex min-h-10 flex-1 items-center justify-center text-center text-[13px] font-bold", ready ? color.text : "text-fg-4")}>
                    {ready ? m.dropHere : m.empty}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {!done ? (
        <>
          <button
            type="button"
            onClick={() => left === 0 && onCheck(picks.filter((p): p is number => p !== null))}
            disabled={left > 0 || busy}
            className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-on-accent transition-[filter,opacity] hover:brightness-110 disabled:cursor-default disabled:opacity-45 disabled:hover:brightness-100"
          >
            <Check className="size-5" strokeWidth={2.4} aria-hidden="true" />
            {t.place.check}
          </button>
          {left > 0 ? <p className="sr-only">{t.place.fillFirst}</p> : null}
        </>
      ) : (
        <div
          role="status"
          className={cn(
            "flex flex-col gap-1.5 rounded-[14px] border px-4 py-3.5 [animation:pop_.25s_ease-out_both]",
            placed.result.correct ? "border-success/50 bg-success/10" : "border-danger/55 bg-danger/10",
          )}
        >
          <b className={placed.result.correct ? "text-success-fg" : "text-danger-fg"}>
            {placed.result.correct ? t.place.allCorrect : format(m.someWrong, { n: right, total: card.items.length })}
          </b>
          {placed.result.soft?.some(Boolean) ? <p className="text-[15px] leading-normal font-bold text-warning-fg">{m.softNote}</p> : null}
          {placed.result.explain ? <p className="text-[15px] leading-normal text-fg-2">{placed.result.explain}</p> : null}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {said}
      </p>

      {ghost && drag ? (
        <DragGhost drag={drag} className="flex min-h-[52px] items-center gap-2.5 rounded-[14px] py-1.5 pr-2.5 pl-1.5 text-[15px] leading-tight">
          <span className="flex size-9 flex-none items-center justify-center rounded-[10px] bg-accent/12 text-accent-fg">
            <GhostIcon className="size-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">{ghost.text}</span>
        </DragGhost>
      ) : null}
      {help.open ? <HelpDialog kind="sort" demo={<SortDemo card={card} />} onClose={help.close} /> : null}
    </div>
  );
}

/**
 * Kutulara ayırmanın "Nasıl oynanır" sahnesi: el bir bilgiyi son kutuya taşır. Kutular kartın kendi
 * renkleri ve ikonlarıyla çizilir; bilgi genel bir örnektir ("Bir bilgi"), kartın cevabını ele vermez.
 */
function SortDemo({ card }: { card: SortCard }) {
  const h = getMessages().lab.training.help.sort;
  // Kutular sahnenin altında yan yana (üstü 112, yüksekliği 78); bilgi son kutunun ortasına iner.
  const bins = card.bins.slice(0, 4);
  const n = Math.max(bins.length, 1);
  const width = (300 - 12 - (n - 1) * 10) / n;
  const lastLeft = 6 + (n - 1) * (width + 10);
  return (
    <DemoStage label={h.demoItem} to={{ x: lastLeft + width / 2, y: 150 }} ok={{ left: lastLeft + width - 14, top: 104 }}>
      {bins.map((bin, b) => {
        const color = sortColorClass[bin.color];
        const Icon = cardIconMap[bin.icon];
        return (
          <div
            key={b}
            className={cn(
              "absolute top-[112px] flex h-[78px] flex-col items-center gap-1 rounded-xl border-2 pt-2",
              color.idle,
              color.text,
              b === bins.length - 1 && "drag-demo-target",
            )}
            style={{ left: 6 + b * (width + 10), width }}
          >
            <span className={cn("flex size-6 items-center justify-center rounded-[7px]", color.icon)}>
              <Icon className="size-3.5" strokeWidth={2.4} />
            </span>
            <span className={cn("h-1.5 w-8 rounded-full opacity-60", color.swatch)} />
          </div>
        );
      })}
    </DemoStage>
  );
}
