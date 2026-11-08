// İl ve ilçe listesi (lib/school/places-data.ts) üzerindeki yardımcılar. Formlardan gelen il ve
// ilçe her zaman bu listeye göre denetlenir.

import { provinces } from "./places-data";

export { provinces };

const byName = new Map(provinces.map((p) => [p.name, new Set(p.districts)]));

export const provinceNames: readonly string[] = provinces.map((p) => p.name);

export function districtsOf(province: string): readonly string[] {
  return provinces.find((p) => p.name === province)?.districts ?? [];
}

/** İl ve ilçe listede var mı (ilçe o ilin ilçesi mi). */
export function isPlace(province: unknown, district: unknown): province is string {
  return typeof province === "string" && typeof district === "string" && (byName.get(province)?.has(district) ?? false);
}
