import { Check, Sparkles } from "lucide-react";
import { format, getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Placement } from "./cards";

// Eşleştirme ve boşluk doldurmanın ortak parçaları: "Kontrol et" düğmesi ve sonuç kutusu.

export function CheckButton({ full, busy, onCheck }: { full: boolean; busy: boolean; onCheck: () => void }) {
  const m = getMessages().lab.training.place;
  return (
    <>
      <button
        type="button"
        onClick={onCheck}
        disabled={!full || busy}
        className="flex h-[50px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-on-accent transition-[filter,opacity] hover:brightness-110 disabled:cursor-default disabled:opacity-45 disabled:hover:brightness-100"
      >
        <Check className="size-5" strokeWidth={2.4} aria-hidden="true" />
        {m.check}
      </button>
      {!full ? <p className="sr-only">{m.fillFirst}</p> : null}
    </>
  );
}

/** Kontrolden sonra: hepsi doğruysa yeşil, değilse kaç doğru olduğu ve açıklama. */
export function PlacementResultBox({ placed, count }: { placed: Placement; count: number }) {
  const m = getMessages().lab.training.place;
  const { correct, slots, explain } = placed.result;
  const right = slots.filter(Boolean).length;
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-[14px] border px-4 py-3.5 [animation:pop_.25s_ease-out_both]",
        correct ? "border-success/50 bg-success/10" : "border-danger/55 bg-danger/10",
      )}
    >
      <span className={cn("flex size-9 flex-none items-center justify-center rounded-full text-on-accent", correct ? "bg-success" : "bg-danger")}>
        <Sparkles className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
      </span>
      <span className="flex flex-col gap-1">
        <b className={correct ? "text-success-fg" : "text-danger-fg"}>{correct ? m.allCorrect : format(m.someWrong, { n: right, total: count })}</b>
        {explain ? <span className="text-[15px] leading-normal text-fg-2">{explain}</span> : null}
      </span>
    </div>
  );
}
