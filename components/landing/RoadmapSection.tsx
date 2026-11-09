import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { neighborhoods } from "@/lib/content/landing";
import { getMessages } from "@/lib/i18n";
import { paths, routes } from "@/lib/navigation";
import { NeighborhoodIcon } from "./NeighborhoodIcon";

/** Ziyaretçi için yol haritası özeti: siber şehrin mahalleleri, ilerlemesiz. */
export function RoadmapSection() {
  const t = getMessages().landing.roadmap;
  return (
    <section aria-labelledby="roadmap-heading" className="relative mx-auto flex max-w-[1200px] flex-col gap-3.5 px-4 pt-6 pb-10 lg:gap-[18px] lg:px-6 lg:pt-10 lg:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 id="roadmap-heading" className="m-0 font-heading text-2xl font-bold lg:text-[30px]">
            {t.heading}
          </h2>
          <p className="m-0 max-w-[560px] text-[15px] leading-[1.55] text-fg-2 lg:text-[17px]">
            {t.lead}
          </p>
        </div>
        <Link href={routes.roadmap} className="-my-2 inline-flex min-h-10 items-center gap-1.5 font-bold text-accent-fg no-underline hover:underline">
          {t.explore}
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
      <ul className="m-0 grid list-none gap-2.5 p-0 md:grid-cols-2">
        {neighborhoods.map((n) => (
          <li key={n.slug}>
            <Link
              href={paths.neighborhood(n.slug)}
              className="flex items-center gap-4 rounded-[14px] border border-line bg-surface px-[18px] py-3.5 text-fg no-underline transition-[transform,border-color] hover:translate-x-1 hover:border-accent"
            >
              <NeighborhoodIcon icon={n.icon} color={n.color} className="size-10 rounded-xl" />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-bold">{n.name}</span>
                <span className="text-[13px] text-fg-3">{n.topic}</span>
              </span>
              <ChevronRight className="size-4 text-fg-4" strokeWidth={2} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
