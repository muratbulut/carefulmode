import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page, type Request } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { makeAdmin } from "./support/admin";
import { withDb } from "./support/db";
import { mailOutboxDir } from "./support/outbox-dir";
import { createSchool, userIdOf } from "./support/teacher";

// Yönetim · Kullanıcılar: Yönetim ekibi sekmesi (?sekme=ekip), "Ekibe kişi ekle", "İzinleri
// düzenle" ve okullar görünümündeki (?gorunum=okullar) "Okul ekle" ile okul sorumlusu.
// Sorumlunun izinleri bir sonraki istekte geçerlidir; öğrenci hesabı yalnızca İpucu ve Gündem alır;
// ekip ve okul işlemlerini yalnızca yönetici yapabilir (elle hazırlanmış istekle de). Her işlem
// kayıt defterine yazılır ve 5 saniye içinde geri alınabilir. Giriş yapması gerekenler kayıt olur,
// diğer hesaplar veritabanına doğrudan yazılır.

// Geri al süresi 30 saniye; "ekibe eklendin" ve "okul sorumlusu oldun" mailleri 5 saniye sonra gider.
const mailDelayMs = 35_000;

const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });
const exactly = (text: string) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
/**
 * Öğrenci hesabının kişi aramasındaki adı: "Ad S." (lib/admin/users-model.ts shortName). Öğrenci
 * hesabı aramada yalnızca bu adla ya da e-postasının tamamıyla bulunur (güvenlik turu 4).
 */
const shortOf = (name: string) => {
  const words = name.trim().split(/\s+/);
  return words.length > 1 ? `${words[0]} ${Array.from(words[words.length - 1])[0].toLocaleUpperCase("tr")}.` : words[0];
};
const stamp = () => randomUUID().replace(/-/g, "").slice(0, 6);
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const notFoundHeading = "Bu sayfa yok";

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

const teamMails = async (email: string) => (await mailsTo(email)).filter((m) => /yönetim ekibine eklendin$/.test(m.subject));

async function query<T extends object>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await withDb(async (client) => (await client.query<T>(sql, params)).rows)) ?? [];
}

type Person = { id: string; email: string; name: string };

/** Doğrulanmış hesap (giriş yapmaz). birthYear yoksa yaşı bilinmeyen hesap (öğrenci sayılır). */
async function insertUser(
  name: string,
  { role = "STUDENT", schoolId = null, birthYear = 1990 }: { role?: "STUDENT" | "TEACHER"; schoolId?: string | null; birthYear?: number | null } = {},
): Promise<Person> {
  const id = newId();
  const email = uniqueEmail("ekip");
  await query(
    `INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "role", "schoolId", "birthYear", "updatedAt")
     VALUES ($1, $2, $3, true, $4, $5, $6, now())`,
    [id, name, email, role, schoolId, birthYear],
  );
  return { id, email, name };
}

/** Kayıt olur (yetişkin, 2000 doğumlu); görünen adı ayırt edilsin diye değiştirilir. */
async function signUpAs(page: Page, tag: string, name: string): Promise<Person> {
  const email = uniqueEmail(tag);
  await signUpVerified(page, email);
  await query(`UPDATE "User" SET "displayName" = $2 WHERE "email" = $1`, [email, name]);
  return { id: (await userIdOf(email))!, email, name };
}

async function signUpAdmin(page: Page, name: string): Promise<Person> {
  const admin = await signUpAs(page, "yonetici", name);
  await makeAdmin(admin.email);
  return admin;
}

async function grant(userId: string, permissions: string[], grantedById: string) {
  for (const permission of permissions) {
    await query(`INSERT INTO "TeamPermission" ("userId", "permission", "grantedById") VALUES ($1, $2::"TeamPermissionType", $3)`, [
      userId,
      permission,
      grantedById,
    ]);
  }
}

async function permissionsOf(userId: string) {
  const rows = await query<{ permission: string; grantedById: string }>(
    `SELECT "permission"::text AS "permission", "grantedById" FROM "TeamPermission" WHERE "userId" = $1 ORDER BY "permission"`,
    [userId],
  );
  return rows;
}

async function roleOf(userId: string) {
  return (await query<{ role: string; schoolId: string | null }>(`SELECT "role"::text AS "role", "schoolId" FROM "User" WHERE "id" = $1`, [userId]))[0];
}

async function schoolOf(id: string) {
  return (
    await query<{ coordinatorId: string | null; coordinatorApproves: boolean; createdById: string; name: string }>(
      `SELECT "coordinatorId", "coordinatorApproves", "createdById", "name" FROM "School" WHERE "id" = $1`,
      [id],
    )
  )[0];
}

async function schoolsNamed(name: string) {
  return query<{ id: string; createdById: string; coordinatorId: string | null }>(`SELECT "id", "createdById", "coordinatorId" FROM "School" WHERE "name" = $1`, [name]);
}

type Entry = { action: string; actorId: string; details: Record<string, unknown> };

/** Hedefin kayıt defteri girişleri, eskiden yeniye. */
async function auditOf(target: string): Promise<Entry[]> {
  return query<Entry>(`SELECT "action", "actorId", "details" FROM "AuditLog" WHERE "target" = $1 ORDER BY "createdAt", "id"`, [target]);
}

const teamPage = "/yonetim/kullanicilar?sekme=ekip";
const schoolsPage = "/yonetim/kullanicilar?gorunum=okullar";
// Okullar sayfalı ve ada göre sıralı: testin okulu ilk sayfada olmayabilir, adıyla aranır.
const schoolPage = (name: string) => `${schoolsPage}&ara=${encodeURIComponent(name)}`;

/** "Ekibe kişi ekle" penceresini açar (başlıktaki düğme ya da sekmedeki kart; ikisi aynı pencere). */
async function openAddDialog(page: Page) {
  await page.getByRole("button", { name: "Ekibe kişi ekle" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Ekibe kişi ekle" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Penceredeki aramaya yazar ve kişiyi seçer. */
async function pickPerson(dialog: Locator, search: string, name: string) {
  await dialog.getByRole("searchbox").fill(search);
  const person = dialog.getByRole("radio", { name: exactly(name) });
  await person.click();
  await expect(person).toHaveAttribute("aria-checked", "true");
}

async function openEditDialog(page: Page, name: string) {
  await page.getByRole("button", { name: `İzinleri düzenle: ${name}` }).click();
  const dialog = page.getByRole("dialog", { name: "İzinler" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Sayfanın ana başlığı (izinsiz sayfada "Bu sayfa yok"). */
async function expectHeading(page: Page, path: string, heading: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
}

// ---------------------------------------------------------------------------------------
// Elle hazırlanmış istek: yöneticinin gönderdiği sunucu eylemi isteği yakalanır, sonra başka
// bir hesabın oturumuyla (ya da gövdesi değiştirilerek) yeniden gönderilir.
// ---------------------------------------------------------------------------------------

type Captured = { url: string; headers: Record<string, string>; body: string };

const isAction = (r: Request) => r.method() === "POST" && !!r.headers()["next-action"];

async function capture(page: Page, match: (body: string) => boolean, trigger: () => Promise<unknown>): Promise<Captured> {
  const waiting = page.waitForRequest((r) => isAction(r) && match(r.postData() ?? ""));
  await trigger();
  const request = await waiting;
  const all = await request.allHeaders();
  const headers: Record<string, string> = {};
  for (const name of ["next-action", "next-router-state-tree", "content-type", "accept"]) if (all[name]) headers[name] = all[name];
  return { url: request.url(), headers, body: request.postData() ?? "" };
}

/** Yakalanan isteği bu tarayıcı bağlamının oturumuyla yeniden gönderir; cevabın metni. */
async function replay(context: BrowserContext, baseURL: string, captured: Captured, body = captured.body) {
  const response = await context.request.post(captured.url, { headers: { ...captured.headers, origin: baseURL }, data: body });
  return response.text();
}

/** Sayfanın gönderdiği sunucu eylemi isteklerinin gövdesini değiştirir (yalnızca `match` olanları). */
async function rewriteActions(page: Page, match: (body: string) => boolean, rewrite: (body: string) => string) {
  const answers: string[] = [];
  await page.route(/\/yonetim\/kullanicilar/, async (route) => {
    const request = route.request();
    const body = request.postData() ?? "";
    if (!isAction(request) || !match(body)) return route.fallback();
    const response = await route.fetch({ postData: rewrite(body) });
    answers.push(await response.text());
    await route.fulfill({ response });
  });
  return answers;
}

test("giriş yapmamış ziyaretçi Kullanıcılar yerine girişe gönderilir", async ({ page }) => {
  await page.goto(teamPage);
  await expect(page).toHaveURL(/\/giris\?sonra=/);
});

test.describe("yönetim ekibi ve okullar", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  // Faz 5 bitti ölçütü: yönetici ekibe sorumlu ekler; sorumlu yalnızca izinli sayfayı görür ve izin
  // değişikliği bir sonraki istekte geçerlidir; kişiye "ekibe eklendin" maili geri al süresinden sonra gider.
  test("yönetici yetişkin üyeyi Gündem izniyle sorumlu yapar; sorumlu yalnızca izinli sayfaları görür", async ({ page, browser, baseURL }) => {
    test.setTimeout(180_000);
    const tag = stamp();
    const admin = await signUpAdmin(page, `Ayla Yönetici ${tag}`);
    const memberContext = await browser.newContext({ baseURL, locale: "tr-TR" });
    const memberPage = await memberContext.newPage();
    const member = await signUpAs(memberPage, "sorumlu", `Mert Sorumlu ${tag}`);

    // Yönetim ekibi sekmesi: kendi kartında "sen", düzenleme yok; kayıt defterine bağlantı.
    await page.goto(teamPage);
    const own = page.getByRole("article", { name: admin.name });
    await expect(own).toContainText("Yönetici");
    await expect(own).toContainText("sen");
    await expect(own.getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Ekibin yaptıkları kayıt defterinde" })).toHaveAttribute("href", "/yonetim/kayit-defteri");

    // Ekibe ekle: e-postasıyla bulunur, Sorumlu (varsayılan), yalnızca Gündem.
    const dialog = await openAddDialog(page);
    await pickPerson(dialog, member.email, member.name);
    await expect(dialog.getByRole("radio", { name: /^Sorumlu/ })).toHaveAttribute("aria-checked", "true");
    await expect(dialog.getByRole("checkbox", { name: /^Öğretmen talepleri/ })).toBeEnabled();
    await dialog.getByRole("checkbox", { name: /^Gündem/ }).click();
    await dialog.getByRole("button", { name: "Ekibe ekle" }).click();
    await expect(toast(page, `${member.name} ekibe eklendi. Kişiye e-posta gidecek.`)).toBeVisible();
    await expect(dialog).toBeHidden();
    const addedAt = Date.now();

    expect(await permissionsOf(member.id)).toEqual([{ permission: "NEWS", grantedById: admin.id }]);
    expect((await roleOf(member.id)).role).toBe("STUDENT");
    const added = (await auditOf(`user:${member.id}`)).at(-1)!;
    expect(added).toMatchObject({ action: "team.added", actorId: admin.id, details: { role: "MEMBER", permissions: ["NEWS"], previousRole: "STUDENT" } });
    // Mail geri al süresi bitmeden gitmez.
    expect(await teamMails(member.email)).toHaveLength(0);

    const card = page.getByRole("article", { name: member.name });
    await expect(card).toContainText("Sorumlu");
    await expect(card.getByRole("list", { name: "İzinler" })).toHaveText("Gündem");

    // Sorumlu: Gündem açık; lablar, talepler, kayıt defteri ve kullanıcılar "Bu sayfa yok".
    await expectHeading(memberPage, "/yonetim/gundem", "Gündem");
    for (const path of ["/yonetim/odalar", "/yonetim/talepler", "/yonetim/kayit-defteri", "/yonetim/kullanicilar", teamPage]) {
      await expectHeading(memberPage, path, notFoundHeading);
    }

    // İzinleri düzenle: Gündem kapanır, Günün ipucu açılır; bir sonraki istekte geçerli.
    let edit = await openEditDialog(page, member.name);
    await edit.getByRole("switch", { name: /^Gündem/ }).click();
    await edit.getByRole("switch", { name: /^Günün ipucu/ }).click();
    await edit.getByRole("button", { name: "Kaydet" }).click();
    await expect(toast(page, `${member.name} için izinler kaydedildi.`)).toBeVisible();
    expect(await permissionsOf(member.id)).toEqual([{ permission: "TIPS", grantedById: admin.id }]);
    expect((await auditOf(`user:${member.id}`)).at(-1)).toMatchObject({
      action: "team.permissions_changed",
      actorId: admin.id,
      details: { before: { role: "MEMBER", permissions: ["NEWS"] }, after: { role: "MEMBER", permissions: ["TIPS"] }, added: ["TIPS"], removed: ["NEWS"] },
    });
    await expectHeading(memberPage, "/yonetim/gundem", notFoundHeading);
    await expectHeading(memberPage, "/yonetim/ipucu", "Günün ipucu");

    // Ekipten çıkar ve geri al: izinleri (ekleyeniyle) geri gelir.
    edit = await openEditDialog(page, member.name);
    await edit.getByRole("button", { name: "Ekipten çıkar" }).click();
    await expect(edit).toContainText(`${member.name} ekipten çıkarılsın mı?`);
    await edit.getByRole("button", { name: "Çıkar", exact: true }).click();
    const removed = toast(page, `${member.name} ekipten çıkarıldı.`);
    await expect(removed).toBeVisible();
    expect(await permissionsOf(member.id)).toEqual([]);
    await expect(page.getByRole("article", { name: member.name })).toHaveCount(0);
    await expectHeading(memberPage, "/yonetim/ipucu", notFoundHeading);
    await removed.getByRole("button", { name: "Geri al" }).click();
    await expect(toast(page, "Geri alındı.")).toBeVisible();
    expect(await permissionsOf(member.id)).toEqual([{ permission: "TIPS", grantedById: admin.id }]);
    await expect(page.getByRole("article", { name: member.name })).toBeVisible();
    await expectHeading(memberPage, "/yonetim/ipucu", "Günün ipucu");
    const entries = await auditOf(`user:${member.id}`);
    expect(entries.map((e) => e.action)).toEqual(["team.added", "team.permissions_changed", "team.removed", "team.added"]);
    expect(entries[2]).toMatchObject({ actorId: admin.id, details: { role: "MEMBER", permissions: ["TIPS"] } });
    expect(entries[3]).toMatchObject({ actorId: admin.id, details: { undo: true } });

    // "Ekibe eklendin" maili: geri al süresinden sonra, bir kez; bağlantı yönetim paneline.
    await expect.poll(async () => (await teamMails(member.email)).length, { timeout: Math.max(15_000, mailDelayMs + 30_000 - (Date.now() - addedAt)) }).toBe(1);
    const [mail] = await teamMails(member.email);
    expect(mail.text).toContain(`${admin.name} seni`);
    expect(mail.text).toContain("sorumlu olarak ekledi");
    expect(mail.text).toContain("Günün ipucu");
    expect(mail.text).toContain(`${baseURL}/yonetim`);
    await memberContext.close();
  });

  test("öğrenci hesabı yalnızca İpucu ve Gündem alır, yönetici yapılamaz; elle hazırlanmış istek de geri çevrilir", async ({ page }) => {
    test.setTimeout(150_000);
    const tag = stamp();
    const admin = await signUpAdmin(page, `Ali Yönetici ${tag}`);
    // 13 yaşında öğrenci hesabı.
    const student = await insertUser(`Deniz Öğrenci ${tag}`, { birthYear: new Date().getFullYear() - 13 });

    await page.goto(teamPage);
    const dialog = await openAddDialog(page);
    // Öğrenci hesabı e-postasının tamamıyla bulunur ve "Ad S." olarak görünür.
    await pickPerson(dialog, student.email, shortOf(student.name));
    await expect(dialog).toContainText("Öğrenci hesabı.");
    await expect(dialog.getByRole("radio", { name: /^Yönetici/ })).toBeDisabled();
    for (const name of [/^Öğretmen talepleri/, /^Oda ekleme/, /^Oda yayınlama/, /^Kayıt defteri/]) {
      await expect(dialog.getByRole("checkbox", { name })).toBeDisabled();
    }
    await dialog.getByRole("checkbox", { name: /^Günün ipucu/ }).click();

    // İstek elle değiştirilir: önce yönetici rolü, sonra Öğretmen talepleri, sonra Kullanıcılar ve roller.
    let rewrite = (body: string) => body.replace('"role":"MEMBER"', '"role":"ADMIN"');
    const answers = await rewriteActions(
      page,
      (body) => body.includes('"permissions"'),
      (body) => rewrite(body),
    );
    const submit = dialog.getByRole("button", { name: "Ekibe ekle" });
    await submit.click();
    await expect(dialog.getByRole("alert")).toHaveText("Öğrenci hesabı yönetici olamaz.");
    rewrite = (body) => body.replace('"TIPS"', '"APPLICATIONS"');
    await submit.click();
    await expect(dialog.getByRole("alert")).toHaveText("Bu izinlerden biri bu kişiye verilemez.");
    rewrite = (body) => body.replace('["TIPS"]', '["TIPS","ROLES"]');
    await submit.click();
    await expect.poll(() => answers.length).toBe(3);
    await expect(dialog.getByRole("alert")).toHaveText("Bu izinlerden biri bu kişiye verilemez.");
    expect(answers[0]).toContain('"studentAccount"');
    expect(answers[1]).toContain('"permissionNotAllowed"');
    expect(answers[2]).toContain('"permissionNotAllowed"');
    expect(await roleOf(student.id)).toMatchObject({ role: "STUDENT" });
    expect(await permissionsOf(student.id)).toEqual([]);
    expect(await auditOf(`user:${student.id}`)).toEqual([]);

    // Değiştirilmemiş istek: Sorumlu · öğrenci, yalnızca Günün ipucu. Sonra geri alınır.
    await page.unrouteAll();
    await submit.click();
    const added = toast(page, `${student.name} ekibe eklendi.`);
    await expect(added).toBeVisible();
    const addedAt = Date.now();
    expect(await permissionsOf(student.id)).toEqual([{ permission: "TIPS", grantedById: admin.id }]);
    await expect(page.getByRole("article", { name: student.name })).toContainText("Sorumlu · öğrenci");
    await added.getByRole("button", { name: "Geri al" }).click();
    await expect(toast(page, "Geri alındı.")).toBeVisible();
    expect(await permissionsOf(student.id)).toEqual([]);
    await expect(page.getByRole("article", { name: student.name })).toHaveCount(0);
    const entries = await auditOf(`user:${student.id}`);
    expect(entries.map((e) => e.action)).toEqual(["team.added", "team.removed"]);
    expect(entries[0]).toMatchObject({ actorId: admin.id, details: { role: "MEMBER", permissions: ["TIPS"], studentAccount: true } });
    expect(entries[1]).toMatchObject({ actorId: admin.id, details: { undo: true } });

    // Geri alınan ekleme mail göndermez (geri al süresi bittikten sonra da).
    await page.waitForTimeout(Math.max(0, mailDelayMs + 5_000 - (Date.now() - addedAt)));
    expect(await teamMails(student.email)).toHaveLength(0);
  });

  test("yönetici kendini çıkaramaz; sorumluyu yönetici yapar, geri sorumlu yapar ve geri alır", async ({ page }) => {
    const tag = stamp();
    const admin = await signUpAdmin(page, `Ece Yönetici ${tag}`);
    const target = await insertUser(`Kaan Sorumlu ${tag}`);
    await grant(target.id, ["NEWS"], admin.id);

    await page.goto(teamPage);
    const edit = await openEditDialog(page, target.name);

    // Kişinin kimliği kendi kimliğiyle değiştirilir: kendini çıkarma ve kendi rolünü değiştirme.
    const answers = await rewriteActions(
      page,
      (body) => body.includes(target.id),
      (body) => body.replaceAll(target.id, admin.id),
    );
    await edit.getByRole("button", { name: "Ekipten çıkar" }).click();
    await edit.getByRole("button", { name: "Çıkar", exact: true }).click();
    await expect(edit.getByRole("alert")).toHaveText("Kendi rolünü ve izinlerini değiştiremezsin.");
    await edit.getByRole("button", { name: "Vazgeç" }).click();
    await edit.getByRole("radio", { name: "Sorumlu" }).click();
    await edit.getByRole("switch", { name: /^Günün ipucu/ }).click();
    await edit.getByRole("button", { name: "Kaydet" }).click();
    await expect.poll(() => answers.length).toBe(2);
    await expect(edit.getByRole("alert")).toHaveText("Kendi rolünü ve izinlerini değiştiremezsin.");
    for (const answer of answers) expect(answer).toContain('"self"');
    expect(await roleOf(admin.id)).toMatchObject({ role: "ADMIN" });
    expect(await auditOf(`user:${admin.id}`)).toEqual([]);
    await page.unrouteAll();
    await edit.getByRole("button", { name: "Vazgeç" }).click();
    await expect(edit).toBeHidden();

    // Sorumlu → Yönetici: rolü ADMIN olur, izin satırları silinir (yönetici her şeyi yapar).
    let dialog = await openEditDialog(page, target.name);
    await dialog.getByRole("radio", { name: "Yönetici" }).click();
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(dialog).toBeHidden();
    await expect(toast(page, `${target.name} için izinler kaydedildi.`)).toBeVisible();
    expect(await roleOf(target.id)).toMatchObject({ role: "ADMIN" });
    expect(await permissionsOf(target.id)).toEqual([]);
    await expect(page.getByRole("article", { name: target.name })).toContainText("Her şeyi yapar");
    expect((await auditOf(`user:${target.id}`)).at(-1)).toMatchObject({
      action: "team.permissions_changed",
      actorId: admin.id,
      details: { before: { role: "MEMBER", permissions: ["NEWS"] }, after: { role: "ADMIN", permissions: [] }, previousRole: "STUDENT", newRole: "ADMIN" },
    });

    // Yönetici → Sorumlu (Gündem): önceki rolüne (üye) döner; sonra geri alınır.
    dialog = await openEditDialog(page, target.name);
    await dialog.getByRole("radio", { name: "Sorumlu" }).click();
    await dialog.getByRole("switch", { name: /^Gündem/ }).click();
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(dialog).toBeHidden();
    const saved = toast(page, `${target.name} için izinler kaydedildi.`);
    await expect(saved).toBeVisible();
    expect(await roleOf(target.id)).toMatchObject({ role: "STUDENT" });
    expect(await permissionsOf(target.id)).toEqual([{ permission: "NEWS", grantedById: admin.id }]);
    await saved.getByRole("button", { name: "Geri al" }).click();
    await expect(toast(page, "Geri alındı.")).toBeVisible();
    expect(await roleOf(target.id)).toMatchObject({ role: "ADMIN" });
    expect(await permissionsOf(target.id)).toEqual([]);
    const entries = await auditOf(`user:${target.id}`);
    expect(entries.map((e) => e.action)).toEqual(["team.permissions_changed", "team.permissions_changed", "team.permissions_changed"]);
    expect(entries[1]).toMatchObject({ details: { after: { role: "MEMBER", permissions: ["NEWS"] }, previousRole: "ADMIN", newRole: "STUDENT" } });
    expect(entries[2]).toMatchObject({ actorId: admin.id, details: { undo: true, after: { role: "ADMIN" }, newRole: "ADMIN" } });
  });

  test("yönetici olmayan, öbür bütün izinleri olan kişi ekip ve okul işlemlerini elle hazırlanmış istekle de yapamaz", async ({ page, browser, baseURL }) => {
    test.setTimeout(150_000);
    const tag = stamp();
    const admin = await signUpAdmin(page, `Oya Yönetici ${tag}`);
    const target = await insertUser(`Hedef Kişi ${tag}`);
    const school = await createSchool({ name: `Ceviz ${tag} Ortaokulu`, province: "Sinop", district: "Gerze", creatorEmail: admin.email });
    const teacher = await insertUser(`Okul Öğretmeni ${tag}`, { role: "TEACHER", schoolId: school.id });

    // Öbür kişi: bütün izin satırları var, ROLES dahil (bir yolla yazılmış gibi); yine de yönetici değil.
    const otherContext = await browser.newContext({ baseURL, locale: "tr-TR" });
    const otherPage = await otherContext.newPage();
    const other = await signUpAs(otherPage, "izinli", `Tüm İzinli ${tag}`);
    await grant(other.id, ["APPLICATIONS", "LAB_EDITING", "LAB_PUBLISHING", "TIPS", "NEWS", "AUDIT_LOG", "ROLES"], admin.id);
    await otherPage.goto("/yonetim/odalar");
    await expect(otherPage.getByRole("heading", { level: 1 })).not.toHaveText(notFoundHeading);
    await expectHeading(otherPage, teamPage, notFoundHeading);
    await expectHeading(otherPage, schoolsPage, notFoundHeading);

    // Yöneticinin istekleri yakalanır: arama, ekle, geri al, düzenle, çıkar.
    await page.goto(teamPage);
    let dialog = await openAddDialog(page);
    const search = await capture(
      page,
      (b) => b.includes(tag) && !b.includes("permissions"),
      () => dialog.getByRole("searchbox").fill(target.name),
    );
    await dialog.getByRole("radio", { name: exactly(target.name) }).click();
    await dialog.getByRole("checkbox", { name: /^Gündem/ }).click();
    const add = await capture(page, (b) => b.includes('"permissions"'), () => dialog.getByRole("button", { name: "Ekibe ekle" }).click());
    const undo = await capture(page, (b) => b.includes('"op"'), () => toast(page, "ekibe eklendi").getByRole("button", { name: "Geri al" }).click());
    await expect(toast(page, "Geri alındı.")).toBeVisible();
    dialog = await openAddDialog(page);
    await pickPerson(dialog, target.name, target.name);
    await dialog.getByRole("checkbox", { name: /^Gündem/ }).click();
    await dialog.getByRole("button", { name: "Ekibe ekle" }).click();
    await expect(toast(page, "ekibe eklendi")).toBeVisible();
    let edit = await openEditDialog(page, target.name);
    await edit.getByRole("switch", { name: /^Günün ipucu/ }).click();
    const update = await capture(page, (b) => b.includes('"permissions"'), () => edit.getByRole("button", { name: "Kaydet" }).click());
    await expect(toast(page, "izinler kaydedildi")).toBeVisible();
    edit = await openEditDialog(page, target.name);
    await edit.getByRole("button", { name: "Ekipten çıkar" }).click();
    const remove = await capture(page, (b) => b === JSON.stringify([target.id]), () => edit.getByRole("button", { name: "Çıkar", exact: true }).click());
    await expect(toast(page, "ekipten çıkarıldı")).toBeVisible();
    expect(await permissionsOf(target.id)).toEqual([]);

    // Okullar: ilçedeki okullar, okul ekle, geri al, sorumlu adayları, ata, kaldır.
    await page.goto(schoolsPage);
    await page.getByRole("button", { name: "Okul ekle" }).first().click();
    const schoolDialog = page.getByRole("dialog", { name: "Okul ekle" });
    await schoolDialog.getByLabel("İl", { exact: true }).selectOption("Sinop");
    const district = await capture(
      page,
      (b) => b.startsWith('["Sinop"'),
      () => schoolDialog.getByLabel("İlçe", { exact: true }).selectOption("Gerze"),
    );
    const newName = `Nar ${tag} İlkokulu`;
    await schoolDialog.getByLabel("Okulun adı").fill(newName);
    const create = await capture(page, (b) => b.includes('"confirmSimilar"'), () => schoolDialog.getByRole("button", { name: "Okulu ekle" }).click());
    const created = toast(page, `${newName} eklendi.`);
    const undoSchool = await capture(page, (b) => b.includes('"op"'), () => created.getByRole("button", { name: "Geri al" }).click());
    await expect(toast(page, "Geri alındı.")).toBeVisible();
    expect(await schoolsNamed(newName)).toEqual([]);

    await page.goto(schoolPage(school.name));
    const searchCoordinators = await capture(
      page,
      (b) => b.includes('"schoolId"') && b.includes('"query"'),
      () => page.getByRole("button", { name: `Sorumlu ata: ${school.name}` }).click(),
    );
    const coordinatorDialog = page.getByRole("dialog", { name: `Okul sorumlusu · ${school.name}` });
    await coordinatorDialog.getByRole("radio", { name: exactly(teacher.name) }).click();
    const setCoordinator = await capture(
      page,
      (b) => b.includes('"coordinatorApproves"'),
      () => coordinatorDialog.getByRole("button", { name: "Sorumlu yap" }).click(),
    );
    await expect(toast(page, "okul sorumlusu.")).toBeVisible();
    await page.getByRole("button", { name: `Okul sorumlusunu değiştir: ${school.name}` }).click();
    const removeCoordinator = await capture(
      page,
      (b) => b === JSON.stringify([school.id]),
      () => coordinatorDialog.getByRole("button", { name: "Sorumluyu kaldır" }).click(),
    );
    await expect(toast(page, "okul sorumlusu kaldırıldı.")).toBeVisible();
    expect((await schoolOf(school.id)).coordinatorId).toBeNull();

    // Öbür kişinin oturumuyla aynı istekler: hepsi "forbidden", hiçbir şey değişmez.
    const forbidden = '"error":"forbidden"';
    for (const captured of [search, add, undo, update, remove, district, create, undoSchool, searchCoordinators, setCoordinator]) {
      expect(await replay(otherContext, baseURL!, captured)).toContain(forbidden);
    }
    // Kendini yönetici yapmayı da deneyemez.
    const selfAdmin = add.body.replace(target.id, other.id).replace('"role":"MEMBER"', '"role":"ADMIN"');
    expect(await replay(otherContext, baseURL!, add, selfAdmin)).toContain(forbidden);
    // Sorumlusu olan okulda "Sorumluyu kaldır".
    await query(`UPDATE "School" SET "coordinatorId" = $2 WHERE "id" = $1`, [school.id, teacher.id]);
    expect(await replay(otherContext, baseURL!, removeCoordinator)).toContain(forbidden);

    expect(await permissionsOf(target.id)).toEqual([]);
    expect(await roleOf(other.id)).toMatchObject({ role: "STUDENT" });
    expect(await schoolsNamed(newName)).toEqual([]);
    expect((await schoolOf(school.id)).coordinatorId).toBe(teacher.id);
    expect(await query(`SELECT 1 FROM "AuditLog" WHERE "actorId" = $1`, [other.id])).toEqual([]);
    await otherContext.close();
  });

  test("Okul ekle: aynı adlı okul eklenmez, benzer adda uyarı ve 'Yine de ekle'; ekleme geri alınır", async ({ page }) => {
    const tag = stamp();
    const admin = await signUpAdmin(page, `Can Yönetici ${tag}`);
    const existing = await createSchool({ name: `Zeytin ${tag} Ortaokulu`, province: "Sinop", district: "Gerze", creatorEmail: admin.email });

    await page.goto(schoolsPage);
    await page.getByRole("button", { name: "Okul ekle" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Okul ekle" });
    await dialog.getByLabel("İl", { exact: true }).selectOption("Sinop");
    await dialog.getByLabel("İlçe", { exact: true }).selectOption("Gerze");
    const name = dialog.getByLabel("Okulun adı");

    // Birebir aynısı (büyük-küçük harf ve boşluk farkı sayılmaz): hemen söylenir.
    await name.fill(`zeytin ${tag}   ortaokulu`);
    await expect(dialog.getByRole("alert")).toHaveText("Bu ilçede bu adla bir okul zaten var.");

    // Sunucu da denetler: başka bir ad yazılıp istek elle aynı adla gönderilir.
    const other = `Badem ${tag} Ortaokulu`;
    const answers = await rewriteActions(
      page,
      (body) => body.includes('"confirmSimilar"'),
      (body) => body.replace(other, existing.name),
    );
    await name.fill(other);
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Okulu ekle" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Bu ilçede bu adla bir okul zaten var.");
    expect(answers[0]).toContain('"duplicate"');
    await page.unrouteAll();
    expect(await schoolsNamed(other)).toEqual([]);
    expect(await query(`SELECT 1 FROM "School" WHERE "province" = 'Sinop' AND "district" = 'Gerze' AND "nameKey" = $1`, [existing.name.toLocaleLowerCase("tr")])).toHaveLength(1);

    // Benzer ad: sarı uyarı ve "Yine de ekle". Onaysız istek sunucuda da geri çevrilir.
    const similar = `Zeytin ${tag} Anadolu Lisesi`;
    const unconfirmed = await rewriteActions(
      page,
      (body) => body.includes('"confirmSimilar":true'),
      (body) => body.replace('"confirmSimilar":true', '"confirmSimilar":false'),
    );
    await name.fill(similar);
    const warning = dialog.getByRole("note");
    await expect(warning).toContainText("Bu ilçede benzer bir okul var:");
    await expect(warning).toContainText(existing.name);
    await dialog.getByRole("button", { name: "Yine de ekle" }).click();
    await expect.poll(() => unconfirmed.length).toBe(1);
    expect(unconfirmed[0]).toContain('"similar"');
    expect(await schoolsNamed(similar)).toEqual([]);
    await page.unrouteAll();
    await dialog.getByRole("button", { name: "Yine de ekle" }).click();
    await expect(toast(page, `${similar} eklendi.`)).toBeVisible();
    await expect(dialog).toBeHidden();
    const [row] = await schoolsNamed(similar);
    expect(row).toMatchObject({ createdById: admin.id, coordinatorId: null });
    expect(await auditOf(`school:${row.id}`)).toEqual([
      {
        action: "school.created",
        actorId: admin.id,
        details: expect.objectContaining({ name: similar, province: "Sinop", district: "Gerze", similar: [existing.name] }),
      },
    ]);

    // Yeni okul ve "Geri al": okul silinir, silindiği kayda yazılır.
    const fresh = `Kiraz ${tag} İlkokulu`;
    await page.getByRole("button", { name: "Okul ekle" }).first().click();
    await dialog.getByLabel("İl", { exact: true }).selectOption("Sinop");
    await dialog.getByLabel("İlçe", { exact: true }).selectOption("Gerze");
    await dialog.getByLabel("Okulun adı").fill(fresh);
    await dialog.getByRole("button", { name: "Okulu ekle" }).click();
    const created = toast(page, `${fresh} eklendi.`);
    await expect(created).toBeVisible();
    const [freshRow] = await schoolsNamed(fresh);
    expect(freshRow).toBeTruthy();
    await created.getByRole("button", { name: "Geri al" }).click();
    await expect(toast(page, "Geri alındı.")).toBeVisible();
    expect(await schoolsNamed(fresh)).toEqual([]);
    const entries = await auditOf(`school:${freshRow.id}`);
    expect(entries.map((e) => e.action)).toEqual(["school.created", "school.updated"]);
    expect(entries[1]).toMatchObject({ actorId: admin.id, details: { undo: true, change: "deleted", name: fresh } });
  });

  test("okul sorumlusu atanır, değiştirilir, kaldırılır ve geri alınır; öğrenci sorumlu olamaz", async ({ page }) => {
    test.setTimeout(150_000);
    const tag = stamp();
    const admin = await signUpAdmin(page, `Nur Yönetici ${tag}`);
    const school = await createSchool({ name: `Kestane ${tag} Ortaokulu`, province: "Sinop", district: "Boyabat", creatorEmail: admin.email });
    const first = await insertUser(`Aylin Öğretmen ${tag}`, { role: "TEACHER", schoolId: school.id });
    const second = await insertUser(`Bora Öğretmen ${tag}`, { role: "TEACHER" });
    const student = await insertUser(`Ece Öğrenci ${tag}`, { birthYear: new Date().getFullYear() - 12 });
    const target = `school:${school.id}`;

    await page.goto(schoolPage(school.name));
    const dialog = page.getByRole("dialog", { name: `Okul sorumlusu · ${school.name}` });
    const assign = page.getByRole("button", { name: `Sorumlu ata: ${school.name}` });
    const change = page.getByRole("button", { name: `Okul sorumlusunu değiştir: ${school.name}` });

    // Ata (okulun öğretmenleri listede) ve geri al.
    await assign.click();
    await dialog.getByRole("radio", { name: exactly(first.name) }).click();
    await dialog.getByRole("button", { name: "Sorumlu yap" }).click();
    const set = toast(page, `${first.name} artık ${school.name} okul sorumlusu.`);
    await expect(set).toBeVisible();
    expect((await schoolOf(school.id)).coordinatorId).toBe(first.id);
    await set.getByRole("button", { name: "Geri al" }).click();
    await expect(toast(page, "Geri alındı.")).toBeVisible();
    expect((await schoolOf(school.id)).coordinatorId).toBeNull();
    let entries = await auditOf(target);
    expect(entries.map((e) => e.action)).toEqual(["school.coordinator_set", "school.coordinator_removed"]);
    expect(entries[0]).toMatchObject({ actorId: admin.id, details: { userId: first.id, previousCoordinatorId: null, schoolIdSet: false } });
    expect(entries[1]).toMatchObject({ actorId: admin.id, details: { undo: true, userId: first.id } });

    await assign.click();
    await dialog.getByRole("radio", { name: exactly(first.name) }).click();
    await dialog.getByRole("button", { name: "Sorumlu yap" }).click();
    await expect(toast(page, `${first.name} artık ${school.name} okul sorumlusu.`)).toBeVisible();

    // Değiştir: şu anki sorumlu başta; öğrenci aranabilir ama seçilince neden olamayacağı yazılır.
    await change.click();
    await expect(dialog.getByRole("radio", { name: exactly(first.name) })).toContainText("Şu anki sorumlu");
    await dialog.getByRole("searchbox").fill(student.email);
    await dialog.getByRole("radio", { name: exactly(shortOf(student.name)) }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Öğrenci hesabı okul sorumlusu olamaz.");

    // Okulu olmayan öğretmen seçilir; istek elle öğrenciyle değiştirilirse sunucu geri çevirir.
    await dialog.getByRole("searchbox").fill(second.name);
    await dialog.getByRole("radio", { name: exactly(second.name) }).click();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    const answers = await rewriteActions(
      page,
      (body) => body.includes('"coordinatorApproves"'),
      (body) => body.replace(second.id, student.id),
    );
    await dialog.getByRole("button", { name: "Sorumlu yap" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Öğrenci hesabı okul sorumlusu olamaz.");
    expect(answers[0]).toContain('"studentAccount"');
    expect((await schoolOf(school.id)).coordinatorId).toBe(first.id);
    await page.unrouteAll();
    await dialog.getByRole("button", { name: "Sorumlu yap" }).click();
    await expect(toast(page, `${second.name} artık ${school.name} okul sorumlusu.`)).toBeVisible();
    const secondSetAt = Date.now();
    expect((await schoolOf(school.id)).coordinatorId).toBe(second.id);
    // Okulu olmayan öğretmenin okulu bu okul olur.
    expect(await roleOf(second.id)).toMatchObject({ role: "TEACHER", schoolId: school.id });
    expect((await auditOf(target)).at(-1)).toMatchObject({
      action: "school.coordinator_set",
      details: { userId: second.id, previousCoordinatorId: first.id, schoolIdSet: true },
    });

    // Kendi okulunun taleplerini onaylayabilir seçeneği kapanır.
    await change.click();
    await dialog.getByRole("checkbox", { name: /^Kendi okulundan gelen/ }).click();
    await dialog.getByRole("button", { name: "Kaydet" }).click();
    await expect(toast(page, `${school.name}: talepleri artık sen onaylarsın, sorumlu sadece görür.`)).toBeVisible();
    expect(await schoolOf(school.id)).toMatchObject({ coordinatorId: second.id, coordinatorApproves: false });
    expect((await auditOf(target)).at(-1)).toMatchObject({
      action: "school.updated",
      details: { field: "coordinatorApproves", before: true, after: false },
    });

    // Sorumluyu kaldır ve geri al.
    await change.click();
    await dialog.getByRole("button", { name: "Sorumluyu kaldır" }).click();
    const removed = toast(page, `${school.name} için okul sorumlusu kaldırıldı.`);
    await expect(removed).toBeVisible();
    expect((await schoolOf(school.id)).coordinatorId).toBeNull();
    await expect(assign).toBeVisible();
    await removed.getByRole("button", { name: "Geri al" }).click();
    await expect(toast(page, "Geri alındı.")).toBeVisible();
    expect((await schoolOf(school.id)).coordinatorId).toBe(second.id);
    await expect(change).toBeVisible();
    entries = await auditOf(target);
    expect(entries.slice(-2)).toMatchObject([
      { action: "school.coordinator_removed", details: { userId: second.id } },
      { action: "school.coordinator_set", details: { undo: true, userId: second.id } },
    ]);
    expect(entries.every((e) => e.actorId === admin.id)).toBe(true);

    // "Okul sorumlusu oldun" maili yalnızca hâlâ sorumlu olana gider (geri al süresinden sonra).
    await expect
      .poll(async () => (await mailsTo(second.email)).map((m) => m.subject), { timeout: Math.max(15_000, mailDelayMs + 30_000 - (Date.now() - secondSetAt)) })
      .toEqual([`${school.name} okul sorumlusu oldun`]);
    expect(await mailsTo(first.email)).toEqual([]);
  });
});
