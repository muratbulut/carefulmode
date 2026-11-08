import type { ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { LogoMark } from "@/lib/brand";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "./scene.css";

/**
 * Sahne kabuğu: 500x440'lık çizim alanın ortasına oturur (HeroScenes boyutu ayarlar). Çizim süstür,
 * ekran okuyucudan gizlenir; yerine tek cümlelik açıklama okunur.
 */
export function SceneFigure({ caption, className, children }: { caption: string; className?: string; children: ReactNode }) {
  return (
    <figure className={cn("hs-stage", "hs-scene", className)}>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="hs-art" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

/** Tarama çizgisi; içinde durduğu kutunun yukarısından aşağısına iner. */
export function Scan() {
  return <div className="hs-scan anim-scan" />;
}

/** rich() için şüpheli işaret etiketleri: <f1>, <f2>, <f3> sırayla 1.8, 3.0 ve 4.0. saniyede yanar. */
export const flagTags = {
  f1: (chunk: string) => <span className="hs-f1">{chunk}</span>,
  f2: (chunk: string) => <span className="hs-f2">{chunk}</span>,
  f3: (chunk: string) => <span className="hs-f3">{chunk}</span>,
};

/** "3 şüpheli işaret" etiketi (5.4. saniyede çıkar). */
export function FlagsLabel({ className }: { className?: string }) {
  const t = getMessages().landing.scene;
  return (
    <div className={cn("hs-label", "anim-label-pop", className)}>
      <TriangleAlert strokeWidth={2.4} />
      {t.flags}
    </div>
  );
}

/** Doğru kararın bildirimi (7. saniyede kayarak gelir). */
export function DoneToast({ children }: { children: ReactNode }) {
  return (
    <div className="hs-toast anim-toast-slide">
      <Check strokeWidth={2.6} />
      {children}
    </div>
  );
}

/** Sahnelerdeki parlayan maskot (eskiden kalkan). */
export function ShieldBadge() {
  return (
    <div className="hs-shield anim-glow-pulse">
      <LogoMark />
    </div>
  );
}
