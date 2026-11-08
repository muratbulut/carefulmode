import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { can, requireAdminAccess } from "@/lib/admin/access";
import { visibleMenu } from "@/lib/admin/menu";
import { db } from "@/lib/db";

// Yönetim paneli arama motorlarına kapalı. Sayfa başlıkları her sayfada, erişim denetiminden
// sonra verilir (yetkisi olmayana panelin varlığı belli olmasın).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Yönetim panelinin kapısı: yönetici ya da en az bir ekip izni olan sorumlu girer, başka herkes
 * "Bu sayfa yok" görür. Her sayfa kendi iznini ayrıca ister (lib/admin/access.ts). Kapı lab
 * önizlemesi (/onizle) için de geçerlidir; önizlemede yalnızca çerçeve çizilmez
 * (components/admin/AdminShell.tsx).
 */
export default function AdminLayout({ children }: LayoutProps<"/yonetim">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: ReactNode }) {
  const access = await requireAdminAccess();
  // Menüdeki amber rozet: bekleyen öğretmen talepleri (yalnızca talepleri gören için).
  const pending = can(access, "APPLICATIONS") ? await db.teacherApplication.count({ where: { status: "PENDING" } }) : 0;
  return (
    <AdminShell
      user={{ name: access.name, avatar: access.avatar, isAdmin: access.isAdmin }}
      nav={{ items: visibleMenu(access.permissions), badges: { applications: pending } }}
    >
      {children}
    </AdminShell>
  );
}
