import { Suspense } from "react";
import { PulseView } from "@/components/admin/pulse/PulseView";
import { Loading } from "@/components/status/Loading";
import { requireAdminAccess } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { getPulse } from "@/lib/admin/pulse";
import { getMessages } from "@/lib/i18n";

export function generateMetadata() {
  return adminMetadata(() => getMessages().admin.menu.pulse);
}

/**
 * Yönetim · Canlı nabız (CanliNabiz-Son): şu an labda olanlar, mahalle dağılımı, son bir saat ve
 * isimsiz akış. Ekipteki herkese açık; yalnızca toplam sayılar. 15 saniyede bir yenilenir.
 */
export default function AdminPulsePage() {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <AdminPulse />
    </Suspense>
  );
}

async function AdminPulse() {
  const access = await requireAdminAccess();
  const data = await getPulse(access);
  return <PulseView data={data} />;
}
