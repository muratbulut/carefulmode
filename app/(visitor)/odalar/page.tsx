import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { CatalogView } from "@/components/catalog/CatalogView";
import { Loading } from "@/components/status/Loading";
import { getMessages } from "@/lib/i18n";
import { parseCatalogParams } from "@/lib/lab/catalog";
import { getCityView } from "@/lib/lab/data";
import { allLabs } from "@/lib/lab/route";
import { getUser } from "@/lib/session";

export const metadata: Metadata = { title: getMessages().pages.labs };

/** Lablar kataloğu. Ziyaretçi de görür; başlamak için hesap gerekir. */
export default function LabsPage({ searchParams }: PageProps<"/odalar">) {
  return (
    <>
      <PageBackground />
      <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={3} />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Catalog({ searchParams }: Pick<PageProps<"/odalar">, "searchParams">) {
  const [params, user] = await Promise.all([searchParams, getUser()]);
  const city = await getCityView(user?.id ?? null);
  const labs = allLabs(city.districts);
  // Süzgeçte yalnızca labı olan mahalleler (kategoriler) görünür.
  const districts = city.districts
    .filter((d) => d.trainings.length > 0 || d.scenarios.length > 0)
    .map(({ slug, name, topic, color, icon, sortOrder }) => ({ slug, name, topic, color, icon, sortOrder }));
  const member = !!user;
  const initial = parseCatalogParams(params, { member, categories: districts.map((d) => d.slug) });
  return <CatalogView labs={labs} districts={districts} member={member} continueSlug={city.continueSlug} initial={initial} />;
}
