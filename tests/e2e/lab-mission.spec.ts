import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { withDb } from "./support/db";
import { attemptsOf, checkMissionCover, continueFromScene } from "./support/lab";

// Görevli oda (Para Çarşısı "Kulaklık için veli kartı", 2 Kasım): annenin görüntülü araması, görev
// kutusu ve kartı, mağaza sayfası, ödeme sonrası SMS, onay kodu kararı, iyi ve kötü bitiş. Oda
// dosyası taslak olduğu için içerik geçici bir mahallede, eğitimsiz (oda açıktır) yayınlanır; adresi "e2e-".
// LAYOUT_SHOTS=<klasör> verilirse ekran görüntüleri alınır (depoya girmez).

test.skip(isLive, "veritabanına yazan ve hesap açan testler canlı sitede çalışmaz");

const room = JSON.parse(readFileSync("labs/rooms/para-carsisi/kulaklik-icin-veli-karti.json", "utf8")).content;
const stamp = () => `${Date.now().toString(36)}${process.pid.toString(36)}${randomUUID().slice(0, 4)}`;
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const shots = process.env.LAYOUT_SHOTS;

async function shot(page: Page, name: string, isMobile: boolean) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  // Açılış animasyonları (kartın kayması, belirme) bitsin.
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${shots}/gorev-${isMobile ? "telefon" : "masaustu"}-${name}.png` });
}

async function withRoom(run: (slug: string) => Promise<void>) {
  const neighborhood = { id: newId(), slug: `e2e-mahalle-${stamp()}` };
  const lab = { id: newId(), slug: `e2e-gorev-${stamp()}` };
  const content = JSON.stringify(room);
  await withDb(async (client) => {
    await client.query(`INSERT INTO "Neighborhood" ("id", "slug", "name", "color", "sortOrder") VALUES ($1, $2, $3, 'accent', 9000 + floor(random() * 900)::int)`, [
      neighborhood.id,
      neighborhood.slug,
      `E2E Mahalle ${neighborhood.slug}`,
    ]);
    await client.query(
      `INSERT INTO "Lab" ("id", "slug", "neighborhoodId", "type", "template", "sortOrder", "status", "publishedVersion", "difficulty", "durationMin", "draftContent", "updatedAt")
       VALUES ($1, $2, $3, 'SCENARIO', 'INBOX', 1, 'PUBLISHED', 1, 'MEDIUM', 8, $4::jsonb, now())`,
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

/** Açılış araması: telefon çalar, "Aç", annen konuşur ("Geç"), "Tamam anne, anladım", başlangıç kartı. */
async function answerIntro(page: Page, isMobile: boolean) {
  // Önce perde ve "Başlamadan önce" kutusu, arama "Hazırım"dan sonra çalar (18. revize).
  await page.getByRole("button", { name: "Hazırım, başla" }).click();
  const call = page.getByTestId("mission-call");
  await expect(call.getByText("Görüntülü arama…")).toBeVisible();
  await shot(page, "1-arama", isMobile);
  // Annenin sesi: açılış satırlarının sesleri sitenin kendi dosyasından önceden yüklenir (CSP media-src 'self').
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((e) => e.name.endsWith("/sesler/kulaklik-icin-veli-karti/acilis-1.mp3"))))
    .toBe(true);
  await call.getByRole("button", { name: "Aç", exact: true }).click();
  await expect(call.getByRole("button", { name: "Sesi kapat" })).toBeVisible();
  await expect(call.getByText("Canım,", { exact: false }).first()).toBeVisible();
  await shot(page, "2-gorusme", isMobile);
  await call.getByRole("button", { name: "Geç ›" }).click();
  await expect(call.getByRole("heading", { name: room.mission.title })).toBeVisible();
  await shot(page, "3-gorev-karti", isMobile);
  await call.getByRole("button", { name: room.mission.accept }).click();
  await expect(call).toHaveCount(0);
}

/** Postam'da bir TeknoPazar mailini açar ("19:42" sahte, "18:10" gerçek), mağazaya gidip öder. */
async function payFrom(page: Page, time: string, isMobile: boolean) {
  const app = page.getByTestId("scenario-player");
  await app.getByRole("button", { name: new RegExp(`^TeknoPazar ${time}`) }).click();
  await app.getByRole("button", { name: "Ürüne git" }).click();
  await expect(app.getByRole("heading", { name: room.mission.shop.product })).toBeVisible();
  // Gerçek ve sahte mağaza sayfası aynı: "Güvenli değil" uyarısı yok.
  await expect(app.getByText("Güvenli değil")).toHaveCount(0);
  await app.getByRole("button", { name: "Annenin kartını kullan" }).click();
  await expect(app.getByTestId("shop-card")).toContainText("4821");
  await app.getByRole("button", { name: "1.199 TL öde" }).click();
  // Velinin mesajı ortaya gelen telefonda açılır (sahnenin dışında, kendi penceresi).
  await expect(page.getByTestId("mission-sms").getByTestId("shop-sms")).toBeVisible();
  await shot(page, `4-sms-${time.replace(":", "")}`, isMobile);
  return app;
}

test("doğru mağazadan alan, sahteyi bildiren öğrenci: iyi bitiş araması ve 100/100", async ({ page, isMobile }) => {
  // Kayıt, kapak, perde, arama, bütün mailler, ödeme, bildirim, bitiş araması ve rapor tek yolculuk:
  // telefonda CI'da 30 saniyeyi aşabiliyor (yerelde ~23 sn).
  test.slow();
  await withRoom(async (slug) => {
    const email = uniqueEmail("gorev-iyi");
    await signUpVerified(page, email);

    // Odanın kapağı: sağda arayan ve hikâye kartları (bildirim telefonu değil).
    await checkMissionCover(page, slug, "Annem", ["4.850", "TKNPZR"]);
    await shot(page, "0-kapak", isMobile);

    await page.goto(`/oda/${slug}/oyna`);

    // SMS'teki tutar ve bitiş aramaları sayfada yok (ödeyince ve bitince sunucudan gelir).
    const html = await page.content();
    expect(html).not.toContain("4.850");
    expect(html).not.toContain("TKNPZR");

    await answerIntro(page, isMobile);
    const box = page.getByTestId("mission-box").filter({ visible: true });
    if (!isMobile) await expect(box).toContainText("Annenin kartı");
    await shot(page, "5-panel", isMobile);

    const back = page.getByRole("button", { name: "Listeye dön" });
    const app = page.getByTestId("scenario-player");
    for (const name of ["TeknoPazar 19:42", "TeknoPazar 18:10", "Annem", "Okul Duyuru"]) {
      await app.getByRole("button", { name: new RegExp(`^${name}`) }).click();
      if (isMobile) await back.click();
    }

    await payFrom(page, "18:10", isMobile);
    const phone = page.getByTestId("mission-sms");
    await expect(phone.getByTestId("shop-sms")).toContainText("TeknoPazar, 1.199 TL");
    await phone.getByRole("button", { name: "Kodu yaz" }).click();
    await phone.getByRole("button", { name: "Tamam" }).click();
    await expect(phone).toHaveCount(0);
    await expect(app.getByText("Siparişin alındı")).toBeVisible();
    await app.getByRole("button", { name: "Postam'a dön" }).click();
    if (isMobile && (await back.isVisible())) await back.click();

    await app.getByRole("button", { name: /^TeknoPazar 19:42/ }).click();
    await app.getByRole("button", { name: isMobile ? "Bildir" : "Oltalama olarak bildir", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Bildir", exact: true }).click();

    if (isMobile) await page.getByRole("button", { name: /Görevleri aç/ }).click();
    const tasks = isMobile ? page.getByRole("dialog", { name: "Görevler" }) : page.getByRole("complementary", { name: "Görevler" });
    await tasks.getByRole("button", { name: "İncelemeyi bitirdim" }).click();
    for (const task of room.tasks.filter((t: { type: string }) => t.type === "question")) {
      await tasks.getByRole("radiogroup", { name: task.text }).getByRole("radio").first().click();
      await tasks.getByRole("button", { name: "Cevabı gönder" }).click();
    }
    await tasks.getByRole("button", { name: "Odayı bitir, raporu gör" }).click();

    const call = page.getByTestId("mission-call");
    await expect(call.getByText("Annem arıyor…")).toBeVisible();
    await call.getByRole("button", { name: "Geç ›" }).click();
    await expect(call.getByRole("heading", { name: room.mission.goodTitle })).toBeVisible();
    await shot(page, "6-iyi-bitis", isMobile);
    await call.getByRole("button", { name: "Raporu gör" }).click();

    const report = page.getByTestId("lab-report");
    await expect(report.getByRole("img", { name: "100/100 puan" })).toBeVisible();
    await expect(report.getByText("Görev: Kulaklığı doğru yerden al").filter({ visible: true }).first()).toBeVisible();
    const [attempt] = await attemptsOf(email, slug);
    expect(attempt).toMatchObject({ status: "COMPLETED", reportScore: 100 });
    // Kart bilgisi hiçbir olayda yok; yalnızca "bilgi girildi" ve kod kararı.
    expect(attempt.events).toContain("info_entered");
    expect(attempt.events).toContain("code_entered");
    expect(attempt.events).not.toContain("4821");
  });
});

test("sahte sitede kodu yazan öğrenci: kötü bitiş araması, Annenin kartından alarmı", async ({ page, isMobile }) => {
  await withRoom(async (slug) => {
    const email = uniqueEmail("gorev-kotu");
    await signUpVerified(page, email);
    await page.goto(`/oda/${slug}/oyna`);
    await answerIntro(page, isMobile);

    await payFrom(page, "19:42", isMobile);
    await expect(page.getByTestId("shop-sms")).toContainText("TKNPZR*ODEME, 4.850 TL");
    await page.getByTestId("mission-sms").getByRole("button", { name: "Kodu yaz" }).click();

    const call = page.getByTestId("mission-call");
    await expect(call.getByText("Annem arıyor…")).toBeVisible();
    await call.getByRole("button", { name: "Geç ›" }).click();
    const alarm = page.getByTestId("hacked-alarm");
    await expect(alarm.getByText("Annenin kartından 4.850 TL çekildi.")).toBeVisible();
    await shot(page, "7-alarm", isMobile);
    await page.getByRole("button", { name: "Geç", exact: true }).click();
    // Alarmdan sonra harcama bildirimleri sahnesi, "Devam" deyince rapor.
    await expect(page.getByTestId("hacked-scene")).toHaveAttribute("data-scene", "card");
    await shot(page, "8-sahne", isMobile);
    await continueFromScene(page);

    const [attempt] = await attemptsOf(email, slug);
    expect(attempt.status).toBe("HACKED");
  });
});

test("sahte sitede 'Yazma, anneme anlat' diyen hacklenmez; annenin cevabı gelir", async ({ page, isMobile }) => {
  await withRoom(async (slug) => {
    const email = uniqueEmail("gorev-durdu");
    await signUpVerified(page, email);
    await page.goto(`/oda/${slug}/oyna`);
    await answerIntro(page, isMobile);

    const app = await payFrom(page, "19:42", isMobile);
    const phone = page.getByTestId("mission-sms");
    await phone.getByRole("button", { name: "Yazma, anneme anlat" }).click();
    await expect(phone.getByText("İyi ki yazmadın!", { exact: false })).toBeVisible();
    await expect(page.getByTestId("hacked-alarm")).toHaveCount(0);
    await shot(page, "9-durdu", isMobile);
    await phone.getByRole("button", { name: "Tamam" }).click();
    await expect(app.getByRole("button", { name: "Postam'a dön" })).toBeVisible();
    const [attempt] = await attemptsOf(email, slug);
    expect(attempt.status).toBe("IN_PROGRESS");
    expect(attempt.events).toContain("code_refused");
  });
});
