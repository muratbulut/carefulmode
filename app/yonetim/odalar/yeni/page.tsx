import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NewLabForm } from "@/components/admin/labs/NewLabForm";
import { Loading } from "@/components/status/Loading";
import { requireLabAccess } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { db } from "@/lib/db";
import { readContent } from "@/lib/admin/lab-data";
import { getMessages } from "@/lib/i18n";
import { getNeighborhoods } from "@/lib/lab/data";
import { paths } from "@/lib/navigation";

export function generateMetadata() {
  return adminMetadata(() => getMessages().admin.newLab.title, "LAB_EDITING", "LAB_PUBLISHING");
}

/** Yeni lab (Lablar-Son "Yeni oda" penceresi): mahalle, şablon, açan eğitim ve ad; taslak açılır. */
export default function NewLabPage({ searchParams }: PageProps<"/yonetim/odalar/yeni">) {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <NewLab searchParams={searchParams} />
    </Suspense>
  );
}

async function NewLab({ searchParams }: Pick<PageProps<"/yonetim/odalar/yeni">, "searchParams">) {
  const access = await requireLabAccess();
  if (!access.canEdit) redirect(paths.adminLabs);
  const [params, neighborhoods, labs] = await Promise.all([
    searchParams,
    getNeighborhoods(),
    db.lab.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, slug: true, neighborhoodId: true, type: true, template: true, draftContent: true },
    }),
  ]);
  // Eğitimlerin adı taslaktan (yeni odayı hangi eğitimin açacağı seçilir); ilki temel eğitim.
  const trainingsOf = (id: string) =>
    labs
      .filter((l) => l.neighborhoodId === id && l.type === "TRAINING")
      .map((l) => ({ id: l.id, name: readContent(l.template, l.draftContent, l.slug).meta.name || l.slug }));
  const requested = typeof params.mahalle === "string" ? params.mahalle : "";

  return (
    <NewLabForm
      neighborhoods={neighborhoods.map((n) => ({
        slug: n.slug,
        name: n.name,
        color: n.color,
        trainings: trainingsOf(n.id),
        scenarios: labs.filter((l) => l.neighborhoodId === n.id && l.type === "SCENARIO").length,
      }))}
      initialNeighborhood={neighborhoods.some((n) => n.slug === requested) ? requested : (neighborhoods[0]?.slug ?? "")}
    />
  );
}
