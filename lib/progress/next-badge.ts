// Ana sayfadaki "Sıradaki rozetin": kazanılmamış rozetlerden bitmeye en yakın olanı. Sınıfa
// katılmak ve günün ipucu gibi lab dışı rozetler önerilmez; eşitlikte listedeki sıra geçerli.
// Tarayıcıda da çalışır (yalnızca hesap).

import type { BadgeState } from "./badges";

const skipped: BadgeState["progress"]["kind"][] = ["classroom", "days"];

export function nextBadge<T extends Pick<BadgeState, "code" | "earned" | "progress">>(badges: readonly T[]): T | null {
  let best: T | null = null;
  let bestRatio = -1;
  for (const badge of badges) {
    if (badge.earned || skipped.includes(badge.progress.kind) || badge.progress.total <= 0) continue;
    const { kind, value, total } = badge.progress;
    // Seviye 1'den başlar: 1. seviyedeki öğrenci için bu rozet daha hiç ilerlememiştir.
    const ratio = kind === "level" ? (value - 1) / Math.max(total - 1, 1) : Math.min(value / total, 1);
    if (ratio > bestRatio) {
      best = badge;
      bestRatio = ratio;
    }
  }
  return best;
}
