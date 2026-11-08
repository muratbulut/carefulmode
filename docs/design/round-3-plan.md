# Tur 3 planı · öğretmen

Tuval: [Careful Mode Ekranlar · Tur 3](https://claude.ai/artifact/9wsRpX3LRq3SUc3j9z5i7E). Çizim kaynakları `tasarim/tur3/kaynak/`, tahtaların yedeği `tasarim/tur3/`.

## Dokümandan gelenler (09 Öğretmen ve Sınıf Yönetimi)

- Bir ya da birden fazla sınıf; sınıf kodu ya da davet bağlantısı.
- Sınıf üyeliğini görme ve yönetme.
- Sınıfın tamamlama durumu ve konu bazlı zorlanma alanları.
- Anlaşılır ilerleme özetleri. Örnek: öğretmen sınıfa bir konu açar, öğrenciler bitirdikçe panelden izler.
- Öğretmen yalnızca kendi sınıflarının bilgisini görür.

## Kararlar ve varsayılanlar

- **Gizlilik (ana sayfadaki sınıf kartıyla aynı söz):** öğretmen öğrencinin sadece hangi labları bitirdiğini görür; raporlar ve puanlar öğrencide kalır. Zorlanma alanları sınıfın toplamından çıkar, öğrenci adı ya da puanı göstermez.
- Öğretmen de normal kullanıcıdır (lab çözer). Masaüstü menüsüne "Sınıflarım" eklenir. Mobil alt menü öğretmende: Ana sayfa, Lablar, (devam), Sınıflar, Profil. Yol haritası ana sayfadan açılır.
- 17 öğretmenlik talebi ayrı ekran olmayacak: profildeki "Öğretmenlik" bölümü (okul + branş) kullanılır, üstüne isteğe bağlı belge ve "inceleniyor" hali eklenecek.
- Tasarım kuralı (Tur 2): bir şey yaptıran yer sadece lablar.

## 18 · Sınıflarım + sınıf oluştur (10 Ekim, gece)

Örnek veri: Selin Yıldız; 7-B (28 öğrenci, Oltalama Limanı açık, 17 Ekim'e kadar, %62), 7-C (25, Hesap Kalesi, %38), Bilişim kulübü (12, Zararlı Yazılım Ormanı, %81). Sınıf oluşturma: ad + düzey → kod (R4N7C2), kodu/bağlantıyı kopyala, tahtaya yansıt. Yeni sınıf listeye "YENİ" etiketiyle eklenir. 4 varyant, masaüstü + mobil:

- C1 kartlar: sınıf kartları (kod, açık konu, tamamlama, son etkinlik) + "Yeni sınıf oluştur" kartı; oluşturma pencerede.
- C2 liste + çekmece: tablo gibi satırlar; oluşturma sağdan açılan çekmecede, mobilde ayrı sayfa.
- C3 pano: üstte özet (sınıf, öğrenci, bu hafta biten lab), "Dikkat isteyenler" kutusu, sınıf listesi; oluşturma sayfanın içinde açılır.
- C4 sürpriz, tahtaya yansıt: her kartta "Tahtaya yansıt". Tam ekranda kod büyük harflerle, QR, 3 adımlık tarif; katılan öğrencilerin adları ekrana düşer. Sınıf oluşturunca doğrudan bu ekran açılır.

Tahtaya yansıt ekranı bütün varyantlarda var (C1–C3'te küçük düğme).

## 19 · Sınıf detayı (10 Ekim, gece)

Örnek veri: 7-B, 28 öğrenci (Ayşe Y. öğrenci tarafıyla aynı: Hesap Kalesi'nde 3 lab, Oltalama'ya başlamadı). Açık konu Oltalama Limanı, 17 Ekim'e kadar, %62. Lablar şehir verisinden (16 lab, 4 mahalle).

Her varyantta ortak:
- Başlık: sınıf adı, öğrenci sayısı, kopyalanan sınıf kodu; "Kodu yansıt" (18'deki tahta ekranı) ve "Konu aç".
- Konu aç: 4 mahalleden biri + isteğe bağlı son tarih. Aynı anda bir konu açık; eskisi "geçmiş konular"a geçer, ilerleme silinmez.
- Öğrenci çekmecesi: açık konudaki labları bitirdi / henüz değil, mahallelere göre x/y, katılma tarihi, son lab zamanı. "Sınıftan çıkar" onay ister; hesap ve ilerleme silinmez.
- Lab özeti (sınıf toplamı): bitiren sayısı, bitirenlerin güvende kalma oranı ve en sık kaçırılan işaret. Oran en az 5 öğrenci bitirince görünür. Öğrenci puanı ya da raporu hiçbir yerde yok.

Varyantlar:
- D1 matris: öğrenci × lab tablosu (açık konu 4 lab / tüm lablar 16), ad sütunu sabit, altta "bitiren" satırı. Lab başlığına tıklayınca sağda özet. Sıralama: ada göre / en az bitiren önce.
- D2 sekmeli: Genel bakış (özet kutuları, konunun labları, konuya başlamayanlar) / Öğrenciler (arama + durum filtresi) / Konular (mahalle yüzdeleri, "Sınıfa aç").
- D3 konu odaklı: solda mahalleler, sağda seçili mahallenin lab kartları; "Kimler?" ile bitirmeyenler açılır; açık olmayan mahallede "Bu konuyu sınıfa aç".
- D4 sürpriz, ders öncesi özet: kâğıt görünümlü tek sayfa. "Derste konuşulacak 3 şey" (en zor geçen lab + sınıfa sorulacak soru, en çok bitirilmeyen lab, güçlü mahalle). "Tahtada göster" isimsiz sürümü açar, "Yazdır" var. Altında öğrenci listesi.

Kontrol: `kaynak/chk13.js` (eksik alan yok; konu açma, öğrenci çıkarma, arama/filtre, tahta akışları denendi).

## 17 · Öğretmenlik talebi (10 Ekim, gece)

Ayrı ekran yok; P2 profilindeki "Öğretmenlik" bölümü büyüdü. Örnek kişi Selin Yıldız (🦉). Dokümana göre sınırlı bilgi:
- Okul/kurum ve branş (zorunlu), kurumsal e-posta (isteğe bağlı, biçim kontrolü), öğretmen olduğunu gösteren belge (isteğe bağlı; kimlik numarası görünmesin uyarısı; karar verilince silinir).
- İnceleniyor: Gönderildi → İnceleniyor → Sonuç zaman çizgisi ve gönderilen bilgilerin özeti, "Talebi geri çek".
- Onaylandı: "Öğretmen hesabın açık", "İlk sınıfını oluştur" / "Sınıflarım'a git". Masaüstü menüye Sınıflarım (yeşil nokta), mobil alt menü öğretmen menüsüne döner, profil alt yazısı "Öğretmen · …".
- Onaylanmadı: yöneticinin notu + "Bilgileri düzeltip yeniden gönder" (okul ve branş dolu gelir). Bu not 21 (admin talepleri) ekranında yazılacak.

Tuvalde 3 durum ayrı tahta (Talep, Onay, Ret), hepsi masaüstü + mobil. Kontrol: `kaynak/chk14.js`.

Yan düzeltme (Tur 2 profili): "Sınıf" bölümündeki "Öğretmenin raporlarını görebilir" cümlesi gizlilik kararıyla çelişiyordu. Yeni hali: "Öğretmenin sadece hangi labları bitirdiğini görür, raporların sende kalır." `Profil-P2-Son` Tur 2 tuvalinde güncellendi.

## 3 · Öğretmenler için tanıtım (10 Ekim, gece)

Ziyaretçi sayfası, menüde "Öğretmenler için" seçili. Tur 2 kuralına uygun: bilgi verir, bir şey yaptırmaz; etkileşim sadece göz atma (SSS açılır, panel turu ve iki ekran akışı kendiliğinden ilerler). Ana çağrı "Öğretmen hesabı iste" (kayıt + profilden talep), ikincisi "Önce kendin dene". Ortak içerik: 4 adım (kayıt, talep, sınıf + kod, konu + izleme), "Ne görürsün / ne görmezsin" (gizlilik), 6 soruluk SSS.

- T1 klasik: kahraman (mini panel + kod kartı + "en sık kaçırılan" etiketi), 4 adım, gizlilik, 4 mahalle, SSS, kapanış.
- T2 bir ders saati: "40 dakikada bir siber güvenlik dersi" zaman çizgisi (kodu yansıt, lab, derste konuşulacak 3 şey, konuyu ödev bırak), her adımda küçük ekran.
- T3 panel turu: büyük panel önizlemesi üstünde 4 numara (sınıf kodu, açık konu, kim bitirdi, zorlanılan yer); kendiliğinden sırayla anlatır, tıklayınca durur.
- T4 sürpriz, iki ekran bir ders: solda öğretmen ekranı, sağda öğrenci telefonu; 4 adım eş zamanlı oynar (kod → katıl, konu aç → öğrencinin ana sayfasında belirir, lab biter → tabloda bir kutu dolar, rapor öğrencide kalır, ders öncesi özet).

Kontrol: `kaynak/chk15.js`.

## Murat kararları: 18 ve 19 (10 Ekim, 22:34)

- **18 Sınıflarım = C1 kartlar + C3'ün özeti ve "Dikkat isteyenler"** ("Dikkat isteyenler bilgisini öğretmene kesinlikle vermeliyiz"). Masaüstü: üstte 3 özet kutusu (sınıf, öğrenci, bu hafta biten lab); altta solda 2 sütun sınıf kartları + "Yeni sınıf oluştur" kartı, sağda "Dikkat isteyenler". Mobil: özet, dikkat isteyenler, kartlar. Tahtaya yansıt her kartta küçük düğme. Tuvalde `Siniflarim-Son`.
- **19 Sınıf detayı = D2 sekmeli** (sade, grafiklere boğmuyor, genel bakışla sınıfa hakim olunuyor). D1'deki öğrenci çekmecesi aynen D2'de. D1, D3, D4 elendi. Tuvalde `Sinif-Detay-Son`.
- **"Konu aç" → "Ödev ver"** (Murat: fiilen ödev veriyor). Murat kartta "Ödev ver"i seçti (22:37): düğme "Ödev ver", bant "ÖDEV", pencerede "Puanlanmaz, sadece kimin bitirdiği görünür", son tarih isteğe bağlı, aynı anda bir ödev. Murat başka kelime seçerse sadece `t3son.py` içindeki kelime tablosu değişir.
- Açık iş: öğrenci ana sayfasındaki sınıf kutusunda "Öğretmeninin verdiği ödev" satırı henüz çizilmedi (ödev penceresi "öğrencilerin ana sayfasındaki sınıf kutusunda görünür" diyor). Tur 3 kapanışında eklenecek.

## Tur 3 kapanışı (10 Ekim, 22:45)

- **17 onaylandı** (Murat: "öğretmenlik talebi kısmı gayet okey").
- **3 = T4 "İki ekran, bir ders"** (Murat: animasyonlu akış "direkt anlatıyor"). "Ne görürsün, ne görmezsin" bölümü T4'te akışın hemen altında duruyor. Tuvalde `Ogretmen-Tanitim-Son`. İleride revize gelebilir.
- "Görmezsin" maddeleri netleşti: "Sınıf dışında ne yaptığı" çıkarıldı, çünkü öğretmen bütün labların tamamlanmasını görüyor ve bu madde yanlış olurdu. Yeni maddeler: puan ve seviye; lab raporları ve labda yaptığı seçimler; bir labı kaç denemede bitirdiği; başka öğretmenlerin sınıfları.
- Öğrenci ana sayfasının sınıf kutusuna, sınıfa katıldıktan sonra görünen "Öğretmeninin verdiği ödev" eklendi: mahalle, x/4 lab, son tarih, "puanlanmaz" notu, sıradaki lab düğmesi. Tur 2 `Ana-Sayfa-Son` (masaüstü + mobil) güncellendi. Tur 3 tuvalinde `Ana-Sayfa-Odev` katılmış haliyle açılır. Kaynak: `kaynak/t3kapanis.py`.
- Yeni ekran **4c Genel SSS** (Murat önerisi): ziyaretçi, öğrenci ve öğretmen için tek sayfa. Tur 4'ten sonra çizilecek.
