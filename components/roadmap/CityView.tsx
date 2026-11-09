import Link from "next/link";
import { ArrowRight, ChevronRight, Play } from "lucide-react";
import { withNext } from "@/lib/account/shared";
import { format, getMessages } from "@/lib/i18n";
import { cityProgress, districtRing, routeOf, type CityView as City, type DistrictView } from "@/lib/lab/route";
import { paths, routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { NeighborhoodIcon, NeighborhoodWatermark, toneOf } from "./NeighborhoodIcon";
import { ProgressBar, ProgressRing } from "./ProgressRing";
import { RoadmapLegend } from "./RoadmapLegend";

/**
 * Siber şehir (Tur 2, H4; tahtalar: Sehir-H4-Yakinlas, Yol-Haritasi-Ziyaretci). Masaüstünde
 * mahalle kartları ızgarası, telefonda liste. Ziyaretçide ilerleme yerine "İlerlemeni kaydet".
 */
export function CityView({ city, member }: { city: City; member: boolean }) {
  const t = getMessages().roadmap;
  const here = city.continueSlug ? city.districts.find((d) => routeOf(d).some((l) => l.slug === city.continueSlug))?.slug : null;

  return (
    <div className="relative mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pt-6 pb-10 lg:gap-6 lg:px-6 lg:pt-10 lg:pb-[72px]">
      <section className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-6">
        <div className="flex flex-col gap-2.5 lg:flex-[1_1_520px]">
          <h1 className="m-0 font-heading text-[28px] leading-[1.05] font-bold lg:text-[44px]">{member ? t.title : t.titleVisitor}</h1>
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.6] text-fg-2 lg:text-base">
            <span className="lg:hidden">{member ? t.leadMobile : t.leadMobileVisitor}</span>
            <span className="hidden lg:inline">{member ? t.lead : t.leadVisitor}</span>
          </p>
          {member ? <RoadmapLegend className="mt-1.5 hidden lg:flex" /> : null}
        </div>
        {member ? <ProgressCard city={city} /> : <SaveCard />}
      </section>

      <section aria-label={t.districtsLabel} className="flex flex-col gap-3.5">
        <p className="m-0 hidden text-sm text-fg-3 lg:block">{member ? t.hint : t.hintVisitor}</p>
        <ul className="m-0 hidden list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0 lg:grid">
          {city.districts.map((d) => (
            <li key={d.slug} className="flex">
              <DistrictCard district={d} here={d.slug === here} member={member} />
            </li>
          ))}
        </ul>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
          {city.districts.map((d) => (
            <li key={d.slug}>
              <DistrictRow district={d} here={d.slug === here} member={member} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ProgressCard({ city }: { city: City }) {
  const t = getMessages();
  const p = cityProgress(city.districts);
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 lg:flex-[0_1_420px] lg:p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-bold">{t.roadmap.overall}</span>
        <span className="font-heading text-[22px] font-bold">{format(t.roadmap.percent, { n: p.percent })}</span>
      </div>
      <ProgressBar value={p.percent / 100} fillClass="bg-linear-to-r from-success to-accent" />
      <span className="hidden text-[13px] text-fg-3 lg:block">
        {format(t.roadmap.overallCounts, {
          trainingDone: p.trainingDone,
          trainingTotal: p.trainingTotal,
          scenarioDone: p.scenarioDone,
          scenarioTotal: p.scenarioTotal,
        })}
      </span>
      <Link
        href={city.continueHref ?? routes.labs}
        className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-5 text-base font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
      >
        {city.continueHref ? t.nav.continue : t.roadmap.browseLabs}
        {city.continueHref ? <Play className="size-4 fill-current" strokeWidth={2.4} aria-hidden="true" /> : <ArrowRight className="size-4" strokeWidth={2.4} aria-hidden="true" />}
      </Link>
    </div>
  );
}

function SaveCard() {
  const t = getMessages();
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4 lg:flex-[0_1_420px] lg:p-5">
      <b className="text-base">{t.roadmap.save.title}</b>
      <p className="m-0 text-sm leading-normal text-fg-2">{t.roadmap.save.text}</p>
      <Link
        href={withNext(routes.signUp, routes.roadmap)}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-5 text-base font-bold text-on-accent no-underline transition-[filter] hover:brightness-110"
      >
        {t.nav.links.signUp}
      </Link>
      <p className="m-0 text-center text-sm text-fg-3">
        {t.roadmap.save.haveAccount}{" "}
        <Link href={withNext(routes.signIn, routes.roadmap)} className="font-bold">
          {t.nav.links.signIn}
        </Link>
      </p>
    </div>
  );
}

function districtMeta(d: DistrictView, short: boolean) {
  const t = getMessages().roadmap;
  if (d.trainings.length === 0 && d.scenarios.length === 0) return short ? t.districtSoonShort : format(t.districtSoon, { topic: d.topic });
  return format(short ? t.districtMetaShort : t.districtMeta, { topic: d.topic, trainings: d.trainings.length, n: d.scenarios.length });
}

function DistrictCard({ district: d, here, member }: { district: DistrictView; here: boolean; member: boolean }) {
  const t = getMessages().roadmap;
  const tone = toneOf(d.color);
  const ring = districtRing(d);
  const empty = ring.total === 0;
  return (
    <Link
      href={paths.neighborhood(d.slug)}
      className={cn(
        "group relative flex w-full flex-col gap-4 overflow-hidden rounded-[22px] border bg-surface p-[22px] text-fg no-underline transition-[transform,border-color] hover:-translate-y-0.5",
        here ? "border-accent" : "border-line hover:border-line-strong",
      )}
    >
      <span aria-hidden="true" className={cn("pointer-events-none absolute -top-20 -right-20 size-56 rounded-full blur-3xl", tone.glow)} />
      <NeighborhoodWatermark icon={d.icon} color={d.color} />
      <span className="relative flex items-start justify-between">
        <NeighborhoodIcon icon={d.icon} color={d.color} />
        {empty ? (
          <span className="rounded-full bg-card px-2.5 py-1 text-xs font-bold text-fg-3">{t.soon}</span>
        ) : member ? (
          <ProgressRing value={ring.done / ring.total} strokeClass={tone.stroke}>
            <span className="text-[13px] font-bold">
              <span aria-hidden="true">{format(t.ring, ring)}</span>
              <span className="sr-only">{format(t.ringLabel, ring)}</span>
            </span>
          </ProgressRing>
        ) : null}
      </span>
      <span className="relative flex flex-col gap-1">
        <span className="font-heading text-[22px] font-bold">{d.name}</span>
        <span className="text-sm text-fg-3">{districtMeta(d, false)}</span>
      </span>
      <span className={cn("relative mt-auto inline-flex items-center gap-1.5 text-sm font-bold", here ? "text-accent-fg" : tone.text)}>
        {here ? t.here : t.enter}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" />
      </span>
    </Link>
  );
}

function DistrictRow({ district: d, here, member }: { district: DistrictView; here: boolean; member: boolean }) {
  const t = getMessages().roadmap;
  const tone = toneOf(d.color);
  const ring = districtRing(d);
  return (
    <Link
      href={paths.neighborhood(d.slug)}
      className={cn(
        "flex items-center gap-3.5 rounded-[18px] border bg-surface p-3.5 text-fg no-underline",
        here ? "border-accent" : "border-line",
      )}
    >
      <NeighborhoodIcon icon={d.icon} color={d.color} className="size-[46px] rounded-[13px]" iconClassName="size-[22px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        {here ? <span className="text-[10px] font-bold tracking-[0.8px] text-accent-fg">{t.hereShort}</span> : null}
        <span className="font-heading text-[17px] leading-tight font-bold">{d.name}</span>
        <span className="text-[13px] text-fg-3">{districtMeta(d, true)}</span>
        {member && ring.total > 0 ? (
          <span className="mt-1 flex items-center gap-2">
            <ProgressBar value={ring.done / ring.total} fillClass={tone.fill} className="h-[5px] flex-1" />
            <span className={cn("text-xs font-bold", tone.text)}>{format(t.ring, ring)}</span>
          </span>
        ) : null}
      </span>
      <ChevronRight className="size-[18px] flex-none text-fg-4" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
