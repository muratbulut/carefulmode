# Güvenlik turu 4 — Faz 5

- **Tarih:** 12 Ekim 2026
- **Kapsam:** Faz 5 (yönetim paneli), `phase-5` dalına girmiş olan bölümler:
  - izinler ve menü (`lib/admin/access.ts`, `lib/admin/menu.ts`, `app/yonetim/layout.tsx`, `lib/admin/metadata.ts`),
  - Günün ipucu: havuz, sıradaki günler, yönetim ekranı, öğrencinin "Neden?"i ve Meraklı rozeti,
  - Gündem: haber yazma, planlama, geri alma, herkese açık gündem ve haber sayfası, okuma sayısı,
  - Özet, Canlı nabız ve Kayıt defteri,
  - SSS ve Öğretmenler için sayfaları,
  - Öğretmen talepleri ekranı (`/yonetim/talepler`): onay, ret, bilgi iste, geri al ve belgeyi görme,
  - Kullanıcılar: öğrenci listesi ve kısa profil, öğretmenler, "Öğretmenin gözünden bak", hatırlatma, öğretmenlikten çıkarma,
  - Yönetim ekibi (ekibe ekleme, izinler, çıkarma, geri al) ve okullar (okul ekle, okul sorumlusu).
- **Birleştirme:** `phase-5` üç kez birleştirildi (öğretmen talepleri; kullanıcılar, ekip ve okullar; en son Faz 4'ün son hali ve güvenlik turu 3 ile `2a439d4`). Çakışma çıkmadı; son birleştirmeden sonra bütün denetimler yeniden çalıştırıldı.
- **Nasıl yapıldı:**
  - Kod incelemesi, ardından yerel **üretim derlemesine** (port 3114) ve yerel PostgreSQL'e karşı deneme.
  - Sunucu eylemleri arayüz kullanılmadan, elle hazırlanmış isteklerle çağrıldı. Eylemin kimliği derlemenin eylem listesinden okundu (`.next/server/server-reference-manifest.json`).
  - Deneyen hesaplar: ekipte olmayan öğrenci, yalnızca İpucu izni olan sorumlu, Roller dışındaki bütün izinleri olan yetişkin sorumlu, ekipteki 14 yaşında ve 18 yaşında öğrenci, yönetici, oturumsuz istek.
  - Toplu ekranlarda yalnızca görünen metne değil, sayfanın ham HTML'ine ve React verisine (RSC) bakıldı.
  - Canlı siteye karşı **hiçbir** istek yapılmadı.
  - Bulgular düzeltmeden önce kendi kopyamızda kanıtlandı. Regresyon testlerinin eski kodda başarısız olduğu görüldü.
- **Sonuç:** Üç **orta** ve dört **düşük** bulgu bulundu, hepsi düzeltildi (biri, D22, `phase-5`'te aynı anda ayrıca düzeltildi). İzin denetimi, 404 davranışı, ekip izinlerinin kuralları, kayıt defterinin değişmezliği, haber ve ipucu metinlerinde XSS koruması, taslak haberlerin gizliliği ve toplu ekranlardaki gizlilik kuralları çalışıyor.
- **Şema:** Şema değişikliği yok, migration eklenmedi.

---

## Doğrulanan korumalar (çalışıyor)

| Alan | Durum | Kanıt |
| --- | --- | --- |
| Eylemlerde izin | Her yönetim eylemi (lab, ipucu, gündem, talepler, ekip, kullanıcılar, okullar) izni kendisi denetler. Kişinin rolü, askısı ve izinleri her istekte veritabanından okunur (`getPermittedAccess`, `requirePermission`). Sayfa kapısına güvenilmez. | Elle istekle deneme. **Yeni e2e:** `security-phase-5.spec.ts`, "eylemler izni kendisi denetler…" |
| İzinsiz sayfa | İzni olmayan "Bu sayfa yok" görür; sayfa başlığı da "Sayfa bulunamadı" olur (sayfanın varlığı başlıktan anlaşılmaz). Menüde izni olmayan sayfa görünmez. | `lib/admin/metadata.ts`, `lib/admin/menu.ts`; mevcut e2e (`admin-overview`, `tips`, `news`, `admin-applications`) |
| ROLES ve öğrenci hesabı | ROLES yalnızca yöneticidedir, izin listesinden verilemez. Ekipteki öğrenci hesabı veritabanında başka izin satırı olsa bile yalnızca İpucu ve Gündem'i kullanır. D20 ile sınır yaşı düzeltildi. | `effectivePermissions`, `allowedPermissions`; yeni birim testi ve e2e |
| Özet ve Canlı nabız herkese açık | Ekipteki her üye iki sayfayı da görür; iş kartları ve son kayıtlar izne göre gelir. | Mevcut e2e: "yalnızca ipucu izni olan sorumlu özeti ve canlı nabzı görür…" |
| Toplu ekranlarda gizlilik | Özet ve Canlı nabızda öğrencinin adı, e-postası ve kimliği yok: ne görünen metinde ne ham HTML'de ne React verisinde. Akış satırlarının kimliği, süreç başına rastgele anahtarla üretilen HMAC'tir; kullanıcı ya da deneme kimliği tarayıcıya gitmez. Öğrenci adı yalnızca izinli ekranlarda kısaltılmış ("Ayşe Y.") ya da "bir öğrenci" olarak geçer. | `lib/admin/pulse.ts` (`feedId`); mevcut e2e: "özet ve canlı nabız sayfalarında öğrencinin adı, e-postası ve kimliği geçmez" |
| Kayıt defteri değişmez | `AuditLog_immutable` (UPDATE/DELETE öncesi) ve `AuditLog_no_truncate` tetikleyicileri yerel veritabanında var. Kodda `auditLog.update`, `auditLog.delete`, `updateMany`, `deleteMany`, `upsert` ya da tabloyu değiştiren ham SQL yok; yalnızca `create` (`writeAudit`). Kayıt defteri sayfası yalnızca okur. | `pg_trigger` sorgusu; kod araması |
| Bakışların kaydı | Belgeye her bakış `application.document_viewed` olarak yazılır (aynı kişi aynı belgeye 60 saniye içinde yeniden bakarsa ikinci satır yazılmaz). D22 ile bu satırlar Kayıt defterinin "Bakış" süzgecinde görünür. | `app/yonetim/talepler/[talep]/belge/route.ts`; mevcut e2e ve yeni birim testi |
| XSS: ipucu ve haber | `dangerouslySetInnerHTML` yalnızca iki yerde: tema betiği (sabit metin) ve SSS'nin JSON-LD'si (`<` kaçışlanır). İpucu ve haber metni React metni olarak basılır. `rich()` yalnızca React öğesi üretir, HTML ayrıştırmaz. İçerikten `href` kurulmaz; tek dış bağlantı haberin kaynağıdır. | Kod araması; `lib/i18n`, `components/news`, `components/home/TipCard.tsx` |
| Haber kaynağı bağlantısı | Yalnızca `https:`, güvenilir alan adı listesi, kullanıcı adı / şifre ve port yok. Kural hem sunucuda (kaydetme ve yayınlama) hem tarayıcıda. Bağlantı "Siteden ayrılıyorsun" penceresiyle açılır: `target="_blank"`, `rel="noopener noreferrer nofollow"`, `referrerPolicy="no-referrer"`. `javascript:`, `data:`, `http:` ve `//` reddedilir. | `checkSourceUrl` (`lib/news/content.ts`), `LeaveSiteButton`; mevcut birim testleri |
| Taslak ve planlı haber | Herkese açık her sorgu `liveWhere` kullanır (durum yayında ya da planlı ve yayın zamanı geçmiş). Taslak, planlı ve arşivli haber: `/gundem/<adres>` 404, gündem listesinde, tanıtım sayfasında, öğrencinin ana sayfasında ve sayfa başlığında yok. Taslak adresleri `_taslak-` önekiyle ayrılır. Site haritası yok. | Mevcut e2e (`news.spec.ts`); yeni e2e: taslağın başlığı `/gundem` ve `/` HTML'inde yok |
| İpucu havuzu | Bugünün ipucu yalnızca havuzdaki ipuçlarından seçilir; taslak ve arşivli ipucu hiçbir zaman seçilmez. Bugün gösterilen ipucu kilitlidir, değiştirilemez. | `pickForDay`, `todayLocked` (`lib/tips/`); mevcut birim testleri |
| Meraklı rozeti | "Neden?" yalnızca bugünün ipucu için, günde bir kez yazılır; gün sunucunun saatinden gelir. Rozet 7 farklı gün ister, tekrar basmak bir şey değiştirmez. | `markTipReason`; mevcut e2e |
| Okuma sayısı | Kimin okuduğu saklanmaz, çerez yazılmaz. Sayaç anahtarı IP ve haberin gizli anahtarla özetidir; satır bir gün sonra silinir. O1 ile IPv6 ağında adres değiştirmek okuma sayısını artırmaz. | Yeni e2e: yanıtta `set-cookie` yok |
| Önbellek (cacheComponents) | Kodda `'use cache'` yok. `cache()` yalnızca istek içinde geçerli (React `cache`). Yönetim sayfalarının statik kabuğunda yalnızca "yükleniyor" var; kişiye ya da izne bağlı veri `<Suspense>` içinde, istek başına okunur. Belge adresi her istekte oturumu okur ve `Cache-Control: no-store` döner. | Kod araması; derleme çıktısı |
| Girdi doğrulama | İpucu, gündem ve talep eylemlerinde Zod (`strictObject`, uzunluk sınırları), lab eylemlerinde tür denetimi. Ham SQL'lerin hepsi parametreli (`$queryRaw` şablonu; `Unsafe` yok). Kayıt defteri aramasında `%` ve `_` kaçışlanır. | Kod incelemesi |
| IDOR | Kimlik alan eylemler hedefin varlığını denetler ("bulunamadı"). İpucu geri alma yalnızca kişinin kendi işlemini geri alır. Talep eylemleri: kimse kendi talebine karar veremez; "Bu okul mu?" ile seçilen okul talebin il ve ilçesinde olmalı; geri alma yalnızca kişinin kendi kararını geri alır. | `lib/tips/actions.ts`, `lib/admin/application-actions.ts`, `lib/teacher/decide.ts`; mevcut e2e |
| Talep belgesi | Yalnızca APPLICATIONS izni olana; yetkisiz istek, olmayan talep ve olmayan belge aynı boş 404'ü alır. Yanıt: kayıtlı tür, `nosniff`, `no-store`, `Cross-Origin-Resource-Policy: same-origin` ve `Content-Security-Policy: sandbox; default-src 'none'…`. Bu yüzden `%PDF-` ile başlayan bir HTML (tur 3, polyglot) tarayıcıda betik çalıştıramaz. Belge karar kesinleşince silinir. | `lib/admin/application-document.ts`; mevcut e2e |
| Talep ekranı | Başvuranın hesap e-postası okunmaz; yalnızca doğrulama için verdiği kurumsal e-posta görünür. Belgenin baytları sayfaya gelmez. Okul araması dış bağlantısı `rel="noopener noreferrer"` ile açılır (talep adresi Google'a gitmez). | `lib/admin/applications.ts`, `ApplicationDetail.tsx` |
| Ekip izinleri | Ekip, okul ve kullanıcı eylemleri yalnızca yöneticiye açık (ROLES yalnızca yöneticide). ROLES ne formdan ne elle hazırlanmış istekle verilebilir. Öğrenci hesabına yalnızca İpucu ve Gündem verilir, yönetici yapılamaz; veritabanında başka izin satırı olsa da çalışmaz. Yönetici kendini çıkaramaz, kendi rolünü değiştiremez. Son aktif yönetici ve `ADMIN_EMAILS`'teki yönetici yöneticilikten çıkarılamaz. Ekip değişiklikleri veritabanı kilidiyle sırayla yapılır (iki yönetici aynı anda birbirini çıkaramaz). | `lib/admin/team-actions.ts`, `team-rules.ts` (`grantRefusal`), `team.ts` (`lockTeam`, `otherActiveAdmins`); mevcut e2e (`admin-team.spec.ts`) ve yeni e2e (öğrenci hesabı) |
| Geri al | Ekip, okul, öğretmenlikten çıkarma, talep, ipucu ve lab geri alması yalnızca işlemi yapan kişiye ve 30 saniye içinde çalışır. Aynı işlem iki kez geri alınamaz (son kayıt artık geri almanın kaydıdır). Arada başka değişiklik olduysa "çok geç" döner. | `team-rules.ts` (`undoBatch`), `user-actions.ts` (`undoRemoveTeacher`), `lib/teacher/decide.ts` |
| Öğrenci profiline bakış | Kısa profil yalnızca `openStudentProfile` eyleminden gelir; sayfa onu sunucuda çizmez. Her açılış kayıt defterine `student.profile_viewed` yazar; satır yazılamazsa profil dönmez. Profilde "Ad S." var; e-posta, soyadı, puan ve rapor yok. "Öğretmenin gözünden" de her açılışta `teacher.viewed_as` yazar; sınıf kodu ve öğrenci adı gitmez. | `lib/admin/user-actions.ts`, `lib/admin/users.ts`; mevcut e2e (`admin-users.spec.ts`) |
| Hesap e-postası | Öğretmenin e-postası yalnızca Kullanıcılar sayfasında (yalnızca yönetici) ve kişi aramasında gider. Roller izni olmayan, öbür bütün izinleri olan ekip üyesinin Özet, Canlı nabız, Talepler ve Kayıt defteri sayfalarında ne başvuranın ne öğretmenin hesap e-postası var (HTML ve React verisi). | **Yeni e2e:** "hesap e-postası Roller izni olmayan ekip üyesine…" |
| Kişi araması | Kullanıcı başına 10 dakikada 300 arama, en az 3 harf, en fazla 8 sonuç. LIKE jokerleri (`%`, `_`, `\`) aramadan atılır ya da kaçışlanır. Dönen alanlar: kimlik, ad, e-posta, avatar, tür, verilebilecek izinler. O3'ten sonra öğrenci hesabı "Ad S." ve maskeli e-postayla döner. | `team-rules.ts` (`cleanQuery`), `users-model.ts` (`likePattern`) |
| Okul işlemleri | Okul satırı işlem boyunca kilitlenir. Okul sorumlusu yalnızca öğretmen ya da yönetici olabilir; öğrenci hesabı, yetişkin üye, başka okulun öğretmeni ya da sorumlusu olamaz (elle hazırlanmış istekle de). Okul eklemenin geri alınması, okula öğretmen ya da talep bağlandıysa okulu silmez. | `lib/admin/school-admin-actions.ts`; mevcut e2e |
| Ekip mailleri | Bütün değişkenler HTML'de kaçışlanır. "Ekibe eklendin" ve "okul sorumlusu oldun" mailleri geri al süresinden sonra, işlem hâlâ geçerliyse gider. Hatırlatma maili aynı öğretmene 24 saatte bir (okul sorumlusununkiyle ortak kilit). | `lib/mail/team-mail.ts`, `lib/admin/team.ts`, `lib/admin/user-actions.ts` |

---

## Bulgular

### O1 — IPv6'da adres değiştirerek okuma sayısı şişirilebiliyordu; IP istek sınırları da aşılabiliyordu (orta) — düzeltildi

Okuma sayacı ve bütün IP istek sınırları (kayıt, giriş, kod gönderme ve doğrulama, sınıfa katılma) anahtar olarak IP adresinin tamamını kullanıyordu.

- **Etki:**
  - IPv6'da bir ev ya da sunucu genellikle bütün bir /64 ağı alır (2⁶⁴ adres). Adresi değiştirmek bedavadır.
  - Okuma sayısı: her yeni adres yeni bir okuma sayılıyordu. "Bu haberi N kişi okudu" sayısı betikle istenen kadar artırılabiliyordu.
  - IP istek sınırları: aynı yöntemle kayıt, giriş ve kod denemelerinin IP sınırı aşılabiliyordu (hesap ve kullanıcı başına sınırlar ayrıca çalışıyordu).
- **Kanıt:** Aynı /64 ağından dört farklı adresle (`X-Forwarded-For`) aynı habere dört okuma: sayı 4 oldu.
- **Düzeltme:**
  - `lib/request.ts`: IPv6 adresi /64 ağına indirilir. IPv6 içinde yazılmış IPv4 (`::ffff:a.b.c.d`) IPv4 sayılır. Köşeli parantez, `%zone` ve kısaltma (`::`) okunur. Okunamayan değer olduğu gibi kalır.
  - Anahtar bütün IP sınırlarında aynı fonksiyondan geldiği için hepsi birlikte düzeldi.
  - Okuma anahtarının özetine bir etiket eklendi (`news-read`). Oturum imzasıyla aynı gizli anahtar kullanıldığı için iki kullanım birbirinden ayrılır.
- **Regresyon testi:**
  - `tests/unit/request.test.ts`: aynı /64'teki farklı yazımlar aynı anahtarı alır, başka /64 ayrı sayılır, IPv4 içeren IPv6 IPv4 sayılır.
  - `tests/e2e/security-phase-5.spec.ts`, "gündem okuma sayısı ucuzca şişirilemez…": aynı /64'ten dört okuma ve aynı IPv4'ün iki yazımı birer okuma sayılır, yanıtta çerez yok, taslak habere okuma sayılmaz.

### O2 — Özet ve Canlı nabız lab cevabını lab izni olmayan ekip üyesine gösteriyordu (orta) — düzeltildi

Özet ve Canlı nabızdaki "en çok kaçırılan sahte öğe" satırı, labın hangi mailinin ya da mesajının sahte olduğunu adıyla söyler (ör. `sahte "Kargo Takip" maili`). Bu, labın cevabıdır.

- **Etki:** İki sayfa da ekipteki herkese açık. Yalnızca İpucu ya da Gündem izni olan üye, ekipteki öğrenci hesapları dahil, yayındaki labların cevabını görebiliyordu. Öğrenci sonra o labı bilerek oynayabilir. "Doğru kararlar tarayıcıya hiç gönderilmez" kuralı lab izni olmayan herkes için geçerli olmalı.
- **Kanıt:** Bir labda aynı sahte öğeyi kaçıran 40 deneme eklendi. Yalnızca İpucu izni olan 14 yaşındaki ekip üyesinin `/yonetim` ve `/yonetim/canli-nabiz` HTML'inde "Kargo Takip" vardı.
- **Düzeltme:** Satır yalnızca lab izni (LAB_EDITING ya da LAB_PUBLISHING) olan üyeye hesaplanır ve gönderilir. Lab izni olmayan üye için sorgu hiç çalışmaz, satır yerine boş kalır. Mahalle dağılımı ve sayılar herkese açık kalır. (`lib/admin/overview.ts` `getTraps`, `lib/admin/pulse.ts`, `app/yonetim/canli-nabiz/page.tsx`)
- **Regresyon testi:** `tests/e2e/security-phase-5.spec.ts`, "özet ve canlı nabızda en çok kaçırılan sahte öğe (lab cevabı) lab izni olmayan ekip üyesine gitmez": yönetici satırı görür; İpucu izni olan öğrencinin iki sayfasının ham HTML'inde ne öğenin adı ne satırın başlığı var.

### O3 — Kişi aramaları öğrenci hesabının tam adını ve e-postasını gösteriyordu (orta) — düzeltildi

"Ekibe kişi ekle" ve "Okul sorumlusu" pencerelerindeki arama, adda ya da e-postada geçen her metinle bütün hesapları arıyor ve tam adı ve e-postayı döndürüyordu. Öğrenci hesapları (18 yaşından küçük olabilecek öğrenciler) da buna dahildi.

- **Etki:**
  - Tasarım kararı (Tur 4, öğrenci profili): yönetimde öğrencinin e-postası ve soyadı görünmez, ad "Ad S." olur. Öğrenciler sekmesi ve kısa profil buna uyuyor; bu iki arama uymuyordu. Ekip penceresinin tasarımında da öğrenci "Kerem T." diye görünüyor.
  - Yönetici, soyadıyla ya da e-postanın bir parçasıyla (ör. `@gmail`) arayarak öğrencilerin tam adını ve e-postasını sekizer sekizer listeleyebiliyordu (10 dakikada 300 arama). Aramalar kayıt defterine yazılmaz.
  - Okul sorumlusu penceresinde öğrenci zaten seçilemez; yalnızca "neden olamaz" göstermek için listeleniyordu.
  - Yalnızca yönetici yapabildiği için orta.
- **Kanıt:** Düzeltmeden önceki derlemede 13 yaşındaki öğrenci hesabı soyadıyla arandı; iki pencerede de kimliği, tam adı ve e-postası döndü (yeni e2e eski kodda başarısız oldu).
- **Düzeltme:**
  - Öğrenci hesabı yalnızca görünen adıyla ("Ayşe Y.", Öğrenciler sekmesiyle aynı kural) ya da e-postasının tamamıyla bulunur. Soyadı ya da e-postanın bir parçası onu bulmaz.
  - Sonuçta ad "Ad S." olur. E-posta maskelidir (`ke•••@okulmail.com`); yönetici adresin tamamını yazdıysa açıktır (zaten biliyor).
  - Yetişkin üye, öğretmen ve yönetici değişmedi (tasarımdaki gibi ad ve e-postayla).
  - Tasarımın ekip penceresinde öğrencinin e-postası açık yazıyor; burada maskelendi (aşağıda, "Karar bekleyenler").
  - Ortak kural `lib/admin/person-search.ts` (`personMatchWhere`, `studentKeySql`) ve `lib/admin/users-model.ts` (`personShown`, `maskEmail`). "Öğrenci hesabı" sınırı tek yerden gelir: `minorBirthYearFloor` (`lib/admin/access.ts`).
  - Mevcut iki e2e testi öğrenciyi artık e-postasıyla arar ve "Ad S." ile seçer (`admin-team.spec.ts`).
- **Regresyon testi:**
  - `tests/e2e/security-phase-5.spec.ts`, "kişi aramaları öğrenci hesabının soyadını ve e-postasını açığa çıkarmaz…": iki pencerede soyadıyla ve e-postanın parçasıyla öğrenci çıkmaz (yetişkin üye çıkar); adıyla "Ad S." ve maskeli e-posta; e-postanın tamamıyla e-posta açık, soyadı yine yok.
  - `tests/unit/admin.test.ts`, "kişi aramasında öğrenci hesabı".

### D19 — Lab yönetimi eylemlerinde istek sınırı yoktu (düşük) — düzeltildi

Lab eylemleri (aç, kaydet, yayınla, geri al, gizle, sırala) her çağrıda silinemeyen kayıt defterine bir satır yazar, ama istek sınırı yoktu. İpucu, gündem, talep, ekip, kullanıcı ve okul eylemleri ise öğretmenin sınıf işleriyle aynı sayacı (`classroomActions`) paylaşıyordu: yönetici aynı zamanda öğretmense iki iş birbirinin sınırını tüketiyordu.

- **Etki:** Lab izni olan bir hesap (ya da çalınmış oturumu) betikle kayıt defterini sınırsız satırla doldurabilirdi. Defter silinemediği için bu kalıcıdır ve gerçek kayıtları arar.
- **Kanıt:** 130 `saveLabDraft` çağrısının 130'u geçti, kayıt defterine 130 satır yazıldı.
- **Düzeltme:**
  - Yönetimin yazma işleri için ayrı bir sınır: `rateRules.adminActions` (kişi başına 10 dakikada 120).
  - Lab, ipucu, gündem, talep, ekip, kullanıcı (öğrenci profiline bakış dahil) ve okul eylemleri bu sınırı kullanır. Kişi araması kendi sınırında kalır (10 dakikada 300). Sınır, hedef aranmadan önce düşer: olmayan kimlikle de deneme sayılır.
  - Arayüzde "Çok hızlı işlem yaptın. Biraz bekleyip tekrar dene." uyarısı (`admin.errors.rateLimited`, `admin.newLab.errors.rateLimited`).
  - (`lib/rate-limit.ts`, `lib/admin/lab-actions.ts`, `lib/tips/actions.ts`, `lib/news/actions.ts`, `lib/admin/application-actions.ts`, `lib/admin/team-actions.ts`, `lib/admin/user-actions.ts`, `lib/admin/school-admin-actions.ts`)
- **Regresyon testi:** `tests/e2e/security-phase-5.spec.ts`, "yönetimdeki yazma eylemleri (lab, ipucu, gündem, talepler, ekip, kullanıcılar, okullar) kullanıcı başına istek sınırına tabidir": sayaç doluyken on dört eylemin hepsi `rateLimited` alır. Eski kodda hem lab eylemi hem ekip eylemi `notFound` aldı.

### D20 — Bu yıl 18'ini dolduran öğrenci ekipte "yetişkin" sayılıyordu (düşük) — düzeltildi

Ekipteki öğrenci hesabının yalnızca İpucu ve Gündem kullanabilmesi kuralı, yaşı `isMinor` ile hesaplıyordu. `isMinor` doğum yılından "bu yıl 18'i doldurdu" sonucuna varır, ama doğum günü henüz gelmemiş olabilir.

- **Etki:** Doğum yılı "bu yıl − 18" olan öğrenci 17 yaşında olabilir. Böyle bir hesaba izin listesinden (ya da veritabanında) lab, kayıt defteri veya talep izni verilmişse bu izinler çalışıyordu.
- **Kanıt:** Doğum yılı "bu yıl − 18" olan ve LAB_EDITING izni olan öğrenci `/yonetim/lablar`'ı açtı.
- **Düzeltme:** `mightBeMinor`: doğum yılına göre 18 yaşından küçük **olabilecek** her öğrenci öğrenci hesabıdır. Doğum yılı bilinmiyorsa da öğrenci hesabıdır (değişmedi). Kayıttaki veli onayı kutusu kendi kuralıyla (`isMinor`) kaldı. (`lib/admin/access.ts`)
- **Regresyon testi:**
  - `tests/unit/admin.test.ts`, "bu yıl 18'ini dolduran öğrenci de öğrenci hesabıdır…"
  - `tests/e2e/security-phase-5.spec.ts`, "ekipteki öğrenci hesabı veritabanında başka izin satırı olsa da…": lab, kayıt defteri, talepler ve kullanıcılar 404, lab ve talep eylemleri "yetki yok", ipucu açılır.

### D21 — Yönetimin birim testlerinin çoğu Faz 5'te silinmişti (düşük, test kapsamı) — düzeltildi

"Faz 5 temeli" commit'i (`08928f6`) `tests/unit/admin.test.ts`'ten 18 testi sildi: `ADMIN_EMAILS`, "Öğrenci gibi dene", lab içeriği denetimi (cevapların tarayıcıya gitmemesi dahil), taslak ve yayına hazırlık, lab düzenleme formu yardımcıları. Kodları değişmemişti; testler kazayla gitmişti.

- **Etki:** Tur 2'de doğrulanan lab güvenliği kurallarının bir kısmı birim testiyle korunmuyordu.
- **Düzeltme:** Testler `08928f6^`'deki halleriyle geri getirildi; hepsi değişiklik olmadan geçiyor.

### D22 — Belgeye bakış kaydı Kayıt defterinin "Bakış" süzgecinde görünmüyordu; dal derlenmiyordu (düşük) — düzeltildi (`phase-5`'te)

Öğretmen talepleri `phase-5`'e girince yeni kayıt adı `application.document_viewed` geldi, ama Kayıt defteri (aynı fazda ayrı yapıldı) bu adı tanımıyordu.

- **Etki:**
  - `phase-5` dalında `npm run typecheck` başarısızdı (cümle listesinde ad eksikti); bu haliyle üretim derlemesi de olmazdı.
  - Kayıt defterinin tür süzgeci adın önekine baktığı için belgeye bakışlar "Talep" altında çıkıyor, "Bakış" süzgecinde görünmüyordu. Kişisel veriye kimin baktığını "Bakış" süzgeciyle arayan kişi belge bakışlarını kaçırırdı.
- **Düzeltme:** Bu tur aynı düzeltmeyi yazmıştı. Bu arada `phase-5`'e aynı yaklaşımla `8312685` girdi; birleştirmede o sürüm alındı:
  - Cümle: "Öğretmenlik belgesine bakıldı: {name}" (`lib/admin/audit-sentences.ts`, `lib/i18n/messages/tr.ts`).
  - Tür kuralına "hariç tutulanlar" eklendi: bu ad "Talep"ten çıkar, "Bakış"a girer. Veritabanı süzgeci de aynı kuralı kullanır (`lib/admin/audit-log.ts`, `NOT IN`, parametreli).
- **Regresyon testi:** `tests/unit/audit-log.test.ts`: `phase-5`'teki testin yanına "belgeye bakış Bakış süzgecinde çıkar, Talep süzgecinde çıkmaz" testi eklendi.

### Bilgi

- **B1 — /48 ağı olan biri okuma sayısını yine artırabilir.**
  - O1'den sonra her /64 ağı günde bir okuma sayılır. Bazı servisler (ör. tünel hizmetleri) bir kişiye /48 verir; bu 65 536 /64 ağı demektir.
  - Okuma sayısı yalnızca yönetimdeki gündem listesinde gösterilir, hiçbir karar ona bağlı değil.
  - Daha sıkı yol: okumayı yalnızca giriş yapmış öğrenciden saymak ya da /48'e indirmek. Okul ağlarında /48 başka okulları birleştirebilir; bu yüzden şimdilik /64 seçildi.
- **B2 — IP sınırları IPv6'da artık ağ başına.** Kayıt (saatte 60), giriş (10 dakikada 100), kod ve sınıfa katılma IP sınırları aynı /64'teki cihazları birlikte sayar. IPv4'te NAT arkasındaki bir okul zaten tek IP'dir; sınırlar buna göre geniş seçilmişti. IPv6 kullanan bir okulda kalabalık bir sınıf aynı saatte kayıt olursa sınıra yaklaşabilir. Faz 6 yük testinde bakılmalı.
- **B3 — Yayında bir kez: okuma anahtarı değişti.** Okuma anahtarının özeti değiştiği için yayına girdiği gün, o gün zaten okumuş olanlar bir kez daha sayılabilir. Tek seferlik ve küçük.
- **B4 — Gündem'de geri alma kişiye bağlı değil.** Planlama ve plandan çıkarma geri alması kayıt defterindeki son işleme bakar, işlemi yapanı denetlemez. Gündem izni olan başka bir üye de geri alma süresi içinde geri alabilir. Aynı izinle zaten yapabileceği bir iş; kayıt defterine yazılır. (İpucu geri alması kişiye bağlıdır.)
- **B5 — Özetteki "son değişiklik" satırı taslak lab adını gösterebilir.** Ekipteki herkes görür. Lab adı cevap değildir; O2'deki sahte öğe adından farklı olarak lab oynanmadan önce de katalogda görünür (yayınlanınca). Taslak lab adının ekip içinde görünmesi kabul edilebilir.
- **B6 — İpucu arşivleme ile günün ilk seçimi aynı anda.** Arşivleme, bugünün ipucu henüz seçilip yazılmamışken (günün ilk bakışından önce) ipucunu kilitsiz görür. Günün ilk bakışı aynı anda tam bu ipucunu seçip bugüne yazarsa, o gün arşivdeki ipucu gösterilir. Saniyelik bir pencere; gizlilik ya da güvenlik etkisi yok, ertesi gün kendiliğinden düzelir.
- **B7 — Talep ayrıntısına bakış kayıt defterine yazılmıyor.** Yalnızca belgeye bakış yazılır. Ayrıntıda başvuranın adı, okulu, kurumsal e-postası ve bitirdiği lab sayısı var. Kural "öğrenci profiline bakış" diyor; talep ekranı profil değil ve yalnızca APPLICATIONS iznindekilere açık. Ürün kararı (aşağıda, "Karar bekleyenler").
- **B8 — Öğretmenlik talebinde yaş denetimi yok.** Talep formu (Faz 4) yaşa bakmaz; 18 yaşından küçük bir öğrenci de talep gönderebilir. Talepler ekranında da yaş bilgisi yok. Onay için en az iki kontrol (kurumsal e-posta, belge, okul) gerekiyor, yani bir insan bakıyor. Ürün kararı (aşağıda, "Karar bekleyenler").
- **B9 — PDF önizlemesi gerçek tarayıcıda denenmeli.** Belge `Content-Security-Policy: sandbox` ile gelir (güvenlik için doğru). Bazı tarayıcıların PDF göstericisi sandbox'lı belgede açılmayabilir. Burada kullanılan başsız Chromium PDF göstermediği için bu denenemedi; e2e yalnızca çerçevenin adresini ve başlıkları denetler. Açılmazsa güvenli yol: önizlemede yalnızca görseller, PDF için `Content-Disposition: attachment` (tur 3'ün önerisi).
- **B10 — Geri al, kişinin uygunluğunu yeniden denetlemez.** Okul sorumluluğunu kaldırmanın ya da ekipten çıkarmanın geri alınması kişiyi eski yerine koyar; bu 30 saniye içinde kişi askıya alındıysa ya da öğretmenlikten çıkarıldıysa da. Yalnızca yönetici yapabilir ve pencere kısa. Geri almada da atamadaki denetim çağrılabilir.
- **B11 — Ekipteki öğrencinin tam adı Yönetim ekibi sekmesinde görünür.** Yalnızca yöneticiye ve yalnızca ekibe eklenmiş öğrenci için. Tasarımda ekip kartları kısa adla ("Ayşe K."). İstenirse öğrenci hesabında burada da "Ad S." kullanılabilir.
- **B12 — Yöneticide iki adımlı doğrulama yok.** Tur 4 tasarım notu "ekibe eklenen kişiden ilk girişte iki adımlı doğrulama açması istenir" diyor; kodda yok. Yönetici hesabı her şeyi yapabildiği için Faz 6'da düşünülmeli.
- **B13 — Son yönetici sayımı.** "Son aktif yönetici" denetimi, silinmeyi bekleyen yönetici hesabını da aktif sayar. Kayıt defterinde izi olan hesap zaten silinemediği (tur 3 D14) ve `ADMIN_EMAILS` girişte yeniden yönetici yaptığı için pratikte panel sahipsiz kalmaz.

---

## Bu turda yapılan değişiklikler

- **Kod:**
  - `lib/request.ts`, `lib/news/reads.ts`: O1.
  - `lib/admin/overview.ts`, `lib/admin/pulse.ts`, `app/yonetim/canli-nabiz/page.tsx`: O2.
  - `lib/rate-limit.ts`, `lib/admin/lab-actions.ts`, `lib/tips/actions.ts`, `lib/news/actions.ts`, `lib/admin/application-actions.ts`, `lib/i18n/messages/tr.ts` (uyarı metni): D19.
  - `lib/admin/access.ts`: D20 (ve O3 için `minorBirthYearFloor`).
  - `lib/admin/person-search.ts` (yeni), `lib/admin/users-model.ts`, `lib/admin/users.ts`, `lib/admin/team-actions.ts`, `lib/admin/schools.ts`, `lib/admin/school-admin-actions.ts`: O3.
  - `lib/admin/user-actions.ts`, `lib/admin/team-actions.ts`, `lib/admin/school-admin-actions.ts`: D19 (yönetim sınırı).
  - D22, `phase-5`'teki `8312685` ile geldi.
  - `CLAUDE.md`: kod düzenine `lib/admin/person-search.ts` eklendi.
- **Yeni ve geri gelen testler:**
  - `tests/e2e/security-phase-5.spec.ts` (O1, O2, O3, D19, D20, eylemlerin izin denetimi ve hesap e-postası)
  - `tests/e2e/admin-team.spec.ts`: iki testte öğrenci artık e-postasıyla aranır (O3).
  - `tests/unit/request.test.ts` (O1)
  - `tests/unit/admin.test.ts` (D20, O3; D21 ile geri gelen 18 test)
  - `tests/unit/audit-log.test.ts` (D22)
  - `tests/e2e/support/actions.ts`: sunucu eylemini elle hazırlanmış istekle çağırma yardımcısı (tur 3'teki dosyanın aynısı).
- **Numaralama:** "Y", "O" ve "B" her turda baştan başlar, "D" bütün turlarda sürer. Tur 3 D11–D18'i kullandığı için bu tur D19'dan başlar.

## Karar bekleyenler (Murat)

1. **"En çok kaçırılan" satırı (O2):** yalnızca lab izni olanlar görsün mü? Bu turda öyle yapıldı. Ekipteki herkes görsün denirse satır labın adıyla ama sahte öğenin adı olmadan gösterilebilir.
2. **Kişi aramasında öğrencinin e-postası (O3):** maskeli mi kalsın, tasarımdaki gibi açık mı olsun? Soyadının görünmemesi her iki durumda da kalmalı.
3. **Talep ayrıntısına bakış (B7):** belgeye bakış gibi kayıt defterine yazılsın mı?
4. **Talepte yaş sınırı (B8):** 18 yaşından küçük olabilecek hesabın öğretmenlik talebi formda engellensin mi, en azından talepler ekranında uyarı mı çıksın?
5. **Ekipteki öğrencinin adı (B11):** Yönetim ekibi sekmesinde de "Ad S." olsun mu?
6. **Hesap silme ve anonimleştirme:** aşağıdaki öneri 2.

## Faz 6'ya eklenen öneriler

1. **Okuma sayısı:** gerekirse yalnızca giriş yapmış öğrenciden saymak ya da daha kaba bir ağ anahtarı (B1). IPv6 okul ağlarıyla IP sınırlarının yük testi (B2).
2. **Hesap silme:** kayıt defterinde, ipuçlarında ya da haberlerde izi olan hesap silinemez (bağlar RESTRICT, defter değişmez). Bu artık ekipteki öğrencileri de kapsıyor: ipucu yazmış 14 yaşında bir öğrenci hesabını silemez. Tur 3 D14'teki anonimleştirme önerisi (ad ve e-posta silinir, satır kalır) Faz 5 ya da Faz 6'da yapılmalı.
3. **Belge önizlemesi:** B9 gerçek tarayıcıda denenmeli.
4. **Yönetici hesapları:** iki adımlı doğrulama (B12); geri almada uygunluk denetimi (B10).
5. **Daha önce planlananlar** (burada yeniden tartışılmadı):
   - CSP (tur 1 D2, tur 2 O2),
   - Prisma yama sürümü yükseltmesi,
   - yük testinde Cloudflare gerçek IP denetimi (tur 1 D4).
