// Ödevin odaları (15 Ekim, Murat): öğretmen mahalleden odaları tek tek seçer; seçilen senaryoyu
// ya da ileri eğitimi açan eğitim kendiliğinden ödeve girer, yoksa öğrenci odayı açamaz. Oda seçimi
// gelmeden verilen ödevlerde liste boştur: mahallenin yayındaki bütün odaları. Öğretmen ekranı,
// öğrencinin ödev kutusu, okul bülteni ve yönetim aynı hesabı buradan kullanır. Saf hesap.

import { routeOrder, withGates, type GateLab } from "@/lib/lab/gates";

export type AssignmentLabs = { neighborhoodId: string; labIds: readonly string[] };

/** Ödevin yayındaki odaları, rota sırasıyla. labs: yayındaki lablar (hepsi ya da mahalleninkiler). */
export function homeworkLabs<T extends GateLab>(assignment: AssignmentLabs, labs: readonly T[]): T[] {
  return assignment.labIds.length === 0
    ? routeOrder(labs, assignment.neighborhoodId)
    : withGates(assignment.labIds, labs, assignment.neighborhoodId);
}

/**
 * Öğretmenin seçimini kaydedilecek listeye çevirir: yayındaki odalar ve onları açan eğitimler,
 * rota sırasıyla. Seçimde yayında olmayan ya da başka mahallenin odası varsa null (geçersiz).
 */
export function homeworkSelection<T extends GateLab>(neighborhoodId: string, picked: readonly string[], labs: readonly T[]): string[] | null {
  const own = new Set(labs.filter((lab) => lab.neighborhoodId === neighborhoodId).map((lab) => lab.id));
  if (picked.length === 0 || picked.some((id) => !own.has(id))) return null;
  return withGates(picked, labs, neighborhoodId).map((lab) => lab.id);
}
