import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { NeighborhoodView } from "@/components/roadmap/NeighborhoodView";
import { Loading } from "@/components/status/Loading";
import { getMessages } from "@/lib/i18n";
import { getCityView } from "@/lib/lab/data";
import { getUser } from "@/lib/session";

export const metadata: Metadata = { title: getMessages().pages.roadmap };

/** Mahalle sayfası: eğitim labı ve senaryo rotası, seçili labın önizlemesi. */
export default function NeighborhoodPage({ params }: PageProps<"/yol-haritasi/[mahalle]">) {
  return (
    <>
      <PageBackground />
      <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={2} />}>
        <Neighborhood params={params} />
      </Suspense>
    </>
  );
}

async function Neighborhood({ params }: Pick<PageProps<"/yol-haritasi/[mahalle]">, "params">) {
  const { mahalle } = await params;
  const user = await getUser();
  const city = await getCityView(user?.id ?? null);
  const district = city.districts.find((d) => d.slug === mahalle);
  if (!district) notFound();
  return <NeighborhoodView district={district} member={!!user} />;
}
