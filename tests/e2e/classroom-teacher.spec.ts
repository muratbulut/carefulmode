import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { withDb } from "./support/db";
import { finishTraining } from "./support/lab";
import { makeTeacher } from "./support/teacher";

// Faz 4, öğretmenin sınıfları: Sınıflarım, yeni sınıf, tahtaya yansıt, sınıf detayı, ödev ve
// öğrenciyi çıkarma. Öğrenciler ve onların lab ilerlemesi doğrudan veritabanına yazılır
// (katılma akışı ve lablar kendi testlerinde arayüzden sınanır).

// Next önceki sayfaları gizli olarak bellekte tutar; bildirimler yalnızca görünenler arasından aranır.
const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });

const dbId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = () => Array.from({ length: 6 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join("");

/** Türkiye takvimiyle bugünden `days` gün sonrası, tarih kutusunun biçiminde. */
const turkeyDay = (days = 0) => new Date(Date.now() + 3 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

type Student = { id: string; email: string; name: string };

/** Sınıfa katılmış bir öğrenci (hesap ve üyelik doğrudan yazılır). */
async function addStudent(classroomId: string, name: string): Promise<Student> {
  const id = dbId();
  const email = `e2e-ogrenci-${id}@ornek.com`;
  await withDb(async (client) => {
    await client.query(`INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "updatedAt") VALUES ($1, $2, $3, true, now())`, [id, name, email]);
    await client.query(`INSERT INTO "ClassroomMembership" ("classroomId", "userId") VALUES ($1, $2)`, [classroomId, id]);
  });
  return { id, email, name };
}

/** Öğrencinin bitmiş bir senaryo denemesi. Raporun içine sayfada aranacak bir işaret konur. */
async function finishScenario(email: string, status: "COMPLETED" | "HACKED", slug = "sahte-kargo-maili") {
  await withDb((client) =>
    client.query(
      `INSERT INTO "LabAttempt" ("id", "userId", "labId", "labVersion", "status", "reportScore", "startedAt", "endedAt", "resultReport")
       SELECT $1, u.id, l.id, l."publishedVersion", $3::"AttemptStatus", $4, now(), now(), $5::jsonb
       FROM "User" u, "Lab" l WHERE u.email = $2 AND l.slug = $6`,
      [dbId(), email, status, status === "COMPLETED" ? 9 : 2, JSON.stringify({ status: status === "COMPLETED" ? "safe" : "hacked", marker: secretMarker }), slug],
    ),
  );
}
const secretMarker = "e2e-gizli-rapor-isareti";

/** Sınıfın ödevleri (eskiden yeniye). */
async function assignmentsOf(classroomId: string) {
  const result = await withDb((client) =>
    client.query<{ id: string; slug: string; closed: boolean; dueDate: Date | null; labIds: string[] }>(
      `SELECT a.id, n.slug, a.closed, a."dueDate", a."labIds" FROM "Assignment" a JOIN "Neighborhood" n ON n.id = a."neighborhoodId"
       WHERE a."classroomId" = $1 ORDER BY a."createdAt"`,
      [classroomId],
    ),
  );
  return result?.rows ?? [];
}

/** Sınıfa ödev yazar (arayüzden verilemeyen durumlar ve hazırlık için). */
async function addAssignment(classroomId: string, neighborhoodSlug: string, { daysAgo = 0 } = {}) {
  const id = dbId();
  await withDb((client) =>
    client.query(
      `INSERT INTO "Assignment" ("id", "classroomId", "neighborhoodId", "createdAt")
       SELECT $1, $2, n.id, now() - make_interval(days => $4) FROM "Neighborhood" n WHERE n.slug = $3`,
      [id, classroomId, neighborhoodSlug, daysAgo],
    ),
  );
  return id;
}

async function membersOf(classroomId: string) {
  const result = await withDb((client) => client.query<{ userId: string }>(`SELECT "userId" FROM "ClassroomMembership" WHERE "classroomId" = $1`, [classroomId]));
  return (result?.rows ?? []).map((r) => r.userId);
}

async function codeOf(classroomId: string) {
  const result = await withDb((client) => client.query<{ joinCode: string }>(`SELECT "joinCode" FROM "Classroom" WHERE "id" = $1`, [classroomId]));
  return result!.rows[0].joinCode;
}

async function classroomIdOf(code: string) {
  const result = await withDb((client) => client.query<{ id: string }>(`SELECT "id" FROM "Classroom" WHERE "joinCode" = $1`, [code]));
  return result!.rows[0].id;
}

/** Arayüzle öğretmen hesabı: kayıt olur, doğrular, sonra rolü öğretmen yapılır. */
async function signUpTeacher(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  await signUpVerified(page, email);
  await makeTeacher(email);
  return email;
}

/** "Yeni sınıf" penceresiyle sınıf açar; kodu ve kimliği döner. Pencere açık kalır. */
async function createClass(page: Page, name: string, level = "7. sınıf") {
  await page.goto("/siniflarim?yeni=1");
  const dialog = page.getByRole("dialog", { name: "Yeni sınıf" });
  await dialog.getByLabel("Sınıfın adı").fill(name);
  await dialog.getByLabel("Düzey").selectOption({ label: level });
  await dialog.getByRole("button", { name: "Sınıfı oluştur" }).click();
  const codeBox = dialog.getByTestId("new-class-code");
  await expect(codeBox).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
  const code = (await codeBox.textContent())!.trim();
  return { code, id: await classroomIdOf(code), dialog };
}

/** Başka bir öğretmenin sınıfı: öğretmen, sınıf, öğrenci ve açık ödev doğrudan yazılır. */
async function otherTeachersClass() {
  const teacherId = dbId();
  const classroomId = dbId();
  const code = randomCode();
  await withDb(async (client) => {
    await client.query(`INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "role", "updatedAt") VALUES ($1, 'Diğer Öğretmen', $2, true, 'TEACHER', now())`, [
      teacherId,
      `e2e-diger-ogretmen-${teacherId}@ornek.com`,
    ]);
    await client.query(`INSERT INTO "Classroom" ("id", "name", "level", "teacherId", "joinCode") VALUES ($1, 'Başkasının sınıfı', '8', $2, $3)`, [classroomId, teacherId, code]);
  });
  const student = await addStudent(classroomId, "Gizli Öğrenci");
  await addAssignment(classroomId, "oltalama-limani");
  return { id: classroomId, code, student };
}

test("giriş yapmamış ziyaretçi Sınıflarım yerine girişe gönderilir", async ({ page }) => {
  await page.goto("/siniflarim");
  await expect(page).toHaveURL(/\/giris\?sonra=%2Fsiniflarim$/);
});

test.describe("öğretmenin sınıfları", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");

  test("öğretmen olmayan kişi profildeki Öğretmenlik bölümüne gönderilir", async ({ page }) => {
    await signUpVerified(page, uniqueEmail("ogretmen-degil"));
    await page.goto("/siniflarim");
    await expect(page).toHaveURL(/\/profil\?bolum=ogretmenlik$/);
    await page.goto("/siniflarim/herhangi-bir-sinif");
    await expect(page).toHaveURL(/\/profil\?bolum=ogretmenlik$/);
  });

  test("öğretmen sınıf açar, kodu görür, tahtaya yansıtır; katılan öğrenci görünür", async ({ page }) => {
    await signUpTeacher(page, "ogretmen-sinif");
    await page.goto("/siniflarim");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sınıflarım");
    await expect(page.getByText("Henüz sınıfın yok", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Yeni sınıf", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Yeni sınıf" });
    await expect(dialog.getByLabel("Sınıfın adı")).toBeFocused();
    await dialog.getByLabel("Sınıfın adı").fill("7");
    await dialog.getByRole("button", { name: "Sınıfı oluştur" }).click();
    await expect(dialog.getByText("Sınıfa 2-30 karakterlik bir ad ver.")).toBeVisible();
    await expect(dialog.getByLabel("Sınıfın adı")).toHaveAttribute("aria-invalid", "true");

    await dialog.getByLabel("Sınıfın adı").fill("7-D Bilişim");
    await dialog.getByLabel("Düzey").selectOption({ label: "7. sınıf" });
    await dialog.getByRole("button", { name: "Sınıfı oluştur" }).click();
    await expect(dialog.getByRole("status")).toHaveText("7-D Bilişim hazır");
    const codeBox = dialog.getByTestId("new-class-code");
    await expect(codeBox).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
    const code = (await codeBox.textContent())!.trim();
    const classroomId = await classroomIdOf(code);
    await expect(dialog.getByRole("button", { name: "Kodu kopyala" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Bağlantıyı kopyala" })).toBeVisible();

    // Tahtaya yansıt: kod büyük kutularda, QR ve 3 adım. İlk soru sunucunun saatini alır.
    const firstPoll = page.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]);
    await dialog.getByRole("button", { name: "Tahtaya yansıt" }).click();
    const board = page.getByRole("dialog", { name: "Tahtaya yansıt" });
    await expect(board.getByRole("heading", { name: "7-D BİLİŞİM SINIFINA KATIL" })).toBeVisible();
    await expect(board.getByTestId("projection-code")).toHaveAttribute("aria-label", `Sınıf kodu: ${code}`);
    await expect(board.getByTestId("projection-code")).toHaveText(code);
    await expect(board.getByRole("img", { name: "Sınıfa katılma bağlantısının QR kodu" })).toBeVisible();
    await expect(board.getByRole("listitem").filter({ hasText: "Bu kodu yaz" })).toBeVisible();
    await expect(board.getByText("Öğrencilerin katılması bekleniyor…")).toBeVisible();
    await firstPoll;

    // Ekran açıkken katılan öğrencinin adı kısaltılmış olarak düşer.
    await addStudent(classroomId, "Ayşe Yılmaz");
    await expect(board.getByText("Ayşe Y.", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(board.getByText("1 öğrenci katıldı")).toBeVisible();
    await expect(board.getByText("Ayşe Yılmaz")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(board).toBeHidden();
    const card = page.getByRole("article", { name: "7-D Bilişim" });
    await expect(card).toContainText("7. sınıf · 1 öğrenci");
    await expect(card).toContainText("YENİ");
    await expect(card.getByRole("button", { name: `7-D Bilişim sınıfının kodunu kopyala: ${code}` })).toBeVisible();
    // Öğrencisi olan ama ödevi olmayan sınıf dikkat isteyenlerde.
    await expect(page.getByRole("region", { name: "Dikkat isteyenler" })).toContainText("1 öğrenci katıldı, henüz ödev verilmedi");

    await card.getByRole("link", { name: "Sınıfa git" }).click();
    await page.waitForURL(`/siniflarim/${classroomId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("7-D Bilişim");
    await expect(page.getByRole("button", { name: `Sınıf kodunu kopyala: ${code}` })).toBeVisible();
    await expect(page.getByText("Henüz ödev yok", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Öğrenciler" }).click();
    await expect(page).toHaveURL(`/siniflarim/${classroomId}?sekme=ogrenciler`);
    await expect(page.getByRole("tabpanel").getByRole("button", { name: /Ayşe Yılmaz/ })).toBeVisible();

    // Detaydaki "Kodu yansıt" aynı ekranı açar.
    await page.getByRole("button", { name: "Kodu yansıt" }).click();
    await expect(board.getByTestId("projection-code")).toHaveText(code);
    await board.getByRole("button", { name: "Kapat" }).click();
    await expect(board).toBeHidden();
  });

  test("ödev verilir; yeni ödev öncekini kapatır, son tarih kaydedilir, ödev bitirilir", async ({ page }) => {
    await signUpTeacher(page, "ogretmen-odev");
    const { id: classroomId, dialog: created } = await createClass(page, "8-A Ödev");
    await created.getByRole("button", { name: "Sonra paylaşırım" }).click();
    await expect(created).toBeHidden();

    const done = await addStudent(classroomId, "Bora Bitiren");
    await finishTraining(done.email);
    await finishScenario(done.email, "COMPLETED");
    const half = await addStudent(classroomId, "Cem Yarım");
    await finishTraining(half.email);
    await addStudent(classroomId, "Deniz Başlamayan");
    // Önceki açık ödev (labı olmayan bir mahalle; arayüzden verilemez, yalnızca kapanmasını görmek için).
    const previous = await addAssignment(classroomId, "yazilim-ormani", { daysAgo: 3 });

    await page.goto(`/siniflarim/${classroomId}`);
    await page.getByRole("button", { name: "Ödev ver", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "8-A Ödev sınıfına ödev ver" });
    await expect(dialog).toBeVisible();
    // Seçenek kutunun tamamıdır (radyo düğmesi görünmez); kullanıcı gibi mahallenin adına dokunulur.
    await dialog.getByText("Oltalama Limanı", { exact: true }).click();
    await expect(dialog.getByRole("radio", { name: /Oltalama Limanı/ })).toBeChecked();
    await expect(dialog).toContainText("Yazılım Ormanı geçmiş ödevlere taşınır");

    // Geçmiş bir gün kabul edilmez.
    await dialog.getByLabel("Son tarih (isteğe bağlı)").fill(turkeyDay(-1));
    await dialog.getByRole("button", { name: "Oltalama Limanı ödev olarak ver" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Son tarih bugünden önce ya da bir yıldan sonra olamaz.");

    const due = turkeyDay(7);
    await dialog.getByLabel("Son tarih (isteğe bağlı)").fill(due);
    await dialog.getByRole("button", { name: "Oltalama Limanı ödev olarak ver" }).click();
    await expect(toast(page, "Ödev verildi: Oltalama Limanı")).toBeVisible();
    await expect(dialog).toBeHidden();

    // Aynı anda tek açık ödev: önceki kapandı, yenisi günün sonuna (Türkiye saati) kadar.
    const rows = await assignmentsOf(classroomId);
    expect(rows.find((r) => r.id === previous)?.closed).toBe(true);
    const open = rows.filter((r) => !r.closed);
    expect(open).toHaveLength(1);
    expect(open[0].slug).toBe("oltalama-limani");
    expect(open[0].dueDate?.toISOString()).toBe(new Date(`${due}T23:59:59.999+03:00`).toISOString());

    const band = page.getByRole("region", { name: "Oltalama Limanı" });
    await expect(band).toContainText("7 gün kaldı");
    // Sınıf kartı ve ödev bandı yüzde değil kişi sayısı yazar (Murat, 15 Ekim): "1/3".
    await expect(band).toContainText("1/3");
    await expect(band).toContainText("Ödevi bitiren öğrenci");
    const bar = band.getByRole("progressbar", { name: "Ödevin tamamlanması" });
    await expect(bar).toHaveAttribute("aria-valuenow", "1");
    await expect(bar).toHaveAttribute("aria-valuetext", "Ödevi bitiren öğrenci: 1/3");
    await expect(page.getByRole("heading", { name: "1 öğrenci ödeve başlamadı" })).toBeVisible();
    await expect(page.getByText("3 öğrenciden 2 bitirdi")).toBeVisible();
    await expect(page.getByText("Tuzağı fark edenlerin oranı 5 öğrenci bitirince görünür.")).toBeVisible();

    // Öğrenciler: ödevdeki duruma göre süzgeç.
    await page.getByRole("tab", { name: "Öğrenciler" }).click();
    const filters = page.getByRole("group", { name: "Duruma göre" });
    await expect(filters.getByRole("button", { name: "Bitirdi 1" })).toBeVisible();
    await expect(filters.getByRole("button", { name: "Devam ediyor 1" })).toBeVisible();
    await filters.getByRole("button", { name: "Başlamadı 1" }).click();
    const panel = page.getByRole("tabpanel");
    await expect(panel.getByRole("button", { name: /Deniz Başlamayan/ })).toBeVisible();
    await expect(panel.getByRole("button", { name: /Bora Bitiren/ })).toHaveCount(0);
    await filters.getByRole("button", { name: "Tümü 3" }).click();
    await panel.getByRole("searchbox").fill("cem");
    await expect(panel.getByRole("button", { name: /Cem Yarım/ })).toBeVisible();
    await expect(panel.getByRole("button", { name: /Deniz Başlamayan/ })).toHaveCount(0);

    // Konular: açık ödev ve geçmiş ödevler.
    await page.getByRole("tab", { name: "Konular" }).click();
    await expect(page).toHaveURL(`/siniflarim/${classroomId}?sekme=konular`);
    await expect(page.getByRole("tabpanel")).toContainText("Geçmiş ödevler:");
    await expect(page.getByRole("tabpanel")).toContainText("Yazılım Ormanı");

    // Son tarihi değiştir, sonra ödevi bitir.
    await page.getByRole("tabpanel").getByRole("button", { name: "Tarihi değiştir" }).click();
    await expect(dialog.getByRole("radio", { name: /Oltalama Limanı/ })).toBeChecked();
    await expect(dialog.getByLabel("Son tarih (isteğe bağlı)")).toHaveValue(due);
    await dialog.getByLabel("Son tarih (isteğe bağlı)").fill(turkeyDay(10));
    // Odalar: senaryoyu açan eğitim seçiliyken kaldırılamaz; senaryo çıkınca eğitim tek başına kalır.
    const rooms = dialog.getByRole("group", { name: "Odalar" });
    const trainingBox = rooms.getByRole("checkbox", { name: /Oltalama eğitim odası/ });
    await expect(trainingBox).toBeChecked();
    await expect(trainingBox).toBeDisabled();
    await rooms.getByRole("checkbox", { name: /Sahte kargo maili/ }).uncheck();
    await expect(trainingBox).toBeEnabled();
    await expect(rooms).toContainText("1 oda seçili");
    await dialog.getByRole("button", { name: "Ödevi kaydet" }).click();
    await expect(toast(page, "Ödev kaydedildi")).toBeVisible();
    const saved = (await assignmentsOf(classroomId)).filter((r) => !r.closed);
    expect(saved).toHaveLength(1);
    expect(saved[0].labIds).toHaveLength(1);

    await page.getByRole("button", { name: "Ödev ver", exact: true }).first().click();
    await dialog.getByRole("button", { name: "Ödevi bitir" }).click();
    await expect(toast(page, "Ödev bitirildi, geçmiş ödevlere taşındı")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Henüz ödev verilmedi" })).toBeVisible();
    expect((await assignmentsOf(classroomId)).every((r) => r.closed)).toBe(true);
  });

  test("sayfada puan ve rapor yok; tuzağı fark edenlerin oranı 5 öğrenci bitirince görünür; öğrenci çıkarılır", async ({ page, isMobile }) => {
    await signUpTeacher(page, "ogretmen-gizlilik");
    const { id: classroomId } = await createClass(page, "9-B Gizlilik", "9. sınıf");
    await addAssignment(classroomId, "oltalama-limani");
    const results = ["COMPLETED", "COMPLETED", "HACKED", "HACKED", "COMPLETED"] as const;
    const students: Student[] = [];
    for (const [i, name] of ["Ali Kaya", "Berk Su", "Can Ak", "Ece Tan", "Fatma Er", "Zeynep Kaya"].entries()) {
      students.push(await addStudent(classroomId, name));
      if (i < 4) {
        await finishTraining(students[i].email);
        await finishScenario(students[i].email, results[i]);
      }
    }

    // 4 öğrenci bitirdi: oran henüz görünmez.
    const path = `/siniflarim/${classroomId}`;
    await page.goto(path);
    await expect(page.getByText("Tuzağı fark edenlerin oranı 5 öğrenci bitirince görünür.")).toBeVisible();
    await expect(page.getByText(/Tuzağı fark eden:/)).toHaveCount(0);

    // Ham yanıtta (HTML ve RSC verisi) puan, rapor ve hacklendi bilgisi yok.
    for (const tab of ["", "?sekme=ogrenciler", "?sekme=konular"]) {
      const html = await (await page.request.get(path + tab)).text();
      expect(html).toContain("9-B Gizlilik");
      for (const secret of [secretMarker, "reportScore", "resultReport", "firstSafe", "HACKED", "hacked"]) {
        expect(html, `${tab || "genel"}: ${secret}`).not.toContain(secret);
      }
    }

    // Beşinci öğrenci de bitirince sınıfın toplam oranı çıkar: 5 bitirenden 3'ü tuzağı fark etti.
    await finishTraining(students[4].email);
    await finishScenario(students[4].email, results[4]);
    await page.reload();
    await expect(page.getByText("Tuzağı fark eden: ilk seferde %60 · tekrar sonrası %60")).toBeVisible();

    // Hacklenen öğrenci de yalnızca "Bitirdi" görünür.
    await page.getByRole("tab", { name: "Öğrenciler" }).click();
    await page.getByRole("tabpanel").getByRole("button", { name: /Can Ak/ }).click();
    const drawer = page.getByRole("dialog", { name: "Öğrenci" });
    await expect(drawer.getByRole("heading", { level: 2 })).toHaveText("Can Ak");
    await expect(drawer.getByRole("listitem").filter({ hasText: "Sahte kargo maili" })).toContainText("Bitirdi");
    await expect(drawer).not.toContainText(/hack/i);
    if (isMobile) await drawer.getByRole("button", { name: "9-B Gizlilik" }).click();
    else await drawer.getByRole("button", { name: "Kapat" }).click();
    await expect(drawer).toBeHidden();

    // Öğrenciyi çıkar: yalnızca üyelik silinir.
    const zeynep = students[5];
    await page.getByRole("tabpanel").getByRole("button", { name: /Zeynep Kaya/ }).click();
    await drawer.getByRole("button", { name: "Sınıftan çıkar" }).click();
    const confirm = drawer.getByRole("alertdialog", { name: "Zeynep Kaya, 9-B Gizlilik sınıfından çıkarılsın mı?" });
    await confirm.getByRole("button", { name: "Vazgeç" }).click();
    await expect(confirm).toHaveCount(0);
    await drawer.getByRole("button", { name: "Sınıftan çıkar" }).click();
    await confirm.getByRole("button", { name: "Evet, çıkar" }).click();
    await expect(toast(page, "Zeynep Kaya sınıftan çıkarıldı")).toBeVisible();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole("tabpanel").getByRole("button", { name: /Zeynep Kaya/ })).toHaveCount(0);
    expect(await membersOf(classroomId)).not.toContain(zeynep.id);
    expect(await membersOf(classroomId)).toHaveLength(5);
    const account = await withDb((client) => client.query(`SELECT 1 FROM "User" WHERE "id" = $1`, [zeynep.id]));
    expect(account?.rowCount).toBe(1);
  });

  test("sınıf kodu yenilenir: eski kod ve bağlantısı çalışmaz, öğrenciler sınıfta kalır, yeni kodla katılınır", async ({ page, browser, baseURL }) => {
    await signUpTeacher(page, "ogretmen-kod");
    const { id: classroomId, code: oldCode, dialog } = await createClass(page, "8-C Kod", "8. sınıf");
    await dialog.getByRole("button", { name: "Sonra paylaşırım" }).click();
    const member = await addStudent(classroomId, "Eski Üye");

    await page.goto(`/siniflarim/${classroomId}`);
    const confirm = page.getByRole("dialog", { name: "Sınıf kodu yenilensin mi?" });
    await page.getByRole("button", { name: "Kodu yenile" }).click();
    await expect(confirm).toContainText(`${oldCode} kodu ve onunla paylaştığın bağlantı ya da QR hemen çalışmaz olur.`);
    await confirm.getByRole("button", { name: "Vazgeç" }).click();
    await expect(confirm).toBeHidden();
    expect(await codeOf(classroomId)).toBe(oldCode);

    await page.getByRole("button", { name: "Kodu yenile" }).click();
    await confirm.getByRole("button", { name: "Kodu yenile" }).click();
    await expect(confirm).toBeHidden();
    const newCode = await codeOf(classroomId);
    expect(newCode).not.toBe(oldCode);
    expect(newCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    await expect(toast(page, `Yeni kod: ${newCode}. Eski kod artık çalışmıyor.`)).toBeVisible();
    await expect(page.getByRole("button", { name: `Sınıf kodunu kopyala: ${newCode}` })).toBeVisible();
    // Tahtadaki kod ve QR da yenisi.
    await page.getByRole("button", { name: "Kodu yansıt" }).click();
    await expect(page.getByRole("img", { name: `Sınıf kodu: ${newCode}` })).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await membersOf(classroomId)).toEqual([member.id]);

    // Öğrenci: eski kodun bağlantısı "bulunamadı" der, yeni kodla katılır.
    const studentContext = await browser.newContext({ baseURL, locale: "tr-TR" });
    const student = await studentContext.newPage();
    await signUpVerified(student, uniqueEmail("yeni-kod"));
    await student.goto(`/katil/${oldCode}`);
    await student.getByRole("main").getByRole("button", { name: "Katıl", exact: true }).click();
    await expect(student.getByRole("main").getByRole("alert")).toHaveText("Bu kodla bir sınıf bulunamadı. Kodu öğretmeninden kontrol et.");
    await student.goto(`/katil/${newCode}`);
    await student.getByRole("main").getByRole("button", { name: "Katıl", exact: true }).click();
    await expect(student.getByRole("main").getByRole("status")).toContainText("8-C Kod sınıfına katıldın");
    await studentContext.close();
    expect(await membersOf(classroomId)).toHaveLength(2);
    expect(await membersOf(classroomId)).toContain(member.id);
  });

  test("başka öğretmenin sınıfı görünmez; eylemleri o sınıfa uygulanamaz", async ({ page }) => {
    const victim = await otherTeachersClass();
    await signUpTeacher(page, "ogretmen-yabanci");
    const { id: ownId, dialog } = await createClass(page, "Kendi Sınıfım");
    await dialog.getByRole("button", { name: "Sonra paylaşırım" }).click();
    const own = await addStudent(ownId, "Kendi Öğrencim");
    await addAssignment(ownId, "oltalama-limani");

    // Sınıflarım'da yok, adresi bilinse de "Bu sayfa yok".
    await page.goto("/siniflarim");
    await expect(page.getByRole("article", { name: "Kendi Sınıfım" })).toBeVisible();
    await expect(page.getByText("Başkasının sınıfı")).toHaveCount(0);
    await page.goto(`/siniflarim/${victim.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
    await expect(page.getByText("Gizli Öğrenci")).toHaveCount(0);

    // Kendi sınıfının sayfasından gönderilen eylemlerde sınıf ve öğrenci kimliği başkasınınkiyle
    // değiştirilir (elle hazırlanmış istek gibi). Sunucu sahibi yeniden denetler.
    const answers: string[] = [];
    await page.route(/\/siniflarim\//, async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !request.headers()["next-action"]) return route.fallback();
      const body = (request.postData() ?? "").replaceAll(ownId, victim.id).replaceAll(own.id, victim.student.id);
      const response = await route.fetch({ postData: body });
      answers.push(await response.text());
      await route.fulfill({ response });
    });
    await page.goto(`/siniflarim/${ownId}?sekme=ogrenciler`);
    const notFound = "Bu sınıf bulunamadı. Sayfayı yenileyip yeniden dene.";

    await page.getByRole("tabpanel").getByRole("button", { name: /Kendi Öğrencim/ }).click();
    const drawer = page.getByRole("dialog", { name: "Öğrenci" });
    await drawer.getByRole("button", { name: "Sınıftan çıkar" }).click();
    await drawer.getByRole("button", { name: "Evet, çıkar" }).click();
    await expect(drawer.getByRole("alert")).toHaveText(notFound);
    expect(answers).toHaveLength(1);
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    await page.getByRole("button", { name: "Ödev ver", exact: true }).first().click();
    const homework = page.getByRole("dialog", { name: "Kendi Sınıfım sınıfına ödev ver" });
    await homework.getByLabel("Son tarih (isteğe bağlı)").fill(turkeyDay(5));
    await homework.getByRole("button", { name: "Ödevi kaydet" }).click();
    await expect(homework.getByRole("alert")).toHaveText(notFound);
    expect(answers).toHaveLength(2);
    await homework.getByRole("button", { name: "Ödevi bitir" }).click();
    await expect.poll(() => answers.length).toBe(3);
    await expect(homework.getByRole("alert")).toHaveText(notFound);
    await page.keyboard.press("Escape");

    // Tahtaya yansıt: başkasının sınıfına katılanların adları da gelmez.
    await page.getByRole("button", { name: "Kodu yansıt" }).click();
    await expect.poll(() => answers.length).toBeGreaterThanOrEqual(4);
    await page.keyboard.press("Escape");

    // Kodu yenile: başkasının sınıfının kodu değişmez.
    const beforeRenew = answers.length;
    await page.getByRole("button", { name: "Kodu yenile" }).click();
    const renew = page.getByRole("dialog", { name: "Sınıf kodu yenilensin mi?" });
    await renew.getByRole("button", { name: "Kodu yenile" }).click();
    await expect(renew.getByRole("alert")).toHaveText(notFound);
    expect(answers.length).toBeGreaterThan(beforeRenew);
    await page.keyboard.press("Escape");
    // Her cevap "bulunamadı": çıkar, son tarih, bitir, tahtadaki katılanlar ve kodu yenile.
    for (const answer of answers) expect(answer).toContain("notFound");
    expect(await codeOf(victim.id)).toBe(victim.code);

    // Başkasının sınıfında hiçbir şey değişmedi; kendi sınıfı da olduğu gibi.
    expect(await membersOf(victim.id)).toEqual([victim.student.id]);
    const victimRows = await assignmentsOf(victim.id);
    expect(victimRows).toHaveLength(1);
    expect(victimRows[0]).toMatchObject({ closed: false, dueDate: null });
    expect(await membersOf(ownId)).toEqual([own.id]);
    expect((await assignmentsOf(ownId)).filter((r) => !r.closed)).toHaveLength(1);
  });
});
