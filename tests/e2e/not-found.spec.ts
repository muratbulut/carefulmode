import { expect, test } from "@playwright/test";

test("olmayan adres 404 döner ve yol gösterir", async ({ page }) => {
  const response = await page.goto("/boyle-bir-sayfa-yok");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
  await expect(page.getByRole("link", { name: "Ana sayfaya dön" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("navigation", { name: "Önerilen sayfalar" }).getByRole("link")).toHaveCount(3);

  await page.getByRole("link", { name: "Ana sayfaya dön" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hacklenmeden önce, burada hacklen.");
});
