import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { withDb } from "./support/db";
import { mailOutboxDir } from "./support/outbox-dir";
import { createSchool, makeCoordinator, makeTeacher, userIdOf } from "./support/teacher";

// Okulum (O4 haftalık okul bülteni): yalnızca okul sorumlusu görür, öğrenci adı ve puanı yoktur;
// okuldan gelen talebe görüş ve onay (5 saniyelik "Geri al"), takılan öğretmene hatırlatma.
// Başvuran, öğretmen ve öğrenci hesapları veritabanına doğrudan yazılır; yalnızca sorumlu giriş yapar.

// Geri al süresi 30 saniye, karar maili ondan 5 saniye sonra gider (lib/teacher/decision-rules.ts).
const undoWindowMs = 30_000;
const finalizeDelayMs = undoWindowMs + 5_000;

const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });

const stamp = () => randomUUID().slice(0, 6);
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;

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

/** Doğrulanmış hesap (giriş yapmaz). */
async function insertUser(
  name: string,
  { role = "STUDENT", schoolId = null, birthYear = null }: { role?: "STUDENT" | "TEACHER"; schoolId?: string | null; birthYear?: number | null } = {},
) {
  const id = newId();
  const email = uniqueEmail("okulum");
  await query(
    `INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "role", "schoolId", "birthYear", "updatedAt")
     VALUES ($1, $2, $3, true, $4, $5, $6, now())`,
    [id, name, email, role, schoolId, birthYear],
  );
  return { id, email, name };
}

/** Okulu seçmiş bekleyen öğretmenlik talebi; belgeli. */
async function insertApplication(userId: string, school: { id: string; province: string; district: string }, subject = "Bilişim Teknolojileri") {
  const id = newId();
  await query(
    `INSERT INTO "TeacherApplication" ("id", "userId", "schoolId", "province", "district", "subject", "documentName", "documentSize")
     VALUES ($1, $2, $3, $4, $5, $6, 'gorev-belgesi.pdf', 8)`,
    [id, userId, school.id, school.province, school.district, subject],
  );
  await query(`INSERT INTO "ApplicationDocument" ("applicationId", "mimeType", "data") VALUES ($1, 'application/pdf', $2)`, [id, Buffer.from("%PDF-1.4")]);
  return id;
}

/** Öğretmenin sınıfı, öğrencileri ve ilk mahallede açık ödevi. */
async function insertClassroom(teacherId: string, name: string, studentIds: string[]) {
  const id = newId();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const joinCode = Array.from(randomUUID().replace(/-/g, "").slice(0, 6), (c) => alphabet[parseInt(c, 16) % alphabet.length]).join("");
  await query(`INSERT INTO "Classroom" ("id", "name", "level", "teacherId", "joinCode") VALUES ($1, $2, '7', $3, $4)`, [id, name, teacherId, joinCode]);
  for (const userId of studentIds) await query(`INSERT INTO "ClassroomMembership" ("classroomId", "userId") VALUES ($1, $2)`, [id, userId]);
  await query(
    `INSERT INTO "Assignment" ("id", "classroomId", "neighborhoodId", "dueDate")
     SELECT $1, $2, "id", now() + interval '7 days' FROM "Neighborhood" ORDER BY "sortOrder" LIMIT 1`,
    [newId(), id],
  );
  return id;
}

async function applicationOf(id: string) {
  const [row] = await query<{ status: string; coordinatorOpinion: string | null; decidedById: string | null; decidedAt: Date | null; schoolId: string | null }>(
    // Prisma saati UTC olarak saat dilimsiz yazar; pg yerel saat sanmasın.
    `SELECT "status", "coordinatorOpinion", "decidedById", "decidedAt" AT TIME ZONE 'UTC' AS "decidedAt", "schoolId"
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

/** Hedefin kayıt defteri girişleri, eskiden yeniye. */
async function auditOf(target: string) {
  return query<{ action: string; actorId: string; createdAt: Date; details: Record<string, unknown> | null }>(
    `SELECT "action", "actorId", "createdAt", "details" FROM "AuditLog" WHERE "target" = $1 ORDER BY "createdAt", "id"`,
    [target],
  );
}

/** Kayıt olup okulun sorumlusu (ve öğretmeni) olur. */
async function signUpCoordinator(page: Page, { coordinatorApproves = true }: { coordinatorApproves?: boolean } = {}) {
  const email = uniqueEmail("sorumlu");
  await signUpVerified(page, email);
  const school = await createSchool({ creatorEmail: email });
  await makeTeacher(email, school.id);
  await makeCoordinator(email, school.id);
  if (!coordinatorApproves) await query(`UPDATE "School" SET "coordinatorApproves" = false WHERE "id" = $1`, [school.id]);
  const id = (await userIdOf(email))!;
  return { email, id, school };
}

/** Okulum'u açar; başlıkta okulun adı. */
async function openSchool(page: Page, schoolName: string) {
  await page.goto("/okulum");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(schoolName);
}

const requestItem = (page: Page, name: string) => page.getByRole("region", { name: "Okulundan gelen talepler" }).getByRole("listitem", { name });

test("giriş yapmamış ziyaretçi Okulum yerine girişe gönderilir", async ({ page }) => {
  await page.goto("/okulum");
  await expect(page).toHaveURL(/\/giris\?sonra=%2Fokulum$/);
});

test.describe("Okulum", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  test("öğrenci ve sorumlu olmayan öğretmen Okulum'u görmez: sayfa yok der", async ({ page }) => {
    const email = uniqueEmail("ogrenci");
    await signUpVerified(page, email);
    await page.goto("/okulum");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");

    // Okulu olan öğretmen de sorumlu değilse göremez.
    const school = await createSchool({ creatorEmail: email });
    await makeTeacher(email, school.id);
    await page.goto("/okulum");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
    await expect(page.getByText(school.name)).toHaveCount(0);
  });

  test("sorumlu yalnızca kendi okulunu görür; öğrenci adı, e-posta ve puan sayfada yok", async ({ page }) => {
    const coordinator = await signUpCoordinator(page);
    const school = coordinator.school;
    const tag = stamp();

    // Kendi okulu: bir öğretmen, sınıfı ve öğrencisi; bekleyen bir talep.
    const teacher = await insertUser(`Ayşe Öğretmen ${tag}`, { role: "TEACHER", schoolId: school.id });
    const student = await insertUser(`Zümrüt Kılıçarslan ${tag}`);
    await insertClassroom(teacher.id, `7-A ${tag}`, [student.id]);
    const applicant = await insertUser(`Başvuran Burak ${tag}`);
    await insertApplication(applicant.id, school);

    // Başka okul: öğretmeni, öğrencisi ve talebi hiç görünmez.
    const other = await createSchool({ creatorEmail: coordinator.email, district: "Kadıköy" });
    const otherTeacher = await insertUser(`Başka Okul Öğretmeni ${tag}`, { role: "TEACHER", schoolId: other.id });
    const otherStudent = await insertUser(`Başka Okul Öğrencisi ${tag}`);
    await insertClassroom(otherTeacher.id, `Başka Sınıf ${tag}`, [otherStudent.id]);
    const otherApplicant = await insertUser(`Başka Okul Başvuranı ${tag}`);
    await insertApplication(otherApplicant.id, other);

    await openSchool(page, school.name);
    const teachers = page.getByRole("region", { name: "Öğretmenler" });
    await expect(teachers.getByRole("button", { name: new RegExp(teacher.name) })).toBeVisible();
    await expect(teachers.getByRole("button", { name: /SEN/ })).toBeVisible();
    await expect(requestItem(page, applicant.name)).toBeVisible();

    // Bülten yalnızca toplamları söyler: 2 öğretmen (sorumlu da), 1 sınıf, 1 öğrenci.
    const bulletin = page.getByRole("article", { name: school.name });
    await expect(bulletin).toContainText(/2\s*onaylı öğretmen/);
    await expect(bulletin).toContainText(/1\s*sınıf/);
    await expect(bulletin).toContainText(/1\s*öğrenci sınıflarda/);

    // Öğretmenin ayrıntısında sınıfı ve öğrenci sayısı var; öğrencinin adı yok.
    await teachers.getByRole("button", { name: new RegExp(teacher.name) }).click();
    const drawer = page.getByRole("dialog", { name: teacher.name });
    await expect(drawer).toContainText(`7-A ${tag}`);
    await expect(drawer).toContainText("1 öğrenci");

    // Ne sayfada ne de sayfayla gelen veride (RSC) öğrenci adı, e-posta ya da başka okul var.
    const html = await (await page.request.get("/okulum")).text();
    const dom = await page.content();
    for (const text of [html, dom]) {
      expect(text).toContain(teacher.name);
      for (const hidden of [
        student.name,
        student.email,
        teacher.email,
        applicant.email,
        otherTeacher.name,
        otherStudent.name,
        otherApplicant.name,
        other.name,
        "gorev-belgesi.pdf",
      ]) {
        expect(text, hidden).not.toContain(hidden);
      }
    }
  });

  test("onay: başvuran okulun öğretmeni olur; mail geri al süresinden sonra gelir, belge silinir", async ({ page }) => {
    test.setTimeout(150_000);
    const coordinator = await signUpCoordinator(page);
    const applicant = await insertUser(`Selin Onay ${stamp()}`);
    const applicationId = await insertApplication(applicant.id, coordinator.school);

    await openSchool(page, coordinator.school.name);
    await requestItem(page, applicant.name).getByRole("button", { name: "Okulumda çalışıyor, onayla" }).click();
    await expect(toast(page, `${applicant.name} öğretmen oldu. Kayıt defterine yazıldı.`)).toBeVisible();
    await expect(requestItem(page, applicant.name)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Okulundan gelen talepler" })).toContainText(
      `${applicant.name} · Onayladın · öğretmenler listesine eklendi`,
    );

    expect(await userOf(applicant.id)).toEqual({ role: "TEACHER", schoolId: coordinator.school.id });
    const decided = await applicationOf(applicationId);
    expect(decided).toMatchObject({ status: "APPROVED", coordinatorOpinion: "ENDORSED", decidedById: coordinator.id, schoolId: coordinator.school.id });
    // Geri al süresi bitmeden mail gitmez, belge durur.
    expect(await mailsTo(applicant.email)).toHaveLength(0);
    expect(await hasDocument(applicationId)).toBe(true);

    // Yeni öğretmen listede "Yeni katıldı" olarak görünür.
    await expect(page.getByRole("region", { name: "Öğretmenler" }).getByRole("button", { name: new RegExp(applicant.name) })).toContainText("Yeni katıldı");

    await expect
      .poll(async () => (await mailsTo(applicant.email)).length, { timeout: finalizeDelayMs + 45_000, intervals: [2_000] })
      .toBe(1);
    const [mail] = await mailsTo(applicant.email);
    expect(mail.subject).toMatch(/öğretmen hesabın açıldı$/);
    expect(mail.text).toContain(`${coordinator.school.name} öğretmeni olarak`);
    expect(mail.text).toContain("sunucumuzdan silindi");
    expect(new Date(mail.sentAt).getTime() - decided.decidedAt!.getTime()).toBeGreaterThanOrEqual(undoWindowMs);
    expect(await hasDocument(applicationId)).toBe(false);

    const audit = await auditOf(`application:${applicationId}`);
    expect(audit.map((a) => a.action)).toEqual(["application.endorsed", "application.approved", "application.mail_sent"]);
    expect(audit.every((a) => a.actorId === coordinator.id)).toBe(true);
    expect(audit[1].details).toMatchObject({ userId: applicant.id, schoolId: coordinator.school.id, previousRole: "STUDENT", role: "TEACHER" });

    // Geri al süresi geçtikten sonra geri alınamaz; ikinci mail de gitmez.
    await page.waitForTimeout(3_000);
    expect(await mailsTo(applicant.email)).toHaveLength(1);
  });

  test("geri al: rol ve talep eski haline döner, mail gitmez", async ({ page }) => {
    test.setTimeout(150_000);
    const coordinator = await signUpCoordinator(page);
    const applicant = await insertUser(`Deniz Geri ${stamp()}`);
    const applicationId = await insertApplication(applicant.id, coordinator.school);

    await openSchool(page, coordinator.school.name);
    await requestItem(page, applicant.name).getByRole("button", { name: "Okulumda çalışıyor, onayla" }).click();
    const approved = toast(page, `${applicant.name} öğretmen oldu.`);
    await expect(approved).toBeVisible();
    expect((await userOf(applicant.id)).role).toBe("TEACHER");
    const approvedAt = Date.now();

    await approved.getByRole("button", { name: "Geri al" }).click();
    await expect(toast(page, "Geri alındı. Talep yeniden bekliyor.")).toBeVisible();
    await expect(requestItem(page, applicant.name)).toBeVisible();

    expect(await userOf(applicant.id)).toEqual({ role: "STUDENT", schoolId: null });
    expect(await applicationOf(applicationId)).toMatchObject({ status: "PENDING", coordinatorOpinion: null, decidedById: null, decidedAt: null });
    const audit = await auditOf(`application:${applicationId}`);
    expect(audit.map((a) => a.action)).toEqual(["application.endorsed", "application.approved", "application.undone"]);
    const undone = (audit[2].details?.undone ?? []) as { action: string }[];
    expect(undone.map((e) => e.action).sort()).toEqual(["application.approved", "application.endorsed"]);

    // Kesinleşme zamanı geçer: mail gitmez, belge silinmez.
    await page.waitForTimeout(Math.max(0, approvedAt + finalizeDelayMs + 8_000 - Date.now()));
    expect(await mailsTo(applicant.email)).toHaveLength(0);
    expect(await hasDocument(applicationId)).toBe(true);
    expect((await auditOf(`application:${applicationId}`)).map((a) => a.action)).not.toContain("application.mail_sent");
  });

  test("Tanımıyorum: talep yöneticide bekler, görüş yazılır", async ({ page }) => {
    const coordinator = await signUpCoordinator(page);
    const applicant = await insertUser(`Kerem Tanımıyorum ${stamp()}`);
    const applicationId = await insertApplication(applicant.id, coordinator.school);

    await openSchool(page, coordinator.school.name);
    await requestItem(page, applicant.name).getByRole("button", { name: "Tanımıyorum" }).click();
    await expect(toast(page, `Yöneticiye not gitti: ${applicant.name} bu okulda tanınmıyor.`)).toBeVisible();
    await expect(requestItem(page, applicant.name)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Okulundan gelen talepler" })).toContainText(`${applicant.name} · Yöneticiye bıraktın`);

    expect(await applicationOf(applicationId)).toMatchObject({ status: "PENDING", coordinatorOpinion: "NOT_RECOGNIZED", decidedById: null });
    expect(await userOf(applicant.id)).toEqual({ role: "STUDENT", schoolId: null });
    const audit = await auditOf(`application:${applicationId}`);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "application.not_recognized", actorId: coordinator.id });
    expect(audit[0].details).toMatchObject({ opinion: "NOT_RECOGNIZED", previousOpinion: null });
  });

  test("sorumlu onaylayamıyorsa düğme yalnızca görüş bildirir; karar yöneticide kalır", async ({ page }) => {
    const coordinator = await signUpCoordinator(page, { coordinatorApproves: false });
    const applicant = await insertUser(`Elif Görüş ${stamp()}`);
    const applicationId = await insertApplication(applicant.id, coordinator.school);

    await openSchool(page, coordinator.school.name);
    await expect(requestItem(page, applicant.name)).toContainText("kararı yönetici verir");
    await requestItem(page, applicant.name).getByRole("button", { name: "Okulumda çalışıyor, onayla" }).click();
    await expect(toast(page, `Görüşün yöneticiye gitti: ${applicant.name} okulunda çalışıyor.`)).toBeVisible();
    await expect(page.getByRole("region", { name: "Okulundan gelen talepler" })).toContainText(`${applicant.name} · Okulunda çalıştığını söyledin`);

    expect(await applicationOf(applicationId)).toMatchObject({ status: "PENDING", coordinatorOpinion: "ENDORSED", decidedById: null });
    expect(await userOf(applicant.id)).toEqual({ role: "STUDENT", schoolId: null });
    expect(await hasDocument(applicationId)).toBe(true);
    expect((await auditOf(`application:${applicationId}`)).map((a) => a.action)).toEqual(["application.endorsed"]);
  });

  test("18 yaşından küçük görünen başvuranda uyarı çıkar (yıl yazmaz); talep yine onaylanabilir", async ({ page }) => {
    const coordinator = await signUpCoordinator(page);
    const year = new Date().getFullYear();
    const minor = await insertUser(`Ece Küçük ${stamp()}`, { birthYear: year - 15 });
    const adult = await insertUser(`Ayşe Büyük ${stamp()}`, { birthYear: 1990 });
    await insertApplication(minor.id, coordinator.school);
    await insertApplication(adult.id, coordinator.school);

    await openSchool(page, coordinator.school.name);
    const warning = "Doğum yılına göre 18 yaşından küçük olabilir. Tanımıyorsan onaylama.";
    await expect(requestItem(page, minor.name)).toContainText(warning);
    await expect(requestItem(page, minor.name)).not.toContainText(String(year - 15));
    await expect(requestItem(page, adult.name)).not.toContainText(warning);
    await expect(requestItem(page, minor.name).getByRole("button", { name: "Okulumda çalışıyor, onayla" })).toBeEnabled();
  });

  test("hatırlatma bir mail gönderir; aynı gün ikincisi reddedilir", async ({ page, context }) => {
    const coordinator = await signUpCoordinator(page);
    const teacher = await insertUser(`Murat Hatırlat ${stamp()}`, { role: "TEACHER", schoolId: coordinator.school.id });

    // İkinci sekme hatırlatmadan önce açılır: düğme orada hâlâ durur, sunucu reddetmeli.
    const stale = await context.newPage();
    await openSchool(stale, coordinator.school.name);
    await openSchool(page, coordinator.school.name);

    const card = page.getByRole("region", { name: "Öğretmenler" }).getByRole("button", { name: new RegExp(teacher.name) });
    await expect(card).toContainText("Takıldı");
    await card.click();
    const drawer = page.getByRole("dialog", { name: teacher.name });
    await drawer.getByRole("button", { name: "Hatırlat: Sınıfını kur" }).click();
    await expect(toast(page, `Hatırlatma gitti: ${teacher.name} · "Sınıfını kur"`)).toBeVisible();
    await expect(drawer.getByText("Hatırlatma gönderildi")).toBeVisible();
    await expect(drawer.getByRole("button", { name: /^Hatırlat:/ })).toHaveCount(0);

    await expect.poll(async () => (await mailsTo(teacher.email)).length).toBe(1);
    const [mail] = await mailsTo(teacher.email);
    expect(mail.subject).toBe("Sınıfını kurmaya ne dersin?");
    expect(mail.text).toContain(`${coordinator.school.name} okul sorumlusu olarak`);

    await stale.getByRole("region", { name: "Öğretmenler" }).getByRole("button", { name: new RegExp(teacher.name) }).click();
    await stale.getByRole("dialog", { name: teacher.name }).getByRole("button", { name: "Hatırlat: Sınıfını kur" }).click();
    await expect(toast(stale, "Bu öğretmene son 24 saatte hatırlatma gitti.")).toBeVisible();
    expect(await mailsTo(teacher.email)).toHaveLength(1);

    const audit = await auditOf(`user:${teacher.id}`);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "teacher.reminded", actorId: coordinator.id });
    expect(audit[0].details).toMatchObject({ schoolId: coordinator.school.id, kind: "createClass", step: 1 });
  });
});
