// Yönetim sayfalarının başlığı. Erişimi olmayana "Sayfa bulunamadı" başlığı döner; böylece
// panelin (ve sayfanın) varlığı sekme başlığından da anlaşılmaz. Yalnızca sunucuda.

import type { Metadata } from "next";
import { format, getMessages } from "@/lib/i18n";
import { getAdminAccess, getPermittedAccess, type TeamPermission } from "./access";

const robots = { index: false, follow: false } as const;

/**
 * Sayfanın başlığı. İzin verilmezse ekipteki herkes içindir (Özet, Canlı nabız); verilirse
 * bunlardan biri gerekir (sayfanın kendi denetimiyle aynı olmalı).
 */
export async function adminMetadata(page: () => Promise<string | null> | string | null, ...needed: TeamPermission[]): Promise<Metadata> {
  const t = getMessages();
  const access = needed.length ? await getPermittedAccess(...needed) : await getAdminAccess();
  const title = access ? await page() : null;
  return { title: title ? format(t.admin.pageTitle, { page: title }) : t.pages.notFound, robots };
}
