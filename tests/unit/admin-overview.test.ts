import { describe, expect, it } from "vitest";
import {
  agoLabel,
  clock,
  dayKey,
  dayMonth,
  dayMonthShort,
  dayStart,
  monthStart,
  trParts,
  upcomingFridays,
  weekStart,
  whenLabel,
} from "@/lib/admin/calendar";
import {
  buildChart,
  buildKpis,
  buildPendingCards,
  changeOf,
  emptyCounts,
  emptyNewsWeeks,
  overviewWindows,
  rankTraps,
  topMissed,
  windowKeys,
  type WindowCounts,
  type WindowKey,
} from "@/lib/admin/overview-model";
import { feedEntry, fillBuckets, type FeedLab } from "@/lib/admin/pulse-model";

const at = (iso: string) => new Date(iso);
// Pazartesi 12 Ekim 2026, Türkiye saatiyle 00.30 (UTC'de hâlâ pazar).
const mondayNight = at("2026-10-11T21:30:00Z");
// Pazar 11 Ekim 2026, Türkiye saatiyle 14.05.
const sunday = at("2026-10-11T11:05:00Z");

describe("yönetim takvimi (Türkiye saati)", () => {
  it("gün, hafta ve ay başı Türkiye saatiyle", () => {
    expect(trParts(mondayNight)).toMatchObject({ year: 2026, month: 9, day: 12, weekday: 0, hour: 0, minute: 30 });
    expect(dayStart(mondayNight).toISOString()).toBe("2026-10-11T21:00:00.000Z");
    expect(weekStart(mondayNight).toISOString()).toBe("2026-10-11T21:00:00.000Z");
    expect(weekStart(sunday).toISOString()).toBe("2026-10-04T21:00:00.000Z");
    expect(monthStart(sunday).toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(monthStart(sunday, 1).toISOString()).toBe("2026-08-31T21:00:00.000Z");
    expect(monthStart(at("2026-01-15T10:00:00Z"), 1).toISOString()).toBe("2025-11-30T21:00:00.000Z");
    expect(dayKey(mondayNight)).toBe("2026-10-12");
    expect(clock(sunday)).toBe("14:05");
  });

  it("sıradaki cumalar: bugün cumaysa o da", () => {
    expect(upcomingFridays(sunday, 4).map(dayKey)).toEqual(["2026-10-16", "2026-10-23", "2026-10-30", "2026-11-06"]);
    expect(upcomingFridays(at("2026-10-16T08:00:00Z"), 2).map(dayKey)).toEqual(["2026-10-16", "2026-10-23"]);
    expect(upcomingFridays(at("2026-10-16T08:00:00Z"), 1)[0].toISOString()).toBe("2026-10-15T21:00:00.000Z");
  });

  it("tarih metinleri", () => {
    expect(dayMonth(sunday)).toBe("11 Ekim");
    expect(dayMonthShort(at("2026-09-07T10:00:00Z"))).toBe("7 Eyl");
    expect(whenLabel(at("2026-10-11T06:15:00Z"), sunday)).toEqual({ short: "Bugün 09:15", full: "11 Ekim 2026, 09:15" });
    expect(whenLabel(at("2026-10-10T19:10:00Z"), sunday).short).toBe("Dün 22:10");
    expect(whenLabel(at("2026-10-09T08:00:00Z"), sunday).short).toBe("9 Ekim");
    expect(whenLabel(at("2025-12-30T08:00:00Z"), sunday).short).toBe("30 Aralık 2025");
  });

  it("canlı nabızdaki kısa süreler", () => {
    const now = at("2026-10-11T12:00:00Z");
    const ago = (seconds: number) => agoLabel(new Date(now.getTime() - seconds * 1000), now);
    expect(ago(3)).toBe("şimdi");
    expect(ago(-5)).toBe("şimdi");
    expect(ago(12)).toBe("12 sn");
    expect(ago(150)).toBe("2 dk");
    expect(ago(2 * 3600 + 5)).toBe("2 sa");
    expect(ago(4 * 86_400)).toBe("4 gün");
  });
});

/** Pencerelerin sayıları; verilmeyen pencere boş. */
function counts(values: Partial<Record<WindowKey, Partial<WindowCounts>>>) {
  return Object.fromEntries(windowKeys.map((key) => [key, { ...emptyCounts, ...values[key] }])) as Record<WindowKey, WindowCounts>;
}

describe("özet: sayılar ve grafik", () => {
  it("pencereler: son 6 hafta pazartesiden, bu ay, geçen ay, tüm zamanlar", () => {
    const windows = overviewWindows(sunday);
    expect(windows.map((w) => w.key)).toEqual([...windowKeys]);
    expect(windows[0].start.toISOString()).toBe("2026-08-30T21:00:00.000Z");
    expect(windows[5].start.toISOString()).toBe("2026-10-04T21:00:00.000Z");
    expect(windows[4].end.getTime()).toBe(windows[5].start.getTime());
    // Bitmemiş pencere bir gün sonrasına kadar açık (saat farkı yeni satırı dışarıda bırakmasın).
    expect(windows[5].end.getTime()).toBeGreaterThan(sunday.getTime());
    expect(windows.find((w) => w.key === "prevMonth")!.end.toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });

  it("değişim yüzdesi", () => {
    expect(changeOf(1180, 1045)).toEqual({ kind: "up", n: 13 });
    expect(changeOf(149, 186)).toEqual({ kind: "down", n: 20 });
    expect(changeOf(5, 5)).toEqual({ kind: "same", n: 0 });
    expect(changeOf(0, 0)).toEqual({ kind: "same", n: 0 });
    expect(changeOf(3, 0)).toEqual({ kind: "noPrevious", n: 0 });
  });

  it("dönem dönem sayı kutuları", () => {
    const kpis = buildKpis(
      counts({
        w4: { finished: 1045, firstTries: 100, firstNoticed: 61, signups: 149 },
        w5: { finished: 1180, firstTries: 200, firstNoticed: 126, signups: 186, active: 742 },
        month: { finished: 2225, firstTries: 300, firstNoticed: 186, signups: 270, active: 1016 },
        prevMonth: { finished: 3110, firstTries: 500, firstNoticed: 300 },
        all: { finished: 15731, firstTries: 1000, firstNoticed: 610, signups: 1284, active: 1284 },
      }),
      { now: sunday, publishedLabs: 20, firstSignup: at("2026-09-07T09:00:00Z") },
    );
    expect(kpis.week).toEqual([
      { key: "newStudents", value: "186", sub: "geçen hafta 149" },
      { key: "activeStudents", value: "742", sub: "kayıtlı 1.284 öğrenciden" },
      { key: "finishedLabs", value: "1.180", sub: "geçen haftadan %13 fazla" },
      { key: "noticedFirst", value: "%63", sub: "geçen hafta %61" },
    ]);
    expect(kpis.month.map((k) => k.sub)).toEqual(["Ekim'in ilk 11 günü", "kayıtlı 1.284 öğrenciden", "Eylül'de 3.110", "Eylül'de %60"]);
    expect(kpis.all.map((k) => k.value)).toEqual(["1.284", "1.284", "15.731", "%61"]);
    expect(kpis.all.map((k) => k.sub)).toEqual(["7 Eylül'den beri", "kayıtlı 1.284 öğrenciden", "20 yayındaki odada", "bütün senaryo odaları"]);
  });

  it("boş veritabanında sayı kutuları", () => {
    const kpis = buildKpis(counts({}), { now: at("2026-10-01T06:00:00Z"), publishedLabs: 0, firstSignup: null });
    expect(kpis.week.map((k) => k.value)).toEqual(["0", "0", "0", "—"]);
    expect(kpis.week.map((k) => k.sub)).toEqual(["geçen hafta 0", "kayıtlı 0 öğrenciden", "geçen haftayla aynı", "geçen hafta bitiren yok"]);
    expect(kpis.month[0].sub).toBe("Ekim'in ilk günü");
    expect(kpis.month[3].sub).toBe("Eylül'de bitiren yok");
    expect(kpis.all[0].sub).toBe("henüz kayıt yok");
  });

  it("son 6 haftanın grafiği: üç dizi, son çubuk bu hafta", () => {
    const series = buildChart(
      counts({ w0: { finished: 180 }, w3: { finished: 905 }, w4: { finished: 1045, signups: 4 }, w5: { finished: 1180, signups: 2 } }),
      overviewWindows(sunday),
    );
    expect(series.map((s) => s.metric)).toEqual(["finished", "signups", "active"]);
    const finished = series[0];
    expect(finished.bars.map((b) => b.label)).toEqual(["31 Ağu", "7 Eyl", "14 Eyl", "21 Eyl", "28 Eyl", "Bu hafta"]);
    expect(finished.bars.map((b) => b.value)).toEqual([180, 0, 0, 905, 1045, 1180]);
    expect(finished.bars.at(-1)).toMatchObject({ current: true, display: "1.180" });
    expect(finished.total).toBe("1.180");
    expect(finished.change).toBe("+%13 geçen haftaya göre");
    expect(series[1].change).toBe("-%50 geçen haftaya göre");
    expect(series[2].change).toBe("geçen haftayla aynı");
  });
});

describe("özet: bekleyen işler", () => {
  it("kartlar sırayla; sayısı 0 olan ya da izni olmayan iş çıkmaz", () => {
    const cards = buildPendingCards({
      applications: { pending: 6, newSchool: 3, answered: 1 },
      news: { emptyWeeks: [at("2026-10-22T21:00:00Z"), at("2026-10-29T21:00:00Z"), at("2026-11-05T21:00:00Z")], drafts: 3 },
      labs: {
        drafts: [
          { name: "Sahte antivirüs uyarısı", neighborhood: "Zararlı Yazılım Ormanı" },
          { name: "Taksitli oyun parası", neighborhood: "Para Çarşısı" },
        ],
      },
      notes: { count: 1, first: { school: "Nilüfer Ortaokulu", opinion: "NOT_RECOGNIZED" } },
    });
    expect(cards.map((c) => [c.key, c.count, c.href])).toEqual([
      ["applications", 6, "/yonetim/talepler"],
      ["news", 3, "/yonetim/gundem"],
      ["labs", 2, "/yonetim/odalar"],
      ["notes", 1, "/yonetim/talepler"],
    ]);
    expect(cards[0]).toMatchObject({
      title: "6 öğretmenlik talebi bekliyor",
      sub: "3 tanesi listede olmayan okuldan geldi, 1 tanesinde istediğin bilgi geldi.",
      go: "Taleplere git",
    });
    expect(cards[1]).toMatchObject({ title: "Gündemde 3 hafta boş", sub: "23 Ekim, 30 Ekim ve 6 Kasım. 3 taslak bekliyor." });
    expect(cards[2].sub).toBe("Sahte antivirüs uyarısı (Zararlı Yazılım Ormanı), Taksitli oyun parası (Para Çarşısı).");
    expect(cards[3]).toMatchObject({
      title: "Okul sorumlusundan 1 not",
      sub: 'Nilüfer Ortaokulu: bir talep için "Bu kişiyi tanımıyorum" dendi, karar sende.',
      go: "Talebi aç",
    });

    expect(buildPendingCards({ applications: { pending: 0, newSchool: 0, answered: 0 }, notes: { count: 0, first: null } })).toEqual([]);
    expect(buildPendingCards({})).toEqual([]);
    const plain = buildPendingCards({ applications: { pending: 2, newSchool: 0, answered: 0 }, notes: { count: 2, first: null } });
    expect(plain[0].sub).toBe("Onayla, bilgi iste ya da reddet.");
    expect(plain[1]).toMatchObject({ sub: "2 talepte okul sorumlusunun görüşü var, karar sende.", go: "Taleplere git" });
  });

  it("dörtten fazla taslak lab kısaltılır", () => {
    const drafts = Array.from({ length: 5 }, (_, i) => ({ name: `Lab ${i + 1}`, neighborhood: "Hesap Kalesi" }));
    expect(buildPendingCards({ labs: { drafts } })[0].sub).toBe(
      "Lab 1 (Hesap Kalesi), Lab 2 (Hesap Kalesi), Lab 3 (Hesap Kalesi), 2 oda daha.",
    );
  });

  it("gündemde boş hafta: cumanın haftasında (pazartesi-pazar) planlı ya da yayında haber yoksa", () => {
    const fridays = upcomingFridays(sunday, 4);
    const published = [
      at("2026-10-12T05:00:00Z"), // 16 Ekim haftasının pazartesisi
      at("2026-10-25T20:59:00Z"), // 23 Ekim haftasının pazarı, 23.59
      at("2026-11-01T21:00:00Z"), // 6 Kasım haftasının pazartesisi 00.00
    ];
    expect(emptyNewsWeeks(fridays, published).map(dayKey)).toEqual(["2026-10-30"]);
    expect(emptyNewsWeeks(fridays, []).map(dayKey)).toEqual(fridays.map(dayKey));
  });
});

describe("özet: en çok tuzağa düşülen lablar", () => {
  it("en az örnek sayısı ve en az bir tuzak; orana göre sıralı, en fazla 4", () => {
    const ranked = rankTraps([
      { labId: "a", total: 9, hacked: 9 },
      { labId: "b", total: 100, hacked: 59 },
      { labId: "c", total: 20, hacked: 10 },
      { labId: "d", total: 50, hacked: 0 },
      { labId: "e", total: 40, hacked: 20 },
      { labId: "f", total: 10, hacked: 2 },
      { labId: "g", total: 30, hacked: 3 },
    ]);
    expect(ranked.map((r) => [r.labId, r.rate])).toEqual([
      ["b", 59],
      ["e", 50],
      ["c", 50],
      ["f", 20],
    ]);
  });

  it("en çok kaçırılan satır; eşitlikte sahte öğe sorudan önce", () => {
    const best = topMissed([
      { labId: "a", type: "question", key: "soru-1", missed: 7 },
      { labId: "a", type: "fake", key: "kargo", missed: 7 },
      { labId: "a", type: "fake", key: "banka", missed: 3 },
      { labId: "b", type: "question", key: "soru-2", missed: 2 },
      { labId: "b", type: "question", key: "soru-1", missed: 2 },
      { labId: "c", type: "fake", key: "x", missed: 0 },
    ]);
    expect(best.get("a")).toMatchObject({ type: "fake", key: "kargo" });
    expect(best.get("b")).toMatchObject({ key: "soru-1" });
    expect(best.has("c")).toBe(false);
  });
});

describe("canlı nabız", () => {
  it("son bir saatin 5 dakikalık dilimleri", () => {
    expect(
      fillBuckets([
        { b: 0, n: 2 },
        { b: 11, n: 5 },
        { b: 12, n: 9 },
        { b: -1, n: 9 },
        { b: 3.5, n: 9 },
      ]),
    ).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5]);
  });

  it("isimsiz akışın cümleleri", () => {
    const labs = new Map<string, FeedLab>([
      ["l1", { name: "Sahte kargo maili", template: "INBOX", neighborhood: "Oltalama Limanı" }],
      ["l2", { name: "Kodu soran arkadaş", template: "MESSAGING", neighborhood: "Hesap Kalesi" }],
      ["l3", { name: "Oltalama eğitimi", template: "TRAINING", neighborhood: "Oltalama Limanı" }],
    ]);
    const row = (kind: string, labId: string | null = null, a: string | null = null, b: string | null = null) => feedEntry({ kind, at: sunday, labId, a, b }, labs);
    expect(row("hacked", "l1")).toEqual({ kind: "hacked", text: '"Sahte kargo maili" odasında biri tuzağa düştü, rapor açıldı', where: "Oltalama Limanı" });
    expect(row("safe", "l1")?.text).toBe('"Sahte kargo maili" odasında biri güvende kaldı');
    expect(row("reported", "l1")?.text).toBe('"Sahte kargo maili" odasında biri sahte maili fark edip bildirdi');
    expect(row("reported", "l2")?.text).toBe('"Kodu soran arkadaş" odasında biri sahte mesajı fark edip bildirdi');
    expect(row("clicked", "l1")?.text).toBe('"Sahte kargo maili" odasında biri sahte bağlantıya tıkladı');
    expect(row("training", "l3")).toMatchObject({ text: '"Oltalama eğitimi" eğitimini biri bitirdi', where: "Oltalama Limanı" });
    expect(row("done", "silinmis")).toEqual({ kind: "done", text: '"bir oda" odasını biri bitirdi', where: null });
    expect(row("signup")).toEqual({ kind: "signup", text: "Yeni kayıt: bir öğrenci aramıza katıldı", where: null });
    expect(row("application", null, "Ankara", "Çankaya")).toEqual({ kind: "application", text: "Yeni öğretmenlik talebi geldi", where: "Ankara · Çankaya" });
    expect(row("badge", null, "ilk-rapor")?.text).toBe('Biri "İlk rapor" rozetini kazandı');
    expect(row("badge", null, "olmayan-rozet")).toBeNull();
    expect(row("tip_viewed")).toBeNull();
  });
});
