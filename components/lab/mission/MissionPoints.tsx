import { Check } from "lucide-react";
import type { CardIcon } from "@/lib/lab/content";
import { cn } from "@/lib/utils";
import { RichLine } from "../scene/parts";
import { cardIconMap } from "../training/card-icons";

/** Maddelerin sırayla belirmesi: madde başına gecikme (ms). Düğme son maddeden sonra gelir. */
export const pointStepMs = 550;
const firstMs = 300;

/** Madde sırasına göre ikon kutusunun rengi (beş renk döner; tema değişkenleri `--call-point-*`). */
const tiles = [
  "bg-call-point-1 text-call-point-1-ink",
  "bg-call-point-2 text-call-point-2-ink",
  "bg-call-point-3 text-call-point-3-ink",
  "bg-call-point-4 text-call-point-4-ink",
  "bg-call-point-5 text-call-point-5-ink",
];

/** Son maddeden sonra gelecek öğenin (kabul düğmesi) gecikmesi, ms. */
export function afterPointsMs(count: number) {
  return firstMs + count * pointStepMs + 150;
}

/**
 * Görev kartının maddeleri (3 Kasım, 10 ve 17. revize): her madde kendi satırında, solunda renkli ikon
 * kutusu (ikonu yoksa onay işareti), önemli kısım **kalın**. `stagger` açıksa maddeler sırayla belirir
 * (aramanın altından çıkan kartta); "Hareketi azalt" açıksa hepsi birden görünür (globals.css).
 * `tone`: "sheet" aramadaki beyaz kart, "panel" Görevler panelindeki istek kutusu (temaya uyar).
 */
export function MissionPoints({
  points,
  icons = [],
  tone,
  stagger = false,
}: {
  points: string[];
  icons?: (CardIcon | null)[];
  tone: "sheet" | "panel";
  stagger?: boolean;
}) {
  if (points.length === 0) return null;
  return (
    <ul className={cn("flex flex-col", tone === "sheet" ? "gap-1.5" : "gap-1")} data-testid="mission-points">
      {points.map((point, i) => {
        const icon = icons[i];
        const Icon = icon ? cardIconMap[icon] : Check;
        return (
          <li
            key={point}
            className={cn(
              "flex items-center gap-2.5",
              tone === "sheet"
                ? "rounded-xl bg-call-point-row px-2.5 py-2 text-[14px] leading-snug text-call-sheet-muted [&_b]:text-call-sheet-ink"
                : "text-[13px] leading-snug text-fg-2 [&_b]:text-fg",
              stagger && "[animation:fade-up_.45s_ease-out_both]",
            )}
            style={stagger ? { animationDelay: `${firstMs + i * pointStepMs}ms` } : undefined}
          >
            <span
              aria-hidden="true"
              className={cn("flex flex-none items-center justify-center", tone === "sheet" ? "size-8 rounded-[9px]" : "size-6 rounded-md", tiles[i % tiles.length])}
            >
              <Icon className={tone === "sheet" ? "size-[18px]" : "size-3.5"} strokeWidth={2.2} />
            </span>
            <span>
              <RichLine text={point} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
