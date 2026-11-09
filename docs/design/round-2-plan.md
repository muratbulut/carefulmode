# Tur 2 planı

Tuval: [Careful Mode Ekranlar · Tur 2](https://claude.ai/artifact/37CyJtkysjEVCX7WM1CzVc). Çizim kaynakları `tasarim/tur2/kaynak/` (t2home.py, t2home2.py, t2home3.py; Tur 1'in t1c.py ve t1common.py dosyalarını kullanır, onlar `tur1/kaynak/` içinde).

Ekranlar: öğrenci ana sayfası (masaüstü), 9 yol haritası + 1 ziyaretçi, 10 lablar + 2 ziyaretçi, 16 profil.

## Öğrenci ana sayfası (masaüstü)

**Murat'ın kararları (10 Ekim)**

- Alt kısım onaylandı: yol haritası (4 kategori kartı), son raporlar, sağ sütunda günün ipucu ve sınıfa katıl. Bunların yeri değişmeyecek.
- Üst kısım profil kartı olacak. 5 varyant içinden A (kimlik kartı) seçildi; üzerinden süzülen ışık efekti kalacak.
- Kartın başlığı "Careful Mode kimlik" değil, **"Careful Mode profili"**.
- Ad soyad tam yazılır. Altında eğitim durumu: "7. sınıf", mezunsa "Mezun", belirtmek istemediyse hiçbir şey yazılmaz. "Ekim 2026'dan beri üye" mutlaka kalır.
- İstatistikler kalır: biten lab, okunan kart, rapor.
- Son labın içeriği ana sayfada gösterilmez (lab adımları, açıklama vs. lab sayfasında zaten var).
- **Seviye + puan sistemi gelecek** (aşağıda taslak). Puan kartta bir yerde görünür.
- **Rozetler olacak.** Kartta en fazla 5 rozetlik vitrin; öğrenci hangilerini göstereceğini profil > düzenle'den seçer. Kötü durursa 3'e indirilir.
- Güvenlik kalkanı (E varyantındaki fikir: 4 kategori = kalkanın 4 parçası) karttan bağımsız, yol haritasının üstünde ayrı bir bölüm olacak.
- A'nın 4 varyasyonundan **A1 seçildi** (uzayan kart: isim altında seviye çipi + sonraki seviyeye puan çubuğu, puan sağ üstte, en altta 5 rozetlik vitrin).
- **Güvenlik kalkanı iptal** (Murat'ın içine sinmedi).
- Kart uzayınca sağ sütunda boşluk kalıyordu: günün ipucu ve sınıfa katıl altına **"Sıradaki rozetin"** kartı eklendi (kilitli rozet, görevi, ilerleme çubuğu).
- Son hali tuvalde "Seçilen: A1 son hali" sırasında (`Ana-Sayfa-A1-Son`). **Üst kısım onaylandı (10 Ekim).**
- Alt kısım için 4 varyasyon çizildi, seçim bekleniyor: Alt 1 haftalık hedef + etkinlik takvimi, Alt 2 gündem haberi + yeni lablar, Alt 3 sekmeli (yol haritası / raporlar / rozetler), Alt 4 sürpriz: günün meydan okuması (her gün tek soru, doğruysa 10 puan, seri sayacı).

## Seviye ve puan sistemi (taslak, Murat onaylamadı)

Puan kuralı önerisi:

- Eğitim labını bitirmek: 100 puan
- Senaryo labı: rapor puanı × 20 (10/10 = 200 puan)
- Aynı labı tekrar yapınca sadece en iyi deneme sayılır (puan kasılamasın)
- Şu anki içerikle (4 eğitim + 12 senaryo labı) en fazla 2.800 puan

| Seviye | Unvan | Gereken puan |
|---|---|---|
| 1 | Acemi | 0 |
| 2 | Dikkatli gezgin | 150 |
| 3 | Bilinçli kullanıcı | 400 |
| 4 | İz sürücü | 700 |
| 5 | Dedektif | 1.000 |
| 6 | Kalkan ustası | 1.350 |
| 7 | Uzman | 1.700 |
| 8 | Koruyucu | 2.050 |
| 9 | Siber muhafız | 2.400 |
| 10 | Siber kahraman | 2.700 |

Yeni lab eklendikçe eşikler gözden geçirilecek.

## Rozetler (taslak)

Vitrinde en fazla 5 tane. Katalog önerisi (12 rozet):

- Kategori rozetleri: Şifre ustası (hesap güvenliği), Oltalama avcısı, Virüs savar (zararlı yazılım), Cüzdan bekçisi (kişisel veri ve para)
- Tüm kategoriler: 4 kategorinin hepsi (adı kalkan iptal olduğu için değişecek)
- İlk rapor: ilk senaryo labını bitirmek
- Kart kurdu: bir eğitim labındaki bütün kartları bitirmek
- Kusursuz: bir labdan 10/10 almak
- Geri dönüş: hacklendiğin bir labı tekrar yapıp güvende kalmak
- Sınıf arkadaşı: bir sınıfa katılmak
- Meraklı: günün ipucunda "Neden?"e 7 farklı gün bakmak
- Siber kahraman: 10. seviyeye ulaşmak

Örnek ekranlardaki veri: Ayşe, Seviye 3 · Bilinçli kullanıcı, 660 puan (4. seviyeye 40 puan), rozetler Şifre ustası, İlk rapor, Kart kurdu.

## Alt kısım: gündem ve yenilikler (10 Ekim)

- Alt 1'deki etkinlik takvimi (GitHub tarzı kareler) Murat'a anlamsız geldi: neyi saydığı belli değil. Önerim: takvimi çıkaralım. Haftalık hedef fikri istenirse profil tarafında düşünülür.
- **Gündem bölümü beğenildi**, kalacak. Yanına ne gelecek, 4 varyasyon tuvalde (seçim bekleniyor):
  - G1: gündem + "Siber tarihten" (geçmişten gerçek bir olay ve dersi)
  - G2: gündem + "Haftanın kavramı" (ör. smishing) + kısa yeni lablar listesi
  - G3: haber akışı (Türkiye, dünya, tarihten) + yeni lablar
  - G4: gündem + günün meydan okuması (soru gündemdeki konuyla bağlantılı)

### Haberler nereden gelecek? (değerlendirme)

**Seçenek 1: Dış habere link vermek.** Ucuz ama sorunlu:
- Haber siteleri reklam, tık tuzağı başlık ve çocuğa uygun olmayan içerikle dolu.
- Link zamanla kırılır ya da haber değişir.
- Çocuğa "bilmediğin linke tıklama" diyen bir platformun onu başka siteye göndermesi çelişki.
- Kaynak kalitesini biz kontrol edemiyoruz.

**Seçenek 2: Haberleri kendimiz yazmak (önerim).**
- Admin tarafında "Gündem yönetimi" ekranı olur (günün ipucu yönetimine benzer): başlık, kısa metin, kaynak adı, tarih, ilgili lab, yayın tarihi.
- Metni güvenilir kaynaklardan okuyup çocuğun anlayacağı dille kendimiz yazarız. Metni kopyalamayız, kaynak adını yazarız (telif sorunu olmaz).
- Kaynak önerileri: USOM duyuruları, Emniyet Siber Suçlarla Mücadele, BTK; yabancı: BleepingComputer, The Hacker News, ESET WeLiveSecurity, Kaspersky blogu.
- Sıklık: **haftada 1 haber** gerçekçi. Her gün yazmak bir bitirme projesinde sürdürülemez. Birkaç haber önceden yazılıp tarihli yayına alınabilir.
- Kaynağa link verilecekse sadece resmi/güvenilir adreslere, ve tıklayınca "Careful Mode'dan ayrılıyorsun, adres: …" ara ekranı çıkar. Bu ara ekran da başlı başına bir ders olur.

**Seçenek 3: Otomatik çekmek (RSS vb.).** İçerik denetlenmeden çocuğa gider, çoğu İngilizce. Önermiyorum. İleride yarı otomatik olabilir: admin ekranına aday haber listesi düşer, admin seçip kendi diliyle yazar.

**"Siber tarihten" ve "Haftanın kavramı":** bunlar bir kere hazırlanan bir havuzdan döner (ör. 40–50 olay, 30–40 kavram). Haftalık emek istemez, gündem haberi olmayan haftalarda da bölüm boş kalmaz.

Bu karar Tur 4'e bir admin ekranı ekler: **Gündem yönetimi**.

## Gündem ve istatistikler (10 Ekim, akşam)

- **Ana sayfa bir şey yaptırmaz, bilgi verir.** Günün meydan okuması çıkarıldı. Etkinlik takvimi de çıkarıldı.
- Bölüm adı: **Gündem ve istatistikler**. Solda "Gündemde · bu hafta" haberi (haberleri biz yazıyoruz). Sağda sekmeli **Lab istatistikleri** (sekmeler sağ üstte):
  - En çok çözülen: ilk 5
  - En yeni: son eklenen 5
  - En zorlu: en az kişinin güvende kaldığı 5 (öneri)
- İstatistikler herkesin toplam verisi, kimsenin adı geçmez. Öğrencinin bitirdiği lablarda "Bitirdin" işareti çıkar.
- Tuvalde: `Ana-Sayfa-Gundem-Istatistik`.

**Ziyaretçi tarafı (öneri, Murat'ın onayı bekleniyor):** Gündem herkese açık olsun. Haberler blog gibi okunur; ziyaretçi için de faydalı, siteye güven verir, arama motorlarında da görünür. Bunun için:
- Tanıtım sayfasına (Tema H) bir "Gündemde" bölümü eklenir: son 3 haber. Küçük bir revize.
- Yeni ekranlar: **Gündem listesi** ve **haber detay sayfası** (giriş gerektirmez).
- Admin: **Gündem yönetimi** (24b).
- İstatistik sekmeleri ziyaretçide de gösterilebilir ("En çok çözülen" iyi bir vitrin olur), ama "Bitirdin" işaretleri olmadan.

**Ana sayfa kapandı (10 Ekim).** Gündem ve istatistikler onaylandı. Notlar:
- Sekme geçişindeki "flaş" efekti (büyüyüp küçülme) yumuşak kayarak belirmeye çevrildi. Başka geçiş varyasyonları ileride denenebilir.
- Gündem kartında metin üstte kalıyor, ortada boşluk var. Gerçek haber içeriği gelince düzenlenecek.

**Tur 2 sırası (güncel):** 9 + 1 yol haritası → 10 + 2 lablar → 16 profil → en sonda gündem paketi (tanıtım sayfasına "Gündemde" bölümü, gündem listesi, haber detay). Gündem kodda lab akışından sonra yapılacak.

## 9 · Yol haritası (10 Ekim)

5 varyant tuvalde, seçim bekleniyor. Hepsinde aynı üst kısım: başlık, kısa açıklama, işaret açıklaması (bitti, sıradaki, açık, kilitli) ve genel ilerleme kartı + devam et.

- Y1 açılır kategori satırları (kompakt; sıradaki kategori açık gelir)
- Y2 metro hattı (her kategori bir hat, lablar duraklar)
- Y3 dört sütun (her kategori bir sütun)
- Y4 kıvrımlı yol (tüm lablar tek yolda, tilki "Buradasın")
- Y5 sürpriz: siber şehir haritası (4 bölge: Hesap Kalesi, Oltalama Limanı, Zararlı Yazılım Ormanı, Para Çarşısı; noktaya tıklayınca yanda lab bilgisi)

Kural: kategoriler serbest sırada; bir kategorinin senaryo labları, o kategorinin eğitim labı bitince açılır.

Örnek lab adları (12 senaryo): Hesap güvenliği: 123456 ile korunan hesap, Kodu soran "arkadaş", Ortak bilgisayarda açık kalan hesap. Oltalama: Sahte kargo maili, Sahte hesap uyarısı, Çekiliş tuzağı. Zararlı yazılım: Bedava oyun hilesi, Sahte güncelleme uyarısı, USB'deki sürpriz dosya. Kişisel veri ve para: Kafedeki sahte QR kod, Sahte ikinci el ilanı, Konumunu paylaş isteği. (Taslak, içerik yazılırken değişebilir.)

Ziyaretçi hali (1): seçilen varyant üzerinden çizilecek; ilerleme yok, laba tıklayınca kayıt penceresi.

### Y5 siber şehir seçildi, esnek yerleşim (10 Ekim)

Murat Y5'i beğendi ama kategorilerdeki lab sayısı eşit olmayacak (ör. 2'ye 8), sabit yerleşim bozulur. 4 esnek varyasyon çizildi, örnek veri bilerek dengesiz: Hesap Kalesi 7, Oltalama Limanı 4, Zararlı Yazılım Ormanı 3, Para Çarşısı 2 senaryo labı. Hiçbirinde elle konum yok, yerleşim lab sayısından hesaplanır:

- H1 mahalle kartları: her mahalle bir kart, sokak 4 labda bir alt satıra kıvrılır (yılan düzeni). Kart lab sayısı kadar uzar.
- H2 ana cadde: bütün mahalleler tek yatay caddede, mahalle genişliği = lab sayısı × sabit aralık; yatay kaydırma + üstte şehrin tamamını gösteren şerit.
- H3 adalar: her mahalle bir daire ada, yarıçap lab sayısıyla büyür, lablar halkaya eşit açıyla dizilir; sığmayan ada alt satıra geçer. (12'den fazla labda ikinci halka gerekir.)
- H4 şehirden mahalleye: önce mahalle kartları (sayı arttıkça alt satıra geçer), mahalleye girince o mahallenin kendi haritası açılır (yılan düzeni). En ölçeklenebilir olanı.

Yeni kategori (5. mahalle) eklenince hepsi kendiliğinden yer açar.

### H4 seçildi, mahalle içi (10 Ekim)

Şehir görünümü (mahalle kartları) onaylandı. Mahalle içindeki ray/yılan düzeni "çok klasik" bulundu. 5 varyasyon tuvalde, hepsi lab sayısına göre kendini dizer. Ortak üst kısım: Şehre dön, mahalle başlığı + ilerleme, "Mahalle girişi · eğitim" kutusu:

- İ1 bina silüeti: her lab bir bina, boyu zorluğa göre; bitenlerin ışıkları yanık. Yanda bilgi paneli.
- İ2 kapılar: her lab numaralı bir kapı; biten kapı açık, kilitli kapıda asma kilit. Yanda bilgi paneli.
- İ3 görev panosu: lablar panoya iğnelenmiş kağıtlar; bitenlerde "ÇÖZÜLDÜ 8/10" damgası.
- İ4 liste + büyük önizleme: solda filtreli liste (Hepsi / Yapmadıklarım / Bitenler), sağda seçilen labın büyük önizlemesi.
- İ5 sürpriz, asansörlü kule: her lab bir kat, giriş katı eğitim; kata tıklayınca tilki asansörle o kata çıkar. Lab eklendikçe kule yükselir.

### İ4 seçildi, varyasyonlar + mobil (10 Ekim, akşam)

Murat: İ1 çocukça, İ2 gereksiz, İ3 fazla değişik; İ4 liste + önizleme beğenildi. Bu ekranın 9 Yol haritası olduğu teyit edildi: şehir görünümü (H4) roadmap'in kuş bakışı, mahalle içi kategorinin yol haritası.

**Mobil kuralı (Murat'ın isteği):** bundan sonra her varyant masaüstü + mobil (390 px) ikili çizilir. Ana sayfanın mobil hali (1.3D) profil kartı, gündem ve istatistik sekmelerinden önce çizildi, Tur 2 bitmeden yeni yapıya göre güncellenecek.

4 varyasyon tuvalde (her birinin yanında mobil karşılığı, mobilde "Siber şehir" düğmesiyle tek sütun mahalle listesine dönülür):

- İ4-A rota çizgisi: liste, girişten (eğitim) başlayan dikey bir rota çizgisine bağlı; bitirdiğin labların arasında çizgi mahallenin rengini alır. Sağda önizleme. Mobil: laba dokununca alttan panel açılır.
- İ4-B ayrıntılı önizleme: filtreli liste + zengin önizleme ("Bu labda neler yapacaksın?" 3 adım, zorluk, süre, bitiren kişi sayısı, senin en iyi puanın, önceki / sonraki lab). Mobil: laba dokununca ayrı sayfa açılır, başla düğmesi altta sabit.
- İ4-C gruplu liste: "Sıradaki önerimiz" (ya da "Önce eğitim" / "Kaldığın yer") öne çıkar, sonra açık lablar, katlanmış "Bitirdiklerin (ortalama puan)", kilitliler. Mobil: alttan panel.
- İ4-D sürpriz, yerinde açılan satırlar: ayrı önizleme yok, satır yerinde açılır. Üstte mahalle yolu şeridi, yanda mahalle özeti (bitirdiğin, ortalama puan, önünde kalan süre, mahalleyi bitirince kazanılacak rozet). Mobilde de aynı davranış, en az sürprizli olan.

### 9 kapandı: İ4-A rota çizgisi + ziyaretçi hali (10 Ekim, akşam)

Murat İ4-A rota çizgisini seçti ("bitire bitire gidiyoruz, enerjisi veriyor"), mobil hali de onaylandı. Yol haritası son hali: siber şehir mahalle kartları (H4) → mahalleye girince rota çizgili liste + sağda önizleme; mobilde laba dokununca alttan panel.

Ziyaretçi hali (ekran 1) aynı tasarımın ilerlemesiz hali olarak çizildi (masaüstü + mobil): durum ve puan yok, satırda sadece süre; kural öğrencideki gibi: eğitim labı açık, senaryo labları kilitli ("Eğitimi bitirince açılır"); önizlemedeki düğme "Kayıt ol ve başla", Tur 1'deki kayıt penceresini açar. Masaüstünde sağ üstte "İlerlemeni kaydet" kartı, mobilde altta sabit "Ücretsiz kayıt ol" düğmesi (ziyaretçide alt menü yok).

Sıradaki: 10 Lablar + 2 ziyaretçi (kategori sayfası), sonra 16 Profil.

**Karar (Murat onayladı):** Mahalle içi zaten kategori sayfası işini görüyor. Bu yüzden ayrı kategori sayfası (2 / 10'daki kategori görünümü) çizilmez, mahalle içi kategori sayfası sayılır; 10 Lablar bütün labları arayıp filtrelemeye yarayan bir katalog olur. İleride çelişen bir yer çıkarsa orası değiştirilir.

## 10 · Lablar kataloğu (10 Ekim, akşam)

Kategori sayfası ayrı çizilmiyor (mahalle içi o işi görüyor). Lablar sekmesi bütün labların (4 eğitim + 16 senaryo) kataloğu: arama, filtre, sıralama. Laba tıklayınca lab detay sayfasına (11) gider; kilitli lablarda "Önce ... eğitimi bitince açılır" yazar. 4 varyant tuvalde, her biri masaüstü + mobil:

- L1 ızgara + çipler: arama, durum (Hepsi / Yapmadıklarım / Bitenler), sıralama (Önerilen, En yeni, En çok çözülen, En kısa), renkli kategori çipleri, kart ızgarası. Mobilde yatay kayan çipler, yatay kart listesi.
- L2 yan filtre paneli + liste: solda onay kutulu gruplar (kategori, tür, zorluk, durum), sağda sonuç listesi. Mobilde "Filtreler · 2" düğmesi alttan panel açar, "N labı göster" ile kapanır.
- L3 raflar: en üstte "Sıradaki önerimiz", altında yana kayan raflar (Yeni eklenenler, Kısa ve kolay, Puanını yükselt, En çok çözülenler). Arama yazınca raflar yerine sonuçlar.
- L4 sürpriz, "Bugün ne kadar vaktin var?": süre (10 dk / 20 dk / Fark etmez) + amaç (Yeni bir şey / Puanımı yükselteyim / Kolaydan başlayayım) seçilir, "Sana göre 3 lab" çıkar; altta bütün lablar kategoriye göre açılır kapanır.

### L1 seçildi, ayrıntılı filtre içine yediriliyor (10 Ekim, akşam)

Murat L1 ızgara + çipleri beğendi ama filtre yetersiz ("kolay labları görmek istesem nasıl yapacağım?"). L2'nin yan filtresi (kategori, tür, zorluk, durum) L1'in içine yediriliyor; en uygun yer arama ile kartlar arası. 4 varyant tuvalde (açılışta örnek olarak "Kolay" filtresi seçili, seçili filtreler kaldırılabilir etiket olarak görünür), her biri masaüstü + mobil:

- F1 açılır filtre düğmeleri: aramanın altında Kategori / Tür / Zorluk / Durum düğmeleri, tıklayınca küçük açılır kutu. Mobilde düğmeler yana kayar, dokununca o filtre alttan panelde açılır.
- F2 açılır filtre paneli: aramanın yanında "Filtreler" düğmesi, tıklayınca arama ile kartlar arasında 4 sütunlu panel açılır. Mobilde bütün filtreler tek alttan panelde.
- F3 filtre satırları: her grup kendi satırında çoklu seçilebilir çiplerle, her zaman açık. Mobilde kategori satırı açık, diğerleri "Tür, zorluk, durum" ile açılır.
- F4 katlanır yan panel: L2'nin yan paneli ama gizlenebilir, gizleyince ince bir şeride döner ve ızgara genişler. Mobilde altta yüzen "Filtreler" düğmesi.

### 10 kapandı: L1 + F1 + ziyaretçi hali (10 Ekim, gece)

Murat F1'i seçti. Mobilde filtre düğmeleri görünmüyordu; sebep: telefon çerçevesinin kaydırma alanı içerik taşınca yana kayan satırları sıfır yüksekliğe sıkıştırıyordu (arama yapınca sonuç azalıp görünür oluyordu). Bütün mobil tahtalarda düzeltildi (yana kayan satırlar artık sıkışmıyor). Kodlarken aynı kural geçerli: kaydırma alanındaki yatay kayan satırlara `flex-shrink: 0`.

Ziyaretçi hali çizildi (Tur 1 kararı: lab listesi herkese açık): durum filtresi yok, her kartta "Kayıtla açılır", karta tıklayınca Tur 1'deki kayıt penceresi; üstte "Labların hepsi ücretsiz" kayıt şeridi, mobilde altta sabit kayıt düğmesi.

Sıradaki: 16 Profil. Bekleyen: ana sayfanın mobil hali yeni yapıya göre.

### 16 · Profil (10 Ekim, gece)

Bütün varyantlarda aynı içerik, sadece yerleşim farklı. Hepsi çalışıyor: avatar seçilir, rozete dokununca vitrine girer/çıkar (en fazla 5, kazanılmamışa dokununca nasıl kazanılacağı çıkar), tema, şifre gücü listesi, sınıf kodu (6 karakter), öğretmenlik talebi (okul + branş), hesabı silme penceresi ("SİL" yazınca açılır, silindikten sonra geri alma şeridi). Avatarlar şimdilik emoji, gerçek set ileride çizilecek.

- P1 sekmeli: profil başlığının altında Rozetler / Avatar / Hesap / Güvenlik / Sınıf ve öğretmenlik / Hesabı sil sekmeleri. Mobilde sekmeler yana kayar.
- P2 ayarlar menüsü: masaüstünde solda menü, sağda seçili bölüm. Mobilde telefon ayarları gibi liste, dokununca bölüm sayfası sağdan kayarak açılır.
- P3 tek sayfa: bütün bölümler alt alta, masaüstünde solda yapışkan içindekiler. Mobilde akordeon.
- P4 sürpriz, vitrin odası: profil sayfası önce bir vitrin; büyük avatar, rozet rafı, "son kazandığın" ve "sıradaki rozetin" kartları. "Profili düzenle" ile rozet ızgarası açılır, ayarlar dişli düğmesiyle çekmecede.

Veri tutarsızlığı hâlâ açık: Şifre ustası kazanılmış ama Hesap Kalesi 3/7.


### 16 kapandı: P2 ayarlar menüsü (10 Ekim, gece)

Murat P2'yi seçti, mobildeki sağdan kayan sayfa tasarımını çok beğendi. Değişiklik: profil açılınca rozetler değil **hesap bilgileri** gelsin. Yeni sıra: Hesap bilgileri, Rozetler, Avatar, Görünüm, Güvenlik, Sınıf, Öğretmenlik, Hesabı sil. Son hali tuvalde "16 Profil · seçilen P2, son hali" sırasında (`Profil-P2-Son`).

Sıradaki: mobil ana sayfa güncellemesi ve gündem paketi (Tur 2 kapanışı). Genel ilerleme `screen-list.md` içinde "Tasarım ilerlemesi".
## Öğrenci ana sayfası · mobil, yeni yapı (10 Ekim, gece)

Onaylı 1.3D'nin yeni masaüstü yapısına göre güncellenmesi. İçerik masaüstüyle aynı: A1 profil kartı (seviye, puan, istatistikler, 5'lik rozet vitrini), günün ipucu, sıradaki rozetin, gündem, sekmeli lab istatistikleri, yol haritası (siber şehrin 4 mahallesi), son raporlar, sınıfa katıl. "Kaldığın yerden devam et" alt menünün ortasındaki düğmede. 4 varyant tuvalde:

- M1 düz akış: masaüstündeki sıra alt alta.
- M2 kaydırmalı kartlar: sade profil kartı, altında "Bugün" şeridi (gündem, ipucu, sıradaki rozet, sınıfa katıl yana kayar), sonra istatistik, 2x2 mahalle kartları, raporlar.
- M3 sekmeli: profil + ipucu + sınıf üstte, altında yapışkan sekmeler (Gündem, İstatistik, Şehir, Raporlar).
- M4 sürpriz, hikâyeler: üstte halkalar (Gündem, İpucu, Rozet, Yeni lab, Rekor). Dokununca tam ekran kart açılır, üstte ilerleme çizgileri, 6 saniyede kendiliğinden geçer, sağa/sola dokunarak gezilir; izlenen halka grileşir.

Not: masaüstü ana sayfadaki "Yol haritan" bölümü hâlâ eski 4 kategori kartını gösteriyor (Hesap güvenliği 3/3). Mobilde siber şehir verisi kullanıldı (Hesap Kalesi 3/7); seçimden sonra masaüstü de buna göre güncellenecek.


**Mobil ana sayfa kapandı (10 Ekim, gece):** Murat M2'yi seçti. Masaüstü ana sayfanın yol haritası bölümü de siber şehre göre güncellendi (4 mahalle kartı, Hesap Kalesi 3/7, Oltalama Limanı'nda "Sıradaki: Sahte kargo maili"); raporlarda kategori yerine mahalle adı. Son hali tuvalde "Öğrenci ana sayfası · son hali" sırasında (`Ana-Sayfa-Son`, `Ana-Sayfa-Son-Mobil`).

Sıradaki: gündem paketi (tanıtım sayfasına "Gündemde" bölümü, gündem listesi, haber detay), Tur 2'nin son işi.
## Gündem paketi (10 Ekim, gece)

Herkese açık, giriş gerekmez. Örnek 8 haber (Ağustos–Ekim, haftada bir) tuvalde yer tutucu; metinler ve kaynak adları gerçek yayından önce yazılacak. Etiketler 4 konuya göre (Hesap güvenliği, Oltalama, Zararlı yazılım, Kişisel veri ve para), renkleri mahalle renkleri. Ziyaretçi header'ına "Gündem" linki eklendi. "Labda dene" ziyaretçide kayıt penceresi açar.

**Gündem listesi (4 varyant, masaüstü + mobil):** hepsinde konu filtresi (Tümü + 4 konu, sayılarıyla).
- G1 dergi: üstte bu haftanın büyük kartı, altında 3 sütun haber kartları. Mobilde büyük kart + küçük satırlar.
- G2 zaman çizelgesi: aylara bölünmüş dikey çizgi; masaüstünde sağda "Son 3 ayın konuları" ve kayıt kutusu.
- G3 liste + önizleme: solda liste, sağda seçilen haberin özeti ve "Ne yapmalısın?". Mobilde dokununca alttan panel.
- G4 sürpriz, çevir kartlar: kartı çevirince arkasında o haberden çıkarılacak tek cümle.

**Haber detay (3 varyant):** başlık, özet, yazan ve okuma süresi, kapak, "Ne oluyor? / Nasıl anlarsın? / Ne yapmalısın?", örnek SMS, "Bu konuda pratik yap" lab kutusu, kaynak kutusu, diğer haberler. "Kaynağa git" → **"Careful Mode'dan ayrılıyorsun"** penceresi (adres gösterilir, .gov.tr hatırlatması).
- H1 klasik makale (tek sütun).
- H2 yan sütunlu: sağda yapışkan "Kısaca" (3 madde), lab kutusu, kaynak. Mobilde "Kısaca" başlığın altında.
- H3 sürpriz, işaretleri bul: örnek SMS'te 3 şüpheli yere dokununca açıklama açılır, hepsi bulununca "Labda dene".

**Tanıtım sayfası "Gündemde" bölümü (3 varyant):** adımların altına, yol haritasının üstüne.
- S1 üç kart. S2 büyük manşet + 3 satır. S3 sürpriz: kayan haber şeridi (üstüne gelince durur) + manşet.

**Gündem seçimi (10 Ekim, gece):** Murat **G2 zaman çizelgesi + H2 yan sütunlu + S2 manşet** seçti. Gerekçe: G1 ve S1'in kart ızgarası lablara ve tanıtımdaki adımlara benziyordu, G2 haber akışına özgü bir yapı veriyor; sağ sütun (konular + "okumak yetmez, dene") hoşuna gitti. S3 kayan şerit "haber sitesi" havası verdiği için elendi. H2 şablon olarak seçildi, içinde küçük değişiklikler yapılabilir.

Öneri (onay bekliyor): H3'teki "işaretleri bul" kutusu H2'nin "Nasıl anlarsın?" bölümüne girsin. Giriş yapmış öğrencide G2'nin sağ sütunundaki kayıt kutusu yerine ilgili lab ya da "sıradaki labın" çıksın.


**Gündem kapandı, Tur 2 bitti (10 Ekim, gece).** Murat: "işaretleri bul" H2'ye girmesin. **Tasarım kuralı: bir şey yaptıran yer sadece lablar. Ana sayfa, gündem ve haber detayı bilgi verir; okunur, geçilir.** (Ana sayfadan meydan okumanın çıkarılmasıyla aynı karar.)

Giriş yapmış öğrenci hali çizildi (`Gundem-G2-Ogrenci`, `Gundem-Detay-H2-Ogrenci`): header'da "Gündem" linki (Ana sayfa, Yol haritası, Lablar, Gündem), G2'nin sağında kayıt kutusu yerine "Sıradaki labın" kartı, bitirilen labın yanında "Bitirdin", H2'deki lab kutusunda "Laba başla". Mobil alt menüde Gündem yok; öğrenci ana sayfadaki gündem kartından gelir.

Sıradaki: Tur 3 (öğretmen): 18 sınıflarım + sınıf oluştur, 19 sınıf detayı, 17 öğretmenlik talebi, 3 öğretmenler için tanıtım.