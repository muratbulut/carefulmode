import { getCity, continueTarget } from "@/lib/lab/data";
import { continueHref } from "@/lib/lab/route";
import { getUser } from "@/lib/session";
import { getTeacherAccess } from "@/lib/teacher/access";
import { MemberBottomNav } from "./BottomNav";

/**
 * Giriş yapmış kullanıcının alt menüsü; oturum isteğe göre okunur (Suspense içinde). Ortadaki
 * düğme öğrencinin kaldığı laba gider: senaryo labında lab sayfasına, eğitim labında doğrudan
 * kartlara; yoksa yol haritasına.
 */
export async function BottomNavSlot() {
  const user = await getUser();
  if (!user) return null;
  const [city, teacher] = await Promise.all([getCity(user.id), user.role === "STUDENT" ? null : getTeacherAccess()]);
  const target = continueTarget(city);
  return <MemberBottomNav continueHref={continueHref(target ? { slug: target.lab.slug, type: target.lab.type } : null)} teacher={teacher !== null} />;
}
