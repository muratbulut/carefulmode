// Öğretmen ve okul sorumlusu kim? Kontrol her istekte sunucuda, veritabanındaki güncel rolle
// yapılır (oturumdaki kopyaya güvenilmez). Öğretmen rolü (TEACHER) sınıf açabilir. Yönetici
// (ADMIN) ancak öğretmenlik talebi onaylandıysa, okul sorumlusuysa ya da zaten sınıfı varsa
// öğretmen sayılır; yoksa menüde Sınıflarım görünmez (Murat, 15 Ekim). Okul sorumlusu, School.coordinatorId ile okula bağlı kişidir; öğrenci olamaz.
// Doğrulanmamış e-posta ve askıya alınmış hesap bu sayfalara giremez. Yalnızca sunucuda.

import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { withNext } from "@/lib/account/shared";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { paths, routes } from "@/lib/navigation";
import { getUser } from "@/lib/session";

export type TeacherAccess = {
  userId: string;
  name: string;
  role: "TEACHER" | "ADMIN";
  /** Öğretmenin okulu (onayla gelir); yöneticide boş olabilir. */
  schoolId: string | null;
  /** Sorumlusu olduğu okul (Okulum); yoksa null. */
  coordinatedSchoolId: string | null;
};

const isTeacherRole = (role: string): role is "TEACHER" | "ADMIN" => role === "TEACHER" || role === "ADMIN";

/** Oturumdaki kişinin öğretmen bilgisi; öğretmen değilse null. */
export const getTeacherAccess = cache(async (): Promise<TeacherAccess | null> => {
  const sessionUser = await getUser();
  if (!sessionUser) return null;
  const row = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, displayName: true, role: true, emailVerified: true, suspended: true, schoolId: true, coordinatedSchool: { select: { id: true } } },
  });
  if (!row || !row.emailVerified || row.suspended || !isTeacherRole(row.role)) return null;
  if (row.role === "ADMIN" && !row.coordinatedSchool && !(await adminTeaches(db, row.id))) return null;
  return { userId: row.id, name: row.displayName, role: row.role, schoolId: row.schoolId, coordinatedSchoolId: row.coordinatedSchool?.id ?? null };
});

type TeacherDb = Pick<Prisma.TransactionClient, "teacherApplication" | "classroom">;

/** Yönetici öğretmen mi: onaylanmış öğretmenlik talebi ya da (arşivlenmiş de olsa) sınıfı var. */
export async function adminTeaches(client: TeacherDb, userId: string): Promise<boolean> {
  const [approved, classes] = await Promise.all([
    client.teacherApplication.count({ where: { userId, status: "APPROVED" } }),
    client.classroom.count({ where: { teacherId: userId } }),
  ]);
  return approved > 0 || classes > 0;
}

/**
 * Öğretmen sayfaları için. Giriş yoksa giriş sayfasına; öğretmen değilse profildeki Öğretmenlik
 * bölümüne (orada nasıl öğretmen olunacağı anlatılır).
 */
export async function requireTeacher(next: string): Promise<TeacherAccess> {
  const user = await getUser();
  if (!user) redirect(withNext(routes.signIn, next));
  const access = await getTeacherAccess();
  if (!access) redirect(paths.profileSection("teaching"));
  return access;
}

/** Okul sorumlusunun okulu; sorumlu değilse null. Sorumlu öğretmen ya da yöneticidir. */
export const getCoordinatorAccess = cache(async () => {
  const access = await getTeacherAccess();
  if (!access?.coordinatedSchoolId) return null;
  return { ...access, schoolId: access.coordinatedSchoolId };
});
