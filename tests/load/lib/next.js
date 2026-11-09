// k6 için tarayıcı benzetimi: Next.js 16 uygulamasına bir tarayıcının attığı istekler.
//
// - Tam sayfa (adres çubuğu, ilk açılış): HTML belgesi; önbellek boşsa statik dosyalar (JS, CSS,
//   yazı tipleri). Etiket kind=page, statikler kind=static.
// - Uygulama içi geçiş (bağlantıya tıklama, router.push): RSC isteği ("rsc: 1", yönlendirici
//   ağacı ve _rsc önbellek parametresiyle). Etiket kind=rsc.
// - Ön yükleme (görünen bağlantılar): önce yalnızca ağaç (/_tree, statik, ucuz; kind=tree), sonra
//   oturumlu kabuk ("next-router-prefetch: 3", sunucuda çizilir; kind=prefetch). Tarayıcı bunları
//   bir süre önbellekte tutar; burada da aynı bağlantı kısa sürede ikinci kez istenmez.
// - Sunucu eylemi: sayfanın adresine "Next-Action: <kimlik>" başlığıyla POST (kind=action).
//   Kimlikler derlemeye özeldir (tests/load/actions.ts).
//
// Her isteğin "name" etiketi adresin şablonudur (/oda/[oda]/oyna); sonuçlar şablona göre toplanır.
// "api: yes" etiketi sunucuda çizilen istekleri (page, rsc, prefetch, action) işaretler: doküman
// Bölüm 7'deki "%95'i 500 ms altında" hedefi bunlara bakar.

import { check } from "k6";
import { sha256 } from "k6/crypto";
import encoding from "k6/encoding";
import http from "k6/http";

const userAgent = "Mozilla/5.0 (Linux; Android 14) CarefulModeYukTesti/1.0 k6";

/** Tarayıcının ön yükleme önbelleği (saniye): ağaç statiktir, oturumlu kabuk kısa yaşar. */
const prefetchStale = { tree: 300, runtime: 30 };

// --- Adresler ve yönlendirici ağacı ------------------------------------------------------

/** Adresteki değişken parçalar: "üst klasör/sıra" -> parametre adı (app/ klasör adları). */
const params = { "yol-haritasi/1": "mahalle", "gundem/1": "haber", "siniflarim/1": "sinif", "katil/1": "kod", "lab/1": "lab", "lab/3": "deneme" };
const authPages = new Set(["giris", "kayit", "dogrula", "sifre-sifirla"]);

/** Adresin route grubu, ağaç parçaları ve etiket adı. */
export function routeOf(path) {
  const pathname = path.split("?")[0];
  const parts = pathname.split("/").filter(Boolean);
  let group = "(visitor)";
  if (parts[0] === "lab" && parts.length > 2) group = "(focus)";
  else if (authPages.has(parts[0])) group = "(auth)";
  else if (parts[0] === "yonetim") group = null;
  const segments = parts.map((part, i) => {
    const param = params[`${parts[0]}/${i}`];
    return param ? [param, decodeURIComponent(part), "d", null] : part;
  });
  const name = "/" + parts.map((part, i) => (params[`${parts[0]}/${i}`] ? `[${params[`${parts[0]}/${i}`]}]` : part)).join("/");
  return { path, pathname, group, segments, name };
}

/**
 * Next'in "next-router-state-tree" başlığı: hedef sayfanın parçaları; tarayıcıdaki sayfadan
 * ayrıldığı ilk parça "refetch" işaretlidir (sunucu oradan aşağısını çizer). Sayılar Next'in
 * parça bayraklarıdır (tarayıcıdan gözlenen değerler).
 */
export function routerTree(target, from) {
  const segs = target.group ? [target.group, ...target.segments] : [...target.segments];
  const prev = from ? (from.group ? [from.group, ...from.segments] : [...from.segments]) : [];
  let diverge = from === undefined ? -1 : segs.findIndex((s, i) => JSON.stringify(s) !== JSON.stringify(prev[i]));
  if (from !== undefined && diverge < 0) diverge = segs.length - 1;
  let node = ["__PAGE__", {}, null, null, target.segments.length ? 162 : 130];
  let underParam = target.segments.some(Array.isArray);
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const isGroup = i === 0 && target.group;
    const flag = isGroup ? 2 : underParam ? 98 : 66;
    // Değişken parçanın üstündekiler (ör. "lab") 66 alır.
    if (Array.isArray(s)) underParam = false;
    node = [s, { children: node }, null, i === diverge ? "refetch" : null, flag];
  }
  return encodeURIComponent(JSON.stringify(["", { children: node }, null, null, 18]));
}

/** Next 16'nın _rsc önbellek parametresi: başlıkların SHA-256 özetinin ilk 12 baytı (base64url). */
export function rscParam(prefetch, segment, tree, nextUrl) {
  const input = [prefetch ?? "0", segment ?? "0", tree ?? "0", nextUrl ?? "0"].join(",");
  return encoding.b64encode(sha256(input, "binary").slice(0, 12), "rawurl");
}

const withRsc = (path, value) => `${path}${path.includes("?") ? "&" : "?"}_rsc=${value}`;

// --- Sunucu eylemi cevabı ----------------------------------------------------------------

/** RSC cevabındaki eylem sonucu: "0:{"a":"$@1",…}\n1:<sonuç>". Sonuç yoksa undefined. */
export function actionResult(body) {
  if (typeof body !== "string") return undefined;
  const match = /(?:^|\n)1:(.*)/.exec(body);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]);
  } catch {
    return undefined;
  }
}

/** Form eylemi (useActionState) gövdesi: alanlar "_1_" önekiyle, önceki durum ve "$K1" ile. */
export function formBody(fields, prevState = { status: "idle" }) {
  const boundary = `----CarefulModeLoad${Math.floor(Math.random() * 1e12).toString(16)}`;
  let body = "";
  for (const [name, value] of Object.entries(fields)) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="_1_${name}"\r\n\r\n${value}\r\n`;
  }
  body += `--${boundary}\r\nContent-Disposition: form-data; name="0"\r\n\r\n${JSON.stringify([prevState, "$K1"])}\r\n--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

// --- Tarayıcı ----------------------------------------------------------------------------

export class Browser {
  /**
   * @param {{ base: string, cookies?: Record<string,string>, ip: string }} options
   * cookies: ad -> değer (oturum çerezi); ip: X-Forwarded-For (sunucuda nginx yazar; okul ağı tek IP'dir).
   */
  constructor({ base, cookies = {}, ip }) {
    this.base = base.replace(/\/$/, "");
    this.ip = ip;
    this.reset(cookies);
  }

  /**
   * Yeni tarayıcı: önbellek boş, çerezler yalnızca verilenler (oturum). Çerezleri
   * k6'nın VU çerez kavanozu tutar (options.noCookiesReset: true); Set-Cookie'ler kendiliğinden işlenir.
   */
  reset(cookies = {}) {
    const jar = http.cookieJar();
    jar.clear(this.base);
    for (const [name, value] of Object.entries(cookies)) jar.set(this.base, name, value, { path: "/" });
    this.current = undefined;
    this.prefetched = {};
    this.assetsLoaded = false;
  }

  headers(extra) {
    return Object.assign({ "User-Agent": userAgent, "Accept-Language": "tr-TR,tr;q=0.9", "Accept-Encoding": "gzip, deflate, br", "X-Forwarded-For": this.ip }, extra);
  }

  /** Tam sayfa açılışı (adres çubuğu). Önbellek boşsa statik dosyalar da gelir. */
  open(path, { expect = 200 } = {}) {
    const route = routeOf(path);
    const res = http.get(this.base + path, {
      headers: this.headers({ Accept: "text/html,application/xhtml+xml,*/*;q=0.8" }),
      redirects: 0,
      tags: { kind: "page", api: "yes", name: route.name },
    });
    check(res, { [`sayfa ${expect}`]: (r) => r.status === expect });
    if (res.status === 200 && !this.assetsLoaded) this.loadAssets(res.body);
    this.current = route;
    return res;
  }

  /** HTML'deki JS ve CSS, CSS'teki (Türkçe için latin ve latin-ext) yazı tipleri. */
  loadAssets(html) {
    this.assetsLoaded = true;
    const found = new Set((html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []).filter((u) => /\.(js|css|woff2)$/.test(u)));
    const get = (url) => ["GET", this.base + url, null, { headers: this.headers({ Accept: "*/*" }), tags: { kind: "static", name: "/_next/static" } }];
    const responses = http.batch([...found].map(get));
    const fonts = new Set();
    responses.forEach((r, i) => {
      check(r, { "statik 200": (x) => x.status === 200 });
      if ([...found][i].endsWith(".css") && typeof r.body === "string") {
        for (const f of r.body.match(/\/_next\/static\/media\/(?:dm-sans|space-grotesk)-latin(?:-ext)?-wght-normal[^)"']*\.woff2/g) || []) fonts.add(f);
      }
    });
    if (fonts.size > 0) http.batch([...fonts].map(get)).forEach((r) => check(r, { "statik 200": (x) => x.status === 200 }));
  }

  /** Uygulama içi geçiş: RSC isteği. */
  navigate(path, { expect = 200 } = {}) {
    if (this.current === undefined) return this.open(path, { expect });
    const route = routeOf(path);
    const tree = routerTree(route, this.current);
    const nextUrl = this.current.pathname;
    const res = http.get(this.base + withRsc(path, rscParam(undefined, undefined, tree, nextUrl)), {
      headers: this.headers({ Accept: "*/*", rsc: "1", "next-router-state-tree": tree, "next-url": nextUrl }),
      redirects: 0,
      tags: { kind: "rsc", api: "yes", name: route.name },
    });
    check(res, { [`geçiş ${expect}`]: (r) => r.status === expect });
    this.current = route;
    return res;
  }

  /** Görünen bağlantıların ön yüklemesi: önce ağaçlar, sonra oturumlu kabuklar (6'şar paralel). */
  prefetch(paths, { runtime = paths.length } = {}) {
    if (this.current === undefined) return;
    const now = Date.now() / 1000;
    const nextUrl = this.current.pathname;
    const fresh = (key, stale) => {
      if (this.prefetched[key] && now - this.prefetched[key] < stale) return false;
      this.prefetched[key] = now;
      return true;
    };
    const trees = [];
    const shells = [];
    paths.forEach((path, i) => {
      const route = routeOf(path);
      if (fresh(`t:${path}`, prefetchStale.tree)) {
        trees.push([
          "GET",
          this.base + withRsc(path, rscParam("1", "/_tree", undefined, nextUrl)),
          null,
          {
            headers: this.headers({ Accept: "*/*", rsc: "1", "next-router-prefetch": "1", "next-router-segment-prefetch": "/_tree", "next-url": nextUrl }),
            redirects: 0,
            tags: { kind: "tree", name: route.name },
          },
        ]);
      }
      if (i < runtime && fresh(`r:${path}`, prefetchStale.runtime)) {
        const tree = routerTree(route, this.current);
        shells.push([
          "GET",
          this.base + withRsc(path, rscParam("3", undefined, tree, nextUrl)),
          null,
          {
            headers: this.headers({ Accept: "*/*", rsc: "1", "next-router-prefetch": "3", "next-router-state-tree": tree, "next-url": nextUrl }),
            redirects: 0,
            tags: { kind: "prefetch", api: "yes", name: route.name },
          },
        ]);
      }
    });
    for (const batch of [trees, shells]) {
      if (batch.length === 0) continue;
      http.batch(batch).forEach((r) => check(r, { "ön yükleme 200": (x) => x.status === 200 }));
    }
  }

  /**
   * Sunucu eylemi: sayfanın adresine POST. args dizi ise düz çağrı (JSON), { form } ise form
   * eylemi (multipart). Dönen: { res, result } (result: RSC'deki eylem sonucu).
   */
  action(name, id, args, { page } = {}) {
    const route = page ? routeOf(page) : this.current;
    const tree = routerTree(route);
    let body;
    let contentType = "text/plain;charset=UTF-8";
    if (Array.isArray(args)) body = JSON.stringify(args);
    else ({ body, contentType } = formBody(args.form, args.prevState));
    const res = http.post(this.base + route.path, body, {
      headers: this.headers({
        Accept: "text/x-component",
        "Content-Type": contentType,
        "Next-Action": id,
        "next-router-state-tree": tree,
        Origin: this.base,
        Referer: this.base + route.path,
      }),
      redirects: 0,
      tags: { kind: "action", api: "yes", name },
    });
    check(res, { "eylem 200": (r) => r.status === 200 });
    return { res, result: res.status === 200 ? actionResult(res.body) : undefined, redirect: res.headers["X-Action-Redirect"] };
  }
}
