import { describe, expect, it } from "vitest";
import { apiErrorCode, deadlineFrom, formatClock, isDeleteWord, isMinor, mayBeMinor, safeNext, splitGradeLevel, withNext } from "@/lib/account/shared";

describe("dönüş adresi (?sonra=)", () => {
  it("sitenin kendi sayfalarına izin verir", () => {
    expect(safeNext("/oda/oltalama-kargo")).toBe("/oda/oltalama-kargo");
    expect(safeNext("/profil?sekme=guvenlik")).toBe("/profil?sekme=guvenlik");
  });

  it("başka siteye yönlendirmeyi reddeder", () => {
    for (const value of [
      "https://kotu.site",
      "//kotu.site",
      "/\\kotu.site",
      "\\\\kotu.site",
      "/\t/kotu.site",
      "/\n/kotu.site",
      "javascript:alert(1)",
      "",
      undefined,
      ["/oda"],
    ]) {
      expect(safeNext(value, "/"), String(value)).toBe("/");
    }
  });

  it("withNext adresi kodlayarak ekler, güvenli değilse ana sayfaya döner", () => {
    expect(withNext("/giris", "/oda/a?b=1")).toBe("/giris?sonra=%2Foda%2Fa%3Fb%3D1");
    expect(withNext("/giris", "//kotu.site")).toBe("/giris?sonra=%2F");
    expect(withNext("/giris")).toBe("/giris");
  });
});

describe("hesap yardımcıları", () => {
  it("geri sayım saati dakika:saniye biçiminde", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(59)).toBe("0:59");
    expect(formatClock(125)).toBe("2:05");
  });

  it("bekleme süresi yoksa geri sayım da yok", () => {
    expect(deadlineFrom(undefined, 1000)).toBeUndefined();
    expect(deadlineFrom(0, 1000)).toBeUndefined();
    expect(deadlineFrom(60, 1000)).toEqual({ from: 1000, until: 61_000 });
  });

  it("18 yaşından küçük olma yıl farkıyla bulunur", () => {
    const year = new Date().getFullYear();
    expect(isMinor(year - 13)).toBe(true);
    expect(isMinor(year - 17)).toBe(true);
    expect(isMinor(year - 18)).toBe(false);
  });

  it("öğretmenlik talebindeki uyarı bu yıl 18'ini dolduranı da kapsar; doğum yılı yoksa uyarı yok", () => {
    const now = new Date("2026-10-12T12:00:00Z");
    expect(mayBeMinor(2011, now)).toBe(true);
    expect(mayBeMinor(2008, now)).toBe(true);
    expect(mayBeMinor(2007, now)).toBe(false);
    expect(mayBeMinor(1990, now)).toBe(false);
    expect(mayBeMinor(null, now)).toBe(false);
  });

  it("Better Auth hata kodu gövdeden okunur", () => {
    expect(apiErrorCode({ body: { code: "INVALID_OTP" } })).toBe("INVALID_OTP");
    expect(apiErrorCode(new Error("x"))).toBeUndefined();
    expect(apiErrorCode(null)).toBeUndefined();
  });
});

describe("profil yardımcıları", () => {
  it("silme onayı büyük-küçük harfe bakmaz, Türkçe İ'yi doğru çevirir", () => {
    for (const value of ["SİL", "sil", " Sil ", "sİl"]) expect(isDeleteWord(value, "SİL"), value).toBe(true);
    // "sil".toUpperCase() Türkçe olmayan kurala göre "SIL" olurdu.
    for (const value of ["SIL", "sıl", "si l", "", "SİLL"]) expect(isDeleteWord(value, "SİL"), value).toBe(false);
  });

  it("kayıtlı kademe ve bölüm profil formu için ayrılır", () => {
    expect(splitGradeLevel("STUDYING", "Lise")).toEqual({ status: "STUDYING", level: "Lise", department: "" });
    expect(splitGradeLevel("GRADUATED", "Lisans mezunu · Bilgisayar Mühendisliği")).toEqual({
      status: "GRADUATED",
      level: "Lisans mezunu",
      department: "Bilgisayar Mühendisliği",
    });
    expect(splitGradeLevel(null, "Lise")).toEqual({ status: "", level: "", department: "" });
    // Listede olmayan kademe (eski kayıt ya da durum değişmiş) boş gelir.
    expect(splitGradeLevel("STUDYING", "Lise mezunu")).toEqual({ status: "STUDYING", level: "", department: "" });
    expect(splitGradeLevel("STUDYING", null)).toEqual({ status: "STUDYING", level: "", department: "" });
  });
});
