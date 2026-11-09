import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { withDb } from "./support/db";
import { attemptsOf, checkMissionCover, continueFromScene } from "./support/lab";

// Satış görevli oda (Para Çarşısı "Eski telefonunu sat", 2 Kasım): babanın görüntülü araması, ilan
// kutusu, Mesajlar'daki alıcılar, bankanın ödeme isteği (sahte), pazar yerindeki sipariş ve kargodan
// önceki hazırlık, iyi ve kötü bitiş. Oda dosyası taslak olduğu için içerik geçici bir mahallede,
// eğitimsiz yayınlanır; adresi "e2e-". LAYOUT_SHOTS=<klasör> verilirse ekran görüntüleri alınır.

test.skip(isLive, "veritabanına yazan ve hesap açan testler canlı sitede çalışmaz");

const room = JSON.parse(readFileSync("labs/rooms/para-carsisi/eski-telefonunu-sat.json", "utf8")).content;
const stamp = () => `${Date.now().toString(36)}${process.pid.toString(36)}${randomUUID().slice(0, 4)}`;
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const shots = process.env.LAYOUT_SHOTS;
const requestUrl = "bankam.com.tr/odeme-istegi/48213";
const orderUrl = "ikincielpazari.com.tr/siparis/77310";

async function shot(page: Page, name: string, isMobile: boolean) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  // Bitiş aramaları kendiliğinden açılır; konuşma görünsün diye biraz daha beklenir.
  await page.waitForTimeout(name.endsWith("-arama") && !name.startsWith("1-") ? 4500 : 800);
  await page.screenshot({ path: `${shots}/satis-${isMobile ? "telefon" : "masaustu"}-${name}.png` });
}

async function withRoom(run: (slug: string) => Promise<void>) {
  const neighborhood = { id: newId(), slug: `e2e-mahalle-${stamp()}` };
  const lab = { id: newId(), slug: `e2e-satis-${stamp()}` };
  const content = JSON.stringify(room);
  await withDb(async (client) => {
    await client.query(`INSERT INTO "Neighborhood" ("id", "slug", "name", "color", "sortOrder") VALUES ($1, $2, $3, 'accent', 9000 + floor(random() * 900)::int)`, [
      neighborhood.id,
      neighborhood.slug,
      `E2E Mahalle ${neighborhood.slug}`,
    ]);
    await client.query(
      `INSERT INTO "Lab" ("id", "slug", "neighborhoodId", "type", "template", "sortOrder", "status", "publishedVersion", "difficulty", "durationMin", "draftContent", "updatedAt")
       VALUES ($1, $2, $3, 'SCENARIO', 'MESSAGING', 1, 'PUBLISHED', 1, 'MEDIUM', 9, $4::jsonb, now())`,
      [lab.id, lab.slug, neighborhood.id, content],
    );
    await client.query(`INSERT INTO "LabVersion" ("labId", "version", "content") VALUES ($1, 1, $2::jsonb)`, [lab.id, content]);
  });
  try {
    await run(lab.slug);
  } finally {
    await withDb(async (client) => {
      await client.query(`DELETE FROM "LabAttempt" WHERE "labId" = $1`, [lab.id]);
      await client.query(`DELETE FROM "LabVersion" WHERE "labId" = $1`, [lab.id]);
      await client.query(`DELETE FROM "Lab" WHERE "id" = $1`, [lab.id]);
      await client.query(`DELETE FROM "Neighborhood" WHERE "id" = $1`, [neighborhood.id]);
    });
  }
}

/** Açılış araması: babanın görüntülü araması, "Aç", "Geç", "Tamam baba, hallederim", başlangıç kartı. */
async function answerIntro(page: Page, isMobile: boolean) {
  // Önce perde ve "Başlamadan önce" kutusu, arama "Hazırım"dan sonra çalar (18. revize).
  await page.getByRole("button", { name: "Hazırım, başla" }).click();
  const call = page.getByTestId("mission-call");
  await expect(call.getByText("Görüntülü arama…")).toBeVisible();
  await expect(call.getByText("Babam", { exact: true }).first()).toBeVisible();
  await shot(page, "1-arama", isMobile);
  // Babanın sesi: açılış satırlarının sesleri sitenin kendi dosyasından önceden yüklenir.
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((e) => e.name.endsWith("/sesler/eski-telefonunu-sat/acilis-1.mp3"))))
    .toBe(true);
  await call.getByRole("button", { name: "Aç", exact: true }).click();
  await expect(call.getByText("eski telefonunun ilanını", { exact: false }).first()).toBeVisible();
  await shot(page, "2-gorusme", isMobile);
  await call.getByRole("button", { name: "Geç ›" }).click();
  await expect(call.getByRole("heading", { name: room.mission.title })).toBeVisible();
  await shot(page, "3-gorev-karti", isMobile);
  await call.getByRole("button", { name: room.mission.accept }).click();
  await expect(call).toHaveCount(0);
}

/** Mesajlar'da bir sohbeti açar, mesajdaki bağlantıya dokunur. */
async function openLinkOf(page: Page, sender: string, url: string, isMobile: boolean, name = "") {
  const app = page.getByTestId("scenario-player");
  await app.getByRole("button", { name: new RegExp(`^${sender}`) }).first().click();
  if (name) await shot(page, name, isMobile);
  await app.getByRole("button", { name: url }).click();
  return app;
}

test("telefonu sıfırlayıp gerçek alıcıya gönderen, sahteyi bildiren: iyi bitiş araması ve 100/100", async ({ page, isMobile }) => {
  await withRoom(async (slug) => {
    const email = uniqueEmail("satis-iyi");
    await signUpVerified(page, email);

    // Odanın kapağı: sağda arayan ve hikâye kartları (bildirim telefonu değil).
    await checkMissionCover(page, slug, "Babam", ["İstek reddedildi", "fotoğrafların duruyor", "hesabından 4.000 TL çıkmış"]);
    await shot(page, "0-kapak", isMobile);

    await page.goto(`/oda/${slug}/oyna`);

    // Ödeme isteğinin ayrıntısı, hazırlamadan gönderme mesajı ve bitiş aramaları sayfada yok.
    const html = await page.content();
    for (const secret of ["İstek reddedildi", "fotoğrafların duruyor", "Telefonu da sıfırlamışsın", "hesabından 4.000 TL çıkmış"]) {
      expect(html).not.toContain(secret);
    }

    await answerIntro(page, isMobile);
    if (!isMobile) await expect(page.getByTestId("mission-listing").filter({ visible: true })).toContainText("4.000 TL");
    await shot(page, "4-mesajlar", isMobile);

    // Sahne masaüstünde de telefon çerçevesinin içinde, telefon düzeninde (PhoneFrame): sohbetten geri dönülür.
    await expect(page.getByTestId("phone-frame")).toBeVisible();
    const app = page.getByTestId("scenario-player");
    const back = page.getByRole("button", { name: "Sohbetlere dön" });
    for (const name of ["Selin K.", "Emre T.", "Babam"]) {
      await app.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
      await back.click();
    }

    // Pazar yerinin siparişi: hazırlık maddeleri işaretlenir, kargoya verilir.
    await openLinkOf(page, "İkinci El Pazarı", orderUrl, isMobile, "4b-pazar-bildirimi");
    const order = page.getByTestId("sale-order");
    await expect(order.getByRole("heading", { name: room.mission.sale.product })).toBeVisible();
    await expect(order).toContainText("Alıcı: Emre T.");
    await shot(page, "5-siparis", isMobile);
    for (const step of room.mission.sale.prep) await order.getByLabel(step).check();
    await order.getByRole("button", { name: "Kargoya ver" }).click();
    await expect(order.getByText("Kargoya verildi", { exact: true })).toBeVisible();
    await shot(page, "6-kargoda", isMobile);
    await order.getByRole("button", { name: "Mesajlara dön" }).click();
    if (await back.isVisible()) await back.click();

    await app.getByRole("button", { name: /^Selin K\./ }).first().click();
    await app.getByRole("button", { name: "Bildir ve engelle", exact: true }).click();
    await shot(page, "6b-bildir", isMobile);
    await page.getByRole("alertdialog").getByRole("button", { name: "Bildir ve engelle" }).click();

    if (isMobile) await page.getByRole("button", { name: /Görevleri aç/ }).click();
    const tasks = isMobile ? page.getByRole("dialog", { name: "Görevler" }) : page.getByRole("complementary", { name: "Görevler" });
    await shot(page, "6c-gorevler", isMobile);
    await tasks.getByRole("button", { name: "İncelemeyi bitirdim" }).click();
    for (const task of room.tasks.filter((t: { type: string }) => t.type === "question")) {
      await tasks.getByRole("radiogroup", { name: task.text }).getByRole("radio").first().click();
      await tasks.getByRole("button", { name: "Cevabı gönder" }).click();
    }
    await tasks.getByRole("button", { name: "Odayı bitir, raporu gör" }).click();

    const call = page.getByTestId("mission-call");
    await expect(call.getByText("Babam arıyor…")).toBeVisible();
    await shot(page, "6d-iyi-arama", isMobile);
    await call.getByRole("button", { name: "Geç ›" }).click();
    await expect(call.getByRole("heading", { name: room.mission.goodTitle })).toBeVisible();
    await shot(page, "7-iyi-bitis", isMobile);
    await call.getByRole("button", { name: "Raporu gör" }).click();

    const report = page.getByTestId("lab-report");
    await expect(report.getByRole("img", { name: "100/100 puan" })).toBeVisible();
    await shot(page, "13-rapor", isMobile);
    await expect(report.getByText("Görev: Telefonu doğru alıcıya sat").filter({ visible: true }).first()).toBeVisible();
    const [attempt] = await attemptsOf(email, slug);
    expect(attempt).toMatchObject({ status: "COMPLETED", reportScore: 100 });
    expect(attempt.events).toContain("item_shipped");
  });
});

test("ödeme isteğini onaylayan: kötü bitiş araması (baba), hesabından para çıktı alarmı", async ({ page, isMobile }) => {
  await withRoom(async (slug) => {
    const email = uniqueEmail("satis-kotu");
    await signUpVerified(page, email);
    await page.goto(`/oda/${slug}/oyna`);
    await answerIntro(page, isMobile);

    await openLinkOf(page, "Selin K.", requestUrl, isMobile, "8a-selin");
    const request = page.getByTestId("bank-request");
    await expect(request.getByRole("heading", { name: "Ödeme isteği" })).toBeVisible();
    await expect(request).toContainText("Selin K. senden 4.000 TL ödeme istiyor.");
    await shot(page, "8-odeme-istegi", isMobile);
    await request.getByRole("button", { name: "Onayla" }).click();

    const call = page.getByTestId("mission-call");
    await expect(call.getByText("Babam arıyor…")).toBeVisible();
    await shot(page, "8b-kotu-arama", isMobile);
    await call.getByRole("button", { name: "Geç ›" }).click();
    const alarm = page.getByTestId("hacked-alarm");
    await expect(alarm.getByText("Hesabından 4.000 TL çıktı.")).toBeVisible();
    await shot(page, "9-alarm", isMobile);
    await page.getByRole("button", { name: "Geç", exact: true }).click();
    // Alarmdan sonra bankanın uygulaması: 4.000 TL ve hizmet bedeli düşer, bakiye 1.000 TL kalır.
    const scene = page.getByTestId("hacked-scene");
    await expect(scene).toHaveAttribute("data-scene", "money");
    await expect(scene.getByTestId("scene-balance")).toHaveText("1.000,00 TL");
    await shot(page, "10-sahne", isMobile);
    await continueFromScene(page);

    const [attempt] = await attemptsOf(email, slug);
    expect(attempt.status).toBe("HACKED");
    expect(attempt.events).toContain("code_entered");
  });
});

test("isteği reddeden hacklenmez; sıfırlamadan gönderince alıcının mesajı gelir, görev yarım kalır", async ({ page, isMobile }) => {
  await withRoom(async (slug) => {
    const email = uniqueEmail("satis-yarim");
    await signUpVerified(page, email);
    await page.goto(`/oda/${slug}/oyna`);
    await answerIntro(page, isMobile);

    await openLinkOf(page, "Selin K.", requestUrl, isMobile);
    const request = page.getByTestId("bank-request");
    await request.getByRole("button", { name: "Reddet" }).click();
    await expect(request.getByText("İstek reddedildi", { exact: false })).toBeVisible();
    await shot(page, "12-reddetti", isMobile);
    await expect(page.getByTestId("hacked-alarm")).toHaveCount(0);
    await request.getByRole("button", { name: "Mesajlara dön" }).click();
    await page.getByRole("button", { name: "Sohbetlere dön" }).click();

    await openLinkOf(page, "İkinci El Pazarı", orderUrl, isMobile);
    const order = page.getByTestId("sale-order");
    await order.getByRole("button", { name: "Kargoya ver" }).click();
    await expect(order.getByText("Telefon olduğu gibi gitti")).toBeVisible();
    await expect(order.getByText("fotoğrafların duruyor", { exact: false })).toBeVisible();
    await shot(page, "11-hazirlamadan", isMobile);

    const [attempt] = await attemptsOf(email, slug);
    expect(attempt.status).toBe("IN_PROGRESS");
    expect(attempt.events).toContain("code_refused");
    expect(attempt.events).toContain("item_shipped");
  });
});
