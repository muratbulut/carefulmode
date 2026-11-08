import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { ClassroomDetail } from "@/components/classroom/ClassroomDetail";
import type { DetailTab } from "@/components/classroom/types";
import { Loading } from "@/components/status/Loading";
import { getClassroomDetail } from "@/lib/classroom/teacher";
import { getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { requireTeacher } from "@/lib/teacher/access";

export const metadata: Metadata = { title: getMessages().pages.classes, robots: { index: false } };

const tabOf: Record<string, DetailTab> = { ogrenciler: "students", konular: "topics" };

/**
 * Sınıf detayı. Yalnızca sınıfın kendi öğretmeni açar; başkasının (ya da arşivdeki) sınıfı
 * "Bu sayfa yok" der, sınıfın var olduğu belli olmaz.
 */
export default function ClassroomPage({ params, searchParams }: PageProps<"/siniflarim/[sinif]">) {
  return (
    <>
      <PageBackground />
      <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={3} />}>
        <Classroom params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Classroom({ params, searchParams }: Pick<PageProps<"/siniflarim/[sinif]">, "params" | "searchParams">) {
  const [{ sinif }, query] = await Promise.all([params, searchParams]);
  const access = await requireTeacher(paths.classroom(sinif));
  const data = await getClassroomDetail(access.userId, sinif);
  if (!data) notFound();
  const tab = typeof query.sekme === "string" ? (tabOf[query.sekme] ?? "overview") : "overview";
  return <ClassroomDetail data={data} initialTab={tab} />;
}
