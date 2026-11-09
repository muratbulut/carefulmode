import { Suspense } from "react";
import { OverviewView } from "@/components/admin/overview/OverviewView";
import { Loading } from "@/components/status/Loading";
import { requireAdminAccess } from "@/lib/admin/access";
import { adminMetadata } from "@/lib/admin/metadata";
import { getOverview } from "@/lib/admin/overview";
import { getMessages } from "@/lib/i18n";

export function generateMetadata() {
  return adminMetadata(() => getMessages().admin.menu.overview);
}

/**
 * Yönetim · Özet (Ozet-Son): bekleyen işler (izne göre), sayılar, son 6 hafta, en çok tuzağa
 * düşülen lablar, öğrencinin bu hafta gördükleri ve son kayıtlar. Ekipteki herkese açık; yalnızca
 * toplam sayılar.
 */
export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <AdminOverview />
    </Suspense>
  );
}

async function AdminOverview() {
  const access = await requireAdminAccess();
  const data = await getOverview(access);
  return <OverviewView data={data} />;
}
