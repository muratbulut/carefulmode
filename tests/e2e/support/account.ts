import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { withDb } from "./db";
import { mailOutboxDir } from "./outbox-dir";

/** Canlı siteye karşı mı koşuluyor? Hesap açan testler orada atlanır (gerçek kullanıcı ve mail oluşmasın). */
export const isLive = !!process.env.PW_BASE_URL;

let counter = 0;
export function uniqueEmail(tag: string) {
  counter++;
  return `e2e-${tag}-${Date.now()}-${process.pid}-${counter}@ornek.com`;
}

/** Bu tasarım kurallarını sağlayan güçlü bir şifre (12+ karakter, harf, rakam, sembol). */
export const strongPassword = "Mavi!Kedi7Deniz";

type Mail = { to: string; subject: string; text: string; sentAt: string };

/** Adrese giden en son kod mailini bekler ve kodu döner. `after` verilirse ondan sonra gelen. */
export async function waitForCode(email: string, after?: string): Promise<string> {
  let found: Mail | undefined;
  await expect
    .poll(
      async () => {
        const files = await readdir(mailOutboxDir).catch(() => [] as string[]);
        const mails = await Promise.all(
          files.map(async (f) => JSON.parse(await readFile(path.join(mailOutboxDir, f), "utf8")) as Mail),
        );
        found = mails
          .filter((m) => m.to === email && (!after || m.sentAt > after))
          .sort((a, b) => a.sentAt.localeCompare(b.sentAt))
          .at(-1);
        return !!found;
      },
      { timeout: 15_000, message: `kod maili gelmedi: ${email}` },
    )
    .toBe(true);
  const match = found!.text.match(/(\d{3}) (\d{3})/);
  if (!match) throw new Error("mailde kod yok");
  return match[1] + match[2];
}

export async function mailCount(email: string) {
  const files = await readdir(mailOutboxDir).catch(() => [] as string[]);
  const mails = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(mailOutboxDir, f), "utf8")) as Mail));
  return mails.filter((m) => m.to === email).length;
}

/**
 * Adrese yeni kod gönderilmeden önceki 60 saniyelik beklemeyi kaldırır. Kayıttan hemen sonra
 * şifre sıfırlama gibi akışları beklemeden denemek için (anahtar biçimi: lib/rate-limit.ts).
 */
export async function skipCodeCooldown(email: string) {
  await withDb((client) => client.query('DELETE FROM "RateLimit" WHERE "key" = $1', [`code-cooldown:${email}`]));
}

/**
 * Bütün testler aynı IP'den kayıt olur ve kod ister; IP başına saatlik kayıt ve kod sınırları
 * (lib/rate-limit.ts, `sign-up-ip`, `code-ip`) test sayısı arttıkça koşunun ortasında dolar.
 * Sınırların kendisi birim testlerinde sınanır.
 */
async function resetIpLimits() {
  await withDb((client) => client.query(`DELETE FROM "RateLimit" WHERE "key" LIKE 'sign-up-ip:%' OR "key" LIKE 'code-ip:%'`));
}

/** Kayıt formunu doldurur ve gönderir; doğrulama sayfasına gelindiğini bekler. */
export async function signUp(page: Page, email: string, { next }: { next?: string } = {}) {
  await resetIpLimits();
  await page.goto(next ? `/kayit?sonra=${encodeURIComponent(next)}` : "/kayit");
  await page.getByLabel("Görünen ad").fill("Deneme Öğrenci");
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(strongPassword);
  await page.getByLabel("Doğum yılı").selectOption("2000");
  await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
  await page.getByRole("button", { name: "Hesabımı oluştur" }).click();
  await page.waitForURL(/\/dogrula/);
}

/** 6 kutulu kod girişine kodu yazar (ilk kutuya yapıştırır gibi). */
export async function typeCode(page: Page, code: string) {
  await page.getByLabel("Kodun 1. rakamı").fill(code);
}

/** Kayıt olur ve maildeki kodla doğrular; ana sayfaya dönülünce biter. */
export async function signUpVerified(page: Page, email: string) {
  await signUp(page, email);
  await typeCode(page, await waitForCode(email));
  await page.getByRole("button", { name: "Doğrula", exact: true }).click();
  await page.waitForURL("/");
}

/** Açık giriş formunu doldurup gönderir. */
export async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
}

/** Oturum çerezini siler (başka cihazdan dönüş gibi). */
export async function signOutHere(context: BrowserContext) {
  await context.clearCookies({ name: /better-auth\./ });
}

