import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { makeAdmin } from "./support/admin";
import { actionId } from "./support/actions";
import { withDb } from "./support/db";
import { userIdOf } from "./support/teacher";

// Güvenlik turu 4 (Faz 5): yönetim izinleri, gündem okuma sayısı, yönetim eylemlerinin istek sınırı
// ve toplu ekranlarda lab cevabı. Eylemler arayüz kullanılmadan, elle hazırlanmış istekle de çağrılır
// (tarayıcı konsolundan yapılabilecek olan budur). Yalnızca yerel üretim derlemesine karşı.
//
// Veritabanı başka koşularla ortaktır: testler yalnızca kendi açtıkları kayıtlara bakar ve onları
// siler; kayıt defteri silinmez.

test.skip(isLive, "veritabanına yazan ve hesap açan testler canlı sitede çalışmaz");


const stamp = () => `${Date.now().toString(36)}${process.pid.toString(36)}${randomUUID().slice(0, 4)}`;
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;

/** Eylemin dönüş değeri: React'in akışındaki "1:" satırı. */
function resultOf(text: string): unknown {
  const line = text.split("\n").find((l) => l.startsWith("1:"));
  return line ? JSON.parse(line.slice(2)) : undefined;
}

/** Sunucu eylemini düz argümanlarla çağırır; ek başlıklar verilebilir (ör. X-Forwarded-For). */
async function call(request: APIRequestContext, name: string, args: unknown[], path: string, headers: Record<string, string> = {}) {
  const response = await request.post(path, {
    headers: { "Next-Action": actionId(name), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", ...headers },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { result: resultOf(await response.text()), headers: response.headers() };
}

/**
 * Doğrudan veritabanına öğrenci rolünde hesap (giriş yapmaz; haber yazarı, deneme sahibi ya da
 * aranan kişi olur). Varsayılan 2012 doğumlu (öğrenci hesabı); e-postası `<kimlik>@ornek.com`.
 */
async function insertUser(name: string, birthYear = 2012) {
  const id = newId();
  await withDb((client) =>
    client.query(
      `INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "role", "birthYear", "updatedAt")
       VALUES ($1, $2, $3, true, 'STUDENT', $4, now())`,
      [id, name, `${id}@ornek.com`, birthYear],
    ),
  );
  return id;
}

async function deleteUser(id: string) {
  await withDb(async (client) => {
    await client.query(`DELETE FROM "NewsArticle" WHERE "authorId" = $1`, [id]);
    await client.query(`DELETE FROM "LabAttempt" WHERE "userId" = $1`, [id]);
    await client.query(`DELETE FROM "User" WHERE "id" = $1`, [id]);
  });
}

/** Hesaba ekip izinleri yazar (veritabanına doğrudan: arayüzün vermeyeceği izinler de). */
async function grant(email: string, permissions: string[]) {
  await withDb((client) =>
    client.query(
      `INSERT INTO "TeamPermission" ("userId", "permission", "grantedById")
       SELECT u."id", p::"TeamPermissionType", u."id" FROM "User" u, unnest($2::text[]) p WHERE u."email" = $1
       ON CONFLICT DO NOTHING`,
      [email, permissions],
    ),
  );
}

async function setBirthYear(email: string, year: number) {
  await withDb((client) => client.query(`UPDATE "User" SET "birthYear" = $2 WHERE "email" = $1`, [email, year]));
}

async function expectNotFound(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
}

/** Sayfanın ham yanıtı (HTML ve içindeki React verisi) ve tarayıcıdaki hali. */
async function pageTexts(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return [await page.content(), await (await page.request.get(path)).text()];
}

// ---------------------------------------------------------------------------------------
// Gündem: okuma sayısı
// ---------------------------------------------------------------------------------------

async function insertArticle(authorId: string, slug: string, status: "DRAFT" | "PUBLISHED") {
  const id = newId();
  await withDb((client) =>
    client.query(
      `INSERT INTO "NewsArticle" ("id", "slug", "title", "summary", "content", "status", "publishedAt", "authorId", "updatedAt")
       VALUES ($1, $2, $3, 'Güvenlik testi haberi.', '{}'::jsonb, $4::"ArticleStatus", $5, $6, now())`,
      // Yayın anı geçmişte ve eski: aynı anda çalışan gündem testinin "en yeni haber"ini değiştirmez.
      [id, slug, `E2E güvenlik ${slug}`.slice(0, 70), status, status === "DRAFT" ? null : new Date("2020-01-03T09:00:00Z"), authorId],
    ),
  );
  return id;
}

async function readCountOf(id: string) {
  const rows = await withDb(async (client) => (await client.query<{ readCount: number }>(`SELECT "readCount" FROM "NewsArticle" WHERE "id" = $1`, [id])).rows);
  return rows?.[0]?.readCount ?? null;
}

test("gündem okuma sayısı ucuzca şişirilemez: aynı IPv6 /64 ağı ve aynı IPv4 bir okuma sayılır, çerez yazılmaz", async ({ request }) => {
  const tag = stamp();
  const author = await insertUser(`Okuma Yazarı ${tag}`);
  try {
    const slug = `e2e-guvenlik-okuma-${tag}`;
    const live = await insertArticle(author, slug, "PUBLISHED");
    const draft = await insertArticle(author, `e2e-guvenlik-taslak-${tag}`, "DRAFT");
    const path = `/gundem/${slug}`;
    // Bu koşuya özgü ağlar (her koşuda başka bir /64).
    const hex = Number.parseInt(tag.slice(-4), 36).toString(16).slice(-4);
    const net = `2001:db8:${hex}:51`;
    const read = (articleId: string, ip: string) => call(request, "recordArticleRead", [articleId], path, { "X-Forwarded-For": ip });

    // Aynı /64 ağından dört farklı adres: bir okuma. (Düzeltmeden önce her adres bir okumaydı.)
    for (const host of [":1", ":2", "abcd:ef01:2345:6789", "ffff:ffff:ffff:ffff"]) {
      const { headers } = await read(live, `${net}:${host}`);
      expect(headers["set-cookie"], "okuma çerez yazmaz").toBeUndefined();
    }
    expect(await readCountOf(live)).toBe(1);

    // Başka bir /64: ikinci okuma. Aynı IPv4 adresi (IPv6 içinde yazılmışı da) bir kez sayılır.
    await read(live, `2001:db8:${hex}:52::1`);
    expect(await readCountOf(live)).toBe(2);
    await read(live, "203.0.113.77");
    await read(live, "::ffff:203.0.113.77");
    await read(live, "203.0.113.77");
    expect(await readCountOf(live)).toBe(3);

    // Taslak haber sayılmaz (kimliği bilinse de); adresi, listesi ve başlığı herkese kapalı.
    await read(draft, "198.51.100.5");
    expect(await readCountOf(draft)).toBe(0);
    const draftTitle = `E2E güvenlik e2e-guvenlik-taslak-${tag}`.slice(0, 70);
    const draftPage = await (await request.get(`/gundem/e2e-guvenlik-taslak-${tag}`)).text();
    expect(draftPage).toContain("Sayfa bulunamadı");
    for (const html of [draftPage, await (await request.get("/gundem")).text(), await (await request.get("/")).text()]) {
      expect(html).not.toContain(draftTitle);
    }
  } finally {
    await deleteUser(author);
  }
});

// ---------------------------------------------------------------------------------------
// Yönetim eylemleri: izin ve istek sınırı
// ---------------------------------------------------------------------------------------

test("yönetimdeki yazma eylemleri (lab, ipucu, gündem, talepler, ekip, kullanıcılar, okullar) kullanıcı başına istek sınırına tabidir", async ({ page }) => {
  const email = uniqueEmail("guvenlik-sinir");
  await signUpVerified(page, email);
  await makeAdmin(email);
  const userId = (await userIdOf(email))!;
  const key = `admin-actions:${userId.toLowerCase()}`;
  // Sınır dolmuş gibi: sayaç en yüksek değerin çok üstünde (testler aynı anda yüzlerce istek atmasın).
  await withDb((client) =>
    client.query(
      `INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES ($1, 100000, now() + interval '10 minutes')
       ON CONFLICT ("key") DO UPDATE SET "count" = 100000, "resetAt" = now() + interval '10 minutes'`,
      [key],
    ),
  );
  try {
    const missing = newId();
    const limited = { ok: false, error: "rateLimited" };
    // Lab işlemleri (Faz 3): olmayan lab bile sınırdan önce sorulmaz.
    expect((await call(page.request, "moveLab", [missing, 1], "/yonetim/odalar")).result).toEqual(limited);
    expect((await call(page.request, "setLabVisibility", [missing, false, ""], "/yonetim/odalar")).result).toEqual(limited);
    expect((await call(page.request, "saveLabDraft", [missing, {}, "", true], "/yonetim/odalar")).result).toEqual(limited);
    expect((await call(page.request, "publishLab", [missing], "/yonetim/odalar")).result).toEqual(limited);
    expect((await call(page.request, "undoPublish", [missing, 1], "/yonetim/odalar")).result).toEqual(limited);
    // İpucu ve gündem
    expect((await call(page.request, "archiveTip", [missing], "/yonetim/ipucu")).result).toEqual(limited);
    expect((await call(page.request, "deleteDraft", [missing], "/yonetim/gundem")).result).toEqual(limited);
    // Öğretmen talepleri
    expect((await call(page.request, "undoApplicationDecision", [missing], "/yonetim/talepler")).result).toEqual(limited);
    expect((await call(page.request, "rejectTeacherApplication", [{ applicationId: missing, note: "Okul bilgisi doğrulanamadı." }], "/yonetim/talepler")).result).toEqual(
      limited,
    );
    // Ekip, kullanıcılar ve okullar: öğrenci profiline bakış da sayılır (her biri kayıt defterine yazar).
    const users = "/yonetim/kullanicilar";
    expect((await call(page.request, "addTeamMember", [{ userId: missing, role: "MEMBER", permissions: ["TIPS"] }], users)).result).toEqual(limited);
    expect((await call(page.request, "removeTeamMember", [missing], users)).result).toEqual(limited);
    expect((await call(page.request, "openStudentProfile", [missing], users)).result).toEqual(limited);
    expect((await call(page.request, "removeTeacher", [missing], users)).result).toEqual(limited);
    expect((await call(page.request, "setSchoolCoordinator", [{ schoolId: missing, userId: missing, coordinatorApproves: false }], users)).result).toEqual(limited);
  } finally {
    await withDb((client) => client.query(`DELETE FROM "RateLimit" WHERE "key" = $1`, [key]));
  }
});

test("eylemler izni kendisi denetler: izinsiz öğrenci ve başka izinli sorumlu reddedilir", async ({ page }) => {
  const email = uniqueEmail("guvenlik-izin");
  await signUpVerified(page, email);
  const missing = newId();
  const forbidden = { ok: false, error: "forbidden" };

  // Ekipte olmayan öğrenci
  expect((await call(page.request, "moveLab", [missing, 1], "/")).result).toEqual(forbidden);
  expect((await call(page.request, "archiveTip", [missing], "/")).result).toEqual(forbidden);
  expect((await call(page.request, "deleteDraft", [missing], "/")).result).toEqual(forbidden);

  // Yalnızca ipucu izni: gündem ve lab eylemleri yine reddedilir; ipucu eylemi izni geçer.
  await grant(email, ["TIPS"]);
  expect((await call(page.request, "deleteDraft", [missing], "/")).result).toEqual(forbidden);
  expect((await call(page.request, "undoApplicationDecision", [missing], "/")).result).toEqual(forbidden);
  expect((await call(page.request, "moveLab", [missing, 1], "/")).result).toEqual(forbidden);
  expect((await call(page.request, "archiveTip", [missing], "/")).result).toEqual({ ok: false, error: "notFound" });
});

test("ekipteki öğrenci hesabı veritabanında başka izin satırı olsa da yalnızca ipucu ve gündemi kullanır", async ({ page }) => {
  const email = uniqueEmail("guvenlik-ogrenci-ekip");
  await signUpVerified(page, email);
  // 18 yaşından küçük olabilecek öğrenci (doğum yılına göre bu yıl 18'ini dolduruyor olabilir).
  await setBirthYear(email, new Date().getFullYear() - 18);
  await grant(email, ["TIPS", "LAB_EDITING", "LAB_PUBLISHING", "AUDIT_LOG", "APPLICATIONS", "ROLES"]);
  const missing = newId();

  for (const path of ["/yonetim/odalar", "/yonetim/kayit-defteri", "/yonetim/talepler", "/yonetim/kullanicilar"]) await expectNotFound(page, path);
  expect((await call(page.request, "moveLab", [missing, 1], "/")).result).toEqual({ ok: false, error: "forbidden" });
  expect((await call(page.request, "saveLabDraft", [missing, {}, "", true], "/")).result).toEqual({ ok: false, error: "forbidden" });
  expect((await call(page.request, "undoApplicationDecision", [missing], "/")).result).toEqual({ ok: false, error: "forbidden" });
  await page.goto("/yonetim/ipucu");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Günün ipucu");
});

// ---------------------------------------------------------------------------------------
// Özet ve Canlı nabız: lab cevabı yalnızca lab izni olana
// ---------------------------------------------------------------------------------------

test("özet ve canlı nabızda en çok kaçırılan sahte öğe (lab cevabı) lab izni olmayan ekip üyesine gitmez", async ({ page, browser }) => {
  // İki hesap açılır ve dört sayfa okunur.
  test.setTimeout(180_000);
  const student = await insertUser(`Tuzak Öğrencisi ${stamp()}`);
  try {
    // Sahte kargo mailinde (sahte öğe "kargo", gönderen "Kargo Takip") sahte maili kaçıran 40 deneme.
    await withDb(async (client) => {
      const { rows } = await client.query<{ id: string; publishedVersion: number }>(`SELECT "id", "publishedVersion" FROM "Lab" WHERE "slug" = 'sahte-kargo-maili'`);
      const report = JSON.stringify({ status: "hacked", rows: [{ type: "fake", item: "kargo", state: "bad" }] });
      for (let i = 0; i < 40; i++) {
        await client.query(
          `INSERT INTO "LabAttempt" ("id", "userId", "labId", "labVersion", "status", "startedAt", "endedAt", "reportScore", "resultReport")
           VALUES ($1, $2, $3, $4, 'HACKED', now() - interval '5 minutes', now(), 0, $5::jsonb)`,
          [newId(), student, rows[0].id, rows[0].publishedVersion, report],
        );
      }
    });
    const answer = "Kargo Takip";

    // Yönetici (lab izni var) görür: kontrol.
    const adminContext = await browser.newContext();
    try {
      const admin = await adminContext.newPage();
      const adminEmail = uniqueEmail("guvenlik-tuzak-yonetici");
      await signUpVerified(admin, adminEmail);
      await makeAdmin(adminEmail);
      await admin.goto("/yonetim");
      await expect(admin.getByTestId("trap-list")).toContainText(`sahte "${answer}" maili`);
    } finally {
      await adminContext.close();
    }

    // Ekipteki öğrenci (yalnızca ipucu izni): ne HTML'de ne sayfa verisinde.
    const email = uniqueEmail("guvenlik-tuzak-ogrenci");
    await signUpVerified(page, email);
    await setBirthYear(email, new Date().getFullYear() - 14);
    await grant(email, ["TIPS"]);
    for (const path of ["/yonetim", "/yonetim/canli-nabiz"]) {
      for (const html of await pageTexts(page, path)) {
        expect(html, path).not.toContain(answer);
        expect(html, path).not.toContain("en çok kaçırılan");
      }
    }
    // Labın kendisi ve tuzak oranı yine görünür (yalnızca toplam).
    await page.goto("/yonetim");
    await expect(page.getByTestId("trap-list")).toContainText("Sahte kargo maili");
  } finally {
    await deleteUser(student);
  }
});

// ---------------------------------------------------------------------------------------
// Kişi aramaları: öğrenci hesabının soyadı ve e-postası
// ---------------------------------------------------------------------------------------

type Found = { ok: boolean; people: { id: string; name: string; email: string }[] };

test("kişi aramaları öğrenci hesabının soyadını ve e-postasını açığa çıkarmaz: yalnızca 'Ad S.' ya da e-postanın tamamıyla bulunur", async ({ page }) => {
  const email = uniqueEmail("guvenlik-arama");
  await signUpVerified(page, email);
  await makeAdmin(email);
  const tag = stamp();
  const first = `Tuna${tag}`;
  const surname = `Gizlisoy${tag}`;
  const student = await insertUser(`${first} ${surname}`);
  const adult = await insertUser(`Yetişkin ${surname}`, 1990);
  const studentEmail = `${student}@ornek.com`;
  const users = "/yonetim/kullanicilar";
  const searches: [string, (q: string) => Promise<Found>][] = [
    ["ekibe ekle", async (q) => (await call(page.request, "searchTeamCandidates", [q], users)).result as Found],
    ["okul sorumlusu", async (q) => (await call(page.request, "searchCoordinators", [{ schoolId: null, query: q }], users)).result as Found],
  ];
  try {
    for (const [label, search] of searches) {
      // Soyadıyla: yetişkin üye adı ve e-postasıyla çıkar; öğrenci hesabı çıkmaz.
      const bySurname = await search(surname);
      expect(bySurname.ok, label).toBe(true);
      expect(bySurname.people.map((p) => p.id), label).toContain(adult);
      expect(bySurname.people.map((p) => p.id), label).not.toContain(student);
      expect(JSON.stringify(bySurname), label).not.toContain(studentEmail);

      // E-postanın bir parçasıyla çıkmaz (adresler taranamaz).
      const byPart = await search(student.slice(0, 12));
      expect(byPart.people.map((p) => p.id), label).not.toContain(student);

      // Görünen adıyla: "Ad S.", e-posta maskeli, soyadı hiçbir yerde yok.
      const byName = await search(first);
      expect(byName.people.find((p) => p.id === student), label).toMatchObject({ name: `${first} G.`, email: "e2•••@ornek.com" });
      expect(JSON.stringify(byName), label).not.toContain(surname);

      // E-postanın tamamıyla: yönetici adresi zaten biliyor, e-posta açık; ad yine "Ad S.".
      const byEmail = await search(studentEmail.toUpperCase());
      expect(byEmail.people.find((p) => p.id === student), label).toMatchObject({ name: `${first} G.`, email: studentEmail });
      expect(JSON.stringify(byEmail), label).not.toContain(surname);
    }
  } finally {
    await deleteUser(student);
    await deleteUser(adult);
  }
});

// ---------------------------------------------------------------------------------------
// Hesap e-postası: yalnızca Roller izni olan (yönetici) görür
// ---------------------------------------------------------------------------------------

test("hesap e-postası Roller izni olmayan ekip üyesine hiçbir yönetim sayfasında gitmez (HTML ve React verisi)", async ({ page }) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("guvenlik-eposta");
  await signUpVerified(page, email);
  await setBirthYear(email, 1990);
  // Roller dışındaki bütün izinler.
  await grant(email, ["APPLICATIONS", "LAB_EDITING", "LAB_PUBLISHING", "TIPS", "NEWS", "AUDIT_LOG"]);
  const memberId = (await userIdOf(email))!;
  const tag = stamp();
  const applicant = await insertUser(`Başvuran ${tag}`, 1985);
  const teacher = await insertUser(`Öğretmen ${tag}`, 1980);
  const applicationId = newId();
  await withDb(async (client) => {
    await client.query(`UPDATE "User" SET "role" = 'TEACHER' WHERE "id" = $1`, [teacher]);
    await client.query(
      `INSERT INTO "TeacherApplication" ("id", "userId", "newSchoolName", "province", "district", "subject")
       VALUES ($1, $2, $3, 'Sinop', 'Boyabat', 'Bilişim Teknolojileri')`,
      [applicationId, applicant, `Deneme ${tag} Ortaokulu`],
    );
    // Kayıt defterinde öğretmene dair bir satır (kişi süzgeciyle bulunur).
    await client.query(`INSERT INTO "AuditLog" ("id", "actorId", "action", "target", "details") VALUES ($1, $2, 'teacher.reminded', $3, $4)`, [
      newId(),
      memberId,
      `user:${teacher}`,
      JSON.stringify({ by: "team", kind: "setup" }),
    ]);
  });
  const secrets = [`${applicant}@ornek.com`, `${teacher}@ornek.com`];
  try {
    const pages: [string, string | null][] = [
      ["/yonetim", null],
      ["/yonetim/canli-nabiz", null],
      [`/yonetim/talepler?talep=${applicationId}`, `Başvuran ${tag}`],
      [`/yonetim/kayit-defteri?kisi=${memberId}`, `Öğretmen ${tag}`],
    ];
    for (const [path, shown] of pages) {
      const texts = await pageTexts(page, path);
      // Sayfa kişiyi adıyla gösterir, e-postasını göndermez.
      if (shown) expect(texts[0], path).toContain(shown);
      for (const text of texts) for (const secret of secrets) expect(text, path).not.toContain(secret);
    }
    await expectNotFound(page, "/yonetim/kullanicilar");
  } finally {
    await withDb((client) => client.query(`DELETE FROM "TeacherApplication" WHERE "id" = $1`, [applicationId]));
    await deleteUser(applicant);
    await deleteUser(teacher);
  }
});
