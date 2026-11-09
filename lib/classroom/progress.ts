// Bir grup öğrencinin hangi labları bitirdiği (sınıf detayı, Sınıflarım, Okulum, ana sayfadaki
// ödev). "Bitirdi" öğrencinin kendi yol haritasıyla aynı kuraldır (lib/lab/data.ts getUserProgress):
// eğitim labında son kart, senaryo labında biten (tamamlanan ya da hacklenen) bir deneme.
//
// Gizlilik: öğretmen ve okul sorumlusu öğrencinin yalnızca bitirdi / bitirmedi bilgisini görür.
// Puan, rapor ve deneme sayısı buradan çıkmaz; "noticed" (tuzağı fark etti mi) yalnızca sınıf
// toplamındaki oran için kullanılır ve tek öğrenci için gösterilmez. Yalnızca sunucuda.

import "server-only";
import { db } from "@/lib/db";
import type { AttemptStatus } from "@/lib/generated/prisma/enums";

export type MemberLab = {
  doneAt: Date;
  /**
   * Senaryo labı: tuzağı fark etti mi (raporu "Güvende kaldın"), ilk ve son biten denemesinde
   * (sınıf toplamı için; tek öğrenci için gösterilmez). Eğitimde null.
   */
  noticed: { first: boolean; last: boolean } | null;
};

export type MemberProgress = {
  /** Bitirdiği lablar: labId → ilk bitirdiği an. */
  done: Map<string, MemberLab>;
  /** En son lab hareketi (başlattı, bitirdi, kart okudu); hiç yoksa null. */
  lastLabAt: Date | null;
};

type AttemptRow = { userId: string; labId: string; status: AttemptStatus; startedAt: Date; endedAt: Date | null; noticed: boolean | null };

const empty = (): MemberProgress => ({ done: new Map(), lastLabAt: null });

/** Öğrencilerin lab ilerlemesi; listede olup hiç labı olmayan öğrenci de boş kayıtla döner. */
export async function getMembersProgress(userIds: readonly string[]): Promise<Map<string, MemberProgress>> {
  const result = new Map<string, MemberProgress>(userIds.map((id) => [id, empty()]));
  if (userIds.length === 0) return result;
  const ids = [...new Set(userIds)];
  const [training, attempts] = await Promise.all([
    db.trainingProgress.findMany({ where: { userId: { in: ids } }, select: { userId: true, labId: true, completedAt: true, updatedAt: true } }),
    // Raporun yalnızca durumu okunur (puan ve seçimler buradan çıkmaz).
    db.$queryRaw<AttemptRow[]>`
      SELECT "userId", "labId", "status", "startedAt", "endedAt", ("resultReport"->>'status' = 'safe') AS "noticed"
      FROM "LabAttempt" WHERE "userId" = ANY(${ids}::text[]) ORDER BY "startedAt", "id"`,
  ]);
  const touch = (p: MemberProgress, at: Date | null) => {
    if (at && (!p.lastLabAt || at > p.lastLabAt)) p.lastLabAt = at;
  };
  for (const row of training) {
    const p = result.get(row.userId)!;
    touch(p, row.updatedAt);
    if (row.completedAt) p.done.set(row.labId, { doneAt: row.completedAt, noticed: null });
  }
  for (const row of attempts) {
    const p = result.get(row.userId)!;
    touch(p, row.endedAt ?? row.startedAt);
    if (row.status !== "COMPLETED" && row.status !== "HACKED") continue;
    // Denemeler başlama sırasıyla gelir: ilk biten deneme "bitirdi" anını ve ilk sonucu belirler,
    // sonrakiler yalnızca son sonucu değiştirir.
    const noticed = row.noticed === true;
    const lab = p.done.get(row.labId);
    if (!lab) p.done.set(row.labId, { doneAt: row.endedAt ?? row.startedAt, noticed: { first: noticed, last: noticed } });
    else if (lab.noticed) lab.noticed.last = noticed;
  }
  return result;
}

/** Haftanın başı (pazartesi 00.00, Türkiye saati); "bu hafta biten oda" sayıları için. */
export function weekStart(now: Date): Date {
  // Türkiye UTC+3, yaz saati yok.
  const local = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const day = (local.getUTCDay() + 6) % 7;
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day);
  return new Date(start - 3 * 60 * 60 * 1000);
}
