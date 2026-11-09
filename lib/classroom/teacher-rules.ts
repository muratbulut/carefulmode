// Öğretmen ekranlarının saf kuralları (Sınıflarım, sınıf detayı, tahtaya yansıt). Veritabanına
// dokunmaz, tarayıcıda da çalışır: ödev sayımları, son tarih, "Dikkat isteyenler", tahtada
// görünen ad, arama ve QR kodunun taşınması.
//
// Gizlilik: buradaki sayılar sınıfın toplamıdır. Öğrenci başına yalnızca bitirdi / bitirmedi
// bilgisi kullanılır; tuzağı fark edenlerin yüzdesi en az minFinishedForRate öğrenci bitirince
// çıkar ve bitirenlerin o büyüklükteki gruplarıyla güncellenir (groupedNoticeRates).

import { minFinishedForRate } from "./rules";

const dayMs = 24 * 60 * 60 * 1000;
// Türkiye UTC+3, yaz saati yok (lib/classroom/progress.ts weekStart ile aynı varsayım).
const turkeyOffsetMs = 3 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------
// Tarihler (Türkiye takvimi)
// ---------------------------------------------------------------------------------------

/** Türkiye takvimindeki gün numarası (1970'ten beri gün). */
export function turkeyDay(date: Date): number {
  return Math.floor((date.getTime() + turkeyOffsetMs) / dayMs);
}

const isoDay = (day: number) => new Date(day * dayMs).toISOString().slice(0, 10);

/** Tarihin Türkiye'deki günü ve ayı (0-11): "17 Ekim'e kadar" gibi metinler için. */
export function turkeyDate(date: Date): { day: number; month: number } {
  const d = new Date(turkeyDay(date) * dayMs);
  return { day: d.getUTCDate(), month: d.getUTCMonth() };
}

/** Son tarih en fazla bu kadar gün sonrası olabilir. */
export const maxDueDays = 365;

/** Tarih kutusunun değeri ("YYYY-AA-GG", Türkiye günü). */
export function toDateInput(date: Date): string {
  return isoDay(turkeyDay(date));
}

/** Tarih kutusunun alt ve üst sınırı: bugün ve bir yıl sonrası. */
export function dueBounds(now: Date): { min: string; max: string } {
  const today = turkeyDay(now);
  return { min: isoDay(today), max: isoDay(today + maxDueDays) };
}

export type DueParse = { ok: true; date: Date | null } | { ok: false };

/**
 * Ödevin son tarihi: boşsa son tarih yoktur. Bugünden önce ya da bir yıldan sonra olamaz. O günün
 * sonu (Türkiye saatiyle 23.59) olarak saklanır; öğrenci son gün de bitirebilsin.
 */
export function parseDueDate(value: string, now: Date): DueParse {
  const text = value.trim();
  if (!text) return { ok: true, date: null };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return { ok: false };
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return { ok: false };
  const dayNumber = utc / dayMs;
  const today = turkeyDay(now);
  if (dayNumber < today || dayNumber > today + maxDueDays) return { ok: false };
  return { ok: true, date: new Date((dayNumber + 1) * dayMs - turkeyOffsetMs - 1) };
}

/** Son tarihe kalan gün (Türkiye takvimi): 0 bugün son gün, eksi değer geçti. */
export function daysLeft(due: Date, now: Date): number {
  return turkeyDay(due) - turkeyDay(now);
}

// ---------------------------------------------------------------------------------------
// Sayımlar
// ---------------------------------------------------------------------------------------

export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

export type StudentStatus = "finished" | "inProgress" | "notStarted";

/** Öğrencinin ödevdeki durumu: bütün labları bitirdi, bir kısmını bitirdi, hiç başlamadı. */
export function studentStatus(done: number, total: number): StudentStatus {
  if (total > 0 && done >= total) return "finished";
  return done > 0 ? "inProgress" : "notStarted";
}

export type HomeworkTotals = {
  /** Öğrenci × lab çiftlerinden bitenlerin yüzdesi (Sınıflarım kartı ve ödev bandı). */
  pct: number;
  finished: number;
  inProgress: number;
  notStarted: number;
};

/** Sınıfın ödevdeki toplamı. `doneCounts`: her öğrencinin ödevde bitirdiği lab sayısı. */
export function homeworkTotals(doneCounts: readonly number[], labCount: number): HomeworkTotals {
  const totals: HomeworkTotals = { pct: 0, finished: 0, inProgress: 0, notStarted: 0 };
  let pairs = 0;
  for (const done of doneCounts) {
    pairs += Math.min(done, labCount);
    totals[studentStatus(done, labCount)]++;
  }
  totals.pct = percent(pairs, doneCounts.length * labCount);
  return totals;
}

/** Tuzağı fark edenlerin yüzdesi: en az minFinishedForRate öğrenci bitirince; daha azsa null. */
export function noticeRate(finishers: number, noticed: number): number | null {
  return finishers >= minFinishedForRate ? percent(noticed, finishers) : null;
}

/**
 * Senaryo labını bitiren bir öğrenci: ilk bitirdiği an ve tuzağı fark edip etmediği (raporu
 * "Güvende kaldın"), ilk biten denemesinde (first) ve son biten denemesinde (last).
 */
export type LabFinish = { userId: string; doneAt: Date; first: boolean; last: boolean };

/**
 * Sınıfta tuzağı fark edenlerin yüzdesi (ilk seferde ve tekrar sonrası), bitirenlerin
 * minFinishedForRate'lik (5) gruplarıyla: ilk bitiren 5, 10, 15... öğrenci sayılır; yeni bitiren
 * sonraki grup dolana kadar sayıya girmez. Her bitirende güncellenseydi yeni bitiren tek öğrencinin
 * sonucu oranın değişiminden okunurdu (5 kişide %60 iken 6. bitirince %50 olduysa 6. öğrenci
 * fark etmemiştir); öğretmen kimin bitirdiğini zaten görür. "Tekrar sonrası" sayılan öğrenciler
 * labı tekrar yaptıkça değişir; kimin tekrar yaptığı görünmez.
 */
export function groupedNoticeRates(finishes: readonly LabFinish[]): { first: number; last: number } | null {
  const counted = finishes.length - (finishes.length % minFinishedForRate);
  if (counted === 0) return null;
  const group = [...finishes]
    .sort((a, b) => a.doneAt.getTime() - b.doneAt.getTime() || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))
    .slice(0, counted);
  return {
    first: noticeRate(counted, group.filter((f) => f.first).length)!,
    last: noticeRate(counted, group.filter((f) => f.last).length)!,
  };
}

// ---------------------------------------------------------------------------------------
// Dikkat isteyenler (Sınıflarım): sınıfın toplamından çıkar, öğrenci adı ya da puanı yok
// ---------------------------------------------------------------------------------------

export const attentionRules = {
  /** Son tarihe bu kadar gün (ya da daha az) kalmışsa ve tamamlanma düşükse. */
  dueSoonDays: 3,
  dueSoonBelowPct: 50,
  /** Ödevdeki bir senaryo labında tuzağı ilk seferde fark edenler bunun altındaysa "zor geçiyor". */
  hardLabBelowRate: 50,
  /** Ödeve başlamayanlar sınıfın en az bu kadarıysa (ödev verildikten graceDays gün sonra). */
  notStartedShare: 0.25,
  /** Yeni sınıfa ve yeni ödeve tanınan süre (gün): hemen "dikkat" denmez. */
  graceDays: 2,
} as const;

export type AttentionInput = {
  members: number;
  createdAt: Date;
  homework: {
    createdAt: Date;
    dueDate: Date | null;
    totals: HomeworkTotals;
    /** Ödevdeki labların ilk seferde fark eden yüzdesi (eğitim labında ve az bitirende null). */
    labs: { name: string; firstRate: number | null }[];
  } | null;
};

export type Attention =
  | { kind: "overdue"; count: number }
  | { kind: "dueToday"; finished: number; members: number }
  | { kind: "dueSoon"; days: number; finished: number; members: number }
  | { kind: "hardLab"; lab: string; rate: number }
  | { kind: "notStarted"; count: number }
  | { kind: "noHomework"; count: number }
  | { kind: "noStudents" };

/** Listede önce en acil olan: son tarih, zor lab, başlamayanlar, ödev yok, öğrenci yok. */
export const attentionOrder: readonly Attention["kind"][] = ["overdue", "dueToday", "dueSoon", "hardLab", "notStarted", "noHomework", "noStudents"];

/** Sınıf dikkat istiyor mu? Her sınıf için en acil tek madde döner; sorun yoksa null. */
export function attentionFor(input: AttentionInput, now: Date): Attention | null {
  const ageDays = (date: Date) => (now.getTime() - date.getTime()) / dayMs;
  const { members, homework } = input;
  if (members === 0) return ageDays(input.createdAt) >= attentionRules.graceDays ? { kind: "noStudents" } : null;
  if (!homework) return { kind: "noHomework", count: members };

  const { totals } = homework;
  const unfinished = members - totals.finished;
  if (homework.dueDate && unfinished > 0) {
    const left = daysLeft(homework.dueDate, now);
    if (left < 0) return { kind: "overdue", count: unfinished };
    if (left <= attentionRules.dueSoonDays && totals.pct < attentionRules.dueSoonBelowPct) {
      const done = { finished: totals.finished, members };
      return left === 0 ? { kind: "dueToday", ...done } : { kind: "dueSoon", days: left, ...done };
    }
  }
  const hardest = homework.labs
    .filter((lab): lab is { name: string; firstRate: number } => lab.firstRate !== null && lab.firstRate < attentionRules.hardLabBelowRate)
    .sort((a, b) => a.firstRate - b.firstRate)[0];
  if (hardest) return { kind: "hardLab", lab: hardest.name, rate: hardest.firstRate };
  if (
    ageDays(homework.createdAt) >= attentionRules.graceDays &&
    totals.notStarted > 0 &&
    totals.notStarted >= members * attentionRules.notStartedShare
  ) {
    return { kind: "notStarted", count: totals.notStarted };
  }
  return null;
}

// ---------------------------------------------------------------------------------------
// Adlar ve arama
// ---------------------------------------------------------------------------------------

/** Tahtada görünen ad: "Ayşe Yılmaz" → "Ayşe Y."; tek kelimeyse olduğu gibi. */
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words[0] ?? "";
  const initial = [...words[words.length - 1]][0] ?? "";
  return `${words[0]} ${initial.toLocaleUpperCase("tr")}.`;
}

/** Avatar yerine adın ilk harfi. */
export function initialOf(name: string): string {
  return ([...name.trim()][0] ?? "").toLocaleUpperCase("tr");
}

/** Öğrenci araması: büyük-küçük harf ve Türkçe İ/ı farkı gözetmez. */
export function matchesSearch(name: string, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("tr");
  return !q || name.toLocaleLowerCase("tr").includes(q);
}

// ---------------------------------------------------------------------------------------
// QR kodu: sunucuda üretilir, tarayıcıya modüller sıkıştırılmış gider, tarayıcıda çizilir
// ---------------------------------------------------------------------------------------

/** QR modülleri: kenar uzunluğu ve satır satır bitler (base64). */
export type QrData = { size: number; bits: string };

export function packQr(size: number, modules: ArrayLike<number>): QrData {
  const bytes = new Uint8Array(Math.ceil((size * size) / 8));
  for (let i = 0; i < size * size; i++) if (modules[i]) bytes[i >> 3] |= 0x80 >> (i & 7);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { size, bits: btoa(binary) };
}

export function unpackQr(qr: QrData): boolean[] {
  const binary = atob(qr.bits);
  return Array.from({ length: qr.size * qr.size }, (_, i) => ((binary.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1) === 1);
}

/** Koyu modüllerin SVG yolu; yan yana modüller tek dikdörtgen olur (viewBox 0 0 size size). */
export function qrPath(qr: QrData): string {
  const dark = unpackQr(qr);
  const parts: string[] = [];
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (!dark[y * qr.size + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < qr.size && dark[y * qr.size + x]) x++;
      parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
    }
  }
  return parts.join("");
}
