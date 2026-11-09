# Güvenlik turu 5 — Faz 6

- **Tarih:** 12 Ekim 2026
- **Kapsam:** Faz 6'nın bütün değişiklikleri (`bcfd8cb..phase-6`, 124 dosya), dört dilim:
  1. **CSP ve başlıklar:**
     - İçerik Güvenliği Politikası: tur 1 D2, tur 2 O2'nin tarayıcı tarafı (`media-src`), tur 3 ve tur 4'ün Faz 6 önerileri.
     - Diğer güvenlik başlıkları (`next.config.ts`) ve HSTS'nin `includeSubDomains` kararı (`docker/server/nginx-site.conf`).
     - Cloudflare arkasında ziyaretçinin gerçek IP'si ve başlık sahteciliği (tur 1 D4; `nginx-site.conf`, `lib/request.ts`).
  2. **Yedek, geri yükleme, yayın ve izleme:**
     - Yedek ve geri yükleme: `docker/server/backup.sh`, `backup-lib.sh`, `restore-test.sh`, `install-backup-timer.sh`, `cyberguard-backup.service` ve `.timer`.
     - `deploy.sh`'nin yayın öncesi yedeği ve düşen migration'dan geri dönüşü.
     - İş akışları: `deploy.yml`, `ci.yml`, `uptime.yml`.
     - Yayın testleri: `tests/deploy/`.
  3. **Lab yönetiminin sağlamlığı** (tur 2 D8, D9, D10, B1):
     - `lib/admin/lab-actions.ts`, `lab-data.ts`, `validate.ts`;
     - `lib/lab/actions.ts`, `training.ts`;
     - üç migration;
     - `tests/e2e/lab-robustness.spec.ts`.
  4. **Telefon düzeni ve yük testi:** `ScrollStrip` ve küçük stil değişiklikleri, `tests/load/`.
- **Nasıl yapıldı:**
  - **Kod incelemesi, saldırgan gözüyle.** Bakılanlar:
    - kabuk enjeksiyonu ve tırnaklama;
    - dosya adları ve bağlantılar (symlink);
    - izinler ve servisin hangi kullanıcıyla çalıştığı;
    - sırların komut satırına, kayıtlara ve Actions çıktısına sızması;
    - iş akışı girdileri ve `run:` içindeki `${{ }}`;
    - yetki denetimleri ve yarış durumları;
    - yük testinin imaja girip girmediği.
  - **Yerel deneme.** Yerel **üretim derlemesine** (port 3201 ve 3206) ve yerel PostgreSQL'e karşı. `next dev` ile geliştirme kipi de denendi.
  - **CSP seçenekleri gerçekten denendi.** Aynı derlemeye Playwright ile farklı politikalar verildi (zorlayan ve yalnızca raporlayan, `Content-Security-Policy-Report-Only`). Site gezilirken tarayıcının engellediği her şey yönerge yönerge toplandı (`securitypolicyviolation` olayı ve konsoldaki CSP reddi). Deneysel `sri` için ayrı bir derleme yapıldı.
  - **nginx.** Ayar yerel bir nginx'te (1.24) denendi: `nginx -t`, Cloudflare dışından ve Cloudflare'den geliyormuş gibi istekler, HSTS başlığı. Cloudflare IP aralıkları Cloudflare'in yayımladığı listeden okundu (https://www.cloudflare.com/ips-v4, ips-v6).
  - **Sunucu betikleri yerelde, sunucudaki düzenin bir kopyasında çalıştırıldı** (`docker-compose.yml` + `docker/server/compose.yml`, ayrı proje adı). Denenenler:
    - yedek ve geri yükleme denemesi;
    - düşen ve yarım kalan migration'larla yayın;
    - README'deki elle geri yükleme.

    Bulunan her hata önce eski kodda gösterildi, sonra düzeltildi.
  - **Yarış durumları.** Aynı eyleme aynı anda 40-60 istek gönderildi (Node `fetch`).
  - Canlı siteye ve sunucuya **hiçbir** istek yapılmadı; SSH yok.
- **Son durum:**
  - **Birim testleri:** 760 testin hepsi geçti. Bu turun son dilimlerinde 34 test yeni: `migrations.test.ts`, `load-safety.test.ts`, `load-stack.test.ts`.
  - **e2e, CSP dilimi:**
    - Yeni `csp.spec.ts` 8/8 (masaüstü ve telefon).
    - Var olan e2e testlerinin hepsi (bütün dosyalar, masaüstü ve telefon) CSP'li derlemeye karşı koşuldu: 323 geçti, 12 atlandı (yalnızca masaüstünde koşan testler).
    - Makinenin yükü en yüksekken (yük ortalaması 17, 4 çekirdek) üç uzun test zaman aşımına uğradı; tek başına koşulunca üçü de geçti.
  - **e2e, diğer dilimler:**
    - `lab-robustness.spec.ts` 16/16 (masaüstü ve telefon).
    - Eğitim labına dokunan `lab.spec.ts`, `lab-security.spec.ts` ve `labs-student.spec.ts` 11/11 (masaüstü).
    - Yeni yarış testi (D27) eski kodda üç koşunun üçünde de düştü.
  - **Yayın testleri:**
    - `tests/deploy/backup-retention.sh` geçiyor; eski kodda 6 beklenti tutmuyordu.
    - CI'nın yeni "Yarım kalan migration'dan sonraki yayın" adımı yerelde aynı komutlarla koşuldu: yeni kodda geçti, eski kodda düştü.
    - `shellcheck` temiz.
  - **Diğer denetimler:**
    - Lint, tür denetimi ve derleme temiz.
    - Derlemenin rota tablosu CSP'den önceki ile aynı: 41 sayfanın hepsi yine Partial Prerender (◐).
    - `npm audit --omit=dev`: tur 1 D1 ile aynı 4 yüksek uyarı (B14), yeni uyarı yok.
    - Yeni `eslint-disable` satırı yok.
- **Sonuç:**
  - CSP eklendi ve bütün sayfalarda çalışıyor.
  - Düzeltilen bulgular:
    - iki **orta, koşullu** bulgu: O1 (gerçek IP) ve D25 (yarım kalan migration);
    - beş **düşük** bulgu: D23, D24, D26, D27, D28.
  - Kapanan eski bulgular: tur 1 D2, tur 2 O2'nin tarayıcı tarafı ve tur 2 D8, D9, D10, B1.
  - Tur 1 D4'ün kod tarafı düzeltildi; canlı doğrulaması aşağıdaki listede.
- **Şema:** Bu turun düzeltmeleri şema değiştirmedi, migration eklenmedi. Faz 6'nın kendi üç migration'ı 3. dilimde incelendi.

---

## Seçilen CSP

Üretimdeki başlık (tek satır; burada okunsun diye bölündü):

```
default-src 'self';
script-src 'self' 'unsafe-inline';
script-src-attr 'none';
style-src 'self' 'unsafe-inline';
style-src-elem 'self';
img-src 'self';
font-src 'self';
connect-src 'self';
media-src 'self';
object-src 'none';
frame-src 'self';
worker-src 'none';
base-uri 'none';
form-action 'self';
frame-ancestors 'none'
```

- **Geliştirmede (`next dev`) yalnızca iki ek:** `script-src`'ye `'unsafe-eval'` (React geliştirmede sunucu hatalarının yığınını tarayıcıda `eval` ile kurar) ve `style-src-elem`'e `'unsafe-inline'` (Next'in hata penceresi gölge DOM'da 17 `<style>` kullanır). Geliştirmede 7 sayfada ihlal yok, HMR web soketi `connect-src 'self'` ile çalışıyor.
- **Öğretmenlik belgesi** (`/yonetim/talepler/<talep>/belge`) kendi, daha sıkı politikasıyla gelir: `sandbox; default-src 'none'; img-src 'self' data:; object-src 'self'; frame-ancestors 'self'` (aşağıda D24).
- Her yönergenin gerekçesi `next.config.ts`'te yazılı. `tests/e2e/csp.spec.ts` politikayı yönerge yönerge birebir bekler: bir yönerge gevşetilir ya da eklenirse test düşer.
- Başlık yaklaşık 370 bayt; her yanıta eklenir (HTML, 404, API, React verisi, yönlendirmeler).

### Denenen ve elenen seçenekler

| Seçenek | Sonuç | Neden elendi |
| --- | --- | --- |
| Nonce (`'nonce-…' 'strict-dynamic'`, `proxy.ts`'te) | Denenmedi; Next'in rehberi ve kodu açık | Nonce her istekte yeni olmalı; Next onu yalnızca istek başına çizilen sayfaya koyar. Bütün sayfalar dinamikleşir ve Partial Prerendering (statik kabuk) kapanır. Next rehberi: "PPR is incompatible with nonce-based CSP". Faz 6'da 100 kişilik yük testi var. |
| Deneysel `sri` + `script-src 'self'` | **Denendi, sayfa canlanmadı.** Ziyaretçi sayfalarında 420 satır içi betik engellendi; çerez bandı bile çıkmadı, test zaman aşımına uğradı. | `sri` yalnızca dış betik dosyalarına `integrity` ekler (Turbopack'te 14 betiğin 6'sında yoktu). Next'in satır içi akış betikleri (`self.__next_f.push`, Suspense parçaları) ve tema betiği satır içidir; `'self'` onları kapsamaz. `'unsafe-inline'` zaten gerekince `sri`'nin CSP'ye katkısı kalmaz (aynı kökten betik zaten izinli); bu yüzden `sri` açılmadı. |
| Satır içi betikleri hash'le listelemek | Ölçüldü: 17 ziyaretçi sayfasında 58 farklı satır içi betik | Akış betikleri sayfanın verisini taşır; istekle ve derlemeyle değişir. Statik bir başlığa yazılamaz. |
| `style-src 'self'` (özniteliksiz) | Raporlayan politikayla ölçüldü: her sayfada `style=""` öznitelikleri engellenirdi (arka plandaki iplikler, rozet boyu, `next/image`) | React sunucuda `style` özelliğini öznitelik olarak yazar. Öznitelikler için `'unsafe-inline'` kaldı; `<style>` öğeleri ise `style-src-elem 'self'` ile kapalı (üretimde hiç yok). |
| `img-src 'self' data:` | Gerek yok: `img-src 'self'` ile ihlal çıkmadı | Rozetler `public/badges/*.svg`, belge önizlemesi aynı kökten, QR kodu satır içi `<svg>`. |
| `require-trusted-types-for 'script'` | Raporlayan politikayla ölçüldü: Next'in betik yükleyicisi (`HTMLScriptElement.src`) ve `Function` çağrıları ihlal yazdı | Next Trusted Types'ı desteklemiyor. |
| `upgrade-insecure-requests` | Denendi; yerel `http://localhost`'u bozmadı (Chrome yerel adresi yükseltmez) | Üretimde katkısı yok: bütün kaynaklar göreli adresle aynı kökten gelir, HTTPS'i Cloudflare ve HSTS zorlar. Yerel ağdaki bir `http://192.168…` denemesini bozabileceği için eklenmedi. |

### Bu politika neyi kapatır, neyi kapatmaz

- **Kapatır:** dış adresten betik, stil, görsel, yazı tipi, medya, çerçeve ve `fetch`/web soketi; başka siteye form gönderme; `<base>` ile göreli adresleri kaçırma; eklentiler (`<object>`); sitenin başka sitede çerçeveye alınması (tıklama kaçırma); HTML'e sızan olay öznitelikleri (`<img onerror=…>`, `script-src-attr 'none'`); `eval`.
- **Kapatmaz:** sunucunun ürettiği HTML'e sızan bir `<script>…</script>` çalışır (`'unsafe-inline'`). Bunu engelleyen asıl koruma React'in kaçışlamasıdır (tur 4: `dangerouslySetInnerHTML` yalnızca tema betiğinde ve SSS'nin JSON-LD'sinde, ikisi de sabit ya da kaçışlanmış). Böyle bir betik veriyi `fetch` ya da görselle dışarı gönderemez, ama sayfayı başka adrese yönlendirerek (`location = …`) gönderebilir; CSP gezinmeyi sınırlamaz.

---

## Doğrulanan korumalar (çalışıyor)

### CSP, başlıklar ve gerçek IP

| Alan | Durum | Kanıt |
| --- | --- | --- |
| CSP her yanıtta | HTML (statik kabuk ve dinamik sayfa), 404, `/api/health`, React verisi (RSC) ve yönlendirmeler aynı politikayla gelir (Next'in sondaki `/` için kendi 308'i hariç, B7). Yalnızca raporlayan başlık yok. | `curl`; **yeni e2e:** `csp.spec.ts` her `visit`'te başlığı yönerge yönerge denetler; `security.spec.ts` |
| Sayfalar statik kaldı | Rota tablosu CSP'den önce ve sonra aynı: 41 sayfanın hepsi Partial Prerender (◐), yalnızca `/api/health` ve belge adresi dinamik (ƒ). `x-nextjs-prerender: 1` geliyor. | `next build` çıktılarının karşılaştırması |
| Bütün site ihlalsiz | Ziyaretçi sayfaları (16 sayfa ve 404), çerez bandı, tema düğmesi ve tema betiği, istemci tarafı gezinme; öğrenci: kayıt ve doğrulama, ana sayfa, profil (rozet SVG'leri, avatarlar), eğitim labının bütün kartları, Postam'da hacklenme, hacklendin alarmı ve açıklaması, rapor, sınıfa katılma; öğretmen ve okul sorumlusu: Sınıflarım, yeni sınıf, tahtaya yansıt (QR), sınıf detayı, Okulum, "PDF olarak indir" (yazdırma görünümü), "Müdüre gönder" (mailto); yönetim: 10 panel sayfası, lab düzenleme, önizleme (Postam'da rapora kadar, eğitim, Mesajlar'da bildir ve engelle), talep belgesi (görsel ve PDF çerçevesi), haber sayfası. Masaüstünde ve 390 px telefonda tarayıcı hiçbir şeyi engellemedi. | **Yeni e2e:** `csp.spec.ts` (bütün çerçevelerde `securitypolicyviolation` ve konsoldaki CSP reddi toplanır; biri bile çıkarsa test düşer) |
| Var olan özellikler | Lab oynatıcısı, yönetim, öğretmen, okul, hesap, profil, gündem, ipucu ve bilgi sayfalarının bütün e2e testleri CSP'li derlemede geçiyor. | Yukarıda "Son durum" |
| Belgenin sandbox CSP'si | Belge kendi politikasıyla gelir (sayfaların politikası onun yerine geçmez); PDF çerçevede açılır (`chrome-error://` yok), görsel yüklenir. | `csp.spec.ts` ve `admin-applications.spec.ts` |
| Tıklama kaçırma | `frame-ancestors 'none'` ve `X-Frame-Options: DENY` birlikte. | `security.spec.ts` |
| Zod tarayıcıda eval denemez | `lib/zod.ts` tarayıcıda `jitless` açar; kod Zod'u yalnızca oradan alır (ESLint). | **Yeni birim testi:** `tests/unit/zod.test.ts` (düzeltme kaldırılınca iki testi de düşüyor) |
| Pencere ayrımı | `Cross-Origin-Opener-Policy: same-origin`: siteyi açan başka bir pencere ona `window.opener` ile erişemez. Dış bağlantılar zaten `noopener` ile açılır; yazdırma ve mailto etkilenmez. | `security.spec.ts`; bütün e2e |
| Gerçek IP ve sahte başlık | Cloudflare aralığından gelen bağlantıda ziyaretçinin adresi `CF-Connecting-IP`'den alınır (IPv4 ve IPv6). Başka yerden gelen bağlantıda `CF-Connecting-IP`, `X-Forwarded-For`, `X-Real-IP` ve `Forwarded` yok sayılır; uygulama bağlantının kendi adresini görür. | Yerel nginx denemesi (aşağıda O1) |
| HSTS | `max-age=31536000; includeSubDomains`, `preload` yok. HTTP isteği HTTPS'e yönlenir. | Yerel nginx denemesi; canlıda `security.spec.ts` değeri birebir bekler |

### Yedek, geri yükleme ve yayın

| Alan | Durum | Kanıt |
| --- | --- | --- |
| Yedek dosyalarına yalnızca yayın kullanıcısı erişir | Yedekler yazılırken `umask 077` geçerli; klasör `700`. Yarım dosya gizli `.partial` adıyla yazılır, doğrulanınca asıl adına taşınır. Aynı anda tek yedek: kilit klasörün kendisinde (`flock`). Diskte 1 GB'tan az yer kalacaksa yedek alınmaz. | İnceleme; CI'nın yedek adımı |
| Şifre komut satırında yok | `pg_dump` ve `psql` konteynerin içinde yerel soketle çalışır. `POSTGRES_*` değişkenleri konteynerin içinde açılır (`sh -c '…' sh "$1"`); sorgu konumsal argüman olarak geçer. Yedeğin doğrulaması ağsız, yetkileri düşürülmüş geçici bir konteynerde yapılır. | İnceleme; `shellcheck` |
| Yalnızca bizim yığınımız | Konteyner compose etiketleriyle bulunur (proje `cyberguard`, servis `db`); ad tahmini yok. Zamanlayıcı yalnızca `cyberguard-backup.*` birimlerine dokunur. Servis yayın kullanıcısıyla çalışır (`User=`, yayın klasörünün sahibi). Chess paneline, CTFd'ye ya da başka bir yığına dokunan komut yok. | İnceleme |
| Geri yükleme denemesi canlıya dokunmaz | compose çağırmaz. Geçici konteyner ağsız (`--network none`) ve birimsizdir (tmpfs); kök dosya sistemi salt okunur, kullanıcısı ayrıcalıksız. Yedek ona stdin'den verilir. Çıkışta yalnızca kendi etiketini taşıyan konteyner silinir (bu turda sıkılaştırıldı, B11). | Yerelde koşuldu ("GERİ YÜKLEME BAŞARILI"); CI |
| Yayın öncesi yedek alınamazsa yayın olmaz | Yeni sürüm başlamaz; `.env` ve çalışan sürüm değişmez. | CI |
| Düşen migration'dan geri dönüş | Migration düşer ve şema yayından önceki haliyle aynıysa: yalnızca `_prisma_migrations`'taki satır "geri alındı" diye işaretlenir, önceki sürüm döner. Şema farklıysa ya da karşılaştırılamazsa hiçbir şey işaretlenmez. Bu turdan sonra: önceki bir yayından kalan başarısız migration varsa yayın hiç başlamaz (D25). | CI: `tests/deploy/failing-migration`, `tests/deploy/partial-migration` |
| Migration dosyaları tek işlemde çalışır | Migration dosyalarında işlemi bölen komut yok (`COMMIT`, `BEGIN`, `CONCURRENTLY`, `VACUUM` …). Geri dönüşün güvenli olması buna dayanır. | **Yeni birim testi:** `migrations.test.ts` |
| İş akışlarının girdileri | `deploy.yml`'nin yeni adımları (`backup`, `restore-test`) sabit komutlar çalıştırır. `inputs.operation` seçenek listesinden gelir ve yalnızca `if:` koşullarında kullanılır. | İnceleme |
| İzleme iş akışı | `uptime.yml` yalnızca `issues: write` yetkisiyle çalışır. Sağlık yanıtının kendisi konuya yazılmaz; yazılan ayrıntı yalnızca durum kodu, `[a-z]` durum alanları ya da curl'ün hata cümlesidir. Ayrıntı `env` ile geçer; `run:` içinde `${{ }}` ile metin açılmaz. Çıktı (`$GITHUB_OUTPUT`) tek satırdır. | İnceleme |

### Lab yönetimi (tur 2 D8, D9, D10, B1)

| Alan | Durum | Kanıt |
| --- | --- | --- |
| Yetki her eylemde | Yeni ve değişen lab eylemlerinin hepsi izni kendisi yeniden sorar (`writer()` → `getLabAccess()`; düzenleme ve yayınlama ayrı izinler). Sonra kişi başına istek sınırı uygulanır. | İnceleme; `lab-robustness.spec.ts` |
| D8: okunamayan taslak | Taslak uyarıyla açılır; kaydetme ve yayınlama onun üstüne yazmaz. | `lab-robustness.spec.ts` |
| D9: aynı anda kaydetme | Taslak `draftRevision` koşuluyla tek yazımda kaydedilir (`updateMany … where draftRevision`), koşul atomiktir. Listedeki "Yayınla" sürümü gönderir. | e2e (eşzamanlı istekler) |
| D10: mahallede tek eğitim labı | Kısmi tekil indeks var. Migration'daki `LOCK TABLE "Lab" IN SHARE MODE` yalnızca yazmaları bekletir, o da migration bitene kadar. Yayında uygulama migration'dan önce durdurulur. Gece yedeğinin `pg_dump`'ı (ACCESS SHARE) bu kilitle çakışmaz. Prisma indeksi görmezden gelir: `prisma migrate diff` boş, yani sonraki migration'lar indeksi silmez. | e2e; `migrate diff` |
| B1: eğitim bitişi sunucuda | Sunucu, eğitimin bitmesi için yayındaki sürümün bütün sorularının cevaplandığını denetler. Cevap yalnızca o sürümün soru kartı için kaydedilir: bilgi kartı, başka labın kartı ve olmayan kart `invalid` döner. Şık sınırı da denetlenir. Kaldığı kart `0..kart sayısı` arasına sıkıştırılır. | `lab-robustness.spec.ts` (D27'nin testi dahil) |
| Doğru cevaplar tarayıcıya gitmez | `lib/lab/client.ts` değişmedi. Sorunun doğrusu ve açıklaması yalnızca cevaptan sonra, sunucu eyleminden döner. | İnceleme |

### Yük testi, telefon düzeni ve başlıklar

| Alan | Durum | Kanıt |
| --- | --- | --- |
| Yük testi imaja girmez | `.dockerignore` `tests` ve `docker/server` klasörlerini dışarıda bırakır. Uygulama kodu `tests/load`'u içe aktarmaz. | İnceleme |
| Yük yığını ayrı | Ayrı proje (`cg-load`). Veritabanı ve kod sunucusu yalnızca 127.0.0.1'de açılır. `.env` rastgele şifrelerle ve `0600` izniyle yazılır. Bu turdan sonra proje adı `cyberguard` olamaz (D28). | İnceleme; `load-stack.test.ts` |
| Depoda sır ya da gerçek kişisel veri yok | Değişikliklerdeki e-posta adresleri kurgusal: `load.cyberguard.invalid`, testlerdeki `okul.k12.tr` adresleri ve `example.com`. IP'ler belgeleme aralıklarından (RFC 5737) ve Cloudflare'in listesinden. Anahtar ya da şifre yok; sabit yük şifresi D28 ile kaldırıldı. | `git diff` taraması |
| Telefon düzeni | Değişiklikler yalnızca CSS ve düzen (`ScrollStrip`). `dangerouslySetInnerHTML` ya da yeni dış bağlantı yok. | İnceleme |
| Başlıklar her yolda | Şu yollarda CSP, `nosniff`, `X-Frame-Options` ve COOP var: `/`, `/api/health`, 404, `proxy.ts` yönlendirmesi, statik dosyalar, RSC isteği, sunucu eylemi (400), HEAD, OPTIONS (405). Belge adresinin çeşitleri (`%62elge`, `belge;x`) belge rotasına ulaşmıyor (404 sayfası döner); yani belgeye sayfaların CSP'siyle ulaşılamıyor. Tek istisna Next'in kendi 308 yönlendirmesi (B7). | `curl` (yerel derleme) |

---

## Bulgular

### O1 — Gerçek IP başka bir sitenin ayar parçasına bağlıydı; parça yoksa bütün IP sınırları Cloudflare adreslerinde toplanıyordu (orta, koşullu) — düzeltildi

`install-nginx.sh`, sunucuda `/etc/nginx/snippets/chess-cloudflare-realip.conf` (chess panelinin parçası) **varsa** onu bizim girişimize dahil ediyordu; yoksa hiçbir gerçek IP ayarı olmuyordu. Parçanın içeriği depoda değil, bizim denetimimizde de değil.

- **Uygulama ne görüyordu:** nginx `X-Forwarded-For`'u `$remote_addr` ile yazar (istemcinin gönderdiğini ezer); uygulama ilk değeri okur (`lib/request.ts`, Better Auth `ipAddressHeaders`). Yani uygulama her zaman `$remote_addr`'ı görür. `$remote_addr`:
  - parça varsa ve Cloudflare aralıklarına güvenip `CF-Connecting-IP`'yi okuyorsa: ziyaretçinin adresi (doğru),
  - parça yoksa: **Cloudflare'in uç sunucusunun adresi**,
  - parça yanlışsa (ör. `set_real_ip_from 0.0.0.0/0`): Cloudflare'i atlayıp sunucunun IP'sine doğrudan gelen biri adresi **sahteleyebilir**.
- **Etki (parça yoksa):** kayıt (saatte 60), giriş (10 dakikada 100), kod ve sınıfa katılma IP sınırları, aynı Cloudflare uç adresinden gelen herkesi tek kişi sayar. Bir saldırgan bu sınırları doldurarak aynı bölgedeki gerçek kullanıcıları kayıt ve girişten kilitleyebilir. Gündemin okuma sayısı (tur 4 O1) eksik sayılır, oturumlara Cloudflare adresi yazılır. Hangisinin canlıda olduğu buradan bilinemedi (sunucuya bakılmadı); bu yüzden "koşullu".
- **Sahtecilik (bugünkü hali):** parça Cloudflare aralıklarıyla sınırlıysa sahtecilik yok. `X-Forwarded-For` ve `X-Real-IP` nginx'te her durumda ezildiği için istemcinin gönderdiği değer uygulamaya ulaşmaz.
- **Düzeltme:**
  - Cloudflare'in 15 IPv4 ve 7 IPv6 aralığı `nginx-site.conf`'un kendisinde, tarihli bir yorumla (`set_real_ip_from`, `real_ip_header CF-Connecting-IP`). Başka sitenin dosyasına bağlılık kalmadı; `install-nginx.sh` o dosyaya bakmıyor.
  - Uygulamaya giden `X-Forwarded-For`, `X-Real-IP` ve `CF-Connecting-IP` doğrulanmış adresle yazılır, `Forwarded` hiç geçmez (uygulama ileride başka başlık okursa da doğrulanmış adresi görsün).
  - Liste eskirse (Cloudflare yeni aralık eklerse) site çalışmaya devam eder; yalnızca o aralıktan gelen ziyaretçi Cloudflare'in adresiyle sayılır.
  - `inspect.sh` sunucudaki gerçek IP ve HSTS ayarlarını (yalnızca bu yönergeler, dosya dosya) yazar: başka bir sitenin `http` düzeyinde aynı ayarı yapıp yapmadığı da görülür.
- **Deneme (yerel nginx 1.24, depodaki dosyanın kurulum betiğinin üreteceği hali):**
  - `nginx -t` geçti.
  - Cloudflare dışından gelen istek `CF-Connecting-IP: 1.2.3.4`, `X-Forwarded-For: 6.6.6.6, 7.7.7.7`, `X-Real-IP: 8.8.8.8`, `Forwarded: for=9.9.9.9` gönderdi: uygulama `127.0.0.1` (bağlantının kendi adresi) gördü.
  - Cloudflare'den geliyormuş gibi (127.0.0.1'e de güvenen kopya): `CF-Connecting-IP: 203.0.113.9` → uygulama `203.0.113.9`; `2001:db8:a:b::42` → `2001:db8:a:b::42` gördü (uygulama IPv6'yı /64'e indirir). Erişim kaydına da ziyaretçinin adresi yazıldı.
- **Canlı doğrulama:** aşağıdaki "Yük testinde bakılacaklar" listesi.

### D23 — Zod 4 tarayıcıda `new Function` deniyordu; CSP ile her yönetim sayfası ihlal yazıyordu (düşük) — düzeltildi

Zod 4, nesne şeması kurulurken hızlı yolu açmak için `Function("")` dener. CSP `'unsafe-eval'` vermediği için tarayıcı bunu engeller; Zod yavaş yola düşer, çalışır, ama her seferinde bir CSP ihlali yazar.

- **Etki:** Güvenlik açığı değil. Ama Zod şemalarını tarayıcıya taşıyan bütün yönetim sayfalarında (talepler, lab düzenleme ve önizleme, gündem, yeni lab) konsolda CSP hatası çıkıyordu. Bu hatayı susturmanın kolay yolu `'unsafe-eval'` eklemek olurdu; bu, politikayı ciddi biçimde zayıflatırdı.
- **Kanıt:** Politika zorlanarak verilince e2e'nin yönetim testi 10 sayfada `script-src eval` ihlaliyle düştü (`/_next/static/chunks/…js`, Zod'un `allowsEval` denetimi).
- **Düzeltme:** `lib/zod.ts`: tarayıcıda `z.config({ jitless: true })`, sonra Zod'un bütün dışa aktarımları. Projedeki 12 dosya Zod'u artık buradan alır; ESLint `no-restricted-imports` doğrudan `"zod"` ya da `"zod/*"` almayı yasaklar. Sunucuda CSP olmadığı için hızlı yol açık kalır.
- **Regresyon testi:** `tests/unit/zod.test.ts` (tarayıcıda `jitless` açık; şema kurulup çalışırken `Function` çağrılmaz); `tests/e2e/csp.spec.ts` (yönetim testi).

### D24 — Genel başlıklar rota başlığının yerine geçer: CSP eklenince belgenin sandbox CSP'si silinecekti (düşük) — önlendi

Next, `next.config.ts`'teki başlığı önce yazar; rota (route handler) aynı adlı başlığı döndürürse onu **eklemez** (`next/dist/server/send-response.js`). Belge adresi kendi CSP'sini döndürüyordu (`sandbox; default-src 'none'; …; frame-ancestors 'self'`).

- **Etki (önlenmeseydi):** Genel CSP her adrese eklendiği anda belgenin politikası sayfalarınkiyle değişirdi: `sandbox` giderdi (tur 3'teki çok biçimli dosya korumasının tarayıcı tarafı) ve `frame-ancestors 'none'` yüzünden PDF önizlemesi açılmazdı.
- **Önlem:** `next.config.ts`'te belge adresi için ikinci bir başlık kuralı, belgenin politikasını (`documentContentSecurityPolicy`, tek yerden) yeniden verir; aynı yolu tutan iki kuraldan sonraki geçerlidir. Rotadaki başlık da yerinde kaldı.
- **Regresyon testi:** `csp.spec.ts` belge yanıtının politikasını yönerge yönerge bekler ve PDF çerçevesinin açıldığını denetler; `admin-applications.spec.ts` da aynı başlıkları bekler.

### D25 — Yarım kalan migration, elle düzeltilmeden gelen sonraki yayında "geri alındı" diye işaretleniyordu (orta, koşullu) — düzeltildi

Faz 6'nın geri dönüşü bir varsayıma dayanır: migration düşerse PostgreSQL dosyanın bütün değişikliklerini geri alır. `deploy.sh` bunu şemanın yayından önceki ve sonraki parmak iziyle denetler; ikisi aynıysa satırı "geri alındı" diye işaretler. Kendi içinde `COMMIT` olan bir migration yarım kalırsa parmak izi tutmaz. Betik o zaman doğru davranır: durur, siteyi kapalı bırakır ve elle geri yüklemeyi söyler.

- **Açık:** Biri elle geri yükleme yapmadan yeni bir yayın başlatabilir (ör. migration'ı düzelten commit `main`'e girer, iş akışı kendiliğinden yayınlar). O zaman şu olur:
  1. Yeni yayının "önceki hali" artık yarım şemadır.
  2. Prisma, kalan başarısız satır yüzünden (P3009) hiçbir migration çalıştırmadan düşer.
  3. Parmak izi bu kez **tutar**. Betik önceki yayının yarım migration'ını "geri alındı" diye işaretler ve önceki sürümü yarım şemayla açar.
  4. Bir sonraki yayında Prisma o migration'ı yarım şemanın üstüne yeniden çalıştırır. `COMMIT`'ten önceki veri değişiklikleri (UPDATE, DELETE) ikinci kez uygulanır ya da migration yine düşer ve döngü sürer.
- **Etki:** Veri bozulur ve yedekler kirlenir. Her yayın yeni bir "yayın öncesi" yedek alır ve en yeni 3'ü kalır; birkaç denemeden sonra yarım migration'dan önceki temiz yedek saklama kuralıyla silinir. Gece yedekleri de yarım hali tutar.
- **Neden koşullu:** Bugün hiçbir migration'da `COMMIT` yok; bu turda bu, testle de sabitlendi.
- **Kanıt:** Yerel yığında (sunucudaki compose dosyaları, ayrı proje adı) `COMMIT` içeren bir migration'la denendi. İlk yayın doğru olarak durdu. İkinci yayında eski `deploy.sh` "Şema yayından önceki haliyle aynı" yazdı ve yarım migration'ı işaretledi.
- **Düzeltme:**
  - `deploy.sh` yayın öncesi yedekten önce `_prisma_migrations`'ta bitmemiş ve geri alınmamış satır arar. Varsa hiçbir şeye dokunmadan durur: yedek alınmaz, satır işaretlenmez, konteynerler ve sürüm değişmez. Ardından README'deki elle geri dönüşü söyler.
  - "Geri alındı" işareti ancak bu okuma yapılıp temiz çıktıysa konur. Böylece işaretlenen satır yalnızca bu yayının migration'ı olabilir.
  - Çıkış yolu `docker/server/README.md`'ye yazıldı ("Migration başarısız olursa").
- **Regresyon testleri:**
  - CI Docker işi, "Yarım kalan migration'dan sonraki yayın" adımı. Migration olarak `tests/deploy/partial-migration` kullanılır (`COMMIT` içerir, sonra düşer). Adımlar:
    1. Bu migration'la yayın: yayın durur, site kapalı kalır, yayın öncesi yedeğin yolu yazılır.
    2. İkinci yayın: "Önceki bir yayından kalan başarısız migration var" yazar; satır işaretlenmemiştir, yeni yedek alınmamıştır.
    3. README'deki elle geri yükleme: site açılır, yarım migration'ın izi kalmaz.

    Aynı komutlar yerelde eski kodda düştü, yeni kodda geçti.
  - `tests/unit/migrations.test.ts`: migration dosyalarında işlemi bölen komut olmadığını denetler. Yorumlar, dizgiler ve `$$` gövdeleri ayıklanarak bakılır; tespitçinin kendisi de sınanır.

### D26 — Yedek saklama: adında nokta ya da satır sonu olan bir dosya başka bir yedeği sildiriyordu (düşük) — düzeltildi

Saklama kuralı (`backup.sh`) klasördeki dosya adlarını satır satır okuyordu. Uzantıyı da iki kez atıyordu: önce `sed 's/\.[a-z]*$//'`, sonra `${1%.*}`.

- **Açık:**
  - **Adında nokta olan dosya:** `cyberguard-elle-kopya.eski.dump` gibi 7 günden eski bir dosyanın uzantısı iki kez atılınca ad `cyberguard-elle-kopya` olur. Betik bu adın **yeni** yedeğini (`cyberguard-elle-kopya.dump` ve `.counts`) siler, eski dosyayı bırakır. Eski dosya hiç silinmez ve 7 gün sözünün dışında kalır.
  - **Adında satır sonu olan dosya:** iki ad gibi okunur. İkinci satır yeni bir yedeğin adıysa o yedek silinir.
- **Etki:** Klasöre yalnızca bizim betiklerimiz yazar, sabit adlarla; bu adlar ancak sunucuda elle kopyalanmış dosyalarla oluşur. Sonuç yanlış yedeğin silinmesi ya da silinmiş bir kullanıcının verisinin 7 günden uzun kalmasıdır. Düşük.
- **Düzeltme:** Kurallar `backup-lib.sh`'e taşındı (`prune_backups`; `backup.sh` onu çağırır).
  - Adlar NUL ile ayrılır.
  - Yalnızca `.dump` ve `.counts` uzantısı atılır.
  - Bağlantılar (symlink) ve alt klasörler sayılmaz.
  - Az önce alınan yedek hiçbir kuralla silinmez.

  Kurallar README'ye de yazıldı.
- **Regresyon testi:** `tests/deploy/backup-retention.sh`. Docker gerekmez; CI'nın ilk işinde koşar ve `shellcheck`'ten geçer. Denenenler:
  - eski ve yeni yedek, yaşları farklı bir dosya çifti;
  - noktalı ve satır sonlu adlar;
  - en yeni 3 `predeploy` ve `manual` yedeği;
  - korunan yeni yedek;
  - klasör dışını gösteren bağlantılar;
  - başka adlı dosyalar ve alt klasör.

  Eski kodda 6 beklenti tutmuyordu.

### D27 — Eğitim labı: aynı anda gelen cevaplar kartı defalarca yazıyordu (düşük) — düzeltildi

B1'in düzeltmesi (bu fazda) cevaplanan soru kartlarını `TrainingProgress.answeredCards`'ta tutar. `checkTrainingAnswer` iki ayrı sorgu yapıyordu: önce listeyi okuyor, kart yoksa ekliyordu.

- **Açık:** Aynı soruya aynı anda gelen cevapların (iki sekme, çift tıklama, betik) hepsi kartı "yok" görüp ekliyordu. Yerelde 40 eşzamanlı istekte kart listeye 30'dan fazla kez yazıldı. Diğer denetimler doğruydu: başka labın kartı, bilgi kartı ve olmayan kart reddediliyordu, şık sınırı denetleniyordu. Yalnızca tekrarın sınırı yoktu.
- **Etki:** Öğrenci kendi satırını büyütebilir. İstek sınırı (`labActions`, 10 dakikada 600) içinde günde on binlerce eleman eklenebilir. Sonuç veritabanında şişme ve bu satırı okuyan sayfalarda yavaşlama olur. Başkasının verisine ya da puana etkisi yok, çünkü bitiş denetimi kart kümesine bakar. Düşük.
- **Düzeltme:** Kart tek bir atomik sorguyla eklenir: `INSERT … ON CONFLICT ("userId", "labId") DO UPDATE SET "answeredCards" = array_append(…) WHERE NOT (kart = ANY(…))`.
  - PostgreSQL çakışan satırı kilitledikten sonra `WHERE`'i satırın en son hâline göre değerlendirir.
  - İlk satırı aynı anda açan iki istekten ikincisi çakışma yoluna düşer ve kartı orada bulur.
  - `updatedAt` Prisma'nın yazdığı gibi UTC'dir.
- **Regresyon testi:** `lab-robustness.spec.ts`, "aynı soruya aynı anda gelen cevaplar …".
  - Node `fetch` ile 40 eşzamanlı istek gönderilir, çünkü Playwright'ın istek bağlamı istekleri sıraya koyabiliyor.
  - Altı tur koşulur; turlar sırayla satır yokken (ilk cevap) ve eğitim başlamışkendir.
  - Bilgi kartı, olmayan kart ve başka labın kartı `invalid` döner ve hiçbir şey yazmaz.

  Eski kodda üç koşunun üçü de düştü (30-33 tekrar).

### D28 — Yük testi hazırlığının "yalnızca yerel veritabanı" denetimi atlatılabiliyordu; yönetici şifresi depodaydı (düşük) — düzeltildi

`tests/load/prepare.ts` yük hesaplarını açar (öğrenciler, öğretmenler ve bir **yönetici**) ve oturumları sunucu tarafında yazar. `cleanup.ts` yük verisini siler. İkisi de canlı veritabanında çalışmamak için adresi denetliyordu.

- **Açık:**
  - **`?host=` parametresi:** Denetim yalnızca URL'deki ana makine adına bakıyordu. `pg` (pg-connection-string) ise `?host=` parametresini o adın yerine kullanır. Bu yüzden `postgresql://…@localhost/cyberguard?host=<başka makine>` denetimden geçip başka makineye bağlanıyordu. Birden çok `host` verilirse sonuncusu geçerlidir; `h%6Fst` yazımı da çalışır.
  - **`db` adı:** Docker yığınının iç adı `db` kabul ediliyordu. Sunucuda yığının ağında `db` canlı veritabanıdır.
  - **Sabit şifre:** Yük hesaplarının ortak şifresi `prepare.ts`'te sabitti. Denetim bir kez atlanırsa (yanlış bir `DATABASE_URL` ile) canlıda e-postası doğrulanmış bir **ADMIN** hesabı açılırdı; şifresi depoyu okuyan herkesin bildiği şifre olurdu.
  - **Ek, `stack.sh`:** `LOAD_PROJECT=cyberguard` ile çağrılırsa `down` komutu asıl yığının veritabanı birimini `down -v` ile silerdi. Asıl yığın sunucuda canlı yığındır, yerelde `docker compose up -d db`'nin açtığı yığın.
- **Etki:** Bunlar yalnızca geliştirici araçları ve saldırgan kendisi tetikleyemez; sorun, kazayı önleyen denetimin boşa çıkmasıydı. Düşük.
- **Düzeltme:**
  - `tests/load/safety.ts` (yeni, Prisma'sız). Karar üç adrese göre verilir: sürücünün gerçekten bağlanacağı adres (`new pg.Client({ connectionString }).host`), URL'in kendi adı ve bütün `host` değerleri. Üçü de `localhost`, `127.0.0.1` ya da `::1` olmalı. `db`, soket ve boş adres reddedilir.
  - Şifre her `prepare`'de rastgele üretilir (`randomBytes`) ve yalnızca `.data/users.json`'a (0600) yazılır.
  - `stack.sh`, `LOAD_PROJECT=cyberguard`'ı reddeder.
  - `tests/load/README.md`'deki canlı koşu maddesi buna göre yazıldı: canlıda hesap açmak ayrı bir karardır; verilirse denetim o koşu için bilerek değiştirilir.
- **Regresyon testleri:**
  - `tests/unit/load-safety.test.ts`:
    - kabul edilen ve reddedilen 20 adres;
    - şifrenin her seferinde yeni olması ve kayıt kuralını geçmesi;
    - `prepare.ts`'te sabit şifre olmaması.
  - `tests/unit/load-stack.test.ts`: çağrıları kaydeden sahte bir `docker` kullanılır. `cyberguard` adıyla hiçbir docker komutu çalışmamalı. Eski `stack.sh`'te bu test düştü; sahte docker sayesinde hiçbir şey silinmedi.

### Bilgi

- **B1 — Cloudflare'in sayfaya eklediği betikler.** Cloudflare panelindeki bazı özellikler sayfaya betik ekler: Web Analytics (RUM, `static.cloudflareinsights.com`), Rocket Loader, Zaraz, e-posta adresi gizleme (`/cdn-cgi/…/email-decode.min.js`). Aynı kökten gelenler (`/cdn-cgi/…`) çalışır; dış adresten gelenler CSP'ye takılır ve konsolda hata yazar. Site çalışır, ama özellik çalışmaz. Canlı e2e (`csp.spec.ts` ziyaretçi testi) böyle bir ihlalde düşer; bu iyi bir uyarıdır. Bu özellikler kapalı tutulmalı ya da bilerek CSP'ye eklenmeli (aşağıda soru 3).
- **B2 — Sunucuya doğrudan erişim.** Cloudflare'i atlayıp sunucunun IP'sine doğrudan gelen biri artık adres sahteleyemez (O1), ama Cloudflare'in korumalarını (DDoS, bot ve hız sınırları) atlayabilir. Sunucunun IP'si aynı sunucudaki diğer siteler yüzünden biliniyor olabilir. Daha sıkı yol: 443'e yalnızca Cloudflare aralıklarından izin vermek ya da Cloudflare "Authenticated Origin Pulls" (aşağıda soru 2). Bu turda yapılmadı: güvenlik duvarı bütün sunucuyu, `deny` ise liste eskiyince gerçek ziyaretçileri etkiler.
  - **Sonra (sabah soruları 23, Murat'ın kararı):** nginx girişimiz yalnızca Cloudflare aralıklarından (ve sunucunun kendisinden) gelen bağlantıyı kabul eder, gerisini yanıtsız kapatır (444; güvenlik duvarına ve diğer sitelere dokunulmadı). Liste `docker/server/cloudflare-ips.txt`'te; eskime riskine karşı haftalık kontrol `.github/workflows/cloudflare-ips.yml` Cloudflare'in listesi değişince kırmızı yanar. Deneme: `tests/deploy/nginx-site.sh`.
- **B3 — Cloudflare "Pseudo IPv4".** Bu ayar "Overwrite Headers" olursa `CF-Connecting-IP` IPv6 ziyaretçi için uydurma bir IPv4 olur; tur 4'teki /64 kuralı çalışmaz. Varsayılanı kapalıdır; yük testinde bakılmalı.
- **B4 — Tur 1 D5 (giriş ve kayıtta login-CSRF) değişmedi.** Tur 1 "Faz 6 CSP sıkılaştırması bunu da kapatır" demişti; kapatmaz: `form-action` yalnızca **bizim** sayfalarımızdaki formların nereye gittiğini sınırlar, başka sitenin bize form göndermesini değil. Next'in sunucu eylemlerindeki `Origin` denetimi yerinde; etki düşük.
- **B5 — Bir istatistik aracı eklenirse** (çerez bandında "isimsiz istatistik" seçeneği var, bugün hiçbir betik yüklenmiyor) aracın adresi CSP'ye bilerek eklenmeli; `csp.spec.ts` beklenen politikayı birebir denetlediği için bu sessizce olamaz.
- **B6 — Erişim kaydı.** Sitenin ayrı bir `access_log`'u yok; kayıtlar nginx'in ortak kaydına (`/var/log/nginx/access.log`) diğer sitelerle birlikte yazılır. O1'den sonra orada ziyaretçinin gerçek adresi görünür.
- **B7 — Next'in kendi yönlendirmeleri başlıksız.** Sonda `/` ya da `//` olan adresler için Next 308 yönlendirmesi döner. Bu yanıt `next.config.ts` başlıklarından önce çıktığı için CSP, `nosniff` ve `X-Frame-Options` taşımaz. Yanıt gövdesizdir, tarayıcı hemen hedefe gider ve hedef başlıklıdır. Etki yok.
- **B8 — Yedek servisi fiilen root yetkisiyle çalışır.** Servis yayın kullanıcısıyla çalışır, ama docker'ı şifresiz `sudo` ile çağırır (yayın da öyle). Docker'a erişebilen root'a eşittir. Yetkiyi daraltmak (ör. sudoers'ta yalnızca belirli komutlara izin) sunucu düzeniyle ilgili bir karardır; bugünkü yayın da aynı yetkiyle çalışıyor. Değiştirilmedi.
- **B9 — SSH anahtarının parolası.** `deploy.yml` anahtarın parolasını `ssh-keygen -p -P "$SSH_PASSPHRASE"` ile kaldırır; parola birkaç milisaniye süreç listesinde görünür. Çalıştırıcı GitHub'ın tek kullanımlık sanal makinesidir ve parola Actions kaydında maskelenir. Bu durum önceden vardı; değiştirilmedi.
- **B10 — İzleme konusu başlığa göre bulunur.** `uptime.yml`, açık konular içinde başlığı "Site erişilemiyor" olanı alır. Depoya yazabilen biri aynı başlıkla bir konu açarsa iş onu kapatabilir ya da ona yorum yazabilir. Depo özel ve iki kişilik. Konuları yazara (`github-actions[bot]`) göre süzmek kolay bir sıkılaştırma olur; iş akışı bugün yalnızca elle çalıştığı için yapılmadı.
- **B11 — Geri yükleme denemesi: kayıttaki kişisel veri ve konteyner silme (düzeltildi).**
  - **Kişisel veri:** `pg_restore` hata verirse son satırlar Actions kaydına yazılıyordu. `DETAIL` ve `CONTEXT` satırları ("Key (email)=(…)", "Failing row contains (…)") satırın verisini taşıyabilir. Bu satırlar artık atılır ve her satır 200 karakterle sınırlanır.
  - **Konteyner silme:** Çıkışta geçici konteyner yalnızca adıyla siliniyordu. Artık hem adı hem betiğin etiketi tutmalıdır.
  - **Son migration:** Artık yalnızca bitmiş migration'lardan okunur.
- **B12 — Geri yükleme denemesinin kilidi ve belleği.**
  - **Kilit:** Kilit dosyası `/tmp/cyberguard-restore-test-<uid>.lock`, `exec 9>` ile açılır. Başka bir yerel kullanıcı oraya bir bağlantı koyabilseydi yayın kullanıcısının bir dosyası boşaltılabilirdi. Linux'un `protected_symlinks` koruması (Ubuntu'da açık) yapışkan `/tmp`'de başkasının bağlantısını izlemez. Ayrıca sunucuda başka yerel kullanıcı olmadığı varsayılıyor.
  - **Bellek:** Geçici veritabanı en çok 1 GB tmpfs, konteyner en çok 1,5 GB bellek kullanır. Sunucu paylaşıldığı için deneme sırasında diğer işlerin belleğinden yer alır. Deneme yalnızca elle ve CI'da çalışır, gece çalışmaz.
- **B13 — Yük testinin yerel kalıntıları.**
  - `school-ip.js` kendi kayıt ettiği öğrenci hesaplarında sabit bir şifre kullanır. Hesaplar `.invalid` alan adındadır, betik yalnızca yerel yığına karşı koşar ve hesaplar koşudan sonra silinir. Canlı koşu kararı verilirse bu da değişmeli.
  - `stack.sh` kod maili klasörüne `chmod 777` verir, çünkü konteynerdeki `node` kullanıcısının yazması gerekir. Klasör yalnızca yerel makinede (`/tmp/cg-load/stack/outbox`) ve içindeki kodlar yalnızca yük hesaplarına ait.
- **B14 — `npm audit --omit=dev`.** Tur 1 D1 ile aynı 4 yüksek uyarı: `deepmerge-ts`, `@prisma/config`, `prisma`, `mysql2`. Hepsi Prisma CLI zincirinde.
  - CLI yalnızca migration imajında var ve orada yalnızca `migrate deploy` çalıştırır.
  - `mysql2` kullanılmıyor; `deepmerge-ts`'e dışarıdan girdi gitmiyor.
  - Çalışan uygulama imajında bu paketler yok.

  Dependabot PR'ları bu turda birleştirilmedi.

---

## Verilen kararlar

1. **CSP `next.config.ts`'te, statik.** Nonce yok (sayfalar statik kalsın); `'unsafe-inline'` yalnızca betik ve stil özniteliklerinde, kalan her şey `'self'` ya da `'none'`. `sri` açılmadı.
2. **`script-src-attr 'none'` ve `style-src-elem 'self'`.** Ayrıntılı yönergeleri tanımayan eski tarayıcılar `script-src` ve `style-src`'ye düşer; site orada da çalışır (yalnızca daha az korunur).
3. **`base-uri 'none'`** (`'self'`'ten sıkı; `<base>` hiç kullanılmıyor), **`worker-src 'none'`**, **`img-src 'self'`** (`data:` yok).
4. **`upgrade-insecure-requests` yok** (yukarıdaki tablo).
5. **`Cross-Origin-Opener-Policy: same-origin`** eklendi.
6. **HSTS `includeSubDomains`, `preload` yok.**
   - `includeSubDomains`, başlığı gönderen adın **altındaki** adlara uygulanır (RFC 6797). Başlığı `bitirme.muratbulut.net` gönderdiği için yalnızca `*.bitirme.muratbulut.net`'i bağlar. `muratbulut.net`'e, `chess…`, CTFd ya da başka bir kardeş alt alana uygulanmaz.
   - `bitirme.muratbulut.net`'in alt adı yok; Cloudflare'in ücretsiz sertifikası iki düzeyli alt adı (`x.bitirme.muratbulut.net`) zaten kapsamaz, yani orada HTTPS'siz bir site kurmanın meşru bir yolu yok.
   - Kazanç: araya giren biri `http://herhangi.bitirme.muratbulut.net` gibi sahte bir alt ad üzerinden `bitirme.muratbulut.net` için çerez yazamaz (oturum çerezi `__Secure-` önekli olduğu için zaten korunuyordu; tema ve çerez seçimi gibi diğer çerezler de korunur).
   - `preload` yok: tarayıcıların ön yükleme listesi ana alan adının (`muratbulut.net`) bütün alt alanlarını bağlar ve geri alınması aylar sürer.
   - Caddy (sunucu dışındaki kurulumlar) `includeSubDomains` eklemez: orada alan adı herhangi bir ad olabilir.
7. **Cloudflare aralıkları site dosyasında**, kendi snippet dosyamız yok (sunucuda bizim olan yerler yalnızca site girişi ve `/opt/apps/cyberguard`).
8. **Yarım kalan migration'da yayın durur, çıkış elle yapılır (D25).** Otomatik geri yükleme yok: canlı veritabanını silen ya da üstüne yazan betik bilerek yok. README'deki elle adımlar her PR'da CI'da sınanıyor.
9. **Migration dosyalarında işlemi bölen komut yok (`migrations.test.ts`).** Bir gün `CREATE INDEX CONCURRENTLY` gibi bir komut gerekirse bu ayrı ve bilinçli bir karar olur; test o dosya için açıkça güncellenir.
10. **Saklama kuralları `backup-lib.sh`'te (D26).** Yedek betiği ve test aynı kodu çalıştırır; test Docker'sız olduğu için CI'nın ilk işinde koşar.
11. **`answeredCards` tek bir ham SQL sorgusuyla yazılır (D27).** Prisma'nın `upsert`'ü koşullu güncelleme yazamaz. Danışma kilidi ve işlem yerine tek atomik sorgu seçildi, çünkü bağlantı havuzunda bekleme yaratmaz. Yöntem `rate-limit.ts`'teki sayacınkiyle aynı.
12. **Yük testinde `db` adı reddedilir (D28).** Canlı koşu kararı verilirse denetim o koşu için bilerek değiştirilir. Okul-IP betiğinin şifresi değiştirilmedi (B13).
13. **Değiştirilmeyenler (B8–B10, B12).** İzleme konusunun yazara göre süzülmesi, SSH parolasının veriliş biçimi, yedek servisinin `sudo` yetkisi ve geri yükleme denemesinin kilit dosyası değiştirilmedi: etkileri yok ya da sunucu düzeni kararı.

## Bu turda yapılan değişiklikler

- **CSP dilimi, kod:**
  - `next.config.ts`: CSP (gerekçeleriyle), `Cross-Origin-Opener-Policy`, belge adresinin CSP'si (D24).
  - `lib/zod.ts` (yeni) ve Zod kullanan 12 dosya; `eslint.config.mjs` (D23).
  - `lib/admin/application-document.ts`: başlık önceliği yorumu (D24).
- **CSP dilimi, sunucu (birleşince yayın iş akışı uygular):**
  - `docker/server/nginx-site.conf`: Cloudflare aralıkları ve `real_ip_header`, başlıkların yeniden yazılması (O1), HSTS `includeSubDomains`.
  - `docker/server/install-nginx.sh`: chess parçasına bağlılık kaldırıldı (O1).
  - `docker/server/inspect.sh`: gerçek IP ve HSTS ayarlarını yazar (yalnızca okur).
  - `docker/server/README.md`, `docker/Caddyfile`: açıklama.
- **CSP dilimi, CI:** `.github/workflows/ci.yml` Docker işi CSP başlığını da denetler.
- **CSP dilimi, testler:**
  - `tests/e2e/csp.spec.ts` (yeni): ziyaretçi (canlıda da koşar), öğrenci, öğretmen ve okul, yönetim; başlık yönerge yönerge, ihlal yok.
  - `tests/e2e/security.spec.ts`: CSP ve COOP her yanıtta; canlıda HSTS değeri birebir.
  - `tests/unit/zod.test.ts` (yeni, D23).
- **Yedek, geri yükleme ve yayın (bu turun son dilimleri):**
  - `docker/server/deploy.sh`: önceki yayından kalan başarısız migration'da yayın başlamaz; "geri alındı" işareti yalnızca bu yayının migration'ına konur (D25).
  - `docker/server/backup-lib.sh` (`prune_backups`) ve `backup.sh`: saklama kuralları (D26).
  - `docker/server/restore-test.sh` (B11):
    - `pg_restore` hata satırlarında veri yok;
    - yalnızca kendi etiketli konteynerini siler;
    - "son migration" bitmiş migration'lardan okunur.
  - `docker/server/README.md`: saklama kuralları; "Migration başarısız olursa" bölümüne sonraki yayının durması ve CI'daki deneme eklendi.
- **CI (`.github/workflows/ci.yml`):**
  - `shellcheck` artık `tests/deploy/*.sh` dosyalarını da denetler.
  - Yeni adım: "Yedek saklama denemesi".
  - Docker işinde yeni adım: "Yarım kalan migration'dan sonraki yayın".
- **Lab:** `lib/lab/actions.ts`, `checkTrainingAnswer` artık atomik (D27).
- **Yük testi (D28):**
  - `tests/load/safety.ts` (yeni);
  - `accounts.ts`, `prepare.ts`, `stack.sh`, `README.md`.
- **Testler (bu turun son dilimleri):**
  - `tests/deploy/backup-retention.sh`, `tests/deploy/partial-migration/`;
  - `tests/unit/migrations.test.ts`, `tests/unit/load-safety.test.ts`, `tests/unit/load-stack.test.ts`;
  - `tests/e2e/lab-robustness.spec.ts` (yarış testi) ve `tests/e2e/support/actions.ts` (`callActionBurst`).
- `CLAUDE.md`: CSP'nin ve Zod kapısının yeri.
- **Numaralama:** "Y", "O" ve "B" her turda baştan başlar, "D" bütün turlarda sürer. Tur 4 D22'de kaldığı için bu tur D23'ten başlar (D23-D28); B numaraları B1-B14.

## Önceki turlardan kapananlar

- **Tur 1 D2 (CSP yok):** kapandı. Nonce yerine statik politika seçildi (yukarıdaki gerekçe). HSTS kararı da verildi (karar 6).
- **Tur 2 O2'nin tarayıcı tarafı:** kapandı, `media-src 'self'`.
- **Tur 2 D8 (okunamayan taslak boş açılır):** kapandı. Taslak uyarıyla açılır; kaydetme ve yayınlama onun üstüne yazmaz.
- **Tur 2 D9 (aynı anda düzenleme):** kapandı. Kaydetme `draftRevision` koşuluyla tek yazımdır; listedeki "Yayınla" sürümü gönderir.
- **Tur 2 D10 (mahallede tek eğitim labı):** kapandı, kısmi tekil indeksle. Var olan veride aynı mahallede iki eğitim labı varsa indeks kurulmaz ve bir NOTICE yazılır; düzeltme yolu `docs/guides/new-lab.md`'de.
- **Tur 2 B1 (eğitimin bitişini tarayıcı söyler):** kapandı. Sunucu bütün soruların cevaplandığını denetler. Bu turda düzeltmenin içinde bir yarış bulundu ve düzeltildi (D27).
- **Tur 1 D4 (Cloudflare gerçek IP):** kod tarafı O1 ile düzeltildi; canlıda aşağıdaki listeyle doğrulanacak.
- **Değişmeyen:** tur 1 D1 (`npm audit`; B14), tur 1 D5 (login-CSRF; B4).

Bu turdaki kapanışların kanıtı: `tests/e2e/lab-robustness.spec.ts` (D8, D9, D10, B1) ve `csp.spec.ts` (D2, O2).

## Yük testinde bakılacaklar (Murat ile, yalnızca okuyarak)

Sunucuda hiçbir şey değiştirilmez; komutlar yalnızca okur.

1. **Yayından sonra sunucunun ayarı:** GitHub → Actions → Yayın → Run workflow → `inspect`. "Gerçek IP (Cloudflare) ve HSTS" bölümünde:
   - `/etc/nginx/sites-available/bitirme.muratbulut.net: set_real_ip_from x22` ve `real_ip_header CF-Connecting-IP;` görünmeli.
   - Başka bir dosyada (`nginx.conf` ya da `conf.d`) `http` düzeyinde `real_ip_header` varsa not edilmeli: bizim sunucu bloğumuz onu geçersiz kılar, ama diğer sitelerin davranışı için bilgi.
   - `Strict-Transport-Security` yalnızca bizim dosyamızda, `includeSubDomains` ile ve `preload` olmadan.
2. **Canlı başlıklar** (kendi bilgisayarından, `curl -sI https://bitirme.muratbulut.net/`):
   - tek bir `strict-transport-security: max-age=31536000; includeSubDomains` (iki tane varsa Cloudflare panelinde de HSTS açık demektir; alan geneli HSTS kapatılmalı),
   - `content-security-policy` yukarıdaki değer, `cross-origin-opener-policy: same-origin`.
3. **Tarayıcı konsolu:** `/`, `/giris`, bir lab ve `/yonetim` açıkken geliştirici araçlarında "Refused to …" ile başlayan CSP hatası olmamalı. Varsa çoğunlukla Cloudflare'in eklediği bir betiktir (B1): Cloudflare → Speed / Analytics / Scrape Shield ayarlarına bakılır. Yayından sonraki canlı e2e'nin `csp.spec.ts` ziyaretçi testi de bunu yakalar.
4. **Uygulamanın gördüğü IP** (yük testinden sonra, sunucuda `/opt/apps/cyberguard` içinde):
   ```bash
   sudo docker compose -f docker-compose.yml -f docker/server/compose.yml exec -T db \
     psql -U cyberguard -d cyberguard -c "SELECT \"ipAddress\", count(*) FROM \"Session\" WHERE \"createdAt\" > now() - interval '2 hours' GROUP BY 1 ORDER BY 2 DESC LIMIT 20"
   sudo docker compose -f docker-compose.yml -f docker/server/compose.yml exec -T db \
     psql -U cyberguard -d cyberguard -c "SELECT split_part(\"key\", ':', 1) AS kural, substr(\"key\", strpos(\"key\", ':') + 1) AS anahtar, \"count\" FROM \"RateLimit\" WHERE \"key\" LIKE '%-ip:%' ORDER BY \"count\" DESC LIMIT 20"
   ```
   - Adresler yük testini yapan makinenin ve Murat'ın gerçek adresleri olmalı (Murat kendi adresini bir "IP'm ne" sayfasından bakar).
   - Adresler Cloudflare aralıklarındaysa (`104.16.`–`104.31.`, `172.64.`–`172.71.`, `162.158.`/`162.159.`, `141.101.`, `108.162.`, `188.114.`, `2400:cb00:`, `2606:4700:`, `2a06:98c0:` …) gerçek IP çalışmıyor demektir.
   - IPv6 ziyaretçi varsa `RateLimit` anahtarları `…::/64` biçiminde olmalı; uydurma `240.x.x.x` görülürse Pseudo IPv4 açıktır (B3).
5. **Cloudflare'i atlayan sahte başlık:** kendi bilgisayarından, sunucunun IP'siyle (yalnızca okuyan bir GET):
   ```bash
   curl -sk --resolve bitirme.muratbulut.net:443:<SUNUCU_IP> https://bitirme.muratbulut.net/api/health \
     -H 'CF-Connecting-IP: 1.2.3.4' -H 'X-Forwarded-For: 1.2.3.4'
   ```
   Sonra sunucuda `sudo grep ' /api/health' /var/log/nginx/access.log | tail -3`: satırın başında `1.2.3.4` değil, Murat'ın gerçek adresi olmalı. (Sabah soruları 23'ten sonra istek hiç cevap almaz, curl "Empty reply from server" der: sunucu yalnızca Cloudflare'e açıktır. Beklenen budur.)
6. **Yük testinin tasarımı için:** 100 sanal kullanıcı aynı IP'den gelirse IP sınırları devreye girer: kayıt saatte 60, giriş 10 dakikada 100, kod gönderme saatte 120 (`lib/rate-limit.ts`). Bu doğru davranıştır; hesaplar yük testinden önce açılmalı ya da girişler birkaç IP'ye yayılmalı. Tek bir okulun NAT'ı arkasındaki gerçek bir sınıf da aynı sınırlara takılır (tur 4 B2).

## Karar bekleyenler (Murat)

1. **HSTS `includeSubDomains`:** `bitirme.muratbulut.net`'in altında hiç alt ad kullanılmayacak mı? (Kullanılacaksa o ad da HTTPS'li olmalı; değilse karar 6 geçerli.)
2. ~~**Sunucuya doğrudan erişim (B2):** 443'e yalnızca Cloudflare'den izin verilsin mi?~~ Karar verildi (sabah soruları 23): nginx girişimiz yalnızca Cloudflare'den gelen bağlantıyı kabul eder, liste haftada bir denetlenir (B2'nin altında).
3. **Cloudflare'in betik ekleyen özellikleri (B1):** Web Analytics, Rocket Loader, Zaraz, e-posta gizleme açık mı? Açıksa kapatılsın mı, yoksa CSP'ye bilerek mi eklensin?
4. **Okul IP'si sınırları.** Durum (yük testinin okul-IP denemesi, `tests/load/README.md`):
   - Aynı okul IP'sinden aynı saatte iki 35 kişilik sınıf kayıt olursa `signUpIp` (IP başına saatte 60) 10 öğrenciyi bir saat boyunca reddediyor.
   - Sırada bağlayabilecek sınırlar: `codeSendIp` (saatte 120) ve `signInIp` (10 dakikada 100).

   **Öneri:** kayıt saatte 200, kod maili saatte 300, giriş 10 dakikada 300. Asıl koruma e-posta başına sınırlar olarak kalır:
   - 5 hatalı girişte bekleme;
   - e-posta başına saatte 6 kod, 60 saniyede bir kod;
   - kodun 5 yanlışta geçersizleşmesi.

   **Bedeli:** tek bir IP'den toplu hesap açmak ve kod istemek üç kat kolaylaşır. Bu, tur 4 B2'deki (CGNAT) dengenin aynısıdır. Sınırlar değiştirilmedi.
5. **Silinen veri yedeklerde 7 gün daha kalır.** Hesap silinince veri canlı veritabanından çıkar; yedeklerde en geç 7 gün daha kalır (sunucu dışı kopya yok). Gizlilik metni bugün yedeklerden söz etmiyor. Bir cümle eklensin mi? Örnek: "Silinen veriler yedeklerden de en geç 7 gün içinde silinir."
