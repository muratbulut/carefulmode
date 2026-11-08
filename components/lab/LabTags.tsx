import { BookOpen, Clock, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { format, getMessages } from "@/lib/i18n";
import type { LabDifficulty } from "@/lib/lab/route";
import { cn } from "@/lib/utils";

/**
 * Odanın türü, zorluğu ve süresi renkli çerçeveli etiketlerde (3 Kasım, 15. revize A). Tür: eğitim
 * mavi, senaryo mor. Zorluk ve süre: kolay ya da kısa yeşil, orta sarı, zor ya da uzun kırmızı.
 * Renk tek başına anlam taşımaz; ikon ve yazı her etikette durur.
 */
export type TagTone = "good" | "mid" | "hard" | "training" | "scenario";

export const difficultyTone: Record<LabDifficulty, TagTone> = { EASY: "good", MEDIUM: "mid", HARD: "hard" };

/** 6 dakika ve altı kısa, 7-10 orta, 11 ve üstü uzun. */
export function durationTone(minutes: number): TagTone {
  return minutes <= 6 ? "good" : minutes <= 10 ? "mid" : "hard";
}

const levels: Record<LabDifficulty, number> = { EASY: 1, MEDIUM: 2, HARD: 3 };
const barTone: Record<LabDifficulty, string> = { EASY: "bg-success", MEDIUM: "bg-warning", HARD: "bg-danger" };

/** Zorluk çubukları: kolay 1, orta 2, zor 3 dolu çubuk. */
export function DifficultyBars({ difficulty, className }: { difficulty: LabDifficulty; className?: string }) {
  const filled = levels[difficulty];
  return (
    <span aria-hidden="true" className={cn("inline-flex items-end gap-0.5", className)}>
      {[6, 9, 12].map((height, i) => (
        <span key={height} className={cn("w-1 rounded-[2px]", i < filled ? barTone[difficulty] : "bg-line")} style={{ height }} />
      ))}
    </span>
  );
}

/** 4 Kasım (Murat): etiketler biraz daha canlı; çerçeve ve zemin daha dolgun. */
const toneClass: Record<TagTone, string> = {
  good: "border-success/75 bg-success/20 text-success-fg",
  mid: "border-warning/75 bg-warning/20 text-warning-fg",
  hard: "border-danger/75 bg-danger/20 text-danger-fg",
  training: "border-accent/75 bg-accent/20 text-accent-fg",
  scenario: "border-purple/75 bg-purple/20 text-purple-fg",
};

const sizeClass = {
  md: "h-[30px] gap-1.5 px-3 text-[13px] [&_svg]:size-3.5",
  sm: "h-6 gap-1 px-2 text-xs [&_svg]:size-3",
};

export function LabTag({ tone, size = "md", children, className }: { tone: TagTone; size?: "md" | "sm"; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex flex-none items-center rounded-full border font-bold", sizeClass[size], toneClass[tone], className)}>{children}</span>;
}

export function KindTag({ type, size }: { type: "TRAINING" | "SCENARIO"; size?: "md" | "sm" }) {
  const Icon = type === "TRAINING" ? BookOpen : FlaskConical;
  return (
    <LabTag tone={type === "TRAINING" ? "training" : "scenario"} size={size}>
      <Icon strokeWidth={2.2} aria-hidden="true" />
      {getMessages().lab.kinds[type]}
    </LabTag>
  );
}

export function DifficultyTag({ difficulty, size }: { difficulty: LabDifficulty; size?: "md" | "sm" }) {
  return (
    <LabTag tone={difficultyTone[difficulty]} size={size}>
      <DifficultyBars difficulty={difficulty} />
      {getMessages().lab.difficulty[difficulty]}
    </LabTag>
  );
}

/** `long`: "Yaklaşık 9 dk" (kapakta), yoksa "9 dk". */
export function DurationTag({ minutes, size, long }: { minutes: number; size?: "md" | "sm"; long?: boolean }) {
  const t = getMessages().lab;
  return (
    <LabTag tone={durationTone(minutes)} size={size}>
      <Clock strokeWidth={2.2} aria-hidden="true" />
      {format(long ? t.duration : t.durationShort, { n: minutes })}
    </LabTag>
  );
}
