import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { attemptsOf, finishTraining } from "./support/lab";

// Güvenlik turu 2 (Faz 3): lab motorunun korumalarını sabitler. Doğru kararlar ve rapor
// metinleri öğrencinin tarayıcısına hiç gitmez; sahte sayfa, tıklama kaydedilmeden açılmaz.

const kargo = JSON.parse(readFileSync("labs/examples/sahte-kargo-maili.json", "utf8")).content;
const training = JSON.parse(readFileSync("labs/examples/oltalama-egitimi.json", "utf8")).content;
const playPath = "/oda/sahte-kargo-maili/oyna";

/** Yalnızca sunucuda kalması gereken metinler: neden, işaretler, sahte sayfa, açıklamalar, ipuçları. */
const serverOnly: string[] = [
  ...kargo.items.flatMap((i: { why: string; signs: { text: string }[] }) => [i.why, ...i.signs.map((s) => s.text)]),
  kargo.trap.title,
  kargo.trap.text,
  ...kargo.tasks.flatMap((t: { right?: string; why?: string }) => [t.right ?? "", t.why ?? ""]),
  ...kargo.tips.map((t: { text: string }) => t.text),
  ...training.cards.flatMap((c: { spots?: { text: string }[]; explain?: string }) => [...(c.spots ?? []).map((s) => s.text), c.explain ?? ""]),
].filter((text) => text.trim().length > 0);

/** Metnin HTML ve RSC kaçışından etkilenmeyen en uzun parçası (harf, rakam, boşluk). */
const fragment = (text: string) => (text.match(/[\p{L}\p{N} ]{12,}/gu) ?? [text]).sort((a, b) => b.length - a.length)[0].trim();

test.describe("lab güvenliği", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");

  test("öğrencinin sayfalarında doğru kararlar, işaretler ve açıklamalar yok", async ({ page }) => {
    const email = uniqueEmail("sizinti");
    await signUpVerified(page, email);
    await finishTraining(email);
    // Yarım deneme de olsun: oynatıcı kaldığı yerden açılırken de bir şey sızmamalı.
    await page.goto(playPath);
    await page.getByRole("button", { name: "Hazırım, başla" }).click();
    await expect(page.getByTestId("scenario-player")).toBeVisible();

    const paths = ["/", "/odalar", "/yol-haritasi", "/oda/sahte-kargo-maili", playPath, "/oda/oltalama-egitimi", "/oda/oltalama-egitimi/oyna"];
    for (const path of paths) {
      // Ham yanıt: görünen HTML ile birlikte React'in tarayıcıya giden verisi (RSC) de içinde.
      const response = await page.request.get(path);
      expect(response.status(), path).toBe(200);
      const html = await response.text();
      for (const text of serverOnly) expect(html, `${path}: "${fragment(text)}"`).not.toContain(fragment(text));
      expect(html, path).not.toMatch(/\\?"kind\\?":\\?"(fake|real)\\?"/);
    }
  });

  test("aynı deneme iki sekmede açıkken sahte sayfa, tıklama kaydedilmeden açılmaz", async ({ page, context, isMobile }) => {
    const email = uniqueEmail("iki-sekme");
    await signUpVerified(page, email);
    await finishTraining(email);
    await page.goto(playPath);
    await page.getByRole("button", { name: "Hazırım, başla" }).click();
    // Deneme sunucuda açılınca başlangıç penceresi kapanır; ikinci sekme ancak ondan sonra açılır.
    await expect(page.getByRole("button", { name: "Hazırım, başla" })).toBeHidden();

    // İkinci sekme denemeyi kaldığı yerden (henüz olay yokken) açar.
    const other = await context.newPage();
    await other.goto(playPath);
    await expect(other.getByTestId("scenario-player")).toBeVisible();

    // İlk sekmede iki mail açılır; olaylar sunucuya yazılana kadar beklenir.
    await openMail(page, "okul", isMobile);
    await openMail(page, "market", isMobile);
    await expect.poll(async () => (await attemptsOf(email, "sahte-kargo-maili"))[0]?.events.match(/item_opened/g)?.length ?? 0).toBe(2);

    // İkinci sekmenin sıra numaraları ilk sekmeninkilerle çakışır. Bağlantı ya hiç açılmaz ya da
    // açıldıysa tıklama sunucuda kayıtlıdır; tıklama kaydı atlanıp sahte sayfa gösterilemez.
    await openMail(other, "kargo", isMobile);
    await other.getByRole("button", { name: "Adresi güncelle" }).click();
    const trapForm = other.getByLabel(/Postam şifresi/);
    await expect(trapForm.or(other.getByRole("status").filter({ hasText: "Bir sorun çıktı", visible: true }))).toBeVisible();
    const clicked = async () => (await attemptsOf(email, "sahte-kargo-maili"))[0].events.includes("link_clicked");
    if (await trapForm.isVisible()) expect(await clicked()).toBe(true);
    else {
      // Yeniden tıklayınca boş bir sıra numarası alır: sayfa açılır ve tıklama kaydedilir.
      await other.getByRole("button", { name: "Adresi güncelle" }).click();
      await expect(trapForm).toBeVisible();
      expect(await clicked()).toBe(true);
    }
  });
});

async function openMail(page: Page, id: string, isMobile: boolean) {
  const item = kargo.items.find((i: { id: string }) => i.id === id);
  const app = page.getByTestId("scenario-player");
  await app.getByRole("button", { name: new RegExp(`^${item.sender}`) }).click();
  await expect(app.getByRole("heading", { name: item.subject })).toBeVisible();
  if (isMobile && id !== "kargo") await page.getByRole("button", { name: "Listeye dön" }).click();
}
