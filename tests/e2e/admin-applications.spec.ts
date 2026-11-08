import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { isLive, signIn, signOutHere, signUpVerified, strongPassword, uniqueEmail } from "./support/account";
import { makeAdmin } from "./support/admin";
import { withDb } from "./support/db";
import { mailOutboxDir } from "./support/outbox-dir";
import { createSchool, userIdOf } from "./support/teacher";

// Yönetim · Öğretmen talepleri (Tur 4, Talepler-Son ve Talepler-Son-YeniOkul): Faz 5'in bitti
// ölçütü "Yönetici bir talebi onaylayınca kullanıcı öğretmen oluyor ve mail alıyor". Onay için en
// az 2 kontrol (sunucu da ister), 5 saniyelik "Geri al", ret notu, "Bilgi iste" ve CEVAP GELDİ,
// "Yeni okul" eşleme ve ekleme, belgenin yalnızca talepleri inceleyene gösterilmesi.
// Başvuranlar ve talepler veritabanına doğrudan yazılır; veritabanı başka koşularla ortak
// olduğu için sayılar değil, testin kendi talepleri denetlenir.

// Geri al süresi 30 saniye, karar maili ondan 5 saniye sonra gider (lib/teacher/decision-rules.ts).
const undoWindowMs = 30_000;
const finalizeDelayMs = undoWindowMs + 5_000;

const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });
const detail = (page: Page, name: string) => page.getByRole("region", { name: `Talep: ${name}` });

const stamp = () => randomUUID().replace(/-/g, "").slice(0, 8);
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;

// 1x1 PNG ve tek sayfalık küçük bir PDF.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

type Mail = { to: string; subject: string; text: string; sentAt: string };

/** Adrese giden mailler (yarım yazılmış dosya atlanır). */
async function mailsTo(email: string): Promise<Mail[]> {
  const files = await readdir(mailOutboxDir).catch(() => [] as string[]);
  const mails = await Promise.all(
    files.map(async (f) => {
      try {
        return JSON.parse(await readFile(path.join(mailOutboxDir, f), "utf8")) as Mail;
      } catch {
        return null;
      }
    }),
  );
  return mails.filter((m): m is Mail => m?.to === email);
}

async function query<T extends object>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await withDb(async (client) => (await client.query<T>(sql, params)).rows)) ?? [];
}

/** Doğrulanmış öğrenci hesabı (giriş yapmaz). */
async function insertUser(name: string, birthYear: number | null = null) {
  const id = newId();
  const email = uniqueEmail("basvuran");
  await query(`INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "birthYear", "updatedAt") VALUES ($1, $2, $3, true, $4, now())`, [
    id,
    name,
    email,
    birthYear,
  ]);
  return { id, email, name };
}

type Place = { province: string; district: string };
type NewApplication = {
  school?: { id: string } & Place;
  newSchool?: { name: string } & Place;
  email?: string;
  document?: { name: string; mimeType: string; data: Buffer };
  subject?: string;
};

/** Bekleyen öğretmenlik talebi: listedeki okuldan ya da "Yeni okul". */
async function insertApplication(userId: string, app: NewApplication) {
  const id = newId();
  const place = app.school ?? app.newSchool!;
  await query(
    `INSERT INTO "TeacherApplication"
       ("id", "userId", "schoolId", "newSchoolName", "province", "district", "subject", "institutionalEmail", "documentName", "documentSize")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      userId,
      app.school?.id ?? null,
      app.newSchool?.name ?? null,
      place.province,
      place.district,
      app.subject ?? "Bilişim Teknolojileri",
      app.email ?? null,
      app.document?.name ?? null,
      app.document?.data.length ?? null,
    ],
  );
  if (app.document) {
    await query(`INSERT INTO "ApplicationDocument" ("applicationId", "mimeType", "data") VALUES ($1, $2, $3)`, [id, app.document.mimeType, app.document.data]);
  }
  return id;
}

async function applicationOf(id: string) {
  const [row] = await query<{
    status: string;
    schoolId: string | null;
    decidedById: string | null;
    decidedAt: Date | null;
    rejectionNote: string | null;
    question: string | null;
    checks: Record<string, boolean>;
  }>(
    // Prisma saati UTC olarak saat dilimsiz yazar; pg yerel saat sanmasın.
    `SELECT "status", "schoolId", "decidedById", "decidedAt" AT TIME ZONE 'UTC' AS "decidedAt", "rejectionNote", "question", "checks"
       FROM "TeacherApplication" WHERE "id" = $1`,
    [id],
  );
  return row;
}

async function userOf(id: string) {
  const [row] = await query<{ role: string; schoolId: string | null }>(`SELECT "role", "schoolId" FROM "User" WHERE "id" = $1`, [id]);
  return row;
}

async function hasDocument(applicationId: string) {
  return (await query(`SELECT 1 FROM "ApplicationDocument" WHERE "applicationId" = $1`, [applicationId])).length === 1;
}

/** Talebin kayıt defteri girişleri, eskiden yeniye. */
async function auditOf(applicationId: string) {
  return query<{ action: string; actorId: string; details: Record<string, unknown> | null }>(
    `SELECT "action", "actorId", "details" FROM "AuditLog" WHERE "target" = $1 ORDER BY "createdAt", "id"`,
    [`application:${applicationId}`],
  );
}

/** Kayıt olur, e-postayı doğrular ve hesabı yönetici yapar. */
async function signUpAdmin(page: Page) {
  const email = uniqueEmail("talep-yonetici");
  await signUpVerified(page, email);
  await makeAdmin(email);
  return { email, id: (await userIdOf(email))! };
}

const openApplication = async (page: Page, id: string, name: string) => {
  await page.goto(`/yonetim/talepler?talep=${id}`);
  await expect(detail(page, name).getByRole("heading", { name, level: 2 })).toBeVisible();
  return detail(page, name);
};

/**
 * Belge adresine doğrudan istek (sayfanın oturumuyla). Sunucunun boşta kapattığı bir bağlantı
 * yeniden kullanılırsa (ECONNRESET) istek yinelenir; GET'in yan etkisi yalnızca kayıt defteridir,
 * o da 60 saniyede bir yazılır.
 */
function getDocument(page: Page, url: string, options: Parameters<Page["request"]["get"]>[1] = {}) {
  return page.request.get(url, { maxRetries: 2, ...options });
}

/**
 * Sunucu eylemi isteğini (Next-Action) yolda değiştirir: arayüzün engelini atlayan bir istemci
 * gibi. Yalnızca ilk eşleşen istek değişir.
 */
async function rewriteNextAction(page: Page, rewrite: (body: string) => string) {
  let done = false;
  const handler = async (route: Route) => {
    const request = route.request();
    const body = request.postData();
    if (!done && request.method() === "POST" && request.headers()["next-action"] && body) {
      done = true;
      return route.continue({ postData: rewrite(body) });
    }
    return route.continue();
  };
  await page.route(/\/yonetim\/talepler/, handler);
  return () => page.unroute(/\/yonetim\/talepler/, handler);
}

test("giriş yapmamış ziyaretçi talepler yerine girişe gönderilir, belge adresi dosya vermez", async ({ page }) => {
  await page.goto("/yonetim/talepler");
  await expect(page).toHaveURL(/\/giris\?sonra=%2Fyonetim%2Ftalepler$/);

  const response = await getDocument(page, "/yonetim/talepler/e2e-yok/belge", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toMatch(/\/giris\?sonra=/);
});

test.describe("Yönetim · Öğretmen talepleri", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");
  // Her test bir ya da iki hesap açar (kod maili ile); yoğun makinede 30 saniye yetmeyebilir.
  test.describe.configure({ timeout: 90_000 });


  test("talepler izni olmayan ekip üyesi, öğrenci ve sahte oturum: sayfa yok, belge 404", async ({ page }) => {
    const applicant = await insertUser(`Belge Gizli ${stamp()}`);
    const school = await createSchool({ creatorEmail: applicant.email });
    const applicationId = await insertApplication(applicant.id, { school, document: { name: "gorev-belgesi.pdf", mimeType: "application/pdf", data: pdf } });
    const documentUrl = `/yonetim/talepler/${applicationId}/belge`;

    // Oturum çerezi var ama geçersiz: kapıdan geçer, belge yine yok.
    const forged = await getDocument(page, documentUrl, { headers: { cookie: "better-auth.session_token=sahte.imza" }, maxRedirects: 0 });
    expect(forged.status()).toBe(404);
    expect(await forged.body()).toHaveLength(0);

    const email = uniqueEmail("ekip-ipucu");
    await signUpVerified(page, email);
    const id = await userIdOf(email);
    // Yalnızca Günün ipucu izni: panele girer, talepleri göremez.
    await query(`INSERT INTO "TeamPermission" ("userId", "permission", "grantedById") VALUES ($1, 'TIPS', $1)`, [id]);
    await page.goto("/yonetim/talepler");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
    await expect(page.getByText(applicant.name)).toHaveCount(0);
    const asTeam = await getDocument(page, documentUrl);
    expect(asTeam.status()).toBe(404);
    expect(await asTeam.body()).toHaveLength(0);

    // İzni alınınca düz öğrenci: panel de yok.
    await query(`DELETE FROM "TeamPermission" WHERE "userId" = $1`, [id]);
    await page.goto("/yonetim/talepler");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
    expect((await getDocument(page, documentUrl)).status()).toBe(404);

    expect((await auditOf(applicationId)).map((a) => a.action)).not.toContain("application.document_viewed");
    expect(await hasDocument(applicationId)).toBe(true);
  });

  test("onay en az 2 kontrol ister (sunucu da); kullanıcı öğretmen olur, mail geri al süresinden sonra gelir, belge silinir", async ({ page }) => {
    test.setTimeout(180_000);
    const admin = await signUpAdmin(page);
    const school = await createSchool({ creatorEmail: admin.email });
    const applicant = await insertUser(`Selin Onay ${stamp()}`);
    const applicationId = await insertApplication(applicant.id, {
      school,
      email: "s.yildiz@bahcelievlerortaokulu.k12.tr",
      document: { name: "gorev-yeri-belgesi.pdf", mimeType: "application/pdf", data: pdf },
    });

    const box = await openApplication(page, applicationId, applicant.name);
    await expect(box).toContainText(school.name);
    await expect(box).toContainText("s.yildiz@bahcelievlerortaokulu.k12.tr");
    await expect(box).toContainText("gorev-yeri-belgesi.pdf");
    // E-posta, belge, okul listede: 3 sinyal, Güçlü.
    await expect(box.getByText("Bilgi: Güçlü")).toBeVisible();
    // Başvuranın hesap e-postası sayfada yok.
    expect(await page.content()).not.toContain(applicant.email);

    const approve = box.getByRole("button", { name: "Onayla", exact: true });
    await box.getByRole("checkbox", { name: /^Okul gerçek bir okul/ }).click();
    await expect(box.getByRole("checkbox", { name: /^Okul gerçek bir okul/ })).toBeChecked();
    await expect(box.getByText("Onaylamak için en az 2 kontrolü işaretle. Reddetmek için gerekmez.")).toBeVisible();
    // Tek kontrolle düğme kullanılamaz görünür (aria-disabled); basılırsa yalnızca uyarı sallanır.
    await expect(approve).toHaveAttribute("aria-disabled", "true");
    await approve.click({ force: true });
    await expect(box.getByText("1/4 kontrol")).toBeVisible();
    await expect(box.getByText("Onaylamak için en az 2 kontrolü işaretle. Reddetmek için gerekmez.")).toBeVisible();
    expect((await applicationOf(applicationId)).status).toBe("PENDING");

    // Arayüz atlanıp tek kontrolle istek gönderilirse sunucu reddeder.
    await box.getByRole("checkbox", { name: /^Branş ve okul türü/ }).click();
    await expect(box.getByText("Yeterli kontrol yapıldı, onaylayabilirsin.")).toBeVisible();
    const restore = await rewriteNextAction(page, (body) => {
      expect(body).toContain('"checks":["schoolReal","subjectFits"]');
      return body.replace('"checks":["schoolReal","subjectFits"]', '"checks":["schoolReal"]');
    });
    await approve.click();
    await expect(toast(page, "Onaylamak için en az 2 kontrolü işaretle.")).toBeVisible();
    await restore();
    expect(await applicationOf(applicationId)).toMatchObject({ status: "PENDING", decidedById: null });
    expect(await userOf(applicant.id)).toEqual({ role: "STUDENT", schoolId: null });

    await approve.click();
    await expect(toast(page, `${applicant.name} öğretmen oldu. E-postası birazdan gider.`)).toBeVisible();
    expect(await userOf(applicant.id)).toEqual({ role: "TEACHER", schoolId: school.id });
    const decided = await applicationOf(applicationId);
    expect(decided).toMatchObject({ status: "APPROVED", decidedById: admin.id, schoolId: school.id });
    expect(decided.checks).toEqual({ schoolReal: true, emailDomain: false, documentReadable: false, subjectFits: true });
    const audit = await auditOf(applicationId);
    expect(audit.map((a) => a.action)).toEqual(["application.approved"]);
    expect(audit[0]).toMatchObject({ actorId: admin.id });
    expect(audit[0].details).toMatchObject({ userId: applicant.id, schoolId: school.id, previousRole: "STUDENT", role: "TEACHER" });

    // Geri al süresi bitmeden mail gitmez, belge durur.
    expect(await mailsTo(applicant.email)).toHaveLength(0);
    expect(await hasDocument(applicationId)).toBe(true);
    await expect
      .poll(async () => (await mailsTo(applicant.email)).length, { timeout: finalizeDelayMs + 45_000, intervals: [2_000] })
      .toBe(1);
    const [mail] = await mailsTo(applicant.email);
    expect(mail.subject).toMatch(/öğretmen hesabın açıldı$/);
    expect(mail.text).toContain(`${school.name} öğretmeni olarak`);
    expect(new Date(mail.sentAt).getTime() - decided.decidedAt!.getTime()).toBeGreaterThanOrEqual(undoWindowMs);
    expect(await hasDocument(applicationId)).toBe(false);
    expect((await auditOf(applicationId)).map((a) => a.action)).toEqual(["application.approved", "application.mail_sent"]);

    // Onaylanan sekmesinde: onay kutusu, belge silindi, karar düğmesi yok.
    const after = await openApplication(page, applicationId, applicant.name);
    await expect(page.getByRole("tab", { name: /^Onaylanan/ })).toHaveAttribute("aria-selected", "true");
    await expect(after.getByText("Onaylandı.")).toBeVisible();
    await expect(after.getByText("Belge silindi")).toBeVisible();
    await expect(after.getByRole("button", { name: "Belgeyi gör" })).toHaveCount(0);
    await expect(after.getByRole("button", { name: "Onayla", exact: true })).toHaveCount(0);
    expect((await getDocument(page, `/yonetim/talepler/${applicationId}/belge`)).status()).toBe(404);
  });

  test("geri al: onay geri alınır, rol ve talep eski haline döner, mail gitmez", async ({ page }) => {
    test.setTimeout(150_000);
    const admin = await signUpAdmin(page);
    const school = await createSchool({ creatorEmail: admin.email });
    const applicant = await insertUser(`Deniz Geri ${stamp()}`);
    const applicationId = await insertApplication(applicant.id, { school, document: { name: "belge.png", mimeType: "image/png", data: png } });

    const box = await openApplication(page, applicationId, applicant.name);
    await box.getByRole("checkbox", { name: /^Okul gerçek bir okul/ }).click();
    await box.getByRole("checkbox", { name: /^Belge okunaklı/ }).click();
    await box.getByRole("button", { name: "Onayla", exact: true }).click();
    const approved = toast(page, `${applicant.name} öğretmen oldu.`);
    await expect(approved).toBeVisible();
    const approvedAt = Date.now();
    expect((await userOf(applicant.id)).role).toBe("TEACHER");

    await approved.getByRole("button", { name: "Geri al" }).click();
    await expect(toast(page, "Geri alındı. Talep yeniden bekliyor.")).toBeVisible();
    // Talep Bekleyen'de yeniden açılır.
    await expect(detail(page, applicant.name).getByRole("button", { name: "Onayla", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Bekleyen/ })).toHaveAttribute("aria-selected", "true");

    expect(await userOf(applicant.id)).toEqual({ role: "STUDENT", schoolId: null });
    expect(await applicationOf(applicationId)).toMatchObject({ status: "PENDING", decidedById: null, decidedAt: null });
    const audit = await auditOf(applicationId);
    expect(audit.map((a) => a.action)).toEqual(["application.approved", "application.undone"]);
    expect(audit.every((a) => a.actorId === admin.id)).toBe(true);

    // Kesinleşme zamanı geçer: mail gitmez, belge silinmez.
    await page.waitForTimeout(Math.max(0, approvedAt + finalizeDelayMs + 8_000 - Date.now()));
    expect(await mailsTo(applicant.email)).toHaveLength(0);
    expect(await hasDocument(applicationId)).toBe(true);
    expect((await auditOf(applicationId)).map((a) => a.action)).not.toContain("application.mail_sent");
  });

  test("ret en az 10 karakterlik not ister; not başvuranın profilindeki Öğretmenlik bölümünde görünür", async ({ page, context }) => {
    // Başvuran kendi hesabıyla (sonunda profiline bakılacak).
    const applicantEmail = uniqueEmail("ret-basvuran");
    await signUpVerified(page, applicantEmail);
    const applicantId = (await userIdOf(applicantEmail))!;
    const name = "Deneme Öğrenci";
    await signOutHere(context);

    const admin = await signUpAdmin(page);
    const school = await createSchool({ creatorEmail: admin.email });
    const applicationId = await insertApplication(applicantId, { school });

    const box = await openApplication(page, applicationId, name);
    await box.getByRole("button", { name: "Reddet" }).click();
    const dialog = page.getByRole("dialog", { name: `${name} talebini reddet` });
    await dialog.getByLabel("Kullanıcıya giden not").fill("Eksik.");
    await dialog.getByRole("button", { name: "Reddet ve notu gönder" }).click();
    await expect(dialog.getByText("Kısa da olsa bir açıklama yaz (en az 10 karakter).")).toBeVisible();
    expect((await applicationOf(applicationId)).status).toBe("PENDING");

    await dialog.getByRole("radio", { name: "Okul doğrulanamadı" }).click();
    const note = "Okul bilgisi doğrulanamadı. Okulunun tam adını ve ilçesini yazıp kurumsal e-postanı ya da bir belge eklersen yeniden bakarız.";
    await expect(dialog.getByLabel("Kullanıcıya giden not")).toHaveValue(note);
    await dialog.getByRole("button", { name: "Reddet ve notu gönder" }).click();
    await expect(toast(page, `${name} reddedildi, not kullanıcıya iletildi.`)).toBeVisible();
    expect(await applicationOf(applicationId)).toMatchObject({ status: "REJECTED", rejectionNote: note, decidedById: admin.id });
    expect((await auditOf(applicationId)).map((a) => a.action)).toEqual(["application.rejected"]);

    // Reddedilen sekmesinde not görünür.
    const after = await openApplication(page, applicationId, name);
    await expect(page.getByRole("tab", { name: /^Reddedilen/ })).toHaveAttribute("aria-selected", "true");
    await expect(after.getByText("Reddedildi · kullanıcıya giden not")).toBeVisible();
    await expect(after.getByText(note)).toBeVisible();

    // Başvuran profilinde yöneticinin notunu görür.
    await signOutHere(context);
    await page.goto("/giris");
    await signIn(page, applicantEmail, strongPassword);
    await page.waitForURL((url) => !url.pathname.startsWith("/giris"));
    await page.goto("/profil?bolum=ogretmenlik");
    const section = page.getByRole("region", { name: "Öğretmen misin?" });
    await expect(section.getByText("Talebin bu sefer onaylanmadı")).toBeVisible();
    await expect(section.getByText("Yöneticinin notu:")).toBeVisible();
    await expect(section.getByText(note)).toBeVisible();
  });

  test("bilgi iste: talep Bilgi istendi'ye geçer; cevap gelince CEVAP GELDİ ile Bekleyen'e döner", async ({ page }) => {
    const admin = await signUpAdmin(page);
    const school = await createSchool({ creatorEmail: admin.email });
    const applicant = await insertUser(`Hakan Bilgi ${stamp()}`);
    const applicationId = await insertApplication(applicant.id, { school, subject: "Fizik" });

    const box = await openApplication(page, applicationId, applicant.name);
    // Yalnızca okul listede: 1 sinyal, Zayıf.
    await expect(box.getByText("Bilgi: Zayıf")).toBeVisible();
    await box.getByRole("checkbox", { name: /^Okul gerçek bir okul/ }).click();
    await box.getByRole("button", { name: "Bilgi iste" }).click();
    const dialog = page.getByRole("dialog", { name: `${applicant.name} için bilgi iste` });
    await dialog.getByRole("radio", { name: "Kurumsal e-posta" }).click();
    const question = "Okulunun verdiği kurumsal e-posta adresini ekler misin? Okulunu doğrulamamıza yardımcı olur.";
    await expect(dialog.getByLabel("Öğretmene giden soru")).toHaveValue(question);
    await dialog.getByRole("button", { name: "Soruyu gönder" }).click();
    await expect(toast(page, `Soru gitti: ${applicant.name}. Cevap gelince talep Bekleyen'e döner.`)).toBeVisible();
    const asked = await applicationOf(applicationId);
    expect(asked).toMatchObject({ status: "INFO_REQUESTED", question });
    // İşaretlenen kontrol kalır.
    expect(asked.checks).toMatchObject({ schoolReal: true });
    expect((await auditOf(applicationId)).map((a) => [a.action, a.actorId])).toEqual([["application.info_requested", admin.id]]);

    // Bilgi istendi sekmesinde bekler.
    await page.getByRole("tab", { name: /^Bilgi istendi/ }).click();
    await expect(page.getByRole("tab", { name: /^Bilgi istendi/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("link", { name: new RegExp(applicant.name) }).click();
    const waiting = detail(page, applicant.name);
    await expect(waiting.getByText(question)).toBeVisible();
    await expect(waiting.getByText(/^Cevap bekleniyor\./)).toBeVisible();
    await expect(waiting.getByRole("button", { name: "Bilgi iste" })).toBeDisabled();
    await expect(waiting.getByRole("checkbox", { name: /^Okul gerçek bir okul/ })).toBeChecked();

    // Öğretmen profilinden cevaplar (profil formu Faz 4 testlerinde sınanır).
    const answer = "Okulumuzun kurumsal e-postası yok. Bunun yerine atama belgemi ekleyebilirim.";
    await query(`UPDATE "TeacherApplication" SET "status" = 'PENDING', "answer" = $2, "answeredAt" = now() WHERE "id" = $1`, [applicationId, answer]);

    await page.goto("/yonetim/talepler?sekme=bekleyen");
    const row = page.getByRole("link", { name: new RegExp(applicant.name) });
    await expect(row).toContainText("CEVAP GELDİ");
    await row.click();
    const answered = detail(page, applicant.name);
    await expect(answered.getByText(question)).toBeVisible();
    await expect(answered.getByText(answer)).toBeVisible();
    await expect(answered.getByText(/^CEVAP · /)).toBeVisible();
    await expect(answered.getByRole("button", { name: "Bilgi iste" })).toBeEnabled();
  });

  test("18 yaşından küçük görünen başvuran: listede 18 YAŞ ALTI, ayrıntıda doğum yılıyla uyarı; talep engellenmez", async ({ page }) => {
    const admin = await signUpAdmin(page);
    const school = await createSchool({ creatorEmail: admin.email });
    const year = new Date().getFullYear();
    const minor = await insertUser(`Deniz Genç ${stamp()}`, year - 16);
    // Bu yıl 18'ini dolduran da uyarı alır: doğum günü henüz gelmemiş olabilir.
    const edge = await insertUser(`Sinan Sınır ${stamp()}`, year - 18);
    const adult = await insertUser(`Okan Yetişkin ${stamp()}`, year - 19);
    const minorId = await insertApplication(minor.id, { school });
    await insertApplication(edge.id, { school });
    await insertApplication(adult.id, { school });

    await page.goto("/yonetim/talepler?sekme=bekleyen");
    await expect(page.getByRole("link", { name: new RegExp(minor.name) })).toContainText("18 YAŞ ALTI");
    await expect(page.getByRole("link", { name: new RegExp(edge.name) })).toContainText("18 YAŞ ALTI");
    await expect(page.getByRole("link", { name: new RegExp(adult.name) })).not.toContainText("18 YAŞ ALTI");

    const box = await openApplication(page, minorId, minor.name);
    await expect(box.getByText(`Kayıttaki doğum yılı ${year - 16}: 18 yaşından küçük olabilir.`, { exact: false })).toBeVisible();
    await expect(box.getByRole("button", { name: "Bilgi iste" })).toBeEnabled();
  });

  test("yeni okul: 'Bu okul mu?' ile listedeki okula eşlenir (geri alınır); düzeltilen adla onaylanınca okul eklenir", async ({ page }) => {
    const admin = await signUpAdmin(page);
    const place = { province: "Ardahan", district: "Posof" };
    const tag = stamp();

    // 1. Listede benzeri olan yeni okul: "kuzgun… orta okulu" = "Kuzgun… Ortaokulu".
    const listed = await createSchool({ creatorEmail: admin.email, name: `Kuzgun${tag} Ortaokulu`, ...place });
    const first = await insertUser(`Mehmet Eşle ${tag}`);
    const firstId = await insertApplication(first.id, { newSchool: { name: `kuzgun${tag} orta okulu`, ...place }, email: "m.kurt@okul.k12.tr" });

    const box = await openApplication(page, firstId, first.name);
    await expect(box.getByText("Bu okul listede yok")).toBeVisible();
    await expect(box.getByText("YENİ OKUL")).toBeVisible();
    await expect(box.getByText("Bu ilçede benzer bir okul listede var. Aynı okulsa eşle:")).toBeVisible();
    const match = box.getByRole("button", { name: `Bu okulla eşle: ${listed.name}` });
    await match.click();
    await expect(box.getByText("Listedeki okulla eşlendi.")).toBeVisible();
    await expect(toast(page, `${first.name} talebi listedeki ${listed.name} ile eşlendi.`)).toBeVisible();
    // Eşleme geri alınır.
    await box.getByRole("button", { name: "Geri al" }).click();
    await expect(box.getByText("Bu okul listede yok")).toBeVisible();
    await expect(box.getByRole("button", { name: "Onayla ve okulu ekle" })).toBeVisible();
    await match.click();
    await expect(box.getByRole("button", { name: "Onayla", exact: true })).toBeVisible();

    await box.getByRole("checkbox", { name: /^Okul gerçek bir okul/ }).click();
    await box.getByRole("checkbox", { name: /^E-posta okulun alan adıyla/ }).click();
    await box.getByRole("button", { name: "Onayla", exact: true }).click();
    await expect(toast(page, `${first.name} öğretmen oldu. E-postası birazdan gider.`)).toBeVisible();
    expect(await userOf(first.id)).toEqual({ role: "TEACHER", schoolId: listed.id });
    expect(await applicationOf(firstId)).toMatchObject({ status: "APPROVED", schoolId: listed.id });
    expect((await auditOf(firstId))[0].details).toMatchObject({ schoolId: listed.id, schoolCreated: false });
    expect(await query(`SELECT 1 FROM "School" WHERE "province" = $1 AND "district" = $2 AND "nameKey" = $3`, [place.province, place.district, `kuzgun${tag} orta okulu`])).toHaveLength(0);

    // 2. Benzeri olmayan yeni okul: ad düzeltilir, onaylanınca okul listeye eklenir.
    const second = await insertUser(`Zehra Yeni ${tag}`);
    const secondId = await insertApplication(second.id, { newSchool: { name: `marti${tag}  ortaokulu`, ...place } });
    const box2 = await openApplication(page, secondId, second.name);
    await expect(box2.getByText("Bu ilçede benzer bir okul listede var. Aynı okulsa eşle:")).toHaveCount(0);
    const nameInput = box2.getByLabel("Yeni okulsa resmî adı");
    await expect(nameInput).toHaveValue(`marti${tag} ortaokulu`);
    await box2.getByRole("checkbox", { name: /^Okul gerçek bir okul/ }).click();
    await box2.getByRole("checkbox", { name: /^Branş ve okul türü/ }).click();
    await nameInput.fill("Ok");
    await box2.getByRole("button", { name: "Onayla ve okulu ekle" }).click();
    await expect(box2.getByText("Okulun adı 5-90 karakter olmalı ve harf içermeli.")).toBeVisible();
    const fixed = `Martı${tag} Ortaokulu`;
    await nameInput.fill(fixed);
    await box2.getByRole("button", { name: "Onayla ve okulu ekle" }).click();
    await expect(toast(page, `${second.name} öğretmen oldu, ${fixed} okullara eklendi. E-postası birazdan gider.`)).toBeVisible();

    const [created] = await query<{ id: string; name: string; createdById: string }>(
      `SELECT "id", "name", "createdById" FROM "School" WHERE "province" = $1 AND "district" = $2 AND "name" = $3`,
      [place.province, place.district, fixed],
    );
    expect(created).toMatchObject({ name: fixed, createdById: admin.id });
    expect(await userOf(second.id)).toEqual({ role: "TEACHER", schoolId: created.id });
    expect((await auditOf(secondId))[0].details).toMatchObject({ schoolId: created.id, schoolCreated: true });
    expect(await query(`SELECT 1 FROM "AuditLog" WHERE "action" = 'school.created' AND "target" = $1 AND "actorId" = $2`, [`school:${created.id}`, admin.id])).toHaveLength(1);
  });

  test("belge yalnızca talepleri inceleyene, güvenlik başlıklarıyla gösterilir; her bakış kayıt defterine yazılır", async ({ page }) => {
    // Yönetici değil, yalnızca APPLICATIONS izni olan ekip üyesi.
    const email = uniqueEmail("ekip-talepler");
    await signUpVerified(page, email);
    const reviewerId = (await userIdOf(email))!;
    await query(`INSERT INTO "TeamPermission" ("userId", "permission", "grantedById") VALUES ($1, 'APPLICATIONS', $1)`, [reviewerId]);
    const school = await createSchool({ creatorEmail: email });

    const applicant = await insertUser(`Burak Belge ${stamp()}`);
    const imageId = await insertApplication(applicant.id, { school, document: { name: "atama-belgesi.png", mimeType: "image/png", data: png } });
    const other = await insertUser(`Ece Pdf ${stamp()}`);
    const pdfId = await insertApplication(other.id, { school, document: { name: "gorev-yeri-belgesi.pdf", mimeType: "application/pdf", data: pdf } });

    // Görsel: pencerede satır içinde.
    const box = await openApplication(page, imageId, applicant.name);
    await box.getByRole("button", { name: "Belgeyi gör" }).click();
    const viewer = page.getByRole("dialog", { name: "atama-belgesi.png" });
    const image = viewer.getByRole("img", { name: "atama-belgesi.png belgesinin görüntüsü" });
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1);
    await expect(viewer.getByText(/karar verilince otomatik silinir/)).toBeVisible();
    await expect(viewer.getByRole("link", { name: "Yeni sekmede aç" })).toHaveAttribute("rel", "noopener noreferrer");
    await expect
      .poll(async () => (await auditOf(imageId)).filter((a) => a.action === "application.document_viewed" && a.actorId === reviewerId).length)
      .toBe(1);
    expect((await auditOf(imageId)).find((a) => a.action === "application.document_viewed")?.details).toMatchObject({
      userId: applicant.id,
      mimeType: "image/png",
    });

    const response = await getDocument(page, `/yonetim/talepler/${imageId}/belge`);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["content-type"]).toBe("image/png");
    expect(headers["content-disposition"]).toBe("inline");
    expect(headers["cache-control"]).toBe("no-store");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("sandbox");
    expect(headers["content-security-policy"]).toContain("default-src 'none'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(Buffer.from(await response.body()).equals(png)).toBe(true);

    // PDF: pencerede çerçevede açılır. Genel "X-Frame-Options: DENY" yanıtta kalır ama CSP'deki
    // frame-ancestors 'self' önce gelir: çerçeve tarayıcının hata sayfasına (chrome-error://) dönmez.
    const pdfBox = await openApplication(page, pdfId, other.name);
    await pdfBox.getByRole("button", { name: "Belgeyi gör" }).click();
    const pdfViewer = page.getByRole("dialog", { name: "gorev-yeri-belgesi.pdf" });
    const frame = pdfViewer.locator("iframe");
    await expect(frame).toHaveAttribute("title", "Belge önizlemesi: gorev-yeri-belgesi.pdf");
    await expect.poll(() => page.frames().some((f) => f.url().endsWith(`/yonetim/talepler/${pdfId}/belge`))).toBe(true);
    expect(page.frames().some((f) => f.url().startsWith("chrome-error:"))).toBe(false);
    const pdfResponse = await getDocument(page, `/yonetim/talepler/${pdfId}/belge`);
    expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
    expect(pdfResponse.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
    await expect
      .poll(async () => (await auditOf(pdfId)).filter((a) => a.action === "application.document_viewed" && a.actorId === reviewerId).length)
      .toBeGreaterThanOrEqual(1);

    // Tanınmayan tür gösterilmez.
    await query(`UPDATE "ApplicationDocument" SET "mimeType" = 'text/html' WHERE "applicationId" = $1`, [pdfId]);
    expect((await getDocument(page, `/yonetim/talepler/${pdfId}/belge`)).status()).toBe(404);
  });

  test("yönetici kendi talebine karar veremez; istek değiştirilse de sunucu reddeder", async ({ page }) => {
    const admin = await signUpAdmin(page);
    const school = await createSchool({ creatorEmail: admin.email });
    const ownId = await insertApplication(admin.id, { school });
    const applicant = await insertUser(`Başka Başvuran ${stamp()}`);
    const otherId = await insertApplication(applicant.id, { school });

    const own = await openApplication(page, ownId, "Deneme Öğrenci");
    await expect(own.getByText("Bu talep senin. Kendi talebine karar veremezsin; başka bir yönetici bakmalı.")).toBeVisible();
    await expect(own.getByRole("button", { name: "Onayla", exact: true })).toHaveCount(0);
    await expect(own.getByRole("button", { name: "Reddet" })).toHaveCount(0);
    await expect(own.getByRole("checkbox", { name: /^Okul gerçek bir okul/ })).toBeDisabled();

    // Başka bir talebi onaylarken istekteki kimlik kendi talebiyle değiştirilir.
    const box = await openApplication(page, otherId, applicant.name);
    await box.getByRole("checkbox", { name: /^Okul gerçek bir okul/ }).click();
    await box.getByRole("checkbox", { name: /^Branş ve okul türü/ }).click();
    const restore = await rewriteNextAction(page, (body) => {
      expect(body).toContain(otherId);
      return body.replaceAll(otherId, ownId);
    });
    await box.getByRole("button", { name: "Onayla", exact: true }).click();
    await expect(toast(page, "Kendi talebine karar veremezsin.")).toBeVisible();
    await restore();
    expect(await applicationOf(ownId)).toMatchObject({ status: "PENDING", decidedById: null });
    expect(await applicationOf(otherId)).toMatchObject({ status: "PENDING" });
    expect((await userOf(admin.id)).role).toBe("ADMIN");
    expect(await auditOf(ownId)).toEqual([]);
  });

  test("yönetici avatar menüsünden panele gider; Sınıflarım yalnızca öğretmenliği onaylanınca görünür", async ({ page, isMobile }) => {
    const admin = await signUpAdmin(page);
    await page.goto("/profil");
    await page.getByRole("button", { name: "Hesap menüsü" }).click();
    await page.getByRole("link", { name: "Yönetim paneli" }).click();
    await expect(page).toHaveURL(/\/yonetim$/);

    // Öğretmenlik talebi onaylanmamış yönetici öğretmen sayılmaz: menüde Sınıflarım yok, sayfa profildeki Öğretmenlik bölümüne gönderir.
    const classes = page.getByRole("navigation", { name: "Ana menü" }).getByRole("link", { name: "Sınıflarım", exact: true });
    await page.goto("/profil");
    await expect(classes).toHaveCount(0);
    await page.goto("/siniflarim");
    await expect(page).toHaveURL(/\/profil\?bolum=ogretmenlik$/);

    // Talebi onaylanınca (başka bir yöneticinin kararıyla) öğretmen olur.
    const school = await createSchool({ creatorEmail: admin.email });
    const id = await insertApplication(admin.id, { school });
    await query(`UPDATE "TeacherApplication" SET "status" = 'APPROVED', "decidedAt" = now() WHERE "id" = $1`, [id]);
    await page.goto("/siniflarim");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sınıflarım");
    if (!isMobile) await expect(classes).toBeVisible();
  });
});
