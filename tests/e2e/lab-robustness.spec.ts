import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { callAction, callActionBurst, callFormAction } from "./support/actions";
import { deleteTestLabs, makeAdmin } from "./support/admin";
import { withDb } from "./support/db";

// Faz 6: lab yönetiminin ve eğitim labının sağlamlığı (güvenlik turu 2'den kalanlar D8, D9, D10,
// B1). Eylemler arayüzün yanında elle hazırlanmış istekle de çağrılır (tarayıcı konsolundan
// yapılabilecek olan budur). Yalnızca yerel üretim derlemesine karşı.
//
// Veritabanı başka koşularla ortaktır: testler kendi açtıkları labları ("e2e-" adresli) ve
// mahalleleri siler; kayıt defteri silinmez.

test.skip(isLive, "veritabanına yazan ve hesap açan testler canlı sitede çalışmaz");


const kargo = JSON.parse(readFileSync("labs/examples/sahte-kargo-maili.json", "utf8")).content;
const training = JSON.parse(readFileSync("labs/examples/oltalama-egitimi.json", "utf8")).content as {
  cards: { id: string; type: string; question?: string }[];
};

const stamp = () => `${Date.now().toString(36)}${process.pid.toString(36)}${randomUUID().slice(0, 4)}`;
const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });

type Result = { ok: boolean; error?: string; reason?: string; revision?: unknown; version?: number; card?: number };

async function signUpAdmin(page: Page) {
  const email = uniqueEmail("saglamlik-yonetici");
  await signUpVerified(page, email);
  await makeAdmin(email);
  return email;
}

async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return ((await withDb((client) => client.query(sql, params)))?.rows ?? []) as T[];
}

/** Gelen kutusu labının içeriği: örnek kargo labının kopyası, verilen adla. */
function inboxContent(name: string, change: (content: typeof kargo) => void = () => {}) {
  const content = structuredClone(kargo);
  content.meta.name = name;
  change(content);
  return content;
}

/**
 * Hesap Kalesi'ne (ilk mahalle; örnek veride eğitim labı yok, öğrenciye kilitli) taslak senaryo labı ekler (veritabanına doğrudan: formun yazmayacağı,
 * şemaya uymayan içerik de yazılabilir). Adresi "e2e-" ile başlar.
 */
async function insertInboxLab(content: unknown) {
  const id = newId();
  const slug = `e2e-saglamlik-${stamp()}`;
  await query(
    `INSERT INTO "Lab" ("id", "slug", "neighborhoodId", "type", "template", "sortOrder", "status", "difficulty", "durationMin", "draftContent", "updatedAt")
     SELECT $1, $2, n."id", 'SCENARIO', 'INBOX', 900, 'DRAFT', 'EASY', 8, $3::jsonb, now() FROM "Neighborhood" n WHERE n."slug" = 'hesap-kalesi'`,
    [id, slug, JSON.stringify(content)],
  );
  return { id, slug };
}

const draftOf = async (id: string) =>
  (await query<{ draftContent: { meta: { name: string; summary: string } } }>(`SELECT "draftContent" FROM "Lab" WHERE "id" = $1`, [id]))[0]
    .draftContent;
const versionsOf = (id: string) =>
  query<{ version: number; content: { meta: { summary: string } } }>(`SELECT "version", "content" FROM "LabVersion" WHERE "labId" = $1 ORDER BY "version"`, [id]);

/** Öğrencinin haritasında görünmeyecek kadar sonda geçici bir mahalle (testin sonunda silinir). */
async function insertNeighborhood() {
  const id = newId();
  const slug = `e2e-mahalle-${stamp()}`;
  await query(
    `INSERT INTO "Neighborhood" ("id", "slug", "name", "color", "sortOrder") VALUES ($1, $2, $3, 'accent', 9000 + floor(random() * 900)::int)`,
    [id, slug, `E2E Mahalle ${slug}`],
  );
  return { id, slug };
}

async function deleteNeighborhood(id: string) {
  await withDb(async (client) => {
    const labs = `SELECT "id" FROM "Lab" WHERE "neighborhoodId" = $1`;
    await client.query(`DELETE FROM "LabAttempt" WHERE "labId" IN (${labs})`, [id]);
    await client.query(`DELETE FROM "TrainingProgress" WHERE "labId" IN (${labs})`, [id]);
    await client.query(`DELETE FROM "LabVersion" WHERE "labId" IN (${labs})`, [id]);
    await client.query(`DELETE FROM "Lab" WHERE "neighborhoodId" = $1`, [id]);
    await client.query(`DELETE FROM "Neighborhood" WHERE "id" = $1`, [id]);
  });
}

const insertTraining = (neighborhoodId: string) =>
  query(
    `INSERT INTO "Lab" ("id", "slug", "neighborhoodId", "type", "template", "sortOrder", "status", "difficulty", "durationMin", "draftContent", "updatedAt")
     VALUES ($1, $2, $3, 'TRAINING', 'TRAINING', 0, 'DRAFT', 'EASY', 5, '{"meta":{"name":"E2E eğitim"}}', now())`,
    [newId(), `e2e-egitim-${stamp()}`, neighborhoodId],
  );

// ---------------------------------------------------------------------------------------
// D8: okunamayan taslak
// ---------------------------------------------------------------------------------------

test("D8: okunamayan taslak uyarıyla açılır; kaydetme ve yayınlama onun üstüne yazmaz", async ({ page }) => {
  // Şema sıkılaşınca (ör. bağlantı adresinde artık boşluk olmaz) eski taslak okunamaz hale gelir.
  const broken = inboxContent(`E2E Bozuk ${stamp()}`, (c) => {
    c.items[0].link.url = "kargo teslimat tr.xyz/adres";
  });
  const lab = await insertInboxLab(broken);
  try {
    await signUpAdmin(page);
    await page.goto(`/yonetim/odalar/${lab.id}`);
    const alert = page.getByRole("alert").filter({ hasText: "Taslak okunamadı" });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("items.0.link.url");
    await expect(page.getByRole("button", { name: "Kaydet", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: /olarak yayınla$/ })).toBeDisabled();

    // Arayüz kapalı olsa da eylem elle çağrılabilir: sunucu da reddeder, üstüne yazmaya zorlansa bile.
    const valid = inboxContent(broken.meta.name);
    const saved = (await callAction(page.request, "saveLabDraft", [lab.id, valid, 0, true], "/yonetim/odalar")) as Result;
    expect(saved).toMatchObject({ ok: false, error: "unreadable" });
    const published = (await callAction(page.request, "publishLab", [lab.id, { content: valid, revision: 0, force: true }], "/yonetim/odalar")) as Result;
    expect(published).toMatchObject({ ok: false, error: "unreadable" });
    expect((await draftOf(lab.id)).meta.name).toBe(broken.meta.name);
    expect(JSON.stringify(await draftOf(lab.id))).toContain("kargo teslimat tr.xyz/adres");
    expect(await versionsOf(lab.id)).toEqual([]);

    // Listede de görünür ve "Yayınla" yayına hazır saymaz.
    await page.goto("/yonetim/odalar");
    await page.getByRole("switch", { name: "Taslak odaları göster" }).click();
    await expect(page.getByText(`Taslak okunamadı`).first()).toBeVisible();
  } finally {
    await deleteTestLabs({ slug: lab.slug });
  }
});

// ---------------------------------------------------------------------------------------
// D9: aynı anda düzenleme
// ---------------------------------------------------------------------------------------

test("D9: aynı taslak sürümüyle gelen eşzamanlı kaydetmelerden yalnızca biri yazılır", async ({ page }) => {
  const name = `E2E Eşzamanlı ${stamp()}`;
  const lab = await insertInboxLab(inboxContent(name));
  try {
    await signUpAdmin(page);
    const first = (await callAction(page.request, "saveLabDraft", [lab.id, inboxContent(name), 0, true], "/yonetim/odalar")) as Result;
    expect(first.ok).toBe(true);

    const results = (await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        callAction(page.request, "saveLabDraft", [lab.id, inboxContent(name, (c) => (c.meta.summary = `Özet ${n}`)), first.revision, false], "/yonetim/odalar"),
      ),
    )) as Result[];
    const winners = results.flatMap((r, i) => (r.ok ? [i + 1] : []));
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => !r.ok).map((r) => r.error)).toEqual(["conflict", "conflict", "conflict", "conflict"]);
    expect((await draftOf(lab.id)).meta.summary).toBe(`Özet ${winners[0]}`);

    // Eski sürümle bir daha kaydetmek de çakışmadır; dönen yeni sürümle kaydetmek yazar.
    const stale = (await callAction(page.request, "saveLabDraft", [lab.id, inboxContent(name), first.revision, false], "/yonetim/odalar")) as Result;
    expect(stale).toMatchObject({ ok: false, error: "conflict" });
  } finally {
    await deleteTestLabs({ slug: lab.slug });
  }
});

test("D9: listedeki Yayınla, liste açıldıktan sonra değişen taslağı yayınlamaz; yeniledikten sonra yayınlar", async ({ page }) => {
  const name = `E2E Liste ${stamp()}`;
  const lab = await insertInboxLab(inboxContent(name));
  try {
    await signUpAdmin(page);
    await page.goto("/yonetim/odalar");
    await page.getByRole("switch", { name: "Taslak odaları göster" }).click();
    const publish = page.getByRole("button", { name: `Yayınla: ${name}` });
    await expect(publish).toBeVisible();

    // Liste açıkken başka bir sekmede (ya da başka biri) taslağı değiştirir.
    const changed = inboxContent(name, (c) => (c.meta.summary = "Başka sekmede değişen özet"));
    const saved = (await callAction(page.request, "saveLabDraft", [lab.id, changed, 0, true], "/yonetim/odalar")) as Result;
    expect(saved.ok).toBe(true);

    await publish.click();
    const dialog = page.getByRole("dialog", { name: `${name} odasını yayınla` });
    await dialog.getByRole("button", { name: "Yayınla", exact: true }).click();
    await expect(toast(page, /sen bakarken değişti/)).toBeVisible();
    expect(await versionsOf(lab.id)).toEqual([]);

    // Liste kendini yeniler (sayfa yeniden yüklenmeden): yeni hali yeniden yayınlayınca o hal yayına
    // girer. Yenileme arka planda biter; ondan önceki tıklama yine çakışma der, sonraki yayınlar.
    await expect(async () => {
      await publish.click();
      await dialog.getByRole("button", { name: "Yayınla", exact: true }).click();
      await expect(toast(page, `${name} yayında`)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    const versions = await versionsOf(lab.id);
    expect(versions.map((v) => v.version)).toEqual([1]);
    expect(versions[0].content.meta.summary).toBe("Başka sekmede değişen özet");
  } finally {
    await deleteTestLabs({ slug: lab.slug });
  }
});

// ---------------------------------------------------------------------------------------
// D10: mahallede birden çok eğitim (15 Ekim; eski "tek eğitim" indeksi kalktı)
// ---------------------------------------------------------------------------------------

test("D10: veritabanı bir mahallede ikinci eğitimi kabul eder; silinen eğitim senaryonun bağını boşaltır", async () => {
  const neighborhood = await insertNeighborhood();
  try {
    await insertTraining(neighborhood.id);
    const advanced = newId();
    await query(
      `INSERT INTO "Lab" ("id", "slug", "neighborhoodId", "type", "template", "sortOrder", "status", "difficulty", "durationMin", "draftContent", "updatedAt")
       VALUES ($1, $2, $3, 'TRAINING', 'TRAINING', 1, 'DRAFT', 'EASY', 5, '{"meta":{"name":"E2E ileri eğitim"}}', now())`,
      [advanced, `e2e-ileri-${stamp()}`, neighborhood.id],
    );
    const scenario = newId();
    await query(
      `INSERT INTO "Lab" ("id", "slug", "neighborhoodId", "type", "template", "sortOrder", "unlockedById", "status", "difficulty", "durationMin", "draftContent", "updatedAt")
       VALUES ($1, $2, $3, 'SCENARIO', 'INBOX', 1, $4, 'DRAFT', 'EASY', 5, '{"meta":{"name":"E2E senaryo"}}', now())`,
      [scenario, `e2e-senaryo-${stamp()}`, neighborhood.id, advanced],
    );
    // Açan eğitim silinirse senaryo temel eğitime bağlanır (alan boşalır, lib/lab/gates.ts).
    await query(`DELETE FROM "Lab" WHERE "id" = $1`, [advanced]);
    const rows = await query<{ unlockedById: string | null }>(`SELECT "unlockedById" FROM "Lab" WHERE "id" = $1`, [scenario]);
    expect(rows[0].unlockedById).toBeNull();
  } finally {
    await deleteNeighborhood(neighborhood.id);
  }
});

test("D10: aynı anda gelen 'Yeni lab' isteklerinin hepsi eğitim açar; sıraları ayrı, yalnızca biri temel eğitim", async ({ page }) => {
  const neighborhood = await insertNeighborhood();
  try {
    await signUpAdmin(page);
    const fields = (n: number) => ({ neighborhood: neighborhood.slug, template: "TRAINING", name: `E2E Eğitim ${stamp()} ${n}` });
    // Başarılı olan lab sayfasına yönlendirir; yanıtında okunacak bir sonuç yoktur.
    const results = (await Promise.all(
      [1, 2, 3].map((n) => callFormAction(page.request, "createLab", fields(n), "/yonetim/odalar/yeni").catch(() => undefined)),
    )) as ({ error?: string } | undefined)[];
    const labs = await query<{ sortOrder: number }>(`SELECT "sortOrder" FROM "Lab" WHERE "neighborhoodId" = $1 AND "type" = 'TRAINING' ORDER BY "sortOrder"`, [
      neighborhood.id,
    ]);
    // Bir mahallede birden çok eğitim olabilir (15 Ekim); mahalle satırı kilitlendiği için sıralar ayrıdır.
    expect(labs.map((l) => l.sortOrder)).toEqual([0, 1, 2]);
    expect(results.filter((r) => r?.error)).toEqual([]);
  } finally {
    await deleteNeighborhood(neighborhood.id);
  }
});

// ---------------------------------------------------------------------------------------
// B1: eğitim labının bitişi
// ---------------------------------------------------------------------------------------

const quizIndex = training.cards.findIndex((c) => c.type === "quiz");
const quiz = training.cards[quizIndex];

const progressOf = async (email: string) =>
  (
    await query<{ completedAt: Date | null }>(
      `SELECT p."completedAt" FROM "TrainingProgress" p JOIN "User" u ON u."id" = p."userId" JOIN "Lab" l ON l."id" = p."labId"
       WHERE u."email" = $1 AND l."slug" = 'oltalama-egitimi'`,
      [email],
    )
  )[0] ?? null;

test("B1: eğitim, soruları cevaplanmadan 'son kart' kaydedilerek bitirilemez", async ({ page }) => {
  const email = uniqueEmail("saglamlik-egitim");
  await signUpVerified(page, email);

  const skipped = (await callAction(page.request, "saveTrainingProgress", ["oltalama-egitimi", training.cards.length])) as Result;
  expect(skipped).toMatchObject({ ok: false, reason: "unanswered", card: quizIndex });
  expect((await progressOf(email))?.completedAt ?? null).toBeNull();

  // Yanlış cevap da cevaptır: öğrenci oynatıcıda da yanlış cevapla devam edebilir.
  const answered = (await callAction(page.request, "checkTrainingAnswer", ["oltalama-egitimi", quiz.id, 0])) as Result;
  expect(answered.ok).toBe(true);
  const finished = (await callAction(page.request, "saveTrainingProgress", ["oltalama-egitimi", training.cards.length])) as Result;
  // Bitiş, bu bitişle kazanılan rozetleri de söyler (oynatıcı bildirim gösterir).
  expect(finished).toEqual({ ok: true, badges: ["kart-kurdu"] });
  expect((await progressOf(email))?.completedAt).not.toBeNull();
});

test("B1: aynı soruya aynı anda gelen cevaplar kartı bir kez yazar; sorusuz ya da başka labın kartı yazılmaz (güvenlik turu 5)", async ({
  page,
  baseURL,
}) => {
  const email = uniqueEmail("saglamlik-yaris");
  await signUpVerified(page, email);
  const answeredOf = async () =>
    (
      await query<{ answeredCards: string[] }>(
        `SELECT p."answeredCards" FROM "TrainingProgress" p JOIN "User" u ON u."id" = p."userId" JOIN "Lab" l ON l."id" = p."labId"
         WHERE u."email" = $1 AND l."slug" = 'oltalama-egitimi'`,
        [email],
      )
    )[0]?.answeredCards ?? null;

  // Sorusuz kart (bilgi), başka labın kartı ve olmayan kart: geçersiz, hiçbir şey yazılmaz.
  const info = training.cards.find((c) => c.type === "info")!;
  for (const [slug, cardId] of [
    ["oltalama-egitimi", info.id],
    ["oltalama-egitimi", "olmayan-kart"],
    ["sahte-kargo-maili", quiz.id],
  ]) {
    expect(await callAction(page.request, "checkTrainingAnswer", [slug, cardId, 0])).toEqual({ ok: false, reason: "invalid" });
  }
  expect(await answeredOf()).toBeNull();

  // Aynı anda 40 cevap (betik, çift tıklama, iki sekme): kart listede bir kez durur. Eski kod önce
  // okuyup sonra ekliyordu; aynı anda gelenlerin bir kısmı "yok" görüp ekliyordu. Turlar sırayla
  // ilk cevap (satır yok) ve eğitime başlamış öğrenci (kaldığı kart kayıtlı, henüz cevap yok).
  // Yarış zamanlamaya bağlı olduğu için birkaç tur denenir (eski kod ikinci turda düşüyordu).
  for (let round = 0; round < 6; round++) {
    await query(
      `DELETE FROM "TrainingProgress" p USING "User" u, "Lab" l WHERE u."id" = p."userId" AND l."id" = p."labId" AND u."email" = $1 AND l."slug" = 'oltalama-egitimi'`,
      [email],
    );
    if (round % 2 === 1) {
      await query(
        `INSERT INTO "TrainingProgress" ("userId", "labId", "cardIndex") SELECT u."id", l."id", 0 FROM "User" u, "Lab" l WHERE u."email" = $1 AND l."slug" = 'oltalama-egitimi'`,
        [email],
      );
    }
    const results = (await callActionBurst(page, baseURL!, "checkTrainingAnswer", ["oltalama-egitimi", quiz.id, 0], 40)) as Result[];
    expect(results.filter((r) => r?.ok)).toHaveLength(40);
    expect(await answeredOf()).toEqual([quiz.id]);
  }

  // Sonraki cevaplar da listeyi büyütmez.
  await callActionBurst(page, baseURL!, "checkTrainingAnswer", ["oltalama-egitimi", quiz.id, 1], 5);
  expect(await answeredOf()).toEqual([quiz.id]);
});

test("B1: soruyu atlayarak son karta gelen öğrenci bitirince soruya geri götürülür", async ({ page }) => {
  const email = uniqueEmail("saglamlik-atlama");
  await signUpVerified(page, email);
  // Kaldığı kart son kart (ör. eski bir sürümde soru yoktu ya da ilerleme elle yazıldı).
  await query(
    `INSERT INTO "TrainingProgress" ("userId", "labId", "cardIndex") SELECT u."id", l."id", $2 FROM "User" u, "Lab" l WHERE u."email" = $1 AND l."slug" = 'oltalama-egitimi'`,
    [email, training.cards.length - 1],
  );

  await page.goto("/oda/oltalama-egitimi/oyna");
  const player = page.getByTestId("training-player");
  await player.getByRole("button", { name: "Bitir", exact: true }).click();
  await expect(toast(page, "Eğitimi bitirmeden önce bu soruyu cevapla.")).toBeVisible();
  await expect(player.getByText(quiz.question!)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eğitim odası bitti!" })).toHaveCount(0);
  expect((await progressOf(email))?.completedAt ?? null).toBeNull();

  await player.getByRole("group", { name: "Cevaplar" }).getByRole("button").first().click();
  for (let i = quizIndex; i < training.cards.length; i++) await player.getByRole("button", { name: /^(Devam|Bitir)$/ }).click();
  await expect(page.getByRole("heading", { name: "Eğitim odası bitti!" })).toBeVisible();
  expect((await progressOf(email))?.completedAt).not.toBeNull();
});
