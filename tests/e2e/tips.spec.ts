import { expect, test, type Page } from "@playwright/test";
import { addDays, turkeyDay } from "../../lib/tips/schedule";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { withDb } from "./support/db";

// Günün ipucu (Faz 5): yönetimdeki C3 ekranı ve öğrencinin kartı. Veritabanı paralel koşularla
// ortaktır: testler havuzun boş olduğunu varsaymaz, kendi ipuçlarını uzak bir güne sabitler (böylece
// hiçbiri bugünün ipucu olmaz) ve yalnızca kendi açtıklarını siler.

const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const label = (day: string) => `${Number(day.slice(8, 10))} ${months[Number(day.slice(5, 7)) - 1]}`;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Next önceki sayfaları gizli olarak bellekte tutar; bildirimler yalnızca görünenler arasından aranır.
const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });

type Permission = "TIPS" | "NEWS";

/** Hesaba yönetim ekibi izni verir (kendi kendine; veren kişi zorunlu alan). */
async function grant(email: string, permission: Permission) {
  await withDb((client) =>
    client.query(
      `INSERT INTO "TeamPermission" ("userId", "permission", "grantedById")
       SELECT "id", $2::"TeamPermissionType", "id" FROM "User" WHERE "email" = $1
       ON CONFLICT DO NOTHING`,
      [email, permission],
    ),
  );
}

async function tipOf(text: string) {
  const rows = await withDb(async (client) =>
    (await client.query<{ id: string; status: string; pinned: string | null }>(
      `SELECT "id", "status", to_char("pinnedDate", 'YYYY-MM-DD') AS "pinned" FROM "DailyTip" WHERE "text" = $1`,
      [text],
    )).rows,
  );
  return rows?.[0] ?? null;
}

/** Bu kişinin yazdığı ve hiç gösterilmemiş ipuçlarını siler (görülme satırları da gider). */
async function deleteTipsBy(email: string) {
  await withDb((client) =>
    client.query(
      `DELETE FROM "DailyTip" t USING "User" u
        WHERE t."authorId" = u."id" AND u."email" = $1
          AND NOT EXISTS (SELECT 1 FROM "TipDay" d WHERE d."tipId" = t."id")`,
      [email],
    ),
  );
}

const today = () => turkeyDay(new Date());

async function todayTipId(): Promise<string | null> {
  const rows = await withDb(async (client) => (await client.query<{ tipId: string }>(`SELECT "tipId" FROM "TipDay" WHERE "date" = $1::date`, [today()])).rows);
  return rows?.[0]?.tipId ?? null;
}

/**
 * Bugünün ipucu olsun: havuzda bugün çıkabilecek ipucu yoksa (boş veritabanı) hazır gelen ipucunun
 * aynısı havuza eklenir. Gün, sayfa açılınca seçilir ve TipDay'e yazılır.
 */
async function ensureTodayTip(page: Page, email: string): Promise<{ id: string; text: string }> {
  if (!(await todayTipId())) {
    await withDb((client) =>
      client.query(
        `INSERT INTO "DailyTip" ("id", "text", "reason", "status", "authorId", "createdAt", "updatedAt")
         SELECT $1, $2, $3, 'POOL', u."id", now(), now() FROM "User" u
          WHERE u."email" = $4
            AND NOT EXISTS (SELECT 1 FROM "DailyTip" WHERE "status" = 'POOL' AND ("pinnedDate" IS NULL OR "pinnedDate" <= $5::date))`,
        [
          `e2e-tip-${Date.now().toString(36)}-${process.pid}`,
          'Doğrulama kodunu isteyen kişi "banka" ya da "öğretmen" olsa bile kodu kimseye söyleme.',
          "Doğrulama kodu, hesabına girişin son kilididir. Kodu bilen kişi şifreni bilmese de hesabına girebilir. Gerçek bir banka ya da okul bu kodu asla sormaz.",
          email,
          today(),
        ],
      ),
    );
    await page.goto("/");
  }
  await expect.poll(todayTipId, { message: "bugünün ipucu seçilmedi" }).not.toBeNull();
  const id = (await todayTipId())!;
  const rows = await withDb(async (client) => (await client.query<{ text: string }>(`SELECT "text" FROM "DailyTip" WHERE "id" = $1`, [id])).rows);
  return { id, text: rows![0].text };
}

async function viewOf(email: string, tipId: string, day: string) {
  const rows = await withDb(async (client) =>
    (await client.query<{ reasonViewed: boolean }>(
      `SELECT v."reasonViewed" FROM "TipView" v JOIN "User" u ON u."id" = v."userId"
        WHERE u."email" = $1 AND v."tipId" = $2 AND v."date" = $3::date`,
      [email, tipId, day],
    )).rows,
  );
  return rows?.[0] ?? null;
}

async function hasBadge(email: string, code: string) {
  const rows = await withDb(async (client) =>
    (await client.query(`SELECT 1 FROM "EarnedBadge" b JOIN "User" u ON u."id" = b."userId" WHERE u."email" = $1 AND b."badgeCode" = $2`, [email, code])).rows,
  );
  return (rows?.length ?? 0) > 0;
}

test("giriş yapmamış ziyaretçi ipucu yönetimi yerine girişe gönderilir", async ({ page }) => {
  await page.goto("/yonetim/ipucu");
  await expect(page).toHaveURL(/\/giris\?sonra=%2Fyonetim%2Fipucu$/);
});

test.describe("günün ipucu", () => {
  test.skip(isLive, "hesap açan testler canlı sitede çalışmaz");


  test("öğrenci ve ipucu izni olmayan ekip üyesi ipucu yönetimini göremez", async ({ page }) => {
    const email = uniqueEmail("ipucu-izinsiz");
    await signUpVerified(page, email);
    await page.goto("/yonetim/ipucu");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");

    // Gündem izni yönetime sokar ama ipucu sayfasını açmaz.
    await grant(email, "NEWS");
    await page.goto("/yonetim/ipucu");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
    await expect(page).toHaveTitle(/Sayfa bulunamadı/);

    await grant(email, "TIPS");
    await page.goto("/yonetim/ipucu");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Günün ipucu");
  });

  test("ipucu sorumlusu ipucu yazar, havuza ekler, güne sabitler, arşive kaldırır; her adım geri alınır ve kayda geçer", async ({ page }, testInfo) => {
    test.slow();
    const email = uniqueEmail("ipucu");
    const mobile = testInfo.project.name === "mobile";
    const stamp = `${Date.now().toString(36)}${process.pid.toString(36)}`;
    const text = `E2E ${testInfo.project.name} ${stamp}: bağlantıya tıklamadan önce adresi oku.`;
    const reason = "Sahte mesajlardaki bağlantı, gerçeğine benzeyen başka bir adrese gider.";
    // Uzak bir gün (paralel koşan iki proje ayrı aralıkta): bu ipucu hiçbir zaman bugünün ipucu olmaz.
    const farDay = addDays(today(), (mobile ? 281 : 200) + Math.floor(Math.random() * 80));
    // Şeritten seçilecek gün: masaüstü 2., telefon 5. kart.
    const stripIndex = mobile ? 4 : 1;
    const nearDay = addDays(today(), stripIndex + 1);

    try {
      await signUpVerified(page, email);
      await grant(email, "TIPS");
      await page.goto("/yonetim/ipucu");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Günün ipucu");

      // Yeni ipucu: kısa metin uyarısı, canlı önizleme, taslak
      await page.getByRole("button", { name: "Yeni ipucu" }).click();
      const editor = page.getByRole("dialog", { name: "Yeni ipucu" });
      await editor.getByLabel("İpucu", { exact: true }).fill("Kısa ipucu");
      await editor.getByRole("button", { name: "Taslak kaydet" }).click();
      await expect(editor.getByText("İpucu en az 20 karakter olsun.")).toBeVisible();
      await expect(editor.getByText('"Neden?" açıklaması en az 20 karakter olsun.')).toBeVisible();
      await editor.getByLabel("İpucu", { exact: true }).fill(text);
      await editor.getByLabel('"Neden?" açıklaması').fill(reason);
      // Önizleme öğrencinin kartıdır.
      const preview = page.getByRole("heading", { name: "Günün ipucu", level: 3 }).filter({ visible: true }).locator("xpath=ancestor::section[1]");
      await expect(preview.getByRole("paragraph").first()).toHaveText(text);
      await preview.getByRole("button", { name: "Neden?" }).click();
      await expect(preview.getByText(reason, { exact: true })).toBeVisible();
      await editor.getByRole("button", { name: "Taslak kaydet" }).click();
      await expect(toast(page, "Taslak kaydedildi, öğrencilere gitmez.")).toBeVisible();

      const row = page.getByRole("button", { name: new RegExp(escape(text)) });
      await expect(row).toContainText("Taslak");
      await expect(row).toContainText("Öğrenciye gitmez");
      const id = (await tipOf(text))!.id;
      expect(await tipOf(text)).toMatchObject({ status: "DRAFT", pinned: null });

      // Havuza ekle, uzak bir güne sabit
      await row.click();
      const edit = page.getByRole("dialog", { name: "İpucunu düzenle" });
      await edit.getByLabel("Ne zaman gösterilsin?").selectOption("other");
      await edit.getByLabel("Gösterileceği gün").fill(farDay);
      await edit.getByRole("button", { name: "Havuza ekle" }).click();
      await expect(toast(page, `Kaydedildi, ${label(farDay)} günü gösterilecek.`)).toBeVisible();
      await expect(row).toContainText("Havuzda");
      await expect(row).toContainText(`${label(farDay)} · sabit`);
      expect(await tipOf(text)).toMatchObject({ status: "POOL", pinned: farDay });

      // Sıradaki günler: bir güne bu ipucunu seç, sonra geri al
      const strip = page.getByRole("region", { name: "Sıradaki 6 gün" });
      await strip.getByRole("listitem").nth(stripIndex).getByRole("button").click();
      const picker = page.getByRole("dialog", { name: new RegExp(`^${label(nearDay)} `) });
      await picker.getByRole("button", { name: new RegExp(escape(text)) }).click();
      await expect(toast(page, `${label(nearDay)} için ipucu sabitlendi.`)).toBeVisible();
      await expect(strip.getByRole("listitem").nth(stripIndex)).toContainText(text);
      expect(await tipOf(text)).toMatchObject({ pinned: nearDay });
      // Kaydırılan şerit sayfayı yana taşırmaz (telefonda yatay kaydırma yok).
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
      await toast(page, "için ipucu sabitlendi.").getByRole("button", { name: "Geri al" }).click();
      await expect(toast(page, "Geri alındı.")).toBeVisible();
      await expect.poll(async () => (await tipOf(text))?.pinned).toBe(farDay);

      // Arşive kaldır ve geri al
      await row.click();
      await edit.getByRole("button", { name: "Arşive kaldır" }).click();
      await expect(toast(page, "İpucu arşive kaldırıldı, sıradaki günler yeniden dağıtıldı.")).toBeVisible();
      await expect(row).toHaveCount(0);
      expect(await tipOf(text)).toMatchObject({ status: "ARCHIVED", pinned: null });
      await toast(page, "arşive kaldırıldı").getByRole("button", { name: "Geri al" }).click();
      await expect(toast(page, "Geri alındı.")).toBeVisible();
      await expect(row).toContainText("Havuzda");
      expect(await tipOf(text)).toMatchObject({ status: "POOL", pinned: farDay });

      // Arşiv ayrıca gösterilir
      await row.click();
      await edit.getByRole("button", { name: "Arşive kaldır" }).click();
      await expect(toast(page, "İpucu arşive kaldırıldı")).toBeVisible();
      await page.getByRole("button", { name: /^Arşivi göster/ }).click();
      await expect(row).toContainText("Arşivde");

      // Kayıt defteri: her işlem ve her geri alma
      const entries = await withDb(async (client) =>
        (await client.query<{ action: string; undo: boolean }>(
          `SELECT "action", coalesce(("details"->>'undo')::boolean, false) AS "undo" FROM "AuditLog" WHERE "target" = $1 ORDER BY "createdAt"`,
          [`tip:${id}`],
        )).rows,
      );
      expect(entries?.map((e) => e.action)).toEqual(["tip.created", "tip.pooled", "tip.pinned", "tip.pinned", "tip.archived", "tip.pooled", "tip.archived"]);
      expect(entries?.map((e) => e.undo)).toEqual([false, false, false, true, false, true, false]);
    } finally {
      await deleteTipsBy(email);
    }
  });

  test("öğrenci ana sayfada bugünün ipucunu görür; Neden? kaydedilir ve 7. günde Meraklı rozeti gelir", async ({ page, browser }) => {
    test.slow();
    const email = uniqueEmail("merakli");
    await signUpVerified(page, email);
    const tip = await ensureTodayTip(page, email);
    const day = today();

    // Önceki altı gün "Neden?"e bakmış say (farklı günler).
    await withDb((client) =>
      client.query(
        `INSERT INTO "TipView" ("userId", "tipId", "date", "reasonViewed")
         SELECT u."id", $2, d::date, true FROM "User" u, unnest($3::text[]) AS d WHERE u."email" = $1`,
        [email, tip.id, [1, 2, 3, 4, 5, 6].map((n) => addDays(day, -n))],
      ),
    );
    expect(await hasBadge(email, "merakli")).toBe(false);

    await page.goto("/");
    const card = page.getByRole("heading", { name: "Günün ipucu", level: 3 }).filter({ visible: true }).locator("xpath=ancestor::section[1]");
    await expect(card).toContainText(tip.text);
    // Kartı görmek günde bir görülme satırı yazar (yanıttan sonra).
    await expect.poll(() => viewOf(email, tip.id, day)).toEqual({ reasonViewed: false });

    await card.getByRole("button", { name: "Neden?" }).click();
    await expect(card.getByRole("button", { name: "Kapat" })).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => viewOf(email, tip.id, day)).toEqual({ reasonViewed: true });
    await expect.poll(() => hasBadge(email, "merakli")).toBe(true);

    // Ziyaretçi de aynı ipucunu görür (kayıt tutulmaz).
    const visitor = await browser.newContext();
    try {
      const visitorPage = await visitor.newPage();
      await visitorPage.goto("/");
      await expect(visitorPage.getByRole("region", { name: "Günün ipucu" })).toContainText(tip.text);
    } finally {
      await visitor.close();
    }
  });
});
