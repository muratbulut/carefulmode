# Sözlük: Türkçe terim ve koddaki adı

Kodda dosya, klasör, bileşen, değişken, veritabanı tablosu ve alan adları **İngilizcedir**. Türkçe kalanlar: kod yorumları, arayüz metinleri, sayfa adresleri (`/yol-haritasi`, `/giris`), test başlıkları, commit mesajları ve tasarım tahtalarının dosya adları (tuvaldeki adlarıyla aranabilsinler diye).

Doküman ve tasarım notları Türkçe terimleri kullanır; bu dosya ikisini eşler. Yeni bir kavram eklenince buraya da yazılır.

**Oda ve lab:** 13 Ekim 2026'dan beri arayüzde "lab" yerine **oda** denir (eğitim odası, senaryo odası; adresler `/odalar`, `/oda/[oda]`, `/yonetim/odalar`, eski adresler yenisine yönlenir). Kodda kavramın adı `lab` kalır; doküman, tasarım notu ve kod yorumlarındaki "lab" da aynı şeydir. Öğrencinin, öğretmenin ya da ekibin ekranda gördüğü her yazı "oda" der.

## Kavramlar

| Türkçe | Kodda |
| --- | --- |
| Siber şehir, mahalle | city, `Neighborhood` |
| Oda (eski adıyla lab) | `Lab` (adres `/oda/[oda]`, yönetimde `/yonetim/odalar`) |
| Eğitim odası / senaryo odası (eğitim labı / senaryo labı) | `LabType.TRAINING` / `LabType.SCENARIO` |
| Temel eğitim (mahallenin ilk eğitimi, her zaman açık) / ileri eğitim (temel bitince açılır) | basic training / advanced training (`basicTrainingOf`, `trainingsOf`, `lib/lab/gates.ts`) |
| Açan eğitim (senaryoyu ya da ileri eğitimi açan eğitim), kilit | gate (`gateOf`; senaryoda `Lab.unlockedById`, ilişki `unlockedBy` / `unlocks`) |
| Temel yol (temel eğitim ve onun senaryoları; mahalle rozeti bunu sayar) | basic path (`isBasicPath`) |
| Ödevin odaları (seçilenler ve onları açan eğitimler) | `Assignment.labIds`, `homeworkLabs`, `homeworkSelection` (`lib/classroom/homework.ts`) |
| Dostluk Parkı (güvenli iletişim mahallesi), Dost eli rozeti | `dostluk-parki`, rozet `dost-eli`; renk `pink`, ikon `heart` |
| Tanıtım sayfasının dönen sahneleri (odadaki sahne türüyle ilgisi yok, süs) | `HeroScenes`, `SceneStore`, `shuffleScenes` (`components/landing/scenes/`) |
| Sahne türü, şablon | `SceneTemplate`; içerik şeması `lib/lab/content.ts`, sahneler `components/lab/inbox/`, `messaging/`, `training/` |
| Lab çerçevesi (oynatıcı, görev paneli, hacklendin, rapor) | `components/lab/frame/` (`ScenarioPlayer`, `TaskPanel`), `components/lab/hacked/`, `components/lab/report/` |
| Lab SDK: olay, cevap, ele geçirildi, bitir | `LabDriver` (`components/lab/driver.ts`): `send`, `openLink`, `submitTrap`, `sendReply`, `finish`; sunucuda `lib/lab/actions.ts` |
| Bilgi girildi (sahte forma yazıldı; metin kaydedilmez) | `info_entered` olayı |
| Görev (görevli odada birinin verdiği iş), görevin sahibi, annenin isteği | mission (`scenario.mission`, `missionSchema`; görev türü `mission`; panelde `MissionBox`) |
| Görüntülü arama (görevli odanın açılışı ve bitişleri), arayan | call (`MissionCall`, `CallerAvatar`, `components/lab/mission/`; aşama `call`) |
| Satış görevi, ilan, kargodan önceki hazırlık | sale (`mission.sale`: `product`, `price`, `platform`, `prep`, `unprepared`; panelde `ListingCard`) |
| Arayanın çizimi (anne, baba) | look (`mission.look`: `mother`, `father`; `caller-rig.ts`, `father-rig.ts`) |
| Ödeme isteği (bankanın ekranı) | request (mesajda `request`; `opensRequest`, `RequestSite`; hacklenme yolu `request`) |
| Sipariş, kargoya verme | order, ship (mesajda `order`; `opensOrder`, `OrderSite`, `shipOrder`; olay `item_shipped`) |
| Mağaza sayfası, ödeme, onay kodu SMS'i | shop, payment (`item.payment`, `ShopSite`, `payShop`), `answerCode`; olaylar `code_entered`, `code_refused` |
| Son anda durdu (ödedi ama kodu yazmadı) | `stopped` (`FakeOutcome`) |
| Önizle (tam ekran, öğrencinin oynatıcısı) | `LabPreview`, tarayıcıdaki sürücü `components/lab/preview/local-driver.ts` |
| Öğrenci gibi dene (formun yanındaki sekme) | try path (`TryPath`, `lib/admin/try-path.ts`) |
| Yönetim paneli, Oda düzenleme (Lab düzenleme) | admin (`app/yonetim/`, `components/admin/`, `lib/admin/`), `LabEditor` |
| Yayına hazır mı? | checklist (`lib/lab/checklist.ts`) |
| Sürüm, revizyon | `LabVersion`; taslağın sayısal sürümü `Lab.draftRevision` (her taslak yazımında bir artar; aynı anda düzenlemeyi fark etmek için, `revision` parametresi) |
| Taslak okunamadı (kayıtlı taslak şemaya uymuyor) | unreadable draft (`draftIssues`, `lib/admin/validate.ts`; eylem hatası `unreadable`) |
| Oda dosyası (odanın depodaki asıl yeri), senaryo dosyası (odanın düz metin hâli) | room file `labs/rooms/<mahalle>/<oda-adresi>.json` (`Lab.sourceHash`, `prisma/rooms.ts`); senaryo `docs/labs/rooms/<mahalle>/{training,scenario}/<oda-adresi>.md` |
| Lab ekleme kılavuzu | `docs/guides/new-lab.md` |
| İlk yöneticiler | `ADMIN_EMAILS` |
| Tuzağı fark eden: ilk seferde / tekrar sonrası (her öğrenci bir kez; raporu "Güvende kaldın"; eski adı "güvende kalma oranı") | noticed: `first` / `last` (`getNoticeCounts` `lib/lab/data.ts`, sınıfta `groupedNoticeRates` `lib/classroom/teacher-rules.ts`, özette `firstTries` / `firstNoticed`) |
| Örnek veri (demo: okullar, sınıflar, öğrenciler, talepler, ipuçları, haberler) | demo data (`prisma/demo.ts`, `prisma/demo-data.ts`; kimlik öneki `demo-`, şifre `DEMO_PASSWORD`) |
| Rota (mahalledeki lab sırası: her eğitim, ardından açtığı senaryolar) | route (`routeOrder` `lib/lab/gates.ts`, görünümde `routeOf` `lib/lab/route.ts`) |
| Kaldığın yer, devam et | continue target (`continueTarget`) |
| Oda kapağı (lab kapağı, lab detayı) | lab detail (`components/lab/detail/`) |
| Odalar kataloğu (lablar kataloğu) | catalog (`components/catalog/`, `lib/lab/catalog.ts`) |
| Sıradaki rozet | next badge (`lib/progress/next-badge.ts`) |
| Kayıt penceresi | sign-up dialog (`components/roadmap/SignUpDialog.tsx`) |
| Eğitim bileşenleri: kart, tıkla-bul, mini test, video, eşleştirme, kutulara ayırma, boşluk doldurma | `Card` türleri `info`, `clickFind`, `quiz`, `video`, `match`, `sort`, `fill` (`lib/lab/content.ts`), `components/lab/training/` |
| Eşleştirme, kutulara ayırma ve boşluk doldurmanın ortak etkileşimi: yerleştirme, seçenek kutusu | placement (`PlacementView`, `checkPlacement`), bank (`placementBank`) |
| Kutulara ayırma: kutu, bilgi | bin, item (`SortView`), renk ve ikon listeleri `sortColors`, `cardIcons` |
| Bilgi kartının düzeni: liste, keşfet, adım adım, banka kartı | `layout`: `list`, `explore`, `steps`, `bankCard` (`infoLayouts`, `InfoLayouts.tsx`) |
| Mini testin çizimi: hediye kutusu, oltadaki 1 TL | `art`: `gift`, `coin` (`quizArts`, `QuizArtView`) |
| "Nasıl oynanır" penceresi, sürükle bırak | help (`useHelp`, `HelpDialog`, `DemoStage`; `components/lab/training/help.tsx`), drag and drop (`useDragDrop`, `DragGhost`; `drag.tsx`) |
| Örnek lablar | `labs/examples/` |
| Gelen kutusu (Postam), mesajlaşma | `SceneTemplate.INBOX`, `SceneTemplate.MESSAGING` |
| Deneme | `LabAttempt` |
| Hacklendin (ele geçirildi) | `AttemptStatus.HACKED` |
| Ele geçirilen hesap ("Hangi hesap?", boşsa Postam) | `trap.account`, `compromisedAccount` (`lib/lab/story.ts`) |
| Rapor puanı | `reportScore` |
| Rozet, vitrin | badge (`EarnedBadge`), `showcaseOrder` |
| İpucu havuzu, sabitlenen gün, sıradaki günler | `TipStatus.POOL`, `pinnedDate`, `pickForDay` / `planDays` (`lib/tips/schedule.ts`) |
| Bugünün ipucu (gün içinde değişmez) | `TipDay`, `getTodayTip` (`lib/tips/data.ts`); öğrenci kartı `components/home/TodayTip.tsx`, ziyaretçi şeridi `components/landing/TodayTipBanner.tsx` |
| İpucu yönetimi | `/yonetim/ipucu`, `components/admin/tips/`, sunucu eylemleri `lib/tips/actions.ts` |
| Meraklı ("Neden?"e bakılan gün sayısı) | `TipView.reasonViewed`, `curiousDays` (`lib/progress/summary.ts`) |
| Günün ipucu, "Neden?" | `DailyTip`, `reason` |
| Gündem, haber | news (`NewsArticle`) |
| Haberin bölümleri: Ne oluyor?, örnek mesaj, Nasıl anlarsın? (işaretler), Ne yapmalısın?, Kısaca | `ArticleContent`: `whatsHappening`, `example`, `signs`, `actions`, `takeaways` (`lib/news/content.ts`) |
| Haber: Yayına hazır mı? | `readiness` (`lib/news/content.ts`), düzenleyici `components/admin/news/ArticleEditor.tsx` |
| Güvenilir kaynak (liste, .gov.tr) | trusted source (`trustedDomains`, `checkSourceUrl`, `isTrustedSourceUrl`) |
| Yayın haftası (Cuma 08.00, Türkiye saati) | publish week (`fridayPublishTime`, `upcomingFridays`, `weekKeyOf`) |
| Haber durumu (yayında / planlı / taslak; planlı haber yayın anında kendiliğinden yayında sayılır) | `articleState`, `liveWhere` |
| Taslağın geçici adresi (ilk planlamada kalıcı adres verilir) | draft slug (`draftSlugPrefix`, `isDraftSlug`) |
| Okunma sayısı (adres başına günde bir) | `readCount`, `recordArticleRead` (`lib/news/reads.ts`) |
| Siteden ayrılıyorsun penceresi (Kaynağa git) | leave dialog (`components/news/LeaveSiteButton.tsx`) |
| Gündem zaman çizelgesi, haber sayfası | `components/news/NewsTimeline.tsx`, `components/news/ArticleView.tsx` (önizleme de bunu kullanır) |
| Haberin kapak görseli (odak noktası, alt metin, görselin kaynağı) | `NewsCover` (görselin baytları), `NewsArticle.coverFocusX/Y`, `coverAlt`, `coverCredit`; kurallar `lib/news/cover.ts`, adres `/api/kapak/<haber>`, form `components/admin/news/CoverField.tsx`, çizim `components/news/CoverImage.tsx` |
| Bu ayın en çok okunanı | `mostReadOf` (`lib/news/dates.ts`) |
| Bir şey mi gördün? Nereye bildirilir | `components/news/ReportBox.tsx` |
| Sınıf, katılım kodu, ödev | `Classroom`, `joinCode`, `Assignment` |
| Sınıf düzeyi (5.-12. sınıf, Karma) | `Classroom.level`, `classLevels` (`lib/classroom/rules.ts`) |
| Sınıflarım, sınıf detayı, tahtaya yansıt | `/siniflarim` (`routes.classes`), `/siniflarim/[sinif]`, projection; `lib/classroom/teacher.ts`, `components/classroom/` |
| Dikkat isteyenler (Sınıflarım) | attention (`lib/classroom/teacher-rules.ts`) |
| Sınıf kutusu, ödev kutusu (öğrenci ana sayfası) | `ClassCard`, `AssignmentView` (`components/home/ClassCard.tsx`), kod kutusu `JoinCodeForm` |
| Sınıfa katıl, katılma bağlantısı | join (`joinClassroom`, `/katil/[kod]`, `paths.join`); `lib/classroom/student.ts` |
| Öğrencilerin lab ilerlemesi (bitirdi / bitirmedi) | members progress (`getMembersProgress`, `lib/classroom/progress.ts`) |
| Öğretmen talebi | `TeacherApplication` |
| Öğretmenlik belgesi | `ApplicationDocument` (veritabanında, karar verilince silinir) |
| Bilgi iste, cevap geldi | `ApplicationStatus.INFO_REQUESTED`, `question` / `answer` |
| Yeni okul (listede olmayan okuldan talep) | `TeacherApplication.newSchoolName` (`schoolId` boş) |
| Talep kararı: onayla, reddet, bilgi iste, geri al | `lib/teacher/decide.ts` |
| Öğretmen talepleri ekranı (yönetim) | applications (`/yonetim/talepler`, `paths.adminApplications`; `components/admin/applications/`, veri `lib/admin/applications.ts`, eylemler `lib/admin/application-actions.ts`, kurallar `lib/admin/application-rules.ts`) |
| Talep sekmeleri: Bekleyen / Bilgi istendi / Onaylanan / Reddedilen | `applicationTabs`: `pending` / `info` / `approved` / `rejected` (adreste `?sekme=bekleyen`, seçili talep `?talep=`) |
| Kontrol listesi (onay için en az 2) | checks (`checkKeys`: `schoolReal`, `emailDomain`, `documentReadable`, `subjectFits`; `minApprovalChecks`; `TeacherApplication.checks`) |
| Sinyaller, Güçlü / Orta / Zayıf | signals (`signalsOf`), `signalLevel`: `strong` / `medium` / `weak` |
| "Bu okul mu?" (yeni okulu listedeki okulla eşleme) | similar schools (`similarSchools`, `schoolSimilarity`), `matchSchoolId` |
| "CEVAP GELDİ" etiketi | answered (`PENDING` ve `answeredAt` dolu) |
| Belgeye bakış (kayıt defterine yazılır) | `application.document_viewed`; belge adresi `/yonetim/talepler/[talep]/belge` (`lib/admin/application-document.ts`) |
| Öğretmen ve okul sorumlusu erişimi | `getTeacherAccess`, `requireTeacher`, `getCoordinatorAccess` (`lib/teacher/access.ts`) |
| Okul listesi, il, ilçe | `School`, `provinces`, `districtsOf`, `isPlace` (`lib/school/places.ts`) |
| Okul adının karşılaştırma biçimi | `School.nameKey`, `schoolNameKey` (`lib/school/names.ts`) |
| Okul sorumlusu | `School.coordinator` |
| Sorumlu kendi okulunun taleplerini onaylar (okul bazında tik) | `School.coordinatorApproves` |
| Okulum, haftalık okul bülteni | my school (`/okulum`, `routes.mySchool`), bulletin (`lib/school/bulletin.ts`, `components/school/`) |
| Öğretmen kurulumu (5 adım), hatırlat | setup steps, reminder (`teacher.reminded` kaydı) |
| Öğretmen davet bağlantısı | `paths.teacherInvite` |
| Yönetim ekibi izni | `TeamPermission` |
| Kayıt defteri | `AuditLog` |
| Kullanıcılar sayfası: Genel (Öğrenciler, Öğretmenler, Yönetim ekibi) ve Okullar görünümü | admin users (`/yonetim/kullanicilar`, `components/admin/users/`, `lib/admin/users.ts`): `UsersWorkspace`, `ViewSwitch` (`?gorunum=okullar`), `UserTabs` (`?sekme=ogrenciler/ogretmenler/ekip`) |
| Öğrencinin kısa adı ("Ad S.") | `shortName` (`lib/admin/users-model.ts`) |
| Öğrenci listesi, öğretmen listesi, sayfa gezgini | `StudentList`, `TeacherTable`, `Pager`, `UrlSearch` (`?ara=`, `?sayfa=`) |
| Öğrencinin kısa profili (bakmak kayda geçer) | `StudentProfile`, `StudentDrawer`, `openStudentProfile` (`student.profile_viewed` kaydı; adreste `?ogrenci=`) |
| Öğretmen çekmecesi | `TeacherDrawer` (adreste `?ogretmen=`) |
| Öğretmenin gözünden bak (salt okunur Sınıflarım) | gaze: `GazeOverlay`, `viewAsTeacher` (`teacher.viewed_as` kaydı), `ClassCard` `readOnly` |
| Ekibin hatırlatması | `remindTeacherAsTeam`, `teamReminderMail` (`lib/mail/team-reminder-mail.ts`; kayıtta `by: "team"`) |
| Öğretmenlikten çıkar, geri al | `removeTeacher`, `undoRemoveTeacher` (`teacher.removed` / `teacher.restored` kaydı; sınıflar arşivlenir) |
| Okul kartı, kurulum hunisi | `SchoolCard`, `funnelOf` (`SchoolsView`) |
| Tanıtım sayfası | landing (`components/landing/`) |
| SSS, konu, sorunun bağlantısı | faq (`/sss`, `components/faq/`): `FaqExplorer`, `faqTopics` (adreste `?konu=odalar`; eski `?ben=` adresleri de konu açar), soru `slug` (`/sss#arayan-kim`), `searchFaq` |
| Akordeon (soru-cevap) | `Accordion` (`components/faq/Accordion.tsx`) |
| Öğretmenler için sayfası, "İki ekran, bir ders" | teachers page (`/ogretmenler`, `components/teachers/`): `TeachersPage`, `LessonTour` |
| Ziyaretçi | visitor (`app/(visitor)/`, `components/visitor/`) |
| Durum ekranları (yükleniyor, boş, hata) | status (`components/status/`) |
| Koyu / gri tema | `dark` / `gray` (`<html data-theme>`, `theme` çerezi) |
| Dil sözlüğü (arayüz metinleri), dil | messages (`lib/i18n/messages/tr.ts`, `getMessages()`), locale |
| Sayfa adresleri | `routes` (`lib/navigation.ts`) |
| Yasal sayfalar: KVKK aydınlatma metni, gizlilik politikası, kullanım koşulları | legal (`components/legal/`, `lib/content/legal.ts`): `kvkk`, `privacy`, `terms` |
| Kısaca, tam metin, "Sadece kısaca oku" | `short`, `full`, `shortOnly` |
| Karanlık desen ("Neden önemli?" dersi) | dark pattern (`DarkPatternLesson`) |
| Bildirim kutusu ("Kaydedildi") | `Toast` (`components/status/Toast.tsx`) |
| Aç-kapa düğmesi | switch (`SwitchTrack`) |
| Hesap ekranları: kayıt, giriş, e-posta doğrulama, şifre sıfırlama | account (`app/(auth)/`, `components/auth/`, `lib/account/actions.ts`): `SignUpForm`, `SignInForm`, `VerifyForm`, `ResetWizard` |
| Görünen ad | `User.displayName` (Better Auth'ta `name`) |
| E-posta kodu (6 hane), kod kutuları | email OTP, `codeRules` (`lib/auth.ts`), `CodeInput` |
| Kod maili | `codeMail` (`lib/mail/code-mail.ts`), `sendMail` (`lib/mail/index.ts`) |
| Şifre gücü göstergesi, kırılma süresi | `evaluatePassword`, `crackTime` (`lib/password-strength.ts`), `PasswordStrength` |
| Veli onayı kutusu (18 yaş altı) | `guardian` (kayıt formu; veritabanına yazılmaz) |
| Doğrulanmamış hesap şeridi | `UnverifiedStrip` |
| İstek sınırı, deneme kilidi | `rateLimit`, `rateRules` (`lib/rate-limit.ts`), `RateLimit` tablosu |
| Dönüş adresi (`?sonra=`) | `next`, `safeNext`, `withNext` (`lib/account/shared.ts`) |
| Profil ve bölümleri: hesap bilgileri, avatar, görünüm, güvenlik, hesabı sil | `ProfileView` (`components/profile/`, `lib/account/profile-actions.ts`): `account`, `avatar`, `appearance`, `security`, `delete` |
| Hesap menüsü (üst menüdeki avatar) | `AccountMenu` |
| Avatar (hazır liste) | `avatars`, `avatarOf` (`lib/avatars.ts`), `User.avatar` |
| Açık oturumlar, "Bu cihaz" | `Session`, `parseUserAgent` (`lib/account/user-agent.ts`) |
| Hesap silme isteği (7 gün bekler) | `User.deletionScheduledAt`, `deletionGraceDays`, `scheduleDeletion`, `cancelDeletion` |
| Anonimleştirme ("Silinmiş kullanıcı"; kalıcı kayıtlarda izi olan hesap silinmez) | `Role.DELETED`, `deleteAccount`, `lastingTraces`, `anonymize` (`lib/cleanup.ts`) |
| Saatlik temizlik | `runCleanup` (`lib/cleanup.ts`, `instrumentation.ts`'den başlar) |
| Yönetim özeti (Özet) | overview (`app/yonetim/page.tsx`, `components/admin/overview/`, `lib/admin/overview.ts`) |
| Canlı nabız (şu an aktif sayılar, anonim akış) | pulse (`components/admin/pulse/`, `lib/admin/pulse.ts`) |
| "Bugün değil" (bekleyen işi bugünlük gizle) | snooze (`snoozeKey`, tarayıcıda) |
| En çok tuzağa düşülen lablar | traps (`TrapList`) |
| Kayıt defteri, "Bu sayfayı görenler" | audit log (`lib/admin/audit-log.ts`, `audit-sentences.ts`), seers |

## Klasörler ve dosyalar

| Eski (Türkçe) | Yeni |
| --- | --- |
| `app/(ziyaretci)/` | `app/(visitor)/` (içindeki sayfa klasörleri Türkçe adres olduğu için aynı kaldı) |
| `app/api/saglik` | `app/api/health` |
| `components/arkaplan/` | `components/background/` |
| `components/durum/` | `components/status/` |
| `components/ortak/` | `components/common/` |
| `components/tanitim/` | `components/landing/` |
| `components/tema/` | `components/theme/` |
| `components/ziyaretci/` | `components/visitor/` |
| `lib/marka.tsx`, `lib/tema.ts`, `lib/gezinme.ts`, `lib/hata.ts` | `lib/brand.tsx`, `lib/theme.ts`, `lib/navigation.ts`, `lib/errors.ts` |
| `lib/icerik/tanitim.ts` | `lib/content/landing.ts` |
| `lib/lab/sablonlar/` (dokümanda) | `lib/lab/content.ts` ve `components/lab/` (ayrı bir şablon klasörü yok) |
| `public/rozetler/<kod>.svg` (ileride) | `public/badges/<code>.svg` |
| `tests/birim/` | `tests/unit/` |
| `docker/sunucu/` (`yayinla.sh`, `nginx-kur.sh`, `kontrol.sh`) | `docker/server/` (`deploy.sh`, `install-nginx.sh`, `inspect.sh`) |
| `.github/workflows/yayin.yml` | `.github/workflows/deploy.yml` |
| `docs/platform-dokumani.md` | `docs/platform-document.md` |
| `docs/tasarim/` (`ekran-listesi.md`, `turN-plan.md`, `tahtalar/faz-1/`) | `docs/design/` (`screen-list.md`, `round-N-plan.md`, `boards/phase-1/`) |

## Bileşenler

| Eski | Yeni |
| --- | --- |
| `ZiyaretciKabugu`, `UstMenu`, `AltMenu`, `AltBilgi` | `VisitorShell`, `TopNav`, `BottomNav`, `Footer` |
| `Kahraman`, `Adimlar`, `Gundemde`, `IpucuBandi`, `YolHaritasiBolumu` | `Hero`, `Steps`, `NewsSection`, `TipBanner`, `RoadmapSection` |
| `PostamSahnesi`, `MahalleIkonu`, `KaydirmaNoktalari`, `TanitimArkaplani` | `PostamScene`, `NeighborhoodIcon`, `ScrollDots`, `LandingBackground` |
| `AkanIplikler`, `SayfaArkaplani` | `FlowingThreads`, `PageBackground` |
| `DurumKarti`, `BosDurum`, `Yukleniyor`, `Cark`, `TekrarDene`, `BaglantiSeridi`, `DurumOnizlemesi` | `StatusCard`, `EmptyState`, `Loading`, `Spinner`, `RetryButton`, `ConnectionBanner`, `StatusPreview` |
| `YakindaSayfasi` ("… hazırlanıyor") | `ComingSoonPage` |
| `TemaDugmesi`, `SatirIciBetik` | `ThemeToggle`, `InlineScript` |
| `LogoIsareti`, `marka` | `LogoMark`, `brand` |

## Veritabanı

### Tablolar ve alanlar

| Türkçe (doküman) | Kodda | Alanlar (Türkçe → İngilizce) |
| --- | --- | --- |
| Kullanıcı | `User` | gorunurAd → displayName, emailDogrulandi → emailVerified, rol → role, dogumYili → birthYear, egitimDurumu → educationStatus, kademe → gradeLevel, okulId → schoolId, tema → theme, kvkkOnayTarihi → kvkkConsentAt, olusturma → createdAt, guncelleme → updatedAt, sonAktif → lastActiveAt, askida → suspended, avatar → avatar, silmeTarihi → deletionScheduledAt |
| Ekip izni | `TeamPermission` | izin → permission, verenId → grantedById, tarih → grantedAt |
| Okul | `School` | ad → name, karsilastirmaAdi → nameKey, il → province, ilce → district, sorumluId → coordinatorId, sorumluOnaylar → coordinatorApproves, ekleyenId → createdById, olusturma → createdAt |
| Öğretmen talebi | `TeacherApplication` | okulId → schoolId, yeniOkulAdi → newSchoolName, il → province, ilce → district, brans → subject, kurumsalEposta → institutionalEmail, belgeAdi → documentName, belgeBoyutu → documentSize, not → note, durum → status, kontroller → checks, soru → question, soruTarihi → questionAt, cevap → answer, cevapTarihi → answeredAt, sorumluGorusu → coordinatorOpinion, karariVerenId → decidedById, kararTarihi → decidedAt, retNotu → rejectionNote, olusturma → createdAt, guncelleme → updatedAt |
| Talep belgesi | `ApplicationDocument` | talepId → applicationId, tur → mimeType, icerik → data, olusturma → createdAt |
| Sınıf | `Classroom` | ad → name, duzey → level, ogretmenId → teacherId, katilimKodu → joinCode, arsivlendi → archived, olusturma → createdAt |
| Sınıf üyeliği | `ClassroomMembership` | sinifId → classroomId, katilmaTarihi → joinedAt |
| Ödev | `Assignment` | sinifId → classroomId, mahalleId → neighborhoodId, odalar → labIds, sonTarih → dueDate, olusturma → createdAt, kapandi → closed |
| Mahalle | `Neighborhood` | ad → name, konu → topic, renk → color, ikon → icon, sira → sortOrder |
| Lab | `Lab` | mahalleId → neighborhoodId, tur → type, sablon → template, sira → sortOrder, acanEgitimId → unlockedById, durum → status, zorluk → difficulty, sureDk → durationMin, taslakIcerik → draftContent, taslakSurumu → draftRevision, yayindakiVersiyon → publishedVersion, guncelleyenId → updatedById, guncelleme → updatedAt |
| Lab versiyonu | `LabVersion` | versiyon → version, icerik → content, yayinlayanId → publishedById, tarih → publishedAt |
| Eğitim ilerlemesi | `TrainingProgress` | kartNo → cardIndex, cevaplananKartlar → answeredCards, tamamlanmaTarihi → completedAt |
| Lab denemesi | `LabAttempt` | labVersiyonu → labVersion, durum → status, raporPuani → reportScore, baslangic → startedAt, bitis → endedAt, sonucRaporu → resultReport |
| Lab olayı | `LabEvent` | denemeId → attemptId, tur → type, veri → data, zaman → createdAt |
| Kazanılan rozet | `EarnedBadge` | rozetKodu → badgeCode, kazanmaTarihi → earnedAt, vitrinSirasi → showcaseOrder |
| Günün ipucu | `DailyTip` | metin → text, neden → reason, mahalleId → neighborhoodId, ilgiliLabId → labId, durum → status, sabitTarih → pinnedDate, yazanId → authorId, olusturma → createdAt, guncelleme → updatedAt |
| İpucunun günü (o gün gösterilen ipucu) | `TipDay` | tarih → date, ipucuId → tipId |
| İpucu görülme | `TipView` | ipucuId → tipId, tarih → date, nedeneBakti → reasonViewed |
| Gündem haberi | `NewsArticle` | adres → slug, baslik → title, kisaca → summary, metin → content, kaynakAdi → sourceName, kaynakUrl → sourceUrl, mahalleId → neighborhoodId, ilgiliLabId → relatedLabId, durum → status, yayinTarihi → publishedAt, okunma → readCount, yazanId → authorId, kapakOdakX/Y → coverFocusX/Y, kapakAltMetni → coverAlt, kapakKaynagi → coverCredit |
| Haber kapağı | `NewsCover` | haberId → articleId, tur → mimeType, veri → data, genislik → width, yukseklik → height, guncelleme → updatedAt |
| Kayıt defteri | `AuditLog` | yapanId → actorId, tur → action, hedef → target, detay → details, zaman → createdAt |
| İstek sayacı | `RateLimit` | anahtar → key ("kural:kimlik", ör. `code-cooldown:<e-posta>`), sayi → count, sifirlanma → resetAt |

`Session`, `Account` ve `Verification` Better Auth'un standart tablolarıdır.

### Sabit listeler

| Türkçe | Kodda |
| --- | --- |
| Rol: öğrenci / öğretmen / yönetici | `Role`: STUDENT / TEACHER / ADMIN |
| Tema: koyu / gri | `Theme`: DARK / GRAY |
| Eğitim durumu: okuyor / mezun | `EducationStatus`: STUDYING / GRADUATED |
| Ekip izni: talepler / lab düzenleme / lab yayını / ipucu / gündem / kayıt defteri / roller | `TeamPermissionType`: APPLICATIONS / LAB_EDITING / LAB_PUBLISHING / TIPS / NEWS / AUDIT_LOG / ROLES |
| Talep durumu: bekliyor / bilgi istendi / onaylandı / reddedildi | `ApplicationStatus`: PENDING / INFO_REQUESTED / APPROVED / REJECTED |
| Sorumlu görüşü: onayladı / tanımıyor | `CoordinatorOpinion`: ENDORSED / NOT_RECOGNIZED |
| Lab türü: eğitim / senaryo | `LabType`: TRAINING / SCENARIO |
| Şablon: eğitim / gelen kutusu / mesajlaşma | `SceneTemplate`: TRAINING / INBOX / MESSAGING |
| Lab durumu: taslak / yayında / gizli | `LabStatus`: DRAFT / PUBLISHED / HIDDEN |
| İpucu durumu: havuzda / taslak / arşivde | `TipStatus`: POOL / DRAFT / ARCHIVED |
| Zorluk: kolay / orta / zor | `Difficulty`: EASY / MEDIUM / HARD |
| Deneme durumu: devam / tamamlandı / ele geçirildi / yarıda | `AttemptStatus`: IN_PROGRESS / COMPLETED / HACKED / ABANDONED |
| Haber durumu: taslak / planlandı / yayında | `ArticleStatus`: DRAFT / SCHEDULED / PUBLISHED |

## Tema renkleri (`app/globals.css`)

Sınıf adlarında kullanılır: `bg-surface`, `text-fg-3`, `border-line` gibi.

| Türkçe | Kodda |
| --- | --- |
| zemin, zemin-saydam | `canvas`, `canvas-translucent` |
| yüzey, yüzey-saydam, yüzey-derin, yüzey-üst | `surface`, `surface-translucent`, `surface-deep`, `surface-raised` |
| kart | `card` |
| kenar, kenar-güçlü | `line`, `line-strong` |
| yazı, yazı-2/3/4 | `fg`, `fg-2/3/4` |
| vurgu, vurgu-yazı, vurgu-açık, vurgu üzerine yazı, ışık | `accent`, `accent-fg`, `accent-light`, `on-accent`, `glow` |
| başarı, başarı zemini | `success`, `success-fg`, `success-subtle`, `success-subtle-fg` |
| uyarı, tehlike | `warning`, `warning-fg`, `danger`, `danger-fg`, `on-danger` |
| mor, turuncu, lacivert | `purple`, `orange`, `indigo` |
| sahne mavisi, sahne sarısı | `scene-blue`, `scene-yellow` |
| Sahnelerdeki "başka bir site" çizimi: kâğıt, mürekkep, yeşil düğme | `scene-paper`, `scene-ink`, `scene-ink-muted`, `scene-ink-faint`, `scene-green`, `scene-white` |
| tanıtım sahneleri: cihaz gövdesi, kamera, karartı, raf kitabı, profil kapağı, harita | `scene-bezel`, `scene-device*`, `scene-camera*`, `scene-person*` / `scene-stranger*` / `scene-beanie*`, `scene-deep-*`, `scene-cover*`, `scene-map*` |
| aç-kapa düğmesinin topu | `knob` |
| bildirim kutusu | `toast-bg`, `toast-fg` |
| gölge, perde | `shadow-color`, `shadow-color-soft`, `scrim` |
| alttaki bandın yukarı gölgesi | `shadow-banner` |
| başlık yazı tipi | `font-heading` |

## Hareketler

Hareket sınıfları `anim-` ile başlar (`anim-breathe`, `anim-float-1`). "Hareketi azalt" açıkken hepsi durur.

| Türkçe | Kodda |
| --- | --- |
| nefes, süzül, yüz | `breathe`, `drift` / `drift-mobile`, `float-1` / `float-2` |
| tara, işaret, etiket, bas | `scan`, `flag-1..3`, `label-pop`, `press` |
| bildirim kay, halka, parıltı | `toast-slide`, `ring`, `glow-pulse` |
| iskelet, parılda, dön | `skeleton`, `shimmer`, `spinner` |
| alttan gel, belir, yukarı belir | `slide-up`, `fade-in`, `fade-up` |

## Ortam değişkenleri ve sunucu

| Eski | Yeni |
| --- | --- |
| `SURUM` | `APP_VERSION` |
| `ALAN_ADI` | `DOMAIN` |
| `UYGULAMA_PORTU` | `APP_PORT` |
| `PW_ADRES` (canlı adreste test) | `PW_BASE_URL` |
| `cyberguard-uygulama` imajı | `cyberguard-app` |
| `veritabani` Docker birimi | `db-data` |
| `/api/saglik` cevabı `{durum: "iyi", veritabani: "iyi"}` | `/api/health` cevabı `{status: "ok", database: "ok"}` |

Faz 2 ile gelenler (Türkçe karşılıkları yok, `.env.example`'da açıklamalı): `BETTER_AUTH_SECRET` (oturum imzası, sunucuda üretilir), `BETTER_AUTH_URL` (sitenin adresi), `RESEND_API_KEY` (mail anahtarı, GitHub depo sırrı), `MAIL_FROM_ADDRESS` (gönderen adres), `MAIL_OUTBOX_DIR` (testlerde maillerin yazıldığı klasör).

GitHub depo sırlarının adları (`SUNUCU_SSH_ANAHTARI`, `SUNUCU_SSH_PAROLA`) yeniden girilmesin diye aynı kaldı.

Faz 6 ile gelenler (yedekleme ve izleme, `docker/server/README.md`):

| Türkçe | Kodda |
| --- | --- |
| Gece yedeği / yayın öncesi yedek / elle yedek | `nightly` / `predeploy` / `manual` (`docker/server/backup.sh`, dosyalar `cyberguard-<tür>-<zaman>.dump` ve `.counts`) |
| Gece yedeği zamanlayıcısı | `cyberguard-backup.timer`, `cyberguard-backup.service` (`install-backup-timer.sh`) |
| Geri yükleme denemesi | `restore-test.sh`, yayın iş akışında `restore-test` işlemi |
| Yedek klasörü | `BACKUP_DIR` (sunucuda `/opt/backups/cyberguard`) |
| Yayın öncesi yedeği atla (yalnızca acil, elle) | `SKIP_PREDEPLOY_BACKUP=1` |
| Düşen migration'ı "geri alındı" diye işaretleme, şemanın parmak izi | `release_failed_migrations`, `schema_fingerprint` (`deploy.sh`), deneme `tests/deploy/failing-migration` |
| Site izleme (asıl: UptimeRobot), elle kontrol ve "Site erişilemiyor" konusu | `.github/workflows/uptime.yml` |

## Yönetim ekibi ve okullar (Faz 5)

| Türkçe | Kodda |
| --- | --- |
| Yönetim ekibi sekmesi (Kullanıcılar, `?sekme=ekip`) | team tab: `TeamTab`, `TeamGrid` (`components/admin/users/team/`), veri `getTeamView` (`lib/admin/team.ts`) |
| Yönetici, Sorumlu, Sorumlu · öğrenci (ekipteki rol) | `TeamRole`: `ADMIN` / `MEMBER`; kart etiketi `roleLabelOf` (`lib/admin/team-rules.ts`) |
| Ekibe kişi ekle, İzinleri düzenle, Ekipten çıkar | `AddTeamMemberButton`, `EditTeamMemberDialog`; sunucu eylemleri `addTeamMember`, `updateTeamMember`, `removeTeamMember` (`lib/admin/team-actions.ts`) |
| Kişi arama (ad ya da e-posta, en az 3 harf) | `searchTeamCandidates`, `PersonPicker`, `usePersonSearch` |
| Verilebilen izinler (Kullanıcılar ve roller hariç) | `grantableOrder` (`lib/admin/team-rules.ts`), `grantablePermissions` (`lib/admin/access.ts`) |
| Yöneticilikten çıkanın döneceği rol | `formerRole` (`team-rules.ts`), `formerRoleOf` (`team.ts`) |
| "Ekibe eklendin" maili | `teamAddedMail` (`lib/mail/team-mail.ts`), `scheduleTeamAddedMail` |
| Okul ekle, benzer ad uyarısı, "Yine de ekle" | `AddSchoolButton`, `SchoolDialog` (`components/admin/users/schools/`), `createSchool` (`lib/admin/school-admin-actions.ts`), `checkSchoolName`, `confirmSimilar` |
| Okul sorumlusu ata, değiştir, kaldır | `CoordinatorControl`, `setSchoolCoordinator`, `removeSchoolCoordinator`; adaylar `coordinatorCandidates` (`lib/admin/schools.ts`), uygunluk `coordinatorRefusal` |
| "Okul sorumlusu oldun" maili | `coordinatorMail` (`lib/mail/team-mail.ts`), `scheduleCoordinatorMail` |
| Geri al (işlem kimliği) | `op` (kayıt defteri ayrıntısında), `undoBatch` (`team-rules.ts`), `undoTeamChange`, `undoSchoolChange`; geri almanın kaydı `undo: true`, `undoOf` |
| Geri al süresi, mailin gecikmesi | `teamUndoWindowMs`, `afterUndoDelayMs` |

## Yük testi ve telefonda ilk açılış (Faz 6)

| Türkçe | Kodda |
| --- | --- |
| Yük testi (k6), senaryo, kullanıcı karışımı | `tests/load/scenario.js`; komutlar `npm run load:local`, `npm run load:smoke` |
| Yük hesapları (öğrenci, öğretmen, yönetici; e-posta alanı `load.cyberguard.invalid`) | `tests/load/prepare.ts`, silme `cleanup.ts` (`deleteLoadData`, `tests/load/accounts.ts`) |
| Okul-IP denemesi (bir sınıf tek IP'den) | `tests/load/school-ip.js`, `npm run load:school` |
| Telefonda ilk açılış ölçümü | `tests/load/phone.ts`, `npm run load:phone` |
| Yük testi yığını (sunucudaki sınırlarla yerel kopya) | `tests/load/stack.sh`, Docker projesi `cg-load`; ortam `LOAD_PORT`, `LOAD_DB_PORT`, `LOAD_STATE_DIR`, `LOAD_NODE_IMAGE`, `K6_IMAGE` |
