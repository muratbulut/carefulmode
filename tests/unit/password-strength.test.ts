import { describe, expect, it } from "vitest";
import { crackTime, evaluatePassword, personalTokens } from "@/lib/password-strength";

describe("şifre gücü", () => {
  it("boş şifrede hiçbir madde yanmaz ve kabul edilmez", () => {
    const e = evaluatePassword("");
    expect(e.score).toBe(0);
    expect(e.tone).toBe("info");
    expect(e.accepted).toBe(false);
  });

  it("yaygın şifreler, tek karakter tekrarı ve kısa rakam dizileri yaygın sayılır", () => {
    for (const password of ["123456", "password123", "Şifre123", "aaaaaaaaaaaa", "987654321"]) {
      const e = evaluatePassword(password);
      expect(e.common, password).toBe(true);
      expect(e.accepted, password).toBe(false);
      expect(e.tone, password).toBe("bad");
    }
  });

  it("doğum yılı ya da addan parça içeren şifre tahmin edilebilir sayılır", () => {
    const personal = personalTokens("Ayşe Yılmaz", "ayse.yilmaz@ornek.com");
    expect(evaluatePassword("Kediler!2009", personal).guessable).toBe(true);
    expect(evaluatePassword("yilmaz!Kedi42", personal).guessable).toBe(true);
    expect(evaluatePassword("Mavi!Kedi7Deniz", personal).guessable).toBe(false);
  });

  it("dört madde yanınca güçlü olur, kırılma süresi yüzyıldan uzun", () => {
    const e = evaluatePassword("Mavi!Kedi7Deniz");
    expect(e.checks).toEqual({ length: true, mix: true, symbol: true, safe: true });
    expect(e.tone).toBe("good");
    expect(e.accepted).toBe(true);
    expect(crackTime(e.crackSeconds).unit).toBe("century");
  });

  it("8 karakterden kısa şifre maddeler yansa da kabul edilmez", () => {
    const e = evaluatePassword("a1!b2?");
    expect(e.score).toBeGreaterThanOrEqual(3);
    expect(e.accepted).toBe(false);
  });

  it("eksik olan ilk şey söylenir: önce uzunluk, sonra sembol, sonra rakam", () => {
    expect(evaluatePassword("kedi7!").missing).toBe("length");
    expect(evaluatePassword("kediler7deniz").missing).toBe("symbol");
    expect(evaluatePassword("kediler!deniz").missing).toBe("digit");
  });

  it("kişisel parçalar en az 3 harfli, küçük harfli ve tekil", () => {
    expect(personalTokens("Ali Can", "ali.can@ornek.com", null)).toEqual(["ali", "can"]);
  });

  it("kırılma süresi okunur birime çevrilir", () => {
    expect(crackTime(0.2)).toEqual({ unit: "instant", amount: 0 });
    expect(crackTime(90)).toEqual({ unit: "minute", amount: 2 });
    expect(crackTime(3 * 86_400)).toEqual({ unit: "day", amount: 3 });
    expect(crackTime(31_536_000 * 500).unit).toBe("century");
  });
});
