// Arayüz metinlerine tek giriş noktası.
//
// Bileşenler metni sözlükten okur: const t = getMessages(); ... {t.nav.more}
// Şimdilik tek dil (Türkçe) var ve sayfalar statik kalır. İkinci dil eklenince dil adresten
// gelecek (ör. /en/...); o zaman getMessages(locale) dilin sayfalara iletildiği yerden çağrılır.
// Sayfa adresleri Türkçe kalır.

import { defaultLocale, type Locale } from "./config";
import { tr, type Messages } from "./messages/tr";

export { defaultLocale, isLocale, locales, type Locale } from "./config";
export type { Messages } from "./messages/tr";
export { rich } from "./rich";

const dictionaries: Record<Locale, Messages> = { tr };

export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale];
}

/** "{ad}" yer tutucularını doldurur. Değeri verilmeyen yer tutucu olduğu gibi kalır, böylece gözden kaçmaz. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole));
}
