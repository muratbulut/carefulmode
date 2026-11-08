import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { CityView } from "@/components/roadmap/CityView";
import { Loading } from "@/components/status/Loading";
import { getMessages } from "@/lib/i18n";
import { getCityView } from "@/lib/lab/data";
import { getUser } from "@/lib/session";

export const metadata: Metadata = { title: getMessages().pages.roadmap };

/** Yol haritası: siber şehir. Ziyaretçi de görür; ilerleme yalnızca giriş yapmışta. */
export default function RoadmapPage() {
  return (
    <>
      <PageBackground />
      <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={4} />}>
        <City />
      </Suspense>
    </>
  );
}

async function City() {
  const user = await getUser();
  const city = await getCityView(user?.id ?? null);
  return <CityView city={city} member={!!user} />;
}
