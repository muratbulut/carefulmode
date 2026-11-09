import { expect, test, type Page } from "@playwright/test";

/** Giriş bölümündeki dönen sahneler (components/landing/scenes/HeroScenes.tsx). */
const scenes = (page: Page) => page.getByTestId("hero-scenes");
const shownScene = (page: Page) => scenes(page).locator("[data-state=enter]");

/**
 * Sahte saatle açar. Saat kurulunca Next'in canlanması (requestIdleCallback) saatin ilerlemesini
 * bekler; biraz ilerletilir, sahne seçilir, çapraz solma biter. Gösterilen sahnenin numarasını döner.
 */
async function openWithClock(page: Page) {
  await page.clock.install();
  await page.goto("/");
  await page.clock.runFor(1_000);
  await expect(shownScene(page)).toHaveCount(1);
  await page.clock.runFor(700);
  await expect(scenes(page).locator(":scope > div")).toHaveCount(1);
  return shownScene(page).getAttribute("data-scene");
}

test.describe("tanıtım sayfası", () => {
  test("açılır ve ana bölümleri gösterir", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Careful Mode/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hacklenmeden önce, burada hacklen.");
    await expect(page.getByRole("region", { name: "Günün ipucu" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kısa kartlarla öğren" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bu hafta neler oldu?" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Yol haritası", level: 2 })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toContainText("Ücretsiz ve reklamsız");
    expect(errors).toEqual([]);
  });

  test("Hemen başla kayıt sayfasına götürür", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Hemen başla" })).toHaveAttribute("href", "/kayit");
  });

  test("günün ipucunda Neden? gerekçeyi açar ve kapatır", async ({ page }) => {
    // İpucu veritabanından gelir (havuz boşsa sabit ipucu); metne değil, açılan gerekçeye bakılır.
    await page.goto("/");
    const tip = page.getByRole("region", { name: "Günün ipucu" });
    await tip.getByRole("button", { name: "Neden?" }).click();
    const close = tip.getByRole("button", { name: "Kapat" });
    await expect(close).toHaveAttribute("aria-expanded", "true");
    await expect(tip.locator(`[id="${await close.getAttribute("aria-controls")}"]`)).toBeVisible();
  });

  test("giriş bölümünde tek sahne görünür, 10 saniyede bir değişir", async ({ page }) => {
    const first = await openWithClock(page);
    await expect(scenes(page).locator("figure")).toHaveCount(1);
    await expect(scenes(page).locator("figcaption")).toHaveText(/^Örnek: /);
    await expect(scenes(page).locator("[aria-live]")).toHaveCount(0);

    await page.clock.runFor(10_000);
    await expect(shownScene(page)).not.toHaveAttribute("data-scene", first!);
    // Çapraz solmada giden sahne 0,6 sn kalır (ekran okuyucudan gizli), sonra kaldırılır
    // (ayrıntısı birim testinde: tests/unit/hero-scenes.test.ts).
    await page.clock.runFor(700);
    await expect(scenes(page).locator(":scope > div")).toHaveCount(1);
  });

  test("fare sahnenin üstündeyken sahne değişmez, çıkınca devam eder", async ({ page }) => {
    const first = await openWithClock(page);
    await scenes(page).scrollIntoViewIfNeeded();
    await scenes(page).hover({ position: { x: 20, y: 20 } });
    await page.clock.runFor(30_000);
    await expect(shownScene(page)).toHaveAttribute("data-scene", first!);

    await page.mouse.move(0, 0);
    await page.clock.runFor(10_000);
    await expect(shownScene(page)).not.toHaveAttribute("data-scene", first!);
  });

  test("altı sahnenin hepsi bir turda bir kez gelir, hiçbiri alanından ve sayfadan taşmaz", async ({ page }) => {
    // Sahne alanın ortasına ölçeklenerek oturur (masaüstünde %90, telefonda genişliğe göre).
    const fits = () =>
      page.evaluate(() => {
        const area = document.querySelector("[data-testid=hero-scenes]")!.getBoundingClientRect();
        const scene = document.querySelector("[data-testid=hero-scenes] [data-state=enter] figure")!.getBoundingClientRect();
        const inside = scene.left >= area.left - 1 && scene.right <= area.right + 1 && scene.top >= area.top - 1 && scene.bottom <= area.bottom + 1;
        return inside && document.documentElement.scrollWidth <= document.documentElement.clientWidth;
      });
    const seen = [await openWithClock(page)];
    expect(await fits()).toBe(true);
    for (let i = 1; i < 6; i++) {
      await page.clock.runFor(10_000);
      await expect(shownScene(page)).not.toHaveAttribute("data-scene", seen[i - 1]!);
      seen.push(await shownScene(page).getAttribute("data-scene"));
      expect(await fits(), `sahne ${seen[i]}`).toBe(true);
    }
    expect(new Set(seen).size).toBe(6);
  });

  test("masaüstünde ilk ekran tek parça, bölümler arası boşluk dengeli", async ({ page, isMobile }) => {
    test.skip(isMobile, "telefonda bölümler doğal akışında kalır");
    await page.setViewportSize({ width: 1440, height: 900 });
    // Belirme kaydırması (32 px) ölçüyü oynatmasın: hareketi azaltta bantlar yerinde durur.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    // Kahraman üst menünün altındaki ekranı doldurur: günün ipucu ilk ekranda hiç görünmez.
    const tip = page.getByRole("region", { name: "Günün ipucu" });
    expect((await tip.boundingBox())!.y).toBeGreaterThanOrEqual(900);
    // Sonraki bantlar içerikleri kadar yer tutar: bir grubun son parçasıyla sonrakinin ilk parçası
    // arasında ne yapışık ne de ekran boyu boşluk kalır (globals.css, --landing-band-gap).
    const gaps = await page.evaluate(() => {
      const bands = Array.from(document.querySelectorAll<HTMLElement>(".landing-band"));
      const extent = (band: HTMLElement) => {
        let top = Infinity;
        let bottom = -Infinity;
        for (const part of band.querySelectorAll("section > *")) {
          const box = part.getBoundingClientRect();
          if (box.height === 0) continue;
          top = Math.min(top, box.top);
          bottom = Math.max(bottom, box.bottom);
        }
        return { top, bottom };
      };
      return bands.slice(1).map((band, i) => extent(band).top - extent(bands[i]!).bottom);
    });
    expect(gaps).toHaveLength(3);
    // Kahramanın altındaki boşluk ilk ekranı doldurmaktan gelir, sahneye göre biraz oynar; alt sınırı yeter.
    expect(gaps[0]).toBeGreaterThanOrEqual(100);
    for (const gap of gaps.slice(1)) {
      expect(gap).toBeGreaterThanOrEqual(100);
      expect(gap).toBeLessThanOrEqual(220);
    }
    // Ekrana gelen bant aşağıdan belirir; belirince tamamen görünür.
    const news = page.getByRole("heading", { name: "Bu hafta neler oldu?" });
    await page.locator('[data-landing-band="news"]').evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect(page.locator('[data-landing-band="news"]')).toHaveAttribute("data-reveal", "shown");
    await expect(news).toBeInViewport();
  });

  test("yatay kaydırma çubuğu çıkmaz", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("hareketi azalt", () => {
  test.use({ reducedMotion: "reduce" });

  test("tanıtım sahnesindeki hareketler durur", async ({ page }) => {
    await page.goto("/");
    // Sayfa canlanınca yedek Postam'ın yerine seçilen sahne gelir; ona bakılır (her sahnede süzülen bir parça var).
    const floating = shownScene(page).locator(".anim-float-1").first();
    await expect(floating).toBeAttached();
    expect(await floating.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("tek sahne seçilir ve değişmez", async ({ page }) => {
    const first = await openWithClock(page);
    await page.clock.runFor(60_000);
    await expect(shownScene(page)).toHaveAttribute("data-scene", first!);
    await expect(scenes(page).locator(":scope > div")).toHaveCount(1);
  });
});
