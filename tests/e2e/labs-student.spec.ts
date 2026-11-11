import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { completeTraining } from "./support/progress";

// Giriş yapmış öğrenci: ana sayfa, siber şehir, lablar, lab detayı ve rozet vitrini. Kilit:
// mahallenin eğitim labı bitmeden senaryo labı açılmaz (eğitimi bitirmiş sayılmak için
// TrainingProgress satırı doğrudan yazılır; kartların kendisi başka testte).

const visible = (page: Page, text: string | RegExp) => page.getByText(text).filter({ visible: true });

test.describe("öğrenci", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");

  test("ana sayfa: profil kartı, seviye, sayılar, yol haritası ve boş raporlar", async ({ page, isMobile }) => {
    await signUpVerified(page, uniqueEmail("ana"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deneme Öğrenci");
    await expect(visible(page, "Tekrar hoş geldin")).toBeVisible();
    await expect(visible(page, "Seviye 1 · Acemi")).toBeVisible();
    await expect(visible(page, "Seviye 2: Dikkatli gezgin için 150 puan kaldı")).toBeVisible();
    // Toplam seviye sayısı hiçbir yerde yazmaz.
    await expect(page.getByText(/Seviye \d+\/\d+|\d+\/10 seviye/)).toHaveCount(0);
    await expect(page.getByRole("list", { name: "İlerlemen" }).filter({ visible: true })).toContainText("biten oda");

    // "Yol haritan" ve "Sıradaki rozetin" ana sayfadan kalktı (4 Kasım; yol haritası üst menüde).
    await expect(page.getByRole("region", { name: "Yol haritan" })).toHaveCount(0);
    await expect(visible(page, "Sıradaki rozetin")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Son raporların" })).toContainText("Raporun burada olacak");

    // Devam düğmesi: yeni öğrencide sıradaki lab (eğitim labıysa doğrudan kartlar). Masaüstünde
    // açacağı odanın adını yazar; telefonda alt menünün ortasında.
    const resume = isMobile
      ? page.getByRole("navigation", { name: "Alt menü" }).getByRole("link", { name: "Kaldığın yerden devam et" })
      : page.getByRole("region", { name: "Deneme Öğrenci" }).getByRole("link", { name: /^Devam et: / });
    await expect(resume).toHaveAttribute("href", /^\/oda\/[a-z0-9-]+(\/oyna)?$/);
  });

  test("senaryo labı eğitim bitmeden kilitli, bitince açılır", async ({ page, isMobile }) => {
    const email = uniqueEmail("kilit");
    await signUpVerified(page, email);

    await page.goto("/yol-haritasi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Siber şehrin");
    await expect(visible(page, "Genel ilerlemen")).toBeVisible();

    await page.goto("/yol-haritasi/oltalama-limani");
    await page.getByRole("list", { name: "Oltalama Limanı rotası" }).getByRole("button", { name: /Sahte kargo maili/ }).click();
    const preview = isMobile ? page.getByRole("dialog") : page.getByRole("region", { name: "Seçili oda" });
    await expect(preview).toContainText("Oltalama eğitim odası bitince açılır.");

    await page.goto("/odalar");
    await expect(page.getByRole("group", { name: "Filtre" }).getByRole("button", { name: /^Durum/ })).toBeVisible();
    const card = page.getByRole("list", { name: "Odalar" }).getByRole("link", { name: /Sahte kargo maili/ });
    await expect(card).toContainText("Kilitli");
    await expect(card).toHaveAttribute("href", "/oda/sahte-kargo-maili");

    await page.goto("/oda/sahte-kargo-maili");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kargonuz kapıda... değil!");
    await expect(page.getByRole("link", { name: "Önce eğitim odasını bitir" })).toHaveAttribute("href", "/oda/oltalama-egitimi/oyna");
    await expect(page.getByRole("link", { name: "Odaya gir", exact: true })).toHaveCount(0);

    await completeTraining(email, "oltalama-egitimi");
    await page.reload();
    await expect(page.getByRole("link", { name: "Odaya gir", exact: true })).toHaveAttribute("href", "/oda/sahte-kargo-maili/oyna");
    await expect(page.getByRole("link", { name: "Önce eğitim odasını bitir" })).toHaveCount(0);
    await expect(visible(page, isMobile ? "Tamamlandı" : /^Tamamlandı · \d+ \S+$/)).toBeVisible();

    // Lablar: "Bitenler" süzgecinde eğitim labı, "Kilitli"de senaryo artık yok.
    await page.goto("/odalar?durum=bitenler");
    await expect(page.getByRole("list", { name: "Odalar" }).getByRole("link", { name: /Oltalama eğitim/ })).toBeVisible();
    await page.goto("/odalar?durum=kilitli");
    await expect(page.getByRole("list", { name: "Odalar" }).getByRole("link", { name: /Sahte kargo maili/ })).toHaveCount(0);
  });

  test("eğitim labının kapağı yok; olmayan lab bulunamaz", async ({ page }) => {
    await signUpVerified(page, uniqueEmail("egitim"));
    await page.goto("/oda/oltalama-egitimi");
    await page.waitForURL("**/oda/oltalama-egitimi/oyna");

    await page.goto("/oda/boyle-bir-lab-yok");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
  });

  test("rozetler: kazanılan rozet vitrine eklenir ve çıkarılır, ana sayfada görünür", async ({ page, isMobile }) => {
    const email = uniqueEmail("rozet");
    await signUpVerified(page, email);
    await completeTraining(email, "oltalama-egitimi");

    await page.goto("/profil?bolum=rozetler");
    // Adreste bölüm istendiği için telefonda da Rozetler sayfası kendiliğinden açılır.
    const section = page.getByRole("region", { name: "Rozetlerin" }).filter({ visible: true });
    await expect(section).toContainText("1/13 rozet kazandın.");
    await expect(visible(page, "Seviye 2: Dikkatli gezgin için 50 puan kaldı")).toBeVisible();

    // Yeni kazanılan rozet vitrinde boş yer varsa kendiliğinden vitrine girer.
    const badge = section.getByRole("button", { name: /^Kart kurdu/ }).and(section.locator("[aria-pressed]"));
    await expect(badge).toHaveAttribute("aria-pressed", "true");
    // Düğme sunucunun cevabını beklemeden değişir; yenilemeden önce eylemin bitmesi beklenir.
    // Sunucu eylemi bitirmeden cevaba başlamaz; cevabın gövdesi beklenmez (React akışı yarıda
    // bırakabilir).
    const saved = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
    await badge.click();
    await saved;
    await expect(badge).toHaveAttribute("aria-pressed", "false");
    await expect(badge).toContainText("Vitrine ekle");
    await expect(section.getByRole("button", { name: "Kart kurdu (vitrinden çıkar)" })).toHaveCount(0);
    await expect(section).toContainText("Kazandın · vitrinde değil.");

    // Yenileyince de çıkarılmış kalır (sunucuya yazıldı).
    await page.reload();
    await expect(badge).toHaveAttribute("aria-pressed", "false");
    await badge.click();
    await expect(badge).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByRole("button", { name: "Kart kurdu (vitrinden çıkar)" })).toBeVisible();

    // Kazanılmamış rozet: nasıl kazanılacağı görünür, vitrine girmez.
    await section.getByRole("button", { name: /^Oltalama avcısı/ }).click();
    await expect(section).toContainText("Nasıl kazanılır: Oltalama Limanı'nda temel eğitimin açtığı bütün senaryo odalarını bitir");
    await expect(section).toContainText(/Henüz kazanmadın\. 0\/\d+ oda/);

    await page.goto("/");
    if (isMobile) {
      await expect(page.getByRole("link", { name: "Rozet vitrinin, 1/13 rozet" })).toBeVisible();
    } else {
      await expect(page.getByRole("region", { name: "Deneme Öğrenci" }).getByRole("link", { name: "Kart kurdu" })).toBeVisible();
    }
  });
});
