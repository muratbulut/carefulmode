import { expect, test, type Page } from "@playwright/test";
import { isLive, signUpVerified, uniqueEmail } from "./support/account";
import { withDb } from "./support/db";

// Gündem (Faz 5): yönetimde haber yazma, kontrol listesi, önizleme ve planlama; herkese açık liste,
// haber sayfası, tanıtım sayfası ve öğrenci ana sayfası; okuma sayısı ve kayıt defteri.
//
// Testler ortak yerel veritabanında aynı anda (masaüstü ve telefon) koşar: her haberin başlığı ve
// adresi benzersizdir, iki proje farklı yayın haftalarını kullanır ve tablonun boş olduğu
// varsayılmaz. Açılan haberler testin sonunda silinir; kayıt defteri silinmez.

const toast = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text, visible: true });

/** Bu testin haberine özgü ek: "E2E-gündem ..." başlıkları ve "e2e-gundem-..." adresleri. */
function stampOf(project: string) {
  return `${Date.now().toString(36)}${process.pid.toString(36)}${Math.random().toString(36).slice(2, 6)}-${project}`;
}

/**
 * Yayın haftası seçeneğinin sırası (0 "Henüz seçme"). Masaüstü ve telefon aynı anda koşar; aynı
 * haftaya planlayıp birbirinin haberini taslağa döndürmesinler.
 */
const weekIndex = (project: string) => (project === "mobile" ? 7 : 6);

const readyContent = {
  whatsHappening:
    "Son haftalarda kargo teslim edilemedi diye başlayan kısa mesajlar yine çoğaldı. Mesajdaki link sahte bir sayfaya gidiyor ve kart bilgisi istiyor.",
  example: { sender: "0532 xxx xx xx", text: "Paketiniz teslim edilemedi: kargo-teslimat-tr.xyz" },
  signs: [
    { sign: "Gönderen kişisel bir numara.", explanation: "Kargo firmaları kendi adıyla yazar." },
    { sign: "Acele ettiriyor.", explanation: "Süre baskısı düşünmeden tıklaman için." },
    { sign: "Link firmanın adresi değil.", explanation: "Adresi baştan sona oku." },
  ],
  actions: ["Takibi firmanın kendi uygulamasından yap.", "SMS'teki linke dokunma."],
  takeaways: ["Teslim edilemedi diyen SMS sahte olabilir.", "Gönderen numaraya ve adrese bak.", "Takibi uygulamadan yap."],
};

type Inserted = { id: string; slug: string; title: string };

/** Veritabanına doğrudan haber yazar (yazar, testin açtığı hesap). */
async function insertArticle(opts: {
  authorEmail: string;
  title: string;
  slug: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED";
  publishedAt: Date | null;
  sourceUrl?: string;
  lab?: string;
}): Promise<Inserted> {
  const rows = await withDb(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO "NewsArticle" ("id", "slug", "title", "summary", "content", "sourceName", "sourceUrl", "neighborhoodId", "relatedLabId", "status", "publishedAt", "authorId", "updatedAt")
       SELECT 'e2e-' || md5(random()::text), $1, $2, $3, $4::jsonb, 'USOM duyuruları', $5,
              (SELECT "id" FROM "Neighborhood" WHERE "slug" = 'oltalama-limani'),
              (SELECT "id" FROM "Lab" WHERE "slug" = $6),
              $7::"ArticleStatus", $8, u."id", now()
         FROM "User" u WHERE u."email" = $9
       RETURNING "id"`,
      [
        opts.slug,
        opts.title,
        "Paketiniz teslim edilemedi diyen mesajlardaki linkler sahte sitelere gidiyor.",
        JSON.stringify(readyContent),
        opts.sourceUrl ?? "https://www.usom.gov.tr/duyurular",
        opts.lab ?? "",
        opts.status,
        opts.publishedAt,
        opts.authorEmail,
      ],
    );
    return rows;
  });
  if (!rows?.[0]) throw new Error("haber yazılamadı");
  return { id: rows[0].id, slug: opts.slug, title: opts.title };
}

async function deleteArticles(ids: string[]) {
  if (ids.length === 0) return;
  await withDb((client) => client.query(`DELETE FROM "NewsArticle" WHERE "id" = ANY($1)`, [ids]));
}

async function articleRow(id: string) {
  const rows = await withDb(async (client) => {
    const { rows } = await client.query<{ status: string; slug: string; publishedAt: Date | null; readCount: number }>(
      `SELECT "status", "slug", "publishedAt", "readCount" FROM "NewsArticle" WHERE "id" = $1`,
      [id],
    );
    return rows;
  });
  return rows?.[0] ?? null;
}

async function auditActions(id: string) {
  const rows = await withDb(async (client) => {
    const { rows } = await client.query<{ action: string }>(`SELECT "action" FROM "AuditLog" WHERE "target" = $1 ORDER BY "createdAt"`, [`news:${id}`]);
    return rows;
  });
  return (rows ?? []).map((r) => r.action);
}

/** Hesaba ekip izni verir (yönetimdeki Kullanıcılar ekranı başka bir testte sınanır). */
async function grant(email: string, permission: "NEWS" | "TIPS") {
  await withDb((client) =>
    client.query(
      `INSERT INTO "TeamPermission" ("userId", "permission", "grantedById")
       SELECT "id", $2::"TeamPermissionType", "id" FROM "User" WHERE "email" = $1
       ON CONFLICT DO NOTHING`,
      [email, permission],
    ),
  );
}

async function expectNotFound(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bu sayfa yok");
}

/** Editördeki formu hazır bir haberle doldurur (kaynak adresi ayrıca yazılır). */
async function fillArticle(page: Page, title: string) {
  await page.getByLabel("Başlık", { exact: true }).fill(title);
  await page.getByLabel("Özet", { exact: true }).fill("Oyunlarda tanımadığın biri hediye kartı vaat edip telefonuna gelen kodu istiyor.");
  await page
    .getByLabel("Ne oluyor?", { exact: true })
    .fill("Çok oyunculu oyunların sohbetinde hediye kartı vaat eden mesajlar arttı.\nKarşıdaki kişi önce arkadaş gibi davranıyor, sonra telefonuna gelen kodu istiyor.");
  await page.getByLabel("Örnek mesaj · gönderen").fill("OyunArkadaşı_42");
  await page.getByLabel("Örnek mesaj · metin").fill("Selam! Sana hediye kartı göndericem, sadece telefonuna gelen kodu yaz yeter.");
  const signs = [
    ["Tanımadığın biri hediye veriyor.", "Karşılıksız hediye çok nadirdir."],
    ["Kod ya da şifre istiyor.", "Hediye göndermek için senin kodun gerekmez."],
    ["Sohbeti oyun dışına taşıyor.", "Seni oyunun korumasından çıkarmak istiyor."],
  ];
  for (const [i, [sign, why]] of signs.entries()) {
    await page.getByLabel(`İşaret ${i + 1}`, { exact: true }).fill(sign);
    await page.getByLabel(`İşaret ${i + 1} açıklaması`).fill(why);
  }
  await page.getByLabel("Ne yapmalısın?", { exact: true }).fill("Tanımadığın kişiye kod verme.\nMesajı oyuna bildir.");
  const takeaways = ["Oyun sohbetinde kod isteyenler var.", "Hediye için senin kodun gerekmez.", "Mesajı bildir, bir büyüğüne söyle."];
  for (const [i, text] of takeaways.entries()) await page.getByLabel(`Kısaca, madde ${i + 1}`).fill(text);
  await page.getByLabel("Konu", { exact: true }).selectOption({ label: "Oltalama" });
  await page.getByLabel("Bunu odada dene (oda)").selectOption({ index: 1 });
  await page.getByLabel("Kaynak adı").fill("Emniyet Siber Suçlarla Mücadele");
}

test.describe("gündem", () => {
  test.skip(isLive, "veritabanına yazan ve hesap açan testler canlı sitede çalışmaz");


  test("Gündem izni olmayan öğrenci ve yalnızca İpucu izni olan ekip üyesi gündem yönetimini görmez", async ({ page }) => {
    const email = uniqueEmail("gundem-yok");
    await signUpVerified(page, email);
    for (const path of ["/yonetim/gundem", "/yonetim/gundem/yeni"]) await expectNotFound(page, path);

    await grant(email, "TIPS");
    for (const path of ["/yonetim/gundem", "/yonetim/gundem/yeni", "/yonetim/gundem/olmayan-haber"]) await expectNotFound(page, path);
    await expect(page).toHaveTitle(/Sayfa bulunamadı/);
  });

  // Faz 5 bitti ölçütü (gündem): haber formdan yazılır, güvenilir olmayan kaynakla planlanamaz,
  // önizlenir ve planlanır; aynı haftaya ikinci haber öncekini taslağa döndürür; her işlem kayıt
  // defterine yazılır; planlı haber yayın anına kadar herkese kapalıdır.
  test("Gündem izni olan ekip üyesi haberi yazar, kontrol listesinden geçirir, önizler ve planlar", async ({ page, isMobile }, testInfo) => {
    test.slow();
    const project = testInfo.project.name;
    const stamp = stampOf(project);
    const title = `E2E-gündem hediye kartı ${stamp}`.slice(0, 70);
    const created: string[] = [];
    const email = uniqueEmail("gundem-yazar");
    try {
      await signUpVerified(page, email);
      await grant(email, "NEWS");

      await page.goto("/yonetim/gundem");
      await expect(page.getByRole("heading", { level: 1, name: "Gündem" })).toBeVisible();
      await page.getByRole("link", { name: "Yeni haber" }).click();
      await page.waitForURL("/yonetim/gundem/yeni");
      await expect(page.getByRole("heading", { level: 1, name: "Yeni haber" })).toBeVisible();

      // Başlıksız taslak kaydedilmez.
      await page.getByRole("button", { name: "Taslak kaydet" }).click();
      await expect(page.getByText("Başlık olmadan kaydedemezsin.")).toBeVisible();

      await fillArticle(page, title);
      // Güvenilir listede olmayan, benzer görünen adres: uyarı çıkar, planlanamaz.
      await page.getByLabel("Kaynak adresi").fill("https://gov.tr.evil.com/duyuru");
      await expect(page.getByRole("alert").filter({ hasText: "güvenilir kaynak listesinde değil" })).toBeVisible();
      await page.getByLabel("Yayın haftası").selectOption({ index: weekIndex(project) });
      const checklist = page.getByRole("region", { name: "Yayına hazır mı?" });
      await expect(checklist.locator('[data-check="trustedSource"]')).toContainText("Eksik");
      await expect(checklist.locator('[data-check="titleSummary"]')).toContainText("Tamam");
      const planButton = page.getByRole("button", { name: /için planla$/ });
      await expect(planButton).toBeDisabled();

      // Eksikle taslak kaydedilir; adres haberin kendi adresine döner.
      await page.getByRole("button", { name: "Taslak kaydet" }).click();
      await expect(toast(page, "Taslak kaydedildi.")).toBeVisible();
      await expect(page).toHaveURL(/\/yonetim\/gundem\/(?!yeni)[^/]+$/);
      const id = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
      created.push(id);
      expect((await articleRow(id))?.status).toBe("DRAFT");

      // Kaynağı düzelt, haftayı seç: planlanabilir.
      await page.getByLabel("Kaynak adresi").fill("https://www.egm.gov.tr/siber/e2e");
      await expect(page.getByText("www.egm.gov.tr güvenilir kaynak listesinde.")).toBeVisible();
      await page.getByLabel("Yayın haftası").selectOption({ index: weekIndex(project) });
      await expect(checklist.locator('[data-check="trustedSource"]')).toContainText("Tamam");
      await expect(planButton).toBeEnabled();

      // Önizleme: öğrencinin göreceği haber sayfası.
      await page.getByRole("button", { name: "Önizle" }).click();
      const preview = page.getByRole("dialog", { name: "Önizleme" });
      await expect(preview.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(preview.getByText("Öğrenci böyle görür").filter({ visible: true })).toBeVisible();
      await expect(preview.getByRole("status")).toHaveText("Yayına hazır");
      await expect(preview.getByText("Tanımadığın biri hediye veriyor.")).toBeVisible();
      if (!isMobile) {
        await preview.getByRole("button", { name: "Telefonda" }).click();
        await expect(preview.getByRole("button", { name: "Telefonda" })).toHaveAttribute("aria-pressed", "true");
      }
      await preview.getByRole("button", { name: "Düzenlemeye dön" }).click();
      await expect(preview).toHaveCount(0);

      await planButton.click();
      await expect(toast(page, /Cuma sabahı yayınlanacak\./)).toBeVisible();
      await expect(page.getByText("Planlandı", { exact: true })).toBeVisible();
      const scheduled = await articleRow(id);
      expect(scheduled?.status).toBe("SCHEDULED");
      expect(scheduled?.slug).toMatch(/^e2e-gundem-hediye-karti-/);
      expect(scheduled?.publishedAt?.getUTCDay()).toBe(5);
      expect(scheduled?.publishedAt?.getUTCHours()).toBe(5);
      // Her eylem kayıt defterine bir satır: taslağı açmak ve (içerikle birlikte) planlamak.
      expect(await auditActions(id)).toEqual(["news.created", "news.scheduled"]);

      // Planlı haber yayın anına kadar herkese kapalı.
      await expectNotFound(page, `/gundem/${scheduled!.slug}`);
      await page.goto("/gundem");
      await expect(page.getByText(title)).toHaveCount(0);

      // Aynı haftaya ikinci haber: önceki taslağa döner (uyarılır), "Geri al" iki haberi eski haline getirir.
      const second = await insertArticle({ authorEmail: email, title: `E2E-gündem ikinci ${stamp}`.slice(0, 70), slug: `_taslak-e2e-${stamp}`, status: "DRAFT", publishedAt: null, sourceUrl: "https://www.usom.gov.tr/duyurular" });
      created.push(second.id);
      await page.goto(`/yonetim/gundem/${second.id}`);
      await expect(page.getByRole("heading", { level: 1, name: "Haberi düzenle" })).toBeVisible();
      const week = page.getByLabel("Yayın haftası");
      await week.selectOption({ index: weekIndex(project) });
      await expect(week.locator("option:checked")).toContainText("dolu: E2E-gündem");
      await expect(page.getByText("O haftada başka bir haber var")).toBeVisible();
      await page.getByRole("button", { name: /için planla$/ }).click();
      const bumpToast = toast(page, "O haftadaki haber taslağa döndü");
      await expect(bumpToast).toBeVisible();
      expect((await articleRow(id))?.status).toBe("DRAFT");
      expect((await articleRow(second.id))?.status).toBe("SCHEDULED");
      expect(await auditActions(id)).toContain("news.unscheduled");

      await bumpToast.getByRole("button", { name: "Geri al" }).click();
      await expect(toast(page, "Geri alındı.")).toBeVisible();
      expect((await articleRow(id))?.status).toBe("SCHEDULED");
      expect((await articleRow(second.id))?.status).toBe("DRAFT");

      // Listede: Planlı sekmesinde ilk haber; taslak silinir ve geri alınır.
      await page.goto("/yonetim/gundem?sekme=planli");
      await expect(page.getByRole("tab", { name: /Planlı/ })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("link", { name: `Düzenle: ${title}` })).toBeVisible();
      await page.getByRole("tab", { name: /Taslak/ }).click();
      await page.getByRole("button", { name: `Taslağı sil: ${second.title}` }).click();
      const deleted = toast(page, "Taslak silindi");
      await expect(deleted).toBeVisible();
      await expect(page.getByRole("link", { name: `Düzenle: ${second.title}` })).toHaveCount(0);
      expect(await articleRow(second.id)).toBeNull();
      expect(await auditActions(second.id)).toContain("news.deleted");
      await deleted.getByRole("button", { name: "Geri al" }).click();
      await expect(page.getByRole("link", { name: `Düzenle: ${second.title}` })).toBeVisible();
      expect((await articleRow(second.id))?.status).toBe("DRAFT");
    } finally {
      await deleteArticles(created);
    }
  });

  // 4 Kasım, 15: kapak görseli her boyutta seçilir; tarayıcı yeniden çizer (en çok 1600 px, WebP),
  // EXIF (konum, cihaz) gider. Odak noktası, alt metin ve kaynak taslakla kaydedilir.
  test("kapak görseli küçültülüp WebP'ye çevrilir, EXIF silinir; odak noktası ve alt metin kaydedilir", async ({ page }, testInfo) => {
    test.slow();
    const stamp = stampOf(testInfo.project.name);
    const title = `E2E-gündem kapak ${stamp}`.slice(0, 70);
    const created: string[] = [];
    const email = uniqueEmail("gundem-kapak");
    try {
      await signUpVerified(page, email);
      await grant(email, "NEWS");
      await page.goto("/yonetim/gundem/yeni");
      await expect(page.getByText("Görsel eklemek için önce taslağı kaydet.")).toBeVisible();
      await page.getByLabel("Başlık", { exact: true }).fill(title);
      await page.getByRole("button", { name: "Taslak kaydet" }).click();
      await expect(toast(page, "Taslak kaydedildi.")).toBeVisible();
      await expect(page).toHaveURL(/\/yonetim\/gundem\/(?!yeni)[^/]+$/);
      const id = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
      created.push(id);

      // 2400 x 1350 JPEG, içine konum bilgisi taşıyan bir EXIF bölümü eklenmiş.
      const base64 = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 2400;
        canvas.height = 1350;
        const context = canvas.getContext("2d")!;
        context.fillStyle = "rgb(30 120 200)";
        context.fillRect(0, 0, 2400, 1350);
        context.fillStyle = "rgb(240 200 40)";
        context.fillRect(1600, 200, 500, 500);
        return canvas.toDataURL("image/jpeg", 0.9).split(",")[1];
      });
      const original = Buffer.from(base64, "base64");
      const marker = Buffer.from("GPSLatitude-e2e-konum");
      const exif = Buffer.concat([Buffer.from("Exif\0\0"), marker]);
      const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff]), exif]);
      const file = Buffer.concat([original.subarray(0, 2), app1, original.subarray(2)]);
      expect(file.includes(marker)).toBe(true);

      await page.locator('input[type="file"]').setInputFiles({ name: "tatil-fotografi.jpg", mimeType: "image/jpeg", buffer: file });
      await expect(toast(page, "Kapak görseli eklendi.")).toBeVisible();
      const focus = page.getByTestId("cover-focus");
      await expect(focus).toHaveAttribute("aria-label", "Odak noktası: soldan yüzde 50, üstten yüzde 50");

      const cover = await withDb(async (client) => {
        const { rows } = await client.query<{ mimeType: string; width: number; height: number; data: Buffer }>(
          `SELECT "mimeType", "width", "height", "data" FROM "NewsCover" WHERE "articleId" = $1`,
          [id],
        );
        return rows[0];
      });
      expect(cover).toMatchObject({ mimeType: "image/webp", width: 1600, height: 900 });
      expect(cover!.data.subarray(0, 4).toString()).toBe("RIFF");
      expect(cover!.data.includes(marker)).toBe(false);

      // Taslağın kapağını yalnızca Gündem izni olan görür; tür baytlardan.
      const src = await focus.locator("img").getAttribute("src");
      expect(src).toMatch(new RegExp(`^/api/kapak/${id}\\?v=`));
      const response = await page.request.get(src!);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/webp");
      expect(response.headers()["cache-control"]).toContain("no-store");

      // Odak noktası: sağ üstteki sarı kareye tıkla; ok tuşuyla 5 kaydır.
      const box = (await focus.boundingBox())!;
      await focus.click({ position: { x: box.width * 0.75, y: box.height * 0.25 } });
      await expect(focus).toHaveAttribute("aria-label", "Odak noktası: soldan yüzde 75, üstten yüzde 25");
      await focus.press("ArrowRight");
      await expect(focus).toHaveAttribute("aria-label", "Odak noktası: soldan yüzde 80, üstten yüzde 25");
      await page.getByLabel("Alt metin").fill("Mavi zemin üstünde sarı bir kare");
      await page.getByLabel("Görselin kaynağı").fill("Ekip çizimi");

      // Önizlemede kapak, alt metniyle ve odak noktasından kırpılmış.
      await page.getByRole("button", { name: "Önizle" }).click();
      const preview = page.getByRole("dialog", { name: "Önizleme" });
      const shown = preview.getByRole("img", { name: "Mavi zemin üstünde sarı bir kare" });
      await expect(shown).toBeVisible();
      await expect(shown).toHaveCSS("object-position", "80% 25%");
      await expect(preview.getByText("Görsel: Ekip çizimi")).toBeVisible();
      await preview.getByRole("button", { name: "Düzenlemeye dön" }).click();

      await page.getByRole("button", { name: "Taslak kaydet" }).click();
      await expect(toast(page, "Taslak kaydedildi.")).toBeVisible();
      const meta = await withDb(async (client) => {
        const { rows } = await client.query(`SELECT "coverFocusX", "coverFocusY", "coverAlt", "coverCredit" FROM "NewsArticle" WHERE "id" = $1`, [id]);
        return rows[0];
      });
      expect(meta).toEqual({ coverFocusX: 80, coverFocusY: 25, coverAlt: "Mavi zemin üstünde sarı bir kare", coverCredit: "Ekip çizimi" });

      // Başka hesap (izinsiz) taslağın kapağını göremez.
      const outsider = await page.context().browser()!.newContext();
      expect((await outsider.request.get(new URL(src!, page.url()).href)).status()).toBe(404);
      await outsider.close();

      // Kaldır: haber konunun çizimiyle görünür.
      await page.getByRole("button", { name: "Kaldır", exact: true }).click();
      await expect(toast(page, /Kapak görseli kaldırıldı/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Görsel seç" })).toBeVisible();
      expect(await auditActions(id)).toEqual(["news.created", "news.updated", "news.updated", "news.updated"]);
    } finally {
      await deleteArticles(created);
    }
  });

  test("yayındaki haber gündemde, sayfasında, tanıtımda ve öğrencinin ana sayfasında; taslak ve planlı haber kapalı", async ({ page, context }, testInfo) => {
    test.slow();
    const stamp = stampOf(testInfo.project.name);
    const created: string[] = [];
    const email = uniqueEmail("gundem-okur");
    try {
      // Yazar olarak bir hesap gerekir (haberin yazarı); haberler doğrudan veritabanına yazılır.
      await signUpVerified(page, email);
      await context.clearCookies({ name: /better-auth\./ });

      const sourceUrl = `https://www.usom.gov.tr/duyurular/e2e-${stamp}`;
      const live = await insertArticle({
        authorEmail: email,
        title: `E2E-gündem yayında ${stamp}`.slice(0, 70),
        slug: `e2e-gundem-yayinda-${stamp}`,
        status: "PUBLISHED",
        publishedAt: new Date(Date.now() - 60_000),
        sourceUrl,
        lab: "sahte-kargo-maili",
      });
      created.push(live.id);
      const draft = await insertArticle({ authorEmail: email, title: `E2E-gündem taslak ${stamp}`.slice(0, 70), slug: `e2e-gundem-taslak-${stamp}`, status: "DRAFT", publishedAt: null });
      created.push(draft.id);
      const future = await insertArticle({
        authorEmail: email,
        title: `E2E-gündem gelecek ${stamp}`.slice(0, 70),
        slug: `e2e-gundem-gelecek-${stamp}`,
        status: "SCHEDULED",
        publishedAt: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
      });
      created.push(future.id);

      // Ziyaretçi: gündem listesi
      await page.goto("/gundem");
      await expect(page.getByRole("heading", { level: 1, name: "Gündem" })).toBeVisible();
      await expect(page.getByRole("link", { name: new RegExp(live.title) })).toBeVisible();
      await expect(page.getByText(draft.title)).toHaveCount(0);
      await expect(page.getByText(future.title)).toHaveCount(0);

      // Taslak ve yayın anı gelmemiş haber yok.
      await expectNotFound(page, `/gundem/${draft.slug}`);
      await expectNotFound(page, `/gundem/${future.slug}`);

      // Haber sayfası; okuma bir kez sayılır.
      await page.goto(`/gundem/${live.slug}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(live.title);
      await expect(page).toHaveTitle(new RegExp(live.title));
      await expect(page.getByRole("heading", { name: "Ne oluyor?" })).toBeVisible();
      await expect(page.getByText("Gönderen kişisel bir numara.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Kayıt ol ve dene" })).toBeVisible();
      await expect.poll(async () => (await articleRow(live.id))?.readCount, { timeout: 15_000 }).toBe(1);

      // Kaynağa gitmeden önce "ayrılıyorsun" penceresi; bağlantı yeni sekmede, yönlendireni bildirmeden.
      await page.getByRole("button", { name: "Kaynağa git" }).click();
      const leave = page.getByRole("dialog", { name: /sitesinden ayrılıyorsun/ });
      await expect(leave).toBeVisible();
      await expect(leave.getByText(sourceUrl)).toBeVisible();
      await expect(leave.getByText("Resmi kurumların adresi .gov.tr ile biter.", { exact: false })).toBeVisible();
      const go = leave.getByRole("link", { name: /Siteye git/ });
      await expect(go).toHaveAttribute("href", sourceUrl);
      await expect(go).toHaveAttribute("target", "_blank");
      await expect(go).toHaveAttribute("rel", "noopener noreferrer nofollow");
      await leave.getByRole("button", { name: "Vazgeç" }).click();
      await expect(leave).toBeHidden();

      // Aynı gün ikinci açılış sayılmaz.
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(live.title);
      await page.waitForTimeout(1500);
      expect((await articleRow(live.id))?.readCount).toBe(1);

      // Tanıtım sayfasındaki "Gündemde"
      await page.goto("/");
      const section = page.getByRole("region", { name: "Bu hafta neler oldu?" });
      await expect(section.getByRole("link", { name: new RegExp(live.title) })).toBeVisible();
      await expect(section.getByText(draft.title)).toHaveCount(0);

      // Öğrenci: ana sayfadaki gündem kartı en yeni haberi gösterir; haber sayfasında "Odaya gir".
      await page.goto("/giris");
      await page.getByLabel("E-posta").fill(email);
      await page.getByLabel("Şifre", { exact: true }).fill("Mavi!Kedi7Deniz");
      await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
      await page.waitForURL("/");
      const latest = await withDb(async (client) => {
        const { rows } = await client.query<{ title: string }>(
          `SELECT "title" FROM "NewsArticle" WHERE "status" IN ('SCHEDULED', 'PUBLISHED') AND "publishedAt" <= now() ORDER BY "publishedAt" DESC, "id" ASC LIMIT 1`,
        );
        return rows[0]?.title;
      });
      await page.reload();
      await expect(page.getByRole("heading", { level: 3, name: latest }).filter({ visible: true })).toBeVisible();
      await page.goto(`/gundem/${live.slug}`);
      await expect(page.getByRole("link", { name: "Odaya gir" })).toHaveAttribute("href", "/oda/sahte-kargo-maili");
      expect((await articleRow(live.id))?.readCount).toBe(1);
    } finally {
      await deleteArticles(created);
    }
  });
});
