// Günün ipucunun sırası (Tur 4, Ipucu-C3-Bugun). Saf fonksiyonlar; veritabanına dokunmaz, birim
// testlidir (tests/unit/tips.test.ts). Sunucu (lib/tips/data.ts) ve yönetim ekranı aynı kuralı
// kullanır.
//
// Kural: havuzdaki ipuçları sırayla döner, en uzun süredir gösterilmeyen önce çıkar (hiç
// gösterilmeyen en önde; eşitlikte önce yazılan). Bir güne sabitlenen ipucu o günü alır; ama
// yalnızca havuzdaysa (taslak ve arşiv öğrenciye gitmez). İleri bir güne sabitlenen ipucu o güne
// kadar sıraya girmez, günü geçince normal sıraya döner. Bugünün ipucu bir kez seçilince
// değişmez (TipDay); yarından sonrası her açılışta yeniden hesaplanır.
//
// Günler "YYYY-AA-GG" biçiminde Türkiye takvim günüdür. Türkiye 2016'dan beri sürekli UTC+3'tür
// (yaz saati yok; lib/classroom/progress.ts weekStart ile aynı varsayım). Veritabanındaki
// @db.Date değeri o günün UTC gece yarısıdır.

export type DayKey = string;
export type TipStatus = "POOL" | "DRAFT" | "ARCHIVED";

const turkeyOffsetMs = 3 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;
const dayPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Verilen andaki Türkiye takvim günü. */
export function turkeyDay(now: Date): DayKey {
  return new Date(now.getTime() + turkeyOffsetMs).toISOString().slice(0, 10);
}

/** Gerçek bir takvim günü mü ("2026-02-30" değil)? */
export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== "string") return false;
  const match = dayPattern.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

/** Günün veritabanı değeri (@db.Date: UTC gece yarısı). */
export function dayToDate(day: DayKey): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** Veritabanındaki @db.Date değerinin günü. */
export function dateToDay(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: DayKey, n: number): DayKey {
  return dateToDay(new Date(dayToDate(day).getTime() + n * dayMs));
}

/** İki gün arasındaki fark (b - a, gün). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((dayToDate(b).getTime() - dayToDate(a).getTime()) / dayMs);
}

/** Haftanın günü: 0 pazar ... 6 cumartesi. */
export function weekdayOf(day: DayKey): number {
  return dayToDate(day).getUTCDay();
}

/** Sıra hesabı için ipucu. */
export type ScheduleTip = {
  id: string;
  status: TipStatus;
  /** Sabitlendiği gün; yoksa null. */
  pinnedDay: DayKey | null;
  /** Yazıldığı an (ms); eşitlikte önce yazılan çıkar. */
  createdAt: number;
  /** En son gösterildiği gün; hiç gösterilmediyse null. */
  lastShown: DayKey | null;
};

export type DayPick = { tipId: string; pinned: boolean };

/** Sıra: hiç gösterilmeyen önce, sonra en uzun süredir gösterilmeyen; eşitlikte önce yazılan. */
function byRotation(a: ScheduleTip, b: ScheduleTip): number {
  if (a.lastShown !== b.lastShown) {
    if (a.lastShown === null) return -1;
    if (b.lastShown === null) return 1;
    return a.lastShown < b.lastShown ? -1 : 1;
  }
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** O günün ipucu: güne sabitlenmiş havuzdaki ipucu, yoksa sırası gelen. Havuz boşsa null. */
export function pickForDay(tips: readonly ScheduleTip[], day: DayKey): DayPick | null {
  const pool = tips.filter((t) => t.status === "POOL");
  const pinned = pool.find((t) => t.pinnedDay === day);
  if (pinned) return { tipId: pinned.id, pinned: true };
  // İleri bir güne ayrılmış ipucu o güne kadar sıraya girmez.
  const next = pool.filter((t) => t.pinnedDay === null || t.pinnedDay < day).sort(byRotation)[0];
  return next ? { tipId: next.id, pinned: false } : null;
}

export type PlannedDay = {
  day: DayKey;
  tipId: string | null;
  /** Güne sabitlenmiş ipucu mu (değilse sırası gelen). */
  pinned: boolean;
};

/**
 * Bugünden başlayarak `count` günün planı. Bugünün ipucu seçildiyse (`fixedToday`) o kalır.
 * Her gün seçilen ipucu "gösterildi" sayılır, böylece sonraki günler sıradakine geçer.
 */
export function planDays(tips: readonly ScheduleTip[], today: DayKey, count: number, fixedToday: string | null = null): PlannedDay[] {
  const state = tips.map((t) => ({ ...t }));
  const plan: PlannedDay[] = [];
  for (let i = 0; i < count; i++) {
    const day = addDays(today, i);
    // Bugünün ipucu seçildiyse durumu sonradan değişse de o gün onundur.
    const pick: DayPick | null =
      i === 0 && fixedToday
        ? { tipId: fixedToday, pinned: state.find((t) => t.id === fixedToday)?.pinnedDay === day }
        : pickForDay(state, day);
    plan.push({ day, tipId: pick?.tipId ?? null, pinned: pick?.pinned ?? false });
    const shown = pick && state.find((t) => t.id === pick.tipId);
    if (shown) shown.lastShown = day;
  }
  return plan;
}
