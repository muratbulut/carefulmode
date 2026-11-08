import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { makeAdmin } from "./support/admin";
import { withDb } from "./support/db";
import { mailOutboxDir } from "./support/outbox-dir";
import { completeTraining } from "./support/progress";
import { createSchool } from "./support/teacher";

// Yönetim · Kullanıcılar (Kullanicilar-Son): yalnızca yönetici görür. Öğrenci "Ad S." olarak
// görünür, e-postası ve soyadı sayfaya hiç gitmez; profile bakmak kayıt defterine yazılır.
// Öğretmenin gözünden bakış salt okunurdur ve kayda geçer; hatırlatma günde bir;
// "Öğretmenlikten çıkar" sınıfları öğrencilerden gizler ve 5 saniye içinde geri alınır.
// Öğrenci ve öğretmen hesapları veritabanına doğrudan yazılır; yalnızca yönetici giriş yapar.

const usersPath = "/yonetim/kullanicilar";

const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });

/** Aramada benzersiz, yalnızca harf: "Kbcfa". */
const word = () =>
  randomUUID()
    .replace(/[^a-f]/g, "")
    .slice(0, 5)
    .replace(/^./, (c) => c.toUpperCase())
    .padEnd(5, "x");
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
async function insertUser(name: string, { role = "STUDENT", schoolId = null }: { role?: "STUDENT" | "TEACHER"; schoolId?: string | null } = {}) {
  const id = newId();
  const email = uniqueEmail("kullanici");
  await query(
    `INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "role", "schoolId", "birthYear", "updatedAt")
     VALUES ($1, $2, $3, true, $4, $5, 2012, now())`,
    [id, name, email, role, schoolId],
  );
  return { id, email, name };
}

/** Çok sayıda doğrulanmış öğrenci tek sorguda (sayfalamayı denemek için). */
async function insertStudents(names: string[]) {
  const ids = names.map(() => newId());
  const emails = names.map(() => uniqueEmail("toplu"));
  await query(
    `INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "role", "birthYear", "updatedAt")
     SELECT u.id, u.name, u.email, true, 'STUDENT', 2012, now() FROM unnest($1::text[], $2::text[], $3::text[]) AS u(id, name, email)`,
    [ids, names, emails],
  );
  return ids;
}

/** Öğretmenin sınıfı ve öğrencileri; istenirse ilk mahallede ödev. */
async function insertClassroom(teacherId: string, name: string, studentIds: string[], { assignment = false } = {}) {
  const id = newId();
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const joinCode = Array.from(randomUUID().replace(/-/g, "").slice(0, 6), (c) => alphabet[parseInt(c, 16) % alphabet.length]).join("");
  await query(`INSERT INTO "Classroom" ("id", "name", "level", "teacherId", "joinCode") VALUES ($1, $2, '7', $3, $4)`, [id, name, teacherId, joinCode]);
  if (studentIds.length > 0) {
    await query(`INSERT INTO "ClassroomMembership" ("classroomId", "userId") SELECT $1, unnest($2::text[])`, [id, studentIds]);
  }
  if (assignment) {
    await query(
      `INSERT INTO "Assignment" ("id", "classroomId", "neighborhoodId") SELECT $1, $2, "id" FROM "Neighborhood" ORDER BY "sortOrder" LIMIT 1`,
      [newId(), id],
    );
  }
  return { id, name, joinCode };
}

/** Hedefin kayıt defteri girişleri, eskiden yeniye. */
async function auditOf(target: string) {
  return query<{ action: string; actorId: string; details: Record<string, unknown> | null }>(
    `SELECT "action", "actorId", "details" FROM "AuditLog" WHERE "target" = $1 ORDER BY "createdAt", "id"`,
    [target],
  );
}

async function userOf(id: string) {
  const [row] = await query<{ role: string; schoolId: string | null }>(`SELECT "role", "schoolId" FROM "User" WHERE "id" = $1`, [id]);
  return row;
}

/** Kayıt olup yönetici olur; kimliğini döner. */
async function signUpAdmin(page: Page) {
  const email = uniqueEmail("yonetici");
  await signUpVerified(page, email);
  await makeAdmin(email);
  const [row] = await query<{ id: string }>(`SELECT "id" FROM "User" WHERE "email" = $1`, [email]);
  return { email, id: row.id };
}

async function openUsers(page: Page, search = "") {
  await page.goto(`${usersPath}${search}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kullanıcılar");
}

/** Öğretmenler sekmesinde öğretmeni (adresle) arar ve çekmecesini açar (masaüstünde "Aç", telefonda kart). */
async function openTeacherDrawer(page: Page, name: string, isMobile: boolean) {
  await openUsers(page, `?sekme=ogretmenler&ara=${encodeURIComponent(name)}`);
  if (isMobile) await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  else await page.getByRole("button", { name: `${name} ayrıntısını aç` }).click();
  const drawer = page.getByRole("dialog", { name });
  await expect(drawer).toBeVisible();
  return drawer;
}

test("giriş yapmamış ziyaretçi Kullanıcılar yerine girişe gönderilir", async ({ page }) => {
  await page.goto(usersPath);
  await expect(page).toHaveURL(/\/giris\?sonra=%2Fyonetim%2Fkullanicilar$/);
});

test.describe("Kullanıcılar", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  test("Roller izni olmayan ekip üyesi ve öğretmen sayfayı görmez: sayfa yok der", async ({ page }) => {
    const email = uniqueEmail("ekip");
    await signUpVerified(page, email);
    const [me] = await query<{ id: string }>(`SELECT "id" FROM "User" WHERE "email" = $1`, [email]);
    // Roller dışındaki bütün izinler (yetişkin hesap: hepsi geçerli).
    for (const permission of ["APPLICATIONS", "LAB_EDITING", "LAB_PUBLISHING", "TIPS", "NEWS", "AUDIT_LOG"]) {
      await query(`INSERT INTO "TeamPermission" ("userId", "permission", "grantedById") VALUES ($1, $2, $1)`, [me.id, permission]);
    }

    // Panele girer (ekipte), ama Kullanıcılar yok.
    await page.goto("/yonetim/odalar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Odalar");
    await page.goto(usersPath);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
    await expect(page).toHaveTitle(/Sayfa bulunamadı/);
    await page.goto(`${usersPath}?gorunum=okullar`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");

    // Öğretmen (ekip izni yok) da göremez.
    await query(`DELETE FROM "TeamPermission" WHERE "userId" = $1`, [me.id]);
    await query(`UPDATE "User" SET "role" = 'TEACHER' WHERE "id" = $1`, [me.id]);
    await page.goto(`${usersPath}?sekme=ogretmenler`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
    await page.goto("/yonetim/odalar");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
  });

  test("öğrenci listesi ve kısa profil: \"Ad S.\", e-posta ve soyadı hiç gitmez; her bakış kayda geçer", async ({ page }) => {
    const admin = await signUpAdmin(page);
    const first = `Pelin${word()}`;
    const surname = `Karaca${word()}`;
    const teacher = await insertUser(`Selin Öğretmen ${word()}`, { role: "TEACHER" });
    const student = await insertUser(`${first} Nur ${surname}`);
    // Aynı sınıfta 25 öğrenci daha: sınıf adıyla aranınca iki sayfa.
    const others = await insertStudents(Array.from({ length: 25 }, (_, i) => `Deniz${word()} Toplu${i}`));
    const classroom = await insertClassroom(teacher.id, `7-${word()}`, [student.id, ...others]);
    await completeTraining(student.email, "oltalama-egitimi");
    const short = `${first} K.`;

    // Sunucunun gönderdiği her şey (HTML ve sayfanın verisi) soyadı ve e-postayı içermez.
    // (Soyadıyla arama yapılan sayfa hariç: orada soyadını adrese ve kutuya test yazıyor.)
    const sent: string[] = [];
    page.on("response", async (response) => {
      if (!response.url().includes(usersPath) || response.url().includes(surname)) return;
      sent.push(await response.text().catch(() => ""));
    });

    // Sayfa sayfa: sınıf adıyla 26 öğrenci, en yeni üye önce.
    await openUsers(page, `?ara=${classroom.name}`);
    const pager = page.getByRole("navigation", { name: "Sayfalar" });
    await expect(pager).toContainText("1–25 · toplam 26");
    await expect(pager).toContainText("Sayfa 1 / 2");
    await expect(page.getByRole("button", { name: new RegExp(`^${short}`) })).toHaveCount(0);
    await pager.getByRole("link", { name: "Sonraki sayfa" }).click();
    await expect(page).toHaveURL(/sayfa=2/);
    await expect(pager).toContainText("26–26 · toplam 26");
    await expect(page.getByRole("button", { name: new RegExp(`^${short}`) })).toBeVisible();

    await openUsers(page, `?ara=${first.toLowerCase()}`);
    const row = page.getByRole("button", { name: new RegExp(`^${short}`) });
    await expect(row).toBeVisible();
    await expect(row).toContainText(`${classroom.name} · ${teacher.name}`);
    await expect(row).toContainText("1 oda");

    // Soyadı aranmaz.
    await openUsers(page, `?ara=${surname}`);
    await expect(page.getByText("Bu aramayla öğrenci yok.")).toBeVisible();

    // Arama kutusundan, adın baş harfiyle.
    await openUsers(page);
    await page.getByRole("searchbox", { name: "Ara" }).fill(`${first.toLocaleLowerCase("tr")} k.`);
    await expect(page).toHaveURL(new RegExp(`ara=${first.toLowerCase()}`));
    await page.getByRole("button", { name: new RegExp(`^${short}`) }).click();
    const drawer = page.getByRole("dialog", { name: short });
    await expect(drawer).toContainText(`${classroom.name} · ${teacher.name}`);
    await expect(drawer).toContainText("oda bitirdi");
    await expect(drawer).toContainText("Son 4 hafta");
    await expect(drawer.getByRole("img", { name: "Son 4 haftada 1 gün oda bitirdi" })).toBeVisible();
    await expect(drawer).toContainText("BİTİRDİĞİ ODALAR");
    await expect(drawer).toContainText("EĞİTİM");
    await expect(drawer).toContainText("Burada görünmeyenler:");
    await expect(drawer).not.toContainText(surname);
    await expect(page).toHaveURL(new RegExp(`ogrenci=${student.id}`));

    await expect.poll(async () => (await auditOf(`user:${student.id}`)).length).toBe(1);
    const [view] = await auditOf(`user:${student.id}`);
    expect(view).toMatchObject({ action: "student.profile_viewed", actorId: admin.id });
    expect(view.details).toEqual({ name: short });

    // Kapatıp yeniden açınca yeni bir kayıt.
    await drawer.getByRole("button", { name: "Kapat" }).first().click();
    await expect(drawer).toBeHidden();
    await page.getByRole("button", { name: new RegExp(`^${short}`) }).click();
    await expect(page.getByRole("dialog", { name: short })).toContainText("oda bitirdi");
    await expect.poll(async () => (await auditOf(`user:${student.id}`)).length).toBe(2);

    // Adresle açılan profil de kayda geçer.
    await page.goto(`${usersPath}?ogrenci=${student.id}`);
    await expect(page.getByRole("dialog", { name: short })).toContainText("oda bitirdi");
    await expect.poll(async () => (await auditOf(`user:${student.id}`)).length).toBe(3);

    const all = sent.join("\n");
    expect(all).toContain(short);
    expect(all).not.toContain(surname);
    expect(all).not.toContain(student.email);
    const html = await (await page.request.get(`${usersPath}?ara=${first.toLowerCase()}`)).text();
    expect(html).toContain(short);
    expect(html).not.toContain(surname);
    expect(html).not.toContain(student.email);
  });

  test("öğretmenin gözünden: sınıfları görünür, öğrenci adı ve sınıf kodu yok; bakış kayda geçer", async ({ page, isMobile }) => {
    const admin = await signUpAdmin(page);
    const school = await createSchool({ creatorEmail: admin.email });
    const teacher = await insertUser(`Ahmet Göz ${word()}`, { role: "TEACHER", schoolId: school.id });
    const secret = `Gizli${word()} Öğrenci`;
    const students = await Promise.all([1, 2, 3, 4, 5].map((n) => insertUser(`${secret} ${n}`)));
    const classroom = await insertClassroom(
      teacher.id,
      `8-${word()}`,
      students.map((s) => s.id),
      { assignment: true },
    );

    // Arama kutusundan (ad, okul ya da branş): okul adıyla bulunur.
    await openUsers(page, "?sekme=ogretmenler");
    await page.getByRole("searchbox", { name: "Ara" }).fill(school.name);
    await expect(page).toHaveURL(/sekme=ogretmenler&ara=/);
    const open = isMobile
      ? page.getByRole("button", { name: new RegExp(`^${teacher.name}`) })
      : page.getByRole("button", { name: `${teacher.name} ayrıntısını aç` });
    await open.click();
    const drawer = page.getByRole("dialog", { name: teacher.name });
    await expect(drawer).toContainText("Kurulum · 4/5");
    await expect(drawer).toContainText(classroom.name);
    await expect(drawer).toContainText(teacher.email);
    await expect(drawer).not.toContainText(secret);

    await drawer.getByRole("button", { name: "Öğretmenin gözünden bak" }).click();
    const gaze = page.getByRole("dialog", { name: `${teacher.name} ne görüyor?` });
    await expect(gaze).toContainText("Sadece bakıyorsun, bir şey değişmez. Bu bakış kayıtlara yazıldı.");
    await expect(gaze.getByRole("heading", { name: "Sınıflarım" })).toBeVisible();
    await expect(gaze.getByRole("article", { name: classroom.name })).toContainText("5 öğrenci");
    await expect(gaze).not.toContainText(secret);
    await expect(gaze).not.toContainText(classroom.joinCode);
    await expect(gaze.getByRole("link")).toHaveCount(0);

    await expect.poll(async () => (await auditOf(`user:${teacher.id}`)).map((a) => a.action)).toEqual(["teacher.viewed_as"]);
    expect((await auditOf(`user:${teacher.id}`))[0]).toMatchObject({ actorId: admin.id, details: { name: teacher.name } });

    await gaze.getByRole("button", { name: "Kapat" }).click();
    await expect(gaze).toBeHidden();
    // Sayfanın verisinde de öğrenci adı yok.
    const html = await (await page.request.get(`${usersPath}?sekme=ogretmenler`)).text();
    expect(html).toContain(teacher.name);
    expect(html).not.toContain(secret);
  });

  test("hatırlatma bir mail gönderir; 24 saat içinde ikincisi (okul sorumlusundan gelmiş olsa da) reddedilir", async ({ page, context, isMobile }) => {
    // İki sekme ve dört çekmece açılışı.
    test.slow();
    const admin = await signUpAdmin(page);
    const school = await createSchool({ creatorEmail: admin.email });
    const teacher = await insertUser(`Murat Hatırlat ${word()}`, { role: "TEACHER", schoolId: school.id });
    const other = await insertUser(`Nur Sorumlu ${word()}`, { role: "TEACHER", schoolId: school.id });

    // İkinci sekme hatırlatmalardan önce açılır: düğmeler orada hâlâ durur, sunucu reddetmeli.
    const stale = await context.newPage();
    await openTeacherDrawer(stale, teacher.name, isMobile);

    const drawer = await openTeacherDrawer(page, teacher.name, isMobile);
    await drawer.getByRole("button", { name: "Hatırlat: Sınıfını kur" }).click();
    await expect(toast(page, `${teacher.name} için "Sınıfını kur" hatırlatması gitti.`)).toBeVisible();
    await expect(drawer.getByText("Hatırlatma gönderildi")).toBeVisible();

    await expect.poll(async () => (await mailsTo(teacher.email)).length).toBe(1);
    const [mail] = await mailsTo(teacher.email);
    expect(mail.subject).toBe("Sınıfını kurmaya ne dersin?");
    expect(mail.text).toContain("ekibi olarak sana kısa bir hatırlatma");
    expect(mail.text).not.toContain("okul sorumlu");

    await stale.getByRole("dialog", { name: teacher.name }).getByRole("button", { name: "Hatırlat: Sınıfını kur" }).click();
    await expect(toast(stale, /son 24 saatte hatırlatma gitti/)).toBeVisible();
    expect(await mailsTo(teacher.email)).toHaveLength(1);
    const audit = await auditOf(`user:${teacher.id}`);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: "teacher.reminded", actorId: admin.id, details: { by: "team", kind: "createClass", step: 1 } });

    // Okul sorumlusu bugün hatırlattıysa ekip hatırlatamaz.
    await stale.getByRole("dialog", { name: teacher.name }).getByRole("button", { name: "Kapat" }).first().click();
    await openTeacherDrawer(stale, other.name, isMobile);
    await query(`INSERT INTO "AuditLog" ("id", "actorId", "action", "target", "details") VALUES ($1, $2, 'teacher.reminded', $3, $4)`, [
      newId(),
      admin.id,
      `user:${other.id}`,
      JSON.stringify({ schoolId: school.id, kind: "createClass", step: 1 }),
    ]);
    await stale.getByRole("dialog", { name: other.name }).getByRole("button", { name: "Hatırlat: Sınıfını kur" }).click();
    await expect(toast(stale, /okul sorumlusundan ya da ekipten/)).toBeVisible();
    expect(await mailsTo(other.email)).toHaveLength(0);
    // Yeni açılan sayfada düğme yerine "Hatırlatma gönderildi".
    const fresh = await openTeacherDrawer(page, other.name, isMobile);
    await expect(fresh.getByText("Hatırlatma gönderildi")).toBeVisible();
    await expect(fresh.getByRole("button", { name: /^Hatırlat:/ })).toHaveCount(0);
  });

  test("öğretmenlikten çıkar: sınıf öğrenciden gizlenir, okul sorumluluğu kalkar; Geri al hepsini döndürür", async ({ page, browser, baseURL }) => {
    // İki hesap açılır (yönetici ve sınıftaki öğrenci).
    test.slow();
    const admin = await signUpAdmin(page);
    const school = await createSchool({ creatorEmail: admin.email });
    const teacher = await insertUser(`Emre Çıkar ${word()}`, { role: "TEACHER", schoolId: school.id });
    await query(`UPDATE "School" SET "coordinatorId" = $1 WHERE "id" = $2`, [teacher.id, school.id]);

    // Sınıftaki öğrenci kendi tarayıcısında.
    const studentContext = await browser.newContext({ baseURL });
    const studentPage = await studentContext.newPage();
    const studentEmail = uniqueEmail("sinifta");
    await signUpVerified(studentPage, studentEmail);
    const [studentRow] = await query<{ id: string }>(`SELECT "id" FROM "User" WHERE "email" = $1`, [studentEmail]);
    const classroom = await insertClassroom(teacher.id, `6-${word()}`, [studentRow.id], { assignment: true });
    const classCard = studentPage.getByRole("region", { name: "Sınıfın" }).filter({ visible: true });
    await studentPage.goto("/");
    await expect(classCard).toContainText(classroom.name);

    // Adresle açılan çekmece.
    await openUsers(page, `?sekme=ogretmenler&ogretmen=${teacher.id}`);
    const drawer = page.getByRole("dialog", { name: teacher.name });
    await expect(drawer).toContainText("OKUL SORUMLUSU");
    await drawer.getByRole("button", { name: "Öğretmenlikten çıkar" }).click();
    const confirm = page.getByRole("dialog", { name: `${teacher.name} öğretmenlikten çıkarılsın mı?` });
    await expect(confirm).toContainText("Sınıfları öğrencilerden gizlenir, öğrencilerin ilerlemesi silinmez.");
    await expect(confirm).toContainText(`${school.name} okul sorumluluğu da kalkar.`);
    await confirm.getByRole("button", { name: "Öğretmenlikten çıkar" }).click();

    const removed = toast(page, `${teacher.name} artık öğretmen değil.`);
    await expect(removed).toBeVisible();
    await expect(drawer).toBeHidden();
    expect(await userOf(teacher.id)).toEqual({ role: "STUDENT", schoolId: null });
    const [schoolRow] = await query<{ coordinatorId: string | null }>(`SELECT "coordinatorId" FROM "School" WHERE "id" = $1`, [school.id]);
    expect(schoolRow.coordinatorId).toBeNull();
    const [classRow] = await query<{ archived: boolean; members: number }>(
      `SELECT c."archived", (SELECT count(*)::int FROM "ClassroomMembership" m WHERE m."classroomId" = c."id") AS "members" FROM "Classroom" c WHERE c."id" = $1`,
      [classroom.id],
    );
    expect(classRow).toEqual({ archived: true, members: 1 });

    await studentPage.goto("/");
    await expect(classCard.getByRole("heading")).toHaveText("Sınıfına katıl");
    await expect(classCard).not.toContainText(classroom.name);

    // 5 saniye içinde geri al.
    await removed.getByRole("button", { name: "Geri al" }).click();
    await expect(toast(page, `Geri alındı: ${teacher.name} yeniden öğretmen.`)).toBeVisible();
    expect(await userOf(teacher.id)).toEqual({ role: "TEACHER", schoolId: school.id });
    const [restoredSchool] = await query<{ coordinatorId: string | null }>(`SELECT "coordinatorId" FROM "School" WHERE "id" = $1`, [school.id]);
    expect(restoredSchool.coordinatorId).toBe(teacher.id);
    const [restoredClass] = await query<{ archived: boolean }>(`SELECT "archived" FROM "Classroom" WHERE "id" = $1`, [classroom.id]);
    expect(restoredClass.archived).toBe(false);
    await studentPage.goto("/");
    await expect(classCard).toContainText(classroom.name);

    const audit = await auditOf(`user:${teacher.id}`);
    expect(audit.map((a) => a.action)).toEqual(["teacher.removed", "teacher.restored"]);
    expect(audit[0]).toMatchObject({
      actorId: admin.id,
      details: { previousRole: "TEACHER", schoolId: school.id, coordinatorOf: school.id, archivedClassIds: [classroom.id] },
    });
    expect(audit[1]).toMatchObject({ actorId: admin.id, details: { role: "TEACHER", coordinatorOf: school.id, restoredClasses: 1 } });
    await studentContext.close();
  });

  test("Okullar: okul kartı, kurulum hunisi ve bekleyen talep; öğretmen satırı çekmeceyi açar", async ({ page }) => {
    const admin = await signUpAdmin(page);
    const school = await createSchool({ name: `E2E Aaa Okulu ${word()}`, creatorEmail: admin.email });
    const teacher = await insertUser(`Okan Okul ${word()}`, { role: "TEACHER", schoolId: school.id });
    await insertClassroom(teacher.id, `5-${word()}`, []);
    const applicant = await insertUser(`Selin Talep ${word()}`);
    await query(
      `INSERT INTO "TeacherApplication" ("id", "userId", "schoolId", "province", "district", "subject") VALUES ($1, $2, $3, $4, $5, 'Türkçe')`,
      [newId(), applicant.id, school.id, school.province, school.district],
    );

    await openUsers(page, "?gorunum=okullar");
    await expect(page.getByRole("tab", { name: /Okullar/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Okul sorumlusu ne görür?")).toBeVisible();
    // Okul araması (ad, il, ilçe) adrese yazılır.
    await page.getByRole("searchbox", { name: "Ara" }).fill(school.name);
    await expect(page).toHaveURL(/gorunum=okullar&ara=/);
    await expect(page.getByRole("region", { name: /^E2E Aaa Okulu/ })).toHaveCount(1);
    const card = page.getByRole("region", { name: school.name });
    await expect(card).toContainText("1 onaylı öğretmen");
    await expect(card).toContainText("1 talep bekliyor");
    await expect(card).toContainText("Okul sorumlusu yok");
    await expect(card.getByRole("img", { name: "Kurulum hunisi: Onaylandı 1, Sınıf kurdu 1, Öğrenciler katıldı 0, Ödev verdi 0, Sınıf bitiriyor 0" })).toBeVisible();

    // Kartın açma düğmesi okul adıyla başlar ("Sorumlu ata: <okul>" düğmesi değil).
    const toggle = card.getByRole("button", { name: new RegExp(`^${school.name}`) });
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await card.getByRole("button", { name: "Sınıflar", exact: true }).click();
    await expect(card).toContainText("Ödev yok");
    // Satırın kendisi (yanındaki "{ad}: öğretmenin gözünden bak" düğmesi değil).
    await card.getByRole("button", { name: new RegExp(`^${teacher.name}(?!:)`) }).click();
    const drawer = page.getByRole("dialog", { name: teacher.name });
    await expect(drawer).toContainText("Kurulum · 2/5");
    await expect(page).toHaveURL(new RegExp(`gorunum=okullar.*ogretmen=${teacher.id}`));
  });
});
