# Yük testi ve telefonda ilk açılış

Doküman Bölüm 7'deki performans hedeflerinin ölçümü (Faz 6):

- 100 sanal kullanıcıyla 10 dakikalık k6 testinde API isteklerinin %95'i 500 ms'nin altında, hata oranı %1'in altında.
- Lab sayfasının ilk açılışı orta seviye bir telefonda 3 saniyenin altında.
- Varsayım: her aktif kullanıcı ortalama 5 saniyede bir istek yapar. Sunucudaki sınırlar: uygulama 2 CPU / 1 GB, veritabanı 1,5 CPU / 1 GB (`docker/server/compose.yml`).

Bu klasördeki hiçbir betik CI'da koşmaz ve canlı siteye istek atmaz; hepsi yerel bir kopyaya (127.0.0.1) karşı çalışır. Canlıda koşu ayrı bir karardır (aşağıda "Canlıda koşu").

## Dosyalar

| Dosya | Ne yapar |
| --- | --- |
| `scenario.js` | Asıl k6 senaryosu: öğrenci, ziyaretçi, öğretmen ve yönetici karışımı, eşikler doküman hedefleri |
| `school-ip.js` | Okul gerçeği: bir sınıfın bütün öğrencileri tek IP'den kayıt olur, kodla doğrular, sınıfa katılır, giriş yapar |
| `lib/next.js` | k6 için küçük "tarayıcı": sayfa, geçiş (RSC), ön yükleme ve sunucu eylemi isteklerini Next.js'in gönderdiği gibi kurar |
| `lib/summary.js` | Türkçe özet tablosu (tür ve yol başına p95, hata oranı, istek/sn) |
| `prepare.ts` | Yük hesaplarını açar (öğrenci, öğretmen + sınıf, yönetici), oturumları sunucuda açıp çerezleri `.data/users.json`'a yazar |
| `cleanup.ts` | Yük hesaplarını ve ürettikleri her şeyi siler |
| `accounts.ts` | Ortak: yük hesaplarının alan adı, yük verisini silme |
| `safety.ts` | Yalnızca bu makinedeki veritabanı denetimi (`?host=` dahil) ve her koşuda yeni hesap şifresi (`tests/unit/load-safety.test.ts`) |
| `actions.ts` | Çalışan derlemenin sunucu eylemi kimliklerini okur (`.data/actions.json`) |
| `stack.sh` | Sunucudaki sınırlarla yerel üretim yığını (`cg-load`, port 3205) ve araçlar |
| `run-local.sh` | Tek komutla tam koşu: derle, kur, hesap aç, k6, CPU örnekle, temizle, kaldır |
| `compose.yml` | Yığının yük testine özgü eki (veritabanı portu, imaj adları, kod maili klasörü) |
| `outbox-server.ts` | Okul-IP denemesinde kod maillerini k6'ya veren küçük yerel sunucu |
| `phone.ts` | Telefonda ilk açılış ölçümü (Playwright + Chrome DevTools Protocol) |
| `cost.ts` | İstek başına sunucu CPU'su (uygulama ve veritabanı ayrı); yavaş bir yolun nedenini bulmak için |

`.data/` klasörü (oturum çerezleri, eylem kimlikleri, özetler) depoya girmez.

## Hazırlık

- Docker (yığın ve k6 için; k6 `grafana/k6` imajıyla koşar, kurulum gerekmez).
- `npm install` (Prisma istemcisi ve Playwright; yeni paket yok).
- Telefon ölçümü için Playwright'ın Chromium'u (`npx playwright install chromium`) ya da `PW_CHROMIUM_PATH`.
- Bu bulut ortamında derleme vekil sertifikası ister: `LOAD_NODE_IMAGE=cg-node:22` (node:22-alpine + vekil CA). Başka makinede gerekmez.

Yığın `/tmp/cg-load/stack` altında kendi `.env`'ini üretir (rastgele veritabanı şifresi ve oturum imzası; depoya ve loga girmez). Yerel geliştirme veritabanına dokunmaz. Proje adı (`LOAD_PROJECT`, varsayılan `cg-load`) `cyberguard` olamaz: o asıl yığının adıdır ve `down` onun veritabanı birimini silerdi.

## Yerel koşu

```bash
npm run load:smoke     # kısa deneme: 10 VU, 30 sn ısınma + 2 dk + 30 sn iniş (derleme hariç ~4 dk)
npm run load:local     # doküman hedefi: 100 VU, 1 dk ısınma + 10 dk + 1 dk iniş (derleme hariç ~14 dk)
```

Derleme (iki imaj) makineye göre birkaç dakika sürer; aynı kodla tekrar koşarken `SKIP_BUILD=1`. Tam koşu sırasında makinede başka ağır iş olmamalı: k6 ve yığın aynı makinededir, ölçüm makinenin boşluğuna bağlıdır.

`run-local.sh` sırasıyla: imajları derler (`SKIP_BUILD=1` ile atlanır; derleme günlüğü `$TMPDIR/cg-load-build.log`), yığını kurar ve sağlıklı olmasını bekler (migration + seed), eylem kimliklerini çalışan konteynerden okur, yük hesaplarını açar, k6'yı koşturur, bu sırada 5 sn'de bir CPU ve bellek örnekler, özeti `/tmp/cg-load/stack/summary-<zaman>.json`'a kopyalar, hesapları siler (`KEEP_DATA=1` ile bırakılır) ve yığını kaldırır (`KEEP_STACK=1` ile bırakılır). Çıkış kodu k6'nınkidir: 0 hedefler tuttu, 99 bir eşik aşıldı.

Ayarlar (ortam değişkeni): `VUS`, `RAMP`, `HOLD`, `RAMP_DOWN`, `THINK` (ortalama düşünme süresi, 5 sn), `HACK_RATE` (senaryo labında yanlış karar oranı, 0,3), `LOAD_STUDENTS` (açılacak öğrenci hesabı, en az öğrenci VU'su kadar; 100), `LOAD_TEACHERS` (4).

Adım adım (yığını açık tutup tekrar tekrar koşmak için):

```bash
bash tests/load/stack.sh build          # imajlar: cg-load-app:local, cg-load-migrate:local
bash tests/load/stack.sh up             # 127.0.0.1:3205, veritabanı 127.0.0.1:15205
bash tests/load/stack.sh actions        # eylem kimlikleri (her derlemede değişir)
bash tests/load/stack.sh prepare --students 100 --teachers 4
VUS=10 HOLD=2m bash tests/load/stack.sh k6 scenario.js
bash tests/load/stack.sh cleanup        # yük hesaplarını sil
bash tests/load/stack.sh down           # yığını ve veritabanını kaldır
```

### Senaryo

Kullanıcı karışımı: %80 öğrenci, %14 ziyaretçi, %5 öğretmen, 1 yönetici (100 VU'da 80/14/5/1). Her kullanıcı her adımdan sonra ortalama `THINK` saniye (0,4 ile 1,6 katı arası) düşünür.

- Öğrenci: ana sayfa, sonra her turda %65 senaryo labı (yol haritası → mahalle → lab kapağı → oynatıcı → deneme başlat → olay paketleri → %30 hacklenme yolu, değilse doğru kararlar → bitir → rapor), %15 eğitim labı (kartlar, test soruları, ilerleme kaydı), %20 gündem (haber, okundu kaydı) ve profil.
- Ziyaretçi: tanıtım sayfası, gündem, haber, SSS ya da Öğretmenler için, yol haritası, lablar. Her turda yeni ziyaretçi (boş tarayıcı).
- Öğretmen: Sınıflarım, sınıf detayları, ana sayfa. Yönetici: Özet.

Bir adım tarayıcıda olduğu gibi birden çok istektir: belge ya da geçiş (RSC) isteği, görünen bağlantıların ön yüklemesi (Next.js'in `prefetch` istekleri) ve ilk açılışta statik dosyalar. Bu yüzden saniyedeki istek sayısı dokümandaki "100 kullanıcı × 5 sn'de bir = 20 istek/sn" tahmininin yaklaşık üç katıdır; sunucunun gördüğü yük budur.

Hesaplar her VU'ya önceden açılmış oturumla gelir (`prepare.ts` Better Auth'un kendi `signInEmail`'iyle oturumu sunucuda açar). 100 girişi tek IP'den yapmak giriş sınırına takılırdı ve ölçmek istediğimiz şey o değil; giriş ve kayıt `school-ip.js`'te ayrıca denenir. Her kullanıcının isteği kendi test IP'sinden gelir (`X-Forwarded-For`, RFC 5737 belgeleme aralıkları: okul 203.0.113.0/24, ev 198.51.100.0/24).

### Özeti okumak

Özet tablosu istekleri türe göre ayırır:

| Tür | Ne | "API" sayılır mı |
| --- | --- | --- |
| `page` | Belge isteği (ilk açılış, adres çubuğu) | evet |
| `rsc` | Sayfa geçişi (bağlantıya tıklama; React sunucu bileşenleri) | evet |
| `prefetch` | Görünen bağlantının ön yüklemesi (oturuma göre değişen kısım) | evet |
| `action` | Sunucu eylemi (deneme başlat, olay paketi, bitir, eğitim cevabı, okundu) | evet |
| `tree` | Ön yüklemenin değişmeyen ağaç kısmı (derlemede üretilir) | hayır |
| `static` | JS, CSS, yazı tipi | hayır |

Eşikler: `http_req_failed` < %1, kontroller > %99, `api:yes` istekleri ve her tür ayrı ayrı p95 < 500 ms. 200 dışındaki her cevap hatadır (oturumlu sayfa giriş sayfasına yönlenirse görülür). Başlangıçtaki ısınma turu (`setup`, `kind:warmup`) eşiklere girmez: ilk çizimler derlemeden sonraki tek seferlik maliyettir. Tablonun altında en yavaş 25 yol (p95'e göre) ve sayaçlar (biten lab, hacklenen lab, eğitim, akış hatası) vardır.

Yavaş çıkan bir yolun nedenini ayırmak için yük yokken:

```bash
node tests/load/cost.ts --n 20          # her istek türü için uygulama ve veritabanı CPU'su (ms/istek)
```

## Okul-IP denemesi

```bash
npm run load:school                     # 1 sınıf × 35 öğrenci, aynı IP, ~7 dk
CLASSES=2 npm run load:school           # aynı saatte iki sınıf (70 öğrenci)
```

Yığın açık ve `prepare` yapılmış olmalı (okul-IP sınıfının kodu oradan gelir). Her öğrenci bir kez: kayıt sayfası → form (20-60 sn) → kayıt → doğrulama sayfası → mailden kod → doğrulama → ana sayfa → sınıf koduyla katılma → (ortak bilgisayar, yeni tarayıcı) giriş. Öğrenciler ders başında `WINDOW` (4 dk) içinde gelir. Kod mailleri uygulamanın `MAIL_OUTBOX_DIR` klasöründen okunur. Her koşu yeni bir okul IP'si seçer (aynı IP önceki koşunun sayaçlarına takılır).

## Telefonda ilk açılış

```bash
npm run load:phone                                  # 5 soğuk açılış, ortanca
npm run load:phone -- --rtt 562.5 --down 1.44 --up 0.66 --runs 3   # Lighthouse'un karamsar Slow 4G'si
```

Yığın açık ve `prepare` yapılmış olmalı (öğrenci çerezi `.data/users.json`'dan). Varsayılan: CPU 4 kat yavaş, Slow 4G (150 ms gidiş-dönüş, 1,6 Mbps indirme, 750 Kbps yükleme), 390 px, DPR 2,75; her ölçüm boş bir tarayıcı bağlamıdır (önbellek yok). Ölçülen sayfalar: lab kapağı (`/lab/[lab]`) ve oynatıcı (`/lab/[lab]/oyna`); başka sayfalar `--paths /,/yol-haritasi`.

"Etkileşime hazır" Lighthouse'un TTI tanımının sadeleştirilmiş halidir: FCP'den sonraki son uzun görevin (50 ms üstü) bittiği an. TTFB öykünülen gecikmeyi içermez (DevTools gecikmeyi gövdeye ekler; FCP'de görünür).

## Canlıda koşu (henüz yapılmadı; Murat ile)

Canlıda yük testi yalnızca Murat'la birlikte ve önceden konuşulmuş bir zaman diliminde yapılır. Sunucuda başka işler de çalışır; test onları da etkiler.

Ön kontrol listesi:

1. Murat'la zamanı ve süreyi kararlaştır: kısa bir pencere, sitenin ve diğer işlerin az kullanıldığı bir saat. Murat sunucunun başında olsun.
2. Hesaplar: `prepare.ts` ve `cleanup.ts` yalnızca bu makinedeki veritabanında çalışır (`safety.ts`): sürücünün gerçekten bağlanacağı adres (`?host=` dahil) `localhost`, `127.0.0.1` ya da `::1` olmalı. Sunucuda yığının ağındaki `db` canlı veritabanıdır ve bilerek reddedilir. Canlıda yük hesabı açmak (biri yönetici; sonra silmek) üretim veritabanına yazmak demektir; bu ayrı bir karardır ve verilirse denetim o gün, o koşu için bilerek değiştirilir. Seçenekler: sunucuda bir kerelik konteynerle açmak ya da canlıda yalnızca ziyaretçi senaryosunu koşmak. Hesapların şifresi her `prepare`'de rastgele üretilir ve yalnızca `.data/users.json`'a (0600) yazılır; depoda sabit şifre yoktur.
3. Eylem kimlikleri canlıdaki derlemeden okunur: `docker exec cyberguard-app-1 cat /app/.next/server/server-reference-manifest.json` (sunucuda), sonra `actions.ts` aynı biçime çevirir. Her yayında değişir; testten hemen önce alınır, test sırasında yayın yapılmaz.
4. Nereden koşulacağı: dışarıdan (https, Cloudflare ve nginx üzerinden; gerçekçi) ya da sunucudan 127.0.0.1'e (k6 da aynı CPU'yu kullanır, diğer işlerle yarışır). Dışarıdan koşuda bütün VU'lar k6 makinesinin IP'sinden gelir: nginx `X-Forwarded-For`'u kendisi yazar, test IP'leri geçmez; giriş ve kayıt sınırları buna göre düşünülmeli (oturumlu senaryo giriş yapmaz, sınıra takılmaz). Cloudflare'in bot ve hız kuralları k6'yı engelleyebilir; önce düşük VU ile denenir.
5. Önce düşük VU: `VUS=10 HOLD=2m`, sonra 50, sonra 100. Her adımda sunucuda `docker stats` ile uygulama, veritabanı ve sunucudaki diğer yığınlar izlenir; diğer sitelerin açıldığı elle de denenir.
6. Durdurma ölçütü: hata oranı %1'i aşarsa, diğer siteler yavaşlarsa ya da sunucunun belleği dolmaya başlarsa k6 durdurulur (Ctrl+C; `gracefulRampDown` 30 sn).
7. Bitince yük hesapları ve ürettikleri (denemeler, okundu sayıları, `RateLimit` satırları) silinir; Özet panelindeki sayılar bunlardan etkilenir.

## Sonuçlar

Bütün ölçümler bu depodaki bulut geliştirme makinesinde (4 çekirdek), sunucudaki sınırlarla (uygulama 2 CPU / 1 GB, veritabanı 1,5 CPU / 1 GB) kurulan yerel yığına (`cg-load`) karşı yapıldı.

### Tam koşu (12 Ekim 2026, `npm run load:local`): doküman hedefleri tutuyor

100 VU (80 öğrenci, 14 ziyaretçi, 5 öğretmen, 1 yönetici), 1 dk ısınma + 10 dk + 1 dk iniş, düşünme 5 sn. Faz 6'nın bütün değişiklikleri birleşmiş dalda (CSP dahil), makinede başka iş yokken.

| tür | istek | istek/sn | ortanca | p95 | p99 | en çok |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **API (hepsi)** | 30022 | 39,9 | 69 ms | **280 ms** | 443 ms | 907 ms |
| page | 371 | 0,5 | 87 ms | 247 ms | 306 ms | 451 ms |
| rsc | 7623 | 10,1 | 71 ms | 319 ms | 532 ms | 907 ms |
| prefetch | 14141 | 18,8 | 91 ms | 310 ms | 455 ms | 841 ms |
| action | 7887 | 10,5 | 34 ms | 132 ms | 194 ms | 312 ms |
| tree | 7961 | 10,6 | 15 ms | 66 ms | 109 ms | 208 ms |
| static | 6308 | 8,4 | 18 ms | 81 ms | 118 ms | 244 ms |

- Toplam 44378 istek (59,0/sn), **hata oranı %0,00**, kontroller %100; bütün eşikler geçti (hedef: API p95 < 500 ms, hata < %1).
- 462 senaryo labı bitti (226'sı hacklenerek), 165 eğitim labı oynandı.
- En yavaş yol öğrencinin ana sayfasına geçiş (`rsc /`, p95 536 ms, en çok 907 ms); diğer bütün yollar p95 < 400 ms.
- Kaynak (docker stats, 149 örnek): uygulama ortalama 0,87 çekirdek (en çok 1,59; sınır 2), 205 MiB; veritabanı 0,13 çekirdek (en çok 0,25; sınır 1,5), 69 MiB; k6 0,11 çekirdek. Makinenin tamamı ortalama %31, en çok %45.
- Sonuç: 100 eş zamanlı kullanıcıda uygulama sınırının yarısından azını kullanıyor; darboğaz yok. Ana sayfanın toplam sayıları öğrenci sayısıyla büyüyen bir sorguyla hesaplanıyor (`getCompletionCounts`, `getLabStats`); öğrenci sayısı çok artarsa ilk bakılacak yer orası.

Aşağıdakiler tam koşudan önceki kısa deneme koşularıdır.

### Kısa deneme (12 Ekim 2026, `npm run load:smoke`)

10 VU (7 öğrenci, 1 ziyaretçi, 1 öğretmen, 1 yönetici), 30 sn ısınma + 2 dk + 30 sn iniş, düşünme 5 sn. Makinenin ortalama doluluğu (bütün işler) %58.

| tür | istek | istek/sn | ortanca | p95 | p99 |
| --- | ---: | ---: | ---: | ---: | ---: |
| API (hepsi) | 673 | 3,2 | 39 ms | 140 ms | 185 ms |
| page | 14 | 0,1 | 80 ms | 196 ms | 205 ms |
| rsc | 186 | 0,9 | 39 ms | 99 ms | 161 ms |
| prefetch | 318 | 1,5 | 64 ms | 156 ms | 180 ms |
| action | 155 | 0,7 | 19 ms | 47 ms | 69 ms |
| tree | 196 | 0,9 | 15 ms | 38 ms | 51 ms |
| static | 239 | 1,1 | 14 ms | 66 ms | 83 ms |

Toplam 1195 istek (5,6/sn), hata oranı %0, kontroller %100; bütün eşikler geçti. 9 senaryo labı bitti (3'ü hacklenerek), 5 eğitim labı oynandı. En yavaş yollar: belge isteği `/` (p95 196 ms), Sınıflarım ve Özet belgeleri (~190 ms), ön yüklemeler (~150-170 ms).

Kaynak kullanımı (docker stats, 5 sn'de bir): uygulama ortalama bir çekirdeğin %7'si (en çok %44), 159 MiB; veritabanı %1,5 (en çok %8), 66 MiB; k6 %1,5. İstek başına ortalama ~13 ms uygulama CPU'su. Kabaca doğrusal büyürse 100 VU'da ~56 istek/sn ve uygulama ortalama ~0,75 çekirdek (sınır 2), veritabanı ~0,15 çekirdek (sınır 1,5) bekleniyor; bunu tam koşu doğrulayacak.

### İstek başına maliyet (`cost.ts`, yük yokken, 20 tekrar)

| istek | boyut | uygulama CPU | veritabanı CPU |
| --- | ---: | ---: | ---: |
| belge `/` (öğrenci) | 232 KB | 85 ms | 18 ms |
| geçiş `/` (öğrenci) | 93 KB | 48 ms | 12 ms |
| belge `/` (ziyaretçi) | 277 KB | 43 ms | 2 ms |
| belge `/lab/[lab]/oyna` | 151 KB | 53 ms | 6 ms |
| geçiş: yol haritası, mahalle, lab kapağı, oynatıcı, gündem, haber, Sınıflarım, sınıf, Özet | 20-55 KB | 26-39 ms | 6-12 ms |
| ön yükleme (oturumlu kabuk) | 3-24 KB | 12-36 ms | 0-8 ms |
| geçiş `/sss` | 37 KB | 15 ms | 0 ms |

Öğrencinin ana sayfası en pahalı istektir: her çizimde bütün yayındaki labların içeriği (sürüm JSON'u) okunup doğrulanır ve labların genel sayıları (bitiren öğrenci, son 30 gün, güvende kalma oranı) bütün `LabAttempt` satırları üzerinden gruplanır. Bugünkü veriyle hızlı; ama `groupBy(["labId", "userId"])` sorguları (`lib/lab/data.ts`, `getCompletionCounts`, `getLabStats`) her (lab, öğrenci) çifti için bir satır döndürür, yani öğrenci sayısıyla büyür. Öneri (henüz yapılmadı): bu sayıları `COUNT(DISTINCT "userId")` ile veritabanında saymak ya da istekler arası kısa süreli önbelleğe (`"use cache"` + `cacheLife`, yayında ve deneme bitince geçersiz) almak.

### Okul-IP denemesi

Aynı IP'den, ders başında 4 dk içinde gelen öğrenciler (`school-ip.js`):

| deneme | kayıt | doğrulama | sınıfa katılma | giriş |
| --- | --- | --- | --- | --- |
| 1 sınıf × 35 | 35 / 35 | 35 / 35 | 35 / 35 | 35 / 35 |
| 2 sınıf × 35 (aynı saatte) | 60 / 70 (10'u sınıra takıldı) | 60 / 60 | 60 / 60 | 60 / 60 |

Bir sınıf rahatça geçiyor. İki sınıf aynı saatte kayıt olursa 61. kayıttan sonrası bir saat boyunca reddediliyor: `signUpIp` IP başına saatte 60 kayıt (`lib/rate-limit.ts`). Sırada bağlayabilecek diğer sınırlar: kod maili `codeSendIp` saatte 120 (kayıt ve "yeniden gönder" birlikte), giriş `signInIp` 10 dakikada 100 (üç sınıf ders başında aynı anda girerse 105). Okul ağları ve mobil operatörlerin ortak IP'leri (CGNAT) aynı durumu yaşar. 12 Ekim'de IP sınırları gevşetildi (sabah soruları 19): kayıt saatte 200, kod maili saatte 300, kod denemesi ve giriş 10 dakikada 300; e-posta başına sınırlar aynı kaldı. Yukarıdaki tablo eski sınırlarla ölçüldü; deneme yeni sınırlarla yeniden koşulmadı, üç sınıfın (105 öğrenci) sınırlara takılmadığını `tests/unit/rate-limit.test.ts` sayıyor.

### Telefonda ilk açılış (`phone.ts`, 5 soğuk açılış, ortanca)

Orta seviye telefon: CPU 4 kat yavaş, Slow 4G (150 ms, 1,6 Mbps / 750 Kbps), 390 px, öğrenci giriş yapmış.

| sayfa | FCP | LCP | load | etkileşime hazır | aktarım (JS) | istek |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lab kapağı `/lab/[lab]` | 0,60 sn | 0,95 sn | 2,36 sn | 2,34 sn | 528 KB (332 KB) | 41 |
| oynatıcı `/lab/[lab]/oyna` | 0,54 sn | 1,92 sn | 2,54 sn | 2,63 sn | 434 KB (270 KB) | 25 |

Hedef (3 sn) tutuyor. Karamsar profilde (Lighthouse'un Slow 4G'si: 562,5 ms, 1,44 Mbps, 3 açılış) lab kapağı LCP 1,74 sn / etkileşime hazır 3,22 sn, oynatıcı LCP 3,02 sn / etkileşime hazır 4,78 sn.

Nedenler: oynatıcının LCP öğesi başlangıç penceresinin başlığıdır (`h2`, Space Grotesk). Pencere HTML'de 0,54 sn'de gelir ve yedek yazı tipiyle hemen görünür; LCP web yazı tipi inince (~1,9 sn) yeniden ölçülür. Yazı tipleri CSS okununca keşfedilir ve ~300 KB JS ile aynı dar bant genişliğini paylaşır. "Etkileşime hazır"ı belirleyen JS'nin inmesi ve hidrasyondur (~200 ms'lik uzun görev). Öneriler (henüz yapılmadı, küçük değil): yazı tiplerini `next/font/local` ile yüklemek (önceden yükleme ve yedek yazı tipi ölçüleri kendiliğinden gelir), en büyük JS parçalarını incelemek.
