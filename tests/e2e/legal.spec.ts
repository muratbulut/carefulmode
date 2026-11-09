import { expect, test } from "@playwright/test";

const documents = [
  { path: "/kvkk", title: "KVKK aydınlatma metni", first: "Veri sorumlusu", sections: 7 },
  { path: "/gizlilik", title: "Gizlilik politikası", first: "Çerezler", sections: 5 },
  { path: "/kosullar", title: "Kullanım koşulları", first: "Kimler kullanabilir?", sections: 6 },
];

test.describe("yasal sayfalar", () => {
  for (const doc of documents) {
    test(`${doc.path} başlıklarıyla açılır`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      const response = await page.goto(doc.path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(new RegExp(doc.title));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(doc.title);
      const headings = page.getByRole("heading", { level: 2 });
      await expect(headings).toHaveCount(doc.sections);
      await expect(headings.first()).toContainText(doc.first);
      await expect(page.getByText("TASLAK", { exact: true })).toBeVisible();
      await expect(page.getByText("Bu metin taslaktır", { exact: false })).toBeVisible();

      const tabs = page.getByRole("navigation", { name: "Belgeler" });
      await expect(tabs.getByRole("link")).toHaveCount(3);
      await expect(tabs.locator('[aria-current="page"]')).toHaveAttribute("href", doc.path);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  }

  test("üstteki sekmeler belgeler arasında geçer", async ({ page }) => {
    await page.goto("/kvkk");
    const tabs = page.getByRole("navigation", { name: "Belgeler" });
    await tabs.getByRole("link", { name: "Gizlilik" }).click();
    await expect(page).toHaveURL(/\/gizlilik$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gizlilik politikası");
    await tabs.getByRole("link", { name: "Koşullar" }).or(tabs.getByRole("link", { name: "Kullanım koşulları" })).click();
    await expect(page).toHaveURL(/\/kosullar$/);
  });

  test("bilinmeyenler köşeli parantezli yer tutucu olarak görünür", async ({ page }) => {
    await page.goto("/kvkk");
    await expect(page.getByText("[VERİ SORUMLUSU]", { exact: false }).first()).toBeAttached();
    await expect(page.getByText("[KVKK BAŞVURU E-POSTASI]", { exact: false }).first()).toBeVisible();
  });
});

test.describe("Sadece kısaca oku (masaüstü)", () => {
  test.skip(({ isMobile }) => isMobile, "sadece masaüstü");

  test("tam metin yanda durur, düğmeyle gizlenir ve geri gelir", async ({ page }) => {
    await page.goto("/kvkk");
    const full = page.getByText("6698 sayılı Kişisel Verilerin Korunması Kanunu", { exact: false });
    const short = page.getByText("Bu sitedeki bilgilerinden", { exact: false });
    const toggle = page.getByRole("switch", { name: "Sadece kısaca oku" });
    await expect(full).toBeVisible();
    await expect(page.getByRole("button", { name: "Tam metin" }).first()).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(full).toBeHidden();
    await expect(short).toBeVisible();

    await toggle.click();
    await expect(full).toBeVisible();
  });
});

test.describe("Sadece kısaca oku (telefon)", () => {
  test.skip(({ isMobile }) => !isMobile, "sadece telefon");

  test("tam metin Tam metin ile açılır; sadece kısaca açıkken düğmeler gizlenir", async ({ page }) => {
    await page.goto("/kvkk");
    const full = page.getByText("6698 sayılı Kişisel Verilerin Korunması Kanunu", { exact: false });
    const more = page.getByRole("button", { name: "Tam metin" });
    await expect(full).toBeHidden();
    await expect(more).toHaveCount(7);

    await more.first().click();
    await expect(more.first()).toHaveAttribute("aria-expanded", "true");
    await expect(full).toBeVisible();

    await page.getByRole("switch", { name: "Sadece kısaca oku" }).click();
    await expect(full).toBeHidden();
    await expect(more).toHaveCount(0);
    await expect(page.getByText("Bu sitedeki bilgilerinden", { exact: false })).toBeVisible();
  });
});
