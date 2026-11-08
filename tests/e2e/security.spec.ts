import { expect, test } from "@playwright/test";
import { isLive, signUp, uniqueEmail } from "./support/account";

test("sayfalar güvenlik başlıklarıyla gelir", async ({ request, baseURL }) => {
  for (const path of ["/", "/boyle-bir-sayfa-yok", "/api/health"]) {
    const h = (await request.get(path)).headers();
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"], path).toContain("camera=()");
    // İçerik Güvenliği Politikası (yönerge yönerge denetimi ve sayfalarda ihlal yok: csp.spec.ts).
    expect(h["content-security-policy"], path).toContain("default-src 'self'");
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(h["cross-origin-opener-policy"], path).toBe("same-origin");
    expect(h["x-powered-by"], path).toBeUndefined();
    // HSTS'yi ters vekil ekler; yalnızca canlı (HTTPS) adreste aranır. includeSubDomains yalnızca
    // bu adın alt adlarını bağlar; preload yok (güvenlik turu 5).
    if (baseURL?.startsWith("https://")) {
      expect(h["strict-transport-security"], path).toBe("max-age=31536000; includeSubDomains");
    }
  }
});

// Güvenlik turu 1 (Faz 1+2): oturum çerezinin korumalarını sabitler.
// Çerez çalınırsa oturum çalınır; bu yüzden tarayıcıdaki JS'ten okunamamalı ve HTTPS'te Secure olmalı.
test.describe("oturum çerezi korumalı", () => {
  test.skip(isLive, "hesap açan test canlı sitede çalışmaz");

  test("httpOnly, SameSite=Lax ve JS'ten okunamaz", async ({ page, context, baseURL }) => {
    await signUp(page, uniqueEmail("cerez"));

    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name.includes("session_token"));
    expect(session, "oturum çerezi bulunamadı").toBeTruthy();
    // JS çereze erişemez: XSS olsa bile oturum belirteci çalınamaz.
    expect(session!.httpOnly).toBe(true);
    // Çapraz siteden gelen POST'larda çerez gitmez: kimlikli eylemler CSRF'e kapalı.
    expect(session!.sameSite).toBe("Lax");
    if (baseURL?.startsWith("https://")) {
      // Canlıda (HTTPS) çerez yalnızca şifreli bağlantıda gider ve __Secure- öneki alır.
      expect(session!.secure).toBe(true);
      expect(session!.name.startsWith("__Secure-")).toBe(true);
    }

    // document.cookie oturum belirtecini görmemeli (yalnızca httpOnly olmayan tema çerezi görünebilir).
    const viaJs = await page.evaluate(() => document.cookie);
    expect(viaJs).not.toContain("session_token");
  });
});
