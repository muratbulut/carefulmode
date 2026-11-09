import { describe, expect, it, vi } from "vitest";

// Sayaçlar burada bellekte tutulur; veritabanı istemcisi hiç kurulmaz.
vi.mock("@/lib/db", () => ({ db: {} }));

const { createRateLimiter, rateRules } = await import("@/lib/rate-limit");
type RateStore = Parameters<typeof createRateLimiter>[0];

/** Veritabanı deposuyla aynı kurallar: pencere ilk istekle başlar, süresi dolunca sıfırlanır. */
function memoryStore(clock: () => Date): RateStore {
  const rows = new Map<string, { count: number; resetAt: Date }>();
  return {
    async hit(key, windowSec) {
      const now = clock();
      const row = rows.get(key);
      const next =
        !row || row.resetAt <= now
          ? { count: 1, resetAt: new Date(now.getTime() + windowSec * 1000) }
          : { count: row.count + 1, resetAt: row.resetAt };
      rows.set(key, next);
      return next;
    },
    async get(key) {
      return rows.get(key) ?? null;
    },
    async delete(key) {
      rows.delete(key);
    },
  };
}

function setup() {
  let now = new Date("2026-10-11T10:00:00Z");
  const clock = () => now;
  const limiter = createRateLimiter(memoryStore(clock), clock);
  const advance = (sec: number) => (now = new Date(now.getTime() + sec * 1000));
  return { limiter, advance };
}

const rule = { name: "deneme", max: 3, windowSec: 60 };

describe("istek sınırı", () => {
  it("sınıra kadar izin verir, sonra kalan süreyi söyler", async () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 3; i++) expect((await limiter.consume(rule, "a@ornek.com")).allowed).toBe(true);
    advance(15);
    expect(await limiter.consume(rule, "a@ornek.com")).toEqual({ allowed: false, retryAfterSec: 45 });
  });

  it("pencere dolunca sayaç sıfırdan başlar", async () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 4; i++) await limiter.consume(rule, "a@ornek.com");
    advance(60);
    expect((await limiter.consume(rule, "a@ornek.com")).allowed).toBe(true);
    expect(await limiter.count(rule, "a@ornek.com")).toBe(1);
  });

  it("check saymadan bakar; sınır dolunca kilitli der", async () => {
    const { limiter } = setup();
    for (let i = 0; i < 2; i++) await limiter.consume(rule, "a@ornek.com");
    expect((await limiter.check(rule, "a@ornek.com")).allowed).toBe(true);
    expect(await limiter.count(rule, "a@ornek.com")).toBe(2);
    await limiter.consume(rule, "a@ornek.com");
    expect(await limiter.check(rule, "a@ornek.com")).toEqual({ allowed: false, retryAfterSec: 60 });
  });

  it("kimlik büyük-küçük harf ayırmaz, kurallar ve kimlikler birbirini etkilemez", async () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) await limiter.consume(rule, "A@Ornek.com");
    expect((await limiter.check(rule, "a@ornek.com")).allowed).toBe(false);
    expect((await limiter.check(rule, "b@ornek.com")).allowed).toBe(true);
    expect((await limiter.check({ ...rule, name: "baska" }, "a@ornek.com")).allowed).toBe(true);
  });

  it("reset sayacı siler (ör. başarılı girişten sonra)", async () => {
    const { limiter } = setup();
    for (let i = 0; i < 3; i++) await limiter.consume(rule, "a@ornek.com");
    await limiter.reset(rule, "a@ornek.com");
    expect(await limiter.count(rule, "a@ornek.com")).toBe(0);
    expect((await limiter.check(rule, "a@ornek.com")).allowed).toBe(true);
  });
});

describe("okul IP'si (sabah soruları 19)", () => {
  const classSize = 35;

  it("aynı IP'den aynı saatte üç sınıf kayıt olur, kod alır, kodu girer ve aynı 10 dakikada giriş yapar", async () => {
    const students = 3 * classSize;
    const { limiter } = setup();
    for (const rule of [rateRules.signUpIp, rateRules.codeSendIp, rateRules.codeVerifyIp, rateRules.signInIp]) {
      for (let i = 0; i < students; i++) expect((await limiter.consume(rule, "203.0.113.7")).allowed).toBe(true);
    }
  });

  it("e-posta başına sınırlar gevşemedi", () => {
    expect(rateRules.signInFailures.max).toBe(5);
    expect(rateRules.codeSendCooldown).toMatchObject({ max: 1, windowSec: 60 });
    expect(rateRules.codeSendHourly.max).toBe(6);
  });
});
