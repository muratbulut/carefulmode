import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { actionId, callAction, callFormAction } from "./support/actions";
import { withDb } from "./support/db";
import { finishTraining } from "./support/lab";
import { createSchool, makeCoordinator, makeTeacher, userIdOf } from "./support/teacher";

// Güvenlik turu 3 (Faz 4): öğretmen, sınıf ve okul eylemleri arayüz kullanılmadan, elle
// hazırlanmış istekle (tarayıcı konsolundan ya da betikle) çağrıldığında da kurallar sunucuda
// tutar. Eylem kimlikleri yerel derlemeden okunur (support/actions.ts). Hesaplar, sınıflar ve
// talepler çoğunlukla veritabanına doğrudan yazılır; yalnızca eylemi çağıran kişi kayıt olur.

const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function query<T extends object>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await withDb(async (client) => (await client.query<T>(sql, params)).rows)) ?? [];
}

/** Doğrulanmış hesap (giriş yapmaz). */
async function insertUser(name: string, { role = "STUDENT", schoolId = null }: { role?: "STUDENT" | "TEACHER"; schoolId?: string | null } = {}) {
  const id = newId();
  const email = uniqueEmail("tur3");
  await query(`INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "role", "schoolId", "updatedAt") VALUES ($1, $2, $3, true, $4, $5, now())`, [
    id,
    name,
    email,
    role,
    schoolId,
  ]);
  return { id, email, name };
}

/** Okulu seçmiş bekleyen (ya da bilgi istenmiş) öğretmenlik talebi. */
async function insertApplication(userId: string, school: { id: string; province: string; district: string }, status: "PENDING" | "INFO_REQUESTED" = "PENDING") {
  const id = newId();
  await query(
    `INSERT INTO "TeacherApplication" ("id", "userId", "schoolId", "province", "district", "subject", "status", "question", "questionAt")
     VALUES ($1, $2, $3, $4, $5, 'Bilişim Teknolojileri', $6::"ApplicationStatus", $7, $8)`,
    [id, userId, school.id, school.province, school.district, status, status === "INFO_REQUESTED" ? "Görev yeri belgeni ekler misin?" : null, status === "INFO_REQUESTED" ? new Date() : null],
  );
  return id;
}

/** Öğretmenin sınıfı, üyeleri ve Oltalama Limanı'nda açık ödevi. */
async function insertClassroom(teacherId: string, name: string, memberIds: string[] = []) {
  const id = newId();
  const joinCode = Array.from({ length: 6 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join("");
  await query(`INSERT INTO "Classroom" ("id", "name", "level", "teacherId", "joinCode") VALUES ($1, $2, '7', $3, $4)`, [id, name, teacherId, joinCode]);
  for (const userId of memberIds) await query(`INSERT INTO "ClassroomMembership" ("classroomId", "userId") VALUES ($1, $2)`, [id, userId]);
  await query(`INSERT INTO "Assignment" ("id", "classroomId", "neighborhoodId") SELECT $1, $2, "id" FROM "Neighborhood" WHERE "slug" = 'oltalama-limani'`, [newId(), id]);
  return id;
}

/** Öğrencinin bitmiş senaryo denemesi (tuzağı fark edip güvende kaldı ya da hacklendi). */
async function finishScenario(email: string, status: "COMPLETED" | "HACKED") {
  await query(
    `INSERT INTO "LabAttempt" ("id", "userId", "labId", "labVersion", "status", "reportScore", "startedAt", "endedAt", "resultReport")
     SELECT $1, u.id, l.id, l."publishedVersion", $3::"AttemptStatus", $4, now(), now(), $5::jsonb
     FROM "User" u, "Lab" l WHERE u.email = $2 AND l.slug = 'sahte-kargo-maili'`,
    [newId(), email, status, status === "COMPLETED" ? 9 : 2, JSON.stringify({ status: status === "COMPLETED" ? "safe" : "hacked" })],
  );
}

/** Kayıt olup okulun sorumlusu (ve öğretmeni) olur. */
async function signUpCoordinator(page: Page) {
  const email = uniqueEmail("tur3-sorumlu");
  await signUpVerified(page, email);
  const school = await createSchool({ creatorEmail: email });
  await makeTeacher(email, school.id);
  await makeCoordinator(email, school.id);
  return { email, id: (await userIdOf(email))!, school };
}

test.describe("güvenlik turu 3: öğretmen, sınıf ve okul", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");

  test("öğrenci, başka okulun sorumlusu ve öğretmenliği alınan kişi eylemleri elle hazırlanmış istekle de çalıştıramaz", async ({ page }) => {
    const email = uniqueEmail("tur3-yetki");
    await signUpVerified(page, email);
    const me = (await userIdOf(email))!;

    // Başka okul: öğretmeni, sınıfı ve öğrencisi, bekleyen bir talep.
    const other = await createSchool({ creatorEmail: email, district: "Kadıköy" });
    const otherTeacher = await insertUser("Başka Okulun Öğretmeni", { role: "TEACHER", schoolId: other.id });
    const victim = await insertUser("Başka Sınıfın Öğrencisi");
    const victimClass = await insertClassroom(otherTeacher.id, "Başka Sınıf", [victim.id]);
    const applicant = await insertUser("Başka Okula Başvuran");
    const otherApp = await insertApplication(applicant.id, other);
    const neighborhood = (await query<{ id: string }>(`SELECT "id" FROM "Neighborhood" WHERE "slug" = 'oltalama-limani'`))[0].id;

    const teacherCalls: [string, unknown[]][] = [
      ["createClassroom", [{ name: "Sızma Sınıfı", level: "7" }]],
      ["giveHomework", [{ classroomId: victimClass, neighborhoodId: neighborhood, labIds: [], due: "" }]],
      ["endHomework", [{ classroomId: victimClass }]],
      ["removeStudent", [{ classroomId: victimClass, userId: victim.id }]],
      ["projectionJoins", [{ classroomId: victimClass, since: "2000-01-01T00:00:00.000Z" }]],
    ];
    const schoolCalls: [string, unknown[]][] = [
      ["endorseApplication", [otherApp]],
      ["notRecognizeApplication", [otherApp]],
      ["undoSchoolDecision", [otherApp]],
      ["remindTeacher", [otherTeacher.id]],
    ];

    // 1. Öğrenci: öğretmen ve Okulum eylemlerinin hepsi "yetki yok".
    for (const [name, args] of [...teacherCalls, ...schoolCalls]) {
      expect(await callAction(page.request, name, args), `öğrenci: ${name}`).toEqual({ ok: false, error: "forbidden" });
    }

    // 2. Kendi okulunun sorumlusu olur: başka okulun sınıfı, talebi ve öğretmeni "bulunamadı".
    const own = await createSchool({ creatorEmail: email });
    await makeTeacher(email, own.id);
    await makeCoordinator(email, own.id);
    for (const [name, args] of [...teacherCalls.slice(1), ...schoolCalls]) {
      expect(await callAction(page.request, name, args), `sorumlu: ${name}`).toEqual({ ok: false, error: "notFound" });
    }
    // Kendi okuluna kendi adına yazılmış talebe de karar veremez.
    const ownApp = await insertApplication(me, own);
    expect(await callAction(page.request, "endorseApplication", [ownApp])).toEqual({ ok: false, error: "notFound" });

    // 3. Öğretmenliği alınır (rol yeniden öğrenci): açık kalan sayfanın eylemleri artık "yetki yok".
    const colleague = await insertUser("Okula Başvuran Meslektaş");
    const colleagueApp = await insertApplication(colleague.id, own);
    await query(`UPDATE "User" SET "role" = 'STUDENT' WHERE "id" = $1`, [me]);
    for (const [name, args] of [
      ["endorseApplication", [colleagueApp]],
      ["createClassroom", [{ name: "Eski Sınıf", level: "7" }]],
    ] as [string, unknown[]][]) {
      expect(await callAction(page.request, name, args), `rolü alınan: ${name}`).toEqual({ ok: false, error: "forbidden" });
    }

    // Hiçbir şey değişmedi: talepler bekliyor, kayıt defterinde iz yok, başka sınıf olduğu gibi.
    const apps = await query<{ status: string; coordinatorOpinion: string | null }>(
      `SELECT "status", "coordinatorOpinion" FROM "TeacherApplication" WHERE "id" = ANY($1)`,
      [[otherApp, ownApp, colleagueApp]],
    );
    expect(apps).toEqual(Array(3).fill({ status: "PENDING", coordinatorOpinion: null }));
    const targets = [otherApp, ownApp, colleagueApp].map((id) => `application:${id}`).concat(`user:${otherTeacher.id}`);
    expect(await query(`SELECT 1 FROM "AuditLog" WHERE "target" = ANY($1)`, [targets])).toHaveLength(0);
    expect(await query(`SELECT "userId" FROM "ClassroomMembership" WHERE "classroomId" = $1`, [victimClass])).toEqual([{ userId: victim.id }]);
    expect(await query(`SELECT 1 FROM "Assignment" WHERE "classroomId" = $1 AND NOT "closed"`, [victimClass])).toHaveLength(1);
    expect(await query(`SELECT 1 FROM "Classroom" WHERE "teacherId" = $1`, [me])).toHaveLength(0);
    expect((await query<{ role: string }>(`SELECT "role" FROM "User" WHERE "id" = $1`, [applicant.id]))[0].role).toBe("STUDENT");
  });

  test("tuzağı fark edenlerin oranı tek öğrencinin sonucunu ele vermez: 5'erli gruplarla değişir", async ({ page }) => {
    test.setTimeout(90_000);
    const email = uniqueEmail("tur3-oran");
    await signUpVerified(page, email);
    await makeTeacher(email);
    const students = await Promise.all(Array.from({ length: 10 }, (_, i) => insertUser(`Oran Öğrenci ${i + 1}`)));
    const classroomId = await insertClassroom((await userIdOf(email))!, "Oran Sınıfı", students.map((s) => s.id));
    const finish = async (index: number, status: "COMPLETED" | "HACKED") => {
      await finishTraining(students[index].email);
      await finishScenario(students[index].email, status);
    };
    const rate = page.getByText(/^Tuzağı fark eden: ilk seferde %\d+ · tekrar sonrası %\d+$/);

    // 5 öğrenciden 3'ü fark etti: %60.
    for (const [i, status] of (["COMPLETED", "COMPLETED", "HACKED", "HACKED", "COMPLETED"] as const).entries()) await finish(i, status);
    await page.goto(`/siniflarim/${classroomId}`);
    await expect(rate).toHaveText("Tuzağı fark eden: ilk seferde %60 · tekrar sonrası %60");

    // Hacklenen 3. öğrenci labı tekrar yapıp fark eder: ilk seferdeki oran aynı, tekrar sonrası artar.
    await finishScenario(students[2].email, "COMPLETED");
    await page.reload();
    await expect(rate).toHaveText("Tuzağı fark eden: ilk seferde %60 · tekrar sonrası %80");

    // 6. öğrenci hacklenir. Oran her bitirende değişseydi %50 olurdu ve öğretmen, kimin bitirdiğini
    // gördüğü için 6. öğrencinin hacklendiğini anlardı. Bitiren sayısı değişir, oran değişmez.
    await finish(5, "HACKED");
    await page.reload();
    // Ödevin eğitim labı ve senaryo labı: ikisinde de 6 bitiren.
    await expect(page.getByText("10 öğrenciden 6 bitirdi")).toHaveCount(2);
    await expect(rate).toHaveText("Tuzağı fark eden: ilk seferde %60 · tekrar sonrası %80");

    // 10. öğrenci de bitirince ikinci grup sayılır: 10 öğrenciden 7'si ilk seferde, 8'i tekrar sonrası.
    for (const i of [6, 7, 8, 9]) await finish(i, "COMPLETED");
    await page.reload();
    await expect(rate).toHaveText("Tuzağı fark eden: ilk seferde %70 · tekrar sonrası %80");
  });

  test("karar ile başvuranın geri çekmesi ya da cevabı aynı anda gelince karar kilitlenip hata vermez", async ({ page }) => {
    test.setTimeout(60_000);
    const coordinator = await signUpCoordinator(page);

    // Başvuranın işi aynı anda gelir: veritabanı bağlantısı, geri çekme ve cevabın yaptığı gibi
    // (application-actions.ts) önce başvuranın satırını kilitler. Karar o satırı beklemeye
    // düşünce başvuranın işi talebe yazar ve biter. Karar talebi kilitleyip başvuranın satırını
    // bekleseydi (eski sıra) ikisi birbirini bekler, veritabanı kararı durdururdu: "failed".
    async function raceWithApplicant(applicantId: string, appId: string, applicantWrite: string) {
      return withDb(async (client) => {
        await client.query("BEGIN");
        try {
          await client.query(`SELECT 1 FROM "User" WHERE "id" = $1 FOR UPDATE`, [applicantId]);
          const decision = callAction(page.request, "endorseApplication", [appId], "/okulum");
          // Karar beklemeden biterse sonucu hata iletisinde görünsün.
          let early: unknown;
          decision.then(
            (result) => (early = result),
            (error) => (early = String(error)),
          );
          await expect
            .poll(
              async () =>
                early ?? (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE pg_backend_pid() = ANY (pg_blocking_pids(pid))`)).rows[0].n,
              { intervals: [20], timeout: 30_000 },
            )
            .toBe(1);
          await client.query(applicantWrite, [appId]);
          await client.query("COMMIT");
          return await decision;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => {});
          throw error;
        }
      });
    }

    // Geri çekme: talep silinir, karar "bulunamadı" der; başvuran öğrenci kalır.
    const withdrawing = await insertUser("Geri Çeken Başvuran");
    const withdrawn = await insertApplication(withdrawing.id, coordinator.school, "INFO_REQUESTED");
    expect(await raceWithApplicant(withdrawing.id, withdrawn, `DELETE FROM "TeacherApplication" WHERE "id" = $1`)).toEqual({ ok: false, error: "notFound" });
    expect(await query(`SELECT 1 FROM "TeacherApplication" WHERE "id" = $1`, [withdrawn])).toHaveLength(0);
    expect((await query<{ role: string }>(`SELECT "role" FROM "User" WHERE "id" = $1`, [withdrawing.id]))[0].role).toBe("STUDENT");

    // Cevap: talep yeniden bekleyene döner, karar ardından onaylar.
    const answering = await insertUser("Cevaplayan Başvuran");
    const answered = await insertApplication(answering.id, coordinator.school, "INFO_REQUESTED");
    const answer = `UPDATE "TeacherApplication" SET "status" = 'PENDING', "answer" = 'Belgemi okul müdürlüğünden aldım.', "answeredAt" = now() WHERE "id" = $1 AND "status" = 'INFO_REQUESTED'`;
    expect(await raceWithApplicant(answering.id, answered, answer)).toMatchObject({ ok: true, approved: true });
    expect((await query<{ status: string }>(`SELECT "status" FROM "TeacherApplication" WHERE "id" = $1`, [answered]))[0].status).toBe("APPROVED");
    expect((await query<{ role: string }>(`SELECT "role" FROM "User" WHERE "id" = $1`, [answering.id]))[0].role).toBe("TEACHER");
  });

  test("belge: tür baytlarından bulunur, ad temizlenir, boyut sunucuda denetlenir; okul listesi istek sınırlıdır", async ({ page }) => {
    const email = uniqueEmail("tur3-belge");
    await signUpVerified(page, email);
    const school = await createSchool({ creatorEmail: email });
    const fields = { province: school.province, district: school.district, school: school.id, subject: "Bilişim Teknolojileri" };
    const typeError = { status: "error", fieldErrors: { document: "Sadece PDF, JPG ya da PNG ekleyebilirsin." } };

    // Adı ve bildirilen türü PDF olan HTML dosyası reddedilir.
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    expect(await callFormAction(page.request, "submitApplication", { ...fields, document: { name: "belge.pdf", mimeType: "application/pdf", buffer: html } })).toEqual(typeError);
    // 5 MB'tan büyük belge, tarayıcı denetimi atlansa da sunucuda reddedilir.
    const big = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(5 * 1024 * 1024)]);
    expect(await callFormAction(page.request, "submitApplication", { ...fields, document: { name: "buyuk.pdf", mimeType: "application/pdf", buffer: big } })).toEqual({
      status: "error",
      fieldErrors: { document: "Belge en fazla 5 MB olabilir." },
    });

    // PDF imzalı dosya kabul edilir; klasör kısmı ve yön değiştiren işaret atılır, uzantı gerçek türden.
    const marker = `e2e-belge-icerigi-${randomUUID().slice(0, 8)}`;
    const pdf = Buffer.from(`%PDF-1.4\n<html><script>${marker}</script></html>`);
    const sent = await callFormAction(page.request, "submitApplication", {
      ...fields,
      document: { name: "../../gizli‮fdp.exe", mimeType: "text/html", buffer: pdf },
    });
    expect(sent).toMatchObject({ status: "ok" });
    const [row] = await query<{ documentName: string; mimeType: string }>(
      `SELECT a."documentName", d."mimeType" FROM "TeacherApplication" a JOIN "ApplicationDocument" d ON d."applicationId" = a."id"
       JOIN "User" u ON u."id" = a."userId" WHERE u."email" = $1`,
      [email],
    );
    expect(row).toEqual({ documentName: "gizlifdp.pdf", mimeType: "application/pdf" });
    // Belgenin içeriği hiçbir sayfaya gitmez; profilde yalnızca adı görünür.
    const profile = await (await page.request.get("/profil?bolum=ogretmenlik")).text();
    expect(profile).toContain("gizlifdp.pdf");
    expect(profile).not.toContain(marker);

    // Okul listesi eylemi yok (sabah soruları 26b): kimse ilçedeki okulları sorgulayamaz.
    expect(() => actionId("listSchools")).toThrow("sunucu eylemi bulunamadı");
  });
});
