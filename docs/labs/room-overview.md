# Oda planı: bütün dallar ve odalar

21 Ekim 2026, Murat Bulut. Claude Docs'taki aynı adlı sayfanın kopyası; depoya 29 Ekim'de girdi, mahalle paylaşımı eklendi.

Bu dosya planın **özetidir**: mahalleler, sahneler, her odanın türü, sahnesi ve beklediği kod işi bir bakışta. Her odanın hikâyesi, tuzağı, doğru kararı, işaretleri ve ana sorusu [`room-plan.md`](room-plan.md)'de; odanın tam senaryosu ve kimin yazdığı [`rooms/`](rooms/README.md) altındaki mahalle tablolarında. Çelişki olursa `room-plan.md` ve mahalle tabloları geçerlidir; bu özet onlarla birlikte güncellenir.

## Kim yazıyor (29 Ekim)

| Mahalle | Yazan | Oda |
| --- | --- | --- |
| Hesap Kalesi | Dilek | 12 |
| Yazılım Ormanı | Dilek | 13 |
| Oltalama Limanı | Murat | 14 |
| Para Çarşısı | Murat | 10 |
| Dostluk Parkı | Beklemede: diğer dört mahalle bitince paylaşılacak | 12 |

Dilek 25, Murat 24 oda. Her mahallenin bütün odaları (eğitimler ve senaryolar) aynı kişide; mahalle tablosundaki "Yazan" sütunu da buna göre dolu.

## Özet

Plan 5 mahalle, 18 eğitim odası ve 43 senaryo odası, toplam 61 oda. Her mahallede bir temel eğitim ve 2 ya da 3 ileri eğitim var. Her senaryo odasını kendi eğitimi açıyor. Plan 17 Ekim'deki oda kurguları sunumundan geliyor (metin hâli [`room-plan.md`](room-plan.md)). Yapı ise 15 Ekim'de Murat'la kararlaştırıldı ve 16 Ekim'de siteye girdi.

| Mahalle | Konu | Eğitim odası | Senaryo odası | Toplam |
| --- | --- | --- | --- | --- |
| Hesap Kalesi | Hesap güvenliği | 3 | 9 | 12 |
| Oltalama Limanı | Oltalama ve sahte içerik | 4 | 10 | 14 |
| Yazılım Ormanı | Zararlı yazılım | 4 | 9 | 13 |
| Para Çarşısı | Kişisel veri ve para | 3 | 7 | 10 |
| Dostluk Parkı | Güvenli iletişim | 4 | 8 | 12 |
| **Toplam** |  | **18** | **43** | **61** |

Sitede bugün 3 oda var: Oltalama eğitimi ve "Sahte kargo maili" yayında, "Kodu soran arkadaş" taslakta. İlk dalga 16 oda olarak planlandı: her mahallenin temel eğitimi ve onun açtığı 11 senaryo. Bu 16 oda bitince 5 mahalle rozeti ve Şehir turu kazanılabilir hâle gelir.

## Oda türleri ve sahneler

Odalar iki türdür: eğitim odasında öğrenci kartlarla öğrenir, senaryo odasında (simülasyon) sahte bir ekranda karar verir. Senaryo odasını bir eğitim açar.

- **Eğitim odası (18):** bilgi kartı, mini test, tıkla-bul ve isteğe bağlı video. Temel eğitim her zaman açıktır; ileri eğitimler temel bitince açılır.
- **Senaryo odası (43):** bir sahne, bir sahte öğe (tuzak) ve yanında gerçek öğeler, bir ana soru. Yanlış kararda "Hacklendin" ekranı gelir, sonunda rapor verilir. Dostluk Parkı'nda yanlış kararın sonucu daha yumuşak bir ekran olacak.

Senaryo odalarının sahne türleri:

| Sahne | Ne gösterir | Senaryo sayısı | Durum |
| --- | --- | --- | --- |
| Mesajlar | Mesajlaşma, grup, oyun sohbeti, SMS | 20 | Sitede var |
| Akış | Sosyal medya: profil, gönderi, takip isteği, gizlilik ayarı | 8 | Yeni şablon, önce tuvalde çizilecek |
| Postam | Mail kutusu | 6 | Sitede var |
| Cihaz | Telefon ve bilgisayar ekranı: kurulum, izin, USB, Wi‑Fi, QR | 6 | Yeni şablon |
| Tarayıcı | Web sayfası: indirme sayfası, sahte uyarı, ilan | 3 | Yeni şablon |

## Mahalle mahalle odalar

61 odanın 23'ü bugünkü sahnelerle hemen yazılabilir: 12 eğitim ve 11 senaryo (3'ü zaten sitede). Kalan 38 oda kod işi bekler: 6 eğitim ve 15 senaryo küçük bir eklenti, 17 senaryo yeni bir sahne şablonu. Tablolarda her eğitim kalın yazılır, açtığı senaryolar hemen altındadır. "Yazmak için gereken" sütunu odanın hangi kod işini beklediğini söyler; "Hazır" bugünkü sahnelerle yazılabilir demektir. Her odanın hikâyesi, tuzağı, doğru kararı ve üç işareti [`room-plan.md`](room-plan.md)'deki kendi bölümündedir.

### Hesap Kalesi

Yazan: **Dilek**.

| Oda | Tür | Sahne | Yazmak için gereken | Durum |
| --- | --- | --- | --- | --- |
| **Şifre ve iki adımlı doğrulama** | Temel eğitim | Eğitim kartları | Hazır | Yazılacak |
| Kodu soran "arkadaş" | Senaryo | Mesajlar | Hazır | Taslakta |
| Gece gelen giriş uyarısı | Senaryo | Postam | Hazır | Yazılacak |
| Oyun sohbetinde yeni arkadaş | Senaryo | Mesajlar | Hazır | Yazılacak |
| **Ortak cihazlar ve veri sızıntısı** | İleri eğitim | Eğitim kartları | Hazır | Yazılacak |
| Aynı şifre her yerde | Senaryo | Postam | Hazır | Yazılacak |
| Kütüphane bilgisayarında açık hesap | Senaryo | Cihaz | Cihaz şablonu | Yazılacak |
| **Sosyal medya ve mahremiyet** | İleri eğitim | Eğitim kartları | Resimde tıkla-bul | Yazılacak |
| Herkese açık profilden bulunmak | Senaryo | Akış | Akış şablonu | Yazılacak |
| Paylaşmadan önce bak | Senaryo | Akış | Akış şablonu | Yazılacak |
| Canlı konum isteyen kalabalık grup | Senaryo | Mesajlar | Hazır | Yazılacak |
| Ödev asistanı kılığında uygulama | Senaryo | Mesajlar | Hazır | Yazılacak |

### Oltalama Limanı

Yazan: **Murat**.

| Oda | Tür | Sahne | Yazmak için gereken | Durum |
| --- | --- | --- | --- | --- |
| **Sahte mesajı tanımak** | Temel eğitim | Eğitim kartları | Hazır | Yayında |
| Sahte kargo maili | Senaryo | Postam | Hazır | Yayında |
| Karne günü gelen mail | Senaryo | Postam | Hazır | Yazılacak |
| **SMS, arama ve sahte destek** | İleri eğitim | Eğitim kartları | Resimde tıkla-bul | Yazılacak |
| "Kartınız bloke edildi" SMS'i | Senaryo | Mesajlar | Hazır (M1) | Yazılacak |
| Kod isteyen "Destek Ekibi" | Senaryo | Mesajlar | Hazır | Yazılacak |
| "Polisim, savcıyım" araması | Senaryo | Mesajlar | Sesli mesaj ve arama | Yazılacak |
| **Bağlantı ve cihaz** | İleri eğitim | Eğitim kartları | Resimde tıkla-bul | Yazılacak |
| Okul panosundaki QR kod | Senaryo | Cihaz | Cihaz şablonu | Yazılacak |
| Kafede bedava Wi‑Fi | Senaryo | Cihaz | Cihaz şablonu | Yazılacak |
| **Sahte içerik ve yapay zekâ** | İleri eğitim | Eğitim kartları | Hazır | Yazılacak |
| "Yeni numaram bu" diyen kuzen | Senaryo | Mesajlar | Sesli mesaj ve arama | Yazılacak |
| Afet sonrası sahte yardım kampanyası | Senaryo | Akış | Akış şablonu | Yazılacak |
| Ünlünün videosunda bedava telefon | Senaryo | Akış | Akış şablonu | Yazılacak |

### Yazılım Ormanı

Yazan: **Dilek**.

| Oda | Tür | Sahne | Yazmak için gereken | Durum |
| --- | --- | --- | --- | --- |
| **Zararlı yazılım nereden bulaşır** | Temel eğitim | Eğitim kartları | Hazır | Yazılacak |
| Ödev diye gelen ekli dosya | Senaryo | Postam | Ek dosya tuzağı | Yazılacak |
| Sınıf grubundan gelen hileli uygulama | Senaryo | Mesajlar | Ek dosya tuzağı | Yazılacak |
| **Oyun dünyası ve hileler** | İleri eğitim | Eğitim kartları | Resimde tıkla-bul | Yazılacak |
| Videodaki hile linki | Senaryo | Tarayıcı | Tarayıcı şablonu | Yazılacak |
| Bedava elmas jeneratörü | Senaryo | Tarayıcı | Tarayıcı şablonu | Yazılacak |
| **Uygulama izinleri ve güncelleme** | İleri eğitim | Eğitim kartları | Resimde tıkla-bul | Yazılacak |
| Rehberini isteyen el feneri | Senaryo | Cihaz | Cihaz şablonu | Yazılacak |
| Kargo uygulaması diye gelen dosya | Senaryo | Mesajlar | Ek dosya tuzağı (M1 hazır) | Yazılacak |
| Gerçek güncelleme hangisi? | Senaryo | Cihaz | Cihaz şablonu | Yazılacak |
| **Fidye yazılımı ve yedekleme** | İleri eğitim | Eğitim kartları | Hazır | Yazılacak |
| Koridorda bulunan flash bellek | Senaryo | Cihaz | Cihaz şablonu | Yazılacak |
| Korsan dizi sitesindeki oynatıcı | Senaryo | Tarayıcı | Tarayıcı şablonu | Yazılacak |

### Para Çarşısı

Yazan: **Murat**.

| Oda | Tür | Sahne | Yazmak için gereken | Durum |
| --- | --- | --- | --- | --- |
| **Kişisel veri ve para güvenliği** | Temel eğitim | Eğitim kartları, iki video, kutulara ayırma, eşleştirme, boşluk doldurma | Tur 7 kart düzenleri ve iki video (bu PR'da) | PR açık |
| Kulaklık için veli kartı | Senaryo | Postam + görev | Görev, kart, mağaza sayfası, onay kodu adımı, telefonla açılış (yazıldı) | Kod yazıldı, taslak |
| Okul çekilişinde tablet kazandın | Senaryo | Mesajlar | Hazır (M1) | Yazılacak |
| **Online alışveriş ve ikinci el** | İleri eğitim | Eğitim kartları | Resimde tıkla-bul | Yazılacak |
| Yarı fiyatına telefon | Senaryo | Akış | Akış şablonu | Yazılacak |
| Eski telefonunu sat | Senaryo | Mesajlar + satış görevi | Satış görevi, ödeme isteği, sipariş ve kargo, babanın çizimi (yazıldı) | Kod yazıldı, taslak |
| **Kolay para tuzakları** | İleri eğitim | Eğitim kartları | Hazır | Yazılacak |
| Hesabını kirala | Senaryo | Mesajlar | Yeni sonuç ekranı (M1 hazır) | Yazılacak |
| Beğen, kazan | Senaryo | Mesajlar | Hazır (M1) | Yazılacak |
| Kesin kazanç grubu | Senaryo | Mesajlar | Hazır (M1) | Yazılacak |

### Dostluk Parkı

Yazan: **beklemede** (diğer dört mahalle bitince paylaşılacak).

Bu mahallede yanlış kararın sonucu "Hacklendin" değildir. "Paylaşım yayıldı", "Kavga büyüdü" gibi yumuşak bir sonuç ekranı gelir ve dil suçlamaz.

| Oda | Tür | Sahne | Yazmak için gereken | Durum |
| --- | --- | --- | --- | --- |
| **Çevrim içi ilişkiler ve güven** | Temel eğitim | Eğitim kartları | Hazır | Yazılacak |
| Oyunda tanışılan "arkadaş" | Senaryo | Mesajlar | Hazır | Yazılacak |
| Sınıf grubunda alay edilen arkadaş | Senaryo | Mesajlar | Yeni sonuç ekranı | Yazılacak |
| **Siber zorbalık** | İleri eğitim | Eğitim kartları | Hazır | Yazılacak |
| İtiraf hesabında senin hakkında gönderi | Senaryo | Akış | Akış şablonu, yeni sonuç ekranı | Yazılacak |
| Senin adına açılmış sahte hesap | Senaryo | Akış | Akış şablonu, yeni sonuç ekranı | Yazılacak |
| **Fotoğraf, sınırlar ve şantaj** | İleri eğitim | Eğitim kartları | Hazır | Yazılacak |
| Fotoğraf isteyen "yaşıt" | Senaryo | Mesajlar | Hazır cevap düğmeleri, yeni sonuç ekranı | Yazılacak |
| "Fotoğrafını yayarım" | Senaryo | Mesajlar | Yeni sonuç ekranı | Yazılacak |
| **Dijital iyi oluş** | İleri eğitim | Eğitim kartları | Hazır | Yazılacak |
| Gece 01:00 bildirimleri | Senaryo | Mesajlar | Yeni sonuç ekranı | Yazılacak |
| Tehlikeli akım videosu | Senaryo | Akış | Akış şablonu, yeni sonuç ekranı | Yazılacak |

## Konuşulan fikirler ve açık kararlar

15 Ekim'de önerilen yeni mahallelerin hiçbiri ayrı mahalle olmadı. Murat'ın kararıyla ilgili mahallenin altına ileri eğitim olarak girdiler. Yalnız sosyal ve duygusal konular kendi mahallesini aldı, o da Dostluk Parkı oldu.

| Önerilen konu | Nereye girdi |
| --- | --- |
| Sosyal medya ve mahremiyet | Hesap Kalesi, ileri eğitim |
| Oyun dünyası | Yazılım Ormanı, ileri eğitim ("Oyun dünyası ve hileler") |
| Bilgi ve yapay zekâ | Oltalama Limanı, ileri eğitim ("Sahte içerik ve yapay zekâ") |
| Bağlantı ve cihaz | Oltalama Limanı, ileri eğitim |
| Siber zorbalık, yabancı, şantaj, ekran süresi | 5. mahalle: Dostluk Parkı |

Oda kurguları sunumunun son sayfasında 5 karar Murat'ı bekliyordu. Cevap gelmediği için önerilerle ilerleniyor:

| Karar | Soru | Öneri |
| --- | --- | --- |
| Dostluk Parkı'nın sonuç ekranı | "Hacklendin" yerine yumuşak bir ekran mı olsun? | Evet, Hacklendin ekranlarının yenilenmesiyle aynı işte |
| Hassas odalar | "Fotoğraf, sınırlar ve şantaj" ile "Kolay para tuzakları" ortaokula da açık mı? | Açık kalsın, kapakta "lise için önerilir" notu olsun |
| Gerçek yardım hatları | Eğitim kartlarında 112, ALO 183, İhbar Web geçsin mi? | Geçsin; marka yasağı sahneler içindir |
| İlk dalga | İlk 16 oda her mahallenin temel yolu mu olsun? | Evet |
| Bir odada kaç tuzak | Odalar tek sahte öğeyle mi yazılsın? | Evet; birden çok sahte öğe gelince bazı odalara ikinci tuzak eklenir |

Kenarda duran fikirler şunlar:

- **Gün serisi, "Günün maili":** her gün 30 saniyelik tek mail kararı. Murat 13 Ekim'de "şimdilik yok" dedi, içerik gelince yeniden konuşulacak.
- **Oda temposu:** her hafta bir oda eklenebilir. İlk hedef 16 oda, sonra birkaç sınıfla deneme.

Planda olmayan, eklenebilecek dallar (benim önerim, konuşulmadı):

- **Haber ve bilgi doğrulama:** sahte haber, kırpılmış ekran görüntüsü, yapay zekâ görseli. "Sahte içerik ve yapay zekâ" eğitimine iki senaryo olarak girebilir.
- **Ev ağı ve akıllı cihazlar:** modem şifresi, akıllı kamera, Bluetooth eşleşmesi. Oltalama Limanı'nda "Bağlantı ve cihaz" altına girebilir.
- **Oyun hesabı alım satımı:** hesap ya da skin alıp dolanmak. Para Çarşısı'nda "Online alışveriş" altına girebilir.
- **Dijital itibar:** eski paylaşımların yıllar sonra önüne çıkması. Hesap Kalesi'nde "Sosyal medya ve mahremiyet" altına girebilir.

## Sıradaki adımlar

İlk dalganın 16 odasından 12'si bugün yazılabilir: 5 temel eğitim ve 7 senaryo. Kalan 4 senaryo için üç küçük kod işi yeter: Mesajlar'da sahte sayfa, ek dosya tuzağı ve yeni sonuç ekranı. Bunlar bitince ilk dalganın tamamı oda dosyası olarak yazılır, yeni şablon beklemez. Sıra M1, M2, M3 (`docs/notes/general-status.md`).

Kod işleri ve açtıkları odalar:

| İş | Ne yapar | Bekleyen oda | Boyut |
| --- | --- | --- | --- |
| Akış şablonu | Sosyal medya sahnesi: profil, gönderi, takip isteği, gizlilik ayarı. Önce tuvalde çizilir | 8 senaryo | Büyük |
| Yeni sonuç ekranı | Dostluk Parkı için yumuşak sonuç, Para Çarşısı için "Hesabın suçta kullanıldı" | 8 senaryo | Orta |
| Mesajlar'da sahte sayfa (M1) | Mesajlar'daki bağlantı da sahte sayfa açar. **Hazır (29 Ekim).** | 7 senaryo | Küçük |
| Cihaz şablonu | Telefon ve bilgisayar ekranı: kurulum, izin, USB, Wi‑Fi, QR | 6 senaryo | Büyük |
| Resimde tıkla-bul | Eğitim kartında fotoğraf, SMS ya da profil üstünde tıkla-bul | 6 eğitim | Orta |
| Ek dosya tuzağı | Sahte öğedeki eki açmak ele geçirilme sayılır | 3 senaryo | Küçük |
| Tarayıcı şablonu | Web sayfası: indirme sayfası, sahte uyarı, ilan | 3 senaryo | Orta |
| Sesli mesaj ve arama | Mesajlar'da yazıya dökülmüş sesli mesaj ve gelen arama | 2 senaryo | Küçük |
| Hazır cevap düğmeleri | Öğrenci yazmak yerine düğmeden seçer, biri tuzaktır | 1 senaryo | Küçük |

Bazı odalar iki iş birden bekler, bu yüzden sayıların toplamı 38'den fazladır. Önerdiğim sıra: önce ilk dalgayı açan üç küçük iş, sonra en çok oda açan Akış şablonu ve yeni sonuç ekranı.

Kaynaklar:

- [`room-plan.md`](room-plan.md): her odanın hikâyesi, tuzağı, doğru kararı, üç işareti ve ana sorusu (17 Ekim sunumunun metin hâli).
- Siber Şehir Hiyerarşisi (Murat'ın Claude projesinde): 15 Ekim'deki yapı kararı. Kilit kuralının depodaki hâli `lib/lab/gates.ts` ve `docs/guides/new-lab.md` 2.7.
- [`docs/platform-document.md`](../platform-document.md): Bölüm 4, oda yapısı.
- Depoda `docs/guides/new-lab.md`: formla oda yazma ve yeni şablon ekleme kılavuzu.
