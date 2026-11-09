// Mahalle renkleri (Neighborhood.color tema rengi adıdır). Tailwind sınıfları tam yazılır.

const colors = {
  success: { dot: "bg-success", chip: "bg-success/12 text-success-fg", border: "border-success" },
  accent: { dot: "bg-accent", chip: "bg-accent/12 text-accent-fg", border: "border-accent" },
  purple: { dot: "bg-purple", chip: "bg-purple/12 text-purple-fg", border: "border-purple" },
  warning: { dot: "bg-warning", chip: "bg-warning/12 text-warning-fg", border: "border-warning" },
  pink: { dot: "bg-pink", chip: "bg-pink/12 text-pink-fg", border: "border-pink" },
} as const;

export function neighborhoodColor(name: string) {
  return colors[name as keyof typeof colors] ?? colors.accent;
}

/** Lab durumunun rengi (Lablar-Son: yayında yeşil, taslak gri, gizli sarı). */
export const statusColors = {
  PUBLISHED: { dot: "bg-success", badge: "bg-success/12 text-success-fg", tile: "border-success" },
  DRAFT: { dot: "bg-fg-3", badge: "bg-fg-3/12 text-fg-3", tile: "border-fg-3" },
  HIDDEN: { dot: "bg-warning", badge: "bg-warning/12 text-warning-fg", tile: "border-warning" },
} as const;

/** Sahnedeki gönderen avatarlarının renkleri (kurgusal uygulamaların kendi renkleri). */
export const avatarColors = ["bg-scene-amber", "bg-scene-blue", "bg-scene-green", "bg-scene-violet", "bg-scene-orange"] as const;
