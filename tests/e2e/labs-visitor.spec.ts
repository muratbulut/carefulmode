import { expect, test } from "@playwright/test";

// Ziyaretçi: siber şehir, mahalle sayfası ve lablar kataloğu açık; labın kendisi kayıtla açılır.
// Örnek veride Oltalama Limanı'nda eğitim labı ve "Sahte kargo maili" senaryosu var (labs/examples).


test("siber şehir: mahalleler görünür, mahalleye girilir", async ({ page }) => {
  await page.goto("/yol-haritasi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Siber şehir");
  await expect(page.getByText("İlerlemeni kaydet")).toBeVisible();
  const districts = page.getByRole("region", { name: "Mahalleler" });
  await districts.getByRole("link", { name: /Oltalama Limanı/ }).click();
  await expect(page).toHaveURL("/yol-haritasi/oltalama-limani");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Oltalama Limanı");
});

test("mahalle: senaryo labı seçilince kayıt penceresi açılır, kayıt bu laba döner", async ({ page, isMobile }) => {
  await page.goto("/yol-haritasi/oltalama-limani");
  const route = page.getByRole("list", { name: "Oltalama Limanı rotası" });
  await expect(route.getByRole("button", { name: /Oltalama eğitim/ })).toBeVisible();
  await route.getByRole("button", { name: /Sahte kargo maili/ }).click();

  // Telefonda önizleme alttan açılan pencerededir.
  const preview = isMobile ? page.getByRole("dialog") : page.getByRole("region", { name: "Seçili oda" });
  await preview.getByRole("button", { name: "Kayıt ol ve başla" }).click();
  const dialog = page.getByRole("dialog", { name: "Ücretsiz hesabını aç" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Ücretsiz kayıt ol" })).toHaveAttribute("href", "/kayit?sonra=%2Foda%2Fsahte-kargo-maili");
});

test("olmayan mahalle bulunamadı der", async ({ page }) => {
  await page.goto("/yol-haritasi/boyle-bir-mahalle-yok");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
});

test("eski lab adresleri yeni oda adreslerine yönlenir, sorgu korunur", async ({ page }) => {
  await page.goto("/lablar?ara=kargo");
  await expect(page).toHaveURL(/\/odalar\?ara=kargo$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Odalar");

  // Oda kapağı giriş ister: önce yeni adrese, oradan girişe gidilir.
  await page.goto("/lab/sahte-kargo-maili");
  await expect(page).toHaveURL(/\/giris\?sonra=%2Foda%2Fsahte-kargo-maili$/);

  const old = await page.request.get("/yonetim/lablar/yeni", { maxRedirects: 0 });
  expect(old.status()).toBe(308);
  expect(old.headers()["location"]).toBe("/yonetim/odalar/yeni");
});

test.describe("lablar kataloğu", () => {
  test("ziyaretçide durum süzgeci yok, lablar kayıtla açılır", async ({ page }) => {
    await page.goto("/odalar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Odalar");
    const filters = page.getByRole("group", { name: "Filtre" });
    await expect(filters.getByRole("button", { name: /^Tür/ })).toBeVisible();
    await expect(filters.getByRole("button", { name: /^Durum/ })).toHaveCount(0);

    const results = page.getByRole("list", { name: "Odalar" });
    const card = results.getByRole("button", { name: /Sahte kargo maili/ });
    await expect(card).toContainText("Kayıtla açılır");
    await card.click();
    const dialog = page.getByRole("dialog", { name: "Ücretsiz hesabını aç" });
    await expect(dialog.getByRole("link", { name: "Ücretsiz kayıt ol" })).toHaveAttribute("href", "/kayit?sonra=%2Foda%2Fsahte-kargo-maili");
  });

  test("arama adrese yazılır, Türkçe harf farkı gözetilmez", async ({ page }) => {
    await page.goto("/odalar");
    await page.getByRole("searchbox", { name: "Oda ara" }).fill("KARGO");
    await expect(page).toHaveURL(/\/odalar\?ara=KARGO$/);
    const results = page.getByRole("list", { name: "Odalar" });
    await expect(results.getByRole("button", { name: /Sahte kargo maili/ })).toBeVisible();
    await expect(results.getByRole("button", { name: /Oltalama eğitim/ })).toHaveCount(0);

    await page.getByRole("searchbox", { name: "Oda ara" }).fill("eğitim");
    await expect(results.getByRole("button", { name: /Oltalama eğitim/ })).toBeVisible();
  });

  test("adresteki süzgeç açılışta uygulanır ve kaldırılabilir", async ({ page }) => {
    await page.goto("/odalar?tur=egitim");
    const results = page.getByRole("list", { name: "Odalar" });
    await expect(results.getByRole("button", { name: /Oltalama eğitim/ })).toBeVisible();
    await expect(results.getByRole("button", { name: /Sahte kargo maili/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Eğitim odası filtresini kaldır" }).click();
    await expect(page).toHaveURL(/\/odalar$/);
    await expect(results.getByRole("button", { name: /Sahte kargo maili/ })).toBeVisible();
  });

  test("hiç sonuç yoksa boş durum ve temizle düğmesi", async ({ page }) => {
    await page.goto("/odalar?ara=boyle-bir-lab-yok-xyz");
    await expect(page.getByText("Bu aramaya uygun oda yok.")).toBeVisible();
    await page.getByRole("button", { name: "Filtreleri temizle" }).click();
    await expect(page.getByRole("list", { name: "Odalar" }).getByRole("button", { name: /Sahte kargo maili/ })).toBeVisible();
  });
});

test("ana sayfa ziyaretçiye tanıtım sayfasıdır, mahalle bağlantıları mahalle sayfasına gider", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hacklenmeden önce, burada hacklen.");
  const roadmap = page.getByRole("region", { name: "Yol haritası" });
  await expect(roadmap.getByRole("link", { name: /Oltalama Limanı/ })).toHaveAttribute("href", "/yol-haritasi/oltalama-limani");
});
