import type { CSSProperties, Ref } from "react";
import { EYE_WHITE } from "@/lib/brand";
import { cn } from "@/lib/utils";
import "./mascot.css";

/**
 * Maskotun ruh hâlleri (maskot tuvali, "İfadeler" ve "Sitede oynanabilir").
 * idle: her zamanki hâli, arada göz kırpar. look: odada bir bağlantıya dikkatle bakar.
 * shut: şifre yazılırken göz kapalı. suspicious: bildirilen mesaj (sarı). surprised: şaşkın (mor).
 * happy: doğru karar (yeşil). love: yeni rozet (kalp göz). hacked: yanlış karar (kırmızı, X).
 * sleep: uyku. off: 404'teki kapalı düğme. loading: yükleniyor. out: çıkış (kapanıp uyur).
 */
export const mascotMoods = ["idle", "look", "shut", "suspicious", "surprised", "happy", "love", "hacked", "sleep", "off", "loading", "out"] as const;
export type MascotMood = (typeof mascotMoods)[number];

/** Ana sayfadaki büyük maskotun evcil tepkileri, tıklama sırasıyla; "try" 404'te açılmaya çalışmak. */
export const petReactions = [
  { id: "blink", ms: 900 },
  { id: "cheer", ms: 1400 },
  { id: "look", ms: 1800 },
  { id: "surprise", ms: 1400 },
  { id: "dizzy", ms: 1600 },
  { id: "love", ms: 1600 },
  { id: "nap", ms: 2600 },
] as const;
export type MascotReaction = (typeof petReactions)[number]["id"] | "try";

type Props = {
  mood?: MascotMood;
  reaction?: MascotReaction | null;
  /** Fareyi izleyen maskot: html'deki data-mascot-eyes ve data-mascot de onu etkiler. */
  follow?: boolean;
  /** Ana renk düğmenin içinde (yükleniyor): gövde düğmenin yazı rengini alır. */
  onAccent?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<SVGSVGElement>;
};

/**
 * Maskot: 128 × 72 kutuda gözlü düğme (lib/brand.tsx'teki LogoMark'ın hareketli hâli).
 * Her zaman süstür (aria-hidden); anlamı çevresindeki düğme ya da durum metni söyler.
 */
export function Mascot({ mood = "idle", reaction = null, follow = false, onAccent = false, className, style, ref }: Props) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 128 72"
      aria-hidden="true"
      focusable="false"
      data-mood={mood}
      className={cn(
        "mc",
        `mc-mood-${mood}`,
        mood === "idle" && !reaction && "mc-blink",
        reaction && `mc-r-${reaction}`,
        follow && "mc-follow",
        onAccent && "mc-on-accent",
        className,
      )}
      style={style}
    >
      <g className="mc-body">
        <rect className="mc-trk" x="4" y="4" width="120" height="64" rx="32" />
        <g className="mc-zz">
          <path className="mc-stroke" strokeWidth="2.6" d="M67 26h8l-8 9h8" />
          <path className="mc-stroke" strokeWidth="2" d="M79 16h6l-6 7h6" />
        </g>
        <g className="mc-knob">
          <circle className="mc-ball" cx="90" cy="36" r="24" fill={EYE_WHITE} />
          <g className="mc-look">
            <g className="mc-eye">
              <circle className="mc-pupil mc-ink" cx="90" cy="36" r="10.5" />
              <circle cx="93.6" cy="31.8" r="3.2" fill={EYE_WHITE} />
            </g>
          </g>
          <path className="mc-lid mc-ink" d="M67.2 28.5 A24 24 0 0 1 112.8 28.5 Z" />
          <path className="mc-happy mc-stroke" strokeWidth="5.5" d="M78 41 Q90 26 102 41" />
          <path className="mc-heart" fill="var(--pink)" d="M90 47 C78 39 76 31 81 27.5 C85 24.5 89 26.5 90 29.5 C91 26.5 95 24.5 99 27.5 C104 31 102 39 90 47 Z" />
          <path className="mc-x mc-stroke" strokeWidth="5" d="M83 29 L97 43 M97 29 L83 43" />
          <path className="mc-arc mc-stroke" strokeWidth="5" d="M79 36 Q90 44 101 36" />
        </g>
      </g>
      <g className="mc-badge">
        <circle cx="122" cy="2" r="13" fill="var(--success)" stroke="var(--canvas)" strokeWidth="3" />
        <path className="mc-stroke" strokeWidth="3.4" d="M116.5 2 L120.5 6 L127.5 -2" />
      </g>
    </svg>
  );
}
