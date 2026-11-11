import { expect, test, type Page } from "@playwright/test";
import {
  isLive,
  mailCount,
  signIn,
  signOutHere,
  signUp,
  skipCodeCooldown,
  strongPassword,
  typeCode,
  uniqueEmail,
  waitForCode,
} from "./support/account";

// Next önceki sayfaları gizli olarak bellekte tutar; uyarılar yalnızca görünenler arasından aranır.
const alert = (page: Page, text: string | RegExp) => page.getByRole("alert").filter({ hasText: text, visible: true });

async function verify(page: Page, email: string) {
  await typeCode(page, await waitForCode(email));
  await page.getByRole("button", { name: "Doğrula", exact: true }).click();
  await expect(page.getByText("Kod doğru. Hesabın doğrulandı")).toBeVisible();
}

test("giriş yapmamış kullanıcı lab açamaz, girişe gönderilir", async ({ page }) => {
  await page.goto("/oda/sahte-kargo-maili");
  await expect(page).toHaveURL(/\/giris\?sonra=%2Foda%2Fsahte-kargo-maili$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Hoş geldin/);
});

test.describe("hesap", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  test("bitti ölçütü: yeni kullanıcı kodla doğrulanıyor, doğrulanmamış kullanıcı lab başlatamıyor", async ({ page }) => {
    const email = uniqueEmail("olcut");
    await signUp(page, email);
    await expect(page.getByText(email)).toBeVisible();

    // Doğrulanmamış hesap labın kapağını görür ama başlatamaz: ana düğme doğrulama sayfasına
    // gider, lab adresi "sonra" olarak saklanır.
    await page.goto("/oda/sahte-kargo-maili");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kargonuz kapıda... değil!");
    await expect(page.getByRole("link", { name: "Odaya gir", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Odaya girmek için e-postanı doğrula" }).click();
    await expect(page).toHaveURL(/\/dogrula\?sonra=%2Foda%2Fsahte-kargo-maili$/);
    await expect(page.getByRole("heading", { name: "E-postanı doğrula" })).toBeVisible();

    await verify(page, email);
    await page.waitForURL("**/oda/sahte-kargo-maili");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kargonuz kapıda... değil!");
  });

  test("yanlış kod uyarı verir, yeni kod 60 saniye dolmadan istenemez", async ({ page }) => {
    const email = uniqueEmail("kod");
    await signUp(page, email);
    const code = await waitForCode(email);

    await typeCode(page, code === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Doğrula", exact: true }).click();
    await expect(alert(page, "Kod hatalı")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Kodu tekrar gönder \(\d:\d\d\)$/ })).toBeDisabled();

    // Doğru kod hâlâ geçerli (5 yanlışa kadar).
    await verify(page, email);
    await page.waitForURL("/");
  });

  test("yanlış yazılan e-posta doğrulama sayfasında değiştirilir, kod yeni adrese gider", async ({ page }) => {
    const wrong = uniqueEmail("yanlis");
    const right = uniqueEmail("dogru");
    await signUp(page, wrong);
    await waitForCode(wrong);

    await page.getByRole("button", { name: "Değiştir" }).click();
    await page.getByLabel("Yeni e-posta adresin").fill(right);
    await page.getByRole("button", { name: "Bu adrese kod gönder" }).click();
    await expect(page.getByText(right)).toBeVisible();

    await verify(page, right);
    await page.waitForURL("/");
  });

  test("hatalı girişte hangi alanın yanlış olduğu söylenmez, 5 denemeden sonra giriş durur", async ({ page }) => {
    const email = uniqueEmail("kilit");
    await page.goto("/giris");

    await signIn(page, email, "yanlis-sifre-1");
    await expect(alert(page, "E-posta ya da şifre hatalı.")).toBeVisible();
    for (const left of [3, 2, 1]) {
      await page.getByLabel("Şifre", { exact: true }).fill("yanlis-sifre-1");
      await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
      await expect(alert(page, `${left} deneme hakkın kaldı.`)).toBeVisible();
    }

    await page.getByLabel("Şifre", { exact: true }).fill("yanlis-sifre-1");
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await expect(alert(page, "Çok fazla hatalı deneme")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Giriş yap \(\d:\d\d\)$/ })).toBeDisabled();
  });

  test("çıkıp tekrar giren kullanıcı kaldığı sayfaya döner, cihaz onu tanır", async ({ page, context }) => {
    const email = uniqueEmail("giris");
    await signUp(page, email);
    await verify(page, email);
    await page.waitForURL("/");

    await signOutHere(context);
    await page.goto("/oda/sahte-kargo-maili");
    await expect(page).toHaveURL(/\/giris\?sonra=/);
    await expect(page.getByRole("heading", { name: "Tekrar hoş geldin" })).toBeVisible();

    // Var olan hesapta yanlış şifre de aynı mesajı verir.
    await signIn(page, email, "yanlis-sifre-1");
    await expect(alert(page, "E-posta ya da şifre hatalı.")).toBeVisible();

    await page.getByLabel("Şifre", { exact: true }).fill(strongPassword);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page.waitForURL("**/oda/sahte-kargo-maili");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kargonuz kapıda... değil!");

    // Giriş yapmış kullanıcı giriş ve kayıt sayfalarında kalmaz.
    await page.goto("/giris");
    await page.waitForURL("/");
    await page.goto("/kayit");
    await page.waitForURL("/");
  });

  test("girişten sonra ana sayfada bir kez önceki girişin zamanı çıkar; Ben değildim şifre değiştirmeye götürür", async ({ page, context }) => {
    const email = uniqueEmail("songiris");
    await signUp(page, email);
    await verify(page, email);
    await page.waitForURL("/");
    // Kayıt sonrası ilk açılışta önceki giriş yok.
    await expect(page.getByTestId("last-sign-in")).toHaveCount(0);

    await signOutHere(context);
    await page.goto("/giris");
    // Caps Lock uyarısı kutunun altında.
    const password = page.getByLabel("Şifre", { exact: true });
    // Başsız tarayıcı Caps Lock'u bildirmez: tuş olayı Caps Lock açık hâliyle gönderilir (sayfa hazır olana dek).
    await expect(async () => {
      await password.evaluate((el) => el.dispatchEvent(new KeyboardEvent("keyup", { key: "A", bubbles: true, modifierCapsLock: true })));
      await expect(page.getByText("Büyük harf açık (Caps Lock).")).toBeVisible({ timeout: 500 });
    }).toPass();

    await signIn(page, email, strongPassword);
    await page.waitForURL("/");
    const strip = page.getByTestId("last-sign-in");
    await expect(strip).toContainText("Son girişin:");
    await expect(strip.getByRole("link", { name: "Ben değildim" })).toHaveAttribute("href", "/profil?bolum=guvenlik");

    // Bir kez: sayfa yenilenince gelmez.
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByTestId("last-sign-in")).toHaveCount(0);
  });

  test("şifre sıfırlama: hesap olmasa da aynı ekran, hesap varsa kodla yeni şifre", async ({ page, context }) => {
    async function requestCode(email: string) {
      await page.goto("/sifre-sifirla");
      await page.getByRole("button", { name: "Anladım, başlayalım" }).click();
      await page.getByLabel("E-posta").fill(email);
      await page.getByRole("button", { name: "Kod gönder" }).click();
      await expect(page.getByRole("heading", { name: "Mailini kontrol et" })).toBeVisible();
    }

    const nobody = uniqueEmail("hesapyok");
    await requestCode(nobody);
    expect(await mailCount(nobody)).toBe(0);

    const email = uniqueEmail("sifirla");
    await signUp(page, email);
    await waitForCode(email);
    await signOutHere(context);
    await skipCodeCooldown(email);

    const before = new Date().toISOString();
    await requestCode(email);
    await page.getByRole("button", { name: "Kodu girmeye geç" }).click();
    await typeCode(page, await waitForCode(email, before));
    await page.getByRole("button", { name: "Devam" }).click();

    const newPassword = "Yesil?Bulut42Kar";
    await page.getByLabel("Yeni şifre").fill(newPassword);
    await page.getByRole("button", { name: "Şifremi değiştir" }).click();
    await expect(page.getByRole("heading", { name: "Şifren değişti" })).toBeVisible();
    await expect(page.getByText("Bütün cihazlarından çıkış yapıldı.")).toBeVisible();

    await page.getByRole("link", { name: "Giriş yap" }).click();
    await page.waitForURL("**/giris");
    await signIn(page, email, strongPassword);
    await expect(alert(page, "E-posta ya da şifre hatalı.")).toBeVisible();
    await page.getByLabel("Şifre", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
    await page.waitForURL("/");
  });

  test("yaygın şifreyle kayıt düğmesi açılmaz", async ({ page }) => {
    await page.goto("/kayit");
    await page.getByLabel("Görünen ad").fill("Deneme");
    await page.getByLabel("E-posta").fill(uniqueEmail("zayif"));
    await page.getByLabel("Doğum yılı").selectOption("2000");
    await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
    const submit = page.getByRole("button", { name: "Hesabımı oluştur" });

    await page.getByLabel("Şifre", { exact: true }).fill("password123");
    await expect(page.getByText("en çok kullanılan şifrelerden biri")).toBeVisible();
    await expect(submit).toBeDisabled();

    await page.getByLabel("Şifre", { exact: true }).fill(strongPassword);
    await expect(submit).toBeEnabled();
  });

  test("18 yaşından küçük kullanıcı veli onayını işaretlemeden kayıt olamaz", async ({ page }) => {
    await page.goto("/kayit");
    await page.getByLabel("Görünen ad").fill("Deneme");
    await page.getByLabel("E-posta").fill(uniqueEmail("veli"));
    await page.getByLabel("Şifre", { exact: true }).fill(strongPassword);
    await page.getByLabel("Doğum yılı").selectOption(String(new Date().getFullYear() - 13));
    await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
    const submit = page.getByRole("button", { name: "Hesabımı oluştur" });

    await expect(submit).toBeDisabled();
    await page.getByRole("checkbox", { name: /velimin bilgisi dahilinde/ }).check();
    await expect(submit).toBeEnabled();
  });
});
