import { withDb } from "./db";

/**
 * Hesabı yönetici yapar. Canlıda ilk yönetici ADMIN_EMAILS ile atanır; testlerde adres her
 * koşuda yeni olduğu için rol doğrudan yazılır (ADMIN_EMAILS ayrıştırması birim testli).
 */
export async function makeAdmin(email: string) {
  await withDb((client) => client.query(`UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = $1`, [email]));
}

/**
 * Testlerin açtığı lablar ("e2e-" ile başlayan adres) ve onlara bağlı denemeler, eğitim
 * ilerlemeleri ve sürümler silinir. `slug` verilirse yalnız o lab; `olderThanMinutes` verilirse
 * yalnız o kadar eski olanlar (aynı anda koşan başka bir test grubunun labına dokunulmaz).
 * Kayıt defteri (AuditLog) silinmez; zaten silinemez.
 */
export async function deleteTestLabs({ slug, olderThanMinutes }: { slug?: string; olderThanMinutes?: number } = {}) {
  await withDb(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT "id" FROM "Lab"
        WHERE "slug" LIKE 'e2e-%'
          AND ($1::text IS NULL OR "slug" = $1)
          AND ($2::int IS NULL OR "createdAt" < now() - make_interval(mins => $2::int))`,
      [slug ?? null, olderThanMinutes ?? null],
    );
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return;
    await client.query("BEGIN");
    try {
      await client.query(`DELETE FROM "LabAttempt" WHERE "labId" = ANY($1)`, [ids]);
      await client.query(`DELETE FROM "TrainingProgress" WHERE "labId" = ANY($1)`, [ids]);
      await client.query(`DELETE FROM "LabVersion" WHERE "labId" = ANY($1)`, [ids]);
      await client.query(`DELETE FROM "Lab" WHERE "id" = ANY($1)`, [ids]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}
