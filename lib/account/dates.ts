// Profilde gösterilen tarihler. Sunucuda hesaplanıp hazır metin olarak gönderilir; böylece
// tarayıcının saat dilimi farklı olsa da sunucu çıktısıyla aynı kalır.

import { format, getMessages } from "@/lib/i18n";
import { siteTimeZone } from "@/lib/site";

function parts(date: Date) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: siteTimeZone,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(values.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month") - 1, year: get("year") };
}

/** "Üyelik: Ekim 2026" */
export function memberSince(createdAt: Date) {
  const t = getMessages().profile;
  const { month, year } = parts(createdAt);
  return format(t.memberSince, { month: t.months[month], year });
}

/** "17 Ekim'de" */
export function dayOn(date: Date) {
  const { day, month } = parts(date);
  return `${day} ${getMessages().profile.monthsOn[month]}`;
}

/** "3 gün önce", "5 dakika önce"; bir dakikadan yeniyse null (ekranda "şu an"). */
export function timeAgo(date: Date, now = new Date()) {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return null;
  const rtf = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60 * 60 * 24 * 365, "year"],
    [60 * 60 * 24 * 30, "month"],
    [60 * 60 * 24 * 7, "week"],
    [60 * 60 * 24, "day"],
    [60 * 60, "hour"],
    [60, "minute"],
  ];
  const [size, unit] = steps.find(([s]) => seconds >= s)!;
  return rtf.format(-Math.floor(seconds / size), unit);
}

/** "2 Ekim" (lab detayı, raporlar, lab istatistikleri) */
export function dayMonth(date: Date) {
  const { day, month } = parts(date);
  return `${day} ${getMessages().profile.months[month]}`;
}

/** "7 Kasım, 21:14" (ana sayfadaki "Son girişin" şeridi) */
export function dayAndTime(date: Date) {
  const { day, month } = parts(date);
  const time = new Intl.DateTimeFormat("tr-TR", { timeZone: siteTimeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  return `${day} ${getMessages().profile.months[month]}, ${time}`;
}
