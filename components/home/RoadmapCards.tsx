import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NeighborhoodIcon, toneOf } from "@/components/roadmap/NeighborhoodIcon";
import { ProgressBar } from "@/components/roadmap/ProgressRing";
import { format, getMessages } from "@/lib/i18n";
import { allLabs, routeOf, type CityView } from "@/lib/lab/route";
import { paths, routes } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** "Yol haritan": her mahalle için ilerleme kartı (Ana-Sayfa-Son). */
export function RoadmapCards({ city }: { city: CityView }) {
  const t = getMessages().home;
  const here = city.continueSlug ? city.districts.find((d) => routeOf(d).some((l) => l.slug === city.continueSlug))?.slug : null;
  const labCount = allLabs(city.districts).length;

  return (
    <section aria-labelledby="home-roadmap" className="flex flex-col gap-3.5 lg:gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-roadmap" className="m-0 font-heading text-[21px] font-bold lg:text-[26px]">
          {t.sections.roadmap}
        </h2>
        <Link href={routes.roadmap} className="-my-2.5 inline-flex flex-none items-center gap-1.5 py-2.5 text-sm font-bold no-underline hover:underline lg:text-[15px]">
          <span className="lg:hidden">{t.roadmap.toCity}</span>
          <span className="hidden lg:inline">{format(t.roadmap.toCityMeta, { districts: city.districts.length, labs: labCount })}</span>
          <ArrowRight className="hidden size-4 lg:block" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0 lg:grid-cols-4 lg:gap-3.5">
        {city.districts.map((d) => {
          const tone = toneOf(d.color);
          const isHere = d.slug === here;
          const next = d.nextSlug ? routeOf(d).find((l) => l.slug === d.nextSlug) : null;
          const note =
            d.total === 0
              ? t.roadmap.soon
              : d.doneCount >= d.total
                ? t.roadmap.done
                : isHere && next
                  ? format(t.roadmap.next, { name: next.name })
                  : !d.trainingDone
                    ? t.roadmap.starts
                    : format(t.roadmap.left, { n: d.total - d.doneCount });
          return (
            <li key={d.slug} className="flex">
              <Link
                href={paths.neighborhood(d.slug)}
                className={cn(
                  "relative flex w-full flex-col gap-2.5 overflow-hidden rounded-[18px] border bg-surface p-3.5 text-fg no-underline transition-[transform,border-color] hover:-translate-y-0.5 lg:p-4",
                  isHere ? "border-accent" : "border-line hover:border-line-strong",
                )}
              >
                <span aria-hidden="true" className={cn("pointer-events-none absolute -top-12 -right-10 size-32 rounded-full blur-2xl", tone.glow)} />
                <span className="relative flex items-center justify-between">
                  <NeighborhoodIcon icon={d.icon} color={d.color} className="size-[38px] rounded-xl" iconClassName="size-[19px]" />
                  {d.total > 0 ? (
                    <span className={cn("text-[13px] font-bold", tone.text)}>{format(t.roadmap.progress, { done: d.doneCount, total: d.total })}</span>
                  ) : null}
                </span>
                <span className="relative flex flex-col gap-[3px]">
                  <span className="font-heading text-base leading-[1.2] font-bold lg:text-lg">{d.name}</span>
                  <span className="text-xs leading-[1.35] text-fg-3">{note}</span>
                </span>
                <ProgressBar value={d.total ? d.doneCount / d.total : 0} fillClass={tone.fill} className="relative mt-auto h-[5px]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
