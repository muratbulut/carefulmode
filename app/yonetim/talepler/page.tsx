import { Suspense } from "react";
import { ApplicationsScreen } from "@/components/admin/applications/ApplicationsScreen";
import { Loading } from "@/components/status/Loading";
import { requirePermission } from "@/lib/admin/access";
import { getApplicationsBoard } from "@/lib/admin/applications";
import { adminMetadata } from "@/lib/admin/metadata";
import { getMessages } from "@/lib/i18n";

export function generateMetadata() {
  return adminMetadata(() => getMessages().admin.menu.applications, "APPLICATIONS");
}

/**
 * Yönetim · Öğretmen talepleri (Talepler-Son, Talepler-Son-YeniOkul). Sekme ve seçili talep
 * adreste durur (?sekme=bekleyen&talep=...), bağlantı paylaşılabilir. Masaüstünde liste ve
 * ayrıntı yan yana; telefonda liste, talebe dokununca sağdan kayan ayrıntı sayfası.
 */
export default function AdminApplicationsPage({ searchParams }: PageProps<"/yonetim/talepler">) {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <AdminApplications searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminApplications({ searchParams }: Pick<PageProps<"/yonetim/talepler">, "searchParams">) {
  const access = await requirePermission("APPLICATIONS");
  const params = await searchParams;
  const board = await getApplicationsBoard({ tab: params.sekme, selected: params.talep, viewerId: access.userId });
  return <ApplicationsScreen board={board} />;
}
