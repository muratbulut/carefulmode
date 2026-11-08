// Gündemde gösterilen tarihler: Türkiye saatiyle, ay adları sözlükten. Sunucuda hesaplanıp hazır
// metin olarak gönderilir (tarayıcının saat dilimi farklı olsa da aynı kalır).

import { getMessages } from "@/lib/i18n";
import { siteTimeZone } from "@/lib/site";

const partsFormat = new Intl.DateTimeFormat("en-US", { timeZone: siteTimeZone, day: "numeric", month: "numeric", year: "numeric" });

function parts(date: Date) {
  const values = partsFormat.formatToParts(date);
  const get = (type: string) => Number(values.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month") - 1, year: get("year") };
}

const months = () => getMessages().profile.months;

/** "9 Ekim" */
export function dayMonthText(date: Date) {
  const { day, month } = parts(date);
  return `${day} ${months()[month]}`;
}

/** "9 Ekim 2026" */
export function fullDateText(date: Date) {
  const { day, month, year } = parts(date);
  return `${day} ${months()[month]} ${year}`;
}

/** "Ekim 2026" */
export function monthYearText(date: Date) {
  const { month, year } = parts(date);
  return `${months()[month]} ${year}`;
}

/**
 * "En çok okunan" kutusunun ayı (4 Kasım, 15): ayın ilk 7 gününde bu ayın okuması henüz azdır,
 * o zaman geçen ayın en çok okunanı görünür. Türkiye saatiyle.
 */
export function mostReadMonth(now: Date): { year: number; month: number; current: boolean } {
  const { day, month, year } = parts(now);
  if (day > 7) return { year, month, current: true };
  return month === 0 ? { year: year - 1, month: 11, current: false } : { year, month: month - 1, current: false };
}

/**
 * Seçilen ayda yayınlanmış, en az bir kez okunmuş haberlerden en çok okunanı (eşitlikte en
 * yenisi; liste en yenisi önce gelir). Hiç yoksa null. Yalnızca toplam sayı, kişi yok.
 */
export function mostReadOf<T extends { publishedAt: Date; readCount: number }>(articles: T[], now: Date): { article: T; current: boolean } | null {
  const target = mostReadMonth(now);
  let best: T | null = null;
  for (const article of articles) {
    const p = parts(article.publishedAt);
    if (p.year !== target.year || p.month !== target.month || article.readCount < 1) continue;
    if (!best || article.readCount > best.readCount) best = article;
  }
  return best ? { article: best, current: target.current } : null;
}
