import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";

// Bilgi sayfaları (Faz 5): SSS (/sss, 4 Kasım tasarım B "Yanda konular") ve Öğretmenler için (/ogretmenler).


/** Sayfa hatası ve konsol hatası toplar; test sonunda boş olmalı. */
function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const questions = (page: Page) => page.locator("[data-faq-item]:visible");

test.describe("SSS", () => {
  const topic = (page: Page, name: string) => page.getByRole("navigation", { name: "Konular" }).getByRole("button", { name: new RegExp(`^${name}`) });

  test("başlıkla açılır; Genel konusu, arama ve iletişim kutusu görünür", async ({ page }) => {
    const errors = collectErrors(page);
    const response = await page.goto("/sss");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Sık sorulan sorular/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ne merak ediyorsun?");
    await expect(page.getByText("25 soru, 5 konu.", { exact: false })).toBeVisible();
    await expect(topic(page, "Genel")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Genel");
    await expect(questions(page)).toHaveCount(6);
    await expect(page.getByRole("searchbox", { name: "Soru ara" })).toBeVisible();
    await expect(page.getByText("Cevabını bulamadın mı?")).toBeVisible();
    await expect(page.getByText("[İLETİŞİM E-POSTASI]")).toBeVisible();
    await expectNoOverflow(page);
    expect(errors).toEqual([]);
  });

  test("konu seçilince soruları gelir ve adres değişir", async ({ page }) => {
    await page.goto("/sss");
    // Konu düğmeleri sayfa etkileşime hazır olunca çalışır; canlıda (yavaş ağ) ilk dokunuş ondan
    // önce gelip boşa gidebilir, o zaman yeniden dokunulur.
    await expect(async () => {
      await topic(page, "Odalar").click();
      await expect(page).toHaveURL(/\/sss\?konu=odalar$/, { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Odalar");
    await expect(questions(page).first()).toHaveAttribute("data-faq-item", "hacked");
    await expect(questions(page).getByText("YENİ")).toHaveCount(4);

    await topic(page, "Öğretmenler").click();
    await expect(page).toHaveURL(/\/sss\?konu=ogretmenler$/);
    await expect(questions(page).first()).toHaveAttribute("data-faq-item", "teacherAccount");
  });

  test("eski ?ben=ogretmen bağlantısı Öğretmenler konusunu açar; cevaptaki bağlantılar sayfalara gider", async ({ page }) => {
    await page.goto("/sss?ben=ogretmen");
    await expect(topic(page, "Öğretmenler")).toHaveAttribute("aria-pressed", "true");
    const first = page.getByRole("button", { name: "Öğretmen hesabı nasıl açılır?" });
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await first.click();
    const answer = page.locator(`#${await first.getAttribute("aria-controls")}`);
    await expect(answer).toBeVisible();
    await expect(answer.getByRole("link", { name: "Öğretmenlik" })).toHaveAttribute("href", "/profil?bolum=ogretmenlik");
    await expect(answer.getByRole("link", { name: "Ücretsiz kayıt ol" })).toHaveAttribute("href", "/kayit");
  });

  test("cevap açılır ve kapanır, aynı anda bir cevap açık kalır", async ({ page }) => {
    await page.goto("/sss?konu=ogrenciler");
    const question = page.getByRole("button", { name: "Puanımı ve rozetlerimi kim görür?" });
    const other = page.getByRole("button", { name: "Şifremi unuttum, ne yapmalıyım?" });
    const answer = page.locator(`#${await question.getAttribute("aria-controls")}`);
    await expect(answer).toBeHidden();
    await expect(async () => {
      await question.click();
      await expect(question).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(answer).toContainText("Sadece sen.");
    await other.click();
    await expect(question).toHaveAttribute("aria-expanded", "false");
    await expect(answer).toBeHidden();
    await expect(other).toHaveAttribute("aria-expanded", "true");
  });

  test("arama bütün konularda arar, bulunamayınca söyler", async ({ page }) => {
    await page.goto("/sss");
    const search = page.getByRole("searchbox", { name: "Soru ara" });
    await expect(async () => {
      await search.fill("kilitli");
      await expect(page.getByRole("heading", { level: 2 })).toContainText("“kilitli” için", { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.locator('[data-faq-item="locked"]:visible')).toHaveCount(1);
    await search.fill("zzzz");
    await expect(page.getByText("Bu kelimeyle bir soru bulamadık.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Aramayı temizle" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Genel");
  });

  test("sorunun bağlantısı (#slug) konusunu ve cevabını açar", async ({ page }) => {
    await page.goto("/sss#arayan-kim");
    const caller = page.getByRole("button", { name: "Odada beni arayan kim?" });
    await expect(caller).toHaveAttribute("aria-expanded", "true");
    await expect(topic(page, "Odalar")).toHaveAttribute("aria-pressed", "true");
    await expect(caller).toBeInViewport();
  });

  test("bilinmeyen konu Genel ile açılır", async ({ page }) => {
    await page.goto("/sss?konu=bilinmeyen");
    await expect(topic(page, "Genel")).toHaveAttribute("aria-pressed", "true");
  });

  test.describe("JavaScript kapalıyken", () => {
    test.use({ javaScriptEnabled: false });

    test("bütün sorular konu konu, cevaplarıyla görünür", async ({ page }) => {
      await page.goto("/sss");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ne merak ediyorsun?");
      await expect(questions(page)).toHaveCount(25);
      await expect(page.getByRole("heading", { level: 2, name: "Gizlilik ve aileler" })).toBeVisible();
      // Konu panelleri (gizli) de sayfada; JavaScript'siz liste bir kez görünür.
      await expect(page.getByText("Hayır. Careful Mode öğrenciler, öğretmenler ve aileler için ücretsiz ve reklamsız.").filter({ visible: true })).toHaveCount(1);
      await expect(page.getByRole("searchbox", { name: "Soru ara" })).toBeHidden();
    });
  });
});

test.describe("Öğretmenler için", () => {
  const steps = (page: Page) => page.getByRole("group", { name: "Dersin adımları" }).getByRole("button");

  test("başlıklarla açılır; ana çağrı ziyaretçiyi kayda götürür", async ({ page }) => {
    const errors = collectErrors(page);
    const response = await page.goto("/ogretmenler");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Öğretmenler için/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dijital güvenliği anlatma, sınıfın yaşayarak öğrensin.");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "İki ekran, bir ders",
      "Öğrencinin puanı ve raporu kendisinde kalır.",
      "Çocuğunuz güvenli bir alıştırma alanında",
      "Dört adımda sınıfınla başla",
      "Sık sorulanlar",
      "Sınıfın hazır olduğunda biz de hazırız.",
    ]);
    await expect(steps(page)).toHaveCount(4);
    await expect(page.getByText("Görmezsin: puan ve seviye")).toBeVisible();
    await expect(page.getByRole("img", { name: /Tıklamadan önce bir düşün/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Önce kendin dene" })).toHaveAttribute("href", "/odalar");
    await expectNoOverflow(page);

    const request = page.getByRole("link", { name: "Öğretmen hesabı iste" }).first();
    await expect(request).toHaveAttribute("href", "/kayit?sonra=%2Fprofil%3Fbolum%3Dogretmenlik");
    await request.click();
    await expect(page).toHaveURL(/\/kayit\?sonra=%2Fprofil%3Fbolum%3Dogretmenlik$/);
    expect(errors).toEqual([]);
  });

  test("tahta: tebeşir yazar; fareyle basılı tutup sürükleyince tahtaya çizilir", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "fareyle çizim masaüstünde sınanır");
    await page.goto("/ogretmenler");
    const board = page.getByRole("img", { name: /Tıklamadan önce bir düşün/ });
    await expect(board.locator(".cb-line").first()).toHaveText("Tıklamadan önce", { timeout: 10_000 });
    const box = (await board.locator(".cb-surface").boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.85, { steps: 8 });
    await page.mouse.up();
    await expect(board.locator(".cb-strokes")).toHaveCount(1);
    await expect(board.locator(".cb-surface")).toHaveAttribute("data-chalk", "hand");
    await page.mouse.move(0, 0);
    await expect(board.locator(".cb-surface")).not.toHaveAttribute("data-chalk", "hand");
  });

  test("iki ekran kendiliğinden ilerler, bir adıma dokununca durur", async ({ page }) => {
    await page.goto("/ogretmenler");
    // Bölüm ekranın üstüne gelsin (telefonda başlık ilk ekranın en altında, bölüm ancak görününce oynar).
    await page.getByRole("heading", { name: "İki ekran, bir ders" }).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect(steps(page).nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(steps(page).nth(1)).toHaveAttribute("aria-pressed", "true", { timeout: 8_000 });

    await steps(page).nth(3).click();
    await expect(steps(page).nth(3)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Oynat" })).toBeVisible();
    await page.waitForTimeout(5_000);
    await expect(steps(page).nth(3)).toHaveAttribute("aria-pressed", "true");
  });

  test("Hareketi azalt açıksa adımlar kendiliğinden ilerlemez, elle gezilir", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/ogretmenler");
    await page.getByRole("heading", { name: "İki ekran, bir ders" }).scrollIntoViewIfNeeded();
    await expect(page.getByText("Adımlara dokunarak ilerle.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Oynat" })).toBeVisible();
    await page.waitForTimeout(5_000);
    await expect(steps(page).nth(0)).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Sonraki adım" }).click();
    await expect(steps(page).nth(1)).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Önceki adım" }).click();
    await expect(steps(page).nth(0)).toHaveAttribute("aria-pressed", "true");
  });

  test("kısa SSS: ilk cevap açık, bütün sorulara bağlantı var", async ({ page }) => {
    await page.goto("/ogretmenler");
    const first = page.getByRole("button", { name: "Ücretli mi?" });
    await expect(first).toHaveAttribute("aria-expanded", "true");
    const scores = page.getByRole("button", { name: "Öğrencilerin puanlarını görebilir miyim?" });
    await scores.click();
    await expect(scores).toHaveAttribute("aria-expanded", "true");
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("link", { name: "Öğretmenlerin bütün soruları" })).toHaveAttribute("href", "/sss?konu=ogretmenler");
  });
});

test.describe("giriş yapmış öğrenci", () => {
  test.skip(isLive, "canlı sitede hesap açılmaz");

  test("SSS Öğrenciler konusuyla açılır; Öğretmen hesabı iste profile gider", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "hesap akışı masaüstünde bir kez sınanır");
    await signUpVerified(page, uniqueEmail("sss"));

    await page.goto("/sss");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Öğrenciler");
    // Adreste konu varsa o geçerlidir.
    await page.goto("/sss?konu=gizlilik");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Gizlilik ve aileler");

    await page.goto("/ogretmenler");
    await expect(page.getByRole("link", { name: "Öğretmen hesabı iste" }).first()).toHaveAttribute("href", "/profil?bolum=ogretmenlik");
  });
});
