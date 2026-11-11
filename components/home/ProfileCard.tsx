import Link from "next/link";
import { CheckCircle2, FileText, Layers, Pencil, Play, Plus } from "lucide-react";
import { BadgeMedal } from "@/components/profile/BadgeMedal";
import { LevelBar, LevelPill, PointsPill } from "@/components/profile/LevelSummary";
import { brand, LogoLineIcon, LogoMark } from "@/lib/brand";
import { format, getMessages } from "@/lib/i18n";
import { routes } from "@/lib/navigation";
import type { BadgeCode } from "@/lib/progress/badges";
import { showcaseSize } from "@/lib/progress/badges";
import type { LevelInfo } from "@/lib/progress/levels";
import { cn } from "@/lib/utils";
import { badgesHref } from "./links";

export type ProfileCardData = {
  name: string;
  avatar: string;
  grade: string | null;
  since: string;
  level: LevelInfo;
  stats: { labsDone: number; cardsRead: number; reports: number };
  showcase: BadgeCode[];
  earnedCount: number;
  badgeTotal: number;
  continueHref: string | null;
  /** Devam düğmesinin açacağı odanın adı (düğmede yazar). */
  continueName: string | null;
  /** Öğretmeninin ödevi aynı odayı gösteriyorsa düğme çizilmez. */
  hideContinue: boolean;
};

const statIcons = { labsDone: CheckCircle2, cardsRead: Layers, reports: FileText } as const;
const statTones = {
  labsDone: "bg-success/12 text-success-fg",
  cardsRead: "bg-accent/12 text-accent-fg",
  reports: "bg-warning/12 text-warning-fg",
} as const;

/**
 * Öğrencinin profil kartı (Ana-Sayfa-Son): avatar, ad, seviye ve puan, sayılar, kaldığın yerden
 * devam et ve rozet vitrini. Telefonda sıkışık hali (M2): vitrin küçük madalyalarla, devam
 * düğmesi alt menünün ortasında.
 */
export function ProfileCard({ data, className }: { data: ProfileCardData; className?: string }) {
  const t = getMessages();
  const h = t.home;
  const statKeys = ["labsDone", "cardsRead", "reports"] as const;
  return (
    <section
      aria-labelledby="home-name"
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-[22px] border border-line bg-linear-135 from-card via-surface to-surface-raised p-[18px] lg:gap-6 lg:rounded-3xl lg:px-8 lg:py-7",
        className,
      )}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="anim-shine absolute inset-0 bg-[linear-gradient(105deg,transparent_35%,var(--shine)_50%,transparent_65%)]" />
      </span>
      <LogoMark className="pointer-events-none absolute -top-6 -right-16 h-auto w-[240px] opacity-[0.07] lg:-top-8 lg:w-[360px]" />

      {/* Masaüstü üst satır */}
      <div className="relative hidden items-center justify-between gap-3 lg:flex">
        <span className="inline-flex items-center gap-2 font-mono text-[13px] tracking-[2px] text-accent-light">
          <LogoLineIcon className="size-4" />
          {format(h.eyebrow, { brand: brand.name.toLocaleUpperCase("tr") })}
        </span>
        <PointsPill points={data.level.points} />
      </div>

      <div className="relative flex items-center gap-3 lg:gap-6">
        <span
          aria-hidden="true"
          className="flex size-[58px] flex-none items-center justify-center rounded-[18px] border-[3px] border-accent bg-[radial-gradient(circle_at_35%_30%,var(--line-strong),var(--card)_70%)] text-[30px] lg:size-[116px] lg:rounded-[28px] lg:text-[60px]"
        >
          {data.avatar}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px] lg:gap-1.5">
          <span className="text-[13px] text-fg-3 lg:text-[15px]">{h.welcome}</span>
          <h1 id="home-name" className="m-0 font-heading text-[21px] leading-[1.1] font-bold break-words lg:text-[38px] lg:leading-[1.05]">
            {data.name}
          </h1>
          <span className="text-[13px] text-fg-2 lg:hidden">
            {data.grade ? format(h.gradePoints, { grade: data.grade, points: data.level.points }) : format(t.progress.points, { n: data.level.points })}
          </span>
          <span className="hidden text-[15px] text-fg-2 lg:block">{data.grade ? format(h.subtitle, { grade: data.grade, since: data.since }) : data.since}</span>
          <div className="mt-2 hidden flex-col gap-2.5 lg:flex">
            <LevelPill level={data.level.level} />
            <LevelBar level={data.level} className="w-4/5" />
          </div>
        </div>
        <Link
          href={routes.profile}
          aria-label={h.editProfile}
          className="flex size-[38px] flex-none items-center justify-center self-start rounded-xl border border-line bg-surface text-fg-2 lg:hidden"
        >
          <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
        </Link>
        <Link
          href={routes.profile}
          className="hidden h-10 flex-none items-center self-start rounded-[10px] border border-line bg-surface px-3.5 text-sm font-bold text-fg-2 no-underline hover:text-fg lg:inline-flex"
        >
          {h.editProfile}
        </Link>
      </div>

      {/* Telefon: seviye */}
      <div className="relative flex flex-col gap-2 lg:hidden">
        <LevelPill level={data.level.level} />
        <LevelBar level={data.level} />
      </div>

      <Divider className="hidden lg:block" />

      {/* Sayılar */}
      <div className="relative flex items-center justify-between gap-2.5 border-t border-dashed border-line pt-3 lg:flex-wrap lg:gap-5 lg:border-0 lg:pt-0">
        <ul aria-label={h.statsLabel} className="m-0 flex flex-1 list-none items-center justify-between gap-2.5 p-0 lg:flex-none lg:flex-wrap lg:justify-start lg:gap-7">
          {statKeys.map((key, i) => {
            const Icon = statIcons[key];
            return (
              <li key={key} className="flex items-center gap-2.5 lg:gap-7">
                {i > 0 ? <span aria-hidden="true" className="hidden w-px self-stretch bg-line lg:block" /> : null}
                <div className="flex items-center gap-2.5">
                  <span className={cn("hidden size-9 flex-none items-center justify-center rounded-[10px] lg:flex", statTones[key])}>
                    <Icon className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="flex flex-col items-center lg:items-start">
                    <span className="font-heading text-[17px] leading-[1.1] font-bold lg:text-[22px]">{data.stats[key]}</span>
                    <span className="text-[11px] text-fg-3 lg:text-[13px]">{h.stats[key]}</span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <MiniShowcase data={data} />
        {data.hideContinue ? null : (
          <Link
            href={data.continueHref ?? routes.labs}
            className="hidden h-12 max-w-full items-center gap-2.5 self-start rounded-xl bg-accent px-5 text-base font-bold text-on-accent no-underline transition-[filter] hover:brightness-110 lg:inline-flex"
          >
            <Play className="size-4 flex-none fill-current" strokeWidth={2.4} aria-hidden="true" />
            <span className="truncate">
              {data.continueHref ? (data.continueName ? format(h.continueTo, { name: data.continueName }) : t.nav.continue) : t.roadmap.browseLabs}
            </span>
          </Link>
        )}
      </div>

      <Divider className="hidden lg:block" />

      {/* Masaüstü: rozet vitrini */}
      <div className="relative hidden flex-col gap-3 lg:flex">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-base font-bold">{h.showcase}</h2>
          <Link href={badgesHref} className="text-[13px] font-bold no-underline hover:underline">
            {h.allBadges}
          </Link>
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {data.showcase.map((code) => (
            <li key={code}>
              <Link href={badgesHref} className="flex w-[84px] flex-col items-center gap-1.5 text-fg no-underline">
                <BadgeMedal code={code} earned size={64} />
                <span className="text-xs font-bold whitespace-nowrap">{t.progress.badges[code].name}</span>
              </Link>
            </li>
          ))}
          {Array.from({ length: Math.max(0, showcaseSize - data.showcase.length) }, (_, i) => (
            <li key={`empty-${i}`}>
              <Link href={badgesHref} aria-label={h.addBadgeLabel} className="flex w-[84px] flex-col items-center gap-1.5 no-underline">
                <span className="my-1 flex size-14 items-center justify-center rounded-full border-2 border-dashed border-line">
                  <Plus className="size-5 text-fg-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <span aria-hidden="true" className="text-xs text-fg-4">
                  {h.addBadge}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

    </section>
  );
}

function Divider({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("relative h-px bg-[repeating-linear-gradient(90deg,var(--line)_0_8px,transparent_8px_14px)]", className)} />;
}

/** Telefon: vitrindeki rozetler küçük madalyalarla; dokununca profildeki Rozetler bölümü. */
function MiniShowcase({ data }: { data: ProfileCardData }) {
  const h = getMessages().home;
  return (
    <Link
      href={badgesHref}
      aria-label={format(h.showcaseLabel, { n: data.earnedCount, total: data.badgeTotal })}
      className="-my-1.5 flex flex-none items-center gap-0.5 py-1.5 lg:hidden"
    >
      {data.showcase.length > 0 ? (
        data.showcase.map((code) => <BadgeMedal key={code} code={code} earned size={30} shine={false} />)
      ) : (
        <span className="flex size-[30px] items-center justify-center rounded-full border-2 border-dashed border-line">
          <Plus className="size-3.5 text-fg-4" strokeWidth={2} aria-hidden="true" />
        </span>
      )}
    </Link>
  );
}
