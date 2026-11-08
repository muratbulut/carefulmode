import {
  Castle,
  CreditCard,
  Download,
  HeartHandshake,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageCircle,
  Shield,
  Smartphone,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mahallenin ikonu ve rengi veritabanında ad olarak durur (Neighborhood.icon, .color). Renk bir
// tema rengi adıdır; bilinmeyen ad gelirse varsayılan kullanılır. Tailwind sınıfları tam yazılır
// (dinamik sınıf adı üretilmez).

const icons: Record<string, LucideIcon> = {
  castle: Castle,
  lock: LockKeyhole,
  mail: Mail,
  download: Download,
  card: CreditCard,
  heart: HeartHandshake,
  key: KeyRound,
  message: MessageCircle,
  phone: Smartphone,
  shield: Shield,
};

export type Tone = {
  /** Yazı ve ikon rengi */
  text: string;
  /** İkon kutusu zemini (soluk) */
  soft: string;
  /** Dolu zemin: ilerleme çubuğu, rota çizgisi, bitmiş düğüm */
  fill: string;
  /** SVG halkası */
  stroke: string;
  border: string;
  /** Kartın köşesindeki ışık */
  glow: string;
  /** Bitmemiş eğitim düğümünün kesikli çerçevesi */
  outline: string;
  /** Konu etiketi (lab detayı): soluk zemin ve yarı saydam çerçeve */
  chip: string;
};

const tones: Record<string, Tone> = {
  success: {
    text: "text-success-fg",
    soft: "bg-success/18",
    fill: "bg-success",
    stroke: "stroke-success",
    border: "border-success",
    glow: "bg-success/20",
    outline: "outline-success",
    chip: "border-success/40 bg-success/12",
  },
  accent: {
    text: "text-accent-fg",
    soft: "bg-accent/18",
    fill: "bg-accent",
    stroke: "stroke-accent",
    border: "border-accent",
    glow: "bg-accent/20",
    outline: "outline-accent",
    chip: "border-accent/40 bg-accent/12",
  },
  purple: {
    text: "text-purple-fg",
    soft: "bg-purple/18",
    fill: "bg-purple",
    stroke: "stroke-purple",
    border: "border-purple",
    glow: "bg-purple/20",
    outline: "outline-purple",
    chip: "border-purple/40 bg-purple/12",
  },
  warning: {
    text: "text-warning-fg",
    soft: "bg-warning/18",
    fill: "bg-warning",
    stroke: "stroke-warning",
    border: "border-warning",
    glow: "bg-warning/20",
    outline: "outline-warning",
    chip: "border-warning/40 bg-warning/12",
  },
  pink: {
    text: "text-pink-fg",
    soft: "bg-pink/18",
    fill: "bg-pink",
    stroke: "stroke-pink",
    border: "border-pink",
    glow: "bg-pink/20",
    outline: "outline-pink",
    chip: "border-pink/40 bg-pink/12",
  },
  orange: {
    text: "text-orange-fg",
    soft: "bg-orange/18",
    fill: "bg-orange",
    stroke: "stroke-orange",
    border: "border-orange",
    glow: "bg-orange/20",
    outline: "outline-orange",
    chip: "border-orange/40 bg-orange/12",
  },
};

export const toneOf = (color: string): Tone => tones[color] ?? tones.accent;
/** Mahallenin ikonu (adı veritabanında); bilinmeyen adda zarf. */
export function DistrictGlyph({ icon, ...props }: { icon: string } & LucideProps) {
  const Icon = icons[icon] ?? Mail;
  return <Icon {...props} />;
}

/** Mahallenin renkli ikon kutusu. */
export function NeighborhoodIcon({
  icon,
  color,
  className,
  iconClassName,
}: {
  icon: string;
  color: string;
  className?: string;
  iconClassName?: string;
}) {
  const tone = toneOf(color);
  return (
    <span className={cn("flex size-12 flex-none items-center justify-center rounded-[14px]", tone.soft, className)}>
      <DistrictGlyph icon={icon} className={cn("size-6", tone.text, iconClassName)} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

/** Kartın köşesindeki büyük, soluk ikon (süs). */
export function NeighborhoodWatermark({ icon, color, className }: { icon: string; color: string; className?: string }) {
  return (
    <DistrictGlyph
      icon={icon}
      className={cn("pointer-events-none absolute -right-6 -bottom-6 size-[150px] opacity-[0.08]", toneOf(color).text, className)}
      strokeWidth={1.4}
      aria-hidden="true"
    />
  );
}
