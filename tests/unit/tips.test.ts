import { describe, expect, it } from "vitest";
import { evaluateBadges, type ProgressFacts } from "@/lib/progress/badges";
import { dayLabel, weekdayLabel } from "@/lib/tips/format";
import { normalizeTipText, pinDayError, pinRange, reasonError, textError } from "@/lib/tips/rules";
import { addDays, dateToDay, dayToDate, daysBetween, isDayKey, pickForDay, planDays, turkeyDay, type ScheduleTip } from "@/lib/tips/schedule";

/** Havuzdaki ipucu; `createdAt` gün sırası kadar ms (eşitlikte önce yazılan). */
const tip = (id: string, over: Partial<ScheduleTip> = {}): ScheduleTip => ({
  id,
  status: "POOL",
  pinnedDay: null,
  createdAt: Number(id.replace(/\D/g, "")) || 0,
  lastShown: null,
  ...over,
});

describe("Türkiye günü", () => {
  it("Türkiye saatiyle gece yarısında gün değişir (UTC+3)", () => {
    expect(turkeyDay(new Date("2026-10-10T20:59:59Z"))).toBe("2026-10-10");
    expect(turkeyDay(new Date("2026-10-10T21:00:00Z"))).toBe("2026-10-11");
    expect(turkeyDay(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
  });

  it("gün anahtarı gerçek bir takvim günü olmalı", () => {
    expect(isDayKey("2026-10-11")).toBe(true);
    expect(isDayKey("2028-02-29")).toBe(true);
    expect(isDayKey("2026-02-29")).toBe(false);
    expect(isDayKey("2026-13-01")).toBe(false);
    expect(isDayKey("11.10.2026")).toBe(false);
    expect(isDayKey(20261011)).toBe(false);
  });

  it("veritabanı değeri UTC gece yarısıdır; gün ekleme ay ve yıl sınırını geçer", () => {
    expect(dayToDate("2026-10-11").toISOString()).toBe("2026-10-11T00:00:00.000Z");
    expect(dateToDay(new Date("2026-10-11T00:00:00Z"))).toBe("2026-10-11");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-11", "2026-10-17")).toBe(6);
  });

  it("günün ekrandaki adı", () => {
    expect(dayLabel("2026-10-14")).toBe("14 Ekim");
    expect(weekdayLabel("2026-10-14")).toBe("Çarşamba");
    expect(weekdayLabel("2026-10-11")).toBe("Pazar");
  });
});

describe("günün ipucunu seçme", () => {
  const today = "2026-10-11";

  it("havuz boşsa ipucu yok", () => {
    expect(pickForDay([], today)).toBeNull();
    expect(pickForDay([tip("t1", { status: "DRAFT" }), tip("t2", { status: "ARCHIVED" })], today)).toBeNull();
  });

  it("hiç gösterilmeyen önce çıkar, sonra en uzun süredir gösterilmeyen", () => {
    const tips = [tip("t1", { lastShown: "2026-10-01" }), tip("t2", { lastShown: "2026-09-20" }), tip("t3", { lastShown: "2026-10-10" })];
    expect(pickForDay(tips, today)).toEqual({ tipId: "t2", pinned: false });
    expect(pickForDay([...tips, tip("t9")], today)).toEqual({ tipId: "t9", pinned: false });
  });

  it("eşitlikte önce yazılan çıkar", () => {
    expect(pickForDay([tip("t5"), tip("t2"), tip("t7")], today)?.tipId).toBe("t2");
    expect(pickForDay([tip("t5", { lastShown: "2026-10-01" }), tip("t3", { lastShown: "2026-10-01" })], today)?.tipId).toBe("t3");
  });

  it("taslak ve arşivdeki ipucu öğrenciye gitmez", () => {
    expect(pickForDay([tip("t1", { status: "DRAFT" }), tip("t2", { lastShown: "2026-10-10" })], today)?.tipId).toBe("t2");
  });

  it("güne sabitlenen havuzdaki ipucu o günü alır", () => {
    const tips = [tip("t1"), tip("t2", { lastShown: "2026-10-01", pinnedDay: today })];
    expect(pickForDay(tips, today)).toEqual({ tipId: "t2", pinned: true });
  });

  it("taslağın sabit günü sayılmaz, gün otomatik kalır", () => {
    const tips = [tip("t1"), tip("t2", { status: "DRAFT", pinnedDay: today })];
    expect(pickForDay(tips, today)).toEqual({ tipId: "t1", pinned: false });
  });

  it("ileri bir güne ayrılan ipucu o güne kadar sıraya girmez, günü geçince girer", () => {
    const tips = [tip("t1", { lastShown: "2026-10-10" }), tip("t2", { pinnedDay: "2026-10-20" })];
    expect(pickForDay(tips, today)?.tipId).toBe("t1");
    expect(pickForDay([tip("t2", { pinnedDay: "2026-10-20" })], today)).toBeNull();
    expect(pickForDay([tip("t2", { pinnedDay: "2026-10-01", lastShown: "2026-10-01" })], today)?.tipId).toBe("t2");
  });
});

describe("sıradaki günlerin planı", () => {
  const today = "2026-10-11";

  it("havuz sırayla döner: her gün en uzun süredir gösterilmeyen", () => {
    const tips = [tip("t1", { lastShown: "2026-10-10" }), tip("t2", { lastShown: "2026-10-08" }), tip("t3", { lastShown: "2026-10-09" })];
    const plan = planDays(tips, today, 5);
    expect(plan.map((d) => d.day)).toEqual(["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]);
    expect(plan.map((d) => d.tipId)).toEqual(["t2", "t3", "t1", "t2", "t3"]);
    expect(plan.every((d) => !d.pinned)).toBe(true);
  });

  it("bugünün ipucu seçildiyse o kalır, sıra ondan sonra devam eder", () => {
    const tips = [tip("t1"), tip("t2"), tip("t3")];
    expect(planDays(tips, today, 4, "t3").map((d) => d.tipId)).toEqual(["t3", "t1", "t2", "t3"]);
    // Bugünün ipucu sonradan arşive kalksa da bugün onundur.
    expect(planDays([tip("t1"), tip("t3", { status: "ARCHIVED" })], today, 2, "t3").map((d) => d.tipId)).toEqual(["t3", "t1"]);
  });

  it("sabit gün atlanmaz; sabit ipucu başka günlerde sıraya girmez (Ipucu-C3-Bugun)", () => {
    const tips = [tip("t1"), tip("t2"), tip("t3", { pinnedDay: "2026-10-13" })];
    const plan = planDays(tips, today, 5);
    expect(plan.map((d) => d.tipId)).toEqual(["t1", "t2", "t3", "t1", "t2"]);
    expect(plan.map((d) => d.pinned)).toEqual([false, false, true, false, false]);
  });

  it("havuz boşsa günler boş kalır", () => {
    expect(planDays([], today, 3)).toEqual([
      { day: "2026-10-11", tipId: null, pinned: false },
      { day: "2026-10-12", tipId: null, pinned: false },
      { day: "2026-10-13", tipId: null, pinned: false },
    ]);
  });
});

describe("ipucu formunun kuralları", () => {
  it("ipucu 20-140, \"Neden?\" 20-400 karakter; boşluklar teke iner", () => {
    expect(normalizeTipText("  Bağlantıya   tıklamadan\nönce adresi oku. ")).toBe("Bağlantıya tıklamadan önce adresi oku.");
    expect(textError("Kısa ipucu")).toBe("textShort");
    expect(textError("x".repeat(20))).toBeNull();
    expect(textError("x".repeat(140))).toBeNull();
    expect(textError("x".repeat(141))).toBe("textLong");
    expect(textError(`${"x".repeat(10)}          ${"y".repeat(5)}`)).toBe("textShort");
    expect(reasonError("Çünkü.")).toBe("reasonShort");
    expect(reasonError("y".repeat(400))).toBeNull();
    expect(reasonError("y".repeat(401))).toBe("reasonLong");
  });

  it("sabitlenen gün yarından itibaren, en fazla bir yıl sonra", () => {
    const today = "2026-10-11";
    expect(pinDayError("2026-10-11", today)).toBe("dayPast");
    expect(pinDayError("2026-10-01", today)).toBe("dayPast");
    expect(pinDayError("2026-10-12", today)).toBeNull();
    expect(pinDayError(addDays(today, 366), today)).toBeNull();
    expect(pinDayError(addDays(today, 367), today)).toBe("dayFar");
    expect(pinDayError("2026-02-30", today)).toBe("dayInvalid");
    expect(pinDayError(null, today)).toBe("dayInvalid");
    expect(pinRange(today)).toEqual({ min: "2026-10-12", max: "2027-10-12" });
  });
});

describe("Meraklı rozeti", () => {
  const facts = (curiousDays: number): ProgressFacts => ({
    level: 1,
    completedTrainings: 0,
    neighborhoods: [],
    finishedScenarios: 0,
    bestScore: null,
    cameBack: false,
    inClassroom: false,
    curiousDays,
  });
  const merakli = (days: number) => evaluateBadges(facts(days)).find((b) => b.code === "merakli")!;

  it('7 farklı gün "Neden?"e bakınca kazanılır', () => {
    expect(merakli(6)).toMatchObject({ earned: false, progress: { kind: "days", value: 6, total: 7 } });
    expect(merakli(7)).toMatchObject({ earned: true, progress: { value: 7, total: 7 } });
    expect(merakli(12)).toMatchObject({ earned: true, progress: { value: 7 } });
  });
});
