import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { makeAdmin } from "./support/admin";
import { withDb } from "./support/db";

// Depodaki odalar (labs/rooms/, prisma/rooms.ts): başlangıç verisi geçici bir oda klasörüyle
// (ROOMS_DIR) gerçekten çalıştırılır, veritabanındaki sonuca bakılır. Yayındaki migration imajı
// aynı betiği çalıştırır. Masaüstü koşusunda bir kez; sonda yönetimdeki "dosyadan gelir" notuna bakılır.

test.skip(isLive, "veritabanına yazan testler canlı sitede çalışmaz");

const read = (slug: string) => JSON.parse(readFileSync(`labs/examples/${slug}.json`, "utf8")).content;
const stamp = () => `${Date.now().toString(36)}${randomUUID().slice(0, 4)}`;

async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return ((await withDb((client) => client.query(sql, params)))?.rows ?? []) as T[];
}

type LabRow = { id: string; status: string; publishedVersion: number | null; draftRevision: number; unlockedById: string | null; sourceHash: string | null; draftContent: { meta: { summary: string } } };
const labOf = async (slug: string) =>
  (await query<LabRow>(`SELECT "id", "status", "publishedVersion", "draftRevision", "unlockedById", "sourceHash", "draftContent" FROM "Lab" WHERE "slug" = $1`, [slug]))[0];
const versionsOf = async (slug: string) =>
  (await query<{ version: number }>(`SELECT v."version" FROM "LabVersion" v JOIN "Lab" l ON l."id" = v."labId" WHERE l."slug" = $1 ORDER BY 1`, [slug])).map((v) => v.version);

test("oda dosyası eklenir, değişince yeni sürüm olur, değişmeyince dokunulmaz", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "betik bir kez sınanır");
  if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
  test.skip(!process.env.DATABASE_URL, "veritabanı yok");

  const neighborhood = { id: `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`, slug: `e2e-mahalle-${stamp()}` };
  await query(`INSERT INTO "Neighborhood" ("id", "slug", "name", "color", "sortOrder") VALUES ($1, $2, $3, 'accent', 9000 + floor(random() * 900)::int)`, [
    neighborhood.id,
    neighborhood.slug,
    `E2E Mahalle ${neighborhood.slug}`,
  ]);
  const dir = testInfo.outputPath("rooms");
  mkdirSync(join(dir, neighborhood.slug), { recursive: true });
  const tag = stamp();
  const slugs = { basic: `e2e-oda-temel-${tag}`, advanced: `e2e-oda-ileri-${tag}`, scenario: `e2e-oda-senaryo-${tag}`, clash: `e2e-oda-cakisan-${tag}` };
  const write = (room: Record<string, unknown>) => writeFileSync(join(dir, neighborhood.slug, `${room.slug}.json`), JSON.stringify(room, null, 2));
  const training = read("oltalama-egitimi");
  const kargo = read("sahte-kargo-maili");
  const scenario = (summary: string, status = "PUBLISHED") => ({
    slug: slugs.scenario,
    neighborhood: neighborhood.slug,
    type: "SCENARIO",
    template: "INBOX",
    sortOrder: 1,
    status,
    unlockedBy: slugs.advanced,
    content: { ...kargo, meta: { ...kargo.meta, summary } },
  });
  const seed = () =>
    execFileSync("node", ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "prisma/seed.ts"], {
      env: { ...process.env, ROOMS_DIR: dir },
      encoding: "utf8",
    });

  try {
    write({ slug: slugs.basic, neighborhood: neighborhood.slug, type: "TRAINING", template: "TRAINING", sortOrder: 0, status: "PUBLISHED", content: training });
    write({ slug: slugs.advanced, neighborhood: neighborhood.slug, type: "TRAINING", template: "TRAINING", sortOrder: 1, status: "DRAFT", content: training });
    write(scenario("İlk hali"));
    expect(seed()).toContain("Oda dosyaları: 3 eklendi");

    const basic = await labOf(slugs.basic);
    const advanced = await labOf(slugs.advanced);
    let lab = await labOf(slugs.scenario);
    expect([basic.status, basic.publishedVersion, advanced.status, advanced.publishedVersion]).toEqual(["PUBLISHED", 1, "DRAFT", null]);
    expect(lab).toMatchObject({ status: "PUBLISHED", publishedVersion: 1, unlockedById: advanced.id });
    expect(lab.sourceHash).toMatch(/^[0-9a-f]{64}$/);

    // Dosya değişmedi: formdaki taslak değişikliği de olduğu gibi kalır.
    await query(`UPDATE "Lab" SET "draftContent" = jsonb_set("draftContent", '{meta,summary}', '"Formdan"'), "draftRevision" = "draftRevision" + 1 WHERE "slug" = $1`, [slugs.scenario]);
    expect(seed()).toContain("3 değişmedi");
    expect((await labOf(slugs.scenario)).draftContent.meta.summary).toBe("Formdan");
    expect(await versionsOf(slugs.scenario)).toEqual([1]);

    // Dosya değişti: taslak dosyadaki olur, yeni sürüm yayınlanır; gizlenmiş oda gizli kalır.
    await query(`UPDATE "Lab" SET "status" = 'HIDDEN' WHERE "slug" = $1`, [slugs.scenario]);
    write(scenario("İkinci hali"));
    expect(seed()).toContain("1 güncellendi (1 yeni sürüm)");
    const before = lab;
    lab = await labOf(slugs.scenario);
    expect(lab).toMatchObject({ status: "HIDDEN", publishedVersion: 2, unlockedById: advanced.id, draftRevision: before.draftRevision + 2 });
    expect(lab.draftContent.meta.summary).toBe("İkinci hali");
    expect(lab.sourceHash).not.toBe(before.sourceHash);

    // Taslak dosya yayındaki odayı yayından kaldırmaz, yeni sürüm açmaz. unlockedBy silinince oda
    // temel eğitime bağlanır.
    await query(`UPDATE "Lab" SET "status" = 'PUBLISHED' WHERE "slug" = $1`, [slugs.scenario]);
    const draft = scenario("Taslak hali", "DRAFT");
    delete (draft as Partial<typeof draft>).unlockedBy;
    write(draft);
    expect(seed()).toContain("1 güncellendi (0 yeni sürüm)");
    lab = await labOf(slugs.scenario);
    expect(lab).toMatchObject({ status: "PUBLISHED", publishedVersion: 2, unlockedById: null });
    expect(lab.draftContent.meta.summary).toBe("Taslak hali");
    expect(await versionsOf(slugs.scenario)).toEqual([1, 2]);

    // Aynı adreste şablonu farklı bir oda varsa dosya ona dokunmaz.
    await query(
      `INSERT INTO "Lab" ("id", "slug", "neighborhoodId", "type", "template", "sortOrder", "status", "difficulty", "durationMin", "draftContent", "updatedAt")
       VALUES ($1, $2, $3, 'SCENARIO', 'MESSAGING', 5, 'DRAFT', 'EASY', 5, '{"meta":{"name":"Formdan"}}', now())`,
      [`e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`, slugs.clash, neighborhood.id],
    );
    write({ ...scenario("Çakışan"), slug: slugs.clash });
    const output = seed();
    expect(output).toContain(`${slugs.clash}.json): aynı adreste türü ya da şablonu farklı bir oda var`);
    expect(await labOf(slugs.clash)).toMatchObject({ status: "DRAFT", sourceHash: null });

    // Yönetimdeki form dosyadan gelen odada dosyanın yolunu söyler; formla açılan odada söylemez.
    const email = uniqueEmail("oda-dosyasi");
    await signUpVerified(page, email);
    await makeAdmin(email);
    await page.goto(`/yonetim/odalar/${lab.id}`);
    await expect(page.getByText("Bu oda depodaki dosyadan gelir")).toBeVisible();
    await expect(page.getByText(`labs/rooms/${neighborhood.slug}/${slugs.scenario}.json`)).toBeVisible();
    await page.goto(`/yonetim/odalar/${(await labOf(slugs.clash)).id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Bu oda depodaki dosyadan gelir")).toHaveCount(0);
  } finally {
    await withDb(async (client) => {
      const labs = `SELECT "id" FROM "Lab" WHERE "neighborhoodId" = $1`;
      await client.query(`DELETE FROM "LabVersion" WHERE "labId" IN (${labs})`, [neighborhood.id]);
      await client.query(`UPDATE "Lab" SET "unlockedById" = NULL WHERE "neighborhoodId" = $1`, [neighborhood.id]);
      await client.query(`DELETE FROM "Lab" WHERE "neighborhoodId" = $1`, [neighborhood.id]);
      await client.query(`DELETE FROM "Neighborhood" WHERE "id" = $1`, [neighborhood.id]);
    });
  }
});
