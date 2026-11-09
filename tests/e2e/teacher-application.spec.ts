import { randomBytes, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { provinces } from "../../lib/school/places";
import { isLive, signUp, signUpVerified, uniqueEmail } from "./support/account";
import { withDb } from "./support/db";
import { createSchool, makeTeacher, userIdOf } from "./support/teacher";

// Profil > Öğretmenlik (Tur 4, 17 son hali): talep formu, inceleniyor, bilgi istendi, onaylandı,
// onaylanmadı. Yönetimin kararı (Faz 5) burada veritabanına doğrudan yazılır.

const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });
const section = (page: Page) => page.getByRole("region", { name: "Öğretmen misin?" });

/** Her test başka bir ilçede çalışır: ilçenin okul listesinde yalnızca testin okulları olur. */
function randomPlace() {
  const province = provinces[Math.floor(Math.random() * provinces.length)];
  return { province: province.name, district: province.districts[Math.floor(Math.random() * province.districts.length)] };
}

/** Henüz okulu olmayan bir ilçe: yazılan ad hiçbir okula bağlanmaz. */
async function emptyPlace() {
  for (;;) {
    const place = randomPlace();
    const count = await withDb(
      async (client) =>
        (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "School" WHERE "province" = $1 AND "district" = $2`, [place.province, place.district]))
          .rows[0].n,
    );
    if (!count) return place;
  }
}

const schoolName = () => `E2E Ortaokulu ${randomUUID().slice(0, 8)}`;

// 1x1 PNG ve en küçük PDF; uzantısı .pdf olan düz metin sahte belgedir.
const pngFile = {
  name: "kucuk-gorsel.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
};
const pdfFile = { name: "gorev-yeri-belgesi.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n") };
const fakePdf = { name: "sahte.pdf", mimeType: "application/pdf", buffer: Buffer.from("Bu bir PDF degil, sadece metin.") };

async function openTeaching(page: Page, query = "") {
  await page.goto(`/profil?bolum=ogretmenlik${query}`);
  await expect(section(page)).toBeVisible();
}

async function choosePlace(page: Page, place: { province: string; district: string }) {
  await section(page).getByLabel("İl", { exact: true }).selectOption(place.province);
  await section(page).getByLabel("İlçe", { exact: true }).selectOption(place.district);
}

type Row = { status: string; schoolId: string | null; newSchoolName: string | null; subject: string; answer: string | null; documentName: string | null };

async function applicationsOf(email: string) {
  return (
    (await withDb(
      async (client) =>
        (
          await client.query<Row & { mimeType: string | null; head: string | null; answeredAt: Date | null }>(
            `SELECT a."status", a."schoolId", a."newSchoolName", a."subject", a."answer", a."answeredAt", a."documentName",
                    d."mimeType", encode(substring(d."data" from 1 for 4), 'hex') AS "head"
             FROM "TeacherApplication" a JOIN "User" u ON u."id" = a."userId"
             LEFT JOIN "ApplicationDocument" d ON d."applicationId" = a."id"
             WHERE u."email" = $1 ORDER BY a."createdAt"`,
            [email],
          )
        ).rows,
    )) ?? []
  );
}

/** Yönetimin yazacağı talebi doğrudan ekler (bilgi istendi, onaylanmadı halleri için). */
async function insertApplication(
  email: string,
  fields: { status: "INFO_REQUESTED" | "REJECTED"; schoolId: string; province: string; district: string; subject: string; question?: string; rejectionNote?: string },
) {
  const userId = await userIdOf(email);
  await withDb((client) =>
    client.query(
      `INSERT INTO "TeacherApplication"
         ("id", "userId", "schoolId", "province", "district", "subject", "status", "question", "questionAt", "rejectionNote", "decidedAt", "documentName", "documentSize")
       VALUES ($1, $2, $3, $4, $5, $6, $7::"ApplicationStatus", $8, CASE WHEN $8::text IS NULL THEN NULL ELSE now() END,
               $9, CASE WHEN $7 = 'REJECTED' THEN now() ELSE NULL END, $10, $11)`,
      [
        `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`,
        userId,
        fields.schoolId,
        fields.province,
        fields.district,
        fields.subject,
        fields.status,
        fields.question ?? null,
        fields.rejectionNote ?? null,
        fields.status === "REJECTED" ? "gorev-yeri.pdf" : null,
        fields.status === "REJECTED" ? 240 * 1024 : null,
      ],
    ),
  );
}

test.describe("öğretmenlik talebi", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  test("okul adı yazılarak talep gönderilir (aynı adlı okula bağlanır), inceleniyor görünür ve geri çekilir", async ({ page }) => {
    const email = uniqueEmail("talep");
    await signUpVerified(page, email);
    const place = randomPlace();
    const school = await createSchool({ creatorEmail: email, name: schoolName(), ...place });

    await openTeaching(page);
    const box = section(page);
    await box.getByRole("button", { name: "Öğretmenlik talebi oluştur" }).click();

    // Eksik formda gönder, neyin eksik olduğunu yazar.
    await box.getByRole("button", { name: "Talebi gönder" }).click();
    await expect(box.getByText("İlini ve ilçeni seç.")).toBeVisible();
    await expect(box.getByText("Branşını yaz (2-60 karakter).")).toBeVisible();

    // Okul listesi yok (sabah soruları 26b): ilçede okul olsa da gösterilmez, ad yazılır.
    await choosePlace(page, place);
    await expect(box.getByRole("radio")).toHaveCount(0);
    await expect(box.getByText(school.name)).toHaveCount(0);
    await box.getByRole("button", { name: "Talebi gönder" }).click();
    await expect(box.getByText("Okulunun tam adını yaz.")).toBeVisible();
    await box.getByLabel("Okulunun tam adı").fill(school.name.toLocaleUpperCase("tr"));
    await box.getByLabel("Branşın").fill("  Bilişim   Teknolojileri ");
    await box.getByLabel("Kurumsal e-posta").fill("ayse.kaya@");
    await box.getByRole("button", { name: "Talebi gönder" }).click();
    await expect(box.getByText("Bu e-posta adresi eksik görünüyor.")).toBeVisible();
    await box.getByLabel("Kurumsal e-posta").fill("Ayse.Kaya@okul.k12.tr");
    await box.getByRole("button", { name: "Talebi gönder" }).click();

    await expect(toast(page, "Talebin gönderildi")).toBeVisible();
    await expect(box.getByText("Talebin inceleniyor")).toBeVisible();
    await expect(box.getByRole("list", { name: "Talebin adımları" }).getByRole("listitem")).toHaveCount(3);
    await expect(box.getByText(school.name)).toBeVisible();
    await expect(box.getByText("Bilişim Teknolojileri")).toBeVisible();
    await expect(box.getByText("ayse.kaya@okul.k12.tr")).toBeVisible();
    expect(await applicationsOf(email)).toMatchObject([
      { status: "PENDING", schoolId: school.id, newSchoolName: null, subject: "Bilişim Teknolojileri", documentName: null },
    ]);

    // Yenileyince de inceleniyor.
    await page.reload();
    await expect(section(page).getByText("Talebin inceleniyor")).toBeVisible();

    // Geri çek: onay penceresi, sonra talep ve belgesi silinir.
    await section(page).getByRole("button", { name: "Talebi geri çek" }).click();
    const dialog = page.getByRole("dialog", { name: "Talebini geri çekmek istiyor musun?" });
    await dialog.getByRole("button", { name: "Talebi geri çek" }).click();
    await expect(toast(page, "Talebini geri çektin")).toBeVisible();
    await expect(section(page).getByRole("button", { name: "Öğretmenlik talebi oluştur" })).toBeVisible();
    expect(await applicationsOf(email)).toEqual([]);
  });

  test("sistemde olmayan okul: talep yeni okul olarak gider, öğretmen \"yeni okul\" etiketini görmez", async ({ page }) => {
    const email = uniqueEmail("yeniokul");
    await signUpVerified(page, email);
    const place = await emptyPlace();
    const newName = schoolName();

    await openTeaching(page);
    const box = section(page);
    await box.getByRole("button", { name: "Öğretmenlik talebi oluştur" }).click();
    await choosePlace(page, place);
    await expect(box.getByText("Kısaltma kullanma. Yönetici okulunu kontrol eder, gerekirse adını düzeltir, sonra talebine bakar.")).toBeVisible();
    await box.getByLabel("Okulunun tam adı").fill("Ok");
    await box.getByLabel("Branşın").fill("Matematik");
    await box.getByRole("button", { name: "Talebi gönder" }).click();
    await expect(box.getByText("Okulunun tam adını yaz.")).toBeVisible();
    await box.getByLabel("Okulunun tam adı").fill(`  ${newName}  `);
    await box.getByRole("button", { name: "Talebi gönder" }).click();

    await expect(toast(page, "Talebin gönderildi")).toBeVisible();
    await expect(box.getByText(newName, { exact: true })).toBeVisible();
    await expect(box.getByText("(yeni okul)")).toHaveCount(0);
    expect(await applicationsOf(email)).toMatchObject([{ status: "PENDING", schoolId: null, newSchoolName: newName }]);
  });

  test("davet bağlantısı formu okul seçili açar", async ({ page }) => {
    const email = uniqueEmail("davet");
    await signUpVerified(page, email);
    const place = randomPlace();
    const school = await createSchool({ creatorEmail: email, name: schoolName(), ...place });

    await openTeaching(page, `&okul=${encodeURIComponent(school.id)}`);
    const box = section(page);
    await expect(box.getByLabel("İl", { exact: true })).toHaveValue(place.province);
    await expect(box.getByLabel("İlçe", { exact: true })).toHaveValue(place.district);
    await expect(box.getByRole("radio", { name: new RegExp(school.name) })).toBeChecked();
    await expect(box.getByLabel("Okulunun tam adı")).toHaveCount(0);
    // "Başka bir okul" denince ad kutusu açılır; geri dönülünce davetteki okul gider.
    await box.getByRole("radio", { name: /Başka bir okul/ }).check();
    await expect(box.getByLabel("Okulunun tam adı")).toBeVisible();
    await box.getByRole("radio", { name: new RegExp(school.name) }).check();
    await box.getByLabel("Branşın").fill("Türkçe");
    await box.getByRole("button", { name: "Talebi gönder" }).click();
    await expect(toast(page, "Talebin gönderildi")).toBeVisible();
    expect(await applicationsOf(email)).toMatchObject([{ status: "PENDING", schoolId: school.id }]);

    // Bilinmeyen okul kimliği yok sayılır: form kapalı gelir.
    const other = uniqueEmail("davet2");
    await page.context().clearCookies({ name: /better-auth\./ });
    await signUpVerified(page, other);
    await openTeaching(page, "&okul=yok-boyle-bir-okul");
    await expect(section(page).getByRole("button", { name: "Öğretmenlik talebi oluştur" })).toBeVisible();
  });

  test("belge: sahte PDF reddedilir, PNG yeniden çizilip JPG olarak gider", async ({ page }) => {
    const email = uniqueEmail("belge");
    await signUpVerified(page, email);
    const place = randomPlace();
    const school = await createSchool({ creatorEmail: email, name: schoolName(), ...place });

    await openTeaching(page, `&okul=${encodeURIComponent(school.id)}`);
    const box = section(page);
    const input = box.locator('input[type="file"]');
    await input.setInputFiles(fakePdf);
    await expect(box.getByText("Sadece PDF, JPG ya da PNG ekleyebilirsin.")).toBeVisible();

    await input.setInputFiles(pngFile);
    await expect(box.getByText("kucuk-gorsel.jpg")).toBeVisible();
    await expect(box.getByText(/KB · eklendi$/)).toBeVisible();
    await expect(box.getByText("Sadece PDF, JPG ya da PNG ekleyebilirsin.")).toHaveCount(0);

    // Kaldırılıp yeniden eklenebilir.
    await box.getByRole("button", { name: "Belgeyi kaldır" }).click();
    await expect(box.getByRole("button", { name: /Belge ekle/ })).toBeVisible();
    await input.setInputFiles(pngFile);
    await expect(box.getByText("kucuk-gorsel.jpg")).toBeVisible();

    await box.getByLabel("Branşın").fill("Bilişim Teknolojileri");
    await box.getByRole("button", { name: "Talebi gönder" }).click();
    await expect(toast(page, "Talebin gönderildi")).toBeVisible();
    await expect(box.getByText(/^kucuk-gorsel\.jpg · \d+ KB$/)).toBeVisible();
    expect(await applicationsOf(email)).toMatchObject([{ documentName: "kucuk-gorsel.jpg", mimeType: "image/jpeg", head: expect.stringMatching(/^ffd8ff/) }]);
  });

  test("bilgi istenince cevap ve PDF gönderilir, talep yeniden incelemeye döner", async ({ page }) => {
    const email = uniqueEmail("bilgi");
    await signUpVerified(page, email);
    const place = randomPlace();
    const school = await createSchool({ creatorEmail: email, name: schoolName(), ...place });
    await insertApplication(email, {
      status: "INFO_REQUESTED",
      schoolId: school.id,
      subject: "Fen Bilimleri",
      question: "Görev yeri belgeni ekler misin?",
      ...place,
    });

    await openTeaching(page);
    const box = section(page);
    await expect(box.getByText("Yönetici senden bilgi istedi")).toBeVisible();
    await expect(box.getByText("Görev yeri belgeni ekler misin?")).toBeVisible();
    await expect(box.getByText(/^Talebin beklemede · soru Bugün \d{2}:\d{2}$/)).toBeVisible();

    await box.getByRole("button", { name: "Cevabı gönder" }).click();
    await expect(box.getByText("Bir cevap yaz ya da belge ekle.")).toBeVisible();

    await box.getByLabel("Cevabın").fill("Belgeyi ekledim.");
    await box.locator('input[type="file"]').setInputFiles(pdfFile);
    await expect(box.getByText("gorev-yeri-belgesi.pdf")).toBeVisible();
    await box.getByRole("button", { name: "Cevabı gönder" }).click();

    await expect(toast(page, "Cevabın gitti")).toBeVisible();
    await expect(box.getByText("Talebin inceleniyor")).toBeVisible();
    await expect(box.getByText("Bilgi istendi, cevapladın")).toBeVisible();
    await expect(box.getByText(/^gorev-yeri-belgesi\.pdf · 1 KB$/)).toBeVisible();
    const [row] = await applicationsOf(email);
    expect(row).toMatchObject({ status: "PENDING", answer: "Belgeyi ekledim.", documentName: "gorev-yeri-belgesi.pdf", mimeType: "application/pdf", head: "25504446" });
    expect(row.answeredAt).not.toBeNull();
  });

  test("onaylanmayan talep yöneticinin notuyla görünür, bilgiler düzeltilip yeniden gönderilir", async ({ page }) => {
    const email = uniqueEmail("ret");
    await signUpVerified(page, email);
    const place = randomPlace();
    const school = await createSchool({ creatorEmail: email, name: schoolName(), ...place });
    await insertApplication(email, {
      status: "REJECTED",
      schoolId: school.id,
      subject: "Matematk",
      rejectionNote: "Okul bilgisi doğrulanamadı. Kurumsal e-postanı eklersen yeniden bakarız.",
      ...place,
    });

    await openTeaching(page);
    const box = section(page);
    await expect(box.getByText("Talebin bu sefer onaylanmadı")).toBeVisible();
    await expect(box.getByText(/ · gönderdiğin belge silindi$/)).toBeVisible();
    await expect(box.getByText("Okul bilgisi doğrulanamadı. Kurumsal e-postanı eklersen yeniden bakarız.")).toBeVisible();

    await box.getByRole("button", { name: "Bilgileri düzeltip yeniden gönder" }).click();
    await expect(box.getByLabel("İl", { exact: true })).toHaveValue(place.province);
    await expect(box.getByRole("radio", { name: new RegExp(school.name) })).toBeChecked();
    await expect(box.getByLabel("Branşın")).toHaveValue("Matematk");
    await box.getByLabel("Branşın").fill("Matematik");
    await box.getByLabel("Kurumsal e-posta").fill("ogretmen@okul.k12.tr");
    await box.getByRole("button", { name: "Talebi gönder" }).click();

    await expect(toast(page, "Talebin gönderildi")).toBeVisible();
    await expect(box.getByText("Talebin inceleniyor")).toBeVisible();
    expect(await applicationsOf(email)).toMatchObject([
      { status: "REJECTED", subject: "Matematk" },
      { status: "PENDING", subject: "Matematik", schoolId: school.id },
    ]);
  });

  test("öğretmen hesabı açıksa form yerine Sınıflarım bağlantıları görünür", async ({ page }) => {
    const email = uniqueEmail("ogretmen");
    await signUpVerified(page, email);
    const school = await createSchool({ creatorEmail: email, name: schoolName(), ...randomPlace() });
    await makeTeacher(email, school.id);

    await openTeaching(page);
    const box = section(page);
    await expect(box.getByText("Öğretmen hesabın açık")).toBeVisible();
    await expect(box.getByText(school.name)).toBeVisible();
    await expect(box.getByRole("link", { name: "İlk sınıfını oluştur" })).toHaveAttribute("href", "/siniflarim?yeni=1");
    await expect(box.getByRole("link", { name: "Sınıflarım'a git" })).toHaveAttribute("href", "/siniflarim");
    await expect(box.getByRole("button", { name: "Öğretmenlik talebi oluştur" })).toHaveCount(0);

    // Sınıfı olan öğretmen "İlk sınıfını oluştur" görmez; Sınıflarım öne çıkar.
    const teacherId = await userIdOf(email);
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const joinCode = Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
    await withDb((client) =>
      client.query(`INSERT INTO "Classroom" ("id", "name", "level", "teacherId", "joinCode") VALUES ($1, '7-A', '7', $2, $3)`, [
        `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`,
        teacherId,
        joinCode,
      ]),
    );
    await openTeaching(page);
    await expect(box.getByRole("link", { name: "Sınıflarım'a git" })).toHaveAttribute("href", "/siniflarim");
    await expect(box.getByRole("link", { name: "Yeni sınıf oluştur" })).toHaveAttribute("href", "/siniflarim?yeni=1");
    await expect(box.getByRole("link", { name: "İlk sınıfını oluştur" })).toHaveCount(0);
  });

  test("e-postası doğrulanmamış hesap önce doğrulamaya yönlendirilir", async ({ page }) => {
    await signUp(page, uniqueEmail("dogrulanmamis"));
    await openTeaching(page);
    const box = section(page);
    await expect(box.getByText("Öğretmenlik talebi göndermek için önce e-posta adresini doğrulaman gerekiyor.")).toBeVisible();
    await expect(box.getByRole("link", { name: "E-postanı doğrula" })).toHaveAttribute("href", "/dogrula");
    await expect(box.getByRole("button", { name: "Öğretmenlik talebi oluştur" })).toHaveCount(0);
  });
});
