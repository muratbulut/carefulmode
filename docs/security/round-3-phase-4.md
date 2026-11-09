# Güvenlik turu 3 — Faz 4

- **Tarih:** 12 Ekim 2026
- **Kapsam:** Faz 4 (öğretmen ve okul):
  - öğretmenlik talebi: form, okul listesi, belge yükleme, cevap, geri çekme,
  - talep kararlarının çekirdeği (`lib/teacher/decide.ts`): onay, ret, bilgi iste, geri al, kesinleştirme, mailler,
  - Okulum: sorumlunun "onayla / tanımıyorum / geri al / hatırlat" eylemleri ve haftalık bülten,
  - Sınıflarım: sınıf açma, katılma kodu ve QR, ödev, öğrenci çıkarma, tahta ekranı,
  - öğrencinin sınıfa katılması ve ayrılması (`/katil`),
  - öğretmen mailleri,
  - hesap silmenin yeni tablolarla çalışması.
- **Nasıl yapıldı:**
  - Kod incelemesi, ardından yerel **üretim derlemesine** (port 3110) ve yerel PostgreSQL'e karşı deneme.
  - Sunucu eylemleri arayüz kullanılmadan, elle hazırlanmış isteklerle çağrıldı. Eylemin kimliği derlemenin eylem listesinden okundu (`.next/server/server-reference-manifest.json`).
  - Deneyen hesaplar: öğrenci, başka okulun sorumlusu, rolü alınmış öğretmen, askıdaki hesap, doğrulanmamış hesap ve oturumsuz istek.
  - Canlı siteye karşı **hiçbir** istek yapılmadı.
  - Bulgular düzeltmeden önce kendi kopyamızda kanıtlandı. Regresyon testlerinin eski kodda başarısız olduğu görüldü.
- **Başlangıç durumu:** e2e testlerinde 197 geçti, 2 başarısız, 11 atlandı. İki hata da testin kendi zamanlama yarışıydı, ürün hatası değildi; düzeltildi (aşağıda "Bu turda yapılan değişiklikler").
- **Son durum:**
  - Birim testleri: 468 testin hepsi geçti.
  - e2e: 207 test geçti (masaüstü 102, telefon 105), 11 test atlandı, başarısız yok.
  - Lint, tür denetimi ve derleme temiz.
- **Sonuç:** İki **orta** ve üç **düşük** bulgu bulundu, hepsi düzeltildi. Yetki denetimi, sınıf kodu, belge yükleme, mail, kayıt defteri ve toplu ekranlardaki gizlilik kuralları çalışıyor.
- **Şema:** Şema değişikliği yok, migration eklenmedi.

---

## Doğrulanan korumalar (çalışıyor)

| Alan | Durum | Kanıt |
| --- | --- | --- |
| Öğretmen eylemleri (IDOR) | Sınıf eylemlerinin hepsi (sınıf aç, ödev ver, ödevi bitir, öğrenci çıkar, tahta) rolü, askıyı ve doğrulamayı her istekte veritabanından okur. Sınıf yalnızca sahibine bulunur. Başka öğretmenin sınıfında "bulunamadı" döner. Öğrenci, rolü alınmış, askıdaki ve doğrulanmamış hesap "yetki yok" alır. Oturumsuz istek giriş sayfasına gider. | Elle istekle 19 çağrı yapıldı; yetkisiz olanların hiçbiri veriyi değiştirmedi. **Yeni e2e:** `security-phase-4.spec.ts` (ilk test) |
| Okul sorumlusu eylemleri | Yalnızca kendi okulunun talebi ve öğretmeni için çalışır. Sorumlu kendi talebine karar veremez. Rolü alınınca "yetki yok" alır. Başka okulun talebinde "bulunamadı" döner, yani talebin varlığı başka okula sızmaz. Reddedilen denemeler kayıt defterine satır bırakmaz. | Elle istekle deneme. Yeni e2e: veritabanı değişmez, kayıt defteri boş kalır. |
| Kitle ataması | Sınıf açarken eklenen `teacherId`, `joinCode` ve `archived` yok sayılır. Talep formuna eklenen `status`, `userId`, `role` ve `decidedById` da yok sayılır; talep yine bekleyen (PENDING) olarak yazılır. Başka ilçenin okulu reddedilir. | Zod nesneleri yalnızca bilinen alanları alır; elle istekle denendi. |
| Girdi doğrulama | Nesne yerine metin, 100 000 karakterlik kod, geçmiş ya da çok uzak teslim tarihi ve olmayan mahalle reddedilir. | Elle istekle deneme |
| Aynı anda gelen kararlar | Aynı anda 8 "onayla": biri onaylar, yedisi "durum değişti" alır. Kayıt defterinde tek onay satırı olur, tek mail gider. Aynı anda 6 "geri al": yalnızca biri geri alır. Bu tur D11'i de kapattı. | Elle istekle deneme. Yeni e2e (D11) |
| Sınıf kodu | 32⁶ (≈ 1,07 milyar) olasılık. Kullanıcı başına 10, IP başına 300 deneme / 10 dk. Sayaç aramadan önce düşer: sınır dolunca doğru kod da reddedilir. Arşivli sınıf, sahibi artık öğretmen olmayan sınıf ve olmayan kod aynı yanıtı alır ("bulunamadı"). `/katil/[kod]` sınıfın adını ve öğretmeni göstermez; giriş yapmış kişiye de göstermez. | Elle istekle deneme: 12 denemenin 10'u "bulunamadı", sonrakiler "çok fazla deneme" aldı. |
| Sınıftan ayrılma | `leaveClassroom` yalnızca kişinin kendi üyeliğini siler. | Elle istekle deneme |
| Belge yükleme | Türü ilk baytlardan bulunur (PDF, JPG, PNG). Bildirilen tür ve uzantı yok sayılır. 5 MB sınırı sunucuda denetlenir. Adın klasör kısmı, kontrol karakterleri ve yön değiştiren işaretler atılır; uzantı gerçek türe göre yazılır. Belge ayrı tabloda durur. Faz 4'te belgeyi geri veren bir yol yok. Talep geri çekilince, hesap silinince ve karar kesinleşince belge silinir. | `lib/teacher/document.ts`. Yeni e2e: `.pdf` adlı HTML reddedilir, 5 MB'tan büyük dosya reddedilir, `../../gizli‮fdp.exe` adı `gizlifdp.pdf` olarak saklanır. |
| Çok biçimli dosya (polyglot) | `%PDF-` ile başlayan bir HTML dosyası PDF olarak kabul edilir, ama `application/pdf` türüyle saklanır ve hiçbir yerde sunulmaz. Faz 5'te sunulurken uyulacak kurallar aşağıda (öneri 1). | Elle istekle deneme. Yeni e2e: profilde yalnızca belgenin adı görünür, içeriği görünmez. |
| Toplu ekranlarda gizlilik | Okulum'da öğrencinin adı, kimliği ve e-postası yok; öğretmenin e-postası da yok. Öğretmenin sınıf sayfasında öğrencinin adı (kural gereği) ve bitirdi / bitirmedi bilgisi var. Puan, rapor, deneme kimliği, "hacklendi" durumu ve e-posta yok. Öğrencinin ana sayfası ve profilinde öğretmenin e-postası, başka öğrencinin adı ve sınıf kodu yok. | Sayfaların ham HTML'inde ve React verisinde (RSC) arama |
| Güvende kalma oranı | En az 5 öğrenci bitirince görünür. O2 düzeltmesiyle 5'erli gruplar halinde güncellenir. | Yeni birim testi ve e2e |
| Tahta ekranı | `projectionJoins` yalnızca öğretmenin kendi sınıfında çalışır, yalnızca okur ve en fazla 200 satır döner. Adları kısaltır ("Ayşe Y."). | Kod incelemesi ve elle istekle deneme |
| Mail | Bütün değişkenler HTML'de kaçışlanır. Bağlantılar yalnızca `siteUrl()` ve sabit yollardan kurulur. Okul ve kişi adlarındaki satır sonları boşluğa çevrilir. Resend JSON ile çalışır; mail başlığı eklenemez. Aynı karar için tek mail gider (`application.mail_sent` işareti). | `lib/mail/teacher-mail.ts`, `tests/unit/teacher-mail.test.ts` ve aynı anda gelen kararlar denemesi |
| Kayıt defteri | Kararlar ve hatırlatmalar, değişiklikle aynı veritabanı işleminde yazılır: işlem geri dönerse kayıt satırı da yazılmaz. Tablo tetikleyiciyle korunur, silinemez ve değiştirilemez (tur 2). | `lib/teacher/decide.ts`, `lib/teacher/school-actions.ts` |
| `sonra=` ve proxy | `/siniflarim` ve `/okulum` giriş ister. `sonra=` yalnızca site içi yolu kabul eder; `//`, `\` ve kontrol karakterleri reddedilir. | `proxy.ts`, `safeNext` |
| Bağımlılıklar | `qrcode@1.5.4` yeni eklendi ve bilinen açığı yok. Yalnızca sunucuda çalışır. QR'ın içeriği `siteUrl()` + `/katil/` + sunucunun ürettiği koddur; tarayıcıya yalnızca kare matrisi gider. `npm audit` tur 2 ile aynı: 9 yüksek uyarının hepsi derleme ve komut satırı araçlarında (tur 1, D1). | `npm audit` |

---

## Bulgular

### O1 — Sınıfı olan öğretmenin hesabı silinemiyordu (orta) — düzeltildi

"Hesabı sil" denince hesap 7 gün sonra saatlik temizlikte silinir (`lib/cleanup.ts`). Ama:

- `Classroom.teacherId` ilişkisi silmeyi engeller (ON DELETE RESTRICT).
- Temizlik öğretmenin sınıflarını silmiyordu.
- Bu yüzden sınıfı olan öğretmenin hesabı hiç silinmiyordu. Hata yalnızca sunucu kaydına düşüyordu.

- **Etki:** Kişinin verilerini silme isteği (KVKK) sessizce yerine getirilmiyordu. Öğretmenin adı, e-postası ve sınıflarındaki öğrenci listesi kalıyordu; öğretmen ise hesabının silindiğini sanıyordu.
- **Kanıt:** Kendi kopyamızda, sınıfı olan bir öğretmen için temizliğin adımları çalıştırıldı. Veritabanı `violates foreign key constraint "Classroom_teacherId_fkey"` hatası verdi ve hesap yerinde kaldı.
- **Düzeltme:** Hesap silme, öğretmenin sınıflarını da aynı işlemde siler: önce sınıflar, sonra hesap.
  - Sınıfın üyelikleri ve ödevleri sınıfla birlikte silinir.
  - Öğrencilerin hesabı, lab denemeleri, puanı ve rozetleri kalır.
  - Aynı adımlar veritabanında denendi: öğretmen, sınıf, üyelik ve ödev silindi, öğrenci kaldı.
- **Regresyon testi:** `tests/unit/cleanup.test.ts` (eski kodda başarısız oluyor).
- **Kalan:** Kayıt defterinde işlemi olan okul sorumlusu ve yönetici hâlâ silinemez (D14).

### O2 — Güvende kalma oranının değişiminden tek öğrencinin sonucu çıkarılabiliyordu (orta) — düzeltildi

Öğretmen sınıf sayfasında kimin bitirdiğini adıyla görür. Yanında sınıfın güvende kalma oranını da görür. Oran en az 5 öğrenci bitirince görünüyor, sonra **her yeni bitirende** yeniden hesaplanıyordu (`safeRate(bitiren, güvende)`).

- Örnek: 5 bitirende oran %60'tır. 6. öğrenci bitirir ve oran %50'ye iner.
- Öğretmen listeden 6. bitireni görür ve onun hacklendiğini anlar. Oran %67'ye çıksaydı güvende kaldığını anlardı.
- Aynı çıkarım her yeni bitiren için yapılabilir.

- **Etki:** "Öğretmen yalnızca bitirdi / bitirmedi bilgisini görür" kuralı (CLAUDE.md, Gizlilik) dolaylı yoldan çiğneniyordu. Reşit olmayan öğrencinin sonucu öğretmene geçiyordu. Bunun için bir saldırı gerekmiyordu; sayfayı iki farklı zamanda açmak yetiyordu.
- **Düzeltme:** Oran, bitirenlerin 5'erli grupları üzerinden hesaplanır (`lib/classroom/teacher-rules.ts` `groupedSafeRate`, `lib/classroom/teacher.ts`).
  - Bitirme sırasına göre ilk 5, ilk 10, ilk 15… öğrenci sayılır.
  - 6.–9. bitirenler oranı değiştirmez. 10. öğrenci bitirince ikinci grup bir kerede eklenir.
  - Tek öğrencinin sonucu ancak gruptaki diğer 4 kişinin sonucu biliniyorsa çıkarılabilir.
  - Sınıf sayfasındaki gizlilik notuna "her 5 yeni bitirende bir güncellenir" eklendi.
- **Regresyon testleri:**
  - `tests/unit/classroom.test.ts` ("güvende kalma oranı 5'erli gruplarla değişir…")
  - `tests/e2e/security-phase-4.spec.ts` ("güvende kalma oranı tek öğrencinin sonucunu ele vermez…"): 5 bitirende %60, 6. öğrenci hacklenince yine %60, 10 bitirende %70.
- **Kalan:** Toplu oranın doğal sınırı (D15).

### D11 — Karar ile başvuranın geri çekmesi ya da cevabı aynı anda gelince karar hata veriyordu (düşük) — düzeltildi

İki taraf satırları ters sırayla kilitliyordu:

- Karar (onay, ret, bilgi iste) önce talebi kilitliyordu, onayda sonra başvuranın kullanıcı satırını.
- Başvuranın kendi işleri (geri çekme, cevap, talep gönderme) önce kullanıcı satırını, sonra talebi kilitliyordu.

İkisi aynı anda gelince birbirini bekliyordu. Veritabanı bu kilitlenmeyi (deadlock) kararı durdurarak çözüyor, sorumlu ya da yönetici "bir sorun çıktı" görüyordu.

- **Etki:** Güvenlik açığı değil, sağlamlık sorunu. Veri tutarlı kalıyordu, çünkü işlem geri dönüyordu. Ama karar yeniden verilmeliydi ve sunucu kaydına hata düşüyordu. Başvuran bunu bilerek tetikleyip kararı birkaç kez geciktirebilirdi; talep işleri saatte 10 ile sınırlı.
- **Kanıt:**
  - Elle hazırlanmış isteklerle 12 turun 2'sinde karar "failed" döndü. Sunucu kaydında "Transaction failed due to a write conflict or a deadlock" yazdı.
  - Sorun zamanlamaya bağlı. Test bu yüzden yarışı her seferinde kurar: başvuranın işini bir veritabanı bağlantısıyla aynı sırada kilitler. Eski kodda 3 denemenin 3'ü de "failed" verdi.
- **Düzeltme:** Karar da önce başvuranın satırını, sonra talebi kilitler (`lib/teacher/decide.ts` `lockApplication`). Başvuranın satırı `FOR NO KEY UPDATE` ile kilitlenir; böylece oturum açmak gibi o satıra yalnızca bağlanan yazımlar beklemez.
- **Regresyon testleri:**
  - `tests/unit/decide.test.ts` (kilit sırası)
  - `tests/e2e/security-phase-4.spec.ts` ("karar ile başvuranın geri çekmesi ya da cevabı aynı anda gelince…"): geri çekmede karar "bulunamadı" der, cevapta onaylar; hiçbirinde "failed" yok.

### D12 — "Bilgi iste", başvuranın cevabını silinemeyen kayıt defterine kopyalıyordu (düşük, önlem) — düzeltildi

Yönetici bilgi isteyince talepteki önceki soru ve **cevap** siliniyor, geri alınabilsin diye kayıt defterine yazılıyordu.

- Cevap, başvuranın yazdığı serbest metindir; telefon ya da görev yeri gibi kişisel veri içerebilir.
- Kayıt defteri silinemez ve hesap silinince de kalır.

- **Etki:** Hesap silinse de kişinin yazdığı metin kalıcı olarak saklanacaktı (KVKK, saklama süreleri). Bilgi istemeyi yalnızca yönetici yapabilir ve yönetim ekranı Faz 5'te gelecek. Faz 4'te bu yolu çağıran bir yer yok, yani canlıda etkilenen veri yok.
- **Düzeltme:**
  - Bilgi istemek cevap alanlarına dokunmaz. Önceki cevap talepte kalır ve yeni cevap gelince üstüne yazılır.
  - `answeredAt`, `questionAt`'ten önceyse cevap önceki soruya aittir.
  - Kayıt defterine yalnızca önceki soru ve zamanı yazılır. "Geri al" da yalnızca bunları geri getirir.
- **Regresyon testi:** `tests/unit/decide.test.ts` (eski kodda başarısız oluyor).

### D13 — Okul listesinde istek sınırı yoktu (düşük) — düzeltildi

Talep formunda il ve ilçe seçilince okullar `listSchools` ile gelir. Okul adları gizli değildir. Ama doğrulanmış her hesap bütün ilçeleri betikle, sınırsız sorgulayabiliyordu: okul listesi topluca çekilebiliyor, sunucuya gereksiz yük biniyordu.

- **Düzeltme:** Kullanıcı başına 10 dakikada 60 sorgu (`rateRules.schoolLookup`). Form her ilçeyi bir kez sorar. Sınır dolunca liste gelmez ve form "yüklenemedi" durumuna geçer.
- **Regresyon testi:** `tests/e2e/security-phase-4.spec.ts`, belge testinin sonu: 60 sorgu geçer, 61. sorgu `{ ok: false }` alır.
- **Sonra (sabah soruları 26b):** Okul listesi formdan kalktı, `listSchools` eylemi ve `schoolLookup` sınırı silindi. Öğretmen okulun adını yazar; ilçedeki okullar hiçbir kullanıcıya sorgulatılmaz. Test artık eylemin olmadığını denetler.

### Sonraya kalanlar (ürün kararı gerektirir)

- **D14 — Kayıt defterinde izi olan hesap silinemez.**
  - Okul sorumlusunun ve yöneticinin kayıt defterinde işlemleri var. Yöneticinin ayrıca eklediği okullar ve verdiği kararlar var. Bu bağlar silinemez (RESTRICT) ve kayıt defteri değiştirilemez.
  - "Hesabı sil" diyen sorumlunun hesabı bu yüzden kalır. Temizlik hatayı sunucu kaydına yazar, kişiye bir şey söylenmez.
  - Öneri (Faz 5): Bu hesaplarda silme yerine anonimleştirme yapılsın: ad ve e-posta silinir, satır kalır. Ya da silme isteğinde "önce okul sorumluluğunu devret" uyarısı gösterilsin.
- **D15 — Toplu oranın doğal sınırı.**
  - Bir grubun 5 kişisinin hepsi güvende kaldıysa ya da hepsi hacklendiyse, grup eklenince oranın değişiminden herkesin sonucu çıkar. Örnek: 5 bitirende %60 iken 10 bitirende %80 olursa, son 5 kişinin hepsi güvende kalmıştır.
  - Öğretmen öğrenci çıkararak grupları kaydırabilir. Çıkarmadan önceki ve sonraki oranı karşılaştırarak sonuç çıkarmaya çalışabilir.
  - Bunlar bilinçli çaba ister ve toplu sayı göstermenin doğal sınırıdır.
  - Öneri: Oranı daha kaba göstermek (ör. "çoğu güvende kaldı"), bitiren sayısı azken hiç göstermemek ya da çıkarılan öğrencinin sonucunu grupta tutmak.
- **D16 — Sınıf kodu yenilenemiyor.** Kod sınıf açılınca üretilir. Kod sızarsa (ör. sosyal medyada paylaşılırsa) öğretmen onu değiştiremez; yalnızca katılanları tek tek çıkarabilir. Öneri: "Kodu yenile" ve "katılımı kapat".
- **D17 — Karar verilmeyen talebin belgesi süresiz kalır.** Belge karar kesinleşince, talep geri çekilince ya da hesap silinince silinir. Hiç karar verilmeyen talepte kalır. Öneri: Bekleyen talepler için en uzun saklama süresi (ör. 90 gün) ve yönetimde "bekleyen talep" uyarısı.
- **D18 — Retten sonra 30 gün kuralı.** Kaynaklar birbirini tutmuyor:
  - Doküman (Bölüm 3, öğretmenlik talebi akışı, madde 6): "Reddedilen kullanıcı 30 gün sonra yeniden talep gönderebilir."
  - Tasarım (Tur 3): "Bilgileri düzeltip yeniden gönder."
  - Kod hemen izin veriyor; yalnızca saatte 10 talep işi sınırı var.

  Hangisinin geçerli olacağına ekip karar vermeli.

### Bilgi

- **B1 — Belgedeki EXIF bilgisi.**
  - Görsel tarayıcıda yeniden çizilir; konum gibi EXIF bilgileri bu sırada atılır.
  - Elle hazırlanmış bir istekle ham JPEG gönderilirse EXIF kalır. Denemede GPS etiketi saklandı.
  - Bu yalnızca kişinin kendi belgesini etkiler, kişi bu veriyi kendisi gönderir ve belgeyi yalnızca yönetim görür.
  - Faz 6'da sunucuda yeniden kodlama düşünülebilir.
- **B2 — Gövde sınırı bütün eylemlerde 6 MB.** Next.js eylem başına sınır vermez. Oturumsuz bir eylem de 5 MB'lık gövdeyi alıp sonra reddeder (denendi). nginx 6 MB'ta keser; istek sınırları ve doğrulama ayrıca çalışır. Etkisi yalnızca yük (`next.config.ts` yorumu güncellendi).
- **B3 — Sorumlunun "onayla"sı iki işlemdir.**
  - Önce sorumlunun görüşü yazılır, sonra talep onaylanır.
  - Aynı anda gelen bir "geri al" ikisinin arasında çalışırsa sonuç "onaylandı, görüş boş" olur. Denemede kayıt defterine sırasıyla şu satırlar yazıldı: onaylandı (sorumlu), geri alındı, onaylandı (talep).
  - Durum tutarlıdır, her adım kayıtta görünür ve sorumlu 30 saniye içinde yeniden geri alabilir.
  - Yalnızca elle hazırlanmış, aynı anda gelen isteklerle olur.
- **B4 — Sınıf sayfasında öğrenci kimlikleri.** Öğrenci çıkarabilmek için sayfada öğrencilerin rastgele kullanıcı kimlikleri bulunur. Öğretmen adları zaten görür. Kimlik başka bir yerde işe yaramaz, çünkü her eylem sahipliği denetler.
- **B5 — Tahta ekranı istek sınırı tüketmez.** Ekran 4 saniyede bir sorduğu için bilinçli olarak sınırsızdır. Yalnızca kendi sınıfında çalışır, yalnızca okur ve en fazla 200 satır döner; yükü bir sayfa açmaktan azdır.
- **B6 — Karar maili gönderilirken başvuranın satırı da kilitli kalır.**
  - Kesinleştirme, aynı mailin iki kez gitmemesi için maili talep kilitliyken gönderir.
  - D11'den sonra başvuranın kullanıcı satırı da kilitlenir, çünkü kilit sırası her yerde aynı olmalı.
  - Mail gönderilene kadar (en fazla 20 saniye; normalde 1 saniyenin altında) başvuranın kendi işleri bekler.
  - Oturum açmak gibi yalnızca bu satıra bağlanan yazımlar beklemez.

---

## Bu turda yapılan değişiklikler

- **Kod:**
  - `lib/cleanup.ts`: O1.
  - `lib/classroom/teacher-rules.ts`, `lib/classroom/teacher.ts`, `lib/i18n/messages/tr.ts` (gizlilik notu): O2.
  - `lib/teacher/decide.ts`: D11 (kilit sırası) ve D12 (cevap kayıt defterine girmez).
  - `lib/rate-limit.ts`, `lib/teacher/application-actions.ts`: D13.
  - `next.config.ts`: B2 yorumu.
- **Yeni testler:**
  - `tests/unit/cleanup.test.ts` (O1)
  - `tests/unit/decide.test.ts` (D11, D12)
  - `tests/unit/classroom.test.ts` (O2)
  - `tests/e2e/security-phase-4.spec.ts` (yetki, O2, D11, belge ve D13)
  - `tests/e2e/support/actions.ts`: sunucu eylemini elle hazırlanmış istekle çağırma yardımcısı.
- **Başlangıçtaki iki test hatası** (testin zamanlama yarışı):
  - `tests/e2e/labs-student.spec.ts`: rozet vitrinden çıkarıldıktan sonra sayfa, eylem bitmeden yenileniyordu.
  - `tests/e2e/lab-security.spec.ts`: ikinci sekme, deneme sunucuda açılmadan (başlangıç penceresi kapanmadan) açılıyordu.

## Faz 5 ve Faz 6'ya eklenen öneriler

1. **Faz 5, yönetimde belgeyi açma:**
   - Yalnızca yetkili yönetici açabilsin ve her açış kayıt defterine yazılsın.
   - Belge ayrı bir yoldan, kayıtlı türle (`Content-Type`) sunulsun.
   - `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` ve `Cache-Control: no-store` kullanılsın.
   - Önizleme gerekiyorsa yalnızca görsel ve PDF için olsun.
   - Bu kurallarla polyglot dosya tarayıcıda çalışmaz.
2. **Faz 5, talep ekranı:** `answeredAt`, `questionAt`'ten önceyse cevap "önceki soruya cevap" olarak gösterilsin (D12).
3. **Faz 5:** Kayıt defterinde izi olan hesaplar için anonimleştirme ya da devir uyarısı (D14).
4. **Ürün kararları:** D15–D18.
5. **Faz 6:** Belgedeki görselin sunucuda yeniden kodlanması (B1).
6. **Daha önce planlananlar** (burada yeniden tartışılmadı):
   - CSP, `media-src 'self'` dahil (tur 1 D2, tur 2 O2),
   - yük testinde Cloudflare gerçek IP denetimi (tur 1 D4),
   - Prisma yama sürümü yükseltmesi,
   - okullara açılmadan önce Resend planı.
