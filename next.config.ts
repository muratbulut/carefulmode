import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * İçerik Güvenliği Politikası (CSP; güvenlik turu 5, docs/security/round-5-phase-6.md). Sitenin
 * bütün sayfalarında çalışan en sıkı politika; her yönerge tests/e2e/csp.spec.ts'te birebir
 * beklenir ve site gezilirken tarayıcının hiçbir şeyi engellemediği denetlenir.
 *
 * Neden nonce ya da hash değil: sayfalar Partial Prerendering ile derlemede statik kabuk olarak
 * hazırlanır (cacheComponents). Nonce her istekte yeni olmalı; Next onu yalnızca istek başına
 * çizilen sayfaya koyabilir, yani bütün sayfalar dinamikleşirdi (Faz 6 yük testi). Next'in satır
 * içi akış betikleri (self.__next_f, Suspense parçaları) içerikle değiştiği için hash'le de
 * listelenemez (17 ziyaretçi sayfasında 58 farklı betik). Deneysel `sri` yalnızca dış betik
 * dosyalarına integrity ekler; `script-src 'self'` ile satır içi betikler engellenir ve sayfa hiç
 * canlanmaz (denendi: çerez bandı bile açılmadı). Bu yüzden betiklerde 'unsafe-inline' kalır;
 * politikanın gücü dışarıya kapalı olmasındadır: hiçbir dış adresten betik, stil, görsel, yazı
 * tipi, medya, çerçeve ya da bağlantı yüklenmez, form başka yere gönderilmez, site çerçeveye
 * alınamaz.
 */
const contentSecurityPolicy = {
  // Yazılmayan her tür yalnızca sitenin kendisinden.
  "default-src": ["'self'"],
  // Next'in satır içi akış betikleri ve tema betiği (lib/theme.ts) için 'unsafe-inline' (yukarıda).
  // eval yok: Zod'un denemesi tarayıcıda kapalı (lib/zod.ts). React yalnızca geliştirmede eval
  // kullanır (sunucu hatalarının yığınını tarayıcıda kurmak için), o yüzden 'unsafe-eval' yalnızca
  // `next dev`te.
  "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
  // Satır içi olay öznitelikleri (onclick="...", <img onerror>) hiç çalışmaz: HTML'e sızan bir
  // öznitelik betik çalıştıramaz. React ve Next bunları kullanmaz. Bu yönergeyi tanımayan eski
  // tarayıcı script-src'ye düşer; site orada da çalışır.
  "script-src-attr": ["'none'"],
  // style="..." öznitelikleri için 'unsafe-inline': React sunucuda style özelliğini öznitelik olarak
  // yazar (rozet boyu, arka plandaki iplikler, next/image). Öznitelik CSS'i seçici kuramaz,
  // dışarıdan bir şey yükleyemez (img-src ve font-src 'self').
  "style-src": ["'self'", "'unsafe-inline'"],
  // <style> ve <link rel=stylesheet> yalnızca sitenin CSS dosyaları: satır içi <style> yok (Tailwind
  // ve yazı tipleri derlenmiş dosyalardır). Geliştirmede Next'in hata penceresi <style> kullanır.
  "style-src-elem": ["'self'", ...(isDev ? ["'unsafe-inline'"] : [])],
  // Rozet SVG'leri (public/badges), belge önizlemesindeki görsel; QR kodu satır içi <svg>'dir.
  // data: ve blob: gerekmiyor.
  "img-src": ["'self'"],
  // Yazı tipleri @fontsource paketlerinden derlemeye girer (/_next/static/media).
  "font-src": ["'self'"],
  // Sunucu eylemleri ve sayfa verisi aynı kökten; geliştirmede HMR web soketi de ('self' ws'yi kapsar).
  "connect-src": ["'self'"],
  // Eğitim videosu yalnızca sitenin kendi dosyası (tur 2 O2; lib/lab/content.ts kuralının tarayıcı tarafı).
  "media-src": ["'self'"],
  // Eklenti (<object>, <embed>) yok.
  "object-src": ["'none'"],
  // Tek çerçeve: yönetimdeki öğretmenlik belgesi önizlemesi (aynı kök, kendi sandbox CSP'si var).
  "frame-src": ["'self'"],
  // Web worker ya da service worker yok.
  "worker-src": ["'none'"],
  // <base> etiketi kullanılmaz; sızan bir <base> göreli adresleri başka siteye çeviremez.
  "base-uri": ["'none'"],
  // Formlar (sunucu eylemleri) yalnızca siteye gönderilir. mailto bağlantıları (Okulum "Müdüre
  // gönder") form değil, gezinmedir; CSP onları kısıtlamaz.
  "form-action": ["'self'"],
  // Site hiçbir sayfada çerçeveye alınamaz (X-Frame-Options: DENY'nin CSP karşılığı).
  "frame-ancestors": ["'none'"],
  // upgrade-insecure-requests yok: bütün kaynaklar göreli adresle aynı kökten gelir, HTTPS'i
  // Cloudflare ve HSTS (nginx) zorlar; bu başlık yerel ve CI'daki http koşularında da aynı kalır.
};

const cspHeader = Object.entries(contentSecurityPolicy)
  .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
  .join("; ");

/**
 * Her yanıta eklenen güvenlik başlıkları. Önde hangi ters vekil olursa olsun (sunucudaki
 * nginx ya da Caddy) aynı kalsın diye uygulamada tanımlı. HSTS yalnızca HTTPS'te anlamlı
 * olduğu için ters vekilde eklenir.
 */
const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Siteyi açan başka bir pencere (window.opener) ona erişemez, site de açtığına erişemez.
  // Dış bağlantılar zaten noopener ile açılır; yazdırma ve mailto etkilenmez.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // nginx yanıtı tamponlamasın; akışlı (streaming) sayfalar parça parça gelsin.
  { key: "X-Accel-Buffering", value: "no" },
];

const nextConfig: NextConfig = {
  // Docker imajı için kendi kendine yeten sunucu çıktısı (docker/Dockerfile).
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
  // "Lab" yerine "Oda" (13 Ekim 2026): eski adresler yenisine kalıcı olarak yönlenir, paylaşılmış
  // bağlantılar ve yer imleri kırılmaz. Sorgu dizesi (?ara=...) olduğu gibi taşınır. Yönlendirme
  // proxy.ts'ten önce çalışır; giriş kontrolü yeni adreste yapılır.
  async redirects() {
    return [
      { source: "/lablar", destination: "/odalar", permanent: true },
      { source: "/lab/:path*", destination: "/oda/:path*", permanent: true },
      { source: "/yonetim/lablar/:path*", destination: "/yonetim/odalar/:path*", permanent: true },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Öğretmenlik belgesi en fazla 5 MB (PDF, JPG, PNG); form alanlarıyla birlikte payı bırakılır.
    // nginx de 6 MB'a kadar izin verir (docker/server/nginx-site.conf). Sınır bütün sunucu
    // eylemleri için geçerlidir (Next eylem başına sınır vermez); her eylem kendi girdisinin
    // boyutunu ayrıca denetler (docs/security/round-3-phase-4.md).
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
