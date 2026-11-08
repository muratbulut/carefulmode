import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LabEditor } from "@/components/admin/editor/LabEditor";
import { Loading } from "@/components/status/Loading";
import { requireLabAccess } from "@/lib/admin/access";
import { getAdminLab } from "@/lib/admin/lab-data";
import { adminMetadata } from "@/lib/admin/metadata";

export function generateMetadata({ params }: PageProps<"/yonetim/odalar/[id]">) {
  return adminMetadata(async () => {
    const { id } = await params;
    const lab = await getAdminLab(id);
    return lab ? lab.draft.meta.name || lab.slug : null;
  }, "LAB_EDITING", "LAB_PUBLISHING");
}

/** Lab düzenleme (Lab-Duzenle-Son, -SMS, -Mobil): taslağı yaz, kontrol et, yayınla. */
export default function LabEditorPage({ params }: PageProps<"/yonetim/odalar/[id]">) {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <EditorLoader params={params} />
    </Suspense>
  );
}

async function EditorLoader({ params }: Pick<PageProps<"/yonetim/odalar/[id]">, "params">) {
  const access = await requireLabAccess();
  const { id } = await params;
  const lab = await getAdminLab(id);
  if (!lab) notFound();
  return <LabEditor key={lab.id} lab={lab} canEdit={access.canEdit} canPublish={access.canPublish} />;
}
