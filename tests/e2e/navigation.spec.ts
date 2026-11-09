import { expect, test } from "@playwright/test";

test.describe("masaüstü üst menü", () => {
  test.skip(({ isMobile }) => isMobile, "sadece masaüstü");

  test("tasarımdaki bağlantılar sırayla görünür, alt menü gizli", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("navigation", { name: "Ana menü" });
    await expect(menu.getByRole("link")).toHaveText(["Yol haritası", "Odalar", "Gündem", "Öğretmenler için", "SSS"]);
    await expect(page.getByRole("link", { name: "Ücretsiz kayıt ol" }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Alt menü" })).toBeHidden();
  });
});

test.describe("telefon alt menüsü (M2)", () => {
  test.skip(({ isMobile }) => !isMobile, "sadece telefon");

  test("alt menü görünür, masaüstü menüsü gizli", async ({ page }) => {
    await page.goto("/");
    const bottomNav = page.getByRole("navigation", { name: "Alt menü" });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Ana sayfa" })).toHaveAttribute("aria-current", "page");
    await expect(bottomNav.getByRole("link", { name: "Ücretsiz kayıt ol" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeHidden();
  });

  test("Daha fazla penceresi açılır, Escape ve kapat düğmesiyle kapanır", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Daha fazla" }).click();
    const dialog = page.getByRole("dialog", { name: "Daha fazla" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("link")).toContainText(["Odalar", "Öğretmenler için", "SSS", "Giriş yap"]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Daha fazla" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Menüyü kapat" }).click();
    await expect(dialog).toBeHidden();
  });

  test("alt menü sayfanın son satırını örtmez", async ({ page }) => {
    await page.goto("/");
    const footerLink = page.getByRole("contentinfo").getByRole("link", { name: "KVKK" });
    const menu = page.getByRole("navigation", { name: "Alt menü" });
    // Sayfanın akışla gelen bölümleri kaydırmadan sonra sayfayı uzatabilir; en alta yeniden kaydırılır.
    await expect(async () => {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const link = (await footerLink.boundingBox())!;
      const nav = (await menu.boundingBox())!;
      expect(link.y + link.height).toBeLessThan(nav.y);
    }).toPass({ timeout: 10_000 });
  });
});
