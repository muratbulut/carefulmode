import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BulletinCard } from "@/components/school/BulletinCard";
import type { SchoolBulletin } from "@/components/school/types";
import {
  bulletinSentences,
  canRemind,
  countByWeek,
  dueText,
  finishingPct,
  homeworkPct,
  isFresh,
  isoWeek,
  joinNames,
  minStudentsJoined,
  principalMailto,
  reminderKindOf,
  setupStep,
  signalOf,
  trendOf,
  weekLabel,
  weekRange,
  weekStarts,
  whenText,
  type BulletinFacts,
} from "@/lib/school/bulletin-model";
import {
  cleanText,
  decisionOf,
  deletesDocument,
  entriesToUndo,
  finalizeDelayMs,
  rejectionNoteLimits,
  textOk,
  undoWindowMs,
  undoWindowOver,
} from "@/lib/teacher/decision-rules";

const DAY = 24 * 60 * 60 * 1000;
/** Türkiye saatiyle pazartesi 00.00 (UTC+3). */
const monday = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d) - 3 * 60 * 60 * 1000);

describe("öğretmenin kurulum adımı (Okulum-O4-Bulten)", () => {
  const cls = (members: number, hasAssignment = false, pct: number | null = null) => ({ members, hasAssignment, pct });

  it("ulaşılan en yüksek adım sayılır", () => {
    expect(setupStep([])).toBe(1);
    expect(setupStep([cls(0)])).toBe(2);
    expect(setupStep([cls(minStudentsJoined - 1)])).toBe(2);
    expect(setupStep([cls(minStudentsJoined)])).toBe(3);
    expect(setupStep([cls(minStudentsJoined), cls(2, true, 10)])).toBe(4);
    expect(setupStep([cls(30, true, finishingPct - 1)])).toBe(4);
    expect(setupStep([cls(30, true, finishingPct)])).toBe(5);
    // Öğrencisi olmayan sınıfın yüzdesi bitirmek sayılmaz.
    expect(setupStep([cls(0, true, 100)])).toBe(4);
  });

  it("işaret: İyi gidiyor, Yolda, yeni onaylanan takıldı sayılmaz", () => {
    expect(signalOf(5, false)).toBe("good");
    expect(signalOf(4, true)).toBe("onTrack");
    expect(signalOf(3, false)).toBe("onTrack");
    expect(signalOf(2, false)).toBe("stuck");
    expect(signalOf(1, true)).toBe("new");
    const now = new Date("2026-10-11T12:00:00Z");
    expect(isFresh(new Date(now.getTime() - 6 * DAY), now)).toBe(true);
    expect(isFresh(new Date(now.getTime() - 8 * DAY), now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });

  it("hatırlatma adıma göre; bitmiş, yeni ve kendisi için yok", () => {
    expect([1, 2, 3, 4, 5].map((s) => reminderKindOf(s as 1))).toEqual(["createClass", "shareCode", "firstAssignment", "remindAssignment", null]);
    expect(canRemind({ step: 1, fresh: false, isMe: false })).toBe(true);
    expect(canRemind({ step: 4, fresh: false, isMe: false })).toBe(true);
    expect(canRemind({ step: 5, fresh: false, isMe: false })).toBe(false);
    expect(canRemind({ step: 1, fresh: true, isMe: false })).toBe(false);
    expect(canRemind({ step: 1, fresh: false, isMe: true })).toBe(false);
  });

  it("ödev yüzdesi sınıfın toplamıdır", () => {
    expect(homeworkPct([], 4)).toBe(0);
    expect(homeworkPct([1, 2], 0)).toBe(0);
    expect(homeworkPct([4, 4, 0, 0], 4)).toBe(50);
    expect(homeworkPct([1, 0, 0], 2)).toBe(17);
    expect(homeworkPct([9], 2)).toBe(100);
  });
});

describe("haftalar (Türkiye saati)", () => {
  const week0 = monday(2026, 10, 5);

  it("son haftaların başları ve sayımı", () => {
    const starts = weekStarts(week0, 5);
    expect(starts.map((s) => s.toISOString())).toEqual([
      "2026-09-06T21:00:00.000Z",
      "2026-09-13T21:00:00.000Z",
      "2026-09-20T21:00:00.000Z",
      "2026-09-27T21:00:00.000Z",
      "2026-10-04T21:00:00.000Z",
    ]);
    const dates = [
      new Date("2026-10-04T21:00:00Z"), // bu haftanın ilk anı
      new Date("2026-10-04T20:59:59Z"), // geçen haftanın son anı
      new Date("2026-10-11T12:00:00Z"),
      new Date("2026-09-01T12:00:00Z"), // grafikten önce: sayılmaz
    ];
    expect(countByWeek(dates, starts)).toEqual([0, 0, 0, 1, 2]);
  });

  it("hafta numarası, tarih aralığı ve grafikteki adlar", () => {
    expect(isoWeek(week0)).toBe(41);
    expect(isoWeek(monday(2025, 12, 29))).toBe(1);
    expect(isoWeek(monday(2026, 12, 28))).toBe(53);
    expect(weekRange(week0)).toBe("5–11 Ekim 2026");
    expect(weekRange(monday(2026, 9, 28))).toBe("28 Eylül – 4 Ekim 2026");
    expect(weekRange(monday(2025, 12, 29))).toBe("29 Aralık 2025 – 4 Ocak 2026");
    expect(weekLabel(monday(2026, 9, 14), false)).toBe("14 Eyl");
    expect(weekLabel(week0, true)).toBe("Bu hafta");
  });

  it("talep ve son giriş zamanı: bugün, dün, tarih; son gün", () => {
    const now = new Date("2026-10-11T18:12:00Z");
    expect(whenText(new Date("2026-10-11T18:12:00Z"), now)).toBe("Bugün 21:12");
    expect(whenText(new Date("2026-10-10T22:30:00Z"), now)).toBe("Bugün 01:30");
    expect(whenText(new Date("2026-10-10T11:30:00Z"), now)).toBe("Dün 14:30");
    expect(whenText(new Date("2026-10-01T09:00:00Z"), now)).toBe("1 Ekim");
    expect(dueText(new Date("2026-10-17T09:00:00Z"))).toBe("17 Ekim'e kadar");
    expect(dueText(new Date("2026-09-03T09:00:00Z"))).toBe("3 Eylül'e kadar");
  });
});

describe("bültenin cümleleri", () => {
  const facts = (over: Partial<BulletinFacts> = {}): BulletinFacts => ({
    thisWeek: 34,
    lastWeek: 26,
    classCount: 3,
    homework: [
      { className: "7-A", topic: "Oltalama Limanı", pct: 71 },
      { className: "8-A", topic: "Hesap Kalesi", pct: 54 },
    ],
    stuckTeachers: ["Emre Yalçın"],
    newTeachers: 0,
    teacherCount: 3,
    pendingRequests: 1,
    coordinatorApproves: true,
    ...over,
  });

  it("tahtadaki örnek", () => {
    expect(bulletinSentences(facts())).toEqual({
      labs: "Bu hafta okulunda 34 oda bitirildi, geçen haftadan 8 fazla.",
      homework: "7-A Oltalama Limanı ödevinde %71, 8-A Hesap Kalesi ödevinde %54.",
      teachers: "Emre Yalçın henüz sınıf kurmadı ya da öğrencisi katılmadı.",
      requests: "1 öğretmenlik talebi senin onayını bekliyor.",
    });
  });

  it("lab sayısı: az, aynı, ilk hafta, hiç", () => {
    expect(bulletinSentences(facts({ thisWeek: 20 })).labs).toBe("Bu hafta okulunda 20 oda bitirildi, geçen haftadan 6 az.");
    expect(bulletinSentences(facts({ thisWeek: 26 })).labs).toBe("Bu hafta okulunda 26 oda bitirildi, geçen haftayla aynı.");
    expect(bulletinSentences(facts({ lastWeek: 0 })).labs).toBe("Bu hafta okulunda 34 oda bitirildi; geçen hafta hiç yoktu.");
    expect(bulletinSentences(facts({ thisWeek: 0 })).labs).toBe("Bu hafta okulunda henüz oda bitirilmedi; geçen hafta 26 oda bitirilmişti.");
    expect(bulletinSentences(facts({ thisWeek: 0, lastWeek: 0 })).labs).toBe("Bu hafta okulunda henüz oda bitirilmedi.");
  });

  it("ödevler, öğretmenler ve talepler", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ className: `${i + 5}-B`, topic: "Para Çarşısı", pct: 50 - i }));
    expect(bulletinSentences(facts({ homework: many })).homework).toBe(
      "5-B Para Çarşısı ödevinde %50, 6-B Para Çarşısı ödevinde %49, 7-B Para Çarşısı ödevinde %48 ve 2 sınıf daha.",
    );
    expect(bulletinSentences(facts({ homework: [] })).homework).toBe("Sınıflara henüz ödev verilmedi.");
    expect(bulletinSentences(facts({ homework: [], classCount: 0 })).homework).toBe("Okulunda henüz sınıf yok.");
    expect(bulletinSentences(facts({ stuckTeachers: ["Emre Yalçın", "Nur Aydın"] })).teachers).toBe(
      "Emre Yalçın ve Nur Aydın henüz sınıf kurmadı ya da öğrencisi katılmadı.",
    );
    expect(bulletinSentences(facts({ stuckTeachers: [] })).teachers).toBe("Bütün öğretmenler sınıfını kurdu.");
    expect(bulletinSentences(facts({ stuckTeachers: [], newTeachers: 1 })).teachers).toBe("Takılan öğretmen yok; yeni katılanlar sınıfını kuruyor.");
    expect(bulletinSentences(facts({ teacherCount: 0, stuckTeachers: [] })).teachers).toContain("henüz onaylı öğretmen yok");
    expect(bulletinSentences(facts({ pendingRequests: 0 })).requests).toBe("Bekleyen öğretmenlik talebi yok.");
    expect(bulletinSentences(facts({ pendingRequests: 2, coordinatorApproves: false })).requests).toBe(
      "2 öğretmenlik talebi görüşünü bekliyor; kararı yönetici verecek.",
    );
  });

  it("adlar Türkçe sıralanır", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B", "C"])).toBe("A, B ve C");
    expect(joinNames(["A", "B", "C", "D", "E"])).toBe("A, B ve 3 öğretmen daha");
  });

  it("grafiğin üstündeki fark", () => {
    expect(trendOf(34, 26)).toEqual({ tone: "up", text: "+8 geçen haftaya göre" });
    expect(trendOf(3, 5)).toEqual({ tone: "down", text: "−2 geçen haftaya göre" });
    expect(trendOf(0, 0)).toEqual({ tone: "same", text: "Geçen haftayla aynı" });
  });

  it("\"Müdüre gönder\" sorumlunun mail uygulamasını kısa özetle açar", () => {
    const sentences = bulletinSentences(facts());
    const href = principalMailto({
      school: "Bahçelievler Ortaokulu",
      week: 41,
      range: "5–11 Ekim 2026",
      preparedBy: "Ahmet Çelik",
      counts: { teachers: 3, classes: 3, students: 81, weekDone: 34 },
      sentences,
    });
    expect(href.startsWith("mailto:?subject=")).toBe(true);
    const url = new URL(href);
    expect(url.searchParams.get("subject")).toBe("Haftalık okul bülteni · Bahçelievler Ortaokulu · 5–11 Ekim 2026");
    const body = url.searchParams.get("body")!;
    expect(body).toContain("HAFTALIK OKUL BÜLTENİ · 41. HAFTA\r\nBahçelievler Ortaokulu\r\n5–11 Ekim 2026");
    expect(body).toContain("3 onaylı öğretmen · 3 sınıf · 81 öğrenci sınıflarda · bu hafta 34 oda bitti");
    expect(body).toContain(`- ${sentences.labs}`);
    expect(body).toContain("Hazırlayan: okul sorumlusu Ahmet Çelik");
    expect(body).toContain("öğrenci adı, puan ya da rapor içermez");
    // mailto bağlantıları uzun olunca bazı uygulamalar keser; özet kısa kalır.
    expect(href.length).toBeLessThan(2000);
  });

  it("bülten kartı sayıları, cümleleri ve grafiği çizer", () => {
    const bulletin: SchoolBulletin = {
      week: 41,
      range: "5–11 Ekim 2026",
      preparedBy: "Ahmet Çelik",
      counts: { teachers: 3, classes: 4, students: 81, weekDone: 34 },
      sentences: bulletinSentences(facts()),
      chart: [
        { label: "28 Eyl", count: 26, current: false },
        { label: "Bu hafta", count: 34, current: true },
      ],
      trend: trendOf(34, 26),
    };
    const html = renderToStaticMarkup(createElement(BulletinCard, { bulletin, schoolName: "Bahçelievler Ortaokulu" }));
    expect(html).toContain("HAFTALIK OKUL BÜLTENİ · 41. HAFTA");
    expect(html).toContain("5–11 Ekim 2026 · hazırlayan: okul sorumlusu Ahmet Çelik");
    expect(html).toContain("öğrenci sınıflarda");
    expect(html).toContain("Bu hafta okulunda 34 oda bitirildi, geçen haftadan 8 fazla.");
    expect(html).toContain('aria-label="Son 2 haftada bitirilen oda sayıları: 28 Eyl 26, Bu hafta 34"');
    expect(html).toContain("height:100%");
  });
});

describe("talep kararlarının kuralları", () => {
  it("geri al süresi ekrandaki 5 saniyeden uzun, sonuçlar süre bitince", () => {
    expect(undoWindowMs).toBeGreaterThanOrEqual(5_000);
    expect(finalizeDelayMs).toBeGreaterThan(undoWindowMs);
    const at = new Date("2026-10-11T10:00:00Z");
    expect(undoWindowOver(at, new Date(at.getTime() + undoWindowMs - 1))).toBe(false);
    expect(undoWindowOver(at, new Date(at.getTime() + undoWindowMs))).toBe(true);
  });

  it("ret notu ve soru: boşluklar sadeleşir, en az 10 karakter", () => {
    expect(cleanText("  Belge   okunmuyor.\r\n\r\n\r\n\r\nYeniden  ekle.  ")).toBe("Belge okunmuyor.\n\nYeniden ekle.");
    expect(textOk(cleanText("   kısa   "), rejectionNoteLimits)).toBe(false);
    expect(textOk("Belge okunmuyor.", rejectionNoteLimits)).toBe(true);
    expect(textOk("x".repeat(rejectionNoteLimits.max + 1), rejectionNoteLimits)).toBe(false);
  });

  it("kesin karar belgeyi siler, bilgi isteme silmez", () => {
    const at = new Date("2026-10-11T10:00:00Z");
    expect(decisionOf({ status: "PENDING", decidedAt: null, questionAt: at })).toBeNull();
    expect(decisionOf({ status: "APPROVED", decidedAt: at, questionAt: null })).toEqual({ kind: "approved", at });
    expect(decisionOf({ status: "REJECTED", decidedAt: at, questionAt: null })).toEqual({ kind: "rejected", at });
    expect(decisionOf({ status: "INFO_REQUESTED", decidedAt: null, questionAt: at })).toEqual({ kind: "infoRequested", at });
    expect(deletesDocument("approved")).toBe(true);
    expect(deletesDocument("rejected")).toBe(true);
    expect(deletesDocument("infoRequested")).toBe(false);
  });

  describe("geri al neyi geri alır", () => {
    const now = new Date("2026-10-11T10:00:30Z");
    const entry = (id: string, actorId: string, action: string, secondsAgo: number) => ({
      id,
      actorId,
      action,
      createdAt: new Date(now.getTime() - secondsAgo * 1000),
    });

    it("aynı kişinin süre içindeki kesintisiz kararları birlikte", () => {
      const entries = [entry("a", "me", "application.endorsed", 3), entry("b", "me", "application.approved", 2)];
      expect(entriesToUndo(entries, "me", now).map((e) => e.id)).toEqual(["b", "a"]);
    });

    it("başka birinin kararı, önceki geri alma ya da gönderilmiş mail araya girince durur", () => {
      expect(entriesToUndo([entry("a", "me", "application.endorsed", 3), entry("b", "admin", "application.approved", 2)], "me", now)).toEqual([]);
      expect(
        entriesToUndo([entry("a", "me", "application.endorsed", 9), entry("u", "me", "application.undone", 5), entry("b", "me", "application.not_recognized", 2)], "me", now).map(
          (e) => e.id,
        ),
      ).toEqual(["b"]);
      expect(entriesToUndo([entry("a", "me", "application.approved", 40), entry("m", "me", "application.mail_sent", 5)], "me", now)).toEqual([]);
    });

    it("süre geçtiyse boş", () => {
      expect(entriesToUndo([entry("a", "me", "application.rejected", undoWindowMs / 1000 + 1)], "me", now)).toEqual([]);
      expect(entriesToUndo([], "me", now)).toEqual([]);
    });
  });
});
