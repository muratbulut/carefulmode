// Sınıf kuralları (saf; tarayıcıda da kullanılır): sınıf adı, düzey, sınıf kodu.

/** Sınıf adı 2-30 karakter (Siniflarim-Son, "Yeni sınıf" penceresi). */
export const classNameLimits = { min: 2, max: 30 } as const;

/** Düzey kodları; adları sözlükte (classroom.levels). Kayıtta kod tutulur. */
export const classLevels = ["5", "6", "7", "8", "9", "10", "11", "12", "mixed"] as const;
export type ClassLevel = (typeof classLevels)[number];
export const isClassLevel = (value: unknown): value is ClassLevel => typeof value === "string" && (classLevels as readonly string[]).includes(value);

/**
 * Sınıf kodu: 6 karakter, büyük harf ve rakam. Birbirine benzeyen karakterler (0/O, 1/I) yoktur;
 * tahtadan okunup yazılırken karışmasın.
 */
export const joinCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const joinCodeLength = 6;

export function cleanClassName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function classNameOk(value: string): boolean {
  const name = cleanClassName(value);
  return name.length >= classNameLimits.min && name.length <= classNameLimits.max;
}

/** Yazılan kodu karşılaştırılabilir hale getirir: boşluk ve tire atılır, büyük harfe çevrilir. */
export function normalizeJoinCode(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function isJoinCode(value: string): boolean {
  return value.length === joinCodeLength && [...value].every((ch) => joinCodeAlphabet.includes(ch));
}

/** Rastgele sınıf kodu (sunucuda; çakışırsa çağıran yeniden dener). */
export function generateJoinCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  // 256, 32'nin katı: bayt % 32 eşit dağılır.
  return [...random(joinCodeLength)].map((b) => joinCodeAlphabet[b % joinCodeAlphabet.length]).join("");
}

/** Sınıf toplamındaki oranlar (güvende kalma) en az bu kadar öğrenci bitirince görünür (Tur 3). */
export const minFinishedForRate = 5;
