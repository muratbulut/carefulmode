// Telefonda ilk açılış (doküman Bölüm 7: "lab sayfasının ilk açılışı orta seviye bir telefonda 3
// saniyenin altında"). Playwright ile Chromium açılır; Chrome DevTools Protocol ile orta seviye
// telefon koşulları verilir: CPU 4 kat yavaş, ağ "Slow 4G" (150 ms gidiş-dönüş, 1,6 Mbps indirme,
// 750 Kbps yükleme), 390 px genişlik. Her ölçüm yeni ve boş bir tarayıcı bağlamıdır (soğuk açılış:
// önbellek yok); öğrenci giriş yapmıştır (prepare.ts çerezi).
//
//   node tests/load/phone.ts [--base http://localhost:3205] [--runs 5] [--rtt 150]
//
// Ölçülenler (ortanca): TTFB, FCP, LCP, DOMContentLoaded, load, etkileşime hazır (TTI: FCP'den sonra
// 5 sn boyunca uzun görev olmayan ilk anın başı; Lighthouse'un tanımının sadeleştirilmiş hali),
// toplam ve JS aktarım boyutu, LCP öğesi. TTFB öykünülen gecikmeyi içermez (DevTools gecikmeyi
// yanıtın gövdesine ekler); gecikme FCP'de görünür. Metin LCP'si web yazı tipi inince yeniden
// ölçülebilir (font-display: swap): yedek yazı tipiyle metin daha önce görünür. Yalnızca yerel derlemeye karşı (CI'da koşmaz; Playwright testi değildir).
//
// Not: DevTools ağ kısıtlaması istek başına gecikme ekler; Lighthouse aynı "Slow 4G"yi bu yolla
// verirken gecikmeyi 562,5 ms alır (paket düzeyindeki kısıtlamaya yaklaşmak için). Daha karamsar
// ölçüm için: --rtt 562.5 --down 1.44.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { chromium, type Browser } from "@playwright/test";

const { values: args } = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:3205" },
    runs: { type: "string", default: "5" },
    rtt: { type: "string", default: "150" },
    down: { type: "string", default: "1.6" },
    up: { type: "string", default: "0.75" },
    cpu: { type: "string", default: "4" },
    paths: { type: "string" },
  },
});

const base = args.base.replace(/\/$/, "");
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("Yalnızca yerel derleme (http://localhost:<port>); canlı ölçüm ayrı bir karardır (README).");
  process.exit(1);
}
const runs = Number.parseInt(args.runs, 10);
const mbps = (value: string) => (Number(value) * 1024 * 1024) / 8;
const network = { offline: false, latency: Number(args.rtt), downloadThroughput: mbps(args.down), uploadThroughput: mbps(args.up) };

type Users = { cookieName: string; students: { cookie: string }[]; labs: { scenario: { slug: string }[] } };
const users = JSON.parse(readFileSync("tests/load/.data/users.json", "utf8")) as Users;
const lab = users.labs.scenario[0]?.slug;
if (!lab) {
  console.error("Yayında senaryo labı yok (npm run db:seed) ya da prepare.ts çalışmadı.");
  process.exit(1);
}
const paths = args.paths ? args.paths.split(",") : [`/oda/${lab}`, `/oda/${lab}/oyna`];

/** Sayfa açılmadan önce: LCP, FCP ve uzun görevleri toplar. */
const observers = () => {
  const w = window as unknown as { __perf: { lcp: number; lcpTag: string; fcp: number; longTasks: [number, number][] } };
  w.__perf = { lcp: 0, lcpTag: "-", fcp: 0, longTasks: [] };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as (PerformanceEntry & { element?: Element | null })[]) {
      if (e.startTime < w.__perf.lcp) continue;
      w.__perf.lcp = e.startTime;
      const el = e.element;
      // LCP öğesi: etiket ve (varsa) test kimliği ya da ilk sınıf adı.
      const id = el?.closest("[data-testid]")?.getAttribute("data-testid");
      w.__perf.lcpTag = el ? `${el.tagName.toLowerCase()}${id ? `[${id}]` : el.classList[0] ? "." + el.classList[0] : ""}` : "-";
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (e.name === "first-contentful-paint") w.__perf.fcp = e.startTime;
  }).observe({ type: "paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) w.__perf.longTasks.push([e.startTime, e.startTime + e.duration]);
  }).observe({ type: "longtask", buffered: true });
};

type Sample = { ttfb: number; fcp: number; lcp: number; dcl: number; load: number; tti: number; kb: number; jsKb: number; requests: number; lcpTag: string };

async function measure(browser: Browser, path: string): Promise<Sample> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
    locale: "tr-TR",
    userAgent: "Mozilla/5.0 (Linux; Android 14; orta seviye telefon) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36",
  });
  await context.addCookies([
    { name: users.cookieName, value: users.students[0].cookie, url: base },
  ]);
  const page = await context.newPage();
  await page.addInitScript(observers);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", network);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(args.cpu) });

  await page.goto(base + path, { waitUntil: "load", timeout: 60_000 });
  // LCP ve uzun görevler yerleşsin: 5 sn sessizlik ya da en çok 20 sn.
  const started = Date.now();
  let lastTask = 0;
  while (Date.now() - started < 20_000) {
    await page.waitForTimeout(500);
    const tasks = await page.evaluate(() => (window as unknown as { __perf: { longTasks: [number, number][] } }).__perf.longTasks.length);
    if (tasks !== lastTask) {
      lastTask = tasks;
      continue;
    }
    const quietFor = await page.evaluate(() => {
      const perf = (window as unknown as { __perf: { longTasks: [number, number][] } }).__perf;
      const end = perf.longTasks.reduce((m, t) => Math.max(m, t[1]), 0);
      return performance.now() - end;
    });
    if (quietFor > 5000) break;
  }
  const result = await page.evaluate(() => {
    const perf = (window as unknown as { __perf: { lcp: number; lcpTag: string; fcp: number; longTasks: [number, number][] } }).__perf;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const fcp = perf.fcp;
    // TTI: FCP'den sonraki son uzun görevin bitişi (yoksa FCP), en erken DOMContentLoaded.
    const tasksAfter = perf.longTasks.filter((t) => t[1] > fcp);
    const tti = Math.max(nav.domContentLoadedEventEnd, tasksAfter.reduce((m, t) => Math.max(m, t[1]), fcp));
    const all = [nav as PerformanceResourceTiming, ...resources];
    return {
      ttfb: nav.responseStart,
      fcp,
      lcp: perf.lcp,
      dcl: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
      tti,
      kb: all.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024,
      jsKb: resources.filter((r) => r.name.endsWith(".js")).reduce((s, r) => s + (r.transferSize || 0), 0) / 1024,
      requests: all.length,
      lcpTag: perf.lcpTag,
    };
  });
  await context.close();
  return result;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const s = (msValue: number) => `${(msValue / 1000).toFixed(2)} sn`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
try {
  console.log(`Telefon: CPU ${args.cpu}× yavaş, ${network.latency} ms RTT, ${args.down} Mbps indirme, ${args.up} Mbps yükleme, 390 px · ${runs} soğuk açılış, ortanca`);
  for (const path of paths) {
    const samples: Sample[] = [];
    for (let i = 0; i < runs; i++) samples.push(await measure(browser, path));
    const m = (key: keyof Omit<Sample, "lcpTag">) => median(samples.map((x) => x[key]));
    console.log(
      `${path}\n  TTFB ${s(m("ttfb"))} · FCP ${s(m("fcp"))} · LCP ${s(m("lcp"))} · DOMContentLoaded ${s(m("dcl"))} · load ${s(m("load"))} · etkileşime hazır ${s(m("tti"))}\n` +
        `  aktarım ${m("kb").toFixed(0)} KB (JS ${m("jsKb").toFixed(0)} KB), ${m("requests")} istek · LCP öğesi: ${samples.at(-1)!.lcpTag}\n` +
        `  tek tek LCP: ${samples.map((x) => s(x.lcp)).join(", ")} · etkileşime hazır: ${samples.map((x) => s(x.tti)).join(", ")}`,
    );
  }
} finally {
  await browser.close();
}
