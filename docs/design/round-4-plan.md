# Tur 4 planı · Yönetim paneli

Tuval: [Careful Mode Ekranlar · Tur 4](https://claude.ai/artifact/TxyQFgGbsAHxdjzqwsHEkL) · çizim kaynakları `tasarim/tur4/kaynak/` (`t4common.py` ortak kabuk, `t4talep.py` ekran 21)

## Dokümandan gelenler (Bölüm 10, Yönetici paneli)

- Kullanıcı hesapları: hesap, rol ve erişim yönetimi (22, çizilmeden kodlanır)
- Öğretmen başvuruları: inceleme, onaylama veya reddetme (21)
- Eğitim ve bölümler: konu, bölüm sırası, yayın durumu, içerik düzenleme (23)
- Senaryo ve lablar: senaryo akışı, seçenekler, açıklayıcı geri bildirimler (23)
- Raporlama ve sistem: tamamlanma istatistikleri, sistem kayıtları, ayarlar (20, çizilmeden kodlanır)

## Ortak kabuk (bütün admin ekranları)

- Masaüstü: solda 248 px menü (Özet, Öğretmen talepleri, Kullanıcılar, Lablar, Günün ipucu, Gündem), üstte amber "YÖNETİM" etiketi, altta "Siteye dön". Bekleyen talep sayısı menüde amber rozet.
- Mobil: üst çubuk + hamburger (bekleyen talep varsa amber nokta), soldan kayan menü.
- Her kararın ardından alt bildirim ve 5 saniye "Geri al".

## 21 Öğretmen talepleri

Örnek veri: 8 talep. Selin Yıldız, 17'deki talep formundan gelen kişi (Bahçelievler Ortaokulu, kurumsal e-posta + görev yeri belgesi). Biri zaten onaylı, biri reddedilmiş (notuyla).

Her talepte gösterilen:
- Ad, okul, branş, kurumsal e-posta (isteğe bağlı), belge (isteğe bağlı), talep tarihi, üyelik süresi ve bitirdiği lab sayısı
- 4 sinyal: kurumsal e-posta var mı, belge var mı, okul adı tam mı, aynı okuldan onaylı öğretmen var mı. Sinyallerden "Güçlü / Orta / Zayıf" etiketi çıkar (karar vermez, yardım eder)
- Belge önizlemesi: kimlik numarası maskeli, indirilemez, karar verilince otomatik silinir

Ret: hazır gerekçe çipleri (Okul doğrulanamadı / Bilgiler eksik / Belge okunamadı / Kendim yazayım), en az 10 karakter not. Not kullanıcının profilindeki Öğretmenlik bölümünde "Yöneticinin notu" olarak görünür (17 Ret hali ile aynı metin).

Varyantlar:
- **A1 Liste + ayrıntı:** solda talep listesi, sağda seçili talebin ayrıntısı. Mobilde liste, dokununca sağdan kayan ayrıntı sayfası.
- **A2 Tablo + çekmece:** satırda doğrudan Onayla / Reddet, "Aç" ile sağdan çekmece. Mobilde kartlar + alttan açılan sayfa.
- **A3 Tek tek inceleme:** sıradaki talep büyük kartta, ilerleme çubuğu, "Sonra bak", yanda "Sırada" listesi. Hepsi bitince "Bekleyen talep kalmadı".
- **A4 Sürpriz, kontrol listesi:** A1 düzeni + 4 maddelik kontrol listesi; onaylamak için en az 2 kontrol işaretlenmeli, reddetmek için gerekmez. "Okulu internette ara" kısayolu.

Öneri: A1 temel, A4'ün kontrol listesi üstüne eklenebilir.

**Murat kararı (11 Ekim, 00:31): A4 kontrol listesi.** Murat talep sayfasını "onayla / reddet / bekletirim" diye tarif etti; üçüncü düğme "Beklet, bilgi iste" eklensin mi diye soruldu.

## 23 Lab yönetimi

Örnek veri: 4 mahalle, 4 eğitim + 19 lab. 16 yayında (öğrenci haritasındaki lablarla aynı), 2 taslak (Sahte antivirüs uyarısı, Taksitli oyun parası), 1 gizli (Sahte burs duyurusu, notuyla).

- Durumlar: **Yayında**, **Taslak** (içerik dosyasından yeni geldi, öğrenci görmez), **Gizli** (yayındaydı, kaldırıldı).
- Eğitim kartları mahallenin girişi: hep ilk sırada, gizlenmez.
- Sıra: mahalle içinde yukarı / aşağı. Bu sıra öğrencinin haritadaki sırası.
- Gizlemek onay ister. Pencere, labın kaç sınıfta ödev olduğunu ve kaç öğrencinin labın ortasında olduğunu söyler. İlerleme silinmez; rapor, puan ve rozetler kalır. İsteğe bağlı not sadece yöneticilere görünür.
- Taslağı yayınlamak onay ister (haritada hangi sırada görüneceği, önizleme bağlantısı). Gizli labı geri açmak tek tık.
- Her değişiklikte 5 saniye geri al.

Varyantlar:
- **B1 Mahalle grupları:** her mahalle bir kart, satırda sıra okları, bitiren sayısı, güvende kalma, durum ve anahtar. Mobilde akordeon.
- **B2 Tablo:** üstte durum sayıları, durum / mahalle / arama filtresi, bitiren ve güvende kalmaya göre sıralama, seçip toplu yayınla / gizle.
- **B3 Liste + ayrıntı:** sağda labın istatistikleri, en sık kaçırılan işaret, senaryo akışı (adımlar, salt okunur), yayın geçmişi, önizle.
- **B4 Sürpriz, öğrenci gözünden:** solda yönetim listesi, sağda öğrencinin gördüğü şehir canlı güncellenir; "Taslakları da göster" anahtarı. Mobilde "Lablar / Öğrenci gözünden" geçişi.

~~Açık soru: lab içeriği panelden düzenlensin mi?~~ **Cevap (Murat, 11 Ekim): evet, panelden düzenlenecek** → 23b.

### 23 son hali (Murat, 11 Ekim 00:31)

- **B1 + B2'nin üstteki Yayında / Taslak / Gizli sayıları.** Sayıya tıklamak o durumu süzer, tekrar tıklamak kaldırır. B2'nin filtre çubuğu kafa karıştırdı, kalktı.
- Masaüstünde de mahalleler tek tıkla açılır / kapanır (mobildeki gibi), "Hepsini aç / kapat" var.
- Her labda **Düzenle** (23b'ye gider). Sağ üstte **Yeni lab**, her mahallenin başlığında **Lab ekle**: mahalle + şablon (dokümandaki 5 lab türü: gelen kutusu, sahte giriş sayfası, indirme sayfası, mesajlaşma, sosyal medya) + ad → mahallenin sonuna taslak olarak eklenir.
- Sıra gerçek: öğrencinin haritasındaki sıra (Murat sordu, cevap bu).
- Gizleme uyarısındaki ödev satırı sadece lab bir sınıfta ödevse çıkar (Murat: "ödev olarak verilmediyse uyarıya gerek yok").
- **Mahalle / şehir adları ileride değişecek** (Murat: "şu an değil").
- Tuvalde `Lablar-Son`, kaynak `kaynak/t4labson.py`, kontrol `kaynak/chk21.js`.

## 23b Lab düzenleme (içerik)

Örnek: Tur 1'deki "Sahte kargo maili" (Oltalama Limanı, O1, v3, 43 öğrenci labın ortasında). Lab modeli Tur 1 ile birebir:
- Kapak (ad, zorluk, süre) + hatırlatma kartı (en çok 4 madde).
- Sahne: Postam gelen kutusu. Her mail sahte ya da gerçek; sahte maillerde işaretler (Gönderen / Metin / Bağlantı) raporda numaralı gösterilir.
- Sahte sayfa: adres, başlık, istenen bilgi; şifre yazılırsa Hacklendin ekranı.
- Görevler: eylem, bildir, soru (3 seçenek, seçenek başına puan, doğrusu ve nedeni).
- Rapor: puan 10 üzerinden, durum (Güvende kaldın / Kıl payı / Hacklendin), "Bir dahaki sefere" ipuçları (hangi durumda çıkacağıyla).
- **Kontrol listesi (9 madde):** lab adı ve 2 hatırlatma; en az 1 sahte + 1 gerçek mail; her sahte mailde 3 işaret; sahte sayfa; en az 4 görev; her soruda 3 seçenek ve tam puanlı biri; doğrusu ve nedeni; **toplam puan 10**; en az 3 ipucu. Eksik varken yayınlanmaz, taslak kaydedilir.
- **Yayınlamak yeni sürüm açar (v3 → v4).** Labın ortasındaki öğrenci eski sürümle bitirir. 5 saniye geri al.

Varyantlar:
- **L1 Bölümler:** solda bölüm menüsü (Kapak, Gelen kutusu, Sahte sayfa, Görevler, Rapor), ortada form, sağda canlı önizleme. Mobilde liste → sayfa.
- **L2 Görev akışı:** görevler sırayla akış olarak, hacklenme yan dalı; göreve tıklayınca düzenlenir.
- **L3 Sahnede düzenle:** mailin üstünde kırmızı numaralı işaretler; kesikli "+" ile yeni işaret konur, tıklayınca açıklaması yazılır.
- **L4 Sürpriz, öğrenci gibi dene:** öğrencinin yolunu seç (bildirdi / açtı / linke tıkladı / şifresini yazdı, soruların cevapları), puan, durum ve çıkacak ipuçları anında görünür.

Kaynak `kaynak/t4labedit.py`, kontrol `kaynak/chk22.js`, `chk22b.js`.

## 22 Kullanıcılar (Murat'ın isteği, 11 Ekim)

Murat'ın istediği: öğretmenleri ve kullanıcıları rolleriyle görmek (öğrenci, öğretmen, yetkili), başka bir yönetici ya da sorumlu eklemek, kim neyi yaptı kayıtları (kime öğretmenlik / yöneticilik verildi, kim lab ekledi, izinler), bir öğretmenin sınıflarını onun gördüğü gibi görmek ve sistemi oturtup oturtmadığını anlamak ("ABC okuluyla anlaştık, 3 öğretmeni onayladım, sınıflarını oluşturdu").

Örnek veri: Bahçelievler Ortaokulu'nda 3 onaylı öğretmen (Ahmet Çelik, Nur Aydın, Emre Yalçın) + 21'den bekleyen 2 talep (Selin Yıldız, Zeynep Kaya); Kadıköy Anadolu Lisesi (Elif Şen), Nilüfer Fen Lisesi (Okan Tekin). 1.284 öğrenci. Ekip: Murat B. (Yönetici), Deniz A. ve Ayşe K. (Sorumlu).

- **Roller:** Öğrenci (kayıtla), Öğretmen (talep + onay), **Sorumlu** (yönetici ekler, sadece işaretlenen işleri yapar), **Yönetici** (her şey). Ekibe öğrenci hesabı eklenemez.
- **İzinler (taslak, Murat'la konuşulacak):** Öğretmen talepleri, Lab ekleme ve düzenleme, Lab yayınlama ve gizleme, Günün ipucu, Gündem, Kullanıcılar ve roller (sadece Yönetici).
- **Ekibe ekleme:** var olan hesabı ara → rol → izinler. Kişiye e-posta gider, ilk girişte iki adımlı doğrulama açması istenir. 5 sn geri al.
- **Kayıtlar:** kim, ne, ne zaman; tür (Talep, Rol, Lab, İçerik, Bakış) ve kişi süzgeci. Silinmez, düzenlenmez.
- **Öğretmen kurulumu (5 adım):** onaylandı → sınıf kurdu → öğrenciler katıldı (en az 5) → ödev verdi → sınıf bitiriyor (ödevi yarısı bitirdi). Etiket: Takıldı / Yolda / İyi gidiyor. Takılana adıma göre hazır hatırlatma e-postası (kayda geçer).
- **Öğretmenin gözünden:** öğretmenin Sınıflarım ekranı (özet kutuları, sınıf kartları, Dikkat isteyenler) salt okunur. Öğrenci adları ve kimin bitirdiği sınıf detayında, öğretmende kalır; puan hiçbir yerde yok. Bakış kayda geçer.
- Öğretmenlikten çıkarmak: sınıflar öğrencilerden gizlenir, ilerleme silinmez, 5 sn geri al.

Varyantlar:
- **K1 Sekmeler + çekmece:** Öğrenciler / Öğretmenler / Yönetim ekibi / Kayıtlar. Öğretmene tıklayınca sağdan çekmece (kurulum adımları, sınıfları, gözünden bak, hatırlat).
- **K2 Okullara göre:** her okul açılır kart, okulun 5 adımlık kurulum hunisi, öğretmen satırında sınıflar açılır; sağda ekip ve son kayıtlar.
- **K3 Ekip ve izinler:** kişi × izin tablosu (anahtarlar, anında geçerli), roller kartları, altta kayıtlar.
- **K4 Sürpriz, kurulum panosu:** 5 sütun (adımlar), her öğretmen durduğu sütunda; okul süzgeci ve huni. Sadece öğretmen kısmı.

Kaynak `kaynak/t4kul.py`, kontrol `kaynak/chk23.js`.

## 24 Günün ipucu yönetimi

Öğrenci tarafı (Tur 2 ana sayfa): sarı kart, tarih, tek cümlelik ipucu, "Neden?" ile açılan açıklama. Önizleme bu kartın birebir aynısı.

- Model: ipuçları **havuzdan sırayla** döner, en uzun süredir gösterilmeyen önce çıkar. İstenirse bir ipucu belirli bir güne **sabitlenir**. Bugünün ipucu değiştirilemez, yarından itibaren seçilir.
- Alanlar: ipucu (20–140 karakter), "Neden?" açıklaması (en az 20 karakter), mahalle, ilgili lab (isteğe bağlı), ne zaman (otomatik ya da gün seç).
- Durumlar: Havuzda, Taslak (öğrenciye gitmez), Arşivde.
- İstatistik: kaç kez gösterildi, "Neden?"e bakma oranı (Meraklı rozetiyle bağlantılı).
- Örnek veri: 12 ipucu havuzda (her lab için bir tane), 2 taslak.

Varyantlar:
- **C1 Takvim:** önümüzdeki 14 gün; güne tıklayınca otomatik ya da havuzdan bir ipucu seçilir.
- **C2 Havuz + düzenleyici:** solda liste (mahalle filtresi, arama), sağda form ve canlı önizleme.
- **C3 Genel bakış:** üstte "Bugün öğrenciler bunu görüyor" ve sayıları, ortada sıradaki 6 gün, altta havuz tablosu.
- **C4 Sürpriz, dil kontrolü:** yabancı ve teknik kelimeleri (phishing, 2FA, OTP, sosyal mühendislik…) işaretler, sade karşılığını önerir, tek tıkla değiştirir; uzun cümle ve 140 karakter uyarısı, "ortaokul öğrencisi okur mu?" göstergesi.

## 24b Gündem yönetimi

Tur 2 kararlarına göre: haberleri ekip yazar, haftada 1, Cuma 08.00'de yayınlanır; metin kopyalanmaz, kaynak adı yazılır; kaynağa gidişte "Careful Mode'dan ayrılıyorsun" penceresi. Alanlar öğrenci tarafındaki H2 haber detayıyla birebir.

- Alanlar: başlık (70), özet (180), Ne oluyor?, örnek mesaj (gönderen + metin, isteğe bağlı), Nasıl anlarsın? 3 işaret (kısa işaret + açıklama), Ne yapmalısın? (her satır bir madde), Kısaca 3 madde, konu, ilgili lab, kaynak adı ve adresi, yayın haftası.
- **Yayına hazır mı?** listesi: eksik varken planlanamaz, taslak kaydedilebilir.
- **Kaynak kontrolü:** adres https olmalı ve güvenilir listede olmalı (gov.tr, BleepingComputer, The Hacker News, ESET WeLiveSecurity, Kaspersky, NCSC, CISA). Değilse uyarır ve planlatmaz.
- Aynı haftaya ikinci haber planlanırsa önceki taslağa döner (uyarılır). Durumlar: Yayında, Planlandı, Taslak. Her işlemde geri al.
- Örnek veri: 8 yayında (Tur 2'deki haberler), 1 planlı (16 Ekim), 3 taslak (biri hazır, biri eksik, birinin kaynağı güvenilir listede değil).

Varyantlar:
- **E1 Liste + editör:** sekmeli liste (Yayında / Planlı / Taslak, okuma sayısı ya da eksikler), tıklayınca tam sayfa editör, sağda "Yayına hazır mı?" ve düğmeler.
- **E2 Editör + canlı önizleme:** yazdıkça sağda öğrencinin göreceği H2 sayfası. Mobilde "Yaz / Önizle".
- **E3 Haftalık yayın planı:** geçmiş 5 hafta ve önümüzdeki 4 Cuma; boş hafta uyarısı, boş haftaya hazır taslağı tek dokunuşla planla, eksikli taslak düzenleyicide açılır.
- **E4 Sürpriz, adım adım:** 1 kaynak (öğrencinin göreceği "ayrılıyorsun" penceresi önizlemesiyle), 2 haber, 3 işaretler, 4 bağla ve planla.

## 4c Sık sorulan sorular (herkese açık)

Bilgi sayfası, bir şey yaptırmaz. Ziyaretçi header'ı, footer'dan bağlantı. 19 soru, 4 konu: Genel, Öğrenciler, Öğretmenler, Gizlilik ve aileler. Cevaplar önceki kararlarla aynı (öğretmen sadece bitirdi / bitirmedi görür, ödev puanlanmaz, haberleri ekip yazar, lablar zararsız, öğrenciler arası mesajlaşma yok).

Yer tutucular (gerçek bilgi gelince yazılacak): **[İLETİŞİM E-POSTASI]**, **[KVKK AYDINLATMA METNİ]**. "Şifremi unuttum" akışı ve "Hesabı sil" ekranı mevcut tasarımlara göre anlatıldı.

Varyantlar:
- **F1 Klasik:** başlık + arama, konu çipleri (sayılarıyla), akordeon, altta "Cevabını bulamadın mı?".
- **F2 İki sütun:** solda yapışkan konu menüsü (tıklayınca o bölüme kayar), sağda konu konu bütün sorular, "Hepsini aç / kapat".
- **F3 Sen kimsin?:** Öğrenciyim / Öğretmenim / Aileyim / Sadece bakıyorum; seçince o kişiye ait sorular üstte, herkesin sorduğu diğerleri altta.
- **F4 Sürpriz, anında arama:** büyük arama kutusu, çok sorulanlar çipleri, yazdıkça sonuçlar süzülür ve eşleşen kelimeler vurgulanır, ilk sonuç açık gelir.

## Murat kararları: 23, 23b, 22 (11 Ekim, 01:13)

- **23 Lab yönetimi son hali onaylandı** (masaüstü ve mobil). Murat sordu: "Yeni lab" ile mahalledeki "Lab ekle" aynı pencere; üstteki mahalleyi seçtirir, mahalledeki o mahalleyi seçili açar. Yeni mahalle oluşturan bir şey yok (mahalle adları değişirken konuşulacak).
- **23b = L1** (sol bölümler, ortada form, sağda öğrencinin gördüğü). L2 karışık, L3 farklı bulundu.
  - Murat: her labın düzenleme içeriği farklı olacak (video vb.), sorun değil. → Kapak, görevler, rapor sabit; sahne bölümü şablona göre (gelen kutusu: mailler, mesajlaşma: sohbet, eğitim: video).
  - Murat: panelde kod yazdırmak doğru değil, yazılım bilmeyen biri de lab yapabilmeli. "object Object" bir çizim hatasıydı (metin kutusuna değer çocuk olarak verilmişti); bütün Tur 4 metin kutularında düzeltildi.
- **22:** K1 beğenildi (sekmeler, öğretmen çekmecesi, ekip). K2 de beğenildi: **ikisi aynı sayfada iki sekme (Genel / Okullar)**. K3'e gerek yok (izinler K1'deki "İzinleri düzenle"den), K4 sürpriz içine sinmedi.
  - Sorumlu birden fazla ya da tek göreve sahip olabilir, sadece o sayfaları görür: beğenildi.
  - **Kayıtlar** Kullanıcılar altında değil, menüde ayrı "Kayıt defteri"; yöneticiler görür, sorumluya "kayıt defterini görme" izni verilebilir.
  - **Yeni fikir: okul sorumlusu / okul müdürü.** Bir kişi hem okul sorumlusu hem öğretmen olabilir. Okul sorumlusu K2'yi (kendi okulu) görür.
- Açık sorular (Murat'a soruldu): okul sorumlusu kendi okulunun öğretmen taleplerini onaylayabilsin mi; öğrenci ekibe eklenebilsin mi (Murat "öğrenci de olabilir" dedi, öneri kapalı kalması); 21'e "Beklet, bilgi iste"; L4'ün "öğrenci gibi dene"si L1'de sekme olsun mu.

## Son haller: 23b, 22, 22b (11 Ekim, gece)

- **23b Lab düzenleme son hali** (`Lab-Duzenle-Son`, `Lab-Duzenle-Son-SMS`): L1 düzeni. Bölümler: Kapak, Sahne, Tuzak, Görevler, Rapor ve ipuçları. Kapak, görevler, rapor her labda aynı; Sahne ve Tuzak labın şablonuna göre değişir (bölüm adları, alan adları, öğrencinin gördüğü sahne). İki örnek aynı ekranla çizildi: gelen kutusu (Sahte kargo maili) ve mesajlaşma (Kodu soran "arkadaş", sahte mesaj doğrulama kodu istiyor). Sağ sütunda "Önizleme / Öğrenci gibi dene" sekmesi: L4 ayrı ekran olmadı, buraya girdi. Lablar-Son'daki her labın Düzenle'si kendi şablonuna gider.
- **22 Kullanıcılar son hali** (`Kullanicilar-Son`, `Kullanicilar-Son-Okullar`): üstte iki görünüm, Genel ve Okullar.
  - Genel = K1 sekmeleri (Öğrenciler / Öğretmenler / Yönetim ekibi). Okul sorumlusu olan öğretmenin yanında "OKUL SORUMLUSU" etiketi.
  - Okullar = K2 + her okulda okul sorumlusu satırı ("Sorumlu ata / Değiştir"). Sağ üstte "Okul ekle" (okul adı, il, isteğe bağlı sorumlu). Sorumlu adayları: o okulun öğretmenleri ve okulu olmayan üyeler; başka okulun sorumlusu listede çıkmaz; öğrenci seçilirse "Öğrenci hesabı okul sorumlusu olamaz".
  - Okul bazında seçenek: "Kendi okulundan gelen öğretmen taleplerini onaylayabilir" (varsayılan açık, Murat'ın cevabı bekleniyor). Kapalıysa talepler yöneticiye gelir.
  - Okul sorumlusu ne görür: sitede "Okulum" sayfasında sadece kendi okulu (öğretmenler, kurulum adımları, sınıf özetleri). Öğrenci adı, puan, rapor yok. Bu sayfa henüz çizilmedi.
  - Ekip izinleri 7 oldu: Talepler, Lab düzenleme, Lab yayını, İpucu, Gündem, **Kayıt defteri**, Roller (Roller sadece yöneticide, kilitli).
  - Atama, kaldırma, okul ekleme kayıt defterine yazılır, 5 sn geri al.
- **22b Kayıt defteri** (`Kayit-Defteri`): menüde Kullanıcılar'ın altında ayrı sayfa. Üstte "Bu sayfayı görenler" (yöneticiler + izinli sorumlular, izin değişince anında güncellenir). Arama (kişi, okul, lab adı), tür ve kişi filtresi; masaüstünde tablo (zaman, kim, tür, ne yaptı), mobilde kartlar. Kayıtlar silinmez, düzenlenmez.

## Murat kararları: son haller (11 Ekim, 01:41)

- **23b son hali onaylandı** (gelen kutusu ve mesajlaşma şablonları, önizleme / öğrenci gibi dene).
- **22 son hali ve Kayıt defteri onaylandı.** "6 öğretmenlik talebi bekliyor"dan doğrudan taleplere gitmesi beğenildi.
- **Yeni istek, öğrenci profili:** Öğrenciler sekmesinde öğrenciye tıklayınca admin kısa bir profil görsün, KVKK'ya girmeyecek kadar: Ad S. (soyadın baş harfi), bitirdiği lablar, son aktiflik, lab yapma sıklığı. Çizim kararı: e-posta, tam soyad, puan ve rapor cevapları görünmez; profile bakmak kayıt defterine yazılır; sadece yöneticiler.
- **Okul adı eşleşmesi (Murat'ın sorusu):** Öğretmen okul adını serbest yazarsa "Atatürk Ortaokulu" ile "atatürk ortaokulu" farklı okul sayılır. Murat'ın önerisi: admin okulu imla hatasız ekler, öğretmen o okula talep gönderir, okulu yoksa destek mailine yazar. Benim önerim (çiziliyor): öğretmen il, ilçe seçip listeden okulunu seçer; yoksa "Okulum listede yok" deyip adını yazar, talep "Yeni okul" etiketiyle gelir, admin okulu tek tıkla ekleyip onaylar. Admin okul eklerken il ve ilçe listeden seçilir, aynı ilçede benzer ad varsa uyarı çıkar. Okul verisi dışarıdan (MERNİS vb.) çekilmiyor.
- **Sorulara cevaplar:** (1) Okul sorumlusu kendi okulunun taleplerini onaylayabilsin: **evet**, okul bazında tik. (3) 21'e **"Bilgi iste" evet**: reddetmek yerine öğretmenden ek bilgi istenir. (4) **Okulum sayfası çizilecek**, Tur 4'ün son işi. (2) Anlaşılmadı, örnekle tekrar soruldu: öğrenci yönetim ekibine sadece Gündem ve İpucu izniyle girebilsin, okul sorumlusu olamasın (öneri, böyle çiziliyor).
- **Tur 4'ün kapanışı:** bu revizeler + Okulum + 24, 24b, 4c seçimleri. Sonra yeni ekran turu yok; 4 açık karar (14, 15, seviye ve rozet tabloları, veli onayı) kodlamaya geçerken kapanır, ardından GitHub reposu ve Faz 03 altyapı.

## 01:41 revizyonları ve 22c Okulum (11 Ekim, gece)

- **22 öğrenci profili** (`Kullanicilar-Son-Ogrenci`): Öğrenciler sekmesinde satıra tıklayınca sağdan çekmece. Ad S., sınıf · öğretmen · okul (sınıfı yoksa "kendi başına çalışıyor"), kaç lab bitirdi, son aktif, haftada kaç lab, katılma tarihi, son 4 haftanın gün gün takvimi, mahalle bazında ilerleme, bitirdiği labların listesi. E-posta, tam soyad, puan, rapor cevabı yok. Profile bakmak kayıt defterine "Bakış" olarak yazılır.
- **22 okul ekle:** il ve ilçe listeden seçilir, ad yazılır. Aynı ilçede benzer ad varsa sarı uyarı ve "Yine de ekle"; birebir aynısı varsa eklenmez.
- **22 öğrenci yönetim ekibinde:** öğrenci seçilirse rol "Sorumlu · öğrenci", sadece İpucu ve Gündem izni açılabilir, diğerleri kilitli. Okul sorumlusu olamaz. (Murat'ın Evet / Hayır cevabı bekleniyor.)
- **21 son hali** (`Talepler-Son`, `Talepler-Son-YeniOkul`): sekmeler Bekleyen / Bilgi istendi / Onaylanan / Reddedilen. Üçüncü düğme "Bilgi iste": hazır sorular (kurumsal e-posta, görev yeri belgesi, okulun tam adı) ya da kendi sorusu; soru öğretmenin profiline gider, cevap gelince talep "CEVAP GELDİ" etiketiyle Bekleyen'e döner. Listede olmayan okuldan gelen talep "YENİ OKUL" etiketli: aynı ilçede benzer okul varsa "Bu okul mu?" ile eşlenir (geri alınır), yoksa admin adı düzeltip onaylarken okul listeye eklenir.
- **17 son hali** (`Ogretmenlik-Son`, `Ogretmenlik-Son-Bilgi`): il, ilçe, sonra okul listesi; en altta "Okulum listede yok" (ad yazılır, yönetici kontrol edip ekler notu). **Sonra (sabah soruları 26b, 12 Ekim):** Murat'ın ilk önerisine dönüldü, okul listesi kalktı. Öğretmen il ve ilçeyi seçip okulun adını yazar; aynı adlı okul varsa talep ona bağlanır, yoksa yönetici eşler ya da adı düzeltip ekler. Kimse ilçedeki okulları göremez. Bilgi istendi hali: yöneticinin sorusu, cevap kutusu, belge ekleme, "Cevabı gönder" ya da "Talebi geri çek".
- **22c Okulum** (`Okulum-O1..O4`): okul sorumlusu Ahmet Çelik (Bahçelievler Ortaokulu, aynı zamanda öğretmen). Menüde "Okulum" sadece sorumluda çıkar. Ortak parçalar: 4 sayı kutusu (öğretmen, sınıf, öğrenci, bu hafta biten lab), öğretmen satırları (5 adımlık kurulum çubuğu, İyi gidiyor / Yolda / Takıldı), takılana "Hatırlat" (adımına göre: sınıfını kur, ilk ödevi ver...), okulundan gelen talepler ("Okulumda çalışıyor, onayla" ya da "Tanımıyorum": karar yöneticiye kalır), sınıf kartları (toplam yüzde, öğrenci adı yok), haftalık lab grafiği, öğretmen davet bağlantısı (açan öğretmenin formunda okul seçili gelir), "Ne görürsün, ne görmezsin" kutusu. Onay, hatırlatma kayıt defterine yazılır, 5 sn geri al. Yeni onaylanan öğretmen "Yeni katıldı" olarak görünür, takılan sayılmaz.
  - **O1 Pano:** her şey tek sayfada, solda öğretmenler ve sınıflar, sağda talepler, haftalık grafik, davet.
  - **O2 Sekmeler:** Genel / Öğretmenler / Sınıflar / Talepler (bekleyen sayısı sarı rozet).
  - **O3 Kurulum hunisi:** 5 adımlık kanban, her sütunda o adımdaki öğretmenler; altında okulun kurulum hunisi. Mobilde sütunlar yana kayar.
  - **O4 Sürpriz, haftalık okul bülteni:** her pazar kendiliğinden yazılan bülten ("Bu hafta 34 lab bitirildi, geçen haftadan 8 fazla" gibi), "Müdüre gönder" ve "PDF olarak indir". Öğrenci adı ve puan içermez.

## Murat kararları: Tur 4 kapanış (11 Ekim, 02:18)

- **Öğrenci yönetim ekibinde:** sadece İpucu ve Gündem izniyle, okul sorumlusu olamaz. **Evet**, çizildiği gibi.
- **22c Okulum = O4 haftalık okul bülteni.** "Müdür ya da okul sorumlusu okuduğunda tık, direkt anlar." Küçük değişiklikler gelebilir.
- **21 ve 17 son hali onaylandı** (okul listeden, yeni okul, Bilgi iste). **22 öğrenci profili onaylandı.**
- **24 İpucu = C3** (bugün + sıradaki 6 gün + havuz; "bugün gören, Neden?'e bakan" bilgileri beğenildi). C4 sürprizi beğenilmedi.
- **24b Gündem = E1 liste + editör.** E2 beğenilmedi: düzenleme ve önizleme aynı ekranda olunca yazma ve görme alanı daralıyor, karışıyor. İstek: önizleme aç-kapa ile, Taslak kaydet ile Planla arasında bir düğme, basınca önizleme ekranı açılsın. Çizildi (`Gundem-Son`, `Gundem-Son-Onizleme`): üç düğme Taslak kaydet / Önizle / Planla; önizleme tam ekran, üstte "Düzenlemeye dön", "Öğrenci böyle görür", eksik varsa sarı satır, Bilgisayarda / Telefonda seçimi, oradan da planlanabilir. Mobilde önizleme sağdan kayan tam sayfa.
- **4c SSS = F3 "Önce söyle: sen kimsin?".** F1'in araması ve F2 de beğenildi ama son karar F3. Murat'ın notu: "öğrenciyken bile ailenin bilgilerini görmek isterim" → rol seçilince altta diğer grupların sorularına tek dokunuşla geçiş ve "Diğer bütün soruları göster" eklendi (`SSS-Son`, `SSS-Son-Ogrenci`).
- **SSS üst menüye:** Yol haritası, Lablar, Gündem, Öğretmenler için, **SSS**, sonra Giriş yap / Ücretsiz kayıt ol. (Mobil ziyaretçi üst barında menü yok; SSS mobilde Tur 5'teki ziyaretçi menüsüne / alt bilgiye girecek.)
- **Tur 4 kapandı.** Murat: "Tur 5 var mı? Başka neler kaldı? Tasarımsal. Onlara geçelim ve onları bitirelim."
