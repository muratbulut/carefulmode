import { Suspense } from "react";
import { LabList } from "@/components/admin/labs/LabList";
import { Loading } from "@/components/status/Loading";
import { requireLabAccess } from "@/lib/admin/access";
import { getAdminLabList } from "@/lib/admin/lab-data";
import { adminMetadata } from "@/lib/admin/metadata";
import { getMessages } from "@/lib/i18n";

export function generateMetadata() {
  return adminMetadata(() => getMessages().admin.list.title, "LAB_EDITING", "LAB_PUBLISHING");
}

/** Yönetim · Lablar (Lablar-Son): yayın durumu, sıra, gizleme ve yeni lab. */
export default function AdminLabsPage() {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <AdminLabs />
    </Suspense>
  );
}

async function AdminLabs() {
  const access = await requireLabAccess();
  const neighborhoods = await getAdminLabList();
  return <LabList neighborhoods={neighborhoods} canEdit={access.canEdit} canPublish={access.canPublish} />;
}
