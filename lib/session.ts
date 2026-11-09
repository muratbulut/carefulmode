// Oturum yardımcıları (sunucu). Sayfa ve sunucu eylemleri kullanıcıyı buradan okur;
// rol ve doğrulama kontrolü her istekte sunucuda yapılır.
//
// Oturum okumak isteğe bağlıdır (çerez). Next.js 16'da (cacheComponents) bunu çağıran
// bileşen <Suspense> içinde olmalıdır; aksi halde sayfa statik derlenemez.

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { withNext } from "@/lib/account/shared";
import { getAuth, type SessionUser } from "@/lib/auth";
import { routes } from "@/lib/navigation";

export type Role = "STUDENT" | "TEACHER" | "ADMIN";

/**
 * Aynı istek içinde oturum bir kez okunur. Çerezler cookies()'den alınır: sunucu eylemi oturum
 * çerezini değiştirirse (şifre değişince yeni oturum açılır) eylemden sonraki çizimde headers()
 * hâlâ eski çerezi verir, cookies() yenisini.
 */
export const getSession = cache(async () => {
  const requestHeaders = new Headers(await headers());
  requestHeaders.set("cookie", (await cookies()).toString());
  return getAuth().api.getSession({ headers: requestHeaders });
});

export async function getUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** Giriş yapmamışsa giriş sayfasına, döndükten sonra `next` adresine. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(withNext(routes.signIn, next));
  return user;
}

/** Lab başlatmak gibi işler doğrulanmış e-posta ister (Faz 2 bitti ölçütü). */
export async function requireVerifiedUser(next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!user.emailVerified) redirect(withNext(routes.verify, next));
  return user;
}

export async function requireRole(roles: Role[], next?: string): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role as Role)) redirect(routes.home);
  return user;
}
