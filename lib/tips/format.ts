// Günlerin ekrandaki adı: "14 Ekim", "Çarşamba". Gün anahtarından ("2026-10-14") hesaplanır;
// tarayıcının saat dilimi farklı olsa da sunucu çıktısıyla aynıdır.

import { format, getMessages } from "@/lib/i18n";
import { weekdayOf, type DayKey } from "./schedule";

/** "14 Ekim" */
export function dayLabel(day: DayKey): string {
  const t = getMessages();
  const [, month, date] = day.split("-").map(Number);
  return format(t.tips.dayMonth, { day: date, month: t.profile.months[month - 1] });
}

/** "Çarşamba" */
export function weekdayLabel(day: DayKey): string {
  return getMessages().tips.weekdays[weekdayOf(day)];
}
