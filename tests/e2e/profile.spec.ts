import { expect, test, type Page } from "@playwright/test";
import {
  isLive,
  signIn,
  signOutHere,
  signUpVerified,
  strongPassword,
  typeCode,
  uniqueEmail,
  waitForCode,
} from "./support/account";

// Next önceki sayfaları gizli olarak bellekte tutar; bildirimler yalnızca görünenler arasından aranır.
const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });

/**
 * Profil bölümünü açar. Masaüstünde soldaki menüden, telefonda listeden (bölüm sağdan kayan
 * sayfada açılır; açık bir sayfa varsa önce "Profil" ile listeye dönülür).
 */
async function openSection(page: Page, name: string) {
  const back = page.getByRole("button", { name: "Profil", exact: true });
  if (await back.isVisible()) await back.click();
  await page.getByRole("navigation", { name: "Profil bölümleri" }).getByRole("button", { name, exact: true }).click();
}

test("giriş yapmamış kullanıcı profil yerine girişe gönderilir", async ({ page }) => {
  await page.goto("/profil");
  await expect(page).toHaveURL(/\/giris\?sonra=%2Fprofil$/);
});

test.describe("profil", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  test("üst menüdeki avatardan profile gidilir ve çıkış yapılır", async ({ page, isMobile }) => {
    await signUpVerified(page, uniqueEmail("menu"));
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Giriş yap" })).toHaveCount(0);
    if (isMobile) {
      // Alt menü giriş yapmış kullanıcınınki: ortada devam düğmesi, sağda Profil.
      const bottomNav = page.getByRole("navigation", { name: "Alt menü" });
      await expect(bottomNav).toHaveCount(1);
      await expect(bottomNav.getByRole("link", { name: "Kaldığın yerden devam et" })).toBeVisible();
      await expect(bottomNav.getByRole("link", { name: "Profil" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Daha fazla" })).toHaveCount(0);
    }

    const menu = banner.getByRole("button", { name: "Hesap menüsü" });
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await banner.getByRole("link", { name: "Profil" }).click();
    await page.waitForURL("/profil");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deneme Öğrenci");

    await menu.click();
    await banner.getByRole("button", { name: "Çıkış yap" }).click();
    await page.waitForURL("/");
    await expect(banner.getByRole("link", { name: "Giriş yap" }).filter({ visible: true })).toBeVisible();
    if (isMobile) await expect(page.getByRole("button", { name: "Daha fazla" })).toBeVisible();
    await page.goto("/profil");
    await expect(page).toHaveURL(/\/giris\?sonra=%2Fprofil$/);
  });

  test("görünen ad ve avatar değişir, üst menüye de yansır", async ({ page }) => {
    await signUpVerified(page, uniqueEmail("ad"));
    await page.goto("/profil");

    await openSection(page, "Hesap bilgileri");
    const name = page.getByLabel("Görünen ad");
    await name.fill("A");
    await expect(page.getByRole("button", { name: "Değişiklikleri kaydet" })).toBeDisabled();
    await name.fill("  Siber   Ayşe ");
    await page.getByRole("button", { name: "Değişiklikleri kaydet" }).click();
    await expect(toast(page, "Bilgilerin kaydedildi")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Siber Ayşe");

    await openSection(page, "Avatar");
    // Seçilmemiş avatar kimlikten gelir; zaten Robot ise Ejderha seçilir.
    const robotShown = (await page.getByRole("button", { name: "Robot", exact: true }).getAttribute("aria-pressed")) === "true";
    const [choice, emoji] = robotShown ? ["Ejderha", "🐲"] : ["Robot", "🤖"];
    const button = page.getByRole("button", { name: choice, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(toast(page, `Avatarın değişti: ${choice}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Hesap menüsü" })).toContainText(emoji);

    // Yenileyince de kalır.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Siber Ayşe");
    await expect(page.getByRole("button", { name: "Hesap menüsü" })).toContainText(emoji);
  });

  test("şifre değişir: yanlış şifre uyarı verir, yeni şifreyle giriş yapılır", async ({ page }) => {
    const email = uniqueEmail("sifre");
    const newPassword = "Yesil?Bulut42Kar";
    await signUpVerified(page, email);
    await page.goto("/profil");
    await openSection(page, "Güvenlik");

    const submit = page.getByRole("button", { name: "Şifremi değiştir" });
    await page.getByLabel("Yeni şifre", { exact: true }).fill("12345678");
    await expect(submit).toBeDisabled();

    await page.getByLabel("Şu anki şifren").fill("Yanlis!Sifre99");
    await page.getByLabel("Yeni şifre", { exact: true }).fill(newPassword);
    await submit.click();
    await expect(page.getByText("Şu anki şifren hatalı.")).toBeVisible();

    await page.getByLabel("Şu anki şifren").fill(strongPassword);
    await page.getByLabel("Yeni şifre", { exact: true }).fill(newPassword);
    await submit.click();
    await expect(toast(page, "Şifren değişti")).toBeVisible();

    await signOutHere(page.context());
    await page.goto("/giris");
    await signIn(page, email, strongPassword);
    await expect(page.getByRole("alert").filter({ hasText: "E-posta ya da şifre hatalı.", visible: true })).toBeVisible();
    await signIn(page, email, newPassword);
    await page.waitForURL("/");
  });

  test("diğer cihazdaki oturum listede görünür ve kapatılır", async ({ page, browser, baseURL }) => {
    const email = uniqueEmail("oturum");
    await signUpVerified(page, email);

    const other = await browser.newContext({ baseURL, locale: "tr-TR" });
    const otherPage = await other.newPage();
    await otherPage.goto("/giris");
    await signIn(otherPage, email, strongPassword);
    await otherPage.waitForURL("/");

    await page.goto("/profil");
    await openSection(page, "Güvenlik");
    await expect(page.getByText(/^Bu cihaz · /)).toBeVisible();
    await page.getByRole("button", { name: "Diğer cihazlardan çıkış yap" }).click();
    await expect(toast(page, "Diğer cihazlardaki oturumların kapatıldı")).toBeVisible();
    await expect(page.getByText("Şu an yalnızca bu cihazda açık oturumun var.")).toBeVisible();

    await otherPage.goto("/profil");
    await expect(otherPage).toHaveURL(/\/giris\?sonra=%2Fprofil$/);
    await other.close();
  });

  test("e-posta yeni adrese gelen kodla değişir", async ({ page }) => {
    const email = uniqueEmail("eposta");
    const newEmail = uniqueEmail("yeni");
    await signUpVerified(page, email);
    await page.goto("/profil");
    await openSection(page, "Hesap bilgileri");

    await page.getByRole("button", { name: "Değiştir", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "E-postanı değiştir" });
    await dialog.getByLabel("Yeni e-posta adresin").fill(newEmail);
    await dialog.getByLabel("Şu anki şifren").fill("Yanlis!Sifre99");
    await dialog.getByRole("button", { name: "Kod gönder" }).click();
    await expect(dialog.getByText("Şifre hatalı.")).toBeVisible();

    await dialog.getByLabel("Şu anki şifren").fill(strongPassword);
    await dialog.getByRole("button", { name: "Kod gönder" }).click();
    await expect(dialog.getByText(newEmail)).toBeVisible();
    await typeCode(page, await waitForCode(newEmail));
    await dialog.getByRole("button", { name: "E-postamı değiştir" }).click();
    await expect(toast(page, "E-postan değişti")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(newEmail).filter({ visible: true }).first()).toBeVisible();

    // Eski adresle giriş olmaz, yenisiyle olur.
    await signOutHere(page.context());
    await page.goto("/giris");
    await signIn(page, email, strongPassword);
    await expect(page.getByRole("alert").filter({ hasText: "E-posta ya da şifre hatalı.", visible: true })).toBeVisible();
    await signIn(page, newEmail, strongPassword);
    await page.waitForURL("/");
  });

  test("hesap silme 7 gün bekler; düğmeyle ya da giriş yapınca iptal olur", async ({ page }) => {
    const email = uniqueEmail("sil");
    await signUpVerified(page, email);
    await page.goto("/profil");

    async function requestDeletion() {
      await openSection(page, "Hesabı sil");
      await page.getByRole("button", { name: "Hesabımı sil" }).click();
      const dialog = page.getByRole("dialog", { name: "Hesabını silmek istediğine emin misin?" });
      const confirm = dialog.getByRole("button", { name: "Hesabımı sil" });
      await expect(confirm).toBeDisabled();
      await dialog.getByLabel(/Onaylamak için/).fill("sil");
      await confirm.click();
      await expect(toast(page, "Hesap silme isteğin alındı")).toBeVisible();
      await expect(page.getByText(/^Hesabın .+ silinecek\./).filter({ visible: true })).toBeVisible();
    }

    await requestDeletion();
    await page.getByRole("button", { name: "Silmeyi iptal et" }).click();
    await expect(toast(page, "Hesap silme isteğin iptal edildi")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hesabımı sil" })).toBeVisible();

    await requestDeletion();
    await signOutHere(page.context());
    await page.goto("/giris");
    await signIn(page, email, strongPassword);
    await page.waitForURL("/profil?silme=iptal");
    await expect(toast(page, "Tekrar hoş geldin. Hesap silme isteğin iptal edildi.")).toBeVisible();
    await openSection(page, "Hesabı sil");
    await expect(page.getByRole("button", { name: "Hesabımı sil" })).toBeVisible();
  });

  test("telefonda bölüm ayrı sayfada açılır, geri tuşu listeye döner", async ({ page, isMobile }) => {
    test.skip(!isMobile, "yalnızca telefon düzeni");
    await signUpVerified(page, uniqueEmail("mobil"));
    await page.goto("/profil");

    await openSection(page, "Güvenlik");
    const back = page.getByRole("button", { name: "Profil", exact: true });
    await expect(back).toBeFocused();
    await expect(page.getByRole("button", { name: "Şifremi değiştir" })).toBeVisible();

    await page.goBack();
    await expect(back).toBeHidden();
    await expect(page).toHaveURL(/\/profil$/);
    await expect(page.getByRole("navigation", { name: "Profil bölümleri" }).filter({ visible: true })).toBeVisible();
  });
});
