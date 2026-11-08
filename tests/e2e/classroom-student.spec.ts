import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { isLive, signIn, signOutHere, signUp, signUpVerified, strongPassword, typeCode, uniqueEmail, waitForCode } from "./support/account";
import { withDb } from "./support/db";
import { completeTraining } from "./support/progress";
import { createSchool, makeTeacher } from "./support/teacher";

// Faz 4 bitti ölçütü (öğrenci tarafı): öğrenci kodla sınıfa katılıyor, ödev öğrencinin ana
// sayfasında çıkıyor. Öğretmenin sayfaları ayrı testte; burada öğretmen, sınıf ve ödev doğrudan
// veritabanına yazılır.

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = () => Array.from({ length: 6 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join("");
const short = () => randomUUID().slice(0, 4).toUpperCase();
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;

type ClassroomSeed = {
  name?: string;
  archived?: boolean;
  /** Açık ödevin mahallesi (adres adı) ve son tarihi. */
  assignment?: { neighborhood: string; due: string | null };
  /** Sınıftaki başka öğrenciler (öğrenci bunları hiç görmemeli). */
  others?: string[];
};

/** Öğretmen (okuluyla), sınıf ve isteğe bağlı açık ödev. */
async function createClassroom({ name = `7-B ${short()}`, archived = false, assignment, others = [] }: ClassroomSeed = {}) {
  const teacherEmail = uniqueEmail("ogretmen");
  const teacherName = `Zeynep Kaya ${short()}`;
  const teacherId = newId();
  const classroomId = newId();
  const code = randomCode();
  await withDb((c) =>
    c.query(`INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "updatedAt") VALUES ($1, $2, $3, true, now())`, [teacherId, teacherName, teacherEmail]),
  );
  const school = await createSchool({ creatorEmail: teacherEmail });
  await makeTeacher(teacherEmail, school.id);
  await withDb(async (c) => {
    await c.query(`INSERT INTO "Classroom" ("id", "name", "level", "teacherId", "joinCode", "archived") VALUES ($1, $2, '7', $3, $4, $5)`, [
      classroomId,
      name,
      teacherId,
      code,
      archived,
    ]);
    if (assignment) {
      await c.query(
        `INSERT INTO "Assignment" ("id", "classroomId", "neighborhoodId", "dueDate") SELECT $1, $2, n.id, $3 FROM "Neighborhood" n WHERE n.slug = $4`,
        [newId(), classroomId, assignment.due, assignment.neighborhood],
      );
    }
    for (const other of others) {
      const id = newId();
      await c.query(`INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "updatedAt") VALUES ($1, $2, $3, true, now())`, [id, other, uniqueEmail("arkadas")]);
      await c.query(`INSERT INTO "ClassroomMembership" ("classroomId", "userId") VALUES ($1, $2)`, [classroomId, id]);
    }
  });
  return { id: classroomId, code, name, teacherName, schoolName: school.name };
}

async function membershipCount(email: string) {
  const result = await withDb((c) =>
    c.query<{ n: string }>(`SELECT count(*) AS n FROM "ClassroomMembership" m JOIN "User" u ON u.id = m."userId" WHERE u.email = $1`, [email]),
  );
  return Number(result?.rows[0]?.n ?? 0);
}

async function hasBadge(email: string, code: string) {
  const result = await withDb((c) =>
    c.query(`SELECT 1 FROM "EarnedBadge" b JOIN "User" u ON u.id = b."userId" WHERE u.email = $1 AND b."badgeCode" = $2`, [email, code]),
  );
  return (result?.rowCount ?? 0) > 0;
}

/** Bütün testler aynı IP'den katılır; IP başına sınır (join-class-ip) koşular arasında dolmasın. */
async function resetJoinIpLimit() {
  await withDb((c) => c.query(`DELETE FROM "RateLimit" WHERE "key" LIKE 'join-class-ip:%'`));
}

/** Ana sayfadaki sınıf kartı (masaüstünde sağ sütunda, telefonda "Bugün" şeridinde). */
const classCard = (page: Page) => page.getByRole("region", { name: "Sınıfın" }).filter({ visible: true });

async function joinFromCard(card: Locator, code: string) {
  await card.getByRole("button", { name: "Kod gir" }).click();
  await card.getByLabel("Sınıf kodu").fill(code);
  await card.getByRole("button", { name: "Katıl", exact: true }).click();
}

/** Profil > Sınıf; adresle gelince telefonda da bölümün sayfası kendiliğinden açılır. */
async function openClassSection(page: Page) {
  await page.goto("/profil?bolum=sinif");
  const section = page.getByRole("region", { name: "Sınıfın" }).filter({ visible: true });
  await expect(section).toBeVisible();
  return section;
}

test.describe("öğrencinin sınıfı", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");
  test.beforeEach(async () => {
    await resetJoinIpLimit();
  });

  test("ana sayfadaki kartla kodla katılır, ödev ana sayfada çıkar ve eğitim bitince ilerler", async ({ page }) => {
    const classroom = await createClassroom({ assignment: { neighborhood: "oltalama-limani", due: "2030-10-17T09:00:00Z" } });
    const email = uniqueEmail("sinif");
    await signUpVerified(page, email);

    const card = classCard(page);
    await expect(card.getByRole("heading")).toHaveText("Sınıfına katıl");
    await expect(card).toContainText("Öğretmeninin verdiği kodu gir");
    // Küçük harf ve tireyle yazılan kod da kabul edilir.
    await joinFromCard(card, `${classroom.code.slice(0, 3).toLowerCase()}-${classroom.code.slice(3)}`);

    await expect(card.getByRole("heading")).toHaveText(`${classroom.name} sınıfına katıldın`);
    await expect(card).toContainText(`Öğretmen: ${classroom.teacherName}`);
    await expect(card).toContainText("Öğretmenin sadece hangi odaları bitirdiğini görür. Raporların sende kalır.");

    const homework = card.getByRole("region", { name: "Ödev: Oltalama Limanı" });
    await expect(homework).toContainText("ÖĞRETMENİNİN VERDİĞİ ÖDEV");
    await expect(homework).toContainText(/0\/\d+ oda/);
    await expect(homework).toContainText("17 Ekim'e kadar · puanlanmaz, öğretmenin sadece bitirip bitirmediğini görür");
    await expect(homework.getByRole("link", { name: "Oltalama eğitim odası ile başla" })).toHaveAttribute("href", "/oda/oltalama-egitimi/oyna");
    expect(await membershipCount(email)).toBe(1);

    // Katılınca sayfa yeniden çizilir ve "Sınıf arkadaşı" rozeti yazılır.
    await expect.poll(() => hasBadge(email, "sinif-arkadasi")).toBe(true);

    // Eğitim labı bitince x/y bir artar ve düğme mahallenin sıradaki labına geçer.
    await completeTraining(email, "oltalama-egitimi");
    await page.reload();
    await expect(card.getByRole("heading")).toHaveText(`${classroom.name} sınıfındasın`);
    await expect(homework).toContainText(/1\/\d+ oda/);
    await expect(homework.getByRole("link", { name: /^Sıradaki: / })).toHaveAttribute("href", /^\/oda\/[a-z0-9-]+$/);
  });

  test("yanlış kod genel hata verir; arşivlenen sınıf da aynı; 10 denemeden sonra durur", async ({ page }) => {
    const archived = await createClassroom({ archived: true });
    const open = await createClassroom();
    await signUpVerified(page, uniqueEmail("yanlis"));
    const card = classCard(page);
    await card.getByRole("button", { name: "Kod gir" }).click();
    const input = card.getByLabel("Sınıf kodu");
    const join = card.getByRole("button", { name: "Katıl", exact: true });
    const notFound = "Bu kodla bir sınıf bulunamadı. Kodu öğretmeninden kontrol et.";

    // Eksik kod sunucuya gitmez.
    await input.fill("K7B");
    await join.click();
    await expect(card.getByRole("alert")).toHaveText("Sınıf kodu 6 karakterdir: harf ve rakam.");
    await expect(input).toHaveAttribute("aria-invalid", "true");

    await input.fill(archived.code);
    await join.click();
    await expect(card.getByRole("alert")).toHaveText(notFound);
    // Arşivlenen sınıfın adı hiçbir yerde görünmez.
    await expect(page.getByText(archived.name)).toHaveCount(0);

    for (let i = 0; i < 9; i++) {
      let wrong = randomCode();
      while (wrong === open.code || wrong === archived.code) wrong = randomCode();
      await input.fill(wrong);
      await join.click();
      await expect(card.getByRole("alert")).toHaveText(notFound);
      // Bir sonraki deneme aynı mesajı yeniden göstersin diye kutu değişince mesaj silinir.
      await input.fill("");
      await expect(card.getByRole("alert")).toHaveCount(0);
    }

    // 11. deneme doğru kodla bile durur.
    await input.fill(open.code);
    await join.click();
    await expect(card.getByRole("alert")).toHaveText(/^Çok fazla deneme yaptın\. \d+:\d\d sonra tekrar dene\.$/);
    await expect(card.getByRole("heading")).toHaveText("Sınıfına katıl");
  });

  test("bağlantıyla katılır: giriş yokken sınıfın adı görünmez, giriş yapıp sayfaya döner ve katılır", async ({ page }) => {
    const classroom = await createClassroom({ assignment: { neighborhood: "oltalama-limani", due: null } });
    const email = uniqueEmail("baglanti");
    await signUpVerified(page, email);
    await signOutHere(page.context());

    await page.goto(`/katil/${classroom.code}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText("Sınıfa katıl");
    await expect(main).toContainText(`Sınıf kodu: ${classroom.code}`);
    await expect(page.getByText(classroom.name)).toHaveCount(0);
    await expect(page.getByText(classroom.teacherName)).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Kayıt ol" })).toHaveAttribute("href", `/kayit?sonra=${encodeURIComponent(`/katil/${classroom.code}`)}`);
    await main.getByRole("link", { name: "Giriş yap" }).click();

    await page.waitForURL(/\/giris\?sonra=/);
    await signIn(page, email, strongPassword);
    await page.waitForURL(`/katil/${classroom.code}`);
    // Giriş yapmışken de sınıfın adı "Katıl"a basılmadan görünmez.
    await expect(page.getByText(classroom.name)).toHaveCount(0);
    await main.getByRole("button", { name: "Katıl", exact: true }).click();

    await expect(main.getByRole("status")).toContainText(`${classroom.name} sınıfına katıldın`);
    await expect(main.getByRole("status")).toContainText(`Öğretmen: ${classroom.teacherName} · ${classroom.schoolName}`);
    await main.getByRole("link", { name: "Ana sayfaya git" }).click();
    await page.waitForURL("/");
    await expect(classCard(page).getByRole("region", { name: "Ödev: Oltalama Limanı" })).toContainText("Puanlanmaz, öğretmenin sadece bitirip bitirmediğini görür");

    // Aynı bağlantı yeniden açılırsa "zaten bu sınıftasın".
    await page.goto(`/katil/${classroom.code}`);
    await page.getByRole("main").getByRole("button", { name: "Katıl", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(`Zaten ${classroom.name} sınıfındasın.`);
    expect(await membershipCount(email)).toBe(1);
  });

  test("bağlantıdan kayıt olan öğrenci doğrulamadan sonra sayfaya döner", async ({ page }) => {
    const classroom = await createClassroom();
    const email = uniqueEmail("kayitbag");
    await signUp(page, email, { next: `/katil/${classroom.code}` });
    await typeCode(page, await waitForCode(email));
    await page.getByRole("button", { name: "Doğrula", exact: true }).click();
    await page.waitForURL(`/katil/${classroom.code}`);
    await page.getByRole("main").getByRole("button", { name: "Katıl", exact: true }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(`${classroom.name} sınıfına katıldın`);
    expect(await membershipCount(email)).toBe(1);
  });

  test("e-postası doğrulanmamış öğrenci katılamaz; geçersiz bağlantı kodu söylenir", async ({ page }) => {
    const classroom = await createClassroom();
    const email = uniqueEmail("dogrulanmamis");
    await signUp(page, email);

    await page.goto("/");
    const card = classCard(page);
    await card.getByRole("button", { name: "Kod gir" }).click();
    await expect(card).toContainText("Sınıfa katılmak için önce e-posta adresini doğrula.");
    await expect(card.getByLabel("Sınıf kodu")).toHaveCount(0);
    await expect(card.getByRole("link", { name: "E-postamı doğrula" })).toHaveAttribute("href", "/dogrula?sonra=%2F");

    await page.goto(`/katil/${classroom.code}`);
    const main = page.getByRole("main");
    await expect(main).toContainText("Sınıfa katılmak için önce e-posta adresini doğrula. Doğrulayınca bu sayfaya dönersin.");
    await expect(main.getByRole("button", { name: "Katıl", exact: true })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "E-postamı doğrula" })).toHaveAttribute("href", `/dogrula?sonra=${encodeURIComponent(`/katil/${classroom.code}`)}`);
    expect(await membershipCount(email)).toBe(0);

    await page.goto("/katil/OLMAZ0");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Bu bağlantıdaki sınıf kodu geçersiz.");
  });

  test("profilden kodla katılır ve onayla sınıftan ayrılır; rozet ve hesap kalır", async ({ page }) => {
    const classroom = await createClassroom();
    const email = uniqueEmail("ayril");
    await signUpVerified(page, email);

    let section = await openClassSection(page);
    await expect(section).toContainText("Öğretmenin bir sınıf kodu verdiyse buradan katıl.");
    await expect(section).toContainText("Henüz bir sınıfa katılmadın.");
    await section.getByRole("button", { name: "Sınıf kodu gir" }).click();
    await section.getByLabel("Sınıf kodu").fill(classroom.code);
    await section.getByRole("button", { name: "Katıl", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: `${classroom.name} sınıfına katıldın`, visible: true })).toBeVisible();

    const row = section.getByRole("list", { name: "Sınıfların" }).getByRole("listitem");
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(`${classroom.name} · ${classroom.schoolName}`);
    await expect(row).toContainText(`Öğretmen: ${classroom.teacherName}`);
    await expect.poll(() => hasBadge(email, "sinif-arkadasi")).toBe(true);

    // Vazgeçince bir şey değişmez.
    await row.getByRole("button", { name: "Sınıftan ayrıl" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading")).toHaveText(`${classroom.name} sınıfından ayrılmak istiyor musun?`);
    await dialog.getByRole("button", { name: "Vazgeç" }).click();
    await expect(dialog).toBeHidden();
    expect(await membershipCount(email)).toBe(1);

    await row.getByRole("button", { name: "Sınıftan ayrıl" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Sınıftan ayrıl" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Sınıftan ayrıldın", visible: true })).toBeVisible();
    await expect(section).toContainText("Henüz bir sınıfa katılmadın.");
    expect(await membershipCount(email)).toBe(0);
    expect(await hasBadge(email, "sinif-arkadasi")).toBe(true);

    await page.goto("/");
    await expect(classCard(page).getByRole("heading")).toHaveText("Sınıfına katıl");
    section = await openClassSection(page);
    await expect(section).toContainText("Henüz bir sınıfa katılmadın.");
  });

  test("iki sınıftaki ödevler: geç kalan önce; öğrenci sınıftaki diğer öğrencileri görmez", async ({ page }) => {
    const secret = `Gizli Arkadaş ${short()}`;
    const first = await createClassroom({ assignment: { neighborhood: "oltalama-limani", due: "2030-10-17T09:00:00Z" }, others: [secret] });
    const second = await createClassroom({ assignment: { neighborhood: "oltalama-limani", due: "2020-01-05T09:00:00Z" }, others: [`${secret} 2`] });
    const email = uniqueEmail("iki");
    await signUpVerified(page, email);

    await joinFromCard(classCard(page), first.code);
    await expect(classCard(page).getByRole("heading")).toHaveText(`${first.name} sınıfına katıldın`);
    let section = await openClassSection(page);
    await section.getByRole("button", { name: "Başka bir sınıfa katıl" }).click();
    await section.getByLabel("Sınıf kodu").fill(second.code);
    await section.getByRole("button", { name: "Katıl", exact: true }).click();
    await expect(section.getByRole("list", { name: "Sınıfların" }).getByRole("listitem")).toHaveCount(2);

    await page.goto("/");
    const card = classCard(page);
    await expect(card.getByRole("heading")).toHaveText("2 sınıftasın");
    const boxes = card.getByRole("region", { name: "Ödev: Oltalama Limanı" });
    await expect(boxes).toHaveCount(2);
    await expect(boxes.first()).toContainText(`${second.name} · ${second.teacherName}`);
    await expect(boxes.first()).toContainText("Son tarih geçti (5 Ocak)");
    await expect(boxes.nth(1)).toContainText(`${first.name} · ${first.teacherName}`);
    await expect(boxes.nth(1)).toContainText("17 Ekim'e kadar");

    // Diğer öğrencilerin adı ne sayfada ne de sayfayla gelen veride var.
    expect(await page.content()).not.toContain(secret);
    section = await openClassSection(page);
    await expect(section.getByRole("list", { name: "Sınıfların" }).getByRole("listitem")).toHaveCount(2);
    expect(await page.content()).not.toContain(secret);
  });
});
