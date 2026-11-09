// Kullanıcılar sayfasının saf kuralları (Kullanicilar-Son): öğrencinin kısa adı ("Ad S."),
// arama, adresteki görünüm ve sekme, tarih metinleri, son 4 haftanın takvimi, kurulum hunisi,
// öğretmenin ipucu ve "Öğretmenlikten çıkar"ın geri al süresi. Veritabanına dokunmaz (veriyi
// lib/admin/users.ts toplar); hem sunucuda hem tarayıcıda çalışır, birim testlidir.

import type { TeacherHint } from "@/components/school/types";
import { format, getMessages } from "@/lib/i18n";
import { paths } from "@/lib/navigation";
import { freshDays, minStudentsJoined, type SetupStep } from "@/lib/school/bulletin-model";

const DAY = 24 * 60 * 60 * 1000;
/** Türkiye UTC+3; yaz saati yok (lib/classroom/progress.ts weekStart ile aynı varsayım). */
const TURKEY_OFFSET = 3 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------
// Öğrencinin adı
// ---------------------------------------------------------------------------------------

/**
 * Öğrencinin yönetimde görünen adı: adı ve soyadının baş harfi ("Ayşe Yılmaz" → "Ayşe Y.").
 * Tek kelimelik ad olduğu gibi kalır. Ortadaki adlar yazılmaz ("Mert Can Kaya" → "Mert K.").
 * Baş harf Türkçe kuralla büyür ("ince" → "İ.", "ılgın" → "I.").
 */
export function shortName(displayName: string): string {
  const words = displayName.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  const initial = Array.from(words[words.length - 1])[0];
  return `${words[0]} ${initial.toLocaleUpperCase("tr")}.`;
}

/**
 * Öğrencinin e-postası, aramada: yerel kısmın ilk iki harfi ve alan adı ("kerem.t@okulmail.com" →
 * "ke•••@okulmail.com"). Adres bozuksa yalnızca "•••".
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = Array.from(email.slice(0, at));
  return `${local.slice(0, local.length > 2 ? 2 : 1).join("")}•••${email.slice(at)}`;
}

/**
 * Kişi aramalarında (ekibe ekle, okul sorumlusu) görünen ad ve e-posta. Öğrenci hesabının (18
 * yaşından küçük olabilecek öğrenci; access.ts isStudentAccount) tam soyadı ve e-postası yönetimde
 * görünmez (öğrenci profiliyle aynı kural): ad "Ad S." olur, e-posta yalnızca yönetici adresin
 * tamamını yazdıysa açık, yoksa maskeli. Öğretmen, yetişkin üye ve yönetici olduğu gibi.
 * `typedEmail` aranan metnin küçük harfli halidir (typedEmailOf).
 */
export function personShown(person: { displayName: string; email: string }, studentAccount: boolean, typedEmail: string): { name: string; email: string } {
  if (!studentAccount) return { name: person.displayName, email: person.email };
  return { name: shortName(person.displayName), email: person.email.toLowerCase() === typedEmail ? person.email : maskEmail(person.email) };
}

/** Kişi aramasında yazılan metin e-posta adresiyse küçük harfli hali, değilse boş (hiçbir adresle eşleşmez). */
export function typedEmailOf(query: string): string {
  const value = query.trim().toLowerCase();
  return value.includes("@") && value.length <= 254 ? value : "";
}

/** Aramada büyük-küçük harf ve ı/i ayrımı yapılmaz ("IŞIK", "ışık", "işik" aynı). */
export function searchKey(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
}

/** Aramanın SQL LIKE kalıbı: "%...%"; % _ \ harf olarak aranır. */
export function likePattern(query: string): string {
  return `%${searchKey(query).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Bir öğretmenin aramayla eşleşmesi: ad, okul ya da branş. */
export function matchesTeacher(query: string, teacher: { name: string; school: string | null; subject: string }): boolean {
  const key = searchKey(query);
  if (!key) return true;
  return searchKey(`${teacher.name} ${teacher.school ?? ""} ${teacher.subject}`).includes(key);
}

/** Bir okulun aramayla eşleşmesi: ad, il ya da ilçe. */
export function matchesSchool(query: string, school: { name: string; province: string; district: string }): boolean {
  const key = searchKey(query);
  if (!key) return true;
  return searchKey(`${school.name} ${school.province} ${school.district}`).includes(key);
}

// ---------------------------------------------------------------------------------------
// Adres: görünüm, sekme, arama, sayfa, açık çekmece
// ---------------------------------------------------------------------------------------

/** Adresteki değerler (E2b'nin testleri de bunlara dayanır; değiştirme). */
export const usersParams = {
  view: "gorunum",
  tab: "sekme",
  search: "ara",
  page: "sayfa",
  student: "ogrenci",
  teacher: "ogretmen",
} as const;

export const userViews = ["genel", "okullar"] as const;
export type UserView = (typeof userViews)[number];
export const userTabs = ["ogrenciler", "ogretmenler", "ekip"] as const;
export type UserTab = (typeof userTabs)[number];

export type UsersQuery = {
  view: UserView;
  tab: UserTab;
  search: string;
  page: number;
  student: string | null;
  teacher: string | null;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const isId = (value: string | undefined): value is string => !!value && /^[A-Za-z0-9_-]{1,64}$/.test(value);

/** Adresi okur; bilinmeyen değer varsayılana döner (Genel, Öğrenciler, 1. sayfa). */
export function parseUsersQuery(params: RawParams): UsersQuery {
  const view = first(params[usersParams.view]);
  const tab = first(params[usersParams.tab]);
  const page = Number.parseInt(first(params[usersParams.page]) ?? "", 10);
  const student = first(params[usersParams.student]);
  const teacher = first(params[usersParams.teacher]);
  return {
    view: (userViews as readonly string[]).includes(view ?? "") ? (view as UserView) : "genel",
    tab: (userTabs as readonly string[]).includes(tab ?? "") ? (tab as UserTab) : "ogrenciler",
    search: (first(params[usersParams.search]) ?? "").slice(0, 80),
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 10_000) : 1,
    student: isId(student) ? student : null,
    teacher: isId(teacher) ? teacher : null,
  };
}

/** Sayfanın adresi: varsayılan değerler adrese yazılmaz (Genel, Öğrenciler, 1. sayfa). */
export function usersHref(query: Partial<UsersQuery>): string {
  const params = new URLSearchParams();
  if (query.view && query.view !== "genel") params.set(usersParams.view, query.view);
  if (query.view !== "okullar" && query.tab && query.tab !== "ogrenciler") params.set(usersParams.tab, query.tab);
  if (query.search) params.set(usersParams.search, query.search);
  if (query.page && query.page > 1) params.set(usersParams.page, String(query.page));
  if (query.student) params.set(usersParams.student, query.student);
  if (query.teacher) params.set(usersParams.teacher, query.teacher);
  const search = params.toString();
  return search ? `${paths.adminUsers}?${search}` : paths.adminUsers;
}

/** Bir sayfada kaç satır: öğrenci ve öğretmen 25, okul kartı 20. */
export const pageSizes = { students: 25, teachers: 25, schools: 20 } as const;

export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/**
 * İstenen sayfa sayfa sayısına sığdırılır (son sayfadan sonrası son sayfa olur); `start` ilk
 * satırın sırası, `from`–`to` ekranda yazan aralık ("26–50 · toplam 73").
 */
export function pageSlice(total: number, requested: number, size: number) {
  const pages = pageCount(total, size);
  const page = Math.min(Math.max(1, requested), pages);
  const start = (page - 1) * size;
  return { page, pages, start, from: total === 0 ? 0 : start + 1, to: Math.min(total, start + size) };
}

/** Sayfalı bir listenin adresle gelen parçaları (sayfa gezgini bunlarla çizilir). */
export type PageInfo = { total: number; page: number; pages: number; from: number; to: number; search: string };

// ---------------------------------------------------------------------------------------
// Tarihler (Türkiye saatiyle)
// ---------------------------------------------------------------------------------------

/** Türkiye saatiyle takvim günü: yıl, ay (0-11), gün, haftanın günü (0 pazartesi) ve anahtarı. */
export function turkeyDay(date: Date) {
  const local = new Date(date.getTime() + TURKEY_OFFSET);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  return { year, month, day, weekday: (local.getUTCDay() + 6) % 7, index: Date.UTC(year, month, day) / DAY };
}

/** "29 Eylül"; başka yıldaysa "29 Eylül 2025". */
export function dateText(date: Date, now: Date): string {
  const months = getMessages().profile.months;
  const d = turkeyDay(date);
  return d.year === turkeyDay(now).year ? `${d.day} ${months[d.month]}` : `${d.day} ${months[d.month]} ${d.year}`;
}

/** Son giriş ve son aktiflik: "Bugün", "Dün", "3 gün önce" (bir haftaya kadar), sonra tarih. */
export function daysAgoText(date: Date, now: Date): string {
  const t = getMessages().adminUsers.when;
  const diff = turkeyDay(now).index - turkeyDay(date).index;
  if (diff <= 0) return t.today;
  if (diff === 1) return t.yesterday;
  if (diff < 7) return format(t.daysAgo, { n: diff });
  return dateText(date, now);
}

/** Haftada ortalama bitirilen lab: bitirdiği lab / üyelik haftası (en az bir hafta). "1,5" */
export function weeklyAverage(done: number, joinedAt: Date, now: Date): string {
  const weeks = Math.max(1, (now.getTime() - joinedAt.getTime()) / (7 * DAY));
  const value = Math.round((done / weeks) * 10) / 10;
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

// ---------------------------------------------------------------------------------------
// Son 4 haftanın takvimi (öğrenci profili)
// ---------------------------------------------------------------------------------------

export type CalendarCell = {
  /** "2026-10-11" */
  key: string;
  day: number;
  month: number;
  /** before: henüz üye değildi; future: bu haftanın gelmemiş günü. */
  state: "before" | "member" | "future";
  /** O gün bitirdiği lab sayısı. */
  count: number;
  today: boolean;
};

/**
 * Son 4 hafta, pazartesiden pazara: bu hafta ve önceki 3 hafta (28 gün). Bugünden sonraki günler
 * boş kalır; üye olmadan önceki günler "Üye değildi" olur.
 */
export function calendarCells(doneDates: readonly Date[], joinedAt: Date, now: Date): CalendarCell[] {
  const today = turkeyDay(now);
  const joined = turkeyDay(joinedAt).index;
  const firstIndex = today.index - today.weekday - 21;
  const counts = new Map<number, number>();
  for (const date of doneDates) {
    const index = turkeyDay(date).index;
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  return Array.from({ length: 28 }, (_, i) => {
    const index = firstIndex + i;
    const date = new Date(index * DAY);
    const key = date.toISOString().slice(0, 10);
    const state = index > today.index ? "future" : index < joined ? "before" : "member";
    return {
      key,
      day: date.getUTCDate(),
      month: date.getUTCMonth(),
      state,
      count: state === "member" ? (counts.get(index) ?? 0) : 0,
      today: index === today.index,
    };
  });
}

/** Takvimde lab bitirdiği gün sayısı. */
export const activeDays = (cells: readonly CalendarCell[]) => cells.filter((c) => c.count > 0).length;

// ---------------------------------------------------------------------------------------
// Öğretmenler ve okullar
// ---------------------------------------------------------------------------------------

/**
 * Ödevin toplam yüzdesi: üyelerin bitirdiği ödev labı (öğrenci × lab çifti) / (üye × lab).
 * Okulum'daki homeworkPct ile aynı sonuç; burada çiftler SQL'de sayılır.
 */
export function homeworkPctOf(donePairs: number, members: number, labs: number): number {
  if (members === 0 || labs === 0) return 0;
  return Math.round((Math.min(donePairs, members * labs) / (members * labs)) * 100);
}

/** Okulun kurulum hunisi: her adıma ulaşan öğretmen sayısı (1. adım hepsi). */
export function funnelOf(steps: readonly SetupStep[]): [number, number, number, number, number] {
  const reached = (n: number) => steps.filter((s) => s >= n).length;
  return [reached(1), reached(2), reached(3), reached(4), reached(5)];
}

/** Öğretmenin durum cümlesi (Okulum'daki çekmeceyle aynı kural, school.drawer.hints). */
export function teacherHintOf(step: SetupStep, fresh: boolean, approvedAt: Date | null, now: Date): TeacherHint {
  if (step === 5) return { kind: "good" };
  if (step === 4) return { kind: "assigned" };
  if (step === 3) return { kind: "joined" };
  if (step === 2) return { kind: "created", n: minStudentsJoined };
  if (fresh) return { kind: "fresh" };
  if (approvedAt) return { kind: "waitingDays", days: Math.floor((now.getTime() - approvedAt.getTime()) / DAY) };
  return { kind: "waiting" };
}

export function hintText(hint: TeacherHint): string {
  const t = getMessages().school.drawer.hints;
  switch (hint.kind) {
    case "created":
      return format(t.created, { n: hint.n });
    case "waitingDays":
      return format(t.waitingDays, { days: hint.days });
    default:
      return t[hint.kind];
  }
}

/** Yeni onaylanan öğretmen bu kadar gün "Yeni katıldı"dır (Okulum'la aynı). */
export const teacherFreshDays = freshDays;

/**
 * "Öğretmenlikten çıkar"ın geri al süresi. Ekrandaki bildirim 5 saniye durur; sunucu yavaş
 * bağlantıyı da düşünerek 30 saniyeye kadar kabul eder (talep kararlarıyla aynı).
 */
export const removeUndoWindowMs = 30_000;

export function removeUndoOver(removedAt: Date, now: Date): boolean {
  return now.getTime() - removedAt.getTime() > removeUndoWindowMs;
}

/** "Öğretmen" sayılan hesap: rolü öğretmen, ya da bir okulda öğretmenlik yapan yönetici. */
export function isTeacherAccount(user: { role: string; schoolId: string | null }): boolean {
  return user.role === "TEACHER" || (user.role === "ADMIN" && user.schoolId !== null);
}
