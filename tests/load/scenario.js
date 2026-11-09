// Careful Mode yük testi (k6): doküman Bölüm 7'deki hedefler.
//
// Aynı anda 100 kullanıcı: çoğu giriş yapmış öğrenci (ana sayfa, yol haritası, mahalle, lab kapağı,
// lab oynama, sonuç raporu; bazen eğitim labı, gündem, profil), bir kısmı ziyaretçi (tanıtım,
// gündem, haber, SSS, öğretmenler için), birkaç öğretmen (Sınıflarım, sınıf detayı) ve bir yönetici
// (Özet). Kullanıcı her adımdan sonra ortalama 5 saniye düşünür (doküman: "her aktif kullanıcı
// ortalama 5 saniyede bir istek"). Bir adım tarayıcıda olduğu gibi birden çok istek olabilir:
// sayfa ya da geçiş isteği, görünen bağlantıların ön yüklemesi, ilk açılışta statik dosyalar.
//
// Çalıştırma (tests/load/README.md): önce prepare.ts (hesaplar ve çerezler) ve actions.ts (eylem
// kimlikleri), sonra
//   docker run --rm --network host -v "$PWD/tests/load:/load" grafana/k6 run /load/scenario.js
// Ortam değişkenleri: BASE_URL, VUS (100), RAMP (1m), HOLD (10m), RAMP_DOWN (1m), THINK (5),
// HACK_RATE (0.3), SUMMARY (özetin yazılacağı dosya).
//
// Eşikler doküman hedefleridir: sunucuda çizilen isteklerin (sayfa, geçiş, ön yükleme, eylem)
// %95'i 500 ms altında, hata oranı %1 altında. Her tür ayrıca kendi satırında görünür.

import exec from "k6/execution";
import { SharedArray } from "k6/data";
import { Counter } from "k6/metrics";
import { check, fail, sleep } from "k6";
import http from "k6/http";
import { Browser } from "./lib/next.js";
import { routeThresholds, summarize } from "./lib/summary.js";

// 200 dışındaki her cevap (yönlendirme dahil) başarısızdır: oturumlu sayfa giriş sayfasına dönerse görülür.
http.setResponseCallback(http.expectedStatuses(200));

const data = new SharedArray("users", () => [JSON.parse(open("./.data/users.json"))])[0];
const actions = new SharedArray("actions", () => [JSON.parse(open("./.data/actions.json"))])[0];

const base = __ENV.BASE_URL || data.baseUrl;
const totalVus = Number(__ENV.VUS || 100);
const thinkMean = Number(__ENV.THINK || 5);
const hackRate = Number(__ENV.HACK_RATE || 0.3);

// Kullanıcı karışımı: %80 öğrenci, %14 ziyaretçi, %5 öğretmen, 1 yönetici (100 VU'da 80/14/5/1).
const mix = (() => {
  const admins = totalVus >= 10 ? 1 : 0;
  const teachers = Math.max(1, Math.round(totalVus * 0.05));
  const visitors = Math.max(1, Math.round(totalVus * 0.14));
  return { students: Math.max(1, totalVus - admins - teachers - visitors), visitors, teachers, admins };
})();

if (mix.students > data.students.length) {
  throw new Error(`Öğrenci VU sayısı (${mix.students}) hesaplardan (${data.students.length}) fazla: prepare.ts --students ile artırın.`);
}

const stages = (target) => [
  { duration: __ENV.RAMP || "1m", target },
  { duration: __ENV.HOLD || "10m", target },
  { duration: __ENV.RAMP_DOWN || "1m", target: 0 },
];

const scenario = (exec, vus) => ({ executor: "ramping-vus", exec, startVUs: 0, stages: stages(vus), gracefulRampDown: "30s" });

const target = "p(95)<500";
// Eylemlerin etiket adları (Browser.action'ın ilk değişkeni).
const actionNames = {
  startAttempt: 1,
  sendEvents: 1,
  openLink: 1,
  submitTrap: 1,
  sendReply: 1,
  finishAttempt: 1,
  checkTrainingAnswer: 1,
  saveTrainingProgress: 1,
  recordArticleRead: 1,
};
export const options = {
  scenarios: Object.fromEntries(
    [
      ["students", "student", mix.students],
      ["visitors", "visitor", mix.visitors],
      ["teachers", "teacher", mix.teachers],
      ["admins", "admin", mix.admins],
    ]
      .filter(([, , vus]) => vus > 0)
      .map(([name, fn, vus]) => [name, scenario(fn, vus)]),
  ),
  // Her VU kendi çerez kavanozunu korur (oturum çerezi tekrar tekrar verilmez).
  noCookiesReset: true,
  // Sunucuda nginx uygulamaya her istek için yeni bağlantı açar (upstream keepalive yok,
  // docker/server/nginx-site.conf). k6 bağlantıyı yeniden kullanırsa Node'un 5 sn'lik keep-alive
  // süresiyle düşünme süresi çakışır ve gerçekte olmayan "EOF" hataları çıkar.
  noConnectionReuse: true,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
    "http_req_duration{api:yes}": [target],
    "http_req_duration{kind:page}": [target],
    "http_req_duration{kind:rsc}": [target],
    "http_req_duration{kind:prefetch}": [target],
    "http_req_duration{kind:action}": [target],
    "http_req_duration{kind:tree}": [target],
    "http_req_duration{kind:static}": [target],
    // Yol başına satırlar (özet tablosu için; her zaman geçer).
    ...routeThresholds([
      ...["/", "/siniflarim", "/yonetim", "/gundem"].map((n) => ["page", n]),
      ...[
        "/",
        "/yol-haritasi",
        "/yol-haritasi/[mahalle]",
        "/oda/[oda]",
        "/oda/[oda]/oyna",
        "/oda/[oda]/sonuc/[deneme]",
        "/odalar",
        "/gundem",
        "/gundem/[haber]",
        "/profil",
        "/sss",
        "/ogretmenler",
        "/siniflarim",
        "/siniflarim/[sinif]",
        "/yonetim",
      ].map((n) => ["rsc", n]),
      ...["/", "/yol-haritasi", "/yol-haritasi/[mahalle]", "/oda/[oda]", "/oda/[oda]/oyna", "/odalar", "/gundem", "/gundem/[haber]", "/profil", "/siniflarim", "/siniflarim/[sinif]", "/kvkk", "/sss", "/giris"].map((n) => [
        "prefetch",
        n,
      ]),
      ...Object.keys(actionNames).map((n) => ["action", n]),
    ]),
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max", "count"],
};

const labsCompleted = new Counter("labs_completed");
const labsHacked = new Counter("labs_hacked");
const trainingsPlayed = new Counter("trainings_played");
const flowErrors = new Counter("flow_errors");

// --- Yardımcılar ----------------------------------------------------------------------------

/** Düşünme süresi: ortalama THINK saniye, 0,4×–1,6× arası düzgün dağılım. */
const think = (scale = 1) => sleep(thinkMean * scale * (0.4 + Math.random() * 1.2));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

function actionId(name) {
  const id = actions[name];
  if (!id) fail(`eylem kimliği yok: ${name} (tests/load/actions.ts)`);
  return id;
}

const ids = {
  startAttempt: actionId("lib/lab/actions.ts#startAttempt"),
  sendEvents: actionId("lib/lab/actions.ts#sendEvents"),
  openLink: actionId("lib/lab/actions.ts#openLink"),
  submitTrap: actionId("lib/lab/actions.ts#submitTrap"),
  sendReply: actionId("lib/lab/actions.ts#sendReply"),
  finishAttempt: actionId("lib/lab/actions.ts#finishAttempt"),
  checkTrainingAnswer: actionId("lib/lab/actions.ts#checkTrainingAnswer"),
  saveTrainingProgress: actionId("lib/lab/actions.ts#saveTrainingProgress"),
  recordArticleRead: actionId("lib/news/reads.ts#recordArticleRead"),
};

const footerLinks = ["/kvkk", "/gizlilik", "/kosullar", "/sss"];
const memberNav = ["/yol-haritasi", "/odalar", "/gundem", "/profil"];
const visitorNav = ["/yol-haritasi", "/odalar", "/gundem", "/ogretmenler", "/sss"];

/** Okul ağları (RFC 5737 belge adresleri): her sınıf kendi okulunun tek IP'sinden. */
const schoolIp = (n) => `203.0.113.${10 + (n % 3)}`;
const homeIp = (n) => `198.51.100.${1 + (n % 250)}`;

/** VU başına bir tarayıcı (modül değişkenleri VU'ya özeldir). */
let browser;
/** VU'nun yarım kalan denemesi: kesilen yinelemeden sonra aynı denemeye kaldığı sıradan devam edilir. */
const attempts = {};

function ok(result, what) {
  const good = check(result, { [`${what} ok`]: (r) => r !== undefined && r !== null && r.ok === true });
  if (!good) flowErrors.add(1, { flow: what });
  return good;
}

// --- Öğrenci ---------------------------------------------------------------------------------

function studentHome() {
  if (browser.current === undefined) browser.open("/");
  else browser.navigate("/");
  const lab = data.labs.scenario[0];
  browser.prefetch([...memberNav, ...footerLinks, ...(lab ? [`/oda/${lab.slug}`] : [])]);
  think();
}

/** Senaryo labı: denemeyi başlat, mailleri/mesajları aç, karar ver, bitir (ya da tuzağa düş). */
function playScenario(lab) {
  browser.navigate("/yol-haritasi");
  browser.prefetch(data.neighborhoods.map((n) => `/yol-haritasi/${n}`), { runtime: 2 });
  think();
  browser.navigate(`/yol-haritasi/${lab.neighborhood}`);
  browser.prefetch(data.labs.scenario.filter((l) => l.neighborhood === lab.neighborhood).map((l) => `/oda/${l.slug}`));
  think();
  browser.navigate(`/oda/${lab.slug}`);
  browser.prefetch([`/oda/${lab.slug}/oyna`]);
  think();
  const play = `/oda/${lab.slug}/oyna`;
  browser.navigate(play);
  think(0.6);

  const started = browser.action("startAttempt", ids.startAttempt, [lab.slug]).result;
  if (!ok(started, "startAttempt")) return;
  const attemptId = started.attemptId;
  const state = (attempts[attemptId] = attempts[attemptId] || { seq: 0 });
  const send = (events) =>
    ok(browser.action("sendEvents", ids.sendEvents, [attemptId, events.map((event) => ({ seq: state.seq++, event }))]).result, "sendEvents");

  // Öğeleri sırayla aç (her biri bir düşünme); tarayıcı 3 sn içindeki olayları birlikte gönderir.
  for (const item of shuffle(lab.items)) {
    const events = [{ type: "item_opened", item: item.id }];
    if (item.attachment) events.push({ type: "attachment_opened", item: item.id });
    if (!send(events)) return;
    think(0.8);
  }

  const fake = lab.items.find((i) => i.fake);
  const falls = fake && Math.random() < hackRate && (lab.template === "INBOX" ? fake.link : lab.secret);
  if (falls) {
    // Tuzağa düşen öğrenci: bağlantı + sahte form (gelen kutusu) ya da kodu gönderme (mesajlaşma).
    if (lab.template === "INBOX") {
      if (!ok(browser.action("openLink", ids.openLink, [attemptId, state.seq++, fake.id]).result, "openLink")) return;
      think(0.6);
      if (!ok(browser.action("submitTrap", ids.submitTrap, [attemptId, state.seq++, fake.id]).result, "submitTrap")) return;
    } else if (!ok(browser.action("sendReply", ids.sendReply, [attemptId, state.seq++, fake.id, true]).result, "sendReply")) return;
    labsHacked.add(1);
    delete attempts[attemptId];
    think(1.5); // "Hacklendin" ekranı ve açıklaması
  } else {
    if (fake && !send([{ type: "item_moved", item: fake.id, to: "spam" }])) return;
    think(0.6);
    const realWithLink = lab.items.find((i) => !i.fake && i.link);
    if (lab.template === "INBOX" && realWithLink && Math.random() < 0.5) {
      // Gerçek maildeki bağlantı: yalnızca adres gösterilir.
      if (!ok(browser.action("openLink", ids.openLink, [attemptId, state.seq++, realWithLink.id]).result, "openLink")) return;
      think(0.6);
    }
    if (lab.template === "MESSAGING") {
      const real = lab.items.find((i) => !i.fake);
      if (real && !ok(browser.action("sendReply", ids.sendReply, [attemptId, state.seq++, real.id, false]).result, "sendReply")) return;
    }
    if (lab.tasks.some((t) => t.type === "review") && !send([{ type: "review_done" }])) return;
    think(0.6);
    for (const task of lab.tasks.filter((t) => t.type === "question")) {
      if (!send([{ type: "answer", task: task.id, option: Math.floor(Math.random() * task.options) }])) return;
      think(0.8);
    }
    const finished = browser.action("finishAttempt", ids.finishAttempt, [attemptId]).result;
    if (!ok(finished, "finishAttempt")) return;
    labsCompleted.add(1);
    delete attempts[attemptId];
  }

  browser.navigate(`/oda/${lab.slug}/sonuc/${attemptId}`);
  browser.prefetch(["/yol-haritasi", `/oda/${lab.slug}`]);
  think(1.5); // rapor okunur
}

/** Eğitim labı: kartlar, mini test cevapları, ilerleme kaydı. */
function playTraining(training) {
  browser.navigate("/odalar");
  browser.prefetch([...data.labs.training.map((t) => `/oda/${t.slug}`), ...data.labs.scenario.map((s) => `/oda/${s.slug}`)]);
  think();
  browser.navigate(`/oda/${training.slug}`);
  browser.prefetch([`/oda/${training.slug}/oyna`]);
  think();
  browser.navigate(`/oda/${training.slug}/oyna`);
  think(0.6);
  trainingsPlayed.add(1);
  training.cards.forEach((card, i) => {
    if (card.options > 0) {
      ok(browser.action("checkTrainingAnswer", ids.checkTrainingAnswer, [training.slug, card.id, Math.floor(Math.random() * card.options)]).result, "checkTrainingAnswer");
      think(0.6);
    }
    ok(browser.action("saveTrainingProgress", ids.saveTrainingProgress, [training.slug, i + 1]).result, "saveTrainingProgress");
    think(0.8);
  });
}

/** Gündem, bir haber (okuma sayısı eylemi) ve profil. */
function browseNews() {
  browser.navigate("/gundem");
  browser.prefetch(data.news.map((s) => `/gundem/${s}`), { runtime: 3 });
  think();
  const slug = pick(data.news);
  const res = browser.navigate(`/gundem/${slug}`);
  // Haber sayfası açılınca tarayıcı okuma eylemini bir kez çağırır (haberin kimliği sayfada).
  const articleId = /"articleId":"([a-z0-9]+)"/.exec(res.body || "");
  if (articleId) browser.action("recordArticleRead", ids.recordArticleRead, [articleId[1]]);
  think(1.5);
  browser.navigate("/profil");
  think();
}

export function student() {
  const n = exec.vu.idInTest;
  const me = data.students[n % data.students.length];
  if (!browser) browser = new Browser({ base, cookies: { [data.cookieName]: me.cookie }, ip: schoolIp(n) });
  studentHome();
  const roll = Math.random();
  const training = data.labs.training[0];
  const lab = data.labs.scenario.length > 0 ? pick(data.labs.scenario) : null;
  if (lab && roll < 0.65) playScenario(lab);
  else if (training && roll < 0.8) playTraining(training);
  else browseNews();
}

// --- Ziyaretçi -------------------------------------------------------------------------------

export function visitor() {
  const n = exec.vu.idInTest;
  // Her yineleme yeni bir ziyaretçi: boş önbellek, oturum yok.
  if (!browser) browser = new Browser({ base, ip: homeIp(n) });
  else browser.reset();
  browser.open("/");
  browser.prefetch([...visitorNav, ...footerLinks, "/giris", "/kayit"], { runtime: 6 });
  think();
  browser.navigate("/gundem");
  browser.prefetch(data.news.map((s) => `/gundem/${s}`), { runtime: 3 });
  think();
  const res = browser.navigate(`/gundem/${pick(data.news)}`);
  const articleId = /"articleId":"([a-z0-9]+)"/.exec(res.body || "");
  if (articleId) browser.action("recordArticleRead", ids.recordArticleRead, [articleId[1]]);
  think(1.5);
  browser.navigate(Math.random() < 0.5 ? "/sss" : "/ogretmenler");
  think();
  browser.navigate("/yol-haritasi");
  browser.prefetch(data.neighborhoods.map((n2) => `/yol-haritasi/${n2}`), { runtime: 1 });
  think();
  browser.navigate("/odalar");
  think();
}

// --- Öğretmen ve yönetici --------------------------------------------------------------------

export function teacher() {
  const n = exec.vu.idInTest;
  const me = data.teachers[n % data.teachers.length];
  if (!browser) browser = new Browser({ base, cookies: { [data.cookieName]: me.cookie }, ip: schoolIp(n) });
  if (browser.current === undefined) browser.open("/siniflarim");
  else browser.navigate("/siniflarim");
  browser.prefetch(me.classrooms.map((c) => `/siniflarim/${c}`));
  think();
  for (const room of me.classrooms) {
    browser.navigate(`/siniflarim/${room}`);
    think(2); // öğretmen sınıfın ilerlemesine bakar
  }
  browser.navigate("/");
  browser.prefetch([...memberNav, "/siniflarim"]);
  think();
}

export function admin() {
  const me = data.admins[0];
  if (!browser) browser = new Browser({ base, cookies: { [data.cookieName]: me.cookie }, ip: homeIp(200) });
  if (browser.current === undefined) browser.open("/yonetim");
  else browser.navigate("/yonetim");
  think(2);
}

/**
 * Isınma: yeni başlamış sunucuda her sayfanın ilk isteği (modül yükleme, JIT) yavaştır; canlı
 * sunucu zaten sıcaktır. Her sayfa birkaç kez açılır; bu istekler kind=warmup etiketlidir ve
 * eşiklere girmez.
 */
export function setup() {
  const student = data.students[0];
  const lab = data.labs.scenario[0];
  const training = data.labs.training[0];
  const paths = [
    "/",
    "/yol-haritasi",
    "/odalar",
    "/gundem",
    "/sss",
    "/ogretmenler",
    "/profil",
    ...data.neighborhoods.map((n) => `/yol-haritasi/${n}`),
    ...data.news.slice(0, 1).map((s) => `/gundem/${s}`),
    ...(lab ? [`/oda/${lab.slug}`, `/oda/${lab.slug}/oyna`] : []),
    ...(training ? [`/oda/${training.slug}`, `/oda/${training.slug}/oyna`] : []),
  ];
  // Isınmada ziyaretçinin oturum isteyen sayfaları giriş sayfasına yönlenir: bu beklenen bir cevap,
  // hata oranına girmesin.
  const warm = { redirects: 0, tags: { kind: "warmup" }, responseCallback: http.expectedStatuses(200, 307) };
  const as = (who, list) => list.map((p) => ["GET", base + p, null, { ...warm, headers: { Cookie: `${data.cookieName}=${who.cookie}` } }]);
  for (let round = 0; round < 3; round++) {
    http.batch(as(student, paths));
    http.batch(paths.map((p) => ["GET", base + p, null, warm]));
    http.batch(as(data.teachers[0], ["/siniflarim", ...data.teachers[0].classrooms.map((c) => `/siniflarim/${c}`)]));
    http.batch(as(data.admins[0], ["/yonetim"]));
  }
}

export function handleSummary(summary) {
  return summarize(summary, { file: __ENV.SUMMARY || "/load/.data/summary.json", title: `Yük testi: ${totalVus} VU (${mix.students} öğrenci, ${mix.visitors} ziyaretçi, ${mix.teachers} öğretmen, ${mix.admins} yönetici)` });
}
