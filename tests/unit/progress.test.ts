import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { badgeCodes, badgeIcon, evaluateBadges, type ProgressFacts } from "@/lib/progress/badges";
import { levelFor, levelThresholds } from "@/lib/progress/levels";
import { getMessages } from "@/lib/i18n";

describe("seviyeler (Murat onayı, 11 Ekim)", () => {
  it("eşikler tasarımdaki gibi", () => {
    expect(levelThresholds).toEqual([0, 150, 400, 700, 1000, 1350, 1700, 2050, 2400, 2700]);
  });

  it("puana göre seviye ve sonraki seviyeye kalan", () => {
    expect(levelFor(0)).toMatchObject({ level: 1, next: 150, toNext: 150 });
    expect(levelFor(660)).toMatchObject({ level: 3, next: 700, toNext: 40 });
    expect(levelFor(700)).toMatchObject({ level: 4, toNext: 300 });
    expect(levelFor(5000)).toMatchObject({ level: 10, next: null, toNext: 0, progress: 1 });
  });

  it("her seviyenin unvanı sözlükte", () => {
    expect(getMessages().progress.levels).toHaveLength(levelThresholds.length);
  });
});

const facts = (over: Partial<ProgressFacts> = {}): ProgressFacts => ({
  level: 1,
  completedTrainings: 0,
  neighborhoods: [
    { slug: "hesap-kalesi", scenarioTotal: 0, scenarioDone: 0, scenarios: 0, visited: false },
    { slug: "oltalama-limani", scenarioTotal: 1, scenarioDone: 0, scenarios: 1, visited: false },
  ],
  finishedScenarios: 0,
  bestScore: null,
  cameBack: false,
  inClassroom: false,
  curiousDays: 0,
  ...over,
});

describe("rozetler", () => {
  it("13 rozet, her birinin ikonu ve sözlükte adı var", () => {
    expect(badgeCodes).toHaveLength(13);
    for (const code of badgeCodes) {
      expect(existsSync(`public${badgeIcon(code)}`), code).toBe(true);
      expect(getMessages().progress.badges[code].name, code).toBeTruthy();
    }
  });

  it("yeni öğrencinin rozeti yok", () => {
    expect(evaluateBadges(facts()).filter((b) => b.earned)).toEqual([]);
  });

  it("ilk rapor, kart kurdu, kusursuz ve mahalle rozeti kazanılır", () => {
    const earned = evaluateBadges(
      facts({
        completedTrainings: 1,
        finishedScenarios: 1,
        bestScore: 100,
        neighborhoods: [{ slug: "oltalama-limani", scenarioTotal: 1, scenarioDone: 1, scenarios: 1, visited: true }],
      }),
    )
      .filter((b) => b.earned)
      .map((b) => b.code);
    expect(earned).toEqual(["ilk-rapor", "kart-kurdu", "oltalama-avcisi", "kusursuz", "sehir-turu"]);
  });

  it("senaryo labı olmayan mahallenin rozeti kazanılmaz", () => {
    expect(evaluateBadges(facts()).find((b) => b.code === "sifre-ustasi")!.earned).toBe(false);
  });

  it("mahalle rozeti temel yolu sayar: ileri eğitimin senaryoları gerekmez", () => {
    // Dostluk Parkı: temel yolda 2 senaryo (ikisi de bitti), ileri eğitimin 1 senaryosu bitmedi.
    const park = (done: number) =>
      evaluateBadges(facts({ neighborhoods: [{ slug: "dostluk-parki", scenarioTotal: 2, scenarioDone: done, scenarios: 3, visited: true }] })).find(
        (b) => b.code === "dost-eli",
      )!;
    expect(park(2)).toMatchObject({ earned: true, progress: { value: 2, total: 2 } });
    expect(park(1).earned).toBe(false);
  });

  it("şehir turu senaryo odası olmayan mahalleyi beklemez", () => {
    const tour = (neighborhoods: ProgressFacts["neighborhoods"]) => evaluateBadges(facts({ neighborhoods })).find((b) => b.code === "sehir-turu")!;
    const visited = { slug: "oltalama-limani", scenarioTotal: 1, scenarioDone: 0, scenarios: 1, visited: true };
    const empty = { slug: "dostluk-parki", scenarioTotal: 0, scenarioDone: 0, scenarios: 0, visited: false };
    expect(tour([visited, empty])).toMatchObject({ earned: true, progress: { value: 1, total: 1 } });
    expect(tour([visited, { ...empty, scenarios: 1, scenarioTotal: 1 }]).earned).toBe(false);
  });
});
