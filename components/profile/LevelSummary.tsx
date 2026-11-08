import { Shield, Star } from "lucide-react";
import { ProgressBar } from "@/components/roadmap/ProgressRing";
import { format, getMessages, rich } from "@/lib/i18n";
import type { LevelInfo } from "@/lib/progress/levels";
import { cn } from "@/lib/utils";

// Seviye ve puan (Seviye-Son, Profil-Son, Ana-Sayfa-Son). Öğrenciye toplam seviye sayısı
// gösterilmez: "Seviye 3 · Bilinçli kullanıcı" ve "Seviye 4: İz sürücü için 40 puan kaldı".

const levelTitle = (level: number) => {
  const t = getMessages().progress;
  return t.levels[Math.min(level, t.levels.length) - 1] ?? "";
};

/** "Seviye 3 · Bilinçli kullanıcı" etiketi. */
export function LevelPill({ level, className }: { level: number; className?: string }) {
  const t = getMessages().progress;
  return (
    <span
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 self-start rounded-full border border-purple/45 bg-purple/14 px-3 text-[13px] font-bold text-purple-fg",
        className,
      )}
    >
      <Shield className="size-3.5" strokeWidth={2} aria-hidden="true" />
      {format(t.levelTitle, { n: level, title: levelTitle(level) })}
    </span>
  );
}

/** "660 puan" etiketi. */
export function PointsPill({ points, className }: { points: number; className?: string }) {
  const t = getMessages().progress;
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-warning/45 bg-warning/12 px-3 text-sm font-bold text-warning-fg",
        className,
      )}
    >
      <Star className="size-[15px]" strokeWidth={2} aria-hidden="true" />
      {format(t.points, { n: points })}
    </span>
  );
}

/** Sonraki seviyeye ilerleme çubuğu ve "Seviye 4: İz sürücü için 40 puan kaldı". */
export function LevelBar({ level, className }: { level: LevelInfo; className?: string }) {
  const t = getMessages().progress;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <ProgressBar value={level.progress} fillClass="bg-linear-to-r from-purple to-accent" trackClass="bg-canvas/60" className="h-2" />
      <span className="text-[13px] text-fg-3">
        {level.next === null
          ? t.top
          : rich(format(t.toNextNamed, { n: level.level + 1, title: levelTitle(level.level + 1), points: level.toNext }), {
              b: (chunk) => <b className="text-fg">{chunk}</b>,
            })}
      </span>
    </div>
  );
}
