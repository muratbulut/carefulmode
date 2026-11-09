import { Suspense } from "react";
import { AuditLogView } from "@/components/admin/audit/AuditLogView";
import { Loading } from "@/components/status/Loading";
import { requirePermission } from "@/lib/admin/access";
import { getAuditPage } from "@/lib/admin/audit-log";
import { parseAuditFilters } from "@/lib/admin/audit-url";
import { adminMetadata } from "@/lib/admin/metadata";
import { getMessages } from "@/lib/i18n";
import { requestTime } from "@/lib/lab/data";

export function generateMetadata() {
  return adminMetadata(() => getMessages().admin.menu.audit, "AUDIT_LOG");
}

/**
 * Yönetim · Kayıt defteri (Kayit-Defteri): yönetimde kim, neyi, ne zaman yaptı. Yalnızca
 * yönetici ve "Kayıt defteri" izni olan sorumlu görür; kayıtlar yalnızca okunur.
 */
export default function AdminAuditPage({ searchParams }: PageProps<"/yonetim/kayit-defteri">) {
  return (
    <Suspense fallback={<Loading className="m-4 lg:m-9" />}>
      <AdminAudit searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminAudit({ searchParams }: Pick<PageProps<"/yonetim/kayit-defteri">, "searchParams">) {
  await requirePermission("AUDIT_LOG");
  const filters = parseAuditFilters(await searchParams);
  const page = await getAuditPage(filters, await requestTime());
  return <AuditLogView page={page} filters={filters} />;
}
