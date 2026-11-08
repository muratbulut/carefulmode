import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Lock, MailCheck, Play, RotateCcw, Slash, Tag } from "lucide-react";
import { DifficultyBars, DifficultyTag, DurationTag, KindTag } from "@/components/lab/LabTags";
import { DistrictGlyph, toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { format, getMessages } from "@/lib/i18n";
import { catalogQuery, emptyFilters } from "@/lib/lab/catalog";
import { detailAction, type DetailActionKind } from "@/lib/lab/route";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { AheadBox, AvatarStack, LearnDisclosure, LearnList, LockedLearn, PreviousAttempt, StepsRoad, StepsRow, detailSteps } from "./DetailParts";
import { MissionCover } from "./MissionCover";
import { AppPill, PhoneMockup } from "./PhoneMockup";
import type { LabDetailData } from "./types";

/**
 * Lab detayı, senaryo labının kapağı (Tur 1 ekran 11; tahtalar: Lab-Detay-Masaustu,
 * Lab-Detay-Mobil). Solda etiketler, başlık, hikâye, tek ana düğme ve tamamlayan sayısı; sağda
 * labın uygulamasına düşen bildirim, görevli odada gelen arama ve hikâye kartları (MissionCover). Altta adım yolu, dersler (bitene kadar
 * kilitli) ve "Seni neler bekliyor" ya da önceki deneme. Telefonda
 * üstte görsel, ana düğme alt menünün hemen üstünde sabit.
 */
export function LabDetail({ data }: { data: LabDetailData }) {
  const t = getMessages();
  const d = t.lab.detail;
  const steps = detailSteps(data);
  const action = detailAction({
    slug: data.slug,
    state: data.state,
    inProgress: data.inProgress,
    done: data.finishedCount > 0,
    verified: data.verified,
    trainingHref: data.training?.href ?? null,
  });
  const secondary = action.kind === "again" && data.last ? data.last.href : null;
  const done = data.finishedCount > 0;

  return (
    <div className="relative">
      <MobileHero data={data} />

      <div className="relative mx-auto flex max-w-[1200px] flex-col gap-[18px] px-4 pt-[18px] pb-10 lg:gap-9 lg:px-6 lg:pt-7 lg:pb-16">
        <Crumbs data={data} />

        <div className="flex flex-col gap-[18px] lg:flex-row lg:flex-wrap lg:items-center lg:gap-12">
          <div className="flex flex-col gap-[18px] lg:flex-[1_1_540px] lg:gap-5">
            <Chips data={data} />
            <div className="flex flex-col gap-2">
              <h1 className="m-0 font-heading text-[30px] leading-[1.05] font-bold tracking-[-1px] lg:text-[54px]">{data.title || data.name}</h1>
              {data.title ? (
                <div className="inline-flex items-center gap-2 text-sm font-bold text-fg-3 lg:text-base">
                  <Tag className="size-[15px]" strokeWidth={2} aria-hidden="true" />
                  {data.name}
                </div>
              ) : null}
            </div>
            <MobileStats data={data} />
            {data.story ? <p className="m-0 max-w-[560px] text-base leading-[1.6] text-fg-2 lg:text-lg">{data.story}</p> : null}
            <div className="hidden flex-wrap items-center gap-3 lg:flex">
              <MainAction kind={action.kind} href={action.href} />
              {secondary ? (
                <Link
                  href={secondary}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-[14px] border border-line bg-surface px-6 text-base font-bold text-fg no-underline hover:border-accent"
                >
                  {d.openReport}
                </Link>
              ) : null}
            </div>
            <Completions data={data} />
          </div>
          <div className="hidden justify-center pt-2.5 pb-5 lg:flex lg:flex-[1_1_440px]">
            {data.cover ? <MissionCover cover={data.cover} template={data.template} /> : <PhoneMockup data={data} />}
          </div>
        </div>

        {/*
          8. revize D (3 Kasım): üstte adım yolu; solda dersler (oda bitene kadar kilitli, cevabı
          baştan söylemesin), sağda henüz bitirmediyse "Seni neler bekliyor", bitirdiyse önceki deneme.
        */}
        <div className="hidden flex-col gap-5 lg:flex">
          <StepsRoad steps={steps} />
          <div className={cn("grid items-start gap-5", data.learn.length > 0 && "grid-cols-2")}>
            {data.learn.length === 0 ? null : done ? (
              <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-[22px]">
                <h2 className="m-0 font-heading text-xl font-bold">{d.learnDone}</h2>
                <LearnList items={data.learn} />
              </section>
            ) : (
              <LockedLearn count={data.learn.length} />
            )}
            {data.last ? <PreviousAttempt data={data} /> : <AheadBox data={data} />}
          </div>
        </div>

        {/* Telefon: alt alta */}
        <div className="flex flex-col gap-[18px] lg:hidden">
          <section className="rounded-[20px] border border-line bg-surface px-3.5 py-[18px]">
            <StepsRow steps={steps} />
          </section>
          {data.last ? <PreviousAttempt data={data} /> : <AheadBox data={data} />}
          {data.learn.length === 0 ? null : done ? <LearnDisclosure items={data.learn} /> : <LockedLearn count={data.learn.length} />}
        </div>

        {/* Telefonda ana düğme alt menünün üstünde durur; sayfanın sonuna gelince yerine oturur. */}
        <div className="sticky bottom-[92px] z-10 -mx-4 mt-6 bg-linear-to-b from-transparent to-canvas to-40% px-4 pt-6 pb-2.5 lg:hidden">
          <MainAction kind={action.kind} href={action.href} block />
        </div>
      </div>
    </div>
  );
}

const actionIcons: Record<DetailActionKind, typeof Play> = {
  start: Play,
  continue: Play,
  again: RotateCcw,
  locked: Lock,
  verify: MailCheck,
};

function MainAction({ kind, href, block }: { kind: DetailActionKind; href: string; block?: boolean }) {
  const d = getMessages().lab.detail;
  const label: Record<DetailActionKind, string> = {
    start: d.start,
    continue: d.continue,
    again: d.again,
    locked: d.lockedButton,
    verify: d.verify,
  };
  const Icon = actionIcons[kind];
  const muted = kind === "locked";
  return (
    <Link
      href={href}
      data-action={kind}
      className={cn(
        "inline-flex items-center justify-center gap-2.5 rounded-[14px] text-[17px] font-bold no-underline transition-[filter]",
        block ? "flex h-[54px] w-full px-5" : "h-14 px-7",
        muted
          ? "border border-line bg-card text-fg-3 hover:text-fg"
          : cn("bg-accent text-on-accent hover:brightness-110", block && "shadow-[0_10px_24px_color-mix(in_oklab,var(--accent)_25%,transparent)]"),
      )}
    >
      <Icon className={cn("size-[18px]", (kind === "start" || kind === "continue") && "fill-current")} strokeWidth={2.4} aria-hidden="true" />
      {label[kind]}
    </Link>
  );
}

function Crumbs({ data }: { data: LabDetailData }) {
  const t = getMessages();
  const topicHref = `${routes.labs}${catalogQuery({ ...emptyFilters(), categories: [data.district.slug] })}`;
  return (
    <nav aria-label={t.lab.detail.crumbLabel} className="hidden flex-wrap items-center gap-2 text-sm text-fg-4 lg:flex">
      <Link href={routes.labs} className="text-fg-3 no-underline hover:text-fg">
        {t.nav.links.labs}
      </Link>
      <Slash className="size-3" strokeWidth={2} aria-hidden="true" />
      <Link href={topicHref} className="text-fg-3 no-underline hover:text-fg">
        {data.district.topic}
      </Link>
      <Slash className="size-3" strokeWidth={2} aria-hidden="true" />
      <span aria-current="page" className="text-fg-2">
        {data.title || data.name}
      </span>
    </nav>
  );
}

const chipClass = "inline-flex h-[30px] items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold";

function Chips({ data }: { data: LabDetailData }) {
  const tone = toneOf(data.district.color);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn(chipClass, tone.chip, tone.text)}>
        <DistrictGlyph icon={data.district.icon} className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
        <span className="tracking-[0.6px] uppercase">{data.district.topic}</span>
      </span>
      <KindTag type="SCENARIO" />
      <DifficultyTag difficulty={data.difficulty} />
      <DurationTag minutes={data.durationMin} long />
    </div>
  );
}

/** Masaüstü: "124 öğrenci bu odayı tamamladı · Bu hafta +18". İsim yok, yalnızca sayı. */
function Completions({ data }: { data: LabDetailData }) {
  const d = getMessages().lab.detail;
  return (
    <div className="hidden items-center gap-3.5 self-start rounded-2xl border border-card bg-surface/70 px-4 py-3.5 lg:flex">
      {data.completions > 0 ? (
        <>
          <AvatarStack />
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-[30px] font-bold">{data.completions}</span>
            <span className="text-[15px] text-fg-2">{d.completed}</span>
          </div>
        </>
      ) : (
        <span className="text-[15px] text-fg-2">{d.firstOne}</span>
      )}
      {data.week > 0 ? (
        <>
          <span aria-hidden="true" className="h-6 w-px bg-line" />
          <span className="text-sm font-bold text-success-fg">{format(d.thisWeek, { n: data.week })}</span>
        </>
      ) : null}
    </div>
  );
}

/** Telefon: zorluk, süre ve tamamlayan sayısı tek kartta. */
function MobileStats({ data }: { data: LabDetailData }) {
  const t = getMessages().lab;
  const d = t.detail;
  return (
    <dl className="m-0 flex items-stretch rounded-[18px] border border-line bg-surface px-1 py-3.5 lg:hidden">
      <Stat label={d.stats.difficulty}>
        <span className="inline-flex items-center gap-1.5">
          <DifficultyBars difficulty={data.difficulty} />
          {t.difficulty[data.difficulty]}
        </span>
      </Stat>
      <span aria-hidden="true" className="w-px bg-line" />
      <Stat label={d.stats.duration} note={d.durationNote}>
        {format(t.durationShort, { n: data.durationMin })}
      </Stat>
      <span aria-hidden="true" className="w-px bg-line" />
      <Stat label={d.stats.completed} note={data.completions > 0 ? <AvatarStack size="sm" /> : null}>
        {data.completions}
      </Stat>
    </dl>
  );
}

function Stat({ label, note, children }: { label: string; note?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 text-center">
      <dt className="text-[11px] font-bold tracking-[0.6px] text-fg-4">{label}</dt>
      <dd className="m-0 font-heading text-xl font-bold">{children}</dd>
      {note ? <dd className="m-0 text-xs text-fg-3">{note}</dd> : null}
    </div>
  );
}

/** Telefonun üst görseli: küçültülmüş telefon, geri düğmesi ve "Postam ile" etiketi. */
function MobileHero({ data }: { data: LabDetailData }) {
  const d = getMessages().lab.detail;
  return (
    <div className="relative h-[290px] overflow-hidden border-b border-card bg-surface-deep lg:hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(90%_80%_at_70%_10%,color-mix(in_oklab,var(--scene-orange)_35%,transparent),transparent_60%),radial-gradient(80%_70%_at_10%_90%,color-mix(in_oklab,var(--accent)_18%,transparent),transparent_60%)]"
      />
      {data.cover ? (
        // Kapak biraz sağa kayar: soldaki ürün kartı geri düğmesine değmesin (3 Kasım, 390 px).
        <div className="absolute top-1 left-[calc(50%+18px)] -translate-x-1/2">
          <MissionCover cover={data.cover} template={data.template} className="origin-top scale-[0.6]" />
        </div>
      ) : (
        <div className="absolute top-[34px] left-1/2 -translate-x-1/2">
          <PhoneMockup data={data} pill={false} className="origin-top scale-[0.78]" />
        </div>
      )}
      <Link
        href={routes.labs}
        aria-label={d.back}
        className="absolute top-3 left-3 flex size-11 items-center justify-center rounded-full border border-line bg-canvas/75 text-fg backdrop-blur-[6px]"
      >
        <ArrowLeft className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
      </Link>
      {data.cover ? null : <AppPill template={data.template} className="absolute top-[18px] right-3 h-[30px] px-2.5 text-xs" />}
    </div>
  );
}
