// Rozetler tek listede (CLAUDE.md "Tasarım"). Yeni rozet: bu listeye bir satır, sözlüğe adı ve
// nasıl kazanıldığı (t.progress.badges[kod]) ve public/badges/<kod>.svg ikonu. Kazanılmamış
// rozette aynı ikon gri ve soluk görünür. Murat ikonları kendi tasarımıyla değiştirecek.

import { reportScale } from "@/lib/lab/content";
import { topLevel } from "./levels";

/** Mahalleyi bitirince kazanılan rozetler (mahalle adresine göre). */
const neighborhoodBadges = {
  "hesap-kalesi": "sifre-ustasi",
  "oltalama-limani": "oltalama-avcisi",
  "yazilim-ormani": "virus-savar",
  "para-carsisi": "cuzdan-bekcisi",
  "dostluk-parki": "dost-eli",
} as const;

export const badgeCodes = [
  "sifre-ustasi",
  "ilk-rapor",
  "kart-kurdu",
  "oltalama-avcisi",
  "virus-savar",
  "cuzdan-bekcisi",
  "dost-eli",
  "kusursuz",
  "geri-donus",
  "sinif-arkadasi",
  "merakli",
  "sehir-turu",
  "siber-kahraman",
] as const;
export type BadgeCode = (typeof badgeCodes)[number];

export const showcaseSize = 5;
export const curiousDays = 7;

export const badgeIcon = (code: BadgeCode) => `/badges/${code}.svg`;

/** Rozetlerin hesaplandığı bilgiler (lib/progress/summary.ts sunucuda toplar). */
export type ProgressFacts = {
  level: number;
  completedTrainings: number;
  /**
   * Mahalle başına temel yoldaki (temel eğitimin açtığı) yayındaki senaryo sayısı ve bitirilenler,
   * bütün senaryoların sayısı ve en az birinin bitip bitmediği (Şehir turu).
   */
  neighborhoods: { slug: string; scenarioTotal: number; scenarioDone: number; scenarios: number; visited: boolean }[];
  finishedScenarios: number;
  bestScore: number | null;
  /** Hacklendiği bir labı sonra güvende kalarak bitirdi mi. */
  cameBack: boolean;
  inClassroom: boolean;
  curiousDays: number;
};

export type BadgeState = {
  code: BadgeCode;
  earned: boolean;
  /** Kazanılmamışsa ilerleme: "0/4 oda", "En iyi puanın 90/100" gibi gösterilir. */
  progress: { kind: "labs" | "best" | "count" | "classroom" | "days" | "districts" | "level"; value: number; total: number };
};

function neighborhoodOf(code: BadgeCode) {
  return (Object.entries(neighborhoodBadges) as [string, BadgeCode][]).find(([, c]) => c === code)?.[0] ?? null;
}

/** Her rozetin bu bilgilere göre kazanılıp kazanılmadığı ve ilerlemesi. */
export function evaluateBadges(facts: ProgressFacts): BadgeState[] {
  return badgeCodes.map((code) => {
    const slug = neighborhoodOf(code);
    if (slug) {
      const n = facts.neighborhoods.find((x) => x.slug === slug);
      const total = n?.scenarioTotal ?? 0;
      const done = Math.min(n?.scenarioDone ?? 0, total);
      return { code, earned: total > 0 && done >= total, progress: { kind: "labs", value: done, total } };
    }
    switch (code) {
      case "ilk-rapor":
        return { code, earned: facts.finishedScenarios > 0, progress: { kind: "count", value: Math.min(1, facts.finishedScenarios), total: 1 } };
      case "kart-kurdu":
        return { code, earned: facts.completedTrainings > 0, progress: { kind: "count", value: Math.min(1, facts.completedTrainings), total: 1 } };
      case "kusursuz":
        return { code, earned: facts.bestScore === reportScale, progress: { kind: "best", value: facts.bestScore ?? 0, total: reportScale } };
      case "geri-donus":
        return { code, earned: facts.cameBack, progress: { kind: "count", value: facts.cameBack ? 1 : 0, total: 1 } };
      case "sinif-arkadasi":
        return { code, earned: facts.inClassroom, progress: { kind: "classroom", value: facts.inClassroom ? 1 : 0, total: 1 } };
      case "merakli":
        return { code, earned: facts.curiousDays >= curiousDays, progress: { kind: "days", value: Math.min(facts.curiousDays, curiousDays), total: curiousDays } };
      case "sehir-turu": {
        // Henüz senaryo odası olmayan mahalle sayılmaz (yeni açılan mahalle rozeti kilitlemez).
        const open = facts.neighborhoods.filter((n) => n.scenarios > 0);
        const visited = open.filter((n) => n.visited).length;
        return { code, earned: open.length > 0 && visited >= open.length, progress: { kind: "districts", value: visited, total: Math.max(open.length, 1) } };
      }
      case "siber-kahraman":
        return { code, earned: facts.level >= topLevel, progress: { kind: "level", value: facts.level, total: topLevel } };
      default:
        return { code, earned: false, progress: { kind: "count", value: 0, total: 1 } };
    }
  });
}

/** Rozetin kendi rengi (tema rengi adı); ikon dosyası da aynı rengi kullanır. */
export const badgeColor: Record<BadgeCode, "success" | "accent" | "purple" | "warning" | "pink" | "orange"> = {
  "sifre-ustasi": "success",
  "ilk-rapor": "warning",
  "kart-kurdu": "accent",
  "oltalama-avcisi": "accent",
  "virus-savar": "purple",
  "cuzdan-bekcisi": "warning",
  "dost-eli": "pink",
  kusursuz: "pink",
  "geri-donus": "orange",
  "sinif-arkadasi": "success",
  merakli: "warning",
  "sehir-turu": "accent",
  "siber-kahraman": "purple",
};

export const isBadgeCode = (value: string): value is BadgeCode => (badgeCodes as readonly string[]).includes(value);
