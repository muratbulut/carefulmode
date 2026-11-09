// Mahalle içindeki eğitimler ve kilitler (15 Ekim, Murat). Saf hesaplar; sunucu (lib/lab/data.ts,
// ödev, yönetim) ve testler buradan okur.
//
// - Bir mahallede birden çok eğitim odası olabilir. Sırası en küçük olan temel eğitimdir: her zaman
//   açıktır. Diğerleri ileri eğitimdir: temel eğitim bitince açılır.
// - Her senaryo odasını bir eğitim açar (Lab.unlockedById). Boşsa, seçilen eğitim bu listede yoksa
//   (yayında değil) ya da aynı mahallenin eğitimi değilse mahallenin temel eğitimi açar.
// - Mahallenin rotası: her eğitim, hemen ardından onun açtığı senaryolar (kendi sıralarıyla).

export type GateLab = {
  id: string;
  neighborhoodId: string;
  type: "TRAINING" | "SCENARIO";
  sortOrder: number;
  unlockedById: string | null;
};

// Aynı sıradakiler kimlikle ayrılır: her sorguda aynı sonuç (iki "temel eğitim" çıkmaz).
const bySort = <T extends GateLab>(a: T, b: T) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Mahallenin eğitimleri, sırayla; ilki temel eğitimdir. */
export function trainingsOf<T extends GateLab>(labs: readonly T[], neighborhoodId: string): T[] {
  return labs.filter((lab) => lab.neighborhoodId === neighborhoodId && lab.type === "TRAINING").sort(bySort);
}

/** Mahallenin temel eğitimi; eğitimi yoksa null. */
export function basicTrainingOf<T extends GateLab>(labs: readonly T[], neighborhoodId: string): T | null {
  return trainingsOf(labs, neighborhoodId)[0] ?? null;
}

/**
 * Labı açan eğitim: temel eğitim için null (her zaman açık), ileri eğitim için temel eğitim, senaryo
 * için kendi eğitimi (yoksa temel eğitim; mahallede hiç eğitim yoksa null, oda açıktır).
 */
export function gateOf<T extends GateLab>(lab: GateLab, labs: readonly T[]): T | null {
  const basic = basicTrainingOf(labs, lab.neighborhoodId);
  if (lab.type === "TRAINING") return basic && basic.id !== lab.id ? basic : null;
  const own = lab.unlockedById ? labs.find((l) => l.id === lab.unlockedById) : undefined;
  return own && own.type === "TRAINING" && own.neighborhoodId === lab.neighborhoodId ? own : basic;
}

/** Temel yol: temel eğitim ve onun açtığı senaryolar (mahalle rozeti bunu sayar). */
export function isBasicPath(lab: GateLab, labs: readonly GateLab[]) {
  const basic = basicTrainingOf(labs, lab.neighborhoodId);
  if (lab.type === "TRAINING") return basic?.id === lab.id;
  return (gateOf(lab, labs)?.id ?? null) === (basic?.id ?? null);
}

/** Mahallenin rotası: her eğitimin ardından onun açtığı senaryolar; eğitim yoksa yalnız senaryolar. */
export function routeOrder<T extends GateLab>(labs: readonly T[], neighborhoodId: string): T[] {
  const own = labs.filter((lab) => lab.neighborhoodId === neighborhoodId);
  const scenarios = own.filter((lab) => lab.type === "SCENARIO").sort(bySort);
  const trainings = trainingsOf(own, neighborhoodId);
  if (trainings.length === 0) return scenarios;
  return trainings.flatMap((training) => [training, ...scenarios.filter((s) => gateOf(s, own)?.id === training.id)]);
}

/**
 * Ödevin odaları: seçilenler ve onları açan eğitimler (senaryonun eğitimi, ileri eğitimin temeli),
 * rota sırasıyla. Listede olmayan (yayında olmayan ya da başka mahallenin) kimlikler düşer.
 */
export function withGates<T extends GateLab>(ids: readonly string[], labs: readonly T[], neighborhoodId: string): T[] {
  const own = labs.filter((lab) => lab.neighborhoodId === neighborhoodId);
  const picked = new Set(ids.filter((id) => own.some((lab) => lab.id === id)));
  for (const id of [...picked]) {
    for (let gate = gateOf(own.find((lab) => lab.id === id)!, own); gate && !picked.has(gate.id); gate = gateOf(gate, own)) {
      picked.add(gate.id);
    }
  }
  return routeOrder(own, neighborhoodId).filter((lab) => picked.has(lab.id));
}
