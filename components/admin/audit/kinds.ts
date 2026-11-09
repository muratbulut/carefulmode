// Kayıt türlerinin renkleri (Kayit-Defteri, Ozet-Son "Son kayıtlar"): Talep sarı, Rol mor, Lab
// camgöbeği, İçerik yeşil, Bakış pembe. Tailwind sınıfları tam yazılır.

import type { AuditKind } from "@/lib/audit";

export const kindTones: Record<AuditKind, { chip: string; text: string; border: string; dot: string }> = {
  application: { chip: "bg-warning/12 text-warning-fg", text: "text-warning-fg", border: "border-warning", dot: "bg-warning" },
  role: { chip: "bg-purple/12 text-purple-fg", text: "text-purple-fg", border: "border-purple", dot: "bg-purple" },
  lab: { chip: "bg-accent/12 text-accent-fg", text: "text-accent-fg", border: "border-accent", dot: "bg-accent" },
  content: { chip: "bg-success/12 text-success-fg", text: "text-success-fg", border: "border-success", dot: "bg-success" },
  view: { chip: "bg-pink/12 text-pink-fg", text: "text-pink-fg", border: "border-pink", dot: "bg-pink" },
};
