# Güvenlik turu 1 — Faz 1 + Faz 2

- **Tarih:** 11 Ekim 2026
- **Kapsam:** Faz 1 (altyapı, yayın, ters vekil) ve Faz 2 (hesap ve yasal: kayıt, giriş,
  e-posta kodu, şifre sıfırlama, profil, e-posta değiştirme, oturumlar, hesap silme,
  istek sınırları, çerez onayı, yasal sayfalar).
- **Nasıl yapıldı:** Kod incelemesi + yerel **üretim derlemesine** karşı deneme
  (`npm run build`, `next start -p 3100`, yerel PostgreSQL). Canlı siteye karşı **hiçbir**
  yazma/deneme yapılmadı; canlı yalnızca okunur sayılır (kural: CLAUDE.md "Lab güvenliği",
  "Gizlilik"). Dış ağa istek atılmadı.
- **Sonuç:** Yüksek/kritik, sömürülebilir bir açık **bulunmadı**. Mimari sağlam. Aşağıda
  düşük/bilgi düzeyinde maddeler ve Faz 6 için öneriler var.

> Not: Bu tur öncesi kodda zaten güvenlik testleri vardı (açık yönlendirme, güvenlik
> başlıkları). Bu turda bunlara oturum çerezi koruması regresyon testi eklendi.

---

## Doğrulanan korumalar (çalışıyor)

| Alan | Durum | Kanıt |
| --- | --- | --- |
| Oturum çerezi | `httpOnly` + `SameSite=Lax`; HTTPS'te `Secure` + `__Secure-` öneki | Kayıt sonrası çerez bayrakları; `document.cookie` belirteci göstermiyor |
| CSRF (kimlikli eylemler) | `SameSite=Lax` sayesinde çapraz siteden gelen POST oturumsuz kalır → `requireSession` girişe yönlendirir | Profil eylemlerinin tümü `requireSession`/`getSession` ile korunuyor |
| Açık yönlendirme (`?sonra=`) | Kapalı: yalnızca sitenin kendi yolu; `//`, `\`, şema, kontrol karakteri reddedilir | `safeNext` + mevcut birim testleri; `/profil` → `/giris?sonra=%2Fprofil` |
| Güvenlik başlıkları | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` her yanıtta; `X-Powered-By` kapalı; HSTS ters vekilde | `/`, `/api/health`, 404 başlıkları |
| OTP kaba kuvvet | Kod 5 yanlışta geçersiz (Better Auth `allowedAttempts`), ayrıca IP başına `codeVerifyIp` (200/10dk) | `lib/auth.ts` `codeRules`, `lib/rate-limit.ts` |
| Hesap varlığı sızıntısı (kod/sıfırlama) | Yanıt hesap olsa da olmasa da aynı; mail yanıttan **sonra** (`after()`) gider → süre sızdırmaz | `requestPasswordReset`, `backgroundTasks` ayarı |
| Giriş kaba kuvvet | E-posta başına 5 hatada kilit + IP başına geniş sınır; başarı/sıfırlama kilidi düşürür | `signInFailures`, `signInIp` |
| Şifre ile korunan profil işlemleri | Yanlış şifre girişin 5 deneme kilidine sayılır (profil ikinci bir şifre kapısı olmaz) | `passwordLock`/`wrongPassword` |
| SQL enjeksiyonu | Prisma parametreli; ham sorgu yalnızca `SELECT 1` ve istek sayacı (parametreli) | `lib/db`, `lib/rate-limit.ts` |
| Görünen ad XSS | Mailde `escapeHtml`, arayüzde React kaçışı | `lib/mail/code-mail.ts` |
| Sır sızıntısı | Kod/adres kayda yazılmaz; sağlık ucu yalnızca durum döner; `X-Powered-By` yok | `lib/auth.ts` log'lar, `app/api/health` |
| Askıya alınmış hesap | Oturum açılışında engellenir | `databaseHooks.session.create.before` |
| Üretim imajı | Ayrıcalıksız kullanıcı, `cap_drop: ALL`, `no-new-privileges`; DB portu dışarı kapalı | `docker-compose.yml`, `docker/server/compose.yml` |

---

## Bulgular (düşük / bilgi)

### D1 — `npm audit`: yüksek uyarılar yalnızca derleme araçlarında (bilgi)

`npm audit` 4–9 "high" gösteriyor: `deepmerge-ts` (yığın tükenmesi) ve `mysql2`
(düz-metin kimlik sızıntısı, sıkıştırma bombası DoS). Hepsi `prisma` CLI'ının ve
`better-auth`'un geçişli bağımlılıkları.

- `mysql2` bir MySQL sürücüsü; biz **PostgreSQL** (`pg`) kullanıyoruz, mysql2 hiç
  çalışmıyor. `prisma` **devDependency** (CLI/migration aracı), üretimde çalışmaz.
- **Doğrulandı:** `mysql2` ve `deepmerge-ts` üretim `standalone` imajına **girmiyor**
  (`.next/standalone/node_modules` içinde yoklar). Yani çalışan sitede erişilebilir değiller.
- **Risk:** Çalışma zamanında sömürülemez. **Aksiyon:** Prisma yamalı sürüm çıkınca
  yükselt; istenirse `package.json` `overrides` ile dedupe. Bu tur bir şey değiştirilmedi
  (zorlanırsa prisma 6'ya düşüyor, kırıcı).

### D2 — İçerik Güvenliği Politikası (CSP) henüz yok (düşük, planlı)

CSP kasıtlı olarak Faz 6'ya bırakılmış (doküman Bölüm, `next.config.ts` yorumu). Doğru CSP,
Next 16'da nonce taşımayı gerektirir ve yarım bir CSP akışlı sayfaları/hidrasyonu bozabilir;
bu yüzden bu turda **eklenmedi** (planı ve dalın kapsamını koruyoruz).

- **Öneri (Faz 6, en üst sıra):** nonce tabanlı sıkı CSP + `frame-ancestors 'none'`
  (X-Frame-Options'ı tamamlar) + HSTS'e `includeSubDomains`/`preload` kararı. En etkili
  eksik başlık budur; Faz 6 "Güçlendirme" işine açıkça yazıldı.

### D3 — Doğrulanmamış e-posta "rezervasyonu" (düşük)

Kayıt, adresi doğrulamadan `User.email`'e yazıyor; aynı adresle ikinci kayıt "e-posta
kullanımda" alıyor. Yani biri `kurban@okul.com` ile kayıt olup (doğrulamadan) o adresi
geçici olarak kilitleyebilir / var olup olmadığını öğrenebilir.

- **Hafifletici:** 30 gün doğrulanmamış hesap otomatik siliniyor (`lib/cleanup.ts`); kilit
  kalıcı değil. Okul platformu için etkisi düşük.
- **Aksiyon:** Şimdilik kabul. Faz 6'da "doğrulanana kadar adresi rezerve etme" ya da daha
  kısa doğrulanmamış-hesap ömrü değerlendirilebilir. Bu, hesap akışını değiştirir;
  karar Murat'ta.

### D4 — İstek sınırı IP'si `x-forwarded-for`'a güveniyor (bilgi)

`clientIp` XFF'in ilk değerini alır; Better Auth da `ipAddressHeaders: ["x-forwarded-for"]`
kullanır. Bu yalnızca öndeki ters vekil XFF'i **ezdiği** için güvenli.

- Canlıda nginx `X-Forwarded-For $remote_addr` yazıyor (istemcinin gönderdiğini eziyor) →
  istemci XFF'i uyduramaz. ✔
- **Dikkat:** Cloudflare önde olduğundan, nginx'teki gerçek-IP parçası
  (`chess-cloudflare-realip.conf`) yoksa `$remote_addr` Cloudflare'in IP'si olur ve
  IP başına sınırlar bütün kullanıcıları tek Cloudflare IP'sinde toplar (çok kaba). Asıl
  koruma zaten e-posta başına sınırlar; yine de **sunucuda bu parçanın yüklü olduğu**
  bir kere doğrulanmalı. (Salt-okuma kontrolü; sunucuya dokunulmadı.)

### D5 — Giriş/kayıt'ta login-CSRF ihtimali (bilgi)

Oturumsuz eylemlerde (giriş, kayıt) `SameSite=Lax` üst düzey POST'u tam engellemez; teorik
login-CSRF mümkün ama etkisi düşük (kurbanı saldırganın hesabına sokmak). Next'in Origin
denetimi + kodlu eylem kimliği bunu pratikte zorlaştırır. **Aksiyon yok;** Faz 6 CSP/Origin
sıkılaştırması bunu da kapatır.

---

## Bu turda yapılan değişiklik

- **Regresyon testi eklendi:** `tests/e2e/security.spec.ts` → oturum çerezi `httpOnly`,
  `SameSite=Lax`, JS'ten okunamaz; HTTPS'te `Secure` + `__Secure-` öneki. (Doğrulanan
  korumayı sabitler; ileride yanlışlıkla gevşetilmesini engeller.)
- Kod düzeltmesi **gerekmedi** (sömürülebilir açık yok).

## Faz 6'ya taşınan öneriler (özet)

1. Nonce tabanlı CSP + `frame-ancestors 'none'`; HSTS kapsam kararı. (D2 — en öncelikli)
2. Prisma yamalı sürüme yükseltme / `overrides` ile dedupe. (D1)
3. Doğrulanmamış hesap ömrü / adres rezervasyonu politikası. (D3)
4. Sunucuda Cloudflare gerçek-IP parçasının yüklü olduğunun doğrulanması. (D4)
