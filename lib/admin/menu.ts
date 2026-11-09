// Yönetim menüsü (Tur 5 kapanış sırası) ve her sayfanın istediği izin. Sorumlu yalnızca izni olan
// sayfaları görür; sayfaların kendisi de aynı izni sunucuda yeniden ister (lib/admin/access.ts).
// Tarayıcıda da okunur (AdminShell), bu yüzden burada sunucuya ait bir şey yok.

import type { Messages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import type { TeamPermission } from "./access";

export type AdminMenuKey = keyof Messages["admin"]["menu"];

export const adminMenu: readonly { key: AdminMenuKey; href: string; needs: readonly TeamPermission[] }[] = [
  // Özet ve Canlı nabız ekipteki herkese açık (yalnızca toplam sayılar).
  { key: "overview", href: paths.admin, needs: [] },
  { key: "pulse", href: paths.adminPulse, needs: [] },
  { key: "applications", href: paths.adminApplications, needs: ["APPLICATIONS"] },
  { key: "users", href: paths.adminUsers, needs: ["ROLES"] },
  { key: "labs", href: paths.adminLabs, needs: ["LAB_EDITING", "LAB_PUBLISHING"] },
  { key: "tips", href: paths.adminTips, needs: ["TIPS"] },
  { key: "news", href: paths.adminNews, needs: ["NEWS"] },
  { key: "audit", href: paths.adminAudit, needs: ["AUDIT_LOG"] },
];

/** Bu izinlerle menüde görünen sayfalar. */
export function visibleMenu(permissions: readonly TeamPermission[]): AdminMenuKey[] {
  return adminMenu.filter((m) => m.needs.length === 0 || m.needs.some((p) => permissions.includes(p))).map((m) => m.key);
}

/** Adresin menüdeki sayfası (Özet yalnızca tam /yonetim). */
export function activeMenuKey(pathname: string): AdminMenuKey | undefined {
  return [...adminMenu]
    .reverse()
    .find((m) => (m.href === paths.admin ? pathname === m.href : pathname === m.href || pathname.startsWith(`${m.href}/`)))?.key;
}
