import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { classLevels, classNameOk, generateJoinCode, isJoinCode, minFinishedForRate } from "@/lib/classroom/rules";
import {
  attentionFor,
  attentionOrder,
  daysLeft,
  dueBounds,
  groupedNoticeRates,
  homeworkTotals,
  initialOf,
  matchesSearch,
  packQr,
  parseDueDate,
  percent,
  qrPath,
  noticeRate,
  shortName,
  studentStatus,
  toDateInput,
  turkeyDate,
  unpackQr,
  type AttentionInput,
  type LabFinish,
} from "@/lib/classroom/teacher-rules";
import { getMessages } from "@/lib/i18n";

// 11 Ekim 2026, Türkiye saatiyle 15.00.
const now = new Date("2026-10-11T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const due = (value: string) => {
  const parsed = parseDueDate(value, now);
  if (!parsed.ok || !parsed.date) throw new Error(`geçersiz tarih: ${value}`);
  return parsed.date;
};

describe("ödevin son tarihi", () => {
  it("boş bırakılırsa son tarih yok", () => {
    expect(parseDueDate("", now)).toEqual({ ok: true, date: null });
    expect(parseDueDate("   ", now)).toEqual({ ok: true, date: null });
  });

  it("günün sonu, Türkiye saatiyle 23.59 olarak saklanır", () => {
    expect(parseDueDate("2026-10-11", now)).toEqual({ ok: true, date: new Date("2026-10-11T20:59:59.999Z") });
    expect(parseDueDate("2026-10-20", now)).toEqual({ ok: true, date: new Date("2026-10-20T20:59:59.999Z") });
  });

  it("geçmiş gün, bir yıldan sonrası ve bozuk tarih kabul edilmez", () => {
    expect(parseDueDate("2026-10-10", now)).toEqual({ ok: false });
    expect(parseDueDate("2027-10-11", now).ok).toBe(true);
    expect(parseDueDate("2027-10-12", now)).toEqual({ ok: false });
    expect(parseDueDate("2026-02-30", now)).toEqual({ ok: false });
    expect(parseDueDate("11.10.2026", now)).toEqual({ ok: false });
    expect(parseDueDate("2026-10-1", now)).toEqual({ ok: false });
  });

  it("bugün Türkiye takvimine göredir (UTC gece yarısından önce Türkiye'de ertesi gün)", () => {
    const lateNight = new Date("2026-10-10T22:30:00Z"); // Türkiye: 11 Ekim 01.30
    expect(parseDueDate("2026-10-10", lateNight)).toEqual({ ok: false });
    expect(parseDueDate("2026-10-11", lateNight).ok).toBe(true);
    expect(dueBounds(lateNight)).toEqual({ min: "2026-10-11", max: "2027-10-11" });
  });

  it("tarih kutusunun sınırları ve değeri", () => {
    expect(dueBounds(now)).toEqual({ min: "2026-10-11", max: "2027-10-11" });
    expect(toDateInput(due("2026-10-20"))).toBe("2026-10-20");
    expect(toDateInput(new Date("2026-10-11T21:30:00Z"))).toBe("2026-10-12");
  });

  it("kalan gün: 0 son gün, eksi değer geçti", () => {
    expect(daysLeft(due("2026-10-14"), now)).toBe(3);
    expect(daysLeft(due("2026-10-11"), now)).toBe(0);
    expect(daysLeft(new Date("2026-10-10T20:59:59.999Z"), now)).toBe(-1);
  });

  it("metindeki gün ve ay Türkiye takvimine göre", () => {
    expect(turkeyDate(new Date("2026-10-16T21:30:00Z"))).toEqual({ day: 17, month: 9 });
    expect(getMessages().classroom.monthsUntil).toHaveLength(12);
  });
});

describe("ödev sayımları", () => {
  it("öğrencinin durumu: bitirdi, devam ediyor, başlamadı", () => {
    expect(studentStatus(2, 2)).toBe("finished");
    expect(studentStatus(3, 2)).toBe("finished");
    expect(studentStatus(1, 2)).toBe("inProgress");
    expect(studentStatus(0, 2)).toBe("notStarted");
    expect(studentStatus(0, 0)).toBe("notStarted");
  });

  it("sınıfın toplamı öğrenci × lab çiftlerinden çıkar", () => {
    expect(homeworkTotals([2, 1, 0, 2], 2)).toEqual({ pct: 63, finished: 2, inProgress: 1, notStarted: 1 });
    expect(homeworkTotals([5, 0], 2)).toEqual({ pct: 50, finished: 1, inProgress: 0, notStarted: 1 });
    expect(homeworkTotals([], 2)).toEqual({ pct: 0, finished: 0, inProgress: 0, notStarted: 0 });
    expect(percent(1, 0)).toBe(0);
  });

  it(`tuzağı fark edenlerin oranı en az ${minFinishedForRate} öğrenci bitirince görünür`, () => {
    expect(minFinishedForRate).toBe(5);
    expect(noticeRate(4, 4)).toBeNull();
    expect(noticeRate(5, 3)).toBe(60);
    expect(noticeRate(7, 0)).toBe(0);
  });

  it("tuzağı fark edenlerin oranı 5'erli gruplarla değişir: yeni bitiren tek öğrencinin sonucu orandan okunmaz", () => {
    // Bitirme sırası: dakika dakika. 5 kişiden 3'ü ilk seferde fark etti; tekrar yapan yok.
    const finish = (i: number, first: boolean, last = first): LabFinish => ({ userId: `u${i}`, doneAt: new Date(now.getTime() + i * 60_000), first, last });
    const five = [true, true, false, false, true].map((noticed, i) => finish(i, noticed));
    expect(groupedNoticeRates(five.slice(0, 4))).toBeNull();
    expect(groupedNoticeRates(five)).toEqual({ first: 60, last: 60 });
    // 6. öğrenci fark etse de etmese de oran aynı kalır (önceden %50 ya da %67 olurdu).
    expect(groupedNoticeRates([...five, finish(5, false)])).toEqual({ first: 60, last: 60 });
    expect(groupedNoticeRates([...five, finish(5, true)])).toEqual({ first: 60, last: 60 });
    // 10 kişi olunca ikinci grup da sayılır: 10 kişiden 7'si.
    const ten = [...five, ...[true, true, false, true, true].map((noticed, i) => finish(5 + i, noticed))];
    expect(groupedNoticeRates(ten)).toEqual({ first: 70, last: 70 });
    // Sıra veritabanından nasıl gelirse gelsin aynı 10 kişi sayılır.
    expect(groupedNoticeRates([...ten, finish(10, false)].reverse())).toEqual({ first: 70, last: 70 });
    // Aynı anda bitirenler kimliğe göre sıralanır (sonuç her yüklemede aynı).
    const tie = Array.from({ length: 6 }, (_, i) => ({ userId: `t${5 - i}`, doneAt: now, first: i === 0, last: i === 0 }));
    expect(groupedNoticeRates(tie)).toEqual({ first: 0, last: 0 });
  });

  it("tekrar sonrası: sayılan öğrencilerin son denemesi; ilk seferdeki oran değişmez", () => {
    const finish = (i: number, first: boolean, last: boolean): LabFinish => ({ userId: `u${i}`, doneAt: new Date(now.getTime() + i * 60_000), first, last });
    // İkisi ilk seferde fark etti; fark etmeyen üçten ikisi tekrar yapıp fark etti.
    const five = [finish(0, true, true), finish(1, false, true), finish(2, false, false), finish(3, true, true), finish(4, false, true)];
    expect(groupedNoticeRates(five)).toEqual({ first: 40, last: 80 });
    // İlk seferde fark edip tekrar yapınca kaçıran da tekrar sonrasında sayılmaz.
    expect(groupedNoticeRates([finish(0, true, false), ...five.slice(1)])).toEqual({ first: 40, last: 60 });
    // Grubu dolduramayan 6. öğrenci tekrar sonrasına da girmez.
    expect(groupedNoticeRates([...five, finish(5, false, true)])).toEqual({ first: 40, last: 80 });
  });
});

describe("dikkat isteyenler", () => {
  const totals = (over: Partial<ReturnType<typeof homeworkTotals>> = {}) => ({ pct: 80, finished: 2, inProgress: 2, notStarted: 0, ...over });
  const input = (homework: Partial<NonNullable<AttentionInput["homework"]>> | null, members = 4): AttentionInput => ({
    members,
    createdAt: daysAgo(10),
    homework: homework ? { createdAt: daysAgo(5), dueDate: null, totals: totals(), labs: [], ...homework } : null,
  });

  it("öğrencisi olmayan sınıf: ilk iki gün değil, sonra", () => {
    expect(attentionFor({ members: 0, createdAt: daysAgo(1), homework: null }, now)).toBeNull();
    expect(attentionFor({ members: 0, createdAt: daysAgo(3), homework: null }, now)).toEqual({ kind: "noStudents" });
  });

  it("ödevi olmayan sınıf", () => {
    expect(attentionFor(input(null, 6), now)).toEqual({ kind: "noHomework", count: 6 });
  });

  it("son tarih geçti ve bitirmeyen var", () => {
    const passed = new Date("2026-10-10T20:59:59.999Z");
    expect(attentionFor(input({ dueDate: passed }), now)).toEqual({ kind: "overdue", count: 2 });
    // Herkes bitirdiyse son tarihin geçmesi sorun değil.
    expect(attentionFor(input({ dueDate: passed, totals: totals({ pct: 100, finished: 4, inProgress: 0 }) }), now)).toBeNull();
  });

  it("son tarih yakın ve tamamlanma yarının altında", () => {
    expect(attentionFor(input({ dueDate: due("2026-10-11"), totals: totals({ pct: 25, finished: 1 }) }), now)).toEqual({ kind: "dueToday", finished: 1, members: 4 });
    expect(attentionFor(input({ dueDate: due("2026-10-13"), totals: totals({ pct: 25, finished: 1 }) }), now)).toEqual({ kind: "dueSoon", days: 2, finished: 1, members: 4 });
    expect(attentionFor(input({ dueDate: due("2026-10-13"), totals: totals({ pct: 60 }) }), now)).toBeNull();
    expect(attentionFor(input({ dueDate: due("2026-10-20"), totals: totals({ pct: 10 }) }), now)).toBeNull();
  });

  it("zor geçen lab: en düşük oranlı senaryo", () => {
    const labs = [
      { name: "Eğitim", firstRate: null },
      { name: "Sahte kargo maili", firstRate: 40 },
      { name: "Kodu soran arkadaş", firstRate: 20 },
      { name: "Kolay", firstRate: 90 },
    ];
    expect(attentionFor(input({ labs }), now)).toEqual({ kind: "hardLab", lab: "Kodu soran arkadaş", rate: 20 });
    expect(attentionFor(input({ labs: [{ name: "Sınırda", firstRate: 50 }] }), now)).toBeNull();
  });

  it("ödeve başlamayanlar: ödev verildikten iki gün sonra, sınıfın en az dörtte biri", () => {
    const some = totals({ notStarted: 1, inProgress: 1 });
    expect(attentionFor(input({ totals: some }), now)).toEqual({ kind: "notStarted", count: 1 });
    expect(attentionFor(input({ totals: some, createdAt: daysAgo(1) }), now)).toBeNull();
    expect(attentionFor(input({ totals: some }, 8), now)).toBeNull();
  });

  it("her sınıf için en acil tek madde döner; sıralama sözlükteki metinlerle aynı", () => {
    const passed = new Date("2026-10-10T20:59:59.999Z");
    const labs = [{ name: "Zor", firstRate: 10 }];
    expect(attentionFor(input({ dueDate: passed, labs }), now)?.kind).toBe("overdue");
    expect(attentionOrder).toEqual(["overdue", "dueToday", "dueSoon", "hardLab", "notStarted", "noHomework", "noStudents"]);
    const texts = getMessages().classroom.attention;
    for (const kind of attentionOrder) expect(texts[kind]).toBeTruthy();
  });
});

describe("adlar ve arama", () => {
  it("tahtada ad ve soyadın baş harfi görünür", () => {
    expect(shortName("Ayşe Yılmaz")).toBe("Ayşe Y.");
    expect(shortName("Mehmet Can İnce")).toBe("Mehmet İ.");
    expect(shortName("ali ılgaz")).toBe("ali I.");
    expect(shortName("  Ali  ")).toBe("Ali");
    expect(shortName("")).toBe("");
  });

  it("baş harf Türkçe büyük harfle", () => {
    expect(initialOf("ilknur")).toBe("İ");
    expect(initialOf(" Ömer")).toBe("Ö");
    expect(initialOf("")).toBe("");
  });

  it("arama büyük-küçük harf ve İ/ı farkı gözetmez", () => {
    expect(matchesSearch("Işıl Kaya", "ışıl")).toBe(true);
    expect(matchesSearch("İrem Aydın", "irem")).toBe(true);
    expect(matchesSearch("Ayşe Yılmaz", "  YILMAZ ")).toBe(true);
    expect(matchesSearch("Ayşe Yılmaz", "")).toBe(true);
    expect(matchesSearch("Ayşe Yılmaz", "zeynep")).toBe(false);
  });
});

describe("sınıf adı, düzey ve kod", () => {
  it("sınıf adı 2-30 karakter", () => {
    expect(classNameOk("7")).toBe(false);
    expect(classNameOk("7-A")).toBe(true);
    expect(classNameOk("  7-A  ")).toBe(true);
    expect(classNameOk("a".repeat(30))).toBe(true);
    expect(classNameOk("a".repeat(31))).toBe(false);
  });

  it("her düzeyin adı sözlükte", () => {
    const levels = getMessages().classroom.levels;
    for (const level of classLevels) expect(levels[level]).toBeTruthy();
  });

  it("üretilen kod geçerli bir sınıf kodu", () => {
    for (let i = 0; i < 50; i++) expect(isJoinCode(generateJoinCode())).toBe(true);
  });
});

describe("QR kodu", () => {
  it("modüller sıkıştırılıp geri açılınca aynı kalır", () => {
    const qr = QRCode.create("https://ornek.com/katil/ABC234", { errorCorrectionLevel: "M" });
    const packed = packQr(qr.modules.size, qr.modules.data);
    expect(packed.size).toBe(qr.modules.size);
    expect(unpackQr(packed)).toEqual(Array.from(qr.modules.data, (m) => m === 1));
  });

  it("yan yana koyu modüller tek dikdörtgen olur", () => {
    const qr = packQr(3, [1, 0, 1, 0, 1, 0, 1, 1, 1]);
    expect(qrPath(qr)).toBe("M0 0h1v1h-1zM2 0h1v1h-1zM1 1h1v1h-1zM0 2h3v1h-3z");
    expect(qrPath(packQr(2, [0, 0, 0, 0]))).toBe("");
  });
});
