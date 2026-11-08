"use client";

import { Award, Info } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { ProgressBar } from "@/components/roadmap/ProgressRing";
import { format, getMessages } from "@/lib/i18n";
import { showcaseSize, type BadgeCode } from "@/lib/progress/badges";
import { toggleShowcase } from "@/lib/progress/actions";
import { cn } from "@/lib/utils";
import { BadgeMedal, badgeProgressRatio, badgeProgressText } from "./BadgeMedal";
import { SectionCard } from "./SectionCard";
import type { ProfileBadge } from "./types";

/**
 * Rozetler (Profil-Son): vitrin (en fazla 5 rozet, ana sayfadaki profil kartında görünür) ve
 * bütün rozetler. Kazanılmış rozete dokununca vitrine eklenir ya da çıkar; kazanılmamışa
 * dokununca nasıl kazanılacağı görünür.
 */
export function BadgesSection({ badges, showcase, onDone }: { badges: ProfileBadge[]; showcase: BadgeCode[]; onDone: (message: string) => void }) {
  const t = getMessages().progress;
  const s = t.showcase;
  const [shown, setShown] = useOptimistic(showcase);
  const [, startTransition] = useTransition();
  const [info, setInfo] = useState<BadgeCode | null>(null);
  const earnedCount = badges.filter((b) => b.earned).length;
  const selected = info ? badges.find((b) => b.code === info) : null;

  function press(badge: ProfileBadge) {
    setInfo(badge.code);
    if (!badge.earned) return;
    const inShowcase = shown.includes(badge.code);
    if (!inShowcase && shown.length >= showcaseSize) {
      onDone(s.full);
      return;
    }
    startTransition(async () => {
      setShown(inShowcase ? shown.filter((c) => c !== badge.code) : [...shown, badge.code]);
      const result = await toggleShowcase(badge.code);
      if (!result.ok) onDone(result.reason === "full" ? s.full : s.failed);
    });
  }

  return (
    <SectionCard Icon={Award} tone="warning" title={s.title} lead={format(s.lead, { n: earnedCount, total: badges.length, max: showcaseSize })}>
      <div className="flex flex-col gap-2.5 rounded-2xl border border-card bg-surface-raised bg-[radial-gradient(90%_140%_at_0%_0%,color-mix(in_oklab,var(--purple)_12%,transparent),transparent_60%)] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="m-0 text-base font-bold">{s.label}</h3>
          <span className="text-[13px] text-fg-3">{format(s.count, { n: shown.length, max: showcaseSize })}</span>
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {shown.map((code) => {
            const badge = badges.find((b) => b.code === code);
            if (!badge) return null;
            const name = t.badges[code].name;
            return (
              <li key={code}>
                <button
                  type="button"
                  onClick={() => press(badge)}
                  aria-label={format(s.remove, { name })}
                  className="flex w-[82px] cursor-pointer flex-col items-center gap-1.5 border-0 bg-transparent p-0 font-[inherit] text-fg"
                >
                  <BadgeMedal code={code} earned size={66} className="anim-pop" />
                  <span className="text-xs font-bold whitespace-nowrap">{name}</span>
                </button>
              </li>
            );
          })}
          {Array.from({ length: Math.max(0, showcaseSize - shown.length) }, (_, i) => (
            <li key={`empty-${i}`} className="flex w-[82px] flex-col items-center gap-1.5">
              <span aria-hidden="true" className="my-1 size-[58px] rounded-full border-2 border-dashed border-line" />
              <span className="text-xs text-fg-4">{s.empty}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="m-0 text-[13px] leading-normal text-fg-3">{s.hint}</p>

      <div className="flex flex-col gap-2">
        <h3 className="sr-only">{s.grid}</h3>
        <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4 xl:grid-cols-6">
          {badges.map((badge) => {
            const on = shown.includes(badge.code);
            const name = t.badges[badge.code].name;
            return (
              <li key={badge.code} className="flex">
                <button
                  type="button"
                  onClick={() => press(badge)}
                  aria-pressed={badge.earned ? on : undefined}
                  className={cn(
                    "flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-3 font-[inherit] text-fg transition-colors",
                    badge.earned ? "bg-surface-raised" : "bg-transparent opacity-80",
                    info === badge.code ? "border-accent" : badge.earned ? "border-card hover:border-line" : "border-transparent hover:border-line",
                  )}
                >
                  <BadgeMedal code={badge.code} earned={badge.earned} size={56} shine={false} />
                  <span className="text-center text-xs leading-tight font-bold">{name}</span>
                  {badge.earned ? (
                    <span className={cn("text-[11px] font-bold", on ? "text-accent-fg" : "text-fg-3")}>{on ? s.inShowcase : s.add}</span>
                  ) : (
                    <>
                      <ProgressBar value={badgeProgressRatio(badge.progress)} fillClass="bg-accent/60" className="h-1 w-[70%]" />
                      <span className="text-center text-[11px] text-fg-4">{badgeProgressText(badge.progress)}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div aria-live="polite">
        {selected ? (
          <div key={selected.code} className="flex items-start gap-3 rounded-[14px] border border-line bg-surface-raised px-4 py-3.5 anim-rise">
            <Info className={cn("mt-0.5 size-[18px] flex-none", selected.earned ? "text-success-fg" : "text-accent-fg")} strokeWidth={2} aria-hidden="true" />
            <div className="flex flex-col gap-[3px]">
              <b className={selected.earned ? "text-success-fg" : "text-fg"}>{t.badges[selected.code].name}</b>
              <span className="text-sm text-fg-2">{format(s.how, { how: t.badges[selected.code].how })}</span>
              <span className="text-[13px] text-fg-3">
                {selected.earned
                  ? shown.includes(selected.code)
                    ? s.earnedIn
                    : s.earnedOut
                  : format(s.notYet, { progress: badgeProgressText(selected.progress) })}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
