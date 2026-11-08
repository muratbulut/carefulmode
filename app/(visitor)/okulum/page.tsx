import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageBackground } from "@/components/background/PageBackground";
import { SchoolView } from "@/components/school/SchoolView";
import { Loading } from "@/components/status/Loading";
import { getMessages } from "@/lib/i18n";
import { requestTime } from "@/lib/lab/data";
import { routes } from "@/lib/navigation";
import { getSchoolView } from "@/lib/school/bulletin";
import { requireUser } from "@/lib/session";
import { getCoordinatorAccess } from "@/lib/teacher/access";

export const metadata: Metadata = { title: getMessages().pages.mySchool, robots: { index: false } };

/**
 * Okulum (22c, O4 haftalık okul bülteni): yalnızca okulun sorumlusu görür. Giriş yoksa girişe;
 * giriş yapmış ama sorumlu değilse "Bu sayfa yok" (sayfanın varlığı belli olmaz). Yetki her
 * istekte veritabanındaki güncel rolle denetlenir.
 */
export default function MySchoolPage() {
  return (
    <>
      <div className="print:hidden">
        <PageBackground />
      </div>
      <Suspense fallback={<Loading className="relative mx-4 my-8 lg:mx-auto lg:max-w-[1152px]" cardCount={3} />}>
        <MySchool />
      </Suspense>
    </>
  );
}

async function MySchool() {
  await requireUser(routes.mySchool);
  const access = await getCoordinatorAccess();
  if (!access) notFound();
  const view = await getSchoolView({ userId: access.userId, name: access.name }, access.schoolId, await requestTime());
  if (!view) notFound();
  return <SchoolView view={view} />;
}
