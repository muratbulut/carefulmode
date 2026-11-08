import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { withDb } from "./support/db";
import { attemptsOf, continueFromScene } from "./support/lab";

// M1: Mesajlar'da sahte mesajdaki bağlantı sahte sayfa açar (tuzak başlığı yazılınca;
// lib/lab/content.ts usesTrapPage). Oda geçici bir mahallede, eğitimsiz (oda açıktır); adresi "e2e-".

test.skip(isLive, "veritabanına yazan ve hesap açan testler canlı sitede çalışmaz");

const kodu = JSON.parse(readFileSync("labs/examples/kodu-soran-arkadas.json", "utf8")).content;
const stamp = () => `${Date.now().toString(36)}${process.pid.toString(36)}${randomUUID().slice(0, 4)}`;
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const linkUrl = "okul-cekilisi.xyz/tablet-kazandin";

/** Kodu soran arkadaş odasının kopyası: Deniz'in mesajında bağlantı, tuzakta sahte sayfa. */
function pageRoom() {
  const content = structuredClone(kodu);
  content.meta.name = "E2E çekiliş";
  const deniz = content.items.find((item: { id: string }) => item.id === "deniz");
  deniz.body = "Okul çekilişinde tablet kazandın! Hediyeni almak için formu doldur.";
  deniz.link = { url: linkUrl, text: "Hediyeni al" };
  content.trap = { ...content.trap, title: "Çekiliş formu", text: "Hediyeni almak için Postam hesabınla giriş yap.", ask: "Postam şifresi", secret: "" };
  return content;
}

test("Mesajlar'da bağlantı sahte sayfa açar; bilgi giren hacklenir, yazdığı kaydedilmez", async ({ page }) => {
  const neighborhood = { id: newId(), slug: `e2e-mahalle-${stamp()}` };
  const lab = { id: newId(), slug: `e2e-mesaj-sayfa-${stamp()}` };
  const content = JSON.stringify(pageRoom());
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
    const email = uniqueEmail("mesaj-sayfa");
    await signUpVerified(page, email);

    await page.goto(`/oda/${lab.slug}/oyna`);
    await page.getByRole("button", { name: "Hazırım, başla" }).click();
    await page.getByRole("button", { name: /^Deniz/ }).first().click();
    await page.getByRole("button", { name: linkUrl }).click();

    // Sahte sayfa: başlık tuzaktan, adres mesajdaki bağlantıdan.
    await expect(page.getByRole("heading", { name: "Çekiliş formu" })).toBeVisible();
    await expect(page.getByText(linkUrl).filter({ visible: true }).first()).toBeVisible();
    const secret = "cekilis-sifre-42";
    await page.getByLabel("Postam şifresi").fill(secret);
    await page.getByRole("button", { name: /Giriş yap ve doğrula/ }).click();

    await expect(page.getByTestId("hacked-alarm")).toBeVisible();
    await page.getByRole("button", { name: "Geç", exact: true }).click();
    await continueFromScene(page);
    const report = page.getByTestId("lab-report");
    await expect(report.getByText("Hacklendin", { exact: true })).toBeVisible();
    await expect(report.getByText("Bağlantıyı açtın ve sahte sayfaya bilgilerini yazdın.").filter({ visible: true }).first()).toBeVisible();

    // Sunucu: bağlantı ve bilgi girildi olayları var, yazılan şifre hiçbir olayda yok.
    const [attempt] = await attemptsOf(email, lab.slug);
    expect(attempt.status).toBe("HACKED");
    expect(attempt.events).toContain("link_clicked");
    expect(attempt.events).toContain("info_entered");
    expect(attempt.events).not.toContain(secret);
  } finally {
    await withDb(async (client) => {
      await client.query(`DELETE FROM "LabAttempt" WHERE "labId" = $1`, [lab.id]);
      await client.query(`DELETE FROM "LabVersion" WHERE "labId" = $1`, [lab.id]);
      await client.query(`DELETE FROM "Lab" WHERE "id" = $1`, [lab.id]);
      await client.query(`DELETE FROM "Neighborhood" WHERE "id" = $1`, [neighborhood.id]);
    });
  }
});
