import { DistrictGlyph, toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { format, getMessages } from "@/lib/i18n";
import type { CoverView } from "@/lib/news/cover";
import { cn } from "@/lib/utils";

/**
 * Haberin kapak görseli ya da (görsel yoksa) konunun çizimi: konunun renginde ışık ve büyük ikon
 * (4 Kasım, 15). Kutunun oranını çağıran verir (liste karesi, haber kapağı); görsel odak
 * noktasından kırpılır. `credit` açıksa görselin kaynağı köşede küçük yazılır.
 */
export function CoverImage({
  cover,
  topic,
  className,
  credit = false,
  priority = false,
  glyphClassName,
}: {
  cover: CoverView | null;
  topic: { color: string; icon: string } | null;
  className?: string;
  credit?: boolean;
  priority?: boolean;
  glyphClassName?: string;
}) {
  if (cover) {
    return (
      <span className={cn("relative block overflow-hidden bg-surface-deep", className)}>
        {/* Görsel bizim sunucumuzdan, boyutu belli; next/image'ın dönüştürücüsü kullanılmıyor (CSP img-src 'self'). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover.src}
          alt={cover.alt}
          width={cover.width}
          height={cover.height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: `${cover.focusX}% ${cover.focusY}%` }}
        />
        {credit && cover.credit ? (
          <span className="absolute right-2.5 bottom-2.5 max-w-[70%] truncate rounded-md bg-scene-scrim px-2 py-1 text-[11px] font-medium text-scene-white">
            {format(getMessages().news.article.coverCredit, { credit: cover.credit })}
          </span>
        ) : null}
      </span>
    );
  }
  const tone = toneOf(topic?.color ?? "accent");
  return (
    <span aria-hidden="true" className={cn("relative block overflow-hidden bg-surface-deep", className)}>
      <span className={cn("absolute -top-1/3 -right-1/4 size-[90%] rounded-full blur-3xl", tone.glow)} />
      <DistrictGlyph
        icon={topic?.icon ?? "mail"}
        className={cn("absolute top-1/2 right-[6%] h-[62%] w-auto -translate-y-1/2 -rotate-[8deg] opacity-90", tone.text, glyphClassName)}
        strokeWidth={1.5}
      />
    </span>
  );
}
