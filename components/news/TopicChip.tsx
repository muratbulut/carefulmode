import { toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { cn } from "@/lib/utils";

/** Haberin konusu: mahalle renginde yuvarlak etiket ve noktası (Gundem-G2, H2). */
export function TopicChip({ name, color, className }: { name: string; color: string; className?: string }) {
  const tone = toneOf(color);
  return (
    <span className={cn("inline-flex h-[26px] flex-none items-center gap-1.5 self-start rounded-full px-2.5 text-xs font-bold whitespace-nowrap", tone.soft, tone.text, className)}>
      <TopicDot color={color} className="size-[7px]" />
      {name}
    </span>
  );
}

/** Konunun renkli noktası. */
export function TopicDot({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={cn("size-2 flex-none rounded-full", toneOf(color).fill, className)} />;
}
