import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test as base, expect, type Locator, type Page, type Response } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { makeAdmin } from "./support/admin";
import { withDb } from "./support/db";
import { continueFromScene, finishTraining, reportStep } from "./support/lab";
import { createSchool, makeCoordinator, makeTeacher, userIdOf } from "./support/teacher";

// İçerik Güvenliği Politikası (Faz 6, güvenlik turu 5; tur 1 D2, tur 2 O2). Her HTML yanıtı aynı
// CSP'yle gelir (next.config.ts) ve sitenin hiçbir yeri onu çiğnemez: ziyaretçi sayfaları,
// öğrencinin lab oynatıcısı ve sahneleri, öğretmen ve okul sayfaları, yönetim paneli ve lab
// önizlemesi. Tarayıcı bir şeyi engellerse (securitypolicyviolation olayı ya da konsoldaki CSP
// reddi) test düşer. Öğretmenlik belgesi kendi, daha sıkı (sandbox) CSP'siyle gelir.

/** Beklenen politika, yönerge yönerge. Bir yönerge gevşetilir ya da eklenirse test düşer. */
const expectedPolicy: Record<string, string> = {
  "default-src": "'self'",
  "script-src": "'self' 'unsafe-inline'",
  "script-src-attr": "'none'",
  "style-src": "'self' 'unsafe-inline'",
  "style-src-elem": "'self'",
  "img-src": "'self'",
  "font-src": "'self'",
  "connect-src": "'self'",
  "media-src": "'self'",
  "object-src": "'none'",
  "frame-src": "'self'",
  "worker-src": "'none'",
  "base-uri": "'none'",
  "form-action": "'self'",
  "frame-ancestors": "'none'",
};

function parsePolicy(header: string | undefined) {
  const policy: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) policy[name.toLowerCase()] = values.join(" ");
  }
  return policy;
}

function expectPagePolicy(response: Response | null, path: string) {
  expect(response, path).toBeTruthy();
  const headers = response!.headers();
  expect(parsePolicy(headers["content-security-policy"]), path).toEqual(expectedPolicy);
  expect(headers["content-security-policy-report-only"], path).toBeUndefined();
}

// Her testte: tarayıcının engellediği her şey (bütün çerçevelerde) toplanır, test sonunda boş
// olmalıdır. Konsoldaki CSP reddi de sayılır (olay dinleyicisi kurulamayan sandbox'lı çerçeve için).
const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ page }, use) => {
      const violations: string[] = [];
      await page.exposeBinding("__cspViolation", ({ frame }, text: string) => {
        violations.push(`${frame.url()} → ${text}`);
      });
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (e) => {
          const report = (window as unknown as { __cspViolation?: (text: string) => void }).__cspViolation;
          report?.(`${e.disposition} ${e.effectiveDirective} ${e.blockedURI || "(satır içi)"} ${e.sourceFile}:${e.lineNumber} ${e.sample}`);
        });
      });
      page.on("console", (message) => {
        if (/content security policy/i.test(message.text())) violations.push(`konsol: ${message.text()}`);
      });
      await use(violations);
      expect(violations, "CSP bir şeyi engelledi").toEqual([]);
    },
    { auto: true },
  ],
});

/** Sayfayı açar ve CSP başlığını denetler. */
async function visit(page: Page, path: string) {
  const response = await page.goto(path);
  expectPagePolicy(response, path);
  return response!;
}

/** Görselin gerçekten yüklendiğini denetler (img-src bir şeyi engellerse genişlik 0 kalır). */
async function expectImageLoaded(image: Locator) {
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
}

// Eğitim labının kartları örnek labdan okunur (lab.spec.ts gibi); oynatıcı doğru cevapları bilmez.
const training = JSON.parse(readFileSync("labs/examples/oltalama-egitimi.json", "utf8")).content as {
  cards: { type: string; answer?: number; spots?: { part: string }[] }[];
};

/** Profil bölümünü açar (masaüstünde soldaki menüden, telefonda listeden; profile.spec.ts gibi). */
async function openProfileSection(page: Page, name: string) {
  const back = page.getByRole("button", { name: "Profil", exact: true });
  if (await back.isVisible()) await back.click();
  await page.getByRole("navigation", { name: "Profil bölümleri" }).getByRole("button", { name, exact: true }).click();
}

const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const stamp = () => randomUUID().slice(0, 6);

async function query<T extends object>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await withDb(async (client) => (await client.query<T>(sql, params)).rows)) ?? [];
}

const visitorPaths = [
  "/",
  "/yol-haritasi",
  "/yol-haritasi/oltalama-limani",
  "/odalar",
  "/oda/sahte-kargo-maili",
  "/gundem",
  "/sss",
  "/ogretmenler",
  "/kvkk",
  "/gizlilik",
  "/kosullar",
  "/giris",
  "/kayit",
  "/sifre-sifirla",
  "/katil/ABCDEF",
  // Durum ekranları önizlemesi canlıda kapalıdır (proxy.ts, PREVIEW_PAGE).
  ...(isLive ? [] : ["/onizleme"]),
];

test("ziyaretçi sayfaları CSP ile gelir; tema betiği ve gezinme engellenmez", async ({ page }) => {
  test.slow();
  for (const path of visitorPaths) await visit(page, path);

  // 404 sayfası da aynı politikayla.
  const missing = await page.goto("/boyle-bir-sayfa-yok");
  expect(missing?.status()).toBe(404);
  expectPagePolicy(missing, "/boyle-bir-sayfa-yok");

  // Hidrasyon oldu: tema düğmesi çalışır; tema betiği yenilemede de çalışır.
  await visit(page, "/");
  await page.getByTestId("theme-toggle").filter({ visible: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "gray");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "gray");

  // İstemci tarafı gezinme (React verisi aynı kökten gelir).
  await page.getByRole("contentinfo").getByRole("link", { name: "SSS", exact: true }).click();
  await page.waitForURL("/sss");
  await expect(page.getByRole("heading", { level: 1 }).filter({ visible: true })).toBeVisible();
});

test.describe("hesapla gezilen sayfalar", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");

  test("öğrenci: ana sayfa, profil, eğitim labı, Postam, hacklendin, rapor ve sınıfa katılma", async ({ page }) => {
    test.slow();
    const email = uniqueEmail("csp-ogrenci");
    await signUpVerified(page, email);
    await visit(page, "/");

    // Profil: rozet SVG'leri (public/badges) ve avatarlar.
    await visit(page, "/profil");
    await openProfileSection(page, "Rozetler");
    await expectImageLoaded(page.locator('img[src^="/badges/"]').filter({ visible: true }).first());
    await openProfileSection(page, "Avatar");

    // Eğitim labı: kartlar baştan sona. (Kapak sayfası eğitim labını kendisi oynatıcıya yönlendirir.)
    await visit(page, "/oda/oltalama-egitimi/oyna");
    const player = page.getByTestId("training-player");
    await expect(player).toBeVisible();
    for (const card of training.cards) {
      if (card.type === "clickFind") {
        for (const spot of card.spots ?? []) await player.locator(`[data-part="${spot.part}"]`).click();
        await expect(player.getByText("Hepsini buldun!")).toBeVisible();
      }
      if (card.type === "quiz") await player.getByRole("group", { name: "Cevaplar" }).getByRole("button").nth(card.answer ?? 0).click();
      await player.getByRole("button", { name: /^(Devam|Bitir)$/ }).click();
    }
    await expect(page.getByRole("heading", { name: "Eğitim odası bitti!" })).toBeVisible();

    // Postam: sahte sayfaya şifre yazılır, hacklendin alarmı, sonuç sahnesi ve rapor.
    await finishTraining(email);
    await visit(page, "/oda/sahte-kargo-maili/oyna");
    await page.getByRole("button", { name: "Hazırım, başla" }).click();
    await page.getByRole("button", { name: /^Kargo Takip/ }).click();
    await page.getByRole("button", { name: "Adresi güncelle" }).click();
    await page.getByLabel(/Postam şifresi/).fill("csp-deneme-sifresi");
    await page.getByRole("button", { name: /Giriş yap ve doğrula/ }).click();
    await expect(page.getByTestId("hacked-alarm")).toBeVisible();
    await page.getByRole("button", { name: "Geç", exact: true }).click();
    await continueFromScene(page);
    await reportStep(page, "signs");
    await expect(page.getByTestId("lab-report").getByRole("heading", { name: "Kaçırdığın işaretler" })).toBeVisible();
    expectPagePolicy(await page.reload(), "rapor");

    // Sınıfa katılma bağlantısı ve ana sayfadaki sınıf kutusu.
    const classroom = await insertClassroom();
    await visit(page, `/katil/${classroom.code}`);
    await page.getByRole("main").getByRole("button", { name: "Katıl", exact: true }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(`${classroom.name} sınıfına katıldın`);
    await visit(page, "/");
  });

  test("öğretmen ve okul sorumlusu: Sınıflarım, QR, sınıf detayı, Okulum, yazdırma ve müdüre gönder", async ({ page }) => {
    test.slow();
    const email = uniqueEmail("csp-ogretmen");
    await signUpVerified(page, email);
    const school = await createSchool({ creatorEmail: email });
    await makeTeacher(email, school.id);
    await makeCoordinator(email, school.id);

    await visit(page, "/siniflarim");
    await visit(page, "/siniflarim?yeni=1");
    const dialog = page.getByRole("dialog", { name: "Yeni sınıf" });
    await dialog.getByLabel("Sınıfın adı").fill(`7-C ${stamp()}`);
    await dialog.getByLabel("Düzey").selectOption({ label: "7. sınıf" });
    await dialog.getByRole("button", { name: "Sınıfı oluştur" }).click();
    const codeBox = dialog.getByTestId("new-class-code");
    await expect(codeBox).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
    const code = (await codeBox.textContent())!.trim();
    await dialog.getByRole("button", { name: "Tahtaya yansıt" }).click();
    const board = page.getByRole("dialog", { name: "Tahtaya yansıt" });
    await expect(board.getByRole("img", { name: "Sınıfa katılma bağlantısının QR kodu" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(board).toBeHidden();

    const [classroom] = await query<{ id: string }>(`SELECT "id" FROM "Classroom" WHERE "joinCode" = $1`, [code]);
    await visit(page, `/siniflarim/${classroom.id}`);
    await page.getByRole("tab", { name: "Öğrenciler" }).click();
    await expect(page).toHaveURL(`/siniflarim/${classroom.id}?sekme=ogrenciler`);

    // Okulum: "PDF olarak indir" yazdırma penceresini açar (burada yalnızca çağrıldığı görülür),
    // "Müdüre gönder" bir mailto bağlantısıdır (CSP gezinmeyi değil, sayfanın yüklediklerini sınırlar).
    await page.addInitScript(() => {
      window.print = () => {
        (window as unknown as { printed: boolean }).printed = true;
      };
    });
    await visit(page, "/okulum");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(school.name);
    await expect(page.getByRole("link", { name: "Müdüre gönder" })).toHaveAttribute("href", /^mailto:\?subject=/);
    await page.getByRole("button", { name: "PDF olarak indir" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { printed?: boolean }).printed === true)).toBe(true);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "PDF olarak indir" })).toBeHidden();
    await page.emulateMedia({ media: "screen" });

    await visit(page, "/profil");
  });

  test("yönetim: paneller, lab düzenleme, önizleme (Postam, eğitim, Mesajlar), talep belgesi (görsel ve PDF çerçevesi), haber sayfası", async ({ page }) => {
    test.slow();
    const email = uniqueEmail("csp-yonetici");
    await signUpVerified(page, email);
    await makeAdmin(email);
    const adminId = (await userIdOf(email))!;

    for (const path of [
      "/yonetim",
      "/yonetim/canli-nabiz",
      "/yonetim/talepler",
      "/yonetim/kullanicilar",
      "/yonetim/odalar",
      "/yonetim/odalar/yeni",
      "/yonetim/ipucu",
      "/yonetim/gundem",
      "/yonetim/gundem/yeni",
      "/yonetim/kayit-defteri",
    ]) {
      await visit(page, path);
    }

    // Lab düzenleme ve önizleme: Postam'da hacklenip rapora kadar (hiçbir şey kaydedilmez).
    const labs = await query<{ id: string; slug: string }>(`SELECT "id", "slug" FROM "Lab" WHERE "slug" IN ('sahte-kargo-maili', 'oltalama-egitimi', 'kodu-soran-arkadas')`);
    const labId = (slug: string) => labs.find((l) => l.slug === slug)!.id;
    await visit(page, `/yonetim/odalar/${labId("sahte-kargo-maili")}`);
    await visit(page, `/yonetim/odalar/${labId("sahte-kargo-maili")}/onizle`);
    await page.getByRole("button", { name: "Hazırım, başla" }).click();
    await page.getByRole("button", { name: /^Kargo Takip/ }).click();
    await page.getByRole("button", { name: "Adresi güncelle" }).click();
    await page.getByLabel(/Postam şifresi/).fill("onizleme-sifresi");
    await page.getByRole("button", { name: /Giriş yap ve doğrula/ }).click();
    await page.getByRole("button", { name: "Geç", exact: true }).click();
    await continueFromScene(page);
    await visit(page, `/yonetim/odalar/${labId("oltalama-egitimi")}/onizle`);
    await expect(page.getByTestId("training-player")).toBeVisible();
    // Mesajlar (örnek lab taslak; öğrenciye açık değil, önizlemede oynanır): sohbet açılır, şüpheli
    // kişi bildirilip engellenir.
    await visit(page, `/yonetim/odalar/${labId("kodu-soran-arkadas")}/onizle`);
    await page.getByRole("button", { name: "Hazırım, başla" }).click();
    const app = page.getByTestId("scenario-player");
    await app.getByRole("button", { name: /^Deniz/ }).click();
    await expect(app.getByLabel("Deniz mesajı")).toBeVisible();
    await app.getByRole("button", { name: "Bildir ve engelle", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Bildir ve engelle" }).click();
    await expect(toast(page, "Bildirildi ve engellendi")).toBeVisible();

    // Talep belgesi: görsel pencerede, PDF çerçevede. Belge kendi sandbox CSP'siyle gelir; sayfanın
    // CSP'si (frame-ancestors 'none') onun yerine geçmez, yoksa çerçeve açılmazdı.
    const school = await createSchool({ creatorEmail: email });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
    );
    for (const document of [
      { name: "csp-belgesi.png", mimeType: "image/png", data: png },
      { name: "csp-belgesi.pdf", mimeType: "application/pdf", data: pdf },
    ]) {
      const applicant = await insertApplicant(`Csp Başvuran ${stamp()}`);
      const applicationId = await insertApplication(applicant.id, school, document);
      await visit(page, `/yonetim/talepler?talep=${applicationId}`);
      const detail = page.getByRole("region", { name: `Talep: ${applicant.name}` });
      await detail.getByRole("button", { name: "Belgeyi gör" }).click();
      const viewer = page.getByRole("dialog", { name: document.name });
      const documentPath = `/yonetim/talepler/${applicationId}/belge`;
      if (document.mimeType === "image/png") {
        await expectImageLoaded(viewer.getByRole("img", { name: `${document.name} belgesinin görüntüsü` }));
      } else {
        await expect(viewer.locator("iframe")).toBeVisible();
        await expect.poll(() => page.frames().some((f) => f.url().endsWith(documentPath))).toBe(true);
        expect(page.frames().some((f) => f.url().startsWith("chrome-error:"))).toBe(false);
      }
      const documentPolicy = (await page.request.get(documentPath, { maxRetries: 2 })).headers()["content-security-policy"];
      expect(parsePolicy(documentPolicy)).toEqual({
        sandbox: "",
        "default-src": "'none'",
        "img-src": "'self' data:",
        "object-src": "'self'",
        "frame-ancestors": "'self'",
      });
      await page.keyboard.press("Escape");
    }

    // Yayındaki haberin sayfası (haber geçmiş bir tarihte yayımlanmış sayılır, gündemin başına geçmez).
    const slug = `e2e-csp-${stamp()}`;
    await query(
      `INSERT INTO "NewsArticle" ("id", "slug", "title", "summary", "content", "status", "publishedAt", "authorId", "updatedAt")
       VALUES ($1, $2, $3, 'CSP testi haberi.', '{}'::jsonb, 'PUBLISHED', $4, $5, now())`,
      [newId(), slug, `E2E CSP ${slug}`, new Date("2020-01-03T09:00:00Z"), adminId],
    );
    try {
      await visit(page, `/gundem/${slug}`);
    } finally {
      await query(`DELETE FROM "NewsArticle" WHERE "slug" = $1`, [slug]);
    }
  });
});

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Öğretmeni ve okuluyla bir sınıf (veritabanına doğrudan). */
async function insertClassroom() {
  const teacherEmail = uniqueEmail("csp-sinif-ogretmeni");
  const teacherId = newId();
  const id = newId();
  const code = Array.from({ length: 6 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join("");
  const name = `8-A ${stamp()}`;
  await query(`INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "updatedAt") VALUES ($1, 'Csp Öğretmen', $2, true, now())`, [teacherId, teacherEmail]);
  const school = await createSchool({ creatorEmail: teacherEmail });
  await makeTeacher(teacherEmail, school.id);
  await query(`INSERT INTO "Classroom" ("id", "name", "level", "teacherId", "joinCode") VALUES ($1, $2, '8', $3, $4)`, [id, name, teacherId, code]);
  await query(
    `INSERT INTO "Assignment" ("id", "classroomId", "neighborhoodId", "dueDate") SELECT $1, $2, n.id, NULL FROM "Neighborhood" n WHERE n.slug = 'oltalama-limani'`,
    [newId(), id],
  );
  return { id, code, name };
}

async function insertApplicant(name: string) {
  const id = newId();
  await query(`INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "updatedAt") VALUES ($1, $2, $3, true, now())`, [id, name, uniqueEmail("csp-basvuran")]);
  return { id, name };
}

async function insertApplication(userId: string, school: { id: string; province: string; district: string }, document: { name: string; mimeType: string; data: Buffer }) {
  const id = newId();
  await query(
    `INSERT INTO "TeacherApplication" ("id", "userId", "schoolId", "province", "district", "subject", "documentName", "documentSize")
     VALUES ($1, $2, $3, $4, $5, 'Bilişim Teknolojileri', $6, $7)`,
    [id, userId, school.id, school.province, school.district, document.name, document.data.length],
  );
  await query(`INSERT INTO "ApplicationDocument" ("applicationId", "mimeType", "data") VALUES ($1, $2, $3)`, [id, document.mimeType, document.data]);
  return id;
}
