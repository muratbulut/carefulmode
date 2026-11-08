import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { deleteTestLabs, makeAdmin } from "./support/admin";
import { withDb } from "./support/db";
import { userIdOf } from "./support/teacher";

// Faz 5: yönetim özeti, canlı nabız ve kayıt defteri. Veritabanı başka koşularla ortak: testler
// yalnızca kendi açtıkları kayıtlara ve görünürlüğe bakar, toplam sayılara bakmaz.

const pages = ["/yonetim", "/yonetim/canli-nabiz", "/yonetim/kayit-defteri"];

// Next önceki sayfaları gizli olarak bellekte tutar; yalnızca görünenler arasından aranır.
const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });
const rows = (page: Page) => page.getByTestId("audit-row").filter({ visible: true });

const stamp = () => `${Date.now().toString(36)}${process.pid.toString(36)}${randomUUID().slice(0, 4)}`;
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;

async function setDisplayName(email: string, name: string) {
  await withDb((client) => client.query(`UPDATE "User" SET "displayName" = $2 WHERE "email" = $1`, [email, name]));
}

/** Kayıt olur, doğrular ve yönetici yapar; ad verilirse görünen ad değişir. */
async function signUpAdmin(page: Page, name?: string) {
  const email = uniqueEmail("admin");
  await signUpVerified(page, email);
  await makeAdmin(email);
  if (name) await setDisplayName(email, name);
  return email;
}

/** Kayıt olur ve yönetim ekibine verilen izinlerle girer (sorumlu). */
async function signUpTeamMember(page: Page, permissions: string[], name?: string) {
  const email = uniqueEmail("sorumlu");
  await signUpVerified(page, email);
  if (name) await setDisplayName(email, name);
  await withDb((client) =>
    client.query(
      `INSERT INTO "TeamPermission" ("userId", "permission", "grantedById")
       SELECT u."id", p::"TeamPermissionType", u."id" FROM "User" u, unnest($2::text[]) p WHERE u."email" = $1`,
      [email, permissions],
    ),
  );
  return email;
}

/** Doğrudan veritabanına öğrenci hesabı (giriş yapmayacak; yalnızca sayılarda ve akışta görünür). */
async function insertStudent(name: string) {
  const id = newId();
  const email = `${id}@ornek.com`;
  await withDb((client) =>
    client.query(
      `INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "role", "birthYear", "updatedAt")
       VALUES ($1, $2, $3, true, 'STUDENT', 2012, now())`,
      [id, name, email],
    ),
  );
  return { id, email };
}

async function deleteStudent(id: string) {
  await withDb(async (client) => {
    await client.query(`DELETE FROM "TeacherApplication" WHERE "userId" = $1`, [id]);
    await client.query(`DELETE FROM "LabAttempt" WHERE "userId" = $1`, [id]);
    await client.query(`DELETE FROM "User" WHERE "id" = $1`, [id]);
  });
}

async function expectNotFound(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
  await expect(page.getByRole("navigation", { name: "Yönetim menüsü" })).toHaveCount(0);
}

test("giriş yapmamış ziyaretçi özet, canlı nabız ve kayıt defteri yerine girişe gönderilir", async ({ page }) => {
  for (const path of pages) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/giris\\?sonra=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  }
});

test("geçersiz oturum çereziyle üç sayfa da yok der", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "better-auth.session_token", value: "gecersiz.oturum", url: baseURL! }]);
  for (const path of pages) await expectNotFound(page, path);
});

test.describe("yönetim özeti, canlı nabız ve kayıt defteri", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  test("öğrenci üç sayfayı da göremez: sayfa yok der", async ({ page }) => {
    await signUpVerified(page, uniqueEmail("ogrenci"));
    for (const path of pages) await expectNotFound(page, path);
  });

  test("yalnızca ipucu izni olan sorumlu özeti ve canlı nabzı görür; iş kartları, son kayıtlar ve kayıt defteri yok", async ({ page }) => {
    await signUpTeamMember(page, ["TIPS"]);

    await page.goto("/yonetim");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Merhaba Deneme");
    for (const key of ["applications", "news", "labs", "notes"]) await expect(page.getByTestId(`pending-${key}`)).toHaveCount(0);
    await expect(page.getByText("Bugünlük bekleyen iş kalmadı.")).toBeVisible();
    await expect(page.getByText("Bekleyen iş yok, her şey yolunda. Sayılar aşağıda.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Son kayıtlar" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Bu hafta" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Tüm zamanlar" }).click();
    await expect(page.getByTestId("overview-kpis")).toContainText("Biten oda");

    await page.goto("/yonetim/canli-nabiz");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Canlı nabız");
    await expect(page.getByTestId("pulse-state")).toHaveText("CANLI · ŞU AN");
    await page.getByRole("button", { name: "Duraklat" }).click();
    await expect(page.getByTestId("pulse-state")).toHaveText("DURAKLATILDI");
    await page.getByRole("button", { name: "Devam et" }).click();
    await expect(page.getByTestId("pulse-state")).toHaveText("CANLI · ŞU AN");

    await expectNotFound(page, "/yonetim/kayit-defteri");
  });

  test("yönetici bekleyen talep kartını görür; Bugün değil saklar, Geri al geri getirir", async ({ page }) => {
    await signUpAdmin(page);
    const applicant = await insertStudent(`Talep Sahibi ${stamp()}`);
    await withDb((client) =>
      client.query(
        `INSERT INTO "TeacherApplication" ("id", "userId", "newSchoolName", "province", "district", "subject")
         VALUES ($1, $2, 'E2E Yeni Okul', 'Ankara', 'Çankaya', 'Bilişim')`,
        [newId(), applicant.id],
      ),
    );
    try {
      await page.goto("/yonetim");
      const card = page.getByTestId("pending-applications");
      await expect(card).toBeVisible();
      await expect(card).toContainText("öğretmenlik talebi bekliyor");
      await expect(card.getByRole("link", { name: "Taleplere git" })).toHaveAttribute("href", "/yonetim/talepler");

      await card.getByRole("button", { name: /^Bugün değil: / }).click();
      await expect(card).toHaveCount(0);
      await expect(toast(page, "Yarın tekrar gösterilecek")).toBeVisible();
      await toast(page, "Yarın tekrar gösterilecek").getByRole("button", { name: "Geri al" }).click();
      await expect(page.getByTestId("pending-applications")).toBeVisible();

      // Seçim bu tarayıcıda gün boyu durur: sayfa yenilenince kart yine saklı.
      await page.getByTestId("pending-applications").getByRole("button", { name: /^Bugün değil: / }).click();
      await expect(page.getByTestId("pending-applications")).toHaveCount(0);
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Merhaba Deneme");
      await expect(page.getByTestId("pending-applications")).toHaveCount(0);
    } finally {
      await deleteStudent(applicant.id);
    }
  });

  test("özet ve canlı nabız sayfalarında öğrencinin adı, e-postası ve kimliği geçmez", async ({ page }) => {
    const adminEmail = await signUpAdmin(page);
    const tag = stamp();
    const name = `Zümrüt${tag} Kaplanoğlu`;
    const student = await insertStudent(name);
    const adminId = await userIdOf(adminEmail);
    await withDb(async (client) => {
      const lab = await client.query<{ id: string; publishedVersion: number }>(
        `SELECT "id", "publishedVersion" FROM "Lab" WHERE "slug" = 'sahte-kargo-maili'`,
      );
      const { id: labId, publishedVersion } = lab.rows[0];
      await client.query(
        `INSERT INTO "LabAttempt" ("id", "userId", "labId", "labVersion", "status", "startedAt", "endedAt", "reportScore", "resultReport")
         VALUES ($1, $2, $3, $4, 'HACKED', now() - interval '3 minutes', now(), 1, $5),
                ($6, $2, $3, $4, 'IN_PROGRESS', now(), NULL, NULL, NULL)`,
        [newId(), student.id, labId, publishedVersion, JSON.stringify({ status: "hacked", rows: [] }), newId()],
      );
      await client.query(`INSERT INTO "EarnedBadge" ("userId", "badgeCode") VALUES ($1, 'ilk-rapor')`, [student.id]);
      await client.query(`INSERT INTO "AuditLog" ("id", "actorId", "action", "target", "details") VALUES ($1, $2, 'student.profile_viewed', $3, '{}')`, [
        newId(),
        adminId,
        `user:${student.id}`,
      ]);
    });
    // Ad, soyadın baş harfiyle kısaltılmış hali, e-posta ve kimlik hiçbir yerde (HTML ve sayfa verisi) geçmez.
    const secrets = [name, `Zümrüt${tag}`, tag, student.email, student.id];
    try {
      await page.goto("/yonetim");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Merhaba Deneme");
      await expect(page.getByTestId("recent-audit")).toContainText("Öğrenci profiline bakıldı: bir öğrenci");
      for (const html of [await page.content(), await (await page.request.get("/yonetim")).text()]) {
        for (const secret of secrets) expect(html).not.toContain(secret);
      }

      await page.goto("/yonetim/canli-nabiz");
      const feed = page.getByTestId("pulse-feed");
      await expect(feed).toContainText('"Sahte kargo maili" odasında biri tuzağa düştü, rapor açıldı');
      await expect(feed).toContainText('Biri "İlk rapor" rozetini kazandı');
      expect(Number(await page.getByTestId("pulse-live").innerText())).toBeGreaterThanOrEqual(1);
      for (const html of [await page.content(), await (await page.request.get("/yonetim/canli-nabiz")).text()]) {
        for (const secret of secrets) expect(html).not.toContain(secret);
      }
    } finally {
      await deleteStudent(student.id);
    }
  });

  test("yönetici lab işlemlerini kayıt defterinde Lab türüyle bulur; arama, tür ve kişi süzgeçleri çalışır", async ({ page }, testInfo) => {
    test.slow();
    const tag = stamp();
    const adminName = `Defter${tag} Yazar`;
    await signUpAdmin(page, adminName);
    const lab = { name: `E2E Defter ${tag} ${testInfo.project.name}`, slug: "" };
    lab.slug = lab.name.toLowerCase().replaceAll(" ", "-");
    const note = "Metinler gözden geçiriliyor";
    try {
      // Örnek içerikle taslak, v1 yayını ve not ile gizleme
      await page.goto("/yonetim/odalar/yeni");
      const form = page.getByRole("form", { name: "Yeni oda" });
      await form.getByText("Gelen kutusu", { exact: true }).click();
      await form.getByLabel("Oda adı").fill(lab.name);
      await form.getByText("Örnek içerikle başla").click();
      await form.getByRole("button", { name: "Taslağı oluştur" }).click();
      await page.waitForURL(/\/yonetim\/odalar\/(?!yeni)[^/]+$/);
      await page.getByRole("button", { name: "v1 olarak yayınla" }).click();
      await page.getByRole("dialog", { name: `${lab.name} · v1 yayınlansın mı?` }).getByRole("button", { name: "Yayınla", exact: true }).click();
      await expect(toast(page, `${lab.name} v1 yayında.`)).toBeVisible();
      await page.goto("/yonetim/odalar");
      await page.getByRole("switch", { name: `Gizle: ${lab.name}` }).click();
      const hide = page.getByRole("dialog", { name: `${lab.name} odasını gizle` });
      await hide.getByLabel(/Neden gizliyorsun/).fill(note);
      await hide.getByRole("button", { name: "Gizle", exact: true }).click();
      await expect(toast(page, `${lab.name} gizlendi`)).toBeVisible();

      // Kayıt defteri: Lab türü
      await page.goto("/yonetim/kayit-defteri");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kayıt defteri");
      const kinds = page.getByRole("navigation", { name: "Tür" });
      await kinds.getByRole("link", { name: "Oda", exact: true }).click();
      await expect(page).toHaveURL(/[?&]tur=oda/);
      await expect(kinds.getByRole("link", { name: "Oda", exact: true })).toHaveAttribute("aria-current", "true");
      const ours = rows(page).filter({ hasText: lab.name });
      await expect(ours.filter({ hasText: `"${lab.name}" taslağı örnek içerikle açıldı` })).toHaveCount(1);
      await expect(ours.filter({ hasText: `"${lab.name}" v1 yayınlandı` })).toHaveCount(1);
      await expect(ours.filter({ hasText: `"${lab.name}" gizlendi · not: ${note}` })).toHaveCount(1);
      for (const row of await ours.all()) {
        await expect(row).toContainText(`Defter${tag} Y.`);
        await expect(row).toContainText("Oda");
      }

      // Arama: yalnızca bu labın kayıtları
      await page.getByRole("searchbox", { name: "Kayıtlarda ara" }).fill(lab.name);
      await expect(page).toHaveURL(/[?&]ara=/);
      await expect(rows(page)).toHaveCount(3);
      await expect(page.getByTestId("audit-count")).toHaveText("3 kayıt");

      // Tür "Talep" ile aynı arama boş
      await kinds.getByRole("link", { name: "Talep", exact: true }).click();
      await expect(page).toHaveURL(/[?&]tur=talep/);
      await expect(page.getByText("Bu seçimle kayıt yok.")).toBeVisible();
      await expect(rows(page)).toHaveCount(0);

      // Kişi süzgeci: aramasız, bütün türler; yalnızca bu yöneticinin kayıtları
      await page.goto("/yonetim/kayit-defteri");
      await page.getByLabel("Kişi").selectOption({ label: adminName });
      await expect(page).toHaveURL(/[?&]kisi=/);
      await expect(rows(page)).toHaveCount(3);
      for (const row of await rows(page).all()) await expect(row).toContainText(`Defter${tag} Y.`);
    } finally {
      await deleteTestLabs({ slug: lab.slug });
    }
  });

  test("kayıt defteri izni olan sorumlu sayfayı açar ve 'Bu sayfayı görenler' listesinde görünür", async ({ page }) => {
    const first = `Sorumlu${stamp()}`;
    await signUpTeamMember(page, ["AUDIT_LOG"], `${first} Kaya`);
    await page.goto("/yonetim/kayit-defteri");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kayıt defteri");
    const seers = page.getByTestId("audit-seers");
    // Kişi çoksa (yerel veritabanında çok sayıda test yöneticisi var) kalanlar "+N kişi daha" ile açılır.
    const more = seers.getByText(/^\+\d+ kişi daha$/).filter({ visible: true });
    if (await more.count()) await more.click();
    const me = seers.getByRole("listitem").filter({ hasText: `${first} K.`, visible: true });
    await expect(me).toBeVisible();
    await expect(me).toContainText("Sorumlu · izinli");
    await expect(seers.getByRole("listitem").filter({ hasText: "Yönetici", visible: true }).first()).toBeVisible();

    // Kayıt defterini gören özette son kayıtları da görür.
    await page.goto("/yonetim");
    await expect(page.getByRole("heading", { name: "Son kayıtlar" })).toBeVisible();
  });
});
