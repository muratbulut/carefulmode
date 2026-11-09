// Öğrencinin puanı, seviyesi ve rozetleri (sunucu). Puan kayıtlardan her seferinde hesaplanır
// (eğitim labı 100, senaryo labı en iyi rapor puanı × 20); kazanılan rozetler EarnedBadge'e
// yazılır ve bir kez kazanılan rozet sonra yeni lab eklense de kalır.

import { cache } from "react";
import { db } from "@/lib/db";
import { getCity, getUserProgress, isFinished } from "@/lib/lab/data";
import { evaluateBadges, showcaseSize, type BadgeCode, type BadgeState, isBadgeCode } from "./badges";
import { levelFor, scenarioPointsPerScore, trainingPoints, type LevelInfo } from "./levels";

export type ProgressSummary = {
  level: LevelInfo;
  /** Biten lab (eğitim + senaryo), okunan kart, rapor sayısı. */
  stats: { labsDone: number; cardsRead: number; reports: number };
  badges: (BadgeState & { earnedAt: Date | null; showcase: number | null })[];
  earnedCount: number;
  showcase: BadgeCode[];
};

/** Özet; yeni kazanılan rozet varsa önce yazılır (aynı istekte bir kez hesaplanır). */
export const getProgressSummary = cache(async (userId: string): Promise<ProgressSummary> => {
  const summary = await computeSummary(userId);
  return (await awardFresh(userId, summary)).length > 0 ? computeSummary(userId) : summary;
});

async function computeSummary(userId: string): Promise<ProgressSummary> {
  const [city, progress, membership, earnedRows, curiousRows] = await Promise.all([
    getCity(userId),
    getUserProgress(userId),
    db.classroomMembership.findFirst({ where: { userId }, select: { classroomId: true } }),
    db.earnedBadge.findMany({ where: { userId }, select: { badgeCode: true, earnedAt: true, showcaseOrder: true } }),
    // Meraklı: günün ipucunda "Neden?"e bakılan farklı günler.
    db.tipView.groupBy({ by: ["date"], where: { userId, reasonViewed: true } }),
  ]);

  // Puan: bütün lablar sayılır (sonradan gizlenen labın puanı da kalır).
  let points = 0;
  let labsDone = 0;
  let cardsRead = 0;
  for (const [, p] of progress.byLab) {
    if (p.cardIndex !== null) {
      cardsRead += p.cardIndex;
      if (p.done) points += trainingPoints;
    }
    if (p.best !== null) points += p.best * scenarioPointsPerScore;
    if (p.done) labsDone++;
  }
  const level = levelFor(points);

  const finished = progress.attempts.filter((a) => isFinished(a.status));
  const reports = finished.length;
  const bestScore = finished.reduce<number | null>((best, a) => (a.reportScore === null ? best : Math.max(best ?? 0, a.reportScore)), null);

  // Geri dönüş: hacklendiği labı sonra hacklenmeden bitirdi mi.
  const cameBack = finished.some(
    (later) =>
      later.status === "COMPLETED" &&
      finished.some((earlier) => earlier.labId === later.labId && earlier.status === "HACKED" && earlier.startedAt < later.startedAt),
  );

  const states = evaluateBadges({
    level: level.level,
    completedTrainings: city.flatMap((d) => d.trainings).filter((x) => x.progress.done).length,
    // Mahalle rozeti temel yolu sayar: temel eğitimin açtığı senaryolar (ileri eğitimler isteğe bağlı).
    neighborhoods: city.map((d) => {
      const basic = d.scenarios.filter((s) => s.basicPath);
      return {
        slug: d.slug,
        scenarioTotal: basic.length,
        scenarioDone: basic.filter((s) => s.progress.done).length,
        scenarios: d.scenarios.length,
        visited: d.scenarios.some((s) => s.progress.done),
      };
    }),
    finishedScenarios: reports,
    bestScore,
    cameBack,
    inClassroom: membership !== null,
    curiousDays: curiousRows.length,
  });

  const earned = new Map(earnedRows.filter((r) => isBadgeCode(r.badgeCode)).map((r) => [r.badgeCode as BadgeCode, r]));
  const badges = states.map((state) => {
    const row = earned.get(state.code);
    return { ...state, earned: state.earned || !!row, earnedAt: row?.earnedAt ?? null, showcase: row?.showcaseOrder ?? null };
  });
  const showcase = badges
    .filter((b) => b.showcase !== null)
    .sort((a, b) => a.showcase! - b.showcase!)
    .map((b) => b.code)
    .slice(0, showcaseSize);

  return {
    level,
    stats: { labsDone, cardsRead, reports },
    badges,
    earnedCount: badges.filter((b) => b.earned).length,
    showcase,
  };
}

/**
 * Yeni kazanılan rozetleri yazar ve vitrinde yer varsa vitrine ekler. Lab ve eğitim bitince
 * (lib/lab/actions.ts) ve özet okunurken çağrılır. Yeni kazanılanların kodlarını döner.
 */
export async function awardBadges(userId: string): Promise<BadgeCode[]> {
  return awardFresh(userId, await computeSummary(userId));
}

async function awardFresh(userId: string, summary: ProgressSummary): Promise<BadgeCode[]> {
  const fresh = summary.badges.filter((b) => b.earned && b.earnedAt === null).map((b) => b.code);
  if (fresh.length === 0) return [];
  let slot = summary.showcase.length;
  await db.earnedBadge.createMany({
    data: fresh.map((code) => ({ userId, badgeCode: code, showcaseOrder: slot < showcaseSize ? slot++ : null })),
    skipDuplicates: true,
  });
  return fresh;
}
