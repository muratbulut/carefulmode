import { Suspense } from "react";
import { TipsAdmin } from "@/components/admin/tips/TipsAdmin";
import { Loading } from "@/components/status/Loading";
import { requirePermission } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { getMessages } from "@/lib/i18n";
import { getTipAdminData } from "@/lib/tips/data";

export function generateMetadata() {
  return adminMetadata(() => getMessages().admin.menu.tips, "TIPS");
}

/** Yönetim · Günün ipucu (Ipucu-C3-Bugun): bugün, sıradaki 6 gün ve havuz. İpucu izni (TIPS) ister. */
export default function AdminTipsPage() {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <AdminTips />
    </Suspense>
  );
}

async function AdminTips() {
  await requirePermission("TIPS");
  const data = await getTipAdminData();
  return <TipsAdmin data={data} />;
}
