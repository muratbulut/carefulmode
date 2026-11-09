import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { isLive, signUp, signUpVerified, uniqueEmail } from "./support/account";
import { withDb } from "./support/db";
import { layoutProblems, smallTargets } from "./support/layout";
import { createSchool, makeCoordinator, makeTeacher } from "./support/teacher";

// Telefon düzeni (Faz 6, "mobil kontrol"): her ekran 390 px telefonda yatay kaydırma yapmadan,
// ekran dışına taşmadan ve bir kutunun kenarında kesilmeden açılır; yana kaydırılan şeritteki seçili
// sekme görünür; açık pencere ekrana sığar, alt menü sayfanın son satırını örtmez (support/layout.ts).
// Ekranlar aşağıdaki listelerdedir: yeni bir ekran ya da pencere eklenince buraya da yazılır.
//
// Her rol için tek bir test, ekranları sırayla gezer ve sorunları sonunda toplu bildirir (bir
// ekrandaki sorun ötekilerin denetimini durdurmaz). LAYOUT_SHOTS=<klasör> verilirse her ekranın
// görüntüsünü oraya kaydeder (görsel inceleme için; görüntüler depoya girmez). LAYOUT_TARGETS=1
// verilirse 40 px'ten küçük dokunma alanlarını da yazar.

type Screen<D> = {
  /** Raporda ve görüntü dosyasında görünen ad. */
  name: string;
  /** Açılacak adres; verilmezse bir önceki ekranın sayfasında kalınır (adım adım akışlar). */
  path?: string | ((data: D) => string);
  /** Sayfa açıldıktan sonra: pencere, menü ya da sekme açmak için. */
  open?: (page: Page, data: D) => Promise<unknown>;
  /** Kendiliğinden geçen ekran (hacklendin alarmı): animasyonlar beklenmez, hemen bakılır. */
  brief?: boolean;
};

const shotsDir = process.env.LAYOUT_SHOTS;
const reportTargets = !!process.env.LAYOUT_TARGETS;

/**
 * Sayfa yüklendi, sonradan gelen içerik (yükleniyor blokları) yerine oturdu ve sonlu animasyonlar
 * bitti (sonsuz döngüdekiler beklenmez).
 */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1, main, [role=dialog], dialog[open]").first()).toBeVisible();
  // Durum ekranlarının önizlemesinde yükleniyor blokları hep durur; başka yerde gitmesi beklenir.
  if (!page.url().endsWith("/onizleme")) await expect(page.locator(".skeleton").filter({ visible: true })).toHaveCount(0, { timeout: 10_000 });
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/**
 * Kendi içinde kaydırılan büyük alanlar (telefonda tam ekran açılan pencere, çekmece, bölüm):
 * bütün sayfa görüntüsüne girmedikleri için adım adım kaydırılıp ayrıca görüntülenir.
 */
async function scrollerShots(page: Page, file: string) {
  const scrollers = page.locator("body *").filter({ visible: true });
  const count = await scrollers.evaluateAll((els) => {
    let n = 0;
    for (const el of els) {
      const style = getComputedStyle(el);
      if (!/(auto|scroll)/.test(style.overflowY) || el.clientHeight < 300 || el.scrollHeight <= el.clientHeight + 40) continue;
      el.setAttribute("data-layout-scroller", String(n++));
    }
    return n;
  });
  for (let i = 0; i < count; i++) {
    const scroller = page.locator(`[data-layout-scroller="${i}"]`);
    const { scrollHeight, clientHeight } = await scroller.evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    const step = Math.round(clientHeight * 0.8);
    for (let top = step, part = 1; top - step < scrollHeight - clientHeight; top += step, part++) {
      await scroller.evaluate((el, y) => el.scrollTo(0, y), top);
      await page.screenshot({ path: `${file}-k${i + 1}-${part}.png`, animations: "disabled" });
    }
    await scroller.evaluate((el) => {
      el.scrollTo(0, 0);
      el.removeAttribute("data-layout-scroller");
    });
  }
}

/** Görüntü dosyalarının sıra numarası (aynı grup birkaç parçada gezilince sıra sürer). */
const shotCount = new Map<string, number>();

async function visit<D>(page: Page, group: string, screens: Screen<D>[], data: D) {
  const failures: string[] = [];
  for (const screen of screens) {
    await test.step(screen.name, async () => {
      const target = typeof screen.path === "function" ? screen.path(data) : screen.path;
      if (target) {
        await page.goto(target);
        await settle(page);
      }
      if (screen.open) {
        await screen.open(page, data);
        if (screen.brief) await page.waitForTimeout(1_200);
        else await settle(page);
      }
      if (shotsDir) {
        mkdirSync(shotsDir, { recursive: true });
        const index = (shotCount.get(group) ?? 0) + 1;
        shotCount.set(group, index);
        const file = path.join(shotsDir, `${group}-${String(index).padStart(2, "0")}-${screen.name.replace(/[^\p{L}\p{N}]+/gu, "-")}`);
        // Açık pencere varsa ekranın görünen hali, yoksa bütün sayfa.
        const dialogOpen = (await page.locator("[role=dialog], [role=alertdialog], dialog[open]").filter({ visible: true }).count()) > 0;
        await page.screenshot({ path: `${file}.png`, fullPage: !dialogOpen, animations: "disabled" });
        await scrollerShots(page, file);
      }
      const problems = await layoutProblems(page);
      for (const p of problems) failures.push(`${screen.name} (${target ?? page.url()}): ${p.kind} ${p.detail}`);
      if (reportTargets) {
        for (const t of await smallTargets(page)) console.log(`[küçük] ${group} · ${screen.name}: ${t.size} ${t.detail}`);
      }
    });
  }
  expect(failures, failures.join("\n")).toEqual([]);
}

// ---------------------------------------------------------------------------
// Ziyaretçi ve hesap ekranları
// ---------------------------------------------------------------------------

type VisitorData = { article: string };

const visitorScreens: Screen<VisitorData>[] = [
  { name: "Tanıtım", path: "/" },
  { name: "Tanıtım, Daha fazla menüsü", path: "/", open: (page) => page.getByRole("button", { name: "Daha fazla" }).click() },
  { name: "Yol haritası", path: "/yol-haritasi" },
  { name: "Mahalle", path: "/yol-haritasi/oltalama-limani" },
  {
    name: "Mahalle, oda önizlemesi",
    path: "/yol-haritasi/oltalama-limani",
    open: (page) => page.getByRole("list", { name: "Oltalama Limanı rotası" }).getByRole("button", { name: /Sahte kargo maili/ }).click(),
  },
  {
    name: "Mahalle, kayıt penceresi",
    path: "/yol-haritasi/oltalama-limani",
    open: async (page) => {
      await page.getByRole("list", { name: "Oltalama Limanı rotası" }).getByRole("button", { name: /Sahte kargo maili/ }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Kayıt ol ve başla" }).click();
    },
  },
  { name: "Odalar", path: "/odalar" },
  { name: "Odalar, boş arama", path: "/odalar?ara=boyle-bir-lab-yok-xyz" },
  { name: "Odalar, filtre açık", path: "/odalar", open: (page) => page.getByRole("group", { name: "Filtre" }).getByRole("button", { name: /^Tür/ }).click() },
  { name: "Oda kapağı", path: "/oda/sahte-kargo-maili" },
  { name: "Gündem", path: "/gundem" },
  { name: "Haber", path: (d) => `/gundem/${d.article}` },
  { name: "Haber, siteden ayrılma penceresi", path: (d) => `/gundem/${d.article}`, open: (page) => page.getByRole("button", { name: "Kaynağa git" }).click() },
  { name: "SSS", path: "/sss" },
  { name: "SSS, Odalar", path: "/sss?konu=odalar", open: (page) => page.getByRole("button", { name: "Bir odada hacklenirsem ne olur?" }).click() },
  { name: "Öğretmenler için", path: "/ogretmenler" },
  { name: "KVKK", path: "/kvkk" },
  { name: "Gizlilik", path: "/gizlilik" },
  { name: "Kullanım koşulları", path: "/kosullar" },
  { name: "404", path: "/boyle-bir-sayfa-yok" },
  { name: "Durum ekranları", path: "/onizleme" },
  { name: "Yeni rozet bildirimi", path: "/onizleme", open: (page) => page.getByRole("button", { name: "Rozet bildirimini göster" }).click() },
  { name: "Kayıt ol", path: "/kayit" },
  { name: "Giriş yap", path: "/giris" },
  { name: "Şifre sıfırlama", path: "/sifre-sifirla" },
  {
    name: "Şifre sıfırlama, e-posta adımı",
    path: "/sifre-sifirla",
    open: (page) => page.getByRole("button", { name: "Anladım, başlayalım" }).click(),
  },
];

/** Haber (başlık ve özet uzunluk sınırında); yayında ya da taslak. Test sonunda silinir. */
async function insertArticle(authorEmail: string, status: "PUBLISHED" | "DRAFT" = "PUBLISHED") {
  const slug = `e2e-mobil-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const content = {
    whatsHappening: "Son haftalarda kargo teslim edilemedi diye başlayan kısa mesajlar yine çoğaldı. Mesajdaki link sahte bir sayfaya gidiyor.",
    example: { sender: "0532 xxx xx xx", text: "Paketiniz teslim edilemedi, adresinizi güncelleyin: kargo-teslimat-guncelleme-merkezi-tr.xyz/takip" },
    signs: [
      { sign: "Gönderen kişisel bir numara.", explanation: "Kargo firmaları kendi adıyla yazar." },
      { sign: "Acele ettiriyor.", explanation: "Süre baskısı düşünmeden tıklaman için." },
      { sign: "Link firmanın adresi değil.", explanation: "Adresi baştan sona oku." },
    ],
    actions: ["Takibi firmanın kendi uygulamasından yap.", "SMS'teki linke dokunma."],
    takeaways: ["Teslim edilemedi diyen SMS sahte olabilir.", "Gönderen numaraya ve adrese bak.", "Takibi uygulamadan yap."],
  };
  await withDb((client) =>
    client.query(
      `INSERT INTO "NewsArticle" ("id", "slug", "title", "summary", "content", "sourceName", "sourceUrl", "neighborhoodId", "relatedLabId", "status", "publishedAt", "authorId", "updatedAt")
       SELECT 'e2e-' || md5(random()::text), $1, $2, $3, $4::jsonb, 'Ulusal Siber Olaylara Müdahale Merkezi duyuruları', 'https://www.usom.gov.tr/duyurular',
              (SELECT "id" FROM "Neighborhood" WHERE "slug" = 'oltalama-limani'), (SELECT "id" FROM "Lab" WHERE "slug" = 'sahte-kargo-maili'),
              $6::"ArticleStatus", CASE WHEN $6 = 'PUBLISHED' THEN now() - interval '1 hour' END, u."id", now()
         FROM "User" u WHERE u."email" = $5`,
      [
        slug,
        "Kargo teslim edilemedi mesajlarıyla gelen sahte bağlantılar yine arttı",
        "Paketiniz teslim edilemedi diyen mesajlardaki bağlantılar sahte sitelere gidiyor ve kart bilgisi istiyor; gönderen numaraya ve adrese dikkat.",
        JSON.stringify(content),
        authorEmail,
        status,
      ],
    ),
  );
  return slug;
}


// ---------------------------------------------------------------------------
// Öğrenci
// ---------------------------------------------------------------------------

// Uzun metinli durumlar: ad 24 karakter (sınır), okul adı 90 karakter (sınır), sınıf adı 30.
const longName = "Muhammed Emirhan Karaoğl";
const longSchool = "Şehit Öğretmen Mehmet Ali Karaosmanoğlu Mesleki ve Teknik Anadolu Lisesi Bahçelievler Şb.";
const longClass = "Bilişim Teknolojileri 10-B Ş.";

const newId = () => `e2e${randomUUID().replace(/-/g, "").slice(0, 21)}`;
const joinAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const joinCode = () => Array.from(randomUUID().replace(/-/g, "").slice(0, 6), (c) => joinAlphabet[parseInt(c, 16) % joinAlphabet.length]).join("");

async function query(sql: string, params: unknown[] = []) {
  return (await withDb(async (client) => (await client.query(sql, params)).rows)) ?? [];
}

/** Doğrulanmış hesap (giriş yapmaz). */
async function insertUser(name: string, role: "STUDENT" | "TEACHER" = "STUDENT", schoolId: string | null = null) {
  const id = newId();
  await query(`INSERT INTO "User" ("id", "displayName", "email", "emailVerified", "role", "schoolId", "updatedAt", "lastActiveAt") VALUES ($1, $2, $3, true, $4, $5, now(), now())`, [
    id,
    name,
    `e2e-mobil-${id}@ornek.com`,
    role,
    schoolId,
  ]);
  return id;
}

/** Sınıf, açık ödevi (son tarihli) ve öğrencileri. */
async function insertClassroom(teacherId: string, name: string, studentIds: string[], { assignment = true } = {}) {
  const id = newId();
  const code = joinCode();
  await query(`INSERT INTO "Classroom" ("id", "name", "level", "teacherId", "joinCode") VALUES ($1, $2, '7. sınıf', $3, $4)`, [id, name, teacherId, code]);
  for (const userId of studentIds) await query(`INSERT INTO "ClassroomMembership" ("classroomId", "userId") VALUES ($1, $2)`, [id, userId]);
  if (assignment) {
    await query(
      `INSERT INTO "Assignment" ("id", "classroomId", "neighborhoodId", "dueDate") SELECT $1, $2, "id", now() + interval '6 days' FROM "Neighborhood" WHERE "slug" = 'oltalama-limani'`,
      [newId(), id],
    );
  }
  return { id, code };
}

/** Öğrencinin bitmiş bir senaryo denemesi (raporsuz; sınıf ilerlemesi için). */
async function insertFinishedAttempt(userId: string, status: "COMPLETED" | "HACKED") {
  await query(
    `INSERT INTO "LabAttempt" ("id", "userId", "labId", "labVersion", "status", "reportScore", "startedAt", "endedAt", "resultReport")
     SELECT $1, $2, l.id, l."publishedVersion", $3::"AttemptStatus", $4, now(), now(), '{}'::jsonb FROM "Lab" l WHERE l.slug = 'sahte-kargo-maili'`,
    [newId(), userId, status, status === "COMPLETED" ? 9 : 2],
  );
}

type StudentData = { code: string; report: string };

const trainingPath = "/oda/oltalama-egitimi/oyna";
const playPath = "/oda/sahte-kargo-maili/oyna";
/** Telefondaki "Bugün" şeridinin n. kartı (gündem haberi yoksa 0 ipucu, 1 rozet, 2 sınıf). */
const todayCard = (page: Page, n: number) => page.getByRole("region", { name: "Bugün" }).getByRole("listitem").nth(n);
const next = (page: Page) => page.getByTestId("training-player").getByRole("button", { name: /^(Devam|Bitir)$/ }).click();
/**
 * Eşleştirme ya da boşluk doldurma kartında sıradaki `count` yere kutudaki seçenekleri sırayla
 * koyar (bire bir eşleştirmede aynı seçenek bir öncekinden alınmasın diye her seferinde başkası).
 */
async function fillSlots(page: Page, count: number) {
  const bank = page.getByTestId("training-player").getByRole("group", { name: "Seçenekler" }).getByRole("button");
  const size = await bank.count();
  for (let i = 0; i < count; i++) await bank.nth(i % size).click();
}
/**
 * Kutudaki ilk seçeneği fareyle tutup son boşluğa (kutunun hemen üstündeki) bırakır: sürükle bırak
 * gerçek tarayıcıda da çalışsın.
 */
async function dragFirstOption(page: Page) {
  const player = page.getByTestId("training-player");
  const slot = player.locator("[data-slot]").last();
  const n = Number(await slot.getAttribute("data-slot")) + 1;
  const option = player.getByRole("group", { name: "Seçenekler" }).getByRole("button").first();
  const word = (await option.textContent()) ?? "";
  await option.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const from = await option.boundingBox();
  const to = await slot.boundingBox();
  if (!from || !to) throw new Error("Seçenek ya da boşluk görünmüyor");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  // Boşluk doldurmada cümle dolunca sıradakine geçilir; yerleşen kelimeyi duyuru söyler.
  await expect(player.getByText(`${n}. yer: ${word}`)).toBeAttached();
}
/**
 * Kalan yerleri doldurup kontrol eder (doğruluğu önemsiz; yanlış yerlerin doğrusu da görünsün).
 * Boşluk doldurmada cümleler tek tek gelir, "Kontrol et" sondaki özettedir.
 */
async function solvePlacement(page: Page) {
  const player = page.getByTestId("training-player");
  const check = player.getByRole("button", { name: "Kontrol et" });
  const bank = player.getByRole("group", { name: "Seçenekler" }).getByRole("button");
  // Boşluk doldurmada dolan cümleden sonra öğrenci kendisi geçer ("Sonraki cümle", sonda özete).
  const onward = player.getByRole("button", { name: /^(Sonraki cümle|Özete geç)/ });
  for (let i = 0; i < 16; i++) {
    if ((await check.isVisible()) && (await check.isEnabled())) break;
    if (await onward.isVisible()) await onward.click();
    else if (await bank.first().isVisible()) {
      await bank.nth(i % (await bank.count())).click();
      // Boşluk doldurmada dolan cümleden sonrakine geçişi bekle (yeniden tıklamak geçişi erteler).
      if (await player.getByRole("group", { name: "Cümleler" }).isVisible()) await page.waitForTimeout(800);
    } else await page.waitForTimeout(250);
  }
  await check.click();
  await expect(player.getByText(/doğru/).first()).toBeVisible();
}

/** Açılan maddeli bilgi kartında (keşfet, adım adım, banka kartı) maddeleri sırayla açar. */
async function openPoints(page: Page, list: string, count = 4) {
  const items = page.getByTestId("training-player").getByRole("list", { name: list }).getByRole("button");
  for (let i = 0; i < count; i++) await items.nth(i).click();
}

/**
 * Video kartının sorusunu cevaplar. Tarayıcı videoyu açamazsa soru videonun altında sorulur;
 * açarsa video soru saniyesine (`at`) atlatılır, durur ve soru videonun üstünde sorulur.
 */
async function answerVideo(page: Page, at: number, option: string) {
  const player = page.getByTestId("training-player");
  await page.waitForFunction(() => {
    const video = document.querySelector<HTMLVideoElement>('[data-testid="training-player"] video');
    return !video || video.readyState >= 1;
  });
  const video = player.locator("video");
  if (await video.count()) await video.evaluate((v: HTMLVideoElement, second) => void (v.currentTime = second), at);
  await player.getByRole("button", { name: option, exact: true }).click();
}

/** Kutulara ayırma kartında listedeki ilk `count` bilgiyi sırayla kutulara dağıtır (dokunarak). */
async function sortItems(page: Page, count: number) {
  const player = page.getByTestId("training-player");
  const tray = player.getByRole("group", { name: "Yerleştirilecek bilgiler" }).getByRole("button");
  for (let i = 0; i < count; i++) {
    await tray.first().click();
    await player.getByRole("button", { name: /^Seçili bilgiyi şuraya koy/ }).nth(i % 3).click();
  }
}
/** Kalan bilgileri kutulara koyup kontrol eder (doğruluğu önemsiz; yanlışların doğru kutusu da görünsün). */
async function solveSort(page: Page) {
  const player = page.getByTestId("training-player");
  const check = player.getByRole("button", { name: "Kontrol et" });
  for (let i = 0; i < 8 && !(await check.isEnabled()); i++) await sortItems(page, 1);
  await check.click();
  await expect(player.getByText(/doğru/).first()).toBeVisible();
}

const studentScreens: Screen<StudentData>[] = [
  { name: "Katılma sayfası", path: (d) => `/katil/${d.code}` },
  // Eğitim labı kart kart (ilerleme sunucuda; her kart bir öncekinin devamı).
  { name: "Eğitim, bilgi kartı", path: trainingPath },
  { name: "Eğitim, tıkla-bul kartı", open: next },
  {
    name: "Eğitim, tıkla-bul bulundu",
    open: async (page) => {
      const player = page.getByTestId("training-player");
      for (const part of ["address", "p2", "button"]) await player.locator(`[data-part="${part}"]`).click();
      await expect(player.getByText("Hepsini buldun!")).toBeVisible();
    },
  },
  { name: "Eğitim, test kartı", open: next },
  {
    name: "Eğitim, test cevaplandı",
    open: (page) => page.getByTestId("training-player").getByRole("group", { name: "Cevaplar" }).getByRole("button").nth(1).click(),
  },
  { name: "Eğitim, son kart", open: next },
  { name: "Eğitim, bitti", open: next },
  { name: "Ana sayfa", path: "/" },
  { name: "Ana sayfa, Bugün şeridinde rozet", path: "/", open: (page) => todayCard(page, 1).scrollIntoViewIfNeeded() },
  { name: "Ana sayfa, Bugün şeridinde sınıf", path: "/", open: (page) => todayCard(page, 2).scrollIntoViewIfNeeded() },
  { name: "Ana sayfa, hesap menüsü", path: "/", open: (page) => page.getByRole("banner").getByRole("button", { name: "Hesap menüsü" }).click() },
  { name: "Yol haritası", path: "/yol-haritasi" },
  { name: "Mahalle", path: "/yol-haritasi/oltalama-limani" },
  {
    name: "Mahalle, oda önizlemesi",
    path: "/yol-haritasi/oltalama-limani",
    open: (page) => page.getByRole("list", { name: "Oltalama Limanı rotası" }).getByRole("button", { name: /Sahte kargo maili/ }).click(),
  },
  { name: "Odalar", path: "/odalar" },
  { name: "Odalar, durum filtresi", path: "/odalar", open: (page) => page.getByRole("group", { name: "Filtre" }).getByRole("button", { name: /^Durum/ }).click() },
  { name: "Oda kapağı", path: "/oda/sahte-kargo-maili" },
  // Önce perde odanın adını yazar, sonra kutu gelir (18. revize).
  { name: "Oda başlangıç penceresi", path: playPath, open: (page) => expect(page.getByRole("button", { name: "Hazırım, başla" })).toBeVisible() },
  { name: "Postam, gelen kutusu", open: (page) => page.getByRole("button", { name: "Hazırım, başla" }).click() },
  { name: "Postam, mail", open: (page) => page.getByTestId("scenario-player").getByRole("button", { name: /^Kargo Takip/ }).click() },
  { name: "Görevler penceresi", open: (page) => page.getByRole("button", { name: /Görevleri aç/ }).click() },
  {
    name: "Odadan çıkma penceresi",
    open: async (page) => {
      await page.getByRole("button", { name: "Görevleri kapat" }).first().click();
      await page.getByRole("button", { name: "Odadan çık", exact: true }).click();
    },
  },
  {
    name: "Sahte sayfa",
    open: async (page) => {
      await page.getByRole("alertdialog").getByRole("button", { name: "Odada kal" }).click();
      await page.getByRole("button", { name: "Adresi güncelle" }).click();
      await expect(page.getByLabel(/Postam şifresi/)).toBeVisible();
    },
  },
  {
    name: "Hacklendin, alarm",
    brief: true,
    open: async (page) => {
      await page.getByLabel(/Postam şifresi/).fill("deneme-sifre");
      await page.getByRole("button", { name: /Giriş yap ve doğrula/ }).click();
      await expect(page.getByTestId("hacked-alarm")).toBeVisible();
    },
  },
  {
    name: "Hacklendin, sonuç sahnesi",
    open: async (page) => {
      // Alarm birkaç saniye sonra sahneye kendisi geçer (19 ve 22. revize).
      const go = page.getByRole("button", { name: "Geç", exact: true });
      if (await go.isVisible()) await go.click();
      await expect(page.getByTestId("hacked-scene")).toBeVisible();
    },
  },
  {
    name: "Sonuç raporu",
    open: async (page) => {
      await page.getByTestId("hacked-scene").getByRole("button", { name: "Devam" }).click();
      await expect(page.getByTestId("lab-report")).toBeVisible();
    },
  },
  {
    name: "Sonuç raporu, işaretler",
    open: async (page) => {
      await page.getByRole("button", { name: "Sonraki" }).filter({ visible: true }).first().click();
      await expect(page.getByTestId("report-journey")).toHaveAttribute("data-step", "signs");
    },
  },
  {
    name: "Sonuç raporu, bir dahaki sefere",
    open: async (page) => {
      await page.getByRole("button", { name: "Sonraki" }).filter({ visible: true }).first().click();
      await expect(page.getByTestId("report-journey")).toHaveAttribute("data-step", "tips");
    },
  },
  { name: "Ana sayfa, rapordan sonra", path: "/" },
  { name: "Profil", path: "/profil" },
  { name: "Profil, hesap bilgileri", path: "/profil?bolum=hesap" },
  { name: "Profil, e-posta değiştirme", path: "/profil?bolum=hesap", open: (page) => page.getByRole("button", { name: "Değiştir", exact: true }).click() },
  { name: "Profil, rozetler", path: "/profil?bolum=rozetler" },
  { name: "Profil, kazanılmamış rozet", path: "/profil?bolum=rozetler", open: (page) => page.getByRole("button", { name: /Şifre ustası/ }).click() },
  { name: "Profil, avatar", path: "/profil?bolum=avatar" },
  { name: "Profil, görünüm", path: "/profil?bolum=gorunum" },
  { name: "Profil, güvenlik", path: "/profil?bolum=guvenlik" },
  { name: "Profil, sınıf", path: "/profil?bolum=sinif" },
  { name: "Profil, sınıftan ayrılma penceresi", path: "/profil?bolum=sinif", open: (page) => page.getByRole("button", { name: "Sınıftan ayrıl" }).click() },
  { name: "Profil, başka sınıfa katılma", path: "/profil?bolum=sinif", open: (page) => page.getByRole("button", { name: "Başka bir sınıfa katıl" }).click() },
  { name: "Profil, öğretmenlik", path: "/profil?bolum=ogretmenlik" },
  {
    name: "Profil, öğretmenlik formu",
    path: "/profil?bolum=ogretmenlik",
    open: async (page) => {
      const box = page.getByRole("region", { name: "Öğretmen misin?" });
      await box.getByRole("button", { name: "Öğretmenlik talebi oluştur" }).click();
      await box.getByLabel("İl", { exact: true }).selectOption("İstanbul");
      await box.getByLabel("İlçe", { exact: true }).selectOption("Bahçelievler");
      await expect(box.getByLabel("Okulunun tam adı")).toBeVisible();
    },
  },
  {
    name: "Profil, öğretmenlik formu, uzun okul adı ve eksik alan",
    open: async (page) => {
      const box = page.getByRole("region", { name: "Öğretmen misin?" });
      await box.getByLabel("Okulunun tam adı").fill(longSchool);
      await box.getByRole("button", { name: "Talebi gönder" }).click();
      await expect(box.getByText(/Branşını yaz \(/)).toBeVisible();
    },
  },
  {
    name: "Profil, öğretmenlik talebi inceleniyor",
    open: async (page) => {
      const box = page.getByRole("region", { name: "Öğretmen misin?" });
      await box.getByLabel("Branşın").fill("Bilişim Teknolojileri ve Yazılım");
      await box.getByRole("button", { name: "Talebi gönder" }).click();
      await expect(page.getByText("Talebin inceleniyor")).toBeVisible();
    },
  },
  { name: "Profil, hesabı sil", path: "/profil?bolum=sil" },
  { name: "Profil, hesabı silme penceresi", path: "/profil?bolum=sil", open: (page) => page.getByRole("button", { name: "Hesabımı sil" }).click() },
];

// ---------------------------------------------------------------------------
// Öğretmen ve okul sorumlusu
// ---------------------------------------------------------------------------

type TeacherData = { classroom: string; student: string; colleague: string; applicant: string };

/** Okul adı her koşuda yeni (aynı ilçede aynı ad olamaz), uzunluk sınırda. */
const longSchoolName = () => `${longSchool.slice(0, 83)} ${randomUUID().slice(0, 6)}`;

/** Okulu seçmiş, belgeli, bekleyen öğretmenlik talebi. */
async function insertApplication(userId: string, school: { id: string; province: string; district: string }) {
  const id = newId();
  await query(
    `INSERT INTO "TeacherApplication" ("id", "userId", "schoolId", "province", "district", "subject", "institutionalEmail", "documentName", "documentSize")
     VALUES ($1, $2, $3, $4, $5, 'Bilişim Teknolojileri ve Yazılım', 'ayse.karaosmanoglu@okul.k12.tr', 'gorev-yeri-belgesi.pdf', 8)`,
    [id, userId, school.id, school.province, school.district],
  );
  await query(`INSERT INTO "ApplicationDocument" ("applicationId", "mimeType", "data") VALUES ($1, 'application/pdf', $2)`, [id, Buffer.from("%PDF-1.4")]);
  return id;
}

const newClassDialog = (page: Page) => page.getByRole("dialog", { name: "Yeni sınıf" });

const teacherNewScreens: Screen<TeacherData>[] = [
  { name: "Sınıflarım, boş", path: "/siniflarim" },
  { name: "Yeni sınıf penceresi", path: "/siniflarim", open: (page) => page.getByRole("button", { name: "Yeni sınıf", exact: true }).click() },
  {
    name: "Yeni sınıf, eksik ad",
    open: async (page) => {
      await newClassDialog(page).getByLabel("Sınıfın adı").fill("7");
      await newClassDialog(page).getByRole("button", { name: "Sınıfı oluştur" }).click();
      await expect(newClassDialog(page).getByLabel("Sınıfın adı")).toHaveAttribute("aria-invalid", "true");
    },
  },
  {
    name: "Yeni sınıf, hazır",
    open: async (page) => {
      await newClassDialog(page).getByLabel("Sınıfın adı").fill(longClass);
      await newClassDialog(page).getByLabel("Düzey").selectOption({ label: "7. sınıf" });
      await newClassDialog(page).getByRole("button", { name: "Sınıfı oluştur" }).click();
      await expect(newClassDialog(page).getByTestId("new-class-code")).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);
    },
  },
  { name: "Tahtaya yansıt", open: (page) => newClassDialog(page).getByRole("button", { name: "Tahtaya yansıt" }).click() },
  { name: "Sınıf detayı, boş", path: (d) => `/siniflarim/${d.classroom}` },
  { name: "Sınıf detayı, boş öğrenciler", path: (d) => `/siniflarim/${d.classroom}?sekme=ogrenciler` },
];

const teacherFullScreens: Screen<TeacherData>[] = [
  { name: "Sınıflarım, çok sınıf", path: "/siniflarim" },
  { name: "Sınıf detayı, genel", path: (d) => `/siniflarim/${d.classroom}` },
  { name: "Sınıf detayı, öğrenciler", open: (page) => page.getByRole("tab", { name: "Öğrenciler" }).click() },
  {
    name: "Öğrenci çekmecesi",
    open: (page, d) => page.getByRole("tabpanel").getByRole("button", { name: new RegExp(d.student) }).first().click(),
  },
  {
    name: "Öğrenciyi çıkarma onayı",
    open: (page) => page.getByRole("dialog", { name: "Öğrenci" }).getByRole("button", { name: "Sınıftan çıkar" }).click(),
  },
  { name: "Sınıf detayı, konular", path: (d) => `/siniflarim/${d.classroom}`, open: (page) => page.getByRole("tab", { name: "Konular" }).click() },
  { name: "Tarihi değiştir penceresi", open: (page) => page.getByRole("tabpanel").getByRole("button", { name: "Tarihi değiştir" }).first().click() },
  { name: "Ödev ver penceresi", path: (d) => `/siniflarim/${d.classroom}`, open: (page) => page.getByRole("button", { name: "Ödev ver", exact: true }).first().click() },
  { name: "Kodu yansıt", path: (d) => `/siniflarim/${d.classroom}`, open: (page) => page.getByRole("button", { name: "Kodu yansıt" }).click() },
  { name: "Kodu yenile onayı", path: (d) => `/siniflarim/${d.classroom}`, open: (page) => page.getByRole("button", { name: "Kodu yenile" }).click() },
  { name: "Okulum", path: "/okulum" },
  {
    name: "Okulum, öğretmen çekmecesi",
    path: "/okulum",
    open: (page, d) => page.getByRole("region", { name: "Öğretmenler" }).getByRole("button", { name: new RegExp(d.colleague) }).click(),
  },
  { name: "Ana sayfa (öğretmen)", path: "/" },
  { name: "Profil, öğretmenlik (onaylı)", path: "/profil?bolum=ogretmenlik" },
];

// ---------------------------------------------------------------------------
// Yönetim paneli
// ---------------------------------------------------------------------------

type AdminData = {
  application: string;
  applicant: string;
  newSchoolApplication: string;
  student: string;
  teacher: string;
  member: string;
  school: string;
  labs: Record<"inbox" | "messaging" | "training" | "placement" | "mission" | "sale", string>;
  article: string;
};

/** Oda düzenleme formunda bir bölümü açar (telefonda bölüm kendi sayfasında açılır). */
async function openLabSection(page: Page, name: string) {
  const back = page.getByRole("button", { name: "Bölümler", exact: true });
  if (await back.isVisible()) await back.click();
  await page.getByRole("navigation", { name: "Oda bölümleri" }).getByRole("button", { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
}

const applicationDetail = (page: Page, name: string) => page.getByRole("region", { name: `Talep: ${name}` });

const adminScreens: Screen<AdminData>[] = [
  { name: "Özet", path: "/yonetim" },
  { name: "Yönetim menüsü", path: "/yonetim", open: (page) => page.getByRole("button", { name: "Yönetim menüsünü aç" }).click() },
  { name: "Canlı nabız", path: "/yonetim/canli-nabiz" },
  { name: "Talepler", path: "/yonetim/talepler" },
  { name: "Talep detayı", path: (d) => `/yonetim/talepler?talep=${d.application}` },
  {
    name: "Talebi reddetme penceresi",
    path: (d) => `/yonetim/talepler?talep=${d.application}`,
    open: (page, d) => applicationDetail(page, d.applicant).getByRole("button", { name: "Reddet" }).click(),
  },
  {
    name: "Bilgi isteme penceresi",
    path: (d) => `/yonetim/talepler?talep=${d.application}`,
    open: (page, d) => applicationDetail(page, d.applicant).getByRole("button", { name: "Bilgi iste" }).click(),
  },
  {
    name: "Belge penceresi",
    path: (d) => `/yonetim/talepler?talep=${d.application}`,
    open: async (page, d) => {
      await applicationDetail(page, d.applicant).getByRole("button", { name: "Belgeyi gör" }).click();
      await expect(page.getByRole("dialog", { name: "atama-belgesi.png" }).getByRole("img")).toBeVisible();
    },
  },
  { name: "Yeni okul talebi", path: (d) => `/yonetim/talepler?talep=${d.newSchoolApplication}` },
  { name: "Kullanıcılar, öğrenciler", path: "/yonetim/kullanicilar" },
  { name: "Öğrenci kısa profili", path: (d) => `/yonetim/kullanicilar?ogrenci=${d.student}` },
  { name: "Kullanıcılar, öğretmenler", path: "/yonetim/kullanicilar?sekme=ogretmenler" },
  {
    name: "Öğretmen çekmecesi",
    path: (d) => `/yonetim/kullanicilar?sekme=ogretmenler&ara=${encodeURIComponent(d.teacher)}`,
    open: (page, d) => page.getByRole("button", { name: new RegExp(`^${d.teacher}`) }).click(),
  },
  {
    name: "Öğretmenin gözünden bak",
    open: (page, d) => page.getByRole("dialog", { name: d.teacher }).getByRole("button", { name: "Öğretmenin gözünden bak" }).click(),
  },
  {
    name: "Öğretmenlikten çıkarma onayı",
    path: (d) => `/yonetim/kullanicilar?sekme=ogretmenler&ara=${encodeURIComponent(d.teacher)}`,
    open: async (page, d) => {
      await page.getByRole("button", { name: new RegExp(`^${d.teacher}`) }).click();
      await page.getByRole("dialog", { name: d.teacher }).getByRole("button", { name: "Öğretmenlikten çıkar" }).click();
    },
  },
  { name: "Yönetim ekibi", path: "/yonetim/kullanicilar?sekme=ekip" },
  { name: "Ekibe kişi ekleme penceresi", path: "/yonetim/kullanicilar?sekme=ekip", open: (page) => page.getByRole("button", { name: "Ekibe kişi ekle" }).first().click() },
  { name: "İzinler penceresi", path: "/yonetim/kullanicilar?sekme=ekip", open: (page, d) => page.getByRole("button", { name: `İzinleri düzenle: ${d.member}` }).click() },
  { name: "Okullar", path: "/yonetim/kullanicilar?gorunum=okullar" },
  {
    name: "Okul kartı",
    path: (d) => `/yonetim/kullanicilar?gorunum=okullar&ara=${encodeURIComponent(d.school)}`,
    open: async (page, d) => {
      const toggle = page.getByRole("region", { name: d.school }).getByRole("button", { name: new RegExp(`^${d.school.slice(0, 20)}`) });
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    },
  },
  {
    name: "Sorumlu atama penceresi",
    path: (d) => `/yonetim/kullanicilar?gorunum=okullar&ara=${encodeURIComponent(d.school)}`,
    open: (page, d) => page.getByRole("button", { name: `Sorumlu ata: ${d.school}` }).click(),
  },
  { name: "Okul ekleme penceresi", path: "/yonetim/kullanicilar?gorunum=okullar", open: (page) => page.getByRole("button", { name: "Okul ekle" }).first().click() },
  { name: "Odalar", path: "/yonetim/odalar" },
  { name: "Odalar, bütün mahalleler açık", path: "/yonetim/odalar", open: (page) => page.getByRole("button", { name: "Hepsini aç" }).click() },
  {
    name: "Oda gizleme penceresi",
    open: (page) => page.getByRole("switch", { name: "Gizle: Sahte kargo maili" }).click(),
  },
  { name: "Yeni oda", path: "/yonetim/odalar/yeni" },
  { name: "Oda düzenleme, bölümler", path: (d) => `/yonetim/odalar/${d.labs.inbox}` },
  { name: "Oda düzenleme, kapak", open: (page) => openLabSection(page, "Kapak ve hatırlatma") },
  { name: "Oda düzenleme, gelen kutusu", open: (page) => openLabSection(page, "Gelen kutusu") },
  { name: "Oda düzenleme, sahte sayfa", open: (page) => openLabSection(page, "Sahte sayfa") },
  { name: "Oda düzenleme, görevler", open: (page) => openLabSection(page, "Görevler") },
  { name: "Oda düzenleme, rapor", open: (page) => openLabSection(page, "Rapor") },
  {
    name: "Oda düzenleme, öğrenci gibi dene",
    open: async (page) => {
      await page.getByRole("button", { name: "Bölümler", exact: true }).click();
      await page.getByRole("button", { name: "Öğrenci gibi dene" }).click();
    },
  },
  { name: "Oda düzenleme, mesajlar", path: (d) => `/yonetim/odalar/${d.labs.messaging}`, open: (page) => openLabSection(page, "Mesajlar") },
  { name: "Oda düzenleme, tuzak anı", open: (page) => openLabSection(page, "Tuzak anı") },
  { name: "Oda düzenleme, eğitim kartları", path: (d) => `/yonetim/odalar/${d.labs.training}`, open: (page) => openLabSection(page, "Kartlar") },
  { name: "Oda önizleme, başlangıç", path: (d) => `/yonetim/odalar/${d.labs.messaging}/onizle` },
  { name: "Oda önizleme, Mesajlar", open: (page) => page.getByRole("button", { name: "Hazırım, başla" }).click() },
  { name: "Oda önizleme, sohbet", open: (page) => page.getByRole("button", { name: /^Deniz/ }).first().click() },
  { name: "Oda önizleme, Postam", path: (d) => `/yonetim/odalar/${d.labs.inbox}/onizle`, open: (page) => page.getByRole("button", { name: "Hazırım, başla" }).click() },
  // Kutulara ayırma, eşleştirme ve boşluk doldurma kartları: Para Çarşısı temel eğitimi (oda dosyası, taslak).
  {
    name: "Oda düzenleme, kutulara ayırma kartı",
    path: (d) => `/yonetim/odalar/${d.labs.placement}`,
    open: async (page) => {
      await openLabSection(page, "Kartlar");
      await page.getByRole("button", { name: /Hangi bilgi hangi kutuya girer\?/ }).click();
    },
  },
  { name: "Oda önizleme, video kartı", path: (d) => `/yonetim/odalar/${d.labs.placement}/onizle` },
  { name: "Oda önizleme, video sorusu cevaplandı", open: (page) => answerVideo(page, 81, "Kimseye verilmez") },
  { name: "Oda önizleme, keşfet kartı", open: next },
  { name: "Oda önizleme, keşfet kartı açıldı", open: (page) => openPoints(page, "Profil alanları") },
  { name: "Oda önizleme, kutulara ayırma nasıl oynanır", open: next },
  { name: "Oda önizleme, kutulara ayırma kartı", open: (page) => page.getByRole("button", { name: /Anladım, başla/ }).click() },
  { name: "Oda önizleme, kutulara ayırma bilgi seçildi", open: (page) => page.getByTestId("training-player").getByRole("group", { name: "Yerleştirilecek bilgiler" }).getByRole("button").first().click() },
  {
    name: "Oda önizleme, kutulara ayırma yarısı dolu",
    open: async (page) => {
      // Seçili bilgi kırmızı kutuya, sonra iki bilgi daha.
      await page.getByTestId("training-player").getByRole("button", { name: /^Seçili bilgiyi şuraya koy/ }).nth(2).click();
      await sortItems(page, 2);
    },
  },
  { name: "Oda önizleme, kutulara ayırma kontrol edildi", open: (page) => solveSort(page) },
  { name: "Oda önizleme, eşleştirme nasıl oynanır", open: next },
  { name: "Oda önizleme, eşleştirme kartı", open: (page) => page.getByRole("button", { name: /Anladım, başla/ }).click() },
  { name: "Oda önizleme, eşleştirme kartı yarısı dolu", open: (page) => fillSlots(page, 2) },
  { name: "Oda önizleme, eşleştirme kontrol edildi", open: (page) => solvePlacement(page) },
  { name: "Oda önizleme, boşluk doldurma nasıl oynanır", open: next },
  { name: "Oda önizleme, boşluk doldurma", open: (page) => page.getByRole("button", { name: /Anladım, başla/ }).click() },
  { name: "Oda önizleme, boşluk doldurma sürüklendi", open: (page) => dragFirstOption(page) },
  { name: "Oda önizleme, boşluk doldurma kontrol edildi", open: (page) => solvePlacement(page) },
  { name: "Oda önizleme, ikinci video", open: next },
  { name: "Oda önizleme, ikinci video sorusu cevaplandı", open: (page) => answerVideo(page, 64, "Yazmam, önce ailemle konuşurum") },
  { name: "Oda önizleme, banka kartı", open: next },
  { name: "Oda önizleme, banka kartı SMS", open: (page) => openPoints(page, "Kartın bölümleri", 3) },
  { name: "Oda önizleme, banka kartı gezildi", open: (page) => openPoints(page, "Kartın bölümleri") },
  { name: "Oda önizleme, 4 şıklı test", open: next },
  {
    name: "Oda önizleme, 4 şıklı test cevaplandı",
    open: (page) => page.getByTestId("training-player").getByRole("group", { name: "Cevaplar" }).getByRole("button").nth(3).click(),
  },
  { name: "Oda önizleme, tıkla-bul", open: next },
  { name: "Oda önizleme, ikinci test", open: next },
  { name: "Oda önizleme, ikinci test cevaplandı", open: (page) => page.getByTestId("training-player").getByRole("group", { name: "Cevaplar" }).getByRole("button").nth(1).click() },
  { name: "Oda önizleme, adım adım kart", open: next },
  { name: "Oda önizleme, adım adım kart açıldı", open: (page) => openPoints(page, "Adımlar") },
  // Görevli oda: annenin görüntülü araması, görev kartı, mağaza ve SMS (Para Çarşısı "Kulaklık için veli kartı", oda dosyası, taslak).
  // Önce perde ve "Başlamadan önce", arama "Hazırım"dan sonra çalar (18. revize).
  { name: "Oda önizleme, görev araması", path: (d) => `/yonetim/odalar/${d.labs.mission}/onizle`, open: (page) => page.getByRole("button", { name: "Hazırım, başla" }).click() },
  { name: "Oda önizleme, görüntülü görüşme", open: (page) => page.getByTestId("mission-call").getByRole("button", { name: "Aç", exact: true }).click() },
  { name: "Oda önizleme, görev kartı", open: (page) => page.getByTestId("mission-call").getByRole("button", { name: "Geç ›" }).click() },
  {
    name: "Oda önizleme, görev kutusu",
    open: async (page) => {
      await page.getByTestId("mission-call").getByRole("button", { name: "Tamam anne, anladım" }).click();
      await page.getByRole("button", { name: /Görevleri aç/ }).click();
    },
  },
  {
    name: "Oda önizleme, mağaza",
    open: async (page) => {
      await page.getByRole("dialog", { name: "Görevler" }).getByRole("button", { name: "Görevleri kapat" }).first().click();
      const app = page.getByTestId("scenario-player");
      await app.getByRole("button", { name: /^TeknoPazar 19:42/ }).click();
      await app.getByRole("button", { name: "Ürüne git" }).click();
      await app.getByRole("button", { name: "Annenin kartını kullan" }).click();
    },
  },
  { name: "Oda önizleme, onay kodu SMS'i", open: (page) => page.getByTestId("scenario-player").getByRole("button", { name: "1.199 TL öde" }).click() },
  // Satış görevli oda: babanın araması, ilan kutusu, bankanın ödeme isteği ve pazar yerindeki sipariş (Para Çarşısı "Eski telefonunu sat").
  { name: "Oda önizleme, babanın araması", path: (d) => `/yonetim/odalar/${d.labs.sale}/onizle`, open: (page) => page.getByRole("button", { name: "Hazırım, başla" }).click() },
  { name: "Oda önizleme, babayla görüşme", open: (page) => page.getByTestId("mission-call").getByRole("button", { name: "Aç", exact: true }).click() },
  {
    name: "Oda önizleme, ilan kutusu",
    open: async (page) => {
      await page.getByTestId("mission-call").getByRole("button", { name: "Geç ›" }).click();
      await page.getByTestId("mission-call").getByRole("button", { name: "Tamam baba, hallederim" }).click();
      await page.getByRole("button", { name: /Görevleri aç/ }).click();
    },
  },
  {
    name: "Oda önizleme, ödeme isteği",
    open: async (page) => {
      await page.getByRole("dialog", { name: "Görevler" }).getByRole("button", { name: "Görevleri kapat" }).first().click();
      const app = page.getByTestId("scenario-player");
      await app.getByRole("button", { name: /^Selin K\./ }).first().click();
      await app.getByRole("button", { name: "bankam.com.tr/odeme-istegi/48213" }).click();
    },
  },
  {
    name: "Oda önizleme, sipariş ve kargo",
    open: async (page) => {
      await page.getByTestId("bank-request").getByRole("button", { name: "Reddet" }).click();
      await page.getByTestId("bank-request").getByRole("button", { name: "Mesajlara dön" }).click();
      await page.getByRole("button", { name: "Sohbetlere dön" }).click();
      const app = page.getByTestId("scenario-player");
      await app.getByRole("button", { name: /^İkinci El Pazarı/ }).first().click();
      await app.getByRole("button", { name: "ikincielpazari.com.tr/siparis/77310" }).click();
    },
  },
  { name: "Günün ipucu", path: "/yonetim/ipucu" },
  { name: "Yeni ipucu penceresi", path: "/yonetim/ipucu", open: (page) => page.getByRole("button", { name: "Yeni ipucu" }).click() },
  { name: "Gündem", path: "/yonetim/gundem" },
  { name: "Yeni haber", path: "/yonetim/gundem/yeni" },
  { name: "Haber düzenleme", path: (d) => `/yonetim/gundem/${d.article}` },
  { name: "Haber önizleme penceresi", path: (d) => `/yonetim/gundem/${d.article}`, open: (page) => page.getByRole("button", { name: "Önizle" }).click() },
  { name: "Kayıt defteri", path: "/yonetim/kayit-defteri" },
];

test.describe("telefon düzeni", () => {
  test.skip(({ isMobile }) => !isMobile, "yalnızca telefon");
  test.skip(isLive, "veritabanına yazan ve hesap açan testler canlı sitede çalışmaz");
  // Bir ekranda takılan tıklama bütün testi beklemesin.
  test.use({ actionTimeout: 15_000 });

  test("ziyaretçi ve hesap ekranları", async ({ page, baseURL, browser }) => {
    test.setTimeout(240_000);
    // Haberin yazarı: ayrı bir oturumda açılan hesap.
    const author = uniqueEmail("mobil-yazar");
    const other = await browser.newContext({ baseURL });
    await signUpVerified(await other.newPage(), author);
    await other.close();
    const article = await insertArticle(author);
    try {
      await visit(page, "ziyaretci", visitorScreens, { article });
    } finally {
      await withDb((client) => client.query(`DELETE FROM "NewsArticle" WHERE "slug" = $1`, [article]));
    }
  });

  test("öğrenci ekranları", async ({ page }) => {
    test.setTimeout(300_000);
    const email = uniqueEmail("mobil-ogrenci");
    await signUpVerified(page, email);
    await query(`UPDATE "User" SET "displayName" = $2 WHERE "email" = $1`, [email, longName]);
    const studentId = (await query(`SELECT "id" FROM "User" WHERE "email" = $1`, [email]))[0].id as string;

    // Öğretmen, uzun adlı okulu ve öğrencinin katılacağı sınıf (açık ödevli).
    const teacherEmail = uniqueEmail("mobil-ogretmen");
    const teacherId = await insertUser("Zeynep Kaya");
    await query(`UPDATE "User" SET "email" = $2 WHERE "id" = $1`, [teacherId, teacherEmail]);
    const school = await createSchool({ name: `${longSchool.slice(0, 80)} ${randomUUID().slice(0, 6)}`, creatorEmail: teacherEmail });
    await makeTeacher(teacherEmail, school.id);
    const classroom = await insertClassroom(teacherId, longClass, []);

    const data: StudentData = { code: classroom.code, report: "" };
    await visit(page, "ogrenci", studentScreens.slice(0, 1), data);
    await query(`INSERT INTO "ClassroomMembership" ("classroomId", "userId") VALUES ($1, $2)`, [classroom.id, studentId]);
    for (const badge of ["kart-kurdu", "merakli", "sinif-arkadasi"]) {
      await query(`INSERT INTO "EarnedBadge" ("userId", "badgeCode") VALUES ($1, $2) ON CONFLICT DO NOTHING`, [studentId, badge]);
    }
    await visit(page, "ogrenci", studentScreens.slice(1), data);
  });

  test("öğretmen ve okul sorumlusu ekranları", async ({ page }) => {
    test.setTimeout(300_000);
    const email = uniqueEmail("mobil-ogretmen");
    await signUpVerified(page, email);
    await query(`UPDATE "User" SET "displayName" = $2 WHERE "email" = $1`, [email, longName]);
    const teacherId = (await query(`SELECT "id" FROM "User" WHERE "email" = $1`, [email]))[0].id as string;
    const school = await createSchool({ name: longSchoolName(), creatorEmail: email });
    await makeTeacher(email, school.id);

    // Önce boş haller: sınıf yok, sonra arayüzden açılan ilk sınıf (öğrencisiz, ödevsiz).
    const data: TeacherData = { classroom: "", student: "Ayşenur Gülizar Karaosman", colleague: "Mehmet Ali Yıldırımoğlu", applicant: "Elif Naz Çelikkanatlıoğlu" };
    await visit(page, "ogretmen", teacherNewScreens.slice(0, 5), data);
    data.classroom = (await query(`SELECT "id" FROM "Classroom" WHERE "teacherId" = $1`, [teacherId]))[0].id as string;
    await visit(page, "ogretmen", teacherNewScreens.slice(5), data);

    // Kalabalık sınıf: 28 öğrenci (biri uzun adlı), bir kısmı labı bitirmiş ya da hacklenmiş, açık ödev.
    const students: string[] = [await insertUser(data.student)];
    for (let i = 1; i < 28; i++) students.push(await insertUser(`Öğrenci ${String(i).padStart(2, "0")} Deneme`));
    for (const userId of students) await query(`INSERT INTO "ClassroomMembership" ("classroomId", "userId") VALUES ($1, $2)`, [data.classroom, userId]);
    for (const [i, userId] of students.entries()) {
      if (i % 3 === 0) await insertFinishedAttempt(userId, "COMPLETED");
      else if (i % 3 === 1) await insertFinishedAttempt(userId, "HACKED");
    }
    await query(
      `INSERT INTO "Assignment" ("id", "classroomId", "neighborhoodId", "dueDate") SELECT $1, $2, "id", now() + interval '3 days' FROM "Neighborhood" WHERE "slug" = 'oltalama-limani'`,
      [newId(), data.classroom],
    );
    // Başka sınıflar: uzun adlı, kimi ödevsiz, kimi boş (Dikkat isteyenler).
    for (const [i, name] of ["Bilişim Teknolojileri 10-A Ş.", "Bilgisayar Bilimi 9-C Grubu", "Robotik ve Kodlama Kulübü", "8-D", "Siber Güvenlik Seçmeli 11-F"].entries()) {
      const members = i < 3 ? [await insertUser(`Sınıf ${i + 1} Öğrencisi`)] : [];
      await insertClassroom(teacherId, name, members, { assignment: i % 2 === 0 });
    }

    // Okul sorumlusu: okulda başka öğretmenler ve okula gelen bir talep.
    await makeCoordinator(email, school.id);
    const colleague = await insertUser(data.colleague, "TEACHER", school.id);
    await insertClassroom(colleague, longClass, [await insertUser("Okul Öğrencisi Bir"), await insertUser("Okul Öğrencisi İki")]);
    await insertUser("Selin Yılmaz", "TEACHER", school.id);
    await insertApplication(await insertUser(data.applicant), school);

    await visit(page, "ogretmen", teacherFullScreens, data);
  });

  test("yönetim paneli ekranları", async ({ page }) => {
    test.setTimeout(360_000);
    const email = uniqueEmail("mobil-yonetici");
    await signUpVerified(page, email);
    await query(`UPDATE "User" SET "displayName" = $2, "role" = 'ADMIN' WHERE "email" = $1`, [email, longName]);
    const adminId = (await query(`SELECT "id" FROM "User" WHERE "email" = $1`, [email]))[0].id as string;

    // Uzun adlı okul, öğretmeni, sınıfı ve öğrencisi (bir lab bitirmiş).
    const school = await createSchool({ name: longSchoolName(), creatorEmail: email });
    const teacher = "Mehmet Ali Yıldırımoğlu " + randomUUID().slice(0, 4);
    const teacherId = await insertUser(teacher, "TEACHER", school.id);
    const studentId = await insertUser("Zeynep Su Karaosmanoğlu");
    await insertClassroom(teacherId, longClass, [studentId, await insertUser("Okul Öğrencisi Bir")]);
    await insertFinishedAttempt(studentId, "COMPLETED");

    // Talepler: okulu seçmiş ve görsel belgeli, yeni okul adıyla gelen, bilgi istenmiş.
    const applicant = "Elif Naz Çelikkanatlıoğlu " + randomUUID().slice(0, 4);
    const application = await insertApplication(await insertUser(applicant), school);
    await query(`UPDATE "TeacherApplication" SET "documentName" = 'atama-belgesi.png' WHERE "id" = $1`, [application]);
    await query(`UPDATE "ApplicationDocument" SET "mimeType" = 'image/png', "data" = $2 WHERE "applicationId" = $1`, [
      application,
      Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
    ]);
    const newSchoolApplication = newId();
    await query(
      `INSERT INTO "TeacherApplication" ("id", "userId", "newSchoolName", "province", "district", "subject") VALUES ($1, $2, $3, 'İstanbul', 'Bahçelievler', 'Matematik')`,
      [newSchoolApplication, await insertUser("Ayşenur Gülizar Karaosman"), longSchool],
    );
    const asked = await insertApplication(await insertUser("Bilgi Bekleyen Öğretmen"), school);
    await query(`UPDATE "TeacherApplication" SET "status" = 'INFO_REQUESTED', "question" = $2, "questionAt" = now() WHERE "id" = $1`, [
      asked,
      "Okulunun tam adını ve görev yeri belgeni ekleyebilir misin? Listede aynı ilçede benzer adlı iki okul var.",
    ]);

    // Ekip üyesi (İpucu ve Gündem izni), taslak ipuçları ve haberler (test sonunda silinir).
    const member = "Can Deniz Akyürek " + randomUUID().slice(0, 4);
    const memberId = await insertUser(member);
    for (const permission of ["TIPS", "NEWS"]) {
      await query(`INSERT INTO "TeamPermission" ("userId", "permission", "grantedById") VALUES ($1, $2::"TeamPermissionType", $3)`, [memberId, permission, adminId]);
    }
    const tipText = "Bir mesajda acele ettiren, ödül vaat eden ya da korkutan bir dil varsa bağlantıya tıklamadan önce gönderenin kim olduğunu kontrol et.";
    const tips = [newId(), newId()];
    for (const id of tips) {
      await query(
        `INSERT INTO "DailyTip" ("id", "text", "reason", "status", "authorId", "neighborhoodId", "updatedAt")
         SELECT $1, $2, $3, 'DRAFT', $4, "id", now() FROM "Neighborhood" WHERE "slug" = 'oltalama-limani'`,
        [id, tipText, "Dolandırıcılar düşünmeden tıklaman için acele ettirir. Gerçek kurumlar seni birkaç dakika içinde karar vermeye zorlamaz.", adminId],
      );
    }
    const published = await insertArticle(email);
    const draft = await insertArticle(email, "DRAFT");
    const labs = Object.fromEntries(
      (
        await query(
          `SELECT "slug", "id" FROM "Lab" WHERE "slug" IN ('sahte-kargo-maili', 'kodu-soran-arkadas', 'oltalama-egitimi', 'kisisel-veri-ve-para-guvenligi', 'kulaklik-icin-veli-karti', 'eski-telefonunu-sat')`,
        )
      ).map((r) => [r.slug, r.id]),
    );

    try {
      await visit(page, "yonetim", adminScreens, {
        application,
        applicant,
        newSchoolApplication,
        student: studentId,
        teacher,
        member,
        school: school.name,
        labs: {
          inbox: labs["sahte-kargo-maili"],
          messaging: labs["kodu-soran-arkadas"],
          training: labs["oltalama-egitimi"],
          placement: labs["kisisel-veri-ve-para-guvenligi"],
          mission: labs["kulaklik-icin-veli-karti"],
          sale: labs["eski-telefonunu-sat"],
        },
        article: (await query(`SELECT "id" FROM "NewsArticle" WHERE "slug" = $1`, [draft]))[0].id as string,
      });
    } finally {
      await query(`DELETE FROM "NewsArticle" WHERE "slug" = ANY($1)`, [[published, draft]]);
      await query(`DELETE FROM "DailyTip" WHERE "id" = ANY($1)`, [tips]);
    }
  });

  test("e-posta doğrulama", async ({ page }) => {
    await signUp(page, uniqueEmail("mobil-dogrula"));
    await visit(page, "dogrula", [{ name: "E-posta doğrulama", path: "/dogrula" }], {});
  });
});
