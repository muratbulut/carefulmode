"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent } from "react";
import { badgeTone } from "@/components/lab/mission/tones";
import { readMuted } from "@/components/lab/sound";
import { format, getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { badgeIcon, type BadgeCode } from "@/lib/progress/badges";
import { cn } from "@/lib/utils";

/**
 * Yeni rozet bildirimi (3 Kasım, 13. revize A): sağ üstte (telefonda üstte ortada) kayarak iner;
 * büyük rozet ikonu bir tur döner ve üstünden parıltı geçer, kısa bir bildirim sesi çalar (odanın
 * ses ayarı kapalıysa çalmaz). "Rozetlerimi gör" profildeki Rozetler bölümünü açar. Birkaç saniye
 * sonra kendiliğinden kapanır, üzerine gelinince ya da odaklanınca beklemez. "Hareketi azalt"
 * açıksa dönme ve parıltı yok, bildirim yalnızca belirir (globals.css).
 */
export function BadgeToast({
  codes,
  onClose,
  className,
  duration = 9000,
}: {
  codes: BadgeCode[];
  onClose: () => void;
  className?: string;
  duration?: number;
}) {
  const t = getMessages().progress;
  const close = useEffectEvent(onClose);
  const first = codes[0];
  const key = codes.join(",");

  useEffect(() => {
    if (!key) return;
    if (!readMuted()) badgeTone();
    const timer = window.setTimeout(() => close(), duration);
    return () => window.clearTimeout(timer);
  }, [key, duration]);

  return (
    <div role="status" className={cn("pointer-events-none fixed inset-x-3 top-3 z-[70] flex justify-center lg:inset-x-auto lg:top-5 lg:right-5 print:hidden", className)}>
      {first ? (
        <div
          key={key}
          data-testid="badge-toast"
          className="pointer-events-auto relative flex w-full max-w-[360px] items-center gap-3.5 overflow-hidden rounded-2xl border border-warning/70 bg-surface-raised py-3 pr-11 pl-3 shadow-toast [animation:badge-drop_.55s_cubic-bezier(.2,1.3,.4,1)_both]"
        >
          <span aria-hidden="true" className="relative size-[72px] flex-none [perspective:400px]">
            <span className="absolute -inset-1 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--warning)_45%,transparent),transparent_70%)] [animation:fade-in_.6s_ease-out_.4s_both]" />
            {/* eslint-disable-next-line @next/next/no-img-element -- küçük, yerel SVG rozet ikonu */}
            <img src={badgeIcon(first)} alt={t.badges[first].name} width={72} height={72} className="relative size-full [animation:badge-spin_1.1s_cubic-bezier(.3,.9,.4,1)_.35s_both]" />
            <span className="absolute inset-0 overflow-hidden rounded-full">
              <span className="absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,var(--badge-shine),transparent)] [animation:badge-shine_1s_ease-out_1.4s_both]" />
            </span>
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-heading text-xs font-bold tracking-[0.08em] text-warning-fg">{t.badgeToast.kicker}</span>
            <span className="font-heading text-base leading-tight font-bold text-fg">{t.badges[first].name}</span>
            {codes.length > 1 ? <span className="text-xs text-fg-2">{format(t.badgeToast.more, { names: codes.slice(1).map((c) => t.badges[c].name).join(", ") })}</span> : null}
            <Link href={paths.profileSection("badges")} className="mt-0.5 inline-flex min-h-8 items-center gap-1 text-sm font-bold text-accent-fg hover:underline">
              {t.badgeToast.link}
              <ArrowRight className="size-4" strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.badgeToast.close}
            className="absolute top-1.5 right-1.5 flex size-10 cursor-pointer items-center justify-center rounded-full text-fg-3 hover:bg-line hover:text-fg"
          >
            <X className="size-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
