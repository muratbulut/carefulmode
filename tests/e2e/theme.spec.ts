import { expect, test } from "@playwright/test";

const DARK_BG = "rgb(11, 16, 32)";
const GRAY_BG = "rgb(221, 225, 232)";

const background = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("koyu / gri tema", () => {
  test("varsayılan tema koyu", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await background(page)).toBe(DARK_BG);
  });

  test("düğmeyle gri temaya geçer, yenileyince tercih kalır", async ({ page, context }) => {
    await page.goto("/");
    await page.getByTestId("theme-toggle").filter({ visible: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "gray");
    expect(await background(page)).toBe(GRAY_BG);

    const cookie = (await context.cookies()).find((c) => c.name === "theme");
    expect(cookie?.value).toBe("gray");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "gray");

    await page.getByTestId("theme-toggle").filter({ visible: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("gri tema ilk boyamadan önce uygulanır (yanıp sönme yok)", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "theme", value: "gray", url: baseURL! }]);
    // Sayfanın kendi betiklerinden önce, HTML ayrıştırılırken temayı kaydet.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { firstTheme: string | null }).firstTheme = document.documentElement.getAttribute("data-theme");
      });
    });
    await page.goto("/");
    expect(await page.evaluate(() => (window as unknown as { firstTheme: string | null }).firstTheme)).toBe("gray");
  });

  test("bozuk çerez değeri yok sayılır", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "theme", value: "pink", url: baseURL! }]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
