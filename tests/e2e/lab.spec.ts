import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signOutHere, signUp, signUpVerified, uniqueEmail } from "./support/account";
import { attemptsOf, continueFromScene, finishTraining, reportStep } from "./support/lab";

// Faz 3 bitti ölçütünün öğrenci tarafı: eğitim labı, sahte kargo maili (hacklenme ve güvende
// kalma yolları), sunucuda hesaplanan puan ve rapor. Doğru cevaplar örnek labdan okunur
// (labs/examples); oynatıcı onları hiç bilmez.

const training = JSON.parse(readFileSync("labs/examples/oltalama-egitimi.json", "utf8")).content;
const kargo = JSON.parse(readFileSync("labs/examples/sahte-kargo-maili.json", "utf8")).content;

const playPath = "/oda/sahte-kargo-maili/oyna";
const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });

test("giriş yapmamış ziyaretçi labdan girişe gönderilir", async ({ page }) => {
  await page.goto(playPath);
  await expect(page).toHaveURL(/\/giris\?sonra=%2Foda%2Fsahte-kargo-maili%2Foyna$/);
});

test.describe("lab", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  test("e-postasını doğrulamamış öğrenci senaryo labından doğrulamaya gönderilir", async ({ page }) => {
    await signUp(page, uniqueEmail("lab-dogrula"));
    await page.goto(playPath);
    await expect(page).toHaveURL(/\/dogrula\?sonra=%2Foda%2Fsahte-kargo-maili%2Foyna$/);
  });

  test("eğitim labı bitmeden senaryo labı açılmaz; eğitim kart kart biter", async ({ page }) => {
    await signUpVerified(page, uniqueEmail("egitim"));
    await page.goto(playPath);
    // Yönlendirme sayfa akarken gelir (Suspense içinde); gezinmenin bitmesi beklenir.
    await page.waitForURL(/\/oda\/sahte-kargo-maili$/);

    await page.goto("/oda/oltalama-egitimi/oyna");
    const player = page.getByTestId("training-player");
    await expect(player).toBeVisible();
    for (const card of training.cards) {
      if (card.type === "clickFind") {
        // Şüpheli olmayan yer "normal" der; şüpheli yerler numarayla işaretlenir.
        await player.locator('[data-part="subject"]').click();
        await expect(player.getByText("Burası normal görünüyor.")).toBeVisible();
        for (const spot of card.spots) await player.locator(`[data-part="${spot.part}"]`).click();
        await expect(player.getByText("Hepsini buldun!")).toBeVisible();
      }
      if (card.type === "quiz") {
        const next = player.getByRole("button", { name: /^(Devam|Bitir)$/ });
        // Cevap vermeden geçilmez.
        await expect(next).toBeDisabled();
        await player.getByRole("group", { name: "Cevaplar" }).getByRole("button").nth(card.answer).click();
        await expect(player.getByText("Doğru!")).toBeVisible();
      }
      await player.getByRole("button", { name: /^(Devam|Bitir)$/ }).click();
    }
    await expect(page.getByRole("heading", { name: "Eğitim odası bitti!" })).toBeVisible();
    // Eğitimi bitirmek "Kart kurdu" rozetini kazandırır; oynatıcı sağ üstte bildirir.
    const badge = page.getByTestId("badge-toast");
    await expect(badge).toContainText("Kart kurdu");
    await expect(badge.getByRole("link", { name: /Rozetlerimi gör/ })).toHaveAttribute("href", "/profil?bolum=rozetler");
    await page.getByRole("link", { name: /İlk senaryo odasına geç/ }).click();
    await expect(page).toHaveURL(/\/oda\/sahte-kargo-maili$/);
    await page.goto(playPath);
    await expect(page.getByRole("button", { name: "Hazırım, başla" })).toBeVisible();
  });

  test("sahte sayfaya şifre yazan hacklenir; yazdığı kaydedilmez, rapor yalnızca ona açılır", async ({ page, context, isMobile }) => {
    const email = uniqueEmail("hacklen");
    await signUpVerified(page, email);
    await finishTraining(email);

    await page.goto(playPath);
    // Oynatıcıda sitenin üst menüsü yok, öğrenci odanın içindedir; çıkış oynatıcının şeridinde.
    await expect(page.getByRole("button", { name: "Hazırım, başla" })).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await page.getByRole("button", { name: "Hazırım, başla" }).click();
    await page.getByRole("button", { name: /^Kargo Takip/ }).click();
    await page.getByRole("button", { name: "Adresi güncelle" }).click();
    const secret = "gizli-sifre-123";
    await page.getByLabel(/Postam şifresi/).fill(secret);
    await page.getByRole("button", { name: /Giriş yap ve doğrula/ }).click();

    await expect(page.getByTestId("hacked-alarm")).toBeVisible();
    // "Hangi hesap?" boş: Postam hesabı, bildirimler mail der.
    await expect(page.getByTestId("hacked-alarm").getByText("Postam hesabın ele geçirildi.")).toBeVisible();
    await page.getByRole("button", { name: "Geç", exact: true }).click();
    // Alarmdan sonra hesap sahnesi; "Adım adım ne oldu" ekranı yok (19 ve 22. revize).
    await continueFromScene(page, "account");
    const report = page.getByTestId("lab-report");
    await expect(report.getByRole("img", { name: "30/100 puan" })).toBeVisible();
    await expect(report.getByText("Hacklendin", { exact: true })).toBeVisible();
    // Rapor adım adım: önce "Odada ne oldu", işaretler ikinci adımda.
    await expect(report.getByRole("heading", { name: "Odada ne oldu" })).toBeVisible();
    await expect(report.getByRole("heading", { name: "Kaçırdığın işaretler" })).toHaveCount(0);
    // Raporda masaüstünde üst menü geri gelir.
    if (!isMobile) await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible();
    // Cevaplanmayan iki soru "yanlış" sayılmaz, ayrı yazılır.
    await expect(report.getByText(/3 doğru · 0 kısmen · 1 yanlış · 2 cevaplanmadı/).filter({ visible: true })).toBeVisible();
    await reportStep(page, "signs");
    await expect(report.getByRole("heading", { name: "Kaçırdığın işaretler" })).toBeVisible();
    await reportStep(page, "tips");
    await expect(report.getByRole("heading", { name: "Bir dahaki sefere" })).toBeVisible();
    await expect(report.getByRole("link", { name: "Tekrar dene" }).filter({ visible: true })).toBeVisible();
    // İlk biten senaryo odası "İlk rapor" rozetini kazandırır; rapor bildirir.
    await expect(page.getByTestId("badge-toast")).toContainText("İlk rapor");
    const reportUrl = page.url();

    // Sunucu: deneme hacklendi olarak kapandı, puanı 3; yazılan şifre hiçbir olayda yok.
    const [attempt] = await attemptsOf(email, "sahte-kargo-maili");
    expect(attempt).toMatchObject({ status: "HACKED", reportScore: 30 });
    expect(attempt.events).toContain("info_entered");
    expect(attempt.events).not.toContain(secret);

    // Biten deneme kapanmıştır: oyna sayfası yeni bir deneme için başlangıç penceresini açar.
    await page.goto(playPath);
    await expect(page.getByRole("button", { name: "Hazırım, başla" })).toBeVisible();

    // Başka bir öğrenci aynı rapor adresini açarsa "bulunamadı" görür.
    await signOutHere(context);
    await signUpVerified(page, uniqueEmail("baskasi"));
    await page.goto(reportUrl);
    await expect(page.getByTestId("lab-report")).toHaveCount(0);
    await expect(page.getByText("404", { exact: true })).toBeVisible();
  });

  test("sahte maili bildirip görevleri bitiren 100/100 alır; yarım kalan lab kaldığı yerden açılır", async ({ page, isMobile }) => {
    const email = uniqueEmail("guvende");
    await signUpVerified(page, email);
    await finishTraining(email);

    await page.goto(playPath);
    await page.getByRole("button", { name: "Hazırım, başla" }).click();

    const app = page.getByTestId("scenario-player");
    const back = page.getByRole("button", { name: "Listeye dön" });
    for (const item of kargo.items) {
      await app.getByRole("button", { name: new RegExp(`^${item.sender}`) }).click();
      await expect(app.getByRole("heading", { name: item.subject })).toBeVisible();
      if (isMobile) await back.click();
    }

    // Çıkış penceresi kararları kaydeder; dönünce lab kaldığı yerden açılır.
    await page.getByRole("button", { name: isMobile ? "Odadan çık" : "Çık", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Çık", exact: true }).click();
    await expect(page).toHaveURL(/\/oda\/sahte-kargo-maili$/);
    await page.goto(playPath);
    await expect(app).toBeVisible();
    await expect(page.getByRole("button", { name: "Hazırım, başla" })).toHaveCount(0);

    await app.getByRole("button", { name: /^Kargo Takip/ }).click();
    await app.getByRole("button", { name: isMobile ? "Bildir" : "Oltalama olarak bildir", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Bildir", exact: true }).click();
    await expect(toast(page, "Mail bildirildi")).toBeVisible();

    // Görevler: telefonda alttan açılan pencerede, masaüstünde sağda.
    if (isMobile) await page.getByRole("button", { name: /Görevleri aç/ }).click();
    const tasks = isMobile ? page.getByRole("dialog", { name: "Görevler" }) : page.getByRole("complementary", { name: "Görevler" });
    await tasks.getByRole("button", { name: "İncelemeyi bitirdim" }).click();
    for (const task of kargo.tasks.filter((t: { type: string }) => t.type === "question")) {
      const best = task.options.reduce((a: { points: number }, b: { points: number }) => (b.points > a.points ? b : a));
      await tasks.getByRole("radiogroup", { name: task.text }).getByRole("radio", { name: new RegExp(best.text.slice(0, 20)) }).click();
      await tasks.getByRole("button", { name: "Cevabı gönder" }).click();
    }
    await tasks.getByRole("button", { name: "Odayı bitir, raporu gör" }).click();

    const report = page.getByTestId("lab-report");
    await expect(report.getByRole("img", { name: "100/100 puan" })).toBeVisible();
    await expect(report.getByText("Güvende kaldın", { exact: true })).toBeVisible();
    await reportStep(page, "signs");
    await expect(report.getByRole("heading", { name: "Yakaladığın sahte maildeki işaretler" })).toBeVisible();
    const [attempt] = await attemptsOf(email, "sahte-kargo-maili");
    expect(attempt).toMatchObject({ status: "COMPLETED", reportScore: 100 });
  });
});
