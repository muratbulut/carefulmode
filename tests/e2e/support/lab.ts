import { expect, type Page } from "@playwright/test";
import { withDb } from "./db";

/**
 * Öğrencinin mahalledeki eğitim labını bitmiş sayar (senaryo labları ancak eğitimden sonra
 * açılır). Eğitimin kendisi lab.spec.ts'te arayüzden baştan sona oynanır; diğer testler beklemesin.
 */
export async function finishTraining(email: string, slug = "oltalama-egitimi") {
  await withDb((client) =>
    client.query(
      `INSERT INTO "TrainingProgress" ("userId", "labId", "cardIndex", "completedAt")
       SELECT u.id, l.id, 99, now() FROM "User" u, "Lab" l WHERE u.email = $1 AND l.slug = $2
       ON CONFLICT ("userId", "labId") DO UPDATE SET "completedAt" = now()`,
      [email, slug],
    ),
  );
}

/** Öğrencinin bu labdaki denemeleri ve olayları (sunucuda ne kaydedildiğini görmek için). */
export async function attemptsOf(email: string, slug: string) {
  const result = await withDb((client) =>
    client.query<{ id: string; status: string; reportScore: number | null; events: string }>(
      `SELECT a.id, a.status, a."reportScore",
              coalesce((SELECT json_agg(json_build_object('type', e.type, 'data', e.data) ORDER BY e.seq)::text FROM "LabEvent" e WHERE e."attemptId" = a.id), '[]') AS events
       FROM "LabAttempt" a JOIN "User" u ON u.id = a."userId" JOIN "Lab" l ON l.id = a."labId"
       WHERE u.email = $1 AND l.slug = $2 ORDER BY a."startedAt"`,
      [email, slug],
    ),
  );
  return result?.rows ?? [];
}

/**
 * Görevli odanın kapağı (/oda/[oda], MissionCover): sağda (telefonda üstte) arayanın gelen arama
 * ekranı ve hikâye kartları görünür, bildirim telefonu yoktur, sayfa yana kaymaz; içerikteki gizli
 * metinler (SMS tutarı, bitiş aramaları) sayfaya gelmez.
 */
export async function checkMissionCover(page: Page, slug: string, caller: string, secrets: string[]) {
  await page.goto(`/oda/${slug}`);
  const cover = page.getByRole("img", { name: `${caller} arıyor` }).filter({ visible: true });
  await expect(cover).toHaveCount(1);
  await expect(page.getByRole("img", { name: /uygulamasına gelen bildirimler$/ }).filter({ visible: true })).toHaveCount(0);
  const box = await cover.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const html = await page.content();
  for (const secret of secrets) expect(html).not.toContain(secret);
}

/**
 * Alarmdan sonraki sonuç sahnesi (19 ve 22. revize): "Adım adım ne oldu" yok; telefonda sahne
 * (para, kart, hesap ya da adres) oynar, öğrenci "Devam" deyince rapor açılır.
 */
export async function continueFromScene(page: Page, scene?: "money" | "card" | "account" | "home") {
  const view = page.getByTestId("hacked-scene");
  await expect(view).toBeVisible();
  if (scene) await expect(view).toHaveAttribute("data-scene", scene);
  await view.getByRole("button", { name: "Devam" }).click();
  await expect(page.getByTestId("lab-report")).toBeVisible();
}

/**
 * Rapor adım adım gelir (14. revize): 1 Odada ne oldu, 2 kaçırdığın ya da yakaladığın işaretler,
 * 3 Bir dahaki sefere. "Sonraki" ile istenen adıma gelinir; düğmeler (Tekrar dene, sonraki oda)
 * son adımdadır.
 */
export async function reportStep(page: Page, step: "steps" | "signs" | "tips") {
  const journey = page.getByTestId("report-journey");
  for (let i = 0; i < 3; i++) {
    if ((await journey.getAttribute("data-step")) === step) return;
    await page.getByRole("button", { name: "Sonraki" }).filter({ visible: true }).first().click();
  }
  await expect(journey).toHaveAttribute("data-step", step);
}
