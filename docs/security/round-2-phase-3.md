# Güvenlik turu 2 — Faz 3

- **Tarih:** 11 Ekim 2026
- **Kapsam:** Faz 3 (lab motoru ve demo lab): eğitim ve senaryo oynatıcısı, lab sunucu
  eylemleri, puan ve rapor, yol haritası, lablar kataloğu, lab kapağı, ana sayfa, rozetler,
  yönetim paneli (lab listesi, Lab düzenleme formu, "Önizle", ilk yöneticiler `ADMIN_EMAILS`).
  Yönetici yapmaya bağlandığı için hesap akışındaki e-posta doğrulaması da yeniden incelendi.
- **Nasıl yapıldı:** Kod incelemesi + yerel **üretim derlemesine** karşı deneme
  (`npm run build`, Playwright, yerel PostgreSQL). Canlı siteye karşı **hiçbir** yazma ya da
  deneme yapılmadı. Bulgular düzeltmeden önce kendi kopyamızda kanıtlandı, düzeltmeden sonra
  aynı denemeler regresyon testi olarak eklendi.
- **Sonuç:** Bir **yüksek (koşullu)** ve iki **orta** bulgu bulundu ve düzeltildi. Lab motorunun
  temel kuralları (doğru cevaplar tarayıcıya gitmez, puan sunucuda, sahte forma yazılan metin
  kaydedilmez, deneme yalnızca sahibine açık) çalışıyor.

---

## Doğrulanan korumalar (çalışıyor)

| Alan | Durum | Kanıt |
| --- | --- | --- |
| Doğru cevaplar tarayıcıya gitmez | Öğe türü (sahte/gerçek), işaretler, neden, sahte sayfa, soru puanları, açıklamalar, ipuçları sunucuda kalır | `lib/lab/client.ts`; **yeni e2e:** 7 öğrenci sayfasının ham yanıtında (HTML + React verisi) bu metinlerin hiçbiri yok |
| Puan ve rapor sunucuda | Olaylardan sunucu hesaplar; tarayıcıdan puan, "doğru" ya da kimlik alınmaz | `lib/lab/actions.ts` (`close`, `scoreScenario`) |
| Sahte forma yazılan metin | Sunucuya hiç gitmez, yalnızca "bilgi girildi" olayı; kutu gönderimden önce boşaltılır (tarayıcı şifreyi kaydetmeyi önermesin) | `submitTrap`, `BrowserPage.tsx`; e2e: olaylarda yazılan şifre yok |
| Deneme sahipliği | Eylemler ve rapor yalnızca denemenin sahibine; başkası "bulunamadı" görür | `openAttempt`, rapor sayfası; e2e |
| Kilit | Eğitim bitmeden senaryo ne sayfada ne eylemde başlar | `startAttempt` + oyna sayfası (`getCity`) |
| Taslak ve gizli lab | Öğrenci yalnızca yayındaki sürümü görür | `getPublishedLabs` (`status: PUBLISHED`) |
| Doğrulanmamış hesap | Senaryo labı eylemleri doğrulanmış e-posta ister | `actor(true)`; e2e |
| İstek sınırı | Lab eylemleri kullanıcı başına 600 / 10 dk; deneme başına en fazla 2000 olay, toplu gönderimde 50 | `rateRules.labActions`, `maxSeq`, `maxBatch` |
| Yönetim yetkisi | Her sunucu eylemi yetkiyi kendisi denetler (yalnızca sayfa kapısına güvenilmez); rol ve askı her istekte veritabanından okunur | `lib/admin/lab-actions.ts` (`allowed`), `lib/admin/access.ts` |
| Yönetimde içerik | Zod şeması, sınırlı uzunluk ve sayılar; şablon veritabanından; durum, sürüm, adres sunucuda belirlenir | `lib/admin/validate.ts`, `lib/lab/content.ts` |
| XSS | `dangerouslySetInnerHTML` yok; bağlantı adresleri yalnızca metin olarak gösterilir, hiçbir yerde `href` olmaz; `**kalın**` React öğesine çevrilir | `components/lab/**`, `components/admin/**` |
| Kayıt defteri | Lab açma, kaydetme, yayınlama, geri alma, gizleme, sıralama ve yönetici yapma yazılır; tablo tetikleyiciyle silinmez ve değiştirilmez | `lib/admin/lab-actions.ts`, `prisma/migrations/..._init` |
| Hesap silme | Lab denemeleri önce silinir; eğitim ilerlemesi ve rozetler hesapla birlikte | `lib/cleanup.ts` |
| Bağımlılıklar | Faz 2'den beri yeni bağımlılık yok; `npm audit` aynı (tur 1, D1) | `package.json` |

---

## Bulgular

### Y1 — Adres değiştirme yarışıyla kanıtlanmamış adres doğrulanmış sayılıyordu (yüksek, koşullu) — düzeltildi

Doğrulama sayfasındaki "E-postanı mı yanlış yazdın?" (`changeUnverifiedEmail`) hesabın
doğrulanmamış olduğuna isteğin başında bakıp adresi koşulsuz yazıyordu. Aynı anda eski
adrese gelen kodla **doğrulama** ya da **şifre sıfırlama** biterse, sonuç "yeni (hiç
kanıtlanmamış) adres + doğrulandı" oluyordu.

- **Neden önemli:** `ADMIN_EMAILS`'teki doğrulanmış adres yönetici olur (Faz 3). Listede olup
  henüz hesabı olmayan bir adresi bilen biri, kendi hesabına o adresi yazıp yönetici olabilir,
  yani öğrencilere lab yayınlayabilirdi.
- **Kanıt:** Kendi kopyamızda iki sekmeyle denendi. Doğrulama isteğinden **8 ms** sonra gelen
  adres değiştirme ve şifre sıfırlamadan **15 ms** sonra gelen adres değiştirme, hesabı
  "hedef adres, doğrulandı" durumunda bıraktı.
- **Koşul:** Listede hesabı olmayan bir adres olmalı ve saldırgan onu bilmeli (depo özel;
  adresler herkese açık değil). Canlıda geçici önlem olarak listedeki adreslerle hemen hesap
  açılması istendi; hesap varsa bu yol kapalıdır.
- **Düzeltme:**
  1. Adres yalnızca hâlâ doğrulanmamış ve adresi değişmemiş hesaba yazılır (tek, koşullu
     yazım). Aynı adresle eşzamanlı kayıt da "adres kullanılamıyor" döner, hata vermez.
     (`lib/account/actions.ts`)
  2. Better Auth'un hesabı "doğrulandı" yapan her yazımı, kodla kanıtlanan adresi de aynı
     yazımda yazar. Şifre sıfırlama yalnızca "doğrulandı" yazıyordu, artık adresi de yazar.
     Kanıtlanan adres bilinmiyorsa "doğrulandı" hiç yazılmaz. (`lib/auth.ts`,
     `databaseHooks.user.update.before`)
- **Regresyon testi:** `tests/e2e/account-race.spec.ts`. İki yarış farklı zaman farklarıyla
  (doğrulamada 16 tur, şifre sıfırlamada 8 tur) denenir; hesap doğrulanmışsa adresi kodla
  kanıtlanan adres olmalıdır.

### O1 — Sahte sayfa, tıklama kaydedilmeden açılabiliyordu (orta) — düzeltildi

Sunucunun yazdığı olaylar (bağlantıya tıkladı, sahte forma bilgi girdi, kodu gönderdi)
tarayıcının verdiği sıra numarasıyla yazılıyor, numara doluysa olay **sessizce atlanıyordu**,
ama eylem yine yapılıyordu.

- **Etki:**
  - Elle çağrılan eylemle (tarayıcı konsolu) hangi mailin sahte olduğu, ceza almadan
    görülebiliyordu. Sahte sayfa açılıyor ama "linke tıkladı" kaydedilmiyordu.
  - Aynı deneme iki sekmede açıkken gerçek bir öğrenci sahte sayfaya şifre yazınca "hacklendin"
    yerine hata görüyordu.
- **Kanıt:** İki sekmeli deneme (masaüstü ve telefon): sahte sayfa açıldı, veritabanında
  `link_clicked` yoktu.
- **Düzeltme:** Olay yazılamazsa eylem yapılmaz ("bir sorun çıktı, tekrar dene"; yeniden
  tıklayınca boş numara alır). Aynı olayın aynı numarayla tekrar gelmesi sorun değildir.
  Ek sağlamlaştırma: sahte form yalnızca gelen kutusu labında kabul edilir; deneme kimliği
  metin değilse sorgu yapılmaz. (`lib/lab/actions.ts`)
- **Regresyon testi:** `tests/e2e/lab-security.spec.ts`, "aynı deneme iki sekmede açıkken…"

### O2 — Eğitim videosu dış siteden yüklenebiliyordu (orta) — düzeltildi

Video kartının adresi yalnızca sitenin kendi dosyası olmalı, ama kural `//baska-site/video.mp4`
biçimini (protokolsüz dış adres) kabul ediyordu.

- **Etki:** Labı yazan biri bu adresi girerse, kartı açan her öğrencinin tarayıcısı o siteye
  istek atar. Öğrencinin IP'si dışarı gider ve "lablar gerçek ağ isteği yapmaz" kuralı
  çiğnenir. Yalnızca yönetim ekibi yazabildiği için olasılık düşük.
- **Düzeltme:** `//` ile başlayan adres reddedilir (`lib/lab/content.ts`). Canlıda video
  kartlı lab yok; etkilenen içerik yok.
- **Regresyon testi:** `tests/unit/lab.test.ts`, "eğitim videosu yalnızca sitenin kendi dosyası…"
- **Faz 6:** CSP'de `media-src 'self'` bunu tarayıcıda da kapatır (tur 1, D2).

### D6 — Yönetim eylemlerinde evet/hayır değerlerinin türü denetlenmiyordu (düşük) — düzeltildi

`setLabVisibility(visible)` ve kaydetme ve yayınlamadaki `force` yalnızca doğruluk değerine
bakıyordu (`"false"` metni "evet" sayılıyordu). Yalnızca yöneticiler çağırabilir. Artık
yalnızca gerçek `true` "evet" sayılır. (`lib/admin/lab-actions.ts`)

### D7 — Örnek labların cevapları yanlışlıkla tarayıcıya gidebilirdi (düşük, önlem) — eklendi

`lib/admin/drafts.ts` örnek labları (yayındaki labların doğru cevaplarıyla) derlemeye gömer.
Bugün yalnızca sunucuda kullanılıyor. Dosyaya `import "server-only"` eklendi: bir tarayıcı
bileşeni onu eklerse derleme durur. Birim testleri için boş bir yerine geçen modül eklendi
(`vitest.config.mts`).

### Sonraya kalanlar (düşük, yalnızca yönetim)

- **D8 — Okunamayan taslak boş açılır.** Şema sıkılaşınca (O2 gibi) eski bir taslak artık
  okunamıyorsa, düzenleme sayfası onu boş taslak olarak açar ve kaydedince eskisinin üstüne
  yazılır. Canlıda etkilenen lab yok. Öneri: "taslak okunamadı" uyarısı ve kaydetmeyi durdurmak.
- **D9 — Aynı anda düzenleme.** Üst üste yazma denetimi tek bir yazımda yapılmıyor ve listedeki
  "Yayınla" taslağın özetini göndermiyor. İki kişilik ekipte olasılığı düşük. Öneri: sayısal
  taslak sürümü ve koşullu yazım.
- **D10 — Mahallede tek eğitim labı.** Kural kodda var, veritabanında yok. Aynı anda iki
  "Yeni lab" ile iki eğitim labı açılabilir. Öneri: kısmi tekil indeks.

### Bilgi

- **B1 — Eğitim labının bitişini tarayıcı söyler.** Kartlar oynanmadan "son kart" kaydedilerek
  eğitim bitmiş sayılabilir. Kazanç küçük: senaryolar açılır, 100 puan. Faz 4'te ödev takibi
  için kart cevaplarının sunucuda tutulması değerlendirilebilir.
- **B2 — İki sekmede toplu olaylar.** Aynı deneme iki sekmede açıkken ikinci sekmenin bazı
  kararları (aynı sıra numarası) sessizce atlanabilir. Güvenlik değil, sağlamlık. Öneri:
  çakışmada oynatıcı sayfayı yeniden yüklesin.
- **B3 — Yönetim panelinin varlığı.** Yetkisi olmayan "Bu sayfa yok" görür ama sayfa akış içinde
  çizildiği için durum kodu 200'dür. Zararsız.
- **B4 — Yöneticilik listeye bağlı.** `ADMIN_EMAILS`'teki adres panele her girişte yeniden
  yönetici olur. İleride "yöneticilikten çıkar" eklenirse adres listeden de silinmeli. Askıya
  alma bugün de çalışıyor (askıdaki hesap oturum açamaz).
- **B5 — Listedeki adresin önceden alınması.** Biri `ADMIN_EMAILS`'teki bir adresle doğrulamadan
  kayıt olursa, adresin sahibi "adres kullanılamıyor" görür. Sahibi şifre sıfırlamayla hesabı
  geri alır ve öteki oturumlar kapanır. Tur 1'deki D3 ile aynı konu (Faz 6).

---

## Bu turda yapılan değişiklikler

- `lib/account/actions.ts`, `lib/auth.ts`: Y1 düzeltmesi.
- `lib/lab/actions.ts`: O1 düzeltmesi ve sağlamlaştırma.
- `lib/lab/content.ts`: O2 düzeltmesi.
- `lib/admin/lab-actions.ts`: D6. `lib/admin/drafts.ts`, `vitest.config.mts`,
  `tests/unit/stubs/server-only.ts`: D7.
- Yeni testler: `tests/e2e/account-race.spec.ts` (Y1), `tests/e2e/lab-security.spec.ts`
  (sızıntı ve O1), `tests/unit/lab.test.ts` (O2).

## Faz 6'ya eklenen öneriler

1. CSP'de `media-src 'self'` (O2'nin tarayıcı tarafı; tur 1 D2 ile birlikte).
2. Yönetimde okunamayan taslak uyarısı, koşullu kaydetme, tek eğitim labı indeksi (D8–D10).
3. Eğitim ilerlemesinin sunucuda doğrulanması (B1, Faz 4 ödevleriyle birlikte).
