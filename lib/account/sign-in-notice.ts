"use server";

// "Son girişin" şeridi (hoca öncesi kontrol, 23): ana sayfada bir kez görünür. Şerit tarayıcıda
// açılınca bu eylem önceki giriş zamanını siler; sayfa yenilenince şerit gelmez.

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";

export async function markSignInNoticeSeen(): Promise<void> {
  const user = await getUser();
  if (!user) return;
  await db.user.updateMany({ where: { id: user.id, previousSignInAt: { not: null } }, data: { previousSignInAt: null } });
}
