// Günün ipucu formunun kuralları (Tur 4, 24): ipucu 20-140 karakter, "Neden?" en az 20 karakter
// (tahtadaki sayaç 400'e kadar sayar). Sabitlenen gün yarından itibaren seçilir; bugünün ipucu
// değiştirilemez. Hem formda (sayaç ve uyarılar) hem sunucu eyleminde aynı kurallar geçerlidir.

import { addDays, daysBetween, isDayKey, type DayKey } from "./schedule";

export const tipLimits = { textMin: 20, textMax: 140, reasonMin: 20, reasonMax: 400 } as const;

/** Sabitlenebilecek en uzak gün (bugünden sonra). */
export const pinHorizonDays = 366;
/** Formdaki gün listesi: yarından başlayarak bu kadar gün (Ipucu-C3-Bugun), sonra "Başka bir gün". */
export const quickPickDays = 13;
/** Havuz tablosundaki "sıradaki gün" sütunu bu kadar günü hesaplar ("14 gün içinde sırası yok"). */
export const planLength = 14;
/** "Sıradaki 6 gün" şeridi. */
export const stripDays = 6;

/** Boşluklar teke indirilir (ipucu kartta tek paragraftır). */
export function normalizeTipText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export type TextError = "textShort" | "textLong";
export type ReasonError = "reasonShort" | "reasonLong";

export function textError(text: string): TextError | null {
  const n = normalizeTipText(text).length;
  if (n < tipLimits.textMin) return "textShort";
  if (n > tipLimits.textMax) return "textLong";
  return null;
}

export function reasonError(reason: string): ReasonError | null {
  const n = normalizeTipText(reason).length;
  if (n < tipLimits.reasonMin) return "reasonShort";
  if (n > tipLimits.reasonMax) return "reasonLong";
  return null;
}

export type PinDayError = "dayInvalid" | "dayPast" | "dayFar";

/** Sabitlenecek gün uygun mu: gerçek bir gün, yarın ya da sonrası, en fazla bir yıl ileride. */
export function pinDayError(day: unknown, today: DayKey): PinDayError | null {
  if (!isDayKey(day)) return "dayInvalid";
  const ahead = daysBetween(today, day);
  if (ahead < 1) return "dayPast";
  if (ahead > pinHorizonDays) return "dayFar";
  return null;
}

/** Formdaki tarih kutusunun sınırları. */
export function pinRange(today: DayKey): { min: DayKey; max: DayKey } {
  return { min: addDays(today, 1), max: addDays(today, pinHorizonDays) };
}
