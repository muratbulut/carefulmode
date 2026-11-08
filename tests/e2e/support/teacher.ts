import { randomUUID } from "node:crypto";
import { withDb } from "./db";

// Faz 4 testleri için öğretmen ve okul. Canlıda öğretmen yönetici onayıyla olur (Faz 5);
// testlerde rol ve okul doğrudan yazılır.

/** Testin okulu: her koşuda yeni ad, il ve ilçe listeden (lib/school/places.ts). */
export async function createSchool({
  name = `E2E Ortaokulu ${randomUUID().slice(0, 8)}`,
  province = "İstanbul",
  district = "Bahçelievler",
  creatorEmail,
}: { name?: string; province?: string; district?: string; creatorEmail: string }) {
  const id = `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
  await withDb((client) =>
    client.query(
      `INSERT INTO "School" ("id", "name", "nameKey", "province", "district", "createdById")
       SELECT $1, $2, $3, $4, $5, "id" FROM "User" WHERE "email" = $6`,
      [id, name, name.toLocaleLowerCase("tr").replace(/\s+/g, " "), province, district, creatorEmail],
    ),
  );
  return { id, name, province, district };
}

/** Hesabı öğretmen yapar; okul verilirse öğretmenin okulu olur. */
export async function makeTeacher(email: string, schoolId?: string) {
  await withDb((client) => client.query(`UPDATE "User" SET "role" = 'TEACHER', "schoolId" = $2 WHERE "email" = $1`, [email, schoolId ?? null]));
}

/** Hesabı okulun sorumlusu yapar. */
export async function makeCoordinator(email: string, schoolId: string) {
  await withDb((client) => client.query(`UPDATE "School" SET "coordinatorId" = (SELECT "id" FROM "User" WHERE "email" = $1) WHERE "id" = $2`, [email, schoolId]));
}

export async function userIdOf(email: string) {
  return withDb(async (client) => (await client.query<{ id: string }>(`SELECT "id" FROM "User" WHERE "email" = $1`, [email])).rows[0]?.id);
}
