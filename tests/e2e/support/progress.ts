import { withDb } from "./db";

/**
 * Testteki öğrencinin bir eğitim labını bitirmiş sayılması (kartları tek tek geçmeden). Yalnızca
 * o öğrencinin satırı yazılır; başka kayıtlara dokunulmaz.
 */
export async function completeTraining(email: string, labSlug: string, cards = 4) {
  await withDb((client) =>
    client.query(
      `INSERT INTO "TrainingProgress" ("userId", "labId", "cardIndex", "completedAt", "updatedAt")
       SELECT u.id, l.id, $3, now(), now() FROM "User" u, "Lab" l WHERE u.email = $1 AND l.slug = $2
       ON CONFLICT ("userId", "labId") DO UPDATE SET "cardIndex" = $3, "completedAt" = now(), "updatedAt" = now()`,
      [email, labSlug, cards],
    ),
  );
}
