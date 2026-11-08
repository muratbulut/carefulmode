import { expect, test, type Page } from "@playwright/test";
import { isLive, signUp, skipCodeCooldown, typeCode, uniqueEmail, waitForCode } from "./support/account";
import { withDb } from "./support/db";

// Güvenlik turu 2: doğrulanmamış hesapta adresi değiştirmek (doğrulama sayfasındaki "Değiştir")
// ile eski adrese gelen kodla doğrulamak yarışırsa, kanıtlanmamış yeni adres doğrulanmış
// sayılmamalı. Sayılsaydı ADMIN_EMAILS'teki bir adresi yazan biri yönetici olurdu.

test.skip(isLive, "hesap açan test canlı sitede çalışmaz");
// Hesap kuralı; ekran düzeniyle ilgisi yok, telefonda ayrıca koşmaz.
test.skip(({ isMobile }) => isMobile, "yalnızca masaüstünde");
// Turlar uzun sürer (her turda yeni hesap ve kod maili): yerelde ~30 sn, CI'nın 2 çekirdekli
// makinesinde iki işçiyle 2 dakikayı aşabiliyor.
test.describe.configure({ timeout: 240_000 });

// İki istek arasındaki fark her turda biraz değişir; yarış penceresi makineye göre kayar.
// Düzeltmeden önce kendi kopyamızda doğrulamada +8 ms, şifre sıfırlamada +15 ms farkla
// kanıtlanmamış adres doğrulanmış kalıyordu (docs/security/round-2-phase-3.md, Y1).

const postTo = (page: Page, path: string) => page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === path);

async function accountOf(emails: string[]) {
  return withDb(async (client) => {
    const result = await client.query<{ email: string; emailVerified: boolean }>(`SELECT email, "emailVerified" FROM "User" WHERE email = ANY($1)`, [emails]);
    return result.rows[0];
  });
}

test("adres değiştirme ile kodla doğrulama aynı anda gelirse yeni adres doğrulanmış sayılmaz", async ({ browser }) => {
  for (let round = 0; round < 16; round++) {
    const own = uniqueEmail("yaris");
    const target = uniqueEmail("hedef");
    const context = await browser.newContext();
    const verify = await context.newPage();
    await signUp(verify, own);
    await typeCode(verify, await waitForCode(own));

    // Aynı oturumda ikinci sekme: adres değiştirme formu, gönderilmeye hazır.
    const change = await context.newPage();
    await change.goto("/dogrula");
    await change.getByRole("button", { name: "Değiştir" }).click();
    await change.getByLabel("Yeni e-posta adresin").fill(target);

    const done = Promise.all([postTo(verify, "/dogrula"), postTo(change, "/dogrula")]);
    // Adres değiştirme, doğrulamadan -6..+8 ms sonra.
    const offset = (round % 8) * 2 - 6;
    await Promise.all([
      change.evaluate((ms) => new Promise<void>((resolve) => setTimeout(() => { (document.querySelector("#new-email")!.closest("form") as HTMLFormElement).requestSubmit(); resolve(); }, Math.max(0, ms))), offset),
      verify.evaluate((ms) => new Promise<void>((resolve) => setTimeout(() => { document.querySelector<HTMLButtonElement>("form button[type=submit]")!.click(); resolve(); }, Math.max(0, -ms))), offset),
    ]);
    await done;

    const row = await accountOf([own, target]);
    expect(row, "hesap bulunamadı").toBeTruthy();
    // Doğrulanmışsa adres, kodla kanıtlanan adrestir; kanıtlanmamış yeni adres asla.
    if (row!.emailVerified) expect(row!.email, `tur ${round}`).toBe(own);
    await context.close();
  }
});

test("adres değiştirme ile eski adrese gelen kodla şifre sıfırlama aynı anda gelirse yeni adres doğrulanmış sayılmaz", async ({ browser }) => {
  for (let round = 0; round < 8; round++) {
    const own = uniqueEmail("sifirla-yaris");
    const target = uniqueEmail("hedef");
    const owner = await browser.newContext();
    const change = await owner.newPage();
    await signUp(change, own);
    await waitForCode(own);
    await skipCodeCooldown(own);

    const visitor = await browser.newContext();
    const reset = await visitor.newPage();
    const before = new Date().toISOString();
    await reset.goto("/sifre-sifirla");
    await reset.getByRole("button", { name: "Anladım, başlayalım" }).click();
    await reset.getByLabel("E-posta").fill(own);
    await reset.getByRole("button", { name: "Kod gönder" }).click();
    await reset.getByRole("button", { name: "Kodu girmeye geç" }).click();
    await typeCode(reset, await waitForCode(own, before));
    await reset.getByRole("button", { name: "Devam" }).click();
    await reset.getByLabel("Yeni şifre").fill("Yesil?Bulut42Kar");

    await change.getByRole("button", { name: "Değiştir" }).click();
    await change.getByLabel("Yeni e-posta adresin").fill(target);

    const done = Promise.all([postTo(change, "/dogrula"), postTo(reset, "/sifre-sifirla")]);
    // Adres değiştirme, şifre sıfırlamadan -30..+75 ms sonra.
    const offset = round * 15 - 30;
    await Promise.all([
      change.evaluate((ms) => new Promise<void>((resolve) => setTimeout(() => { (document.querySelector("#new-email")!.closest("form") as HTMLFormElement).requestSubmit(); resolve(); }, Math.max(0, ms))), offset),
      reset.evaluate((ms) => new Promise<void>((resolve) => setTimeout(() => { document.querySelector<HTMLButtonElement>("form button[type=submit]")!.click(); resolve(); }, Math.max(0, -ms))), offset),
    ]);
    await done;

    const row = await accountOf([own, target]);
    expect(row, "hesap bulunamadı").toBeTruthy();
    if (row!.emailVerified) expect(row!.email, `tur ${round}`).toBe(own);
    await owner.close();
    await visitor.close();
  }
});
