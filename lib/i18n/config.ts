// Desteklenen diller. Şimdilik yalnızca Türkçe; yeni dil eklemek için
// messages/<dil>.ts dosyası yazılır ve buraya eklenir (ayrıntı: lib/i18n/index.ts).

export const locales = ["tr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "tr";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
