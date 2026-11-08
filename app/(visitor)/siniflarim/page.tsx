import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { ClassesView } from "@/components/classroom/ClassesView";
import { Loading } from "@/components/status/Loading";
import { getTeacherClasses } from "@/lib/classroom/teacher";
import { getMessages } from "@/lib/i18n";
import { paths, routes } from "@/lib/navigation";
import { requireTeacher } from "@/lib/teacher/access";

export const metadata: Metadata = { title: getMessages().pages.classes, robots: { index: false } };

/**
 * Sınıflarım: öğretmenin sınıfları. Öğretmen (ya da yönetici) olmayan profildeki Öğretmenlik
 * bölümüne gider. "?yeni=1" yeni sınıf penceresini açık getirir (profildeki bağlantı).
 */
export default function ClassesPage({ searchParams }: PageProps<"/siniflarim">) {
  return (
    <>
      <PageBackground />
      <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={3} />}>
        <Classes searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Classes({ searchParams }: Pick<PageProps<"/siniflarim">, "searchParams">) {
  const params = await searchParams;
  const openCreate = params.yeni === "1";
  const access = await requireTeacher(openCreate ? paths.newClass : routes.classes);
  const data = await getTeacherClasses(access.userId);
  return <ClassesView data={data} openCreate={openCreate} />;
}
