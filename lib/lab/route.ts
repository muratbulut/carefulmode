// Yol haritası, lablar kataloğu ve ana sayfanın tarayıcıya giden lab bilgisi ve bunun üstündeki
// saf hesaplar (rota çizgisi, ilerleme yüzdesi, düğme adresi). Sunucuda lib/lab/data.ts
// getCityView doldurur. Burada yalnızca kapak bilgisi vardır: mailler, doğru kararlar ve puanlama
// alanları tarayıcıya hiç gitmez.

import { withNext } from "@/lib/account/shared";
import { paths, routes } from "@/lib/navigation";

export type LabKind = "TRAINING" | "SCENARIO";
export type LabTemplate = "TRAINING" | "INBOX" | "MESSAGING";
export type LabDifficulty = "EASY" | "MEDIUM" | "HARD";
export type LabState = "done" | "next" | "open" | "locked";

export type DistrictInfo = { slug: string; name: string; topic: string; color: string; icon: string; sortOrder: number };

export type LabView = {
  slug: string;
  type: LabKind;
  template: LabTemplate;
  name: string;
  title: string;
  summary: string;
  difficulty: LabDifficulty;
  durationMin: number;
  /** Eğitim labında kart sayısı; senaryoda null. */
  cards: number | null;
  /** Mahalle içindeki sıra: eğitimlerde 0, senaryolarda rota sırasıyla 1, 2... */
  order: number;
  state: LabState;
  /** Senaryoda en iyi rapor puanı (0-10). */
  best: number | null;
  inProgress: boolean;
  isNew: boolean;
  /** Labı bitiren öğrenci sayısı (isim yok). */
  completions: number;
  /** İlk yayın zamanı (ms). */
  publishedAt: number;
  lockedBy: string | null;
  /** Labı açan eğitimin slug'ı (temel eğitimde ve eğitimsiz mahallede null). */
  gateSlug: string | null;
  /** Son raporun adresi (bitmiş senaryo). */
  reportHref: string | null;
  district: DistrictInfo;
};

export type DistrictView = DistrictInfo & {
  /** Eğitimler sırayla; ilki temel eğitim (her zaman açık), diğerleri ileri eğitim. */
  trainings: LabView[];
  /** Senaryolar rota sırasıyla. */
  scenarios: LabView[];
  doneCount: number;
  total: number;
  trainingDone: boolean;
  nextSlug: string | null;
};

export type CityView = {
  districts: DistrictView[];
  /** "Kaldığın yerden devam et" labı (ziyaretçide yok). */
  continueSlug: string | null;
  continueHref: string | null;
};

/** Labın açıldığı adres: eğitim labı doğrudan oynatıcıda, senaryo labı önce detay sayfasında. */
export function labHref(lab: { slug: string; type: LabKind }) {
  return lab.type === "TRAINING" ? paths.labPlay(lab.slug) : paths.lab(lab.slug);
}

/** Alt menünün ortasındaki düğme: kaldığın lab; yoksa yol haritası. */
export function continueHref(target: { slug: string; type: LabKind } | null) {
  return target ? labHref(target) : routes.roadmap;
}

/** Mahallenin rotası: her eğitim, hemen ardından onun açtığı senaryolar (lib/lab/gates.ts). */
export function routeOf(district: Pick<DistrictView, "trainings" | "scenarios">): LabView[] {
  if (district.trainings.length === 0) return district.scenarios;
  return district.trainings.flatMap((training) => [training, ...district.scenarios.filter((s) => s.gateSlug === training.slug)]);
}

/** Temel eğitim mi (mahallenin ilk eğitimi). */
export const isBasicTraining = (district: Pick<DistrictView, "trainings">, lab: Pick<LabView, "slug">) => district.trainings[0]?.slug === lab.slug;

export const allLabs = (districts: DistrictView[]) => districts.flatMap(routeOf);

/**
 * Rota çizgisi (Mahalle-I4A-Rota): her düğümün üst ve alt parçası. Bir parça, üstündeki lab
 * bittiyse mahallenin rengini alır; ilk düğümün üstü ve son düğümün altı çizilmez.
 */
export type RailPart = "none" | "done" | "todo";
export function railParts(states: readonly LabState[]): { top: RailPart; bottom: RailPart }[] {
  return states.map((state, i) => ({
    top: i === 0 ? "none" : states[i - 1] === "done" ? "done" : "todo",
    bottom: i === states.length - 1 ? "none" : state === "done" ? "done" : "todo",
  }));
}

/** Mahalle kartındaki halka ve mahalle ilerlemesi: eğitim ve senaryo odaları birlikte (ana sayfa ve ödevle aynı). */
export function districtRing(district: Pick<DistrictView, "trainings" | "scenarios">) {
  const route = routeOf(district);
  return { done: route.filter((x) => x.state === "done").length, total: route.length };
}

/** Genel ilerleme: eğitim ve senaryo labları ayrı sayılır, yüzde hepsinin üstünden. */
export function cityProgress(districts: DistrictView[]) {
  const trainings = districts.flatMap((d) => d.trainings);
  const scenarios = districts.flatMap((d) => d.scenarios);
  const trainingDone = trainings.filter((l) => l.state === "done").length;
  const scenarioDone = scenarios.filter((l) => l.state === "done").length;
  const total = trainings.length + scenarios.length;
  return {
    trainingDone,
    trainingTotal: trainings.length,
    scenarioDone,
    scenarioTotal: scenarios.length,
    percent: total === 0 ? 0 : Math.round(((trainingDone + scenarioDone) / total) * 100),
  };
}

/** Mahalle sayfasında ilk seçili lab: sıradaki, yoksa ilk açık senaryo, yoksa rotanın başı. */
export function defaultSelection(route: LabView[]): string | null {
  return (
    route.find((l) => l.state === "next") ??
    route.find((l) => l.type === "SCENARIO" && l.state === "open") ??
    route[0] ??
    null
  )?.slug ?? null;
}

/** Önizlemedeki ana düğmenin metni (t.roadmap.preview.go[...]); kilitliyse düğme yok. */
export type GoKind = "review" | "report" | "next" | "training" | "open";
export function goKind(lab: Pick<LabView, "state" | "type">): GoKind | null {
  if (lab.state === "locked") return null;
  if (lab.state === "done") return lab.type === "TRAINING" ? "review" : "report";
  if (lab.state === "next") return "next";
  return lab.type === "TRAINING" ? "training" : "open";
}

/** Önizlemedeki ana düğmenin adresi: bitmiş senaryoda son rapor, diğerlerinde labın kendisi. */
export function goHref(lab: Pick<LabView, "slug" | "type" | "state" | "reportHref">) {
  if (lab.state === "done" && lab.type === "SCENARIO" && lab.reportHref) return lab.reportHref;
  return labHref(lab);
}

/**
 * Lab detayındaki ana düğme (Lab-Detay): e-posta doğrulanmadıysa doğrulama sayfası (sonra bu
 * laba döner), kilitliyse onu açan eğitim labı, yarım kaldıysa "Kaldığın yerden devam et", bittiyse
 * "Tekrar dene", yoksa "Odaya gir". Oynatıcı /oda/[oda]/oyna'dadır.
 */
export type DetailActionKind = "verify" | "locked" | "continue" | "again" | "start";
export function detailAction(lab: {
  slug: string;
  state: LabState;
  inProgress: boolean;
  done: boolean;
  verified: boolean;
  trainingHref: string | null;
}): { kind: DetailActionKind; href: string } {
  if (!lab.verified) return { kind: "verify", href: withNext(routes.verify, paths.lab(lab.slug)) };
  if (lab.state === "locked") return { kind: "locked", href: lab.trainingHref ?? routes.roadmap };
  if (lab.inProgress) return { kind: "continue", href: paths.labPlay(lab.slug) };
  if (lab.done) return { kind: "again", href: paths.labPlay(lab.slug) };
  return { kind: "start", href: paths.labPlay(lab.slug) };
}

/** Puanın rengi: 8 ve üstü yeşil, altı sarı (Mahalle-I4A-Rota). */
export const scoreTone = (score: number) => (score >= 80 ? "good" : "fair");
