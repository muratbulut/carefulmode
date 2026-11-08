// Okulum haftalık bülteninin saf hesapları (Okulum-O4-Bulten): öğretmenin 5 adımlık kurulumu,
// İyi gidiyor / Yolda / Takıldı / Yeni katıldı işareti, hatırlatmanın türü, ödev yüzdesi, haftalar
// ve bültenin cümleleri. Veritabanına dokunmaz (veriyi lib/school/bulletin.ts toplar); birim testli.
//
// Gizlilik: buradaki her sayı bir toplamdır. Öğrenci adı, puanı ya da raporu hiçbir girdide yoktur.

import { format, getMessages } from "@/lib/i18n";
import type { ReminderKind } from "@/lib/mail/teacher-mail";
import { siteTimeZone } from "@/lib/site";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

// ---------------------------------------------------------------------------------------
// Öğretmenin kurulumu
// ---------------------------------------------------------------------------------------

/** 3. adım "Öğrenciler katıldı": bir sınıfta en az bu kadar öğrenci. */
export const minStudentsJoined = 5;
/** 5. adım "Sınıf bitiriyor": ödevin toplam yüzdesi en az bu kadar (ödevi sınıfın yarısı bitirdi). */
export const finishingPct = 50;
/** Onaydan sonraki bu kadar gün öğretmen "Yeni katıldı"dır; takıldı sayılmaz, hatırlatma gitmez. */
export const freshDays = 7;
/** Aynı öğretmene en fazla günde bir hatırlatma. */
export const reminderCooldownMs = DAY;
/** Ekrandaki "Onayladın" satırı bu kadar gün kalır. */
export const handledDays = 7;

export type SetupStep = 1 | 2 | 3 | 4 | 5;
export type Signal = "good" | "onTrack" | "new" | "stuck";

export type ClassSetup = { members: number; hasAssignment: boolean; pct: number | null };

/**
 * Kurulum adımı (tahtadaki sıra): 1 onaylandı, 2 sınıf kurdu, 3 bir sınıfta en az 5 öğrenci,
 * 4 bir sınıfa ödev verdi, 5 bir sınıf ödevin en az yarısını bitirdi. Ulaşılan en yüksek adım
 * sayılır (öğrencisi 5'ten az bir sınıfa ödev veren 4. adımdadır).
 */
export function setupStep(classes: readonly ClassSetup[]): SetupStep {
  let step: SetupStep = 1;
  if (classes.length > 0) step = 2;
  if (classes.some((c) => c.members >= minStudentsJoined)) step = 3;
  if (classes.some((c) => c.hasAssignment)) step = 4;
  if (classes.some((c) => c.hasAssignment && c.members > 0 && (c.pct ?? 0) >= finishingPct)) step = 5;
  return step;
}

export function isFresh(approvedAt: Date | null, now: Date): boolean {
  return approvedAt !== null && now.getTime() - approvedAt.getTime() < freshDays * DAY;
}

/** İyi gidiyor (5. adım), Yolda (3-4), Yeni katıldı (yeni onaylanan, takıldı yerine), Takıldı. */
export function signalOf(step: SetupStep, fresh: boolean): Signal {
  if (step === 5) return "good";
  if (step >= 3) return "onTrack";
  return fresh ? "new" : "stuck";
}

/** Bültendeki "henüz sınıf kurmadı ya da öğrencisi katılmadı" listesi: takılan öğretmenler. */
export const isStuck = (signal: Signal) => signal === "stuck";

/** Hatırlatma adıma göre: sınıfını kur, kodu paylaş, ilk ödevi ver, ödevi hatırlat. */
export function reminderKindOf(step: SetupStep): ReminderKind | null {
  switch (step) {
    case 1:
      return "createClass";
    case 2:
      return "shareCode";
    case 3:
      return "firstAssignment";
    case 4:
      return "remindAssignment";
    default:
      return null;
  }
}

/** "Hatırlat" kimde çıkar: kurulumu bitmemiş, yeni katılmamış, kendisi olmayan öğretmende. */
export function canRemind(input: { step: SetupStep; fresh: boolean; isMe: boolean }): boolean {
  return input.step < 5 && !input.fresh && !input.isMe;
}

/** Ödevin toplam yüzdesi: üyelerin bitirdiği ödev lablarının toplamı / (üye × lab). */
export function homeworkPct(doneCounts: readonly number[], labCount: number): number {
  if (doneCounts.length === 0 || labCount === 0) return 0;
  const done = doneCounts.reduce((sum, n) => sum + Math.min(n, labCount), 0);
  return Math.round((done / (doneCounts.length * labCount)) * 100);
}

// ---------------------------------------------------------------------------------------
// Haftalar (Türkiye saatiyle pazartesi-pazar)
// ---------------------------------------------------------------------------------------

/** Son `count` haftanın başları, eskiden yeniye; sonuncusu bu hafta. Türkiye'de yaz saati yok. */
export function weekStarts(currentStart: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(currentStart.getTime() - (count - 1 - i) * WEEK));
}

/** Tarihlerin haftalara dağılımı; başlardan önceki ve son haftanın sonrasındaki tarih sayılmaz. */
export function countByWeek(dates: Iterable<Date>, starts: readonly Date[]): number[] {
  const counts = starts.map(() => 0);
  if (starts.length === 0) return counts;
  const first = starts[0].getTime();
  for (const date of dates) {
    const index = Math.floor((date.getTime() - first) / WEEK);
    if (index >= 0 && index < starts.length) counts[index]++;
  }
  return counts;
}

/** Türkiye saatiyle gün, ay (0-11), yıl, saat. */
export function localParts(date: Date) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: siteTimeZone,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(values.find((p) => p.type === type)?.value);
  return { day: get("day"), month: get("month") - 1, year: get("year"), hour: get("hour"), minute: get("minute") };
}

/** ISO hafta numarası (bültenin "41. HAFTA"sı). Haftanın başı Türkiye saatiyle pazartesidir. */
export function isoWeek(start: Date): number {
  const { day, month, year } = localParts(start);
  const date = new Date(Date.UTC(year, month, day));
  // Haftanın perşembesi hangi yıldaysa hafta o yılındır.
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / WEEK);
}

/** "5–11 Ekim 2026", "28 Eylül – 4 Ekim 2026", "29 Aralık 2025 – 4 Ocak 2026". */
export function weekRange(start: Date): string {
  const t = getMessages().school.bulletin;
  const months = getMessages().profile.months;
  const a = localParts(start);
  const b = localParts(new Date(start.getTime() + 6 * DAY));
  if (a.year !== b.year) return format(t.rangeCrossYear, { d1: a.day, m1: months[a.month], y1: a.year, d2: b.day, m2: months[b.month], y2: b.year });
  if (a.month !== b.month) return format(t.rangeCrossMonth, { d1: a.day, m1: months[a.month], d2: b.day, m2: months[b.month], year: b.year });
  return format(t.rangeSameMonth, { d1: a.day, d2: b.day, month: months[a.month], year: a.year });
}

/** Grafikteki hafta adı: "14 Eyl"; son sütun "Bu hafta". */
export function weekLabel(start: Date, current: boolean): string {
  const t = getMessages().school.bulletin;
  if (current) return t.thisWeek;
  const { day, month } = localParts(start);
  return format(t.weekLabel, { day, month: t.monthsShort[month] });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Bugün 21:12", "Dün 14:30", "3 Ekim" (Türkiye saatiyle). */
export function whenText(date: Date, now: Date): string {
  const t = getMessages().school.when;
  const d = localParts(date);
  const today = localParts(now);
  const time = `${pad(d.hour)}:${pad(d.minute)}`;
  const dayIndex = (p: { year: number; month: number; day: number }) => Date.UTC(p.year, p.month, p.day) / DAY;
  const diff = dayIndex(today) - dayIndex(d);
  if (diff === 0) return format(t.today, { time });
  if (diff === 1) return format(t.yesterday, { time });
  return format(t.date, { day: d.day, month: getMessages().profile.months[d.month] });
}

/** Ödevin son günü: "17 Ekim'e kadar". */
export function dueText(date: Date): string {
  const t = getMessages().school;
  const { day, month } = localParts(date);
  return format(t.classCard.due, { day, month: t.monthsUntil[month] });
}

// ---------------------------------------------------------------------------------------
// Bültenin cümleleri
// ---------------------------------------------------------------------------------------

/** "Ahmet", "Ahmet ve Nur", "Ahmet, Nur ve Emre", "Ahmet, Nur ve 3 öğretmen daha". */
export function joinNames(names: readonly string[], max = 3): string {
  const t = getMessages().school.bulletin;
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length > max) {
    const shown = names.slice(0, max - 1);
    return format(t.namesMore, { names: shown.join(", "), n: names.length - shown.length });
  }
  return format(t.namesAnd, { names: names.slice(0, -1).join(", "), last: names[names.length - 1] });
}

export type BulletinFacts = {
  thisWeek: number;
  lastWeek: number;
  classCount: number;
  /** Ödevi olan sınıflar, yüzde sırasıyla: ad, mahalle adı, yüzde. */
  homework: { className: string; topic: string; pct: number }[];
  /** Takılan öğretmenlerin adları (sorumlunun kendisi ve yeni katılanlar hariç). */
  stuckTeachers: string[];
  /** Henüz sınıfını kurmamış ama yeni katıldığı için takılmış sayılmayan öğretmen sayısı. */
  newTeachers: number;
  teacherCount: number;
  /** Sorumlunun görüşünü bekleyen talepler. */
  pendingRequests: number;
  coordinatorApproves: boolean;
};

export type Trend = { tone: "up" | "down" | "same"; text: string };

/** Grafiğin üstündeki "+8 geçen haftaya göre". */
export function trendOf(thisWeek: number, lastWeek: number): Trend {
  const t = getMessages().school.bulletin.trend;
  const diff = thisWeek - lastWeek;
  if (diff > 0) return { tone: "up", text: format(t.up, { n: diff }) };
  if (diff < 0) return { tone: "down", text: format(t.down, { n: -diff }) };
  return { tone: "same", text: t.same };
}

/** Bültenin dört cümlesi: lablar, ödevler, öğretmenler, talepler. */
export function bulletinSentences(facts: BulletinFacts) {
  const t = getMessages().school.bulletin.sentences;
  const diff = facts.thisWeek - facts.lastWeek;
  let labs: string;
  if (facts.thisWeek === 0) labs = facts.lastWeek === 0 ? t.labsNone : format(t.labsNoneThisWeek, { last: facts.lastWeek });
  else if (facts.lastWeek === 0) labs = format(t.labsFirst, { n: facts.thisWeek });
  else if (diff > 0) labs = format(t.labsMore, { n: facts.thisWeek, diff });
  else if (diff < 0) labs = format(t.labsLess, { n: facts.thisWeek, diff: -diff });
  else labs = format(t.labsSame, { n: facts.thisWeek });

  let homework: string;
  if (facts.classCount === 0) homework = t.homeworkNoClass;
  else if (facts.homework.length === 0) homework = t.homeworkNone;
  else {
    const shown = facts.homework.slice(0, 3).map((h) => format(t.homeworkItem, { name: h.className, topic: h.topic, pct: h.pct }));
    const rest = facts.homework.length - shown.length;
    homework = format(rest > 0 ? t.homeworkListMore : t.homeworkList, { list: shown.join(", "), n: rest });
  }

  let teachers: string;
  if (facts.teacherCount === 0) teachers = t.teachersNone;
  else if (facts.stuckTeachers.length === 0) teachers = facts.newTeachers > 0 ? t.teachersNewOnly : t.teachersAllSet;
  else teachers = format(t.teachersStuck, { names: joinNames(facts.stuckTeachers) });

  const requests =
    facts.pendingRequests === 0
      ? t.requestsNone
      : format(facts.coordinatorApproves ? t.requestsWaiting : t.requestsOpinion, { n: facts.pendingRequests });

  return { labs, homework, teachers, requests };
}

export type BulletinSentences = ReturnType<typeof bulletinSentences>;

/**
 * "Müdüre gönder": site rastgele adrese mail göndermez; sorumlunun kendi mail uygulaması bültenin
 * kısa düz metin özetiyle açılır (alıcıyı kendisi yazar). Öğrenci adı yoktur.
 */
export function principalMailto(input: {
  school: string;
  week: number;
  range: string;
  preparedBy: string;
  counts: { teachers: number; classes: number; students: number; weekDone: number };
  sentences: BulletinSentences;
}): string {
  const t = getMessages().school.principal;
  const subject = format(t.subject, { school: input.school, range: input.range });
  const body = [
    format(t.heading, { week: input.week }),
    input.school,
    input.range,
    "",
    format(t.counts, input.counts),
    "",
    ...Object.values(input.sentences).map((s) => `- ${s}`),
    "",
    format(t.preparedBy, { name: input.preparedBy }),
    t.privacy,
  ].join("\r\n");
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
