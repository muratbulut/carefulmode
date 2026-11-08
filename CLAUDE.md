# CLAUDE.md

Bu dosya, bu depoda çalışan Claude Code için kalıcı talimatlardır. Her işe başlamadan önce okunur.

## Proje

Careful Mode ("Tıklamadan önce bir dur."), ortaokul ve lise öğrencileri için bir dijital güvenlik eğitim platformudur. Öğrenci önce eğitim labında kısa kartlarla öğrenir, sonra senaryo labında (sahte mail kutusu, mesajlaşma) karar verir. Yanlış karar verirse "hacklendin" ekranını görür, sonunda bir rapor alır. Öğretmenler sınıf açar ve ödev verir, yönetim ekibi lab, gündem ve günün ipucunu yönetir.

Murat Bulut'un bitirme projesidir. Ekip iki kişidir; fikirleri ve lab senaryolarını ekip yazar, kodu Claude Code yazar.

## Önce bunları oku

- `docs/guides/getting-started.md`: projeye yeni katılan için tek sayfalık giriş (proje, mahalle ve oda yapısı, çalışma düzeni, oda yazma kuralları).
- `docs/labs/room-plan.md`: bütün odaların planı (5 mahalle, 18 eğitim, 43 senaryo; her odanın hikâyesi, tuzağı, doğru kararı, ana sorusu ve beklediği kod işi). Oda yazılınca ya da plan değişince aynı PR'da güncellenir.
- `docs/labs/room-overview.md`: planın tek sayfalık özeti (mahalle başına odalar, sahneleri, bekledikleri kod işi) ve mahalle paylaşımı (29 Ekim: Hesap Kalesi ve Yazılım Ormanı Dilek, Oltalama Limanı ve Para Çarşısı Murat, Dostluk Parkı beklemede).
- `docs/labs/rooms/`: odaların tam senaryoları (mahalle başına bir klasör, `training/` ve `scenario/`; şablonlar `templates/`). Kimin hangi odayı yazdığı ve odanın durumu mahalle README'sindeki tabloda.
- `docs/platform-document.md`: asıl doküman. Bölüm 3'ün sonundaki tasarım kısımları, Bölüm 4 lab yapısı, Bölüm 6 veri modeli, Bölüm 9 faz planı. Bu dosya Claude Docs'taki asıl dokümanın kopyasıdır; çelişki olursa asıl doküman geçerlidir.
- `docs/design/screen-list.md`: her ekranın son kararı ve hangi tuvalde olduğu.
- `docs/design/round-1-plan.md` ... `round-5-plan.md`: ekran ekran ayrıntılı tasarım kararları (Tur 1-5). Bir ekranı kodlamadan önce ilgili turun notunu oku.
- Görsel son haller tasarım tuvallerinde durur (bağlantılar `docs/design/README.md` içinde).
- `docs/glossary.md`: dokümandaki Türkçe terimlerin koddaki İngilizce adları.
- `docs/guides/new-lab.md`: "Yeni oda nasıl eklenir" kılavuzu. 1. kısım odanın alanları ve formdaki önizleme (oda yazan ekip arkadaşı için), 2. kısım geliştirici için: yeni sahne türü (şablon; dokunulan dosyalar, testler, güvenlik kuralları) ve depodaki oda dosyaları (2.9). Lab motoruna ya da forma dokunmadan önce oku; form, şema ya da puanlama değişirse aynı PR'da güncelle.

## Teknoloji

Next.js (App Router) ve TypeScript, Tailwind CSS ve shadcn/ui, lucide ikonları, PostgreSQL 16 ve Prisma, Better Auth, Zod, Resend, Vitest ve Playwright (yük testi k6), Docker Compose (uygulama, PostgreSQL, Caddy), GitHub Actions.

## Çalışma düzeni

- Her faz ve her büyük iş ayrı bir dalda yapılır ve PR ile `main`'e girer. `main` her zaman çalışır durumdadır.
- Ekip iki kişidir ve ikisi de Claude ile çalışır. Her oda ve her iş kendi dalında yapılır (oda dalı `oda/<oda-adresi>`), dal güncel `main`'den açılır, iş PR ile girer; doğrudan `main`'e yazılmaz. Oda dalında odanın senaryosu (`docs/labs/rooms/`), oda dosyası (`labs/rooms/<mahalle>/<oda-adresi>.json`), odanın gerektirdiği kod ve `docs/labs/room-plan.md`'deki o odanın satırları değişir. Odanın asıl yeri dosyadır, formla yazılmaz (27 Ekim, Murat).
- Fazın "bitti ölçütü" (doküman Bölüm 9) testlerle kanıtlanmadan PR birleştirilmez.
- Öncelik işin hem iyi hem hızlı yapılmasıdır. Tarih için kaliteden ödün verilmez.
- Büyük bir iş (yeni faz, hoca sunumu, isim ve logo, yeni oda yazımı gibi) başlarken Claude, Murat'a yeni bir konu (sohbet) açmayı hatırlatır: uzayan konu her adımda bütün geçmişi yeniden okur ve gereksiz token yakar. Tasarruf kaliteden önce gelmez; iş gerektiriyorsa daha çok ajan çalıştırılır, daha çok görsel açılır. Konu kapanırken `docs/notes/general-status.md` güncellenir (PR ile; iki tarafın Claude'u da oradan devam eder), yeni konu oradan devam eder.

## Adlandırma

- **İngilizce:** commit başlıkları ve içerikleri, PR başlıkları ve açıklamaları (yazmadan önce Murat'a gösterilir, 5 Kasım), dosya ve klasör adları, koddaki bütün adlar (bileşen, değişken, fonksiyon, CSS değişkeni, test kimliği), veritabanı tablo ve alan adları, ortam değişkenleri.
- **Türkçe:** kod yorumları, arayüz metinleri, sayfa adresleri (`/yol-haritasi`, `/giris`; bu yüzden `app/(visitor)/` altındaki sayfa klasörleri Türkçe), test başlıkları, tasarım tahtalarının dosya adları.
- Dokümandaki Türkçe terimin koddaki adı `docs/glossary.md` içindedir; yeni bir kavram eklenince oraya da yazılır.
- Arayüzde "lab" denmez, **oda** denir (Eğitim odası, Senaryo odası; adresler `/odalar`, `/oda/...`). Kodda kavramın adı `lab` kalır; dokümanlarda ve yorumlarda geçen "lab" odadır.
- Arayüz çok dilli olacak (önce İngilizce). Arayüz metinleri dil sözlüğündedir: `lib/i18n/messages/tr.ts`. Bileşene sabit metin yazılmaz; metin sözlüğe eklenir, `getMessages()` ile okunur, yer tutucu `format()`, biçimli parça `rich()` ile doldurulur. ESLint (`react/jsx-no-literals`) ve `tests/unit/i18n.test.tsx` bunu denetler.
- Veritabanından gelecek içerik (lablar, mahalleler, gündem, günün ipucu) dil sözlüğüne girmez; çevirisi gerekince içerikle birlikte veritabanında tutulur. Sayfa adresleri tek yerde: `lib/navigation.ts` (`routes`).

## Kesin kurallar

### Lab güvenliği

- Puan ve geri bildirim sunucuda hesaplanır. Doğru kararlar ve puanlama alanları tarayıcıya hiç gönderilmez.
- Lab sahneleri gerçek ağ isteği yapmaz, gerçek site açmaz, gerçek dosya indirmez.
- Sahte giriş formlarına yazılan metin asla kaydedilmez; sadece "bilgi girildi" olayı kaydedilir.
- Gerçek marka adı, logo ve alan adı kullanılmaz (mail uygulaması kurgusal "Postam").

### Gizlilik

- Toplu ekranlarda (özet paneli, Canlı nabız, Okulum, herkese açık sayfalar) öğrenci adı görünmez, sadece toplam sayılar.
- Öğretmen sınıfındaki öğrencinin sadece bitirdi / bitirmedi bilgisini görür.
- Yönetimin öğrenci profiline bakması kayıt defterine yazılır. Kayıt defteri silinmez ve düzenlenmez.
- Hatalı girişte hangi alanın yanlış olduğu söylenmez. "Kod gönderildi" mesajı hesap olsa da olmasa da aynıdır.

### Tasarım

- Renkler ve yazı tipleri tek yerde, tema değişkenleri olarak tanımlanır. Koyu ve gri tema aynı değişkenlerden çıkar; bileşenlerde sabit renk kodu yazılmaz.
- Her ekran masaüstünde ve 390 px telefonda düzgün çalışır. Telefon hali kendi düzenine sahiptir. Yeni ekran ya da pencere `tests/e2e/mobile-layout.spec.ts` listesine de eklenir (yatay kaydırma, taşma, kesilme, alt menü denetimi; `LAYOUT_SHOTS=<klasör>` görüntü alır, depoya girmez). Dokunma alanları en az 40 px'tir.
- Öğrenciye toplam seviye sayısı hiçbir yerde gösterilmez ("x/10" yok); "Sonraki seviyeye N puan kaldı" yazılır.
- Rozetler kodda tek bir listede tanımlanır, ikonları `public/badges/<code>.svg` dosyalarındadır.
- Ürün adı, isim hâli ("careful m◐de", harfler çizilmiş yol), maskot simgesi ve sitenin adresi tek dosyadan okunur: `lib/brand.tsx`. Maskotun gövdesi `--logo`, göz bebeği `--logo-eye`. Sekme ve telefon simgeleri `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png`, `public/icon-512.png`; paylaşım görseli `app/opengraph-image.png`; mail logosu `public/mail/logo.png` (`lib/mail/logo.ts`). Tasarım işinde Murat tuvalde görüp "PR açabilirsin" demeden PR açılmaz (8 Kasım).
- "Hareketi azalt" ayarı açıksa sarsıntı ve flaş olmaz.

### Lablar

- Lablar kod değil içeriktir: veritabanında durur. Asıl yeri depodaki oda dosyasıdır (`labs/rooms/<mahalle>/<oda-adresi>.json`, 27 Ekim, Murat): PR'la girer, her yayında başlangıç verisi dosya değişince odayı günceller (gerekirse yeni sürüm yayınlar; kurallar `prisma/rooms.ts`), `tests/unit/room-files.test.ts` şemayı, yayına hazırlığı ve 10 puanı denetler. Yönetimdeki form önizleme, deneme ve acil düzeltme içindir; dosyadan gelen odada formdaki değişiklik dosya bir sonraki değiştiğinde gider. `labs/examples/` örnek odalardır (testler, formdaki "Örnek içerikle başla"); seed onları yalnızca yoksa ekler.
- Sahne türleri (şablonlar) kodda durur: içerik şeması `lib/lab/content.ts`, sahneler `components/lab/` (`inbox/`, `messaging/`, `training/`). Yeni oda yeni bir dosyadır, yeni sahne türü eklemek yeni bir şablon gerektirir. Hangi dosyalara dokunulacağı ve hangi testlerin yazılacağı `docs/guides/new-lab.md` 2. kısımda.
- İçerik şeması geriye uyumlu değişir ya da veri migration'ıyla gelir (oda dosyaları da aynı PR'da güncellenir): şemaya uymayan taslak "Taslak okunamadı" olur ve üstüne yazılmaz, şemaya uymayan yayındaki sürüm öğrenciye "bulunamadı" olur. Taslak yazan her eylem `Lab.draftRevision` ile koşullu yazar.

## Next.js 16 uyarısı

Bu projedeki Next.js (16.4) eğitim verindeki sürümden farklıdır. Kod yazmadan önce `AGENTS.md`'ye ve `node_modules/next/dist/docs/` içindeki ilgili rehbere bak. Özellikle:

- `cacheComponents` açık: `export const dynamic` / `revalidate` yok. İstek başına çalışması gereken kod `await connection()` ya da `<Suspense>` ister; derleme sırasında `new Date()` ve veritabanı sorgusu sayfayı statik yapamaz.
- `middleware.ts` yerine `proxy.ts`. `next lint` yok, `eslint .` var. `error.tsx` `retry` alır.
- Tema `<html data-theme>` üzerinden gelir ve kök yerleşim statik kalır; temayı sunucuda çerezden okuma (bütün siteyi dinamik yapar). Ayrıntı: `lib/theme.ts`.

## Kod düzeni

- `app/(visitor)/`: ziyaretçi sayfaları ve profil (`/profil`); ortak çerçeve `components/visitor/VisitorShell.tsx`. 404 `app/not-found.tsx`.
- `app/(auth)/`: kayıt, giriş, e-posta doğrulama, şifre sıfırlama (`/kayit`, `/giris`, `/dogrula`, `/sifre-sifirla`); çerçeve `components/auth/AuthShell.tsx`.
- Öğrenci sayfaları `app/(visitor)/` altında: ana sayfa (giriş yapmışta `components/home/StudentHome.tsx`), yol haritası ve mahalle (`/yol-haritasi`, `/yol-haritasi/[mahalle]`, `components/roadmap/`), odalar kataloğu (`/odalar`, `components/catalog/`), oda kapağı (`/oda/[oda]`, `components/lab/detail/`). Mahalle durumu (açık, kilitli, sıradaki) tek yerden: `getCity` (`lib/lab/data.ts`). Kilit kuralı `lib/lab/gates.ts`: mahallede birden çok eğitim olabilir; ilki temel eğitim (hep açık), diğerleri ileri eğitim (temelden sonra), her senaryoyu kendi eğitimi açar (`Lab.unlockedById`, boşsa temel).
- Öğretmen, sınıf ve okul (Faz 4): öğretmenlik talebi profilde (`components/profile/TeachingSection.tsx`, `components/profile/teaching/`, `lib/teacher/application*.ts`, belge denetimi `lib/teacher/document.ts`); Sınıflarım ve sınıf detayı (`/siniflarim`, `/siniflarim/[sinif]`, `components/classroom/`, `lib/classroom/teacher*.ts`); öğrencinin sınıfı (profil > Sınıf `components/profile/ClassroomSection.tsx`, ana sayfadaki sınıf ve ödev kutusu `components/home/ClassCard.tsx`, katılma bağlantısı `/katil/[kod]`, `lib/classroom/student*.ts`); Okulum (`/okulum`, `components/school/`, `lib/school/bulletin*.ts`). Öğretmen ve okul sorumlusu erişimi `lib/teacher/access.ts`; sınıf kuralları `lib/classroom/rules.ts`, sınıf ilerlemesi `lib/classroom/progress.ts`, ödevin odaları (seçilenler ve açan eğitimleri) `lib/classroom/homework.ts`; il ve ilçe listesi `lib/school/places.ts`, okul adı kuralları `lib/school/names.ts`. Talep kararları (onay, ret, bilgi iste, okul sorumlusunun görüşü, geri al) tek çekirdekten: `lib/teacher/decide.ts`; mail ve belge silme geri al süresinden sonra (`finalizeDecision`), öğretmen mailleri `lib/mail/teacher-mail.ts`. Kayıt defterine yazma `lib/audit.ts` (`writeAudit`).
- `app/(focus)/`: oda oynatıcısı (`/oda/[oda]/oyna`) ve sonuç raporu (`/oda/[oda]/sonuc/[deneme]`). Odak sayfaları: alt bilgi ve alt menü yok; oynatıcıda üst menü de yok (yalnızca oynatıcının şeridi: Çık ve ilerleme), raporda masaüstünde üst menü var (`oyna/layout.tsx`, `sonuc/layout.tsx`).
- Lab motoru: `lib/lab/` (kilitler ve rota `gates.ts`, içerik şeması `content.ts`, olaylar `events.ts`, puanlama `scoring.ts`, sunucu eylemleri `actions.ts`, tarayıcıya giden içerik `client.ts`, rapor metinleri `report.ts`, bağlantı ve hacklendin hikâyesi `story.ts`) ve `components/lab/` (`frame/` oynatıcı ve görev paneli (satış görevinde sahneyi masaüstünde de telefonun içinde açan `PhoneFrame.tsx`; Mesajlar ve tarayıcı sayfası bu yüzden `lg:`/`sm:` yerine `desk:`/`wide:` kırılımlarını kullanır, `globals.css`), `inbox/` Postam, `messaging/` Mesajlar, `hacked/` alarm ve açıklama, `training/` eğitim kartları, `report/` rapor, `preview/` yönetimdeki önizleme). Oynatıcı sunucuyla `LabDriver` üzerinden konuşur (`driver.ts`); önizleme aynı oynatıcıyı tarayıcıdaki sürücüyle açar, hiçbir şey kaydetmez.
- `components/`: `visitor/` (üst menü `TopNav`, giriş yapmışta avatar menüsü `AccountMenu`, M2 alt menü `BottomNav`, alt bilgi `Footer`), `auth/` (hesap formları, kod kutuları, şifre gücü), `profile/` (profil bölümleri), `legal/` (KVKK, gizlilik, koşullar; çerez bandı yok: yalnızca gerekli çerezler kullanılıyor, 4 Kasım, Murat), `landing/` (tanıtım sayfası; giriş bölümünde altı oda sahnesi her ziyarette karışık sırayla döner: `scenes/HeroScenes.tsx`, sıra ve sayaç `scenes/rotation.ts`, sahneler `scenes/*Scene.tsx` ve kendi `.css` dosyaları (sınıflar `hs-` ile başlar; turbopack kuralı CSS Modules'u düz CSS yapar), Postam sahnesi `PostamScene.tsx`; masaüstünde kahraman ilk ekranı doldurur, sonraki bantlar arasında dengeli boşluk kalır, `landing-band` (`globals.css`) ve belirme `BandReveal.tsx`), `status/` (yükleniyor, boş, hata, bağlantı, bildirim kutusu `Toast`; bekleme işareti `Spinner` maskottur), `mascot/` (maskot: `Mascot.tsx` ruh hâlleri ve evcil tepkiler, stiller `mascot.css` (sınıflar `mc-`); üst menüde gözü fareyi izleyen isim hâli `LiveWordmark`, tanıtım sayfasında dokununca tepki veren ve 1 dakikada uyuyan `HeroMascot`, hesap formlarında e-postayı izleyip şifrede gözünü kapatan `FormMascot`, 0,3 saniyeden uzun sayfa geçişinde ve çıkışta tam ekran örtü `PageOverlay`, 404'te `LostMascot`, oda şeridinde bağlantılara bakan `RoomMascot`; hangi bağlantının tuzak olduğu tarayıcıya gitmediği için maskot her bağlantıya aynı bakar, duygular sunucunun cevabından sonra gelir), `theme/`, `background/` (akan iplikler), `common/`.
- `lib/`: `brand.tsx` (ürün adı ve logo), `i18n/` (dil sözlüğü ve `getMessages`, `format`, `rich`), `theme.ts`, `navigation.ts` (sayfa adresleri ve menü listeleri), `db.ts` (Prisma), `content/` (tanıtım sayfasının sabit içeriği ve yasal metinler), `consent.ts` (çerez seçimi).
- Hesap: `lib/auth.ts` (Better Auth; HTTP uçları kapalı), `lib/session.ts` (oturumu okuma, `requireUser`, `requireVerifiedUser`), `lib/account/` (sunucu eylemleri `actions.ts` ve `profile-actions.ts`, ortak kurallar `shared.ts`), `lib/rate-limit.ts` (istek sınırları, `RateLimit` tablosu), `lib/mail/` (kod maili, öğretmen mailleri), `lib/password-strength.ts`, `lib/avatars.ts`.
- Yönetim paneli: `app/yonetim/` (kapı `layout.tsx`: ekipte olmayan "Bu sayfa yok" görür), `components/admin/`, `lib/admin/`. İzinler tek yerden: `lib/admin/access.ts` (`requirePermission`, `getPermittedAccess`; her sunucu eylemi izni kendisi yeniden sorar), menü `lib/admin/menu.ts`. Ekranlar (Faz 5): Özet (`/yonetim`, `overview*.ts`, `components/admin/overview/`), Canlı nabız (`/yonetim/canli-nabiz`, `pulse*.ts`), Öğretmen talepleri (`/yonetim/talepler`, belge `talepler/[talep]/belge/route.ts`, `application*.ts`, kararlar yine `lib/teacher/decide.ts`'ten), Kullanıcılar (`/yonetim/kullanicilar`: öğrenciler, öğretmenler, yönetim ekibi, okullar; `users*.ts`, `user-actions.ts`, `team*.ts`, `schools.ts`, `school-admin-actions.ts`, `components/admin/users/`; kişi aramalarında öğrenci hesabı kuralı `person-search.ts`), Odalar (`/yonetim/odalar`, `lab-actions.ts`), Günün ipucu (`/yonetim/ipucu`, `lib/tips/`, `components/admin/tips/`), Gündem (`/yonetim/gundem`, `lib/news/`, `components/admin/news/`; kapak görseli `CoverField.tsx`, kurallar `lib/news/cover.ts`, görsel veritabanında `NewsCover`, adresi `/api/kapak/[id]`: yayındaki haberin kapağı herkese açık, taslağınki yalnızca Gündem iznine), Kayıt defteri (`/yonetim/kayit-defteri`, `audit-log.ts`, cümleler `audit-sentences.ts`). Geri al bildirimi `components/admin/UndoToast.tsx`. İlk yöneticiler `ADMIN_EMAILS` ile atanır (GitHub depo değişkeni, `docker/server/README.md`).
- Herkese açık Faz 5 sayfaları: gündem ve haber (`/gundem`, `/gundem/[haber]`, `components/news/`; okuma sayısı `lib/news/reads.ts`, çerez yok), SSS (`/sss`, `components/faq/`), Öğretmenler için (`/ogretmenler`, `components/teachers/`). Günün ipucu öğrencinin ana sayfasında (`components/home/TodayTip.tsx`) ve tanıtım sayfasında (`components/landing/TodayTipBanner.tsx`); havuz boşken `lib/content/landing.ts`'teki sabit ipucu görünür.
- `proxy.ts`: giriş isteyen adresler (`/profil`, `/dogrula`, `/oda/...`, `/yonetim/...`, `/siniflarim/...`, `/okulum`) için hızlı çerez kontrolü; asıl kontrol sayfada, sunucuda yapılır.
- Güvenlik başlıkları ve CSP: `next.config.ts` (her yönergenin gerekçesi yanında; belge adresi kendi sandbox CSP'sini orada alır; eski `/lablar`, `/lab/...` adreslerinin yönlendirmesi de orada). Dış kaynak (yazı tipi, betik, görsel, iframe) eklemek CSP değişikliği ister; ihlali `tests/e2e/csp.spec.ts` yakalar. Zod yalnızca `@/lib/zod`'tan alınır (tarayıcıda `eval` denemesin; ESLint denetler).
- `instrumentation.ts`: sunucu açılınca saatlik temizliği başlatır (`lib/cleanup.ts`: süresi dolan hesap silme istekleri (kalıcı kayıtlarda izi olan hesap silinmez, anonimleştirilir: "Silinmiş kullanıcı", rol `DELETED`), 7 gün doğrulanmamış hesaplar, karar verilmeden 60 günü dolan talep belgeleri, eski oturum, kod ve sayaç satırları, mail ya da belge silmesi kalmış talep kararları).
- Renk ve yazı tipi değişkenleri: `app/globals.css`. Yeni renk gerekirse önce orada iki tema için de tanımla, sonra `bg-...`/`text-...` sınıfıyla kullan.
- `/onizleme`: durum ekranlarının hepsi bir arada (arama motorlarına kapalı). Yalnızca `PREVIEW_PAGE=1` olan sunucuda açılır (yerelde `.env`, uçtan uca testlerde `playwright.config.ts`); canlıda 404 (`proxy.ts`, 4 Kasım, Murat). Yeni ortak bileşen eklenince buraya da koy.
- Bileşen ve dosya adları İngilizce, yorumlar ve arayüz metinleri Türkçe (Adlandırma bölümü).

## Komutlar

```bash
cp .env.example .env          # ilk kurulumda; değerleri düzenle
docker compose up -d db       # sadece veritabanı (yerel geliştirme için)
npm install                   # bağımlılıklar + prisma generate
npm run db:migrate            # şema değişince migration oluştur ve uygula
npm run db:seed               # başlangıç verisi (5 mahalle, örnek lablar)
printf '%s' "$SIFRE" | npm run db:demo -- add   # örnek veri (okullar, sınıflar, öğrenciler...); silmek: npm run db:demo -- remove
npm run dev                   # geliştirme sunucusu: http://localhost:3000

npm run lint                  # ESLint
npm run typecheck             # next typegen + tsc
npm test                      # Vitest birim testleri (tests/unit)
npm run build && npm run test:e2e   # Playwright uçtan uca testleri (tests/e2e), üretim derlemesine karşı
npm run load:smoke            # k6 yük testi, kısa deneme (yerel Docker yığını, sunucu sınırlarıyla)
npm run load:local            # 100 sanal kullanıcı, 10 dakika; ayrıntı tests/load/README.md

docker compose up -d --build  # bütün yığın (kendi başına bir sunucuda): veritabanı, migration, uygulama, Caddy
```

Bu bulut ortamında Playwright tarayıcı indirmez: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e`.

Hesap testleri kod maillerini `MAIL_OUTBOX_DIR` klasöründen okur ve başlamadan `RateLimit` tablosunu boşaltır (`tests/e2e/support/`); bu yüzden yerel veritabanı açık olmalıdır. Canlı adreste (`PW_BASE_URL`) hesap açan testler atlanır.

## Yayın

Site `https://bitirme.muratbulut.net`'te, Murat'ın başka işlerinin de çalıştığı sunucuda durur. `main`'e giren her değişiklik testler geçince GitHub Actions ile yüklenir (`.github/workflows/deploy.yml`); elle yükleme yapılmaz. Ayrıntı: `docker/server/README.md`.

- Depo public olduğu için Actions dakikası ücretsiz (8 Kasım); CI yine de hafif tutulur. Hafif CI: yalnızca `labs/rooms/` ve `docs/` değişen PR'da uçtan uca testler ve Docker işi çalışmaz, main'de uçtan uca testler çalışmaz (karar `.github/scripts/ci-scope.sh`). Uçtan uca testler hiç main'de çalışmaz, PR'da da yalnızca taslak olmayan PR'da (2 Kasım, Murat): **PR taslak (draft) açılır**, ara push'larda yalnızca lint, tip ve birim testleri koşar; iş bitince "Ready for review" denir ve tam CI bir kez koşar. İki PR arka arkaya birleşecekse ikincisi önce "Update branch" ile güncellenir (main'de uçtan uca test yok, birlikte bozulmayı PR testi yakalar). Dependabot npm'de ayda en çok iki PR açar (küçük ve büyük güncellemeler). Push'tan önce testler yerelde çalıştırılır (`npm run lint`, `npm run typecheck`, `npm test`; yalnızca oda dosyası değiştiyse en az `npx vitest run tests/unit/room-files.test.ts`) ve commit'ler biriktirilip tek push'la gönderilir, çünkü her push CI'ı baştan çalıştırır; CI'ı yalnızca hataları görmek için tetikleme.
- Sunucuda yalnızca `/opt/apps/cyberguard`, `cyberguard` Docker yığını ve nginx'teki `bitirme.muratbulut.net` girişi bizimdir. Diğer sitelerin dosyalarına, yığınlarına ve ayarlarına dokunulmaz.
- Sunucu değişikliği önce `docker/server/` betiklerine yazılır ve iş akışıyla uygulanır; nginx ayarı `nginx -t` geçmeden yüklenmez.
- Site Cloudflare'in arkasındadır. Cloudflare aralıkları `docker/server/cloudflare-ips.txt`'te tarihli bir yorumla durur: nginx girişimiz yalnızca bu aralıklardan gelen bağlantıyı kabul eder ve ziyaretçinin IP'si için yalnızca onlara güvenir (`tests/deploy/nginx-site.sh`). Haftalık kontrol (`.github/workflows/cloudflare-ips.yml`) Cloudflare'in listesi değişince kırmızı yanar; o zaman dosya güncellenir. HSTS `includeSubDomains` yalnızca `*.bitirme.muratbulut.net`'i bağlar; `preload` ve Cloudflare'in alan geneli HSTS'i açılmaz.
- Sırlar yalnızca GitHub depo sırlarında: SSH anahtarı ve parolası (`SUNUCU_SSH_ANAHTARI`, `SUNUCU_SSH_PAROLA`), sunucunun adresi, kullanıcısı ve anahtar parmak izleri (`SERVER_HOST`, `SERVER_USER`, `SERVER_KNOWN_HOSTS`; depo public, sunucunun asıl IP'si Cloudflare'in arkasında gizli kalır), `RESEND_API_KEY`, `DEMO_PASSWORD`. Veritabanı şifresi yalnızca sunucudaki `.env`'de durur.
- Örnek veri (demo): Actions → Yayın → `demo-data` ekler, `demo-data-remove` siler (`prisma/demo.ts`, içerik `prisma/demo-data.ts`). Örnek satırların kimliği `demo-` ile başlar, e-postalar `ornek.invalid`; kayıt defterine yazılmaz. Veri modeli ya da puanlama değişince `tests/unit/demo-data.test.ts` düşer, örnek veri de güncellenir. Ayrıntı: `docker/server/README.md`, "Örnek veri".
- Yedekler yalnızca sunucuda, `/opt/backups/cyberguard`'da: her gece 03:30 (systemd `cyberguard-backup.timer`) ve her yayında migration'dan önce (`docker/server/backup.sh`); en çok 7 gün kalır. Yayın öncesi yedek alınamazsa yayın durur. Migration düşerse `deploy.sh` onu (şema değişmemişse) "geri alındı" diye işaretleyip önceki sürüme döner; yedeğe dönmek her zaman elle yapılır. Geri yükleme denemesi `docker/server/restore-test.sh` (canlı veritabanına dokunmaz; CI'da her PR'da çalışır). Site izleme UptimeRobot (5 dakikada bir `/api/health`); `.github/workflows/uptime.yml` yalnızca elle çalışan yedek kontrol (Actions dakikası). Ayrıntı: `docker/server/README.md`.
