import Link from "next/link";
import { Award } from "lucide-react";
import { BadgeMedal, badgeProgressRatio, badgeProgressText } from "@/components/profile/BadgeMedal";
import { ProgressBar } from "@/components/roadmap/ProgressRing";
import { getMessages } from "@/lib/i18n";
import type { BadgeState } from "@/lib/progress/badges";
import { cn } from "@/lib/utils";
import { badgesHref } from "./links";

/**
 * "Sıradaki rozetin": bitmeye en yakın rozet, nasıl kazanılır ve ilerleme. `tall`: masaüstünde
 * profil kartının yanındaki sütunu dolduran hali (madalya ortada, ilerleme altta).
 */
export function NextBadgeCard({
  badge,
  tall = false,
  className,
}: {
  badge: Pick<BadgeState, "code" | "progress"> | null;
  tall?: boolean;
  className?: string;
}) {
  const t = getMessages();
  const h = t.home.nextBadge;
  if (!badge) {
    return (
      <section className={cn("flex flex-col justify-center gap-2 rounded-[18px] border border-line bg-surface p-4 lg:p-5", className)}>
        <span className="flex items-center gap-2.5">
          <Award className="size-5 text-success-fg" strokeWidth={2} aria-hidden="true" />
          <h3 className="m-0 text-base font-bold">{h.allEarned}</h3>
        </span>
        <p className="m-0 text-sm text-fg-3">{h.allEarnedText}</p>
      </section>
    );
  }
  const info = t.progress.badges[badge.code];
  const progress = (
    <span className="flex flex-col gap-1.5">
      <span className="flex justify-between gap-2 text-[13px]">
        <span className="text-fg-2">{h.progress}</span>
        <span className="font-bold text-accent-fg">{badgeProgressText(badge.progress)}</span>
      </span>
      <ProgressBar value={badgeProgressRatio(badge.progress)} fillClass="bg-accent" className="h-1.5" />
    </span>
  );
  const frame =
    "rounded-[18px] border border-line bg-surface bg-[radial-gradient(90%_60%_at_85%_0%,color-mix(in_oklab,var(--accent)_10%,transparent),transparent_70%)] text-fg no-underline transition-colors hover:border-line-strong";
  if (tall) {
    return (
      <Link href={badgesHref} className={cn(frame, "flex flex-col justify-between gap-4 p-5", className)}>
        <span className="flex items-center gap-2 text-sm font-bold text-fg-2">
          <Award className="size-4 text-warning-fg" strokeWidth={2} aria-hidden="true" />
          {h.title}
        </span>
        <span className="flex flex-col items-center gap-2 text-center">
          <BadgeMedal code={badge.code} earned={false} size={96} />
          <h3 className="m-0 mt-1 font-heading text-[22px] font-bold">{info.name}</h3>
          <span className="max-w-[260px] text-sm text-fg-3">{info.how}</span>
        </span>
        {progress}
      </Link>
    );
  }
  return (
    <Link
      href={badgesHref}
      className={cn(frame, "flex flex-col justify-center gap-3 p-4 lg:px-5 lg:py-[18px]", className)}
    >
      <span className="flex items-center gap-3.5">
        <BadgeMedal code={badge.code} earned={false} size={56} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] text-fg-3">{h.title}</span>
          <h3 className="m-0 font-heading text-xl font-bold">{info.name}</h3>
          <span className="text-[13px] text-fg-3">{info.how}</span>
        </span>
      </span>
      {progress}
    </Link>
  );
}
