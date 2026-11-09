import { describe, expect, it, vi } from "vitest";
import { dayOn, memberSince, timeAgo } from "@/lib/account/dates";
import { parseUserAgent } from "@/lib/account/user-agent";
import { avatarOf, avatars, isAvatarCode } from "@/lib/avatars";
import { getMessages } from "@/lib/i18n";

// action-helpers istek sınırlayıcıyı da yükler; veritabanı istemcisi kurulmasın.
vi.mock("@/lib/db", () => ({ db: {} }));
const { cleanName, nameOk, parseEducation } = await import("@/lib/account/action-helpers");

describe("tarayıcı kimliğinden cihaz adı", () => {
  const cases: [string, ReturnType<typeof parseUserAgent>][] = [
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      { kind: "desktop", browser: "Chrome", os: "Windows" },
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
      { kind: "desktop", browser: "Edge", os: "Windows" },
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      { kind: "phone", browser: "Safari", os: "iOS" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
      { kind: "phone", browser: "Samsung Internet", os: "Android" },
    ],
    [
      "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      { kind: "tablet", browser: "Chrome", os: "Android" },
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0 Mobile/15E148 Safari/604.1",
      { kind: "tablet", browser: "Chrome", os: "iOS" },
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:130.0) Gecko/20100101 Firefox/130.0",
      { kind: "desktop", browser: "Firefox", os: "macOS" },
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/113.0.0.0",
      { kind: "desktop", browser: "Opera", os: "Linux" },
    ],
  ];

  it.each(cases)("%s", (ua, expected) => {
    expect(parseUserAgent(ua)).toEqual(expected);
  });

  it("boş ya da tanınmayan kimlik bilgisayar sayılır", () => {
    expect(parseUserAgent(null)).toEqual({ kind: "desktop", browser: null, os: null });
    expect(parseUserAgent("curl/8.5.0")).toEqual({ kind: "desktop", browser: null, os: null });
  });
});

describe("profil tarihleri", () => {
  it("üyelik ayı ve silme günü Türkiye saatine göre yazılır", () => {
    expect(memberSince(new Date("2026-10-18T09:00:00Z"))).toBe("Üyelik: Ekim 2026");
    // UTC'de 31 Aralık 22:00, İstanbul'da 1 Ocak 01:00.
    expect(memberSince(new Date("2026-12-31T22:00:00Z"))).toBe("Üyelik: Ocak 2027");
    expect(dayOn(new Date("2026-10-18T09:00:00Z"))).toBe("18 Ekim'de");
    expect(dayOn(new Date("2026-06-01T09:00:00Z"))).toBe("1 Haziran'da");
  });

  it("son kullanım göreli yazılır, bir dakikadan yeniyse boş kalır", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const ago = (seconds: number) => timeAgo(new Date(now.getTime() - seconds * 1000), now);
    expect(ago(30)).toBeNull();
    expect(ago(5 * 60)).toBe("5 dakika önce");
    expect(ago(3 * 60 * 60)).toBe("3 saat önce");
    expect(ago(24 * 60 * 60)).toBe("dün");
    expect(ago(3 * 24 * 60 * 60)).toBe("3 gün önce");
    expect(ago(14 * 24 * 60 * 60)).toBe("2 hafta önce");
  });

  it("ay adları sözlükte 12 tane", () => {
    expect(getMessages().profile.months).toHaveLength(12);
    expect(getMessages().profile.monthsOn).toHaveLength(12);
  });
});

describe("avatarlar", () => {
  it("her avatarın sözlükte adı ve tek bir kodu var", () => {
    const names = getMessages().profile.avatar.names;
    expect(new Set(avatars.map((a) => a.code)).size).toBe(avatars.length);
    for (const avatar of avatars) expect(names[avatar.code], avatar.code).toBeTruthy();
  });

  it("listede olmayan kod kabul edilmez", () => {
    expect(isAvatarCode("robot")).toBe(true);
    expect(isAvatarCode("unicorn")).toBe(false);
    expect(isAvatarCode(undefined)).toBe(false);
  });

  it("seçilmemişse kimlikten hep aynı avatar çıkar", () => {
    const first = avatarOf({ id: "kullanici-1", avatar: null });
    expect(avatarOf({ id: "kullanici-1" })).toBe(first);
    expect(avatars).toContain(first);
    expect(avatarOf({ id: "kullanici-1", avatar: "dragon" }).code).toBe("dragon");
    expect(avatarOf({ id: "kullanici-1", avatar: "bilinmeyen" })).toBe(first);
  });
});

describe("profil formu", () => {
  it("görünen ad boşlukları temizlenir, 2-24 karakter olmalı", () => {
    expect(cleanName("  Siber   Ayşe ")).toBe("Siber Ayşe");
    expect(nameOk("A")).toBe(false);
    expect(nameOk("Ay")).toBe(true);
    expect(nameOk("x".repeat(24))).toBe(true);
    expect(nameOk("x".repeat(25))).toBe(false);
  });

  it("eğitim durumu listede olmayan değerleri kaydetmez", () => {
    expect(parseEducation("STUDYING", "Lise", "")).toEqual({ educationStatus: "STUDYING", gradeLevel: "Lise" });
    expect(parseEducation("GRADUATED", "Lisans mezunu", "  Bilgisayar   Mühendisliği ")).toEqual({
      educationStatus: "GRADUATED",
      gradeLevel: "Lisans mezunu · Bilgisayar Mühendisliği",
    });
    // Ortaokul ve lisede bölüm sorulmaz, gönderilse de eklenmez.
    expect(parseEducation("STUDYING", "Lise", "Fen").gradeLevel).toBe("Lise");
    expect(parseEducation("STUDYING", "Doktora", "")).toEqual({ educationStatus: "STUDYING", gradeLevel: undefined });
    expect(parseEducation("ADMIN", "Lise", "")).toEqual({ educationStatus: undefined, gradeLevel: undefined });
    expect(parseEducation("", "", "")).toEqual({ educationStatus: undefined, gradeLevel: undefined });
  });
});
