"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { BottomSheet } from "@/components/roadmap/BottomSheet";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string; count: number; dot?: string };

const DESKTOP = "(min-width: 1024px)";

/**
 * Süzgeç düğmesi (F1): masaüstünde altında açılan küçük pencere, telefonda alttan açılan pencere.
 * Seçenekler işaretlenince liste hemen süzülür; "Tamam" yalnızca pencereyi kapatır.
 */
export function FilterControl({
  label,
  options,
  selected,
  onToggle,
  resultCount,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  resultCount: number;
}) {
  const t = getMessages().catalog;
  const [open, setOpen] = useState<"popover" | "sheet" | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const groupLabel = format(t.filterLabel, { name: label });

  // Masaüstü penceresi: dışarı tıklayınca ya da Escape ile kapanır.
  useEffect(() => {
    if (open !== "popover") return;
    const onPointer = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggleOpen() {
    if (open) {
      setOpen(null);
      return;
    }
    setOpen(window.matchMedia(DESKTOP).matches ? "popover" : "sheet");
  }

  const list = (
    <fieldset className="m-0 flex min-w-0 flex-col gap-0.5 border-0 p-0">
      <legend className="sr-only">{groupLabel}</legend>
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option.value)}
            className="flex min-h-[42px] cursor-pointer items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-2 text-left font-[inherit] text-[15px] text-fg hover:bg-card lg:min-h-[38px] lg:text-sm"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 flex-none items-center justify-center rounded-md border-2",
                on ? "border-accent bg-accent" : "border-line-strong bg-transparent",
              )}
            >
              {on ? <Check className="size-[13px] text-on-accent" strokeWidth={3} /> : null}
            </span>
            {option.dot ? <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", option.dot)} /> : null}
            <span className="flex-1 whitespace-nowrap">{option.label}</span>
            <span className="text-xs text-fg-4">{option.count}</span>
          </button>
        );
      })}
    </fieldset>
  );

  return (
    <div ref={box} className="relative flex-none">
      <button
        ref={button}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open !== null}
        aria-controls={open === "popover" ? panelId : undefined}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 font-[inherit] text-sm font-bold text-fg transition-colors",
          selected.length > 0 ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-line-strong",
        )}
      >
        {label}
        {selected.length > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-[5px] text-xs text-on-accent">{selected.length}</span>
        ) : null}
        <ChevronDown className={cn("size-4 text-fg-3 transition-transform", open === "popover" && "rotate-180")} strokeWidth={2} aria-hidden="true" />
      </button>

      {open === "popover" ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={groupLabel}
          className="absolute top-[52px] left-0 z-20 flex w-[260px] flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-floating [animation:fade-up_.2s_ease-out_both]"
        >
          {list}
          <div className="flex items-center justify-between border-t border-card px-2 pt-2">
            <span className="text-[13px] text-fg-3">{format(t.labCount, { n: resultCount })}</span>
            <button
              type="button"
              onClick={() => {
                setOpen(null);
                button.current?.focus();
              }}
              className="h-[34px] cursor-pointer rounded-[10px] border-0 bg-accent px-3.5 font-[inherit] text-[13px] font-bold text-on-accent"
            >
              {t.done}
            </button>
          </div>
        </div>
      ) : null}

      <BottomSheet
        open={open === "sheet"}
        onClose={() => setOpen(null)}
        label={groupLabel}
        closeLabel={getMessages().roadmap.preview.close}
        className="lg:hidden"
        title={<b className="text-[17px]">{label}</b>}
        footer={
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="h-[50px] w-full cursor-pointer rounded-xl border-0 bg-accent font-[inherit] text-base font-bold text-on-accent"
          >
            {format(t.showLabs, { n: resultCount })}
          </button>
        }
      >
        {list}
      </BottomSheet>
    </div>
  );
}
