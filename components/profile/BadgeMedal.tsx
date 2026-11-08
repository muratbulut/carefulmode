import Image from "next/image";
import { format, getMessages } from "@/lib/i18n";
import { badgeIcon, type BadgeCode, type BadgeState } from "@/lib/progress/badges";
import { cn } from "@/lib/utils";

/**
 * Rozet madalyası (Profil-Son, Ana-Sayfa-Son): public/badges/<kod>.svg (altıgen, rozetin kendi
 * renginde) ve üstünden ara sıra geçen ışık. Kazanılmamış rozet gri ve soluktur. Süstür; adı
 * yanında yazılır.
 */
export function BadgeMedal({
  code,
  earned,
  size = 60,
  shine = true,
  className,
}: {
  code: BadgeCode;
  earned: boolean;
  /** Kenar (px); ikon kare. */
  size?: number;
  shine?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size }} className={cn("relative block flex-none", className)}>
      <Image
        src={badgeIcon(code)}
        alt={getMessages().progress.badges[code].name}
        width={64}
        height={64}
        unoptimized
        className={cn("size-full", !earned && "opacity-40 grayscale")}
      />
      {earned && shine ? (
        // Işık, ikondaki altıgenin içinde kalır (64'lük ikonda altıgen 7,3-56,7 ve 3,5-60,5 arası).
        <span className="clip-hex absolute inset-x-[11.4%] inset-y-[5.5%] overflow-hidden">
          <span className="anim-medal-shine absolute -top-[20%] -bottom-[20%] left-0 w-[30%] bg-scene-white/25" />
        </span>
      ) : null}
    </span>
  );
}

/** Kazanılmamış rozetin ilerlemesi: "0/4 oda", "En iyi puanın 90/100", "Şu an Seviye 3". */
export function badgeProgressText(progress: BadgeState["progress"]) {
  const t = getMessages().progress.badgeProgress;
  const { kind, value, total } = progress;
  switch (kind) {
    case "labs":
      return total === 0 ? t.noLabs : format(t.labs, { value, total });
    case "best":
      return value === 0 ? t.bestNone : format(t.best, { value });
    case "classroom":
      return t.classroom;
    case "days":
      return format(t.days, { value, total });
    case "districts":
      return format(t.districts, { value, total });
    case "level":
      return format(t.level, { value });
    default:
      return format(t.count, { value, total });
  }
}

/** İlerleme çubuğu için 0-1 (seviye rozetinde 1. seviye başlangıçtır). */
export function badgeProgressRatio(progress: BadgeState["progress"]) {
  const { kind, value, total } = progress;
  if (total <= 0) return 0;
  return kind === "level" ? Math.max(0, (value - 1) / Math.max(total - 1, 1)) : Math.min(value / total, 1);
}
