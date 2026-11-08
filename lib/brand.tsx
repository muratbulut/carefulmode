// Ürün adı, isim hâli ve maskot simgesi yalnızca bu dosyada durur; isim değişince sadece burası değişir.

import type { SVGProps } from "react";

// Slogan ve açıklama gibi metinler sözlükte (lib/i18n), ürün adı yerine "{brand}" yazılır.
export const brand = {
  name: "Careful Mode",
  // Paylaşım görselinin (opengraph-image) tam adresi buradan kurulur; alan adı değişince burası değişir.
  siteUrl: "https://bitirme.muratbulut.net",
  // Kaynak kodu (AGPL-3.0); alt bilgideki "Kaynak kodu" bağlantısı.
  sourceUrl: "https://github.com/muratbulut/carefulmode",
} as const;

/*
 * Maskot: hap biçiminde bir düğme ve sağ ucunda gözlü başı (logo tuvalindeki "A · Orijinal").
 * Gövde --logo, göz bebeği --logo-eye; ikisi de iki temada globals.css'te tanımlı.
 * Göz beyazı her temada beyazdır (maskotun parçası, tema rengi değil).
 */
export const EYE_WHITE = "#ffffff";

/** Maskot simgesi (128×72). Süs olarak kullanılır; erişilebilir adı çevresindeki bağlantı verir. */
export function LogoMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 128 72" aria-hidden="true" {...props}>
      <rect x="4" y="4" width="120" height="64" rx="32" fill="var(--logo)" />
      <circle cx="90" cy="36" r="24" fill={EYE_WHITE} />
      <circle cx="96" cy="36" r="10.5" fill="var(--logo-eye)" />
      <circle cx="99.6" cy="31.8" r="3.2" fill={EYE_WHITE} />
    </svg>
  );
}

/** Maskotun çizgi hâli: arayüz ikonlarıyla (lucide) aynı ölçü ve çizgide, rengi currentColor. */
export function LogoLineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="2" y="6" width="20" height="12" rx="6" />
      <circle cx="16" cy="12" r="3" />
      <circle cx="16.8" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

// İsim hâli "careful m◐de": harfler Unbounded Bold'dan çizilmiş yollar (yazı tipi siteye yüklenmez),
// O harfinin yerinde maskot. Ölçüler yazı tipinin 1000 birimlik em karesinde; harf aralığı -0,03 em.
const WORDMARK_LEFT = "M737 -241Q729 -164 681 -106Q633 -48 556 -16Q480 16 385 16Q280 16 200 -22Q120 -60 75 -128Q30 -196 30 -285Q30 -375 75 -443Q120 -511 200 -550Q280 -588 385 -588Q480 -588 556 -556Q633 -523 681 -466Q729 -408 737 -330H534Q523 -381 483 -408Q443 -436 385 -436Q340 -436 306 -418Q273 -401 254 -368Q236 -334 236 -285Q236 -237 254 -204Q273 -170 306 -152Q340 -135 385 -135Q443 -135 484 -164Q524 -193 534 -241ZM1304 0 1278 -206 1305 -285 1278 -364 1304 -571H1516L1480 -286L1516 0ZM1352 -285Q1338 -195 1296 -127Q1255 -59 1192 -22Q1128 16 1047 16Q963 16 900 -22Q836 -59 800 -128Q764 -196 764 -285Q764 -376 800 -444Q836 -512 900 -550Q963 -588 1047 -588Q1128 -588 1192 -550Q1255 -513 1297 -446Q1339 -378 1352 -285ZM971 -285Q971 -243 988 -210Q1006 -177 1037 -158Q1068 -140 1108 -140Q1150 -140 1187 -158Q1224 -177 1252 -210Q1280 -243 1294 -285Q1280 -328 1252 -361Q1224 -394 1187 -413Q1150 -432 1108 -432Q1068 -432 1037 -413Q1006 -394 988 -361Q971 -328 971 -285ZM1557 -571H1765L1799 -367V0H1595V-379ZM2067 -580V-406Q2037 -412 2010 -414Q1984 -417 1962 -417Q1918 -417 1881 -400Q1844 -382 1822 -342Q1799 -302 1799 -235L1760 -283Q1768 -345 1784 -400Q1800 -454 1828 -496Q1855 -539 1896 -564Q1937 -588 1996 -588Q2013 -588 2031 -586Q2049 -584 2067 -580ZM2442 16Q2338 16 2256 -22Q2175 -60 2128 -128Q2081 -197 2081 -288Q2081 -377 2126 -444Q2171 -512 2250 -550Q2328 -588 2427 -588Q2530 -588 2602 -544Q2675 -499 2714 -418Q2754 -337 2754 -227H2246V-350H2639L2572 -307Q2568 -351 2550 -382Q2532 -412 2502 -428Q2473 -444 2432 -444Q2387 -444 2355 -426Q2323 -408 2305 -376Q2287 -345 2287 -303Q2287 -249 2312 -212Q2336 -174 2384 -154Q2431 -134 2500 -134Q2563 -134 2626 -150Q2688 -167 2739 -197V-67Q2680 -27 2604 -6Q2529 16 2442 16ZM3217 -634Q3150 -634 3124 -610Q3097 -587 3097 -535V0H2893V-525Q2893 -608 2927 -666Q2961 -725 3028 -756Q3094 -786 3192 -786Q3236 -786 3270 -780Q3305 -774 3344 -763V-613Q3314 -624 3282 -629Q3251 -634 3217 -634ZM2777 -373V-524H3330V-373ZM3616 16Q3536 16 3480 -17Q3423 -50 3393 -110Q3363 -171 3363 -252V-571H3567V-281Q3567 -218 3598 -184Q3629 -150 3687 -150Q3730 -150 3759 -168Q3788 -185 3804 -218Q3820 -251 3820 -297L3883 -264Q3872 -173 3834 -110Q3795 -48 3739 -16Q3683 16 3616 16ZM3857 0 3820 -229V-571H4024V-197L4061 0ZM4117 -770H4322V0H4117ZM4595 -571H4800L4837 -343V0H4633V-374ZM5034 -588Q5113 -588 5168 -555Q5223 -522 5252 -462Q5281 -402 5281 -320V0H5077V-290Q5077 -354 5048 -388Q5019 -422 4964 -422Q4925 -422 4896 -404Q4868 -386 4852 -353Q4837 -320 4837 -275L4774 -308Q4786 -399 4823 -462Q4860 -524 4914 -556Q4969 -588 5034 -588ZM5477 -588Q5556 -588 5612 -555Q5667 -522 5696 -462Q5725 -402 5725 -320V0H5521V-290Q5521 -354 5492 -388Q5463 -422 5408 -422Q5369 -422 5340 -404Q5312 -386 5296 -353Q5281 -320 5281 -275L5218 -308Q5230 -399 5266 -462Q5303 -524 5358 -556Q5413 -588 5477 -588Z";
const WORDMARK_RIGHT = "M7480 0 7453 -214 7488 -284 7454 -372 7502 -770H7714L7655 -301L7691 0ZM7524 -285Q7510 -195 7468 -127Q7427 -59 7364 -22Q7300 16 7219 16Q7135 16 7072 -22Q7008 -59 6972 -128Q6936 -196 6936 -285Q6936 -376 6972 -444Q7008 -512 7072 -550Q7135 -588 7219 -588Q7300 -588 7364 -550Q7427 -513 7469 -446Q7511 -378 7524 -285ZM7143 -285Q7143 -243 7160 -210Q7178 -177 7209 -158Q7240 -140 7280 -140Q7322 -140 7359 -158Q7396 -177 7424 -210Q7452 -243 7466 -285Q7452 -328 7424 -361Q7396 -394 7359 -413Q7322 -432 7280 -432Q7240 -432 7209 -413Q7178 -394 7160 -361Q7143 -328 7143 -285ZM8093 16Q7989 16 7908 -22Q7826 -60 7779 -128Q7732 -197 7732 -288Q7732 -377 7777 -444Q7822 -512 7900 -550Q7979 -588 8078 -588Q8181 -588 8254 -544Q8326 -499 8366 -418Q8405 -337 8405 -227H7897V-350H8290L8223 -307Q8219 -351 8201 -382Q8183 -412 8154 -428Q8124 -444 8083 -444Q8038 -444 8006 -426Q7974 -408 7956 -376Q7938 -345 7938 -303Q7938 -249 7962 -212Q7987 -174 8034 -154Q8082 -134 8151 -134Q8214 -134 8276 -150Q8339 -167 8390 -197V-67Q8331 -27 8256 -6Q8180 16 8093 16Z";

/**
 * İsim hâli. Yüksekliği className ile verilir (genişlik oranla gelir); yazı rengi currentColor.
 * Çevresindeki bağlantı ürün adını söylüyorsa süstür (varsayılan); tek başına duruyorsa
 * `labelled` ile ekran okuyucuya ürün adı okunur.
 */
export function Wordmark({
  labelled = false,
  live = false,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { labelled?: boolean; live?: boolean }) {
  const a11y = labelled ? { role: "img", "aria-label": brand.name } : { "aria-hidden": true };
  // Canlı hâlde (üst menü) O harfindeki maskotun gözü bakar ve kırpar; sınıflar components/mascot/mascot.css'te.
  // Göz bebeği topun ortasında çizilir, varsayılan bakış (sağa) --mc-x ile gelir; düz hâlde aynı yerde durur.
  const liveClass = live ? "mc mc-wordmark mc-follow mc-blink" : undefined;
  const lookStyle = live ? undefined : { transform: "translate(51.6px, 0)" };
  return (
    <svg viewBox="0 -790 8436 812" fill="currentColor" {...a11y} {...props} className={[liveClass, className].filter(Boolean).join(" ") || undefined}>
      <path d={WORDMARK_LEFT} />
      <rect className="mc-trk" x="5808" y="-566" width="1031" height="550" rx="275" fill="var(--logo)" />
      <g className="mc-knob">
        <circle className="mc-ball" cx="6548" cy="-290" r="206" fill={EYE_WHITE} />
        <g className="mc-look" style={lookStyle}>
          <g className="mc-eye">
            <circle cx="6548" cy="-290" r="90" fill="var(--logo-eye)" />
            <circle cx="6579" cy="-326" r="27.5" fill={EYE_WHITE} />
          </g>
        </g>
        {live ? <path className="mc-arc" d="M6454 -290 Q6548 -221 6642 -290" fill="none" stroke="var(--logo-eye)" strokeWidth="43" strokeLinecap="round" /> : null}
      </g>
      <path d={WORDMARK_RIGHT} />
    </svg>
  );
}
