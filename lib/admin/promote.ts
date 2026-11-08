// ADMIN_EMAILS'teki adresle e-postasını doğrulamış kullanıcıyı yönetici yapar. Giriş ve e-posta
// doğrulama eylemleri (lib/account/actions.ts) ve yönetim paneline giriş (lib/admin/access.ts)
// bu tek yardımcıyı çağırır. Yalnızca yükseltir; yöneticilik kendiliğinden geri alınmaz.
// Yalnızca sunucuda.

import { db } from "@/lib/db";
import { isConfiguredAdminEmail } from "./admin-emails";

/** Yükseltildiyse true. Hata olursa kayda yazar ve false döner (giriş akışı bozulmasın). */
export async function promoteConfiguredAdmin(userId: string): Promise<boolean> {
  if (!process.env.ADMIN_EMAILS) return false;
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true, role: true } });
    if (!user || !user.emailVerified || user.role === "ADMIN" || !isConfiguredAdminEmail(user.email)) return false;
    return await db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, role: { not: "ADMIN" }, emailVerified: true },
        data: { role: "ADMIN" },
      });
      if (updated.count === 0) return false;
      await tx.auditLog.create({
        data: { actorId: userId, action: "user.promote_admin", target: `user:${userId}`, details: { source: "ADMIN_EMAILS", from: user.role } },
      });
      return true;
    });
  } catch (error) {
    console.error("[yönetim] yönetici yapılamadı:", error instanceof Error ? error.message : error);
    return false;
  }
}
