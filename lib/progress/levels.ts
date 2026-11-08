// Puan ve seviye (doküman Bölüm 3, "Puan, seviye ve rozetler"; Murat onayladı, 11 Ekim).
// Eğitim labı 100 puan, senaryo labı rapor puanı (100 üzerinden) × 2; aynı labda en iyi deneme sayılır.
// Öğrenciye toplam seviye sayısı gösterilmez ("x/10" yok): "Sonraki seviyeye N puan kaldı".
// Seviye unvanları sözlükte: t.progress.levels[seviye - 1].

export const trainingPoints = 100;
export const scenarioPointsPerScore = 2;

/** Seviyelerin eşikleri: 1. seviye 0 puan, 2. seviye 150 puan... */
export const levelThresholds = [0, 150, 400, 700, 1000, 1350, 1700, 2050, 2400, 2700] as const;
export const topLevel = levelThresholds.length;

export type LevelInfo = {
  level: number;
  points: number;
  /** Sonraki seviyenin eşiği; en üst seviyede null. */
  next: number | null;
  toNext: number;
  /** Bu seviyeden sonrakine ilerleme, 0-1. */
  progress: number;
};

export function levelFor(points: number): LevelInfo {
  const safe = Math.max(0, Math.floor(points));
  let index = 0;
  while (index + 1 < levelThresholds.length && safe >= levelThresholds[index + 1]) index++;
  const level = index + 1;
  if (level === topLevel) return { level, points: safe, next: null, toNext: 0, progress: 1 };
  const from = levelThresholds[index];
  const next = levelThresholds[index + 1];
  return { level, points: safe, next, toNext: next - safe, progress: (safe - from) / (next - from) };
}
