import { describe, expect, it } from "vitest";
import {
  activeDays,
  calendarCells,
  dateText,
  daysAgoText,
  funnelOf,
  homeworkPctOf,
  isTeacherAccount,
  likePattern,
  matchesSchool,
  matchesTeacher,
  pageCount,
  pageSizes,
  pageSlice,
  parseUsersQuery,
  removeUndoOver,
  removeUndoWindowMs,
  searchKey,
  shortName,
  teacherHintOf,
  usersHref,
  weeklyAverage,
} from "@/lib/admin/users-model";
import { brand } from "@/lib/brand";
import { teamReminderMail } from "@/lib/mail/team-reminder-mail";
import type { ReminderKind } from "@/lib/mail/teacher-mail";
import { homeworkPct } from "@/lib/school/bulletin-model";

// Üst şeritteki logo resmi (lib/mail/logo.ts) maildeki tek <img> olabilir; gerisi kaçışlı metin olmalı.
const withoutMailLogo = (html: string) => html.replace(/<img src="[^"]*\/mail\/logo\.png"[^>]*>/, "");

const DAY = 24 * 60 * 60 * 1000;
// 12 Ekim 2026 pazartesi, Türkiye saatiyle 13.00.
const now = new Date("2026-10-12T10:00:00Z");

describe("öğrencinin kısa adı", () => {
  it("ad ve soyadın baş harfi: \"Ayşe Y.\"", () => {
    expect(shortName("Ayşe Yılmaz")).toBe("Ayşe Y.");
    expect(shortName("Defne Öztürk")).toBe("Defne Ö.");
  });

  it("ortadaki adlar yazılmaz, soyadın yalnızca baş harfi kalır", () => {
    expect(shortName("Mert Can Kaya")).toBe("Mert K.");
    expect(shortName("Mert Can Kaya")).not.toContain("Kaya");
    expect(shortName("Mert Can Kaya")).not.toContain("Can");
  });

  it("baş harf Türkçe kuralla büyür", () => {
    expect(shortName("ali ince")).toBe("ali İ.");
    expect(shortName("Deniz ılgın")).toBe("Deniz I.");
    expect(shortName("Zeynep şahin")).toBe("Zeynep Ş.");
    expect(shortName("Can çelik")).toBe("Can Ç.");
  });

  it("tek kelimelik ad olduğu gibi kalır; boşluklar sorun olmaz", () => {
    expect(shortName("Kerem")).toBe("Kerem");
    expect(shortName("  Ece   Nur  ")).toBe("Ece N.");
    expect(shortName("Ece\tNur")).toBe("Ece N.");
    expect(shortName("   ")).toBe("");
  });
});

describe("arama", () => {
  it("büyük-küçük harf ve ı/i ayrımı yapılmaz", () => {
    expect(searchKey("IŞIK")).toBe("işik");
    expect(searchKey("ışık")).toBe("işik");
    expect(searchKey("IRMAK")).toBe(searchKey("irmak"));
    expect(searchKey("İlker")).toBe("ilker");
    expect(searchKey("  Ayşe   Y. ")).toBe("ayşe y.");
  });

  it("SQL kalıbında % _ \\ harf olarak aranır", () => {
    expect(likePattern("Ayşe")).toBe("%ayşe%");
    expect(likePattern("50%_a\\")).toBe("%50\\%\\_a\\\\%");
  });

  it("öğretmen adında, okulunda ya da branşında arar", () => {
    const teacher = { name: "Ahmet Çelik", school: "Bahçelievler Ortaokulu", subject: "Bilişim Teknolojileri" };
    expect(matchesTeacher("", teacher)).toBe(true);
    expect(matchesTeacher("AHMET", teacher)).toBe(true);
    expect(matchesTeacher("bahcelievler", teacher)).toBe(false);
    expect(matchesTeacher("bahçelievler", teacher)).toBe(true);
    expect(matchesTeacher("BİLİŞİM", teacher)).toBe(true);
    expect(matchesTeacher("bılışım", teacher)).toBe(true);
    expect(matchesTeacher("Kadıköy", teacher)).toBe(false);
    expect(matchesTeacher("Ahmet", { ...teacher, school: null })).toBe(true);
  });

  it("okulu adında, ilinde ya da ilçesinde arar", () => {
    const school = { name: "Işıklar Ortaokulu", province: "İzmir", district: "Bornova" };
    expect(matchesSchool("", school)).toBe(true);
    expect(matchesSchool("işıklar", school)).toBe(true);
    expect(matchesSchool("IŞIKLAR", school)).toBe(true);
    expect(matchesSchool("izmir", school)).toBe(true);
    expect(matchesSchool("BORNOVA", school)).toBe(true);
    expect(matchesSchool("Karşıyaka", school)).toBe(false);
  });
});

describe("adres", () => {
  it("varsayılan: Genel, Öğrenciler, 1. sayfa, çekmece yok", () => {
    expect(parseUsersQuery({})).toEqual({ view: "genel", tab: "ogrenciler", search: "", page: 1, student: null, teacher: null });
  });

  it("sabit değerler: ?sekme=ogretmenler, ?sekme=ekip, ?gorunum=okullar", () => {
    expect(parseUsersQuery({ sekme: "ogretmenler" }).tab).toBe("ogretmenler");
    expect(parseUsersQuery({ sekme: "ekip" }).tab).toBe("ekip");
    expect(parseUsersQuery({ gorunum: "okullar" }).view).toBe("okullar");
    expect(usersHref({ tab: "ekip" })).toBe("/yonetim/kullanicilar?sekme=ekip");
    expect(usersHref({ tab: "ogretmenler" })).toBe("/yonetim/kullanicilar?sekme=ogretmenler");
    expect(usersHref({ view: "okullar" })).toBe("/yonetim/kullanicilar?gorunum=okullar");
  });

  it("bilinmeyen değer varsayılana döner; kimlik dışı değer atılır", () => {
    const q = parseUsersQuery({ gorunum: "x", sekme: ["ekip", "ogrenciler"], sayfa: "-3", ogrenci: "a b<", ogretmen: "c1_x-9", ara: "x".repeat(200) });
    expect(q.view).toBe("genel");
    expect(q.tab).toBe("ekip");
    expect(q.page).toBe(1);
    expect(q.student).toBeNull();
    expect(q.teacher).toBe("c1_x-9");
    expect(q.search).toHaveLength(80);
    expect(parseUsersQuery({ sayfa: "4" }).page).toBe(4);
  });

  it("varsayılanlar adrese yazılmaz; Okullar'da sekme yazılmaz; gidip gelince aynı", () => {
    expect(usersHref({})).toBe("/yonetim/kullanicilar");
    expect(usersHref({ view: "genel", tab: "ogrenciler", page: 1 })).toBe("/yonetim/kullanicilar");
    expect(usersHref({ view: "okullar", tab: "ogretmenler" })).toBe("/yonetim/kullanicilar?gorunum=okullar");
    const href = usersHref({ tab: "ogretmenler", search: "ayşe y", page: 2, teacher: "t1" });
    const params = Object.fromEntries(new URL(href, "https://ornek.com").searchParams);
    expect(parseUsersQuery(params)).toEqual({ view: "genel", tab: "ogretmenler", search: "ayşe y", page: 2, student: null, teacher: "t1" });
  });

  it("sayfa sayısı en az 1; öğrenci ve öğretmen 25, okul 20", () => {
    expect(pageSizes).toEqual({ students: 25, teachers: 25, schools: 20 });
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(pageCount(41, 20)).toBe(3);
  });

  it("istenen sayfa sayfa sayısına sığar; aralık ekrandaki gibi", () => {
    expect(pageSlice(0, 1, 25)).toEqual({ page: 1, pages: 1, start: 0, from: 0, to: 0 });
    expect(pageSlice(73, 2, 25)).toEqual({ page: 2, pages: 3, start: 25, from: 26, to: 50 });
    expect(pageSlice(73, 3, 25)).toEqual({ page: 3, pages: 3, start: 50, from: 51, to: 73 });
    // Son sayfadan sonrası (örneğin arama daralınca) son sayfa olur.
    expect(pageSlice(73, 9, 25)).toEqual({ page: 3, pages: 3, start: 50, from: 51, to: 73 });
    expect(pageSlice(10, 0, 25).page).toBe(1);
  });
});

describe("tarih metinleri (Türkiye saati)", () => {
  it("son giriş: Bugün, Dün, N gün önce, sonra tarih", () => {
    expect(daysAgoText(new Date("2026-10-12T05:00:00Z"), now)).toBe("Bugün");
    // Türkiye'de gece yarısını geçmiş: UTC'de dün ama Türkiye'de bugün.
    expect(daysAgoText(new Date("2026-10-11T22:30:00Z"), now)).toBe("Bugün");
    expect(daysAgoText(new Date("2026-10-11T12:00:00Z"), now)).toBe("Dün");
    expect(daysAgoText(new Date("2026-10-09T12:00:00Z"), now)).toBe("3 gün önce");
    expect(daysAgoText(new Date("2026-10-02T12:00:00Z"), now)).toBe("2 Ekim");
  });

  it("katılma tarihi: aynı yılda yılsız, başka yılda yıllı", () => {
    expect(dateText(new Date("2026-09-29T08:00:00Z"), now)).toBe("29 Eylül");
    expect(dateText(new Date("2025-09-29T08:00:00Z"), now)).toBe("29 Eylül 2025");
  });

  it("haftada ortalama lab: en az bir hafta sayılır, virgülle bir basamak", () => {
    expect(weeklyAverage(6, new Date(now.getTime() - 14 * DAY), now)).toBe("3");
    expect(weeklyAverage(7, new Date(now.getTime() - 14 * DAY), now)).toBe("3,5");
    expect(weeklyAverage(2, new Date(now.getTime() - DAY), now)).toBe("2");
    expect(weeklyAverage(0, new Date(now.getTime() - 30 * DAY), now)).toBe("0");
  });
});

describe("son 4 haftanın takvimi", () => {
  const joinedAt = new Date("2026-09-29T09:00:00Z");
  const done = [
    new Date("2026-10-01T09:00:00Z"),
    new Date("2026-10-01T15:00:00Z"),
    new Date("2026-10-05T09:00:00Z"),
    // Üye olmadan önce: sayılmaz.
    new Date("2026-09-25T09:00:00Z"),
    // Türkiye'de 12 Ekim (UTC'de 11 Ekim gecesi).
    new Date("2026-10-11T22:30:00Z"),
  ];
  const cells = calendarCells(done, joinedAt, now);

  it("pazartesiden başlar, 28 gün, bu hafta son satır", () => {
    expect(cells).toHaveLength(28);
    expect(cells[0].key).toBe("2026-09-21");
    expect(cells[21].key).toBe("2026-10-12");
    expect(cells[21].today).toBe(true);
    expect(cells.filter((c) => c.today)).toHaveLength(1);
    expect(cells[27].key).toBe("2026-10-18");
  });

  it("üye değildi, lab sayısı ve gelmemiş günler", () => {
    expect(cells.slice(0, 8).every((c) => c.state === "before" && c.count === 0)).toBe(true);
    expect(cells[8]).toMatchObject({ key: "2026-09-29", state: "member", count: 0 });
    expect(cells.find((c) => c.key === "2026-10-01")?.count).toBe(2);
    expect(cells.find((c) => c.key === "2026-10-05")?.count).toBe(1);
    expect(cells[21].count).toBe(1);
    expect(cells.slice(22).every((c) => c.state === "future" && c.count === 0)).toBe(true);
    expect(activeDays(cells)).toBe(3);
  });
});

describe("öğretmenler ve okullar", () => {
  it("ödev yüzdesi Okulum'la aynı sonucu verir", () => {
    const cases: [number[], number][] = [
      [[3, 3, 0, 1], 3],
      [[1, 0, 0], 2],
      [[5, 5], 4],
      [[], 3],
      [[2, 2], 0],
    ];
    for (const [doneCounts, labs] of cases) {
      const pairs = doneCounts.reduce((sum, n) => sum + Math.min(n, labs), 0);
      expect(homeworkPctOf(pairs, doneCounts.length, labs)).toBe(homeworkPct(doneCounts, labs));
    }
  });

  it("kurulum hunisi: her adıma ulaşan öğretmen", () => {
    expect(funnelOf([1, 2, 5, 3])).toEqual([4, 3, 2, 1, 1]);
    expect(funnelOf([])).toEqual([0, 0, 0, 0, 0]);
  });

  it("öğretmenin durum cümlesi Okulum'daki kuralla", () => {
    const approvedAt = new Date(now.getTime() - 12 * DAY);
    expect(teacherHintOf(5, false, approvedAt, now)).toEqual({ kind: "good" });
    expect(teacherHintOf(2, false, approvedAt, now)).toEqual({ kind: "created", n: 5 });
    expect(teacherHintOf(1, true, approvedAt, now)).toEqual({ kind: "fresh" });
    expect(teacherHintOf(1, false, approvedAt, now)).toEqual({ kind: "waitingDays", days: 12 });
    expect(teacherHintOf(1, false, null, now)).toEqual({ kind: "waiting" });
  });

  it("öğretmen hesabı: rolü öğretmen ya da okulu olan yönetici", () => {
    expect(isTeacherAccount({ role: "TEACHER", schoolId: null })).toBe(true);
    expect(isTeacherAccount({ role: "ADMIN", schoolId: "s1" })).toBe(true);
    expect(isTeacherAccount({ role: "ADMIN", schoolId: null })).toBe(false);
    expect(isTeacherAccount({ role: "STUDENT", schoolId: "s1" })).toBe(false);
  });

  it("öğretmenlikten çıkarmanın geri al süresi", () => {
    const removedAt = new Date(now.getTime() - 5_000);
    expect(removeUndoOver(removedAt, now)).toBe(false);
    expect(removeUndoOver(removedAt, new Date(removedAt.getTime() + removeUndoWindowMs + 1))).toBe(true);
  });
});

describe("ekibin hatırlatma maili", () => {
  const base = { to: "ogretmen@ornek.com", name: "Nur Aydın", siteUrl: "https://ornek.com" };

  it.each<[ReminderKind, string, string]>([
    ["createClass", "Sınıfını kurmaya ne dersin?", "Sınıfımı kur"],
    ["shareCode", "Sınıf kodunu öğrencilerinle paylaş", "Sınıf kodumu gör"],
    ["firstAssignment", "Sınıfına ilk ödevi ver", "Ödev ver"],
    ["remindAssignment", "Ödevi öğrencilerine hatırlat", "Sınıflarıma git"],
  ])("adıma göre (%s), ekipten geldiğini söyler", (kind, subject, action) => {
    const mail = teamReminderMail({ ...base, kind });
    expect(mail.to).toBe("ogretmen@ornek.com");
    expect(mail.subject).toBe(subject);
    expect(mail.text).toContain("Merhaba Nur Aydın,");
    expect(mail.text).toContain(`${brand.name} ekibi olarak`);
    expect(mail.text).toContain(`${brand.name} yönetim ekibi gönderdi`);
    expect(mail.text).not.toContain("okul sorumlu");
    expect(mail.text).toContain(`${action}: https://ornek.com/siniflarim`);
  });

  it("ad HTML olarak işlenmez", () => {
    const mail = teamReminderMail({ ...base, name: '<img src=x onerror="a()">', kind: "createClass" });
    expect(withoutMailLogo(mail.html)).not.toContain("<img");
    expect(mail.html).toContain("&#60;img");
  });
});
