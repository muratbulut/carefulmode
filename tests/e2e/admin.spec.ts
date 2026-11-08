import { expect, test, type Page } from "@playwright/test";
import { isLive, signOutHere, signUpVerified, uniqueEmail } from "./support/account";
import { deleteTestLabs, makeAdmin } from "./support/admin";
import { attemptsOf, continueFromScene, finishTraining, reportStep } from "./support/lab";

// Next önceki sayfaları gizli olarak bellekte tutar; bildirimler yalnızca görünenler arasından aranır.
const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });

/** Bu testin açtığı labın adı ve adresi ("e2e-" ile başlar, sonda temizlenir). */
function testLab(tag: string, project: string) {
  const stamp = `${Date.now().toString(36)}${process.pid.toString(36)}`;
  const name = `E2E ${tag} ${stamp} ${project}`;
  return { name, slug: name.toLowerCase().replaceAll(" ", "-") };
}

/** Kayıt olur, e-postayı doğrular ve hesabı yönetici yapar. */
async function signUpAdmin(page: Page) {
  const email = uniqueEmail("admin");
  await signUpVerified(page, email);
  await makeAdmin(email);
  return email;
}

/** "Yeni oda" formuyla ilk mahallede (varsayılan) taslak açar; lab düzenleme sayfası açılır. */
async function createLab(page: Page, name: string, template: "Gelen kutusu" | "Mesajlaşma") {
  await page.goto("/yonetim/odalar");
  await page.getByRole("link", { name: "Yeni oda" }).click();
  const form = page.getByRole("form", { name: "Yeni oda" });
  await form.getByText(template, { exact: true }).click();
  await expect(form.getByRole("radio", { name: new RegExp(`^${template}`) })).toBeChecked();
  await form.getByLabel("Oda adı").fill(name);
  await form.getByRole("button", { name: "Taslağı oluştur" }).click();
  await page.waitForURL(/\/yonetim\/odalar\/(?!yeni)[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

/**
 * Lab bölümünü açar. Masaüstünde soldaki listeden; telefonda bölüm kendi sayfasında açılır (açık
 * bir bölüm varsa önce "Bölümler" ile listeye dönülür).
 */
async function openSection(page: Page, name: string) {
  await backToSections(page);
  await page
    .getByRole("navigation", { name: "Oda bölümleri" })
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
}

async function backToSections(page: Page) {
  const back = page.getByRole("button", { name: "Bölümler", exact: true });
  if (await back.isVisible()) await back.click();
}

test("giriş yapmamış ziyaretçi yönetim yerine girişe gönderilir", async ({ page }) => {
  await page.goto("/yonetim/odalar");
  await expect(page).toHaveURL(/\/giris\?sonra=%2Fyonetim%2Fodalar$/);
});

test.describe("yönetim paneli", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  test("yönetici olmayan kullanıcı paneli görmez: sayfa yok der", async ({ page }) => {
    await signUpVerified(page, uniqueEmail("ogrenci"));
    for (const path of ["/yonetim", "/yonetim/odalar", "/yonetim/odalar/yeni", "/yonetim/odalar/olmayan-lab"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
      await expect(page.getByRole("navigation", { name: "Yönetim menüsü" })).toHaveCount(0);
    }
    await expect(page).toHaveTitle(/Sayfa bulunamadı/);
  });

  // Faz 3 bitti ölçütü: lab formdan yazılır, önizlenir, yayınlanır; öğrenci baştan sona oynar ve
  // puanı ile raporu sunucuda hesaplanır.
  test("yönetici formla gelen kutusu labı yazar ve yayınlar; öğrenci oynayıp raporunu görür", async ({ page, context, isMobile }, testInfo) => {
    test.slow();
    const lab = testLab("Kargo", testInfo.project.name);
    try {
      const adminEmail = await signUpAdmin(page);
      await createLab(page, lab.name, "Gelen kutusu");
      const editorUrl = page.url();
      const ready = page.getByRole("group", { name: "Yayına hazır mı?" });
      // Oda adı yeterli: odanın hatırlatmaları artık zorunlu değil (18. revize).
      await expect(ready).toContainText("3/9");

      // Kapak: iki hatırlatma (formdaki önizleme için)
      await openSection(page, "Kapak ve hatırlatma");
      const reminders = page.getByRole("group", { name: /Bu odada şunlara dikkat et/ });
      await reminders.getByRole("button", { name: "Madde ekle" }).click();
      await reminders.getByRole("button", { name: "Madde ekle" }).click();
      await page.getByLabel("Hatırlatma 1", { exact: true }).fill("Gönderenin adresine bak.");
      await page.getByLabel("Hatırlatma 2", { exact: true }).fill("Linke tıklamadan önce adresi oku.");

      // Gelen kutusu: bir sahte (3 işaret ve bağlantı), bir gerçek mail
      await openSection(page, "Gelen kutusu");
      await page.getByRole("button", { name: "Mail ekle" }).click();
      await page.getByLabel("Gönderen adı").fill("Hızlı Kargo");
      await page.getByLabel("Gönderen adresi").fill("destek@hizli-kargo-takip.example");
      await page.getByLabel("Konu").fill("Paketiniz teslim edilemedi");
      await page.getByLabel("Bu mail").selectOption("fake");
      await page.getByLabel("Metin", { exact: true }).fill("Paketiniz depoda bekliyor. 24 saat içinde adresinizi doğrulayın.");
      await page.getByRole("button", { name: "Bağlantı ekle" }).click();
      await page.getByLabel("Bağlantının adresi").fill("hizli-kargo-takip.example/dogrula");
      await page.getByLabel("Düğme yazısı").fill("Adresi doğrula");
      for (const place of ["Gönderen", "Metin", "Bağlantı"]) await page.getByRole("button", { name: `+ ${place} işareti` }).click();
      await page.getByLabel("1. işaretin açıklaması").fill("Adres kargo firmasının resmi adresi değil.");
      await page.getByLabel("2. işaretin açıklaması").fill("24 saat diyerek acele ettiriyor.");
      await page.getByLabel("3. işaretin açıklaması").fill("Bağlantı başka bir siteye gidiyor.");
      await page.getByLabel('Raporda "Neden?"').fill("Kargo firması şifre istemez.");

      await page.getByRole("button", { name: "Mail ekle" }).click();
      await expect(page.getByText("Mail 2 / 2")).toBeVisible();
      await page.getByLabel("Gönderen adı").fill("Okul Duyuru");
      await page.getByLabel("Metin", { exact: true }).fill("Yarın 3. dersten sonra veli toplantısı var.");

      // Sahte sayfa
      await openSection(page, "Sahte sayfa");
      await page.getByLabel("Sahte sayfanın adresi").fill("hizli-kargo-takip.example/giris");
      await page.getByLabel("Sayfa başlığı").fill("Oyun hesabını doğrula");
      await page.getByLabel("Ne istiyor?").fill("Oyun şifresi");
      // "Hesabı ele geçirilir" türünde hesabın adı (boşsa Postam; sabah soruları 25d).
      await page.getByLabel("Hangi hesap? (isteğe bağlı)").fill("Oyun");

      // Görevler: eylem, bildir (4 + 1 puan), iki soru (en iyi 3 ve 2 puan) = 10
      await openSection(page, "Görevler");
      await page.getByRole("button", { name: "Eylem görevi ekle" }).click();
      await page.getByLabel("Görev metni").fill("Gelen kutunu aç");
      await page.getByRole("button", { name: "Bildir görevi ekle" }).click();
      await page.getByLabel("Görev metni").fill("Gelen kutunu incele, şüphelileri bildir");
      // BİLDİR görevinde "Doğrusu" ve "Neden?" yok: raporda mail satırları kendi metinlerini kullanır.
      await expect(page.getByLabel('Raporda "Doğrusu"')).toHaveCount(0);
      const questions = [
        { text: "Kargo maili için ne düşünüyorsun?", points: ["3", "1", "0"] },
        { text: "Okul duyurusu için ne düşünüyorsun?", points: ["2", "0", "0"] },
      ];
      for (const q of questions) {
        await page.getByRole("button", { name: "Soru görevi ekle" }).click();
        await page.getByLabel("Görev metni").fill(q.text);
        for (const [i, letter] of ["A", "B", "C"].entries()) {
          await page.getByLabel(`Seçenek ${letter}`, { exact: true }).fill(`${letter} seçeneği`);
          await page.getByLabel(`Seçenek ${letter} puanı`).selectOption(q.points[i]);
        }
        await page.getByLabel('Raporda "Doğrusu"').fill("A seçeneği.");
        await page.getByLabel('Raporda "Neden?"').fill("Çünkü işaretler öyle söylüyor.");
      }
      await expect(page.getByText("Toplam: 10 / 10 puan")).toBeVisible();

      // Rapor: üç ipucu
      await openSection(page, "Rapor");
      for (const n of [1, 2, 3]) {
        await page.getByRole("button", { name: "İpucu ekle" }).click();
        await page.getByLabel(`İpucu ${n}`, { exact: true }).fill(`${n}. ipucu: adresi oku.`);
      }

      // Liste tamam; kaydet ve yayınla
      await backToSections(page);
      await expect(ready).toContainText("9/9");
      await expect(ready.getByRole("button", { name: /: eksik$/ })).toHaveCount(0);
      await expect(page.getByText("Kaydedilmemiş değişiklik", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Kaydet", exact: true }).click();
      await expect(toast(page, "Taslak kaydedildi")).toBeVisible();
      await expect(page.getByRole("button", { name: "Kaydet", exact: true })).toBeDisabled();
      await expect(page.getByText("Kaydedilmemiş değişiklik", { exact: true })).toHaveCount(0);

      await page.getByRole("button", { name: "v1 olarak yayınla" }).click();
      const dialog = page.getByRole("dialog", { name: `${lab.name} · v1 yayınlansın mı?` });
      await dialog.getByRole("button", { name: "Yayınla", exact: true }).click();
      await expect(toast(page, `${lab.name} v1 yayında.`)).toBeVisible();
      await expect(page.getByRole("button", { name: "v2 olarak yayınla" })).toBeDisabled();
      await expect(page.getByText("Değişiklik yok.")).toBeVisible();

      // Listede yayında (gizle anahtarı açık)
      await page.goto("/yonetim/odalar");
      await expect(page.getByRole("switch", { name: `Gizle: ${lab.name}` })).toBeChecked();

      // Önizleme: taslak öğrencinin oynatıcısında açılır, rapor yerinde çıkar, hiçbir şey kaydedilmez.
      await page.goto(editorUrl);
      await page.getByRole("link", { name: "Önizle" }).click();
      await page.waitForURL(/\/onizle$/);
      await page.getByRole("button", { name: "Hazırım, başla" }).click();
      await page.getByRole("button", { name: /^Hızlı Kargo/ }).click();
      await page.getByRole("button", { name: "Adresi doğrula" }).click();
      await expect(page.getByText("Oyun güvenli giriş · 256-bit şifreleme")).toBeVisible();
      await page.getByLabel(/Oyun şifresi/).fill("onizleme-sifresi");
      await page.getByRole("button", { name: "Giriş yap ve doğrula" }).click();
      const alarm = page.getByTestId("hacked-alarm");
      await expect(alarm.getByText("Oyun hesabın ele geçirildi.")).toBeVisible();
      await expect(alarm.getByText("Arkadaşlarına 37 mesaj gönderildi")).toBeVisible();
      await page.getByRole("button", { name: "Geç", exact: true }).click();
      await continueFromScene(page);
      const preview = page.getByTestId("lab-report");
      // Sahte mail 0, bırakılan gerçek mail 1, cevaplanmayan sorular 0.
      await expect(preview.getByRole("img", { name: "10/100 puan" })).toBeVisible();
      await expect(page).toHaveURL(/\/onizle$/);
      expect(await attemptsOf(adminEmail, lab.slug)).toEqual([]);
      await reportStep(page, "tips");
      await preview.getByRole("button", { name: "Tekrar dene" }).filter({ visible: true }).first().click();
      await expect(page.getByRole("button", { name: "Hazırım, başla" })).toBeVisible();

      // Öğrenci: mahallenin eğitimini bitirmiş yeni bir hesap yayındaki labı oynar.
      await signOutHere(context);
      const student = uniqueEmail("ogrenci");
      await signUpVerified(page, student);
      await finishTraining(student);
      await page.goto(`/oda/${lab.slug}/oyna`);
      await page.getByRole("button", { name: "Hazırım, başla" }).click();
      const app = page.getByTestId("scenario-player");
      for (const sender of ["Hızlı Kargo", "Okul Duyuru"]) {
        await app.getByRole("button", { name: new RegExp(`^${sender}`) }).click();
        if (isMobile) await page.getByRole("button", { name: "Listeye dön" }).click();
      }
      await app.getByRole("button", { name: /^Hızlı Kargo/ }).click();
      await app.getByRole("button", { name: isMobile ? "Bildir" : "Oltalama olarak bildir", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Bildir", exact: true }).click();
      await expect(toast(page, "Mail bildirildi")).toBeVisible();
      if (isMobile) await page.getByRole("button", { name: /Görevleri aç/ }).click();
      const tasks = isMobile ? page.getByRole("dialog", { name: "Görevler" }) : page.getByRole("complementary", { name: "Görevler" });
      await tasks.getByRole("button", { name: "İncelemeyi bitirdim" }).click();
      for (const q of questions) {
        await tasks.getByRole("radiogroup", { name: q.text }).getByRole("radio", { name: /A seçeneği/ }).click();
        await tasks.getByRole("button", { name: "Cevabı gönder" }).click();
      }
      await tasks.getByRole("button", { name: "Odayı bitir, raporu gör" }).click();
      const report = page.getByTestId("lab-report");
      await expect(report.getByRole("img", { name: "100/100 puan" })).toBeVisible();
      await expect(report.getByText("Güvende kaldın", { exact: true })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/oda/${lab.slug}/sonuc/`));
      const [attempt] = await attemptsOf(student, lab.slug);
      expect(attempt).toMatchObject({ status: "COMPLETED", reportScore: 100 });
    } finally {
      await deleteTestLabs({ slug: lab.slug });
    }
  });

  test("kontrol listesi bitmeden yayınlanamaz; eksikler listelenir ve bölüme götürür", async ({ page }, testInfo) => {
    const lab = testLab("Eksik", testInfo.project.name);
    try {
      await signUpAdmin(page);
      await createLab(page, lab.name, "Gelen kutusu");

      await expect(page.getByRole("button", { name: "v1 olarak yayınla" })).toBeDisabled();
      await expect(page.getByText("Kontrol listesindeki eksikler bitince yayınlayabilirsin.")).toBeVisible();
      const ready = page.getByRole("group", { name: "Yayına hazır mı?" });
      await expect(ready).toContainText("3/9");
      await expect(ready.getByRole("button", { name: /: eksik$/ })).toHaveCount(6);
      for (const missing of [
        "En az 1 sahte ve 1 gerçek mail, metinleri yazılı",
        "Her sahte mailde 3 işaret ve açıklaması",
        "Sahte sayfa adresi, başlığı ve ne istediği",
        "En az 4 görev, metinleri yazılı",
        "Toplam puan 10",
        "Rapor için en az 3 ipucu",
      ]) {
        await expect(ready.getByRole("button", { name: `${missing}: eksik` })).toBeVisible();
      }

      // Eksik madde kendi bölümünü açar.
      await ready.getByRole("button", { name: "Sahte sayfa adresi, başlığı ve ne istediği: eksik" }).click();
      await expect(page.getByRole("heading", { level: 2, name: "Sahte sayfa" })).toBeVisible();

      // Kaydedilmemiş değişiklikle çıkmak sorulur.
      await page.getByLabel("Ne istiyor?").fill("Postam şifresi");
      await expect(page.getByText("Kaydedilmemiş değişiklik", { exact: true })).toBeVisible();
      await backToSections(page);
      await page.getByRole("main").getByRole("link", { name: "Odalar", exact: true }).click();
      const leave = page.getByRole("dialog", { name: "Kaydetmeden çıkılsın mı?" });
      await expect(leave).toBeVisible();
      await leave.getByRole("button", { name: "Düzenlemeye dön" }).click();
      await expect(leave).toBeHidden();
      await expect(page).toHaveURL(/\/yonetim\/odalar\/[^/]+$/);
    } finally {
      await deleteTestLabs({ slug: lab.slug });
    }
  });
});
