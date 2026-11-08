# Oda planı: bütün mahalleler ve odalar

Siber şehrin bütün odaları: 5 mahalle, 18 eğitim odası, 43 senaryo odası (toplam 61). Plan 17 Ekim 2026'da ekiple birlikte çıkarıldı (Murat'ın proje dosyalarındaki "Siber şehrin odaları" sunumunun metin hâli; sunumda bundan fazlası yok). Bu dosya planın asıl yeridir: bir oda yazılınca, değişince ya da yeni oda eklenince burası da aynı PR'da güncellenir.

Odaların tam metni (mailler, mesajlar, kartlar, sorular) `docs/labs/rooms/<mahalle>/` altındaki senaryo dosyalarındadır; bu dosya kısa plandır.

Oda yazmadan önce `docs/guides/getting-started.md` (başlarken) ve `docs/guides/new-lab.md` (form kılavuzu) okunur.

| Mahalle | Konu | Eğitim | Senaryo |
| --- | --- | --- | --- |
| Hesap Kalesi | Hesap güvenliği | 3 | 9 |
| Oltalama Limanı | Oltalama ve sahte içerik | 4 | 10 |
| Yazılım Ormanı | Zararlı yazılım | 4 | 9 |
| Para Çarşısı | Kişisel veri ve para | 3 | 7 |
| Dostluk Parkı | Güvenli iletişim | 4 | 8 |
| **Toplam** | | **18** | **43** |

## Nasıl okunur

- Her mahallede ilk eğitim **temel eğitim**dir (her zaman açık), diğerleri **ileri eğitim** (temel bitince açılır). Her senaryo odasını, altında durduğu eğitim açar.
- **İlk dalga:** her mahallenin temel eğitimi ve onun senaryoları (16 oda). Bitince 5 mahalle rozeti ve Şehir turu kazanılabilir.
- **Ana soru:** görevlerdeki 3 seçenekli soru. İlk seçenek doğrudur; formda seçeneklerin yeri odadan odaya değiştirilir.
- **Gerçek öğeler:** tuzağın yanında duran, güvenli mail ya da mesajlar. Öğrenci her şeyden şüphelenmeyi değil, ayırt etmeyi öğrenir.
- **Bekleyen kod işi:** odanın bugünkü sahnelerle (Postam, Mesajlar, eğitim kartları) yazılıp yazılamayacağı. Kod işleri en altta.
- **Lise için önerilir:** oda herkese açıktır; kapakta ve ödev penceresinde bu not durur.

## Hesap Kalesi (Hesap güvenliği)

Öğrencinin ilk dijital varlığı hesaplarıdır: oyun, okul, mail, sosyal medya. Bir hesabın düşmesi çoğu zaman paylaşılan bir kodla, her yerde aynı olan bir şifreyle ya da açık bırakılan bir oturumla başlar.

Bağlantılı mahalleler: Oltalama Limanı (şifreyi isteyen sahte sayfalar), Para Çarşısı (paylaşılan kişisel bilgi), Dostluk Parkı (yabancıya verilen bilgi).

### Temel eğitim: Şifre ve iki adımlı doğrulama

*Hesabının anahtarları* · İlk dalga

Öğrenci bu odadan sonra:

- Uzun ve her hesaba ayrı bir şifre (parola cümlesi) oluşturur.
- Doğrulama kodunun ve hesap kurtarma sorularının hesabın son kilidi olduğunu bilir, kimseyle paylaşmaz.
- İki adımlı doğrulamayı açar, şüpheli girişte şifre değiştirip bütün cihazlardan çıkar.

Kartlar:

1. Bilgi: tek şifre, bütün kapılar
2. Bilgi: parola cümlesi ve şifre yöneticisi
3. Mini test: en güçlü şifre hangisi
4. Bilgi: iki adımlı doğrulama ve kod
5. Bilgi: kurtarma soruları da anahtardır
6. Tıkla-bul: "kodu bu maile cevap yaz" diyen sahte mail
7. Bilgi: şüpheli girişte 3 adım

#### Senaryo: Kodu soran "arkadaş"

Başlık: "Kodu bana atar mısın?" · Sahne: Mesajlar · Sonuç: Hesap · Sitede taslak · İlk dalga

- **Hikâye:** Akşam Deniz yazıyor: "Yanlışlıkla senin numarana kod gönderdim, atar mısın? Acil, oyuna giremiyorum." Bir dakika önce Postam'dan gerçek bir kod mesajı düşmüş.
- **Tuzak:** Kodu Deniz'e yazmak.
- **Doğru karar:** Kodu vermemek, Deniz'i telefonla aramak, mesajı bildirip engellemek.
- **İşaretler:**
    - Tanıdık isim ama hiç böyle yazmaz: hesabı çalınmış olabilir
    - "Acil lütfen" diye acele ettiriyor
    - Doğrulama kodunu istiyor
- **Gerçek öğeler:** Postam'ın kod mesajı, annenin mesajı, servis grubu.
- **Ana soru:** Gerçekten Deniz mi, nasıl emin olursun? Doğru: "Deniz'i telefonla arar ya da yüz yüze sorarım". Yanlışlar: "Mesajla sorarım: gerçekten sen misin?"; "Kodu atarım, arkadaşım sonuçta".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

#### Senaryo: Gece gelen giriş uyarısı

Başlık: "Ben değildim!" · Sahne: Postam · Sonuç: Hesap · Yazılacak · İlk dalga

- **Hikâye:** Saat 02:14'te iki mail gelmiş: Postam'ın gerçek "yeni cihazdan giriş" uyarısı (Ankara, bilinmeyen Windows) ve onu taklit eden sahte bir uyarı. Sahte olanın "Ben değildim, hesabımı koru" düğmesi sahte giriş sayfasına gidiyor.
- **Tuzak:** Sahte uyarıdaki düğmeden Postam şifresini girmek.
- **Doğru karar:** Sahteyi bildirmek; gerçek uyarı için uygulamayı kendisi açıp şifreyi değiştirmek ve diğer cihazlardan çıkmak (soru).
- **İşaretler:**
    - Gönderen postam-guvenlik-ekibi.xyz
    - "1 saat içinde onaylamazsan hesabın kapanır" tehdidi
    - Düğme Postam'a değil benzer bir adrese gidiyor
- **Gerçek öğeler:** Postam'ın gerçek uyarısı (bağlantısız), okul duyurusu, Elif'in maili.
- **Ana soru:** Gerçek giriş uyarısı geldi ve sen değildin. İlk ne yaparsın? Doğru: "Postam'ı kendim açar, şifremi değiştirir, diğer cihazlardan çıkarım". Yanlışlar: "Maildeki düğmeye basıp hesabımı korurum"; "Maili silerim, bir şey olmaz".
- **Akılda kalacak cümle:** Uyarı da sahte olabilir: düğmeye değil, uygulamaya git.
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

#### Senaryo: Oyun sohbetinde yeni arkadaş

Başlık: "İlk evcil hayvanın neydi?" · Sahne: Mesajlar · Sonuç: Hesap · Yazılacak · İlk dalga · Tanıtım sayfasında sahnesi var

- **Hikâye:** Oyunda bugün tanıştığın kral_oyuncu çok sohbet ediyor; laf arasında doğum gününü, ilk evcil hayvanının adını, annenin kızlık soyadını soruyor. Hepsi Oyun Dünyası hesabının kurtarma sorularının cevabı. Odanın başında öğrenciye kendi bilgileri verilir ("kedinin adı Pamuk").
- **Tuzak:** Soruları cevaplamak (gizli bilgi: "Pamuk").
- **Doğru karar:** Cevap vermemek, oyuncuyu bildirip engellemek.
- **İşaretler:**
    - Bugün eklenmiş yeni hesap
    - Masum görünen kişisel sorular art arda geliyor
    - Soruların hepsi hesap kurtarma sorusu
- **Gerçek öğeler:** Klan arkadaşının takım mesajı, sınıf grubu, kardeşin.
- **Ana soru:** kral_oyuncu ilk evcil hayvanını neden soruyor olabilir? Doğru: "Kurtarma sorusunun cevabını öğrenip hesabıma girmek için". Yanlışlar: "Merak ediyordur, sohbet ediyoruz"; "Benimle arkadaş olmak istiyor".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

### İleri eğitim: Ortak cihazlar ve veri sızıntısı

*Kapıyı açık bırakma*

Öğrenci bu odadan sonra:

- Ortak bilgisayarda oturumu kapatır, "Beni hatırla" ve şifre kaydetme sorusuna hayır der.
- Bir sitede sızan şifrenin başka sitelerde denendiğini bilir, aynı şifreyi kullandığı bütün hesapları değiştirir.
- Şifresini "kontrol edelim" diyen hiçbir sayfaya yazmaz.

Kartlar:

1. Bilgi: ortak cihaz nedir (laboratuvar, kütüphane, arkadaşın telefonu)
2. Bilgi: gizli sekme ve "Tüm cihazlardan çıkış"
3. Mini test: tarayıcı "şifreyi kaydet?" diyor
4. Bilgi: veri sızıntısı nasıl yayılır
5. Tıkla-bul: "şifren sızdı, buraya yaz" maili

#### Senaryo: Aynı şifre her yerde

Başlık: "Bir anahtar, bütün kapılar" · Sahne: Postam · Sonuç: Hesap · Yazılacak

- **Hikâye:** Oynadığın oyunun sitesinden "veri ihlali" maili gelmiş: şifreler sızmış. Aynı şifreyi Postam'da da kullanıyorsun. Hemen ardından "Şifren sızdı mı? Buraya yaz, kontrol edelim" diyen bir servis maili.
- **Tuzak:** Şifreyi "kontrol" sayfasına yazmak.
- **Doğru karar:** Sahte servisi bildirmek; oyun ve Postam şifresini değiştirmek, iki adımlıyı açmak (soru).
- **İşaretler:**
    - Gönderen sifre-kontrol-merkezi.xyz
    - Gerçek servisler şifreni yazmanı istemez
    - "Son 2 saat" baskısı
- **Gerçek öğeler:** Oyun sitesinin ihlal bildirimi, Postam'ın "başarısız giriş denemesi" uyarısı, Market Puan.
- **Ana soru:** Oyun sitesinin şifreleri sızdı. Hangi şifreleri değiştirirsin? Doğru: "Oyunun ve aynı şifreyi kullandığım bütün hesapların". Yanlışlar: "Yalnız oyunun şifresini"; "Hiçbirini, benim hesabım sızmamıştır".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

#### Senaryo: Kütüphane bilgisayarında açık hesap

Başlık: "Süre doldu, hesap açık" · Sahne: Cihaz · Sonuç: Hesap · Yazılacak · Tanıtım sayfasında sahnesi var

- **Hikâye:** Kütüphane bilgisayarında ödevini bitirdin, süren doluyor, sırada biri bekliyor. Postam açık, "Beni hatırla" işaretli, tarayıcı "Şifreyi bu bilgisayara kaydet?" diye soruyor.
- **Tuzak:** "Kaydet" demek ya da çıkış yapmadan kalkmak; sıradaki kişi senin adına "acil 100 TL lazım" yazar.
- **Doğru karar:** Şifreyi kaydetmemek, çıkış yapmak; açık kaldıysa telefondan "Tüm cihazlardan çıkış".
- **İşaretler:**
    - Ortak bilgisayar
    - "Beni hatırla" işaretli
    - Şifreyi kaydetme sorusu
- **Gerçek öğeler:** Kütüphanenin süre bildirimi, okul duyurusu.
- **Ana soru:** Süren doldu, sırada biri var. Kalkmadan önce ne yaparsın? Doğru: "Şifreyi kaydetmem, çıkış yaparım". Yanlışlar: "Sekmeyi kapatırım, yeter"; "Sıradakine "hesabım açık, kapatırsın" derim".
- **Bekleyen kod işi:** Cihaz şablonu (yeni sahne türü).

### İleri eğitim: Sosyal medya ve mahremiyet

*Kim görüyor?*

Öğrenci bu odadan sonra:

- Profilini gizli yapar, takip isteklerini tanıdığı kişilerle sınırlar.
- Fotoğraftaki ipuçlarını (okul arması, sokak tabelası, konum etiketi) paylaşmadan önce fark eder.
- Canlı konumu yalnızca ailesiyle paylaşır, kişisel bilgiyi uygulamalara ve yapay zekâ sohbetlerine düşünmeden vermez.

Kartlar:

1. Bilgi: açık profil herkese açıktır
2. Resimde bul (M5): fotoğraftaki 3 ipucu
3. Mini test: biyografide ne olmamalı
4. Bilgi: dijital ayak izi, paylaştığın kalır
5. Bilgi: canlı konum ve konum etiketi
6. Video (isteğe bağlı): bir yabancı 3 gönderiden evi nasıl bulur

#### Senaryo: Herkese açık profilden bulunmak

Başlık: "Üç gönderide evin" · Sahne: Akış · Sonuç: Veri sızıntısı · Yazılacak · Tanıtım sayfasında sahnesi var

- **Hikâye:** Profilin bir yabancının gözünden görünüyor: biyografide okul ve sınıf, gönderilerde ev sokağı ve konum. Yeni bir hesap takip isteği atmış, ardından yazmış: "Çınar Ortaokulu'nda mısın? Ben de 7-B'deyim, çıkışta görüşelim."
- **Tuzak:** İsteği kabul edip okulunu ve çıkış saatini yazmak.
- **Doğru karar:** Profili gizliye almak, isteği reddedip bildirmek.
- **İşaretler:**
    - İki gün önce açılmış hesap, ortak arkadaş yok
    - Seni tanıyor gibi ama bildikleri profilinde yazanlar
    - Buluşma isteği
- **Gerçek öğeler:** Sınıf arkadaşının gönderisi, okulun resmî hesabı, kuzeninin takip isteği.
- **Ana soru:** Takip isteği atan hesap "aynı okuldayız" diyor. Ne yaparsın? Doğru: "Gerçekten tanıyor muyum bakarım; tanımıyorsam reddeder, bildiririm". Yanlışlar: "Kabul ederim, aynı okuldaysa sorun yok"; "Kabul eder, hangi sınıfta olduğunu sorarım".
- **Bekleyen kod işi:** Akış şablonu (yeni sahne türü).

#### Senaryo: Paylaşmadan önce bak

Başlık: "Okul formalı fotoğraf" · Sahne: Akış · Sonuç: Veri sızıntısı · Yazılacak

- **Hikâye:** Okul çıkışı arkadaşlarınla fotoğraf çektin, paylaşmak üzeresin. Formanda okul arması, arkada sokak tabelası, otomatik "Okulum · 14:05" konum etiketi var; kimler görebilir: Herkes.
- **Tuzak:** Gönderiyi olduğu gibi paylaşmak.
- **Doğru karar:** Konumu silmek, kitleyi "Arkadaşlar" yapmak, tabelayı kırpmak ya da sonra paylaşmak.
- **İşaretler:**
    - Otomatik konum etiketi
    - Sokak tabelası ve okul arması
    - "Kimler görebilir: Herkes"
- **Gerçek öğeler:** Yok; bu oda bir "yeni gönderi" ekranında ayar kararlarıyla oynanır.
- **Ana soru:** Bu fotoğrafı paylaşmadan önce ne yaparsın? Doğru: "Konumu siler, kitleyi "Arkadaşlar" yapar, tabelayı kırparım". Yanlışlar: "Güzel bir filtre eklerim"; "Hiçbir şey, herkes böyle paylaşıyor".
- **Bekleyen kod işi:** Akış şablonu (yeni sahne türü).

#### Senaryo: Canlı konum isteyen kalabalık grup

Başlık: "Herkes konum atsın!" · Sahne: Mesajlar · Sonuç: Veri sızıntısı · Yazılacak

- **Hikâye:** 280 kişilik "Okul Sohbet" grubunda biri "Herkes canlı konum atsın, kim nerede bakalım" diyor; birkaç kişi atmış bile. Grupta kimin kim olduğunu bilmiyorsun. Aynı akşam annen de konumunu istiyor.
- **Tuzak:** Gruba konum ya da adres yazmak (gizli bilgi: evin sokağı).
- **Doğru karar:** Gruba konum atmamak, mesajı bildirmek; annene konum göndermek güvenli.
- **İşaretler:**
    - Grubu kim kurdu belli değil, 280 üye
    - "Herkes atsın" baskısı
    - Canlı konum saatlerce nerede olduğunu gösterir
- **Gerçek öğeler:** Annenin konum isteği (aynı istek, güvenilir kişi), ödev mesajı.
- **Ana soru:** Canlı konumu kiminle paylaşmak güvenli? Doğru: "Yalnız ailemle, gerektiğinde". Yanlışlar: "Okul grubundaki herkesle"; "Bütün takipçilerimle".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

#### Senaryo: Ödev asistanı kılığında uygulama

Başlık: "Yüzünü analiz edeyim" · Sahne: Mesajlar · Sonuç: Veri sızıntısı · Yazılacak

- **Hikâye:** Sınıfta herkesin konuştuğu "Ödev Asistanı Pro" sohbet botu ödevlerde yardım ediyor. Sonra "Sana özel plan için adını, okulunu, T.C. kimlik numaranı ve bir yüz fotoğrafını gönder" diyor.
- **Tuzak:** Kimlik bilgilerini yazmak.
- **Doğru karar:** Kişisel bilgi vermemek, uygulamayı bildirmek; ödev sorusunu bilgi vermeden sormak.
- **İşaretler:**
    - Ödevle ilgisi olmayan bilgi istiyor
    - "Ücretsiz deneme bitiyor, hemen gönder"
    - Resmî mağazada değil, bir bağlantıyla gelmiş
- **Gerçek öğeler:** Öğretmenin ödev hatırlatması, arkadaşın mesajı.
- **Ana soru:** Ödev Asistanı T.C. kimlik numaranı istiyor. Ne yaparsın? Doğru: "Vermem; soruyu bilgi vermeden sorar, uygulamayı bildiririm". Yanlışlar: "Ödevim için gerekiyorsa veririm"; "Arkadaşımın numarasını yazarım".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

## Oltalama Limanı (Oltalama ve sahte içerik)

Saldırıların çoğu bir mesajla başlar: mail, SMS, sohbet ya da arama. Bu mahalle kandırmanın dilini (acele, korku, ödül, merak, otorite) tanımayı öğretir. Artık yapay zekâyla taklit edilen ses ve görüntü de bu dilin parçası.

Bağlantılı mahalleler: Hesap Kalesi (çalınan şifre ve kod), Yazılım Ormanı (bağlantıdan inen dosya), Para Çarşısı (kart bilgisi isteyen sayfa).

### Temel eğitim: Sahte mesajı tanımak

*Oltayı gör* · İlk dalga · Sitede yayında

Öğrenci bu odadan sonra:

- Gönderen adresini okur; görünen isme değil, @ işaretinden sonrasına bakar.
- Bağlantının gerçek adresine tıklamadan bakar.
- Acele ve korku taktiğini fark eder, maili bildirir.

Kartlar:

1. Bilgi: oltalama nedir
2. Tıkla-bul: kargo maili
3. Mini test: kargo maili gerçek mi
4. Bilgi: şüphelenince ne yaparsın
5. Yeni kart önerisi: kandırmanın 5 duygusu (acele, korku, ödül, merak, otorite)
6. Yeni kart önerisi: SMS'te de aynı (kısa bağlantı, numara)

#### Senaryo: Sahte kargo maili

Başlık: "Kargonuz kapıda... değil!" · Sahne: Postam · Sonuç: Hesap · Sitede yayında · İlk dalga · Tanıtım sayfasında sahnesi var

- **Hikâye:** Kargon yolda ve gelen kutun dolu. "Kargo Takip" adına gelen mail adresin eksik olduğunu, 24 saat içinde güncellemezsen paketin iade edileceğini söylüyor.
- **Tuzak:** "Adresi güncelle" düğmesinden Postam şifresini girmek.
- **Doğru karar:** Maili bildirmek; kargoyu firmanın uygulamasından kendisi takip etmek.
- **İşaretler:**
    - Gönderen kargo-teslimat-tr.xyz
    - "24 saat içinde" baskısı
    - Bağlantı benzer bir adrese gidiyor
- **Gerçek öğeler:** Okul duyurusu, Market Puan siparişi, Elif'in ödev maili.
- **Ana soru:** Kargo mailinin gerçek olup olmadığını en güvenli nasıl anlarsın? Doğru: "Firmanın uygulamasını kendim açıp takip numarama bakarım". Yanlışlar: "Maildeki düğmeye tıklayıp açılan siteye bakarım"; "Maile cevap yazıp sorarım".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

#### Senaryo: Karne günü gelen mail

Başlık: "Notların açıklandı!" · Sahne: Postam · Sonuç: Hesap · Yazılacak · İlk dalga

- **Hikâye:** Karne günü sabahı "Okul Portalı" adına bir mail: "Dönem notların açıklandı, görmek için giriş yap." Aynı sabah okulun gerçek töreni duyurusu ve öğretmeninin tatil ödevi maili de gelmiş. (Sınav sonucu günü için de yazılabilir.)
- **Tuzak:** Bağlantıdan Okul Portalı şifresini girmek.
- **Doğru karar:** Maili bildirmek; portala kendi yer iminden girmek.
- **İşaretler:**
    - Gönderen okul-portali-giris.xyz
    - Tam karne günü: takvimi kullanan merak tuzağı
    - "Giriş yapmazsan karnen görüntülenemez" baskısı
- **Gerçek öğeler:** Okulun tören duyurusu, matematik öğretmeninin maili, Market Puan.
- **Ana soru:** Karne notlarını güvenle nasıl görürsün? Doğru: "Okul Portalı'na kendi yer imimden girerim". Yanlışlar: "Maildeki bağlantıdan girerim"; "Şifremi arkadaşıma verip baktırırım".
- **Akılda kalacak cümle:** Saldırganlar takvimi kullanır: karne, sınav sonucu, bayram.
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

### İleri eğitim: SMS, arama ve sahte destek

*Telefonla gelen tuzaklar*

Öğrenci bu odadan sonra:

- SMS'teki kısa bağlantıya tıklamaz, bankayı kartın arkasındaki numaradan arar.
- "Destek ekibi", polis ya da operatör olduğunu söyleyen kişiye kod ve bilgi vermez.
- Ailesini hedef alan telefon dolandırıcılığını tanır, onları uyarır.

Kartlar:

1. Bilgi: SMS oltalaması
2. Resimde bul (M5): sahte SMS'teki işaretler
3. Bilgi: gerçek kurumlar telefonda kod, şifre ya da para aktarımı istemez
4. Mini test: "polisim, paranı güvenli hesaba aktar"
5. Bilgi: kapat, kendin ara, büyüğüne söyle

#### Senaryo: "Kartınız bloke edildi" SMS'i

Başlık: "Bankam'dan acil uyarı" · Sahne: Mesajlar · Sonuç: Para · Yazılacak

- **Hikâye:** Annenin kartıyla internetten bir şey almıştın. Akşam "Bankam" adına SMS: "Kartınız şüpheli işlem nedeniyle bloke edildi, açmak için bankam-guvenli.xyz/kart". Sayfa kart numarası, son kullanma, CVV ve SMS şifresini istiyor.
- **Tuzak:** Sayfaya kart bilgilerini girmek.
- **Doğru karar:** Tıklamamak, bildirmek; annenle bankayı kartın arkasındaki numaradan aramak.
- **İşaretler:**
    - Bankanın bilinen numarası değil
    - Kısa ve benzer adres
    - CVV ve SMS şifresi istiyor; bankalar istemez
- **Gerçek öğeler:** Bankam'ın gerçek harcama bildirimi (bağlantısız), annenin mesajı, kargo bilgisi.
- **Ana soru:** SMS doğru olabilir diye endişelendin. En güvenli yol hangisi? Doğru: "Annemle bankayı kartın arkasındaki numaradan ararız". Yanlışlar: "SMS'teki bağlantıya girip kontrol ederim"; "SMS'te yazan numarayı ararım".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır (M1 hazır: Mesajlar'da bağlantı sahte sayfa açar).

#### Senaryo: Kod isteyen "Destek Ekibi"

Başlık: "Hesabını kurtarıyoruz" · Sahne: Mesajlar · Sonuç: Hesap · Yazılacak

- **Hikâye:** "Oyun Dünyası Destek" adlı, bugün açılmış bir hesap yazıyor: "Hesabında şüpheli işlem var, doğrulamak için telefonuna gelen 6 haneli kodu yaz, yoksa hesabın 1 saat içinde kapanacak." Hemen ardından gerçek bir kod SMS'i düşüyor.
- **Tuzak:** Kodu yazmak.
- **Doğru karar:** Kodu vermemek, oyunun içindeki resmî destekten kontrol etmek, hesabı bildirmek.
- **İşaretler:**
    - Doğrulanmamış, bugün açılmış hesap
    - Korkutma ve süre
    - Kod istemesi
- **Gerçek öğeler:** Kod SMS'i, klan arkadaşının mesajı.
- **Ana soru:** Gerçek bir oyun destek ekibi senden ne ister? Doğru: "Kodunu ya da şifreni hiçbir zaman istemez". Yanlışlar: "Telefonuna gelen kodu"; "Hesabını doğrulamak için şifreni".
- **Akılda kalacak cümle:** "Kodu soran arkadaş" ile aynı tuzak; burada güvenilen şey arkadaşlık değil otorite.
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

#### Senaryo: "Polisim, savcıyım" araması

Başlık: "Babaannenin telefonu" · Sahne: Mesajlar · Sonuç: Para · Yazılacak

- **Hikâye:** Aile grubunda babaannen yazıyor: "Polis aradı, adıma soruşturma varmış, paramı güvenli hesaba aktarmam lazımmış, kimseye söylememi istediler." Ardından bilinmeyen bir numaradan "Savcılık" imzalı bir mesaj ve bir IBAN geliyor.
- **Tuzak:** "Savcılık" mesajına cevap verip babaannenin bilgilerini yazmak.
- **Doğru karar:** Babaanneyi aramak, para aktarmamasını söylemek, birlikte resmî numarayı aramak, mesajı bildirmek.
- **İşaretler:**
    - Gerçek kurumlar telefonda para aktarımı istemez
    - "Kimseye söyleme" sırrı
    - Kişi adına IBAN
- **Gerçek öğeler:** Babaannenin mesajı (gerçek, yardım bekliyor), aile grubu.
- **Ana soru:** Babaannene ne dersin? Doğru: "Hiçbir yere para aktarma, telefonu kapat, seni arıyorum". Yanlışlar: "Polis diyorsa aktar"; "Önce IBAN'ın kime ait olduğuna bak".
- **Akılda kalacak cümle:** Öğrenci kendini değil ailesini korur. Sesli arama gelirse (M4) daha gerçekçi.
- **Bekleyen kod işi:** M4: Mesajlar'da sesli mesaj ve arama.

### İleri eğitim: Bağlantı ve cihaz

*Bağlanmadan önce düşün*

Öğrenci bu odadan sonra:

- Açık Wi‑Fi'da giriş ve ödeme yapmaz, doğru ağ adını sorar.
- QR kodun açacağı adrese bakmadan açmaz.
- Kullandığı ağın ve okuttuğu kodun da bir bağlantı olduğunu bilir.

Kartlar:

1. Bilgi: açık ağ ve aynı isimli sahte ağ
2. Bilgi: QR kod bir bağlantıdır, önizlemeye bak
3. Resimde bul (M5): afişin üstüne yapıştırılmış QR
4. Mini test: kafede iki ağ
5. Bilgi: ekran kilidi ve yakın paylaşım ayarı

#### Senaryo: Okul panosundaki QR kod

Başlık: "Sınırsız elmas hilesi!" · Sahne: Cihaz · Sonuç: Hesap · Yazılacak · Tanıtım sayfasında sahnesi var

- **Hikâye:** Koridor panosunda "Sınırsız elmas hilesi, okut ve indir!" afişi. Telefonun kamerası QR'ı okuyunca adres önizlemesi çıkıyor: elmas-hile-indir.xyz/ElmasHack.apk. Açarsan "Bilinmeyen kaynaktan yüklensin mi?" sorusu geliyor.
- **Tuzak:** Bağlantıyı açıp uygulamayı yüklemek; uygulama SMS kodlarını okur, oyun hesabı gider.
- **Doğru karar:** Önizlemedeki adrese bakıp "Açma" demek, afişi öğretmene söylemek.
- **İşaretler:**
    - Okul panosunda resmî olmayan afiş
    - Adres .apk ile bitiyor ve mağaza değil
    - "Sınırsız, ücretsiz" vaadi
- **Gerçek öğeler:** Kantin menüsünün QR'ı (okulun kendi adresi), okul duyurusu.
- **Ana soru:** Önizlemede .apk ile biten bir adres var. Ne yaparsın? Doğru: "Açmam, afişi öğretmene söylerim". Yanlışlar: "Açarım, yalnız bakarım"; "Arkadaşıma gönderip onun açmasını isterim".
- **Bekleyen kod işi:** Cihaz şablonu (yeni sahne türü).

#### Senaryo: Kafede bedava Wi‑Fi

Başlık: "KafeMola_FREE" · Sahne: Cihaz · Sonuç: Hesap · Yazılacak

- **Hikâye:** Arkadaşlarla kafedesin. Wi‑Fi listesinde üç ağ var: "KafeMola" (şifreli, kasadaki kartta yazıyor), "KafeMola_FREE" (açık) ve "Bedava_Internet". Açık ağa bağlanınca "İnternete çıkmak için Postam hesabınla giriş yap" sayfası açılıyor.
- **Tuzak:** Postam şifresini giriş sayfasına yazmak.
- **Doğru karar:** Kasadan doğru ağı sormak ya da mobil veri kullanmak; açık ağda giriş yapmamak.
- **İşaretler:**
    - Şifresiz ağ, gerçeğine benzeyen isim
    - İnternete çıkmak için mail şifresi istiyor
    - Adres çubuğunda kafeyle ilgisi olmayan adres
- **Gerçek öğeler:** Kafenin şifreli ağı, kasadaki Wi‑Fi kartı.
- **Ana soru:** Hangi ağa bağlanırsın? Doğru: "Kasaya sorduğum şifreli KafeMola ya da mobil veri". Yanlışlar: "KafeMola_FREE: açık ve bedava"; "Bedava_Internet: en hızlısı".
- **Bekleyen kod işi:** Cihaz şablonu (yeni sahne türü).

### İleri eğitim: Sahte içerik ve yapay zekâ

*Gördüğüne, duyduğuna hemen inanma*

Öğrenci bu odadan sonra:

- Yapay zekâyla taklit edilen ses ve görüntünün var olduğunu bilir; tanıdık sesten gelen kod ya da para isteğini başka yoldan doğrular.
- Sahte haberi ve sahte yardım kampanyasını kaynağa bakarak ayırır.
- Doğrulamadığı şeyi paylaşmaz.

Kartlar:

1. Bilgi: birkaç saniyelik sesten taklit
2. Bilgi: ailenin parolası (yalnız ailenin bildiği bir kelime)
3. Bilgi: kaynağa bak (kim paylaştı, hesap ne zaman açıldı, resmî kaynak ne diyor)
4. Mini test: viral haber
5. Video (isteğe bağlı)

#### Senaryo: "Yeni numaram bu" diyen kuzen

Başlık: "Sesi aynı, numara yeni" · Sahne: Mesajlar · Sonuç: Hesap · Yazılacak

- **Hikâye:** Bilinmeyen bir numaradan kuzenin Ece'nin sesiyle sesli mesaj: "Telefonum kırıldı, bu yeni numaram. Hesabımı yeni telefona kuruyorum, sana bir kod gelecek, atar mısın?" Az sonra kod SMS'i düşüyor.
- **Tuzak:** Kodu göndermek.
- **Doğru karar:** Ece'yi eski numarasından ya da annesinden aramak, kod vermemek, bildirmek.
- **İşaretler:**
    - Yeni numara
    - Tanıdık ses yapay zekâyla taklit edilebilir
    - Kod istiyor
- **Gerçek öğeler:** Ece'nin eski numarasından dünkü normal mesajı, annen.
- **Ana soru:** Ece olduğundan nasıl emin olursun? Doğru: "Ece'yi eski numarasından ya da annesinden ararım". Yanlışlar: "Ses Ece'nin sesi, eminim"; "Yeni numaraya "gerçekten sen misin?" diye yazarım".
- **Akılda kalacak cümle:** Sesli mesaj (M4) yoksa yazıyla da oynanır.
- **Bekleyen kod işi:** M4: Mesajlar'da sesli mesaj ve arama.

#### Senaryo: Afet sonrası sahte yardım kampanyası

Başlık: "Bağış için bu IBAN" · Sahne: Akış · Sonuç: Para · Yazılacak

- **Hikâye:** Bir deprem haberinin ardından akışında hızla yayılan bir gönderi: yıkıntı fotoğrafı, "Hemen yardım lazım, bağışları bu sayfadan yapın." Hesap dün açılmış, IBAN bir kişinin adına. (Postam'da mail olarak da yazılabilir.)
- **Tuzak:** Bağış sayfasına kart bilgisini girmek.
- **Doğru karar:** Gönderiyi bildirmek, paylaşmamak; yardımı ailesiyle birlikte resmî yardım kuruluşlarının kendi sitesinden yapmak.
- **İşaretler:**
    - Dün açılmış hesap
    - Kişi adına IBAN
    - Duygusal baskı ve "son saatler"
- **Gerçek öğeler:** Resmî bir yardım kuruluşunun gönderisi, arkadaşının gönderisi.
- **Ana soru:** Yardım etmek istiyorsun. Hangisi güvenli? Doğru: "Ailemle resmî yardım kuruluşunun kendi sitesinden bağış yaparız". Yanlışlar: "Gönderideki sayfadan hemen bağış yaparım"; "Gönderiyi paylaşıp herkese duyururum".
- **Bekleyen kod işi:** Akış şablonu (yeni sahne türü).

#### Senaryo: Ünlünün videosunda bedava telefon

Başlık: "Sadece kargo ücreti" · Sahne: Akış · Sonuç: Para · Yazılacak

- **Hikâye:** Sevdiğin bir içerik üreticisi videoda "Takipçilerime 500 telefon hediye ediyorum, sadece 49 TL kargo ücreti" diyor. Ağzı sesle tam oturmuyor, hesap adının sonunda fazladan bir harf var.
- **Tuzak:** Kargo ücreti için kart bilgisini girmek.
- **Doğru karar:** Ünlünün asıl hesabına bakmak, gönderiyi bildirmek.
- **İşaretler:**
    - Hesap adında fazladan harf, az takipçi
    - Para isteyen "hediye"
    - Videoda dudak ve ses uyumsuz
- **Gerçek öğeler:** Aynı ünlünün asıl hesabındaki gönderi, arkadaşının gönderisi.
- **Ana soru:** Videonun gerçek olup olmadığını nasıl anlarsın? Doğru: "Ünlünün asıl hesabında aynı duyuru var mı bakarım". Yanlışlar: "Yorumlara bakarım, herkes "aldım" diyor"; "Kargo ücreti az, denemekten zarar gelmez".
- **Bekleyen kod işi:** Akış şablonu (yeni sahne türü).

## Yazılım Ormanı (Zararlı yazılım)

Bu yaşta zararlı yazılım çoğunlukla "bedava" bir şeyle gelir: hile, mod, korsan film, bulunmuş bir bellek, ödev diye gelen bir dosya. Bir kez kurulunca hesaplar, dosyalar ve arkadaş listesi tehlikeye girer.

Bağlantılı mahalleler: Oltalama Limanı (dosyayı getiren mesaj), Hesap Kalesi (zararlının çaldığı kodlar).

### Temel eğitim: Zararlı yazılım nereden bulaşır

*Bedava peynir* · İlk dalga

Öğrenci bu odadan sonra:

- Dosya uzantısını ve türünü tanır (.exe, .apk, ödev.pdf.exe).
- Uygulamayı yalnızca resmî mağazadan kurar.
- Bulaşma belirtilerini (pil, veri, reklam, senin adına mesaj) fark eder, cihazı internetten ayırıp bir büyüğüne söyler.

Kartlar:

1. Bilgi: 5 bulaşma yolu (ek, mağaza dışı uygulama, hile ve korsan, bulunmuş bellek, sahte uyarı)
2. Bilgi: uzantı oyunu ("uzantıları göster")
3. Tıkla-bul: ekli sahte ödev maili
4. Mini test: hangisi tehlikeli dosya
5. Bilgi: belirtiler
6. Bilgi: ne yaparsın

#### Senaryo: Ödev diye gelen ekli dosya

Başlık: "Yarınki sınavın soruları ekte" · Sahne: Postam · Sonuç: Fidye · Yazılacak · İlk dalga

- **Hikâye:** Sınav haftası. Sınıf arkadaşın Can'ın adresinden mail: "Yarınki sınavın soruları ekte, kimseye gösterme." Ek: sinav_sorulari.pdf.exe. Aynı gün matematik öğretmeninden gerçek bir PDF çalışma kâğıdı da gelmiş.
- **Tuzak:** Eki açmak; dosyalar kilitlenir.
- **Doğru karar:** Eki açmamak, maili bildirmek, Can'a telefonla haber vermek (hesabı çalınmış olabilir).
- **İşaretler:**
    - Çift uzantı: .pdf.exe
    - "Kimseye gösterme" sırrı ve merak
    - Can hiç böyle yazmaz
- **Gerçek öğeler:** Öğretmenin PDF ekli maili (gerçek ek), okul duyurusu, Elif.
- **Ana soru:** Can'dan böyle bir mail geldi. Ne yaparsın? Doğru: "Açmam, bildiririm, Can'ı arayıp hesabının çalınmış olabileceğini söylerim". Yanlışlar: "Eki açarım, Can'dan geldi"; "Eki arkadaşlarıma da gönderirim".
- **Akılda kalacak cümle:** Aynı odada gerçek bir ek ve sahte bir ek yan yana.
- **Bekleyen kod işi:** M2: Ek dosya tuzağı.

#### Senaryo: Sınıf grubundan gelen hileli uygulama

Başlık: "Mağazada yok, hileli sürüm" · Sahne: Mesajlar · Sonuç: Hesap · Yazılacak · İlk dalga

- **Hikâye:** Sınıf grubunda Mert "elmas nasıl alınıyor?" diye soruyor; Kaan "hileli sürüm, mağazada yok" diye ElmasHack_v3.apk atıyor. Yüklemek için "bilinmeyen kaynaklara izin ver" ve SMS, Kişiler, "üstte göster" izinleri gerekiyor.
- **Tuzak:** Dosyayı açıp yüklemek; uygulama SMS kodlarını okuyup oyun ve mail hesabını alır.
- **Doğru karar:** Açmamak, mesajı bildirmek, gruba uyarı yazmak.
- **İşaretler:**
    - "Mağazada yok" iddiası
    - .apk dosyası
    - Oyunun ihtiyacı olmayan SMS ve Kişiler izni
- **Gerçek öğeler:** Mert'in sorusu, grubun ödev mesajı, öğretmenin duyurusu.
- **Ana soru:** Oyunda elmas almanın güvenli yolu hangisi? Doğru: "Oyunun kendi mağazasından, ailemin izniyle". Yanlışlar: "Mağazada olmayan hileli sürüm"; "Kaan'ın gönderdiği dosya, o denemiş".
- **Bekleyen kod işi:** M2: Ek dosya tuzağı.

### İleri eğitim: Oyun dünyası ve hileler

*Hile seni yener*

Öğrenci bu odadan sonra:

- Hile, mod ve bedava oyun parası vaadinin çoğu zaman zararlı yazılım ya da hesap tuzağı olduğunu bilir.
- "Antivirüsü kapat" diyen hiçbir şeyi kurmaz.
- Oyun hesabının bilgilerini hiçbir "jeneratör"e yazmaz.

Kartlar:

1. Bilgi: hile programı nasıl tuzak olur
2. Bilgi: bedava oyun parası jeneratörü yoktur
3. Mini test: kurulum "antivirüsü kapat" diyor
4. Resimde bul (M5): indirme sayfasında gerçek düğme hangisi
5. Bilgi: hesap satışı ve takası

#### Senaryo: Videodaki hile linki

Başlık: "%100 ÇALIŞIYOR" · Sahne: Tarayıcı · Sonuç: Fidye · Yazılacak

- **Hikâye:** "oyun hile 2026" araması seni "HİLE 2026 %100 ÇALIŞIYOR" videosuna götürüyor. Açıklamadaki kısaltılmış link üç ayrı İNDİR düğmeli bir sayfa açıyor; sabitlenmiş yorum "çalışmazsa antivirüsü kapatın" diyor.
- **Tuzak:** hile_kurulum.exe'yi indirip açmak.
- **Doğru karar:** Sekmeyi kapatmak, videoyu bildirmek.
- **İşaretler:**
    - Kısaltılmış link
    - "Antivirüsü kapat" yorumu
    - Birden çok sahte İNDİR düğmesi ve .exe
- **Gerçek öğeler:** Sayfadaki gerçek reklam alanı, oyunun resmî sayfası.
- **Ana soru:** Kurulum "antivirüsü kapat" diyor. Bu ne demek? Doğru: "Antivirüsün yakalayacağı bir şey var, kurmam". Yanlışlar: "Program büyük, antivirüs yavaşlatıyor"; "Bir kereden bir şey olmaz".
- **Bekleyen kod işi:** Tarayıcı şablonu (yeni sahne türü).

#### Senaryo: Bedava elmas jeneratörü

Başlık: "İnsan olduğunu doğrula" · Sahne: Tarayıcı · Sonuç: Hesap · Yazılacak

- **Hikâye:** "10.000 elmas 5 dakikada hesabında" diyen bir site kullanıcı adını alıyor, sayaç dönüyor, sonra "insan olduğunu doğrula" diyor: önce OyunBoost uygulamasını indir, sonra oyun şifrenle giriş yap.
- **Tuzak:** Uygulamayı indirmek ya da oyun şifresini yazmak.
- **Doğru karar:** Sekmeyi kapatmak; oyun parası yalnız oyunun kendi mağazasından gelir.
- **İşaretler:**
    - Gerçek olamayacak kadar büyük hediye
    - "Doğrulama" diye uygulama indirtiyor
    - Oyun şifresi istiyor
- **Gerçek öğeler:** Oyunun resmî duyurusu.
- **Ana soru:** Bedava elmas jeneratörleri için hangisi doğru? Doğru: "Oyun parası yalnız oyunun mağazasından gelir; jeneratörler tuzaktır". Yanlışlar: "Bazıları gerçekten çalışır"; "Şifre vermezsem güvenlidir".
- **Bekleyen kod işi:** Tarayıcı şablonu (yeni sahne türü).

### İleri eğitim: Uygulama izinleri ve güncelleme

*Neden o izni istiyor?*

Öğrenci bu odadan sonra:

- Uygulamanın istediği izni işine göre sorgular; SMS, kişiler ve erişilebilirlik izinlerinin riskini bilir.
- Kopya yorumları ve belirsiz geliştiriciyi fark eder.
- Gerçek güncellemeyi ayarlardan yapar, tarayıcıdaki "telefonun eski" uyarısına inanmaz.

Kartlar:

1. Bilgi: izin bir anahtardır
2. Bilgi: hangi uygulama neye ihtiyaç duyar (tablo kartı)
3. Mini test: el feneri rehberini istiyor
4. Bilgi: güncelleme neden önemli
5. Resimde bul (M5): mağaza sayfasında kopya yorumlar

#### Senaryo: Rehberini isteyen el feneri

Başlık: "Işık için kişiler mi?" · Sahne: Cihaz · Sonuç: Veri sızıntısı · Yazılacak

- **Hikâye:** Mağazada "Süper Fener" uygulaması: kurulumda Kişiler, SMS, Konum ve Erişilebilirlik izinleri istiyor. Yorumların üçü aynı gün, aynı cümleyle yazılmış.
- **Tuzak:** Bütün izinleri vermek; rehberindeki herkese senin adına reklam SMS'i gider.
- **Doğru karar:** Kurmamak ya da izinleri reddetmek; telefonun kendi fenerini kullanmak.
- **İşaretler:**
    - İşiyle ilgisi olmayan izinler
    - Kopya yorumlar
    - Geliştiricinin tek uygulaması var
- **Gerçek öğeler:** Hesap makinesi uygulamasının izin ekranı (hiç izin istemiyor).
- **Ana soru:** Bir el feneri uygulamasının hangi izne ihtiyacı var? Doğru: "Hiçbirine; ışık için izin gerekmez". Yanlışlar: "Kişiler ve SMS"; "Konum, yakındaki ışıkları bulmak için".
- **Bekleyen kod işi:** Cihaz şablonu (yeni sahne türü).

#### Senaryo: Kargo uygulaması diye gelen dosya

Başlık: "Paketini takip et" · Sahne: Mesajlar · Sonuç: Para · Yazılacak

- **Hikâye:** Bilinmeyen numaradan SMS: "Kargonuz şubede bekliyor, takip için uygulamamızı indirin: kargo-takip-app.xyz/takip.apk". Kurulum SMS okuma izni istiyor.
- **Tuzak:** Uygulamayı kurmak; bankanın SMS şifreleri okunur.
- **Doğru karar:** Takip numarasına kargo firmasının resmî uygulamasından bakmak, mesajı bildirmek.
- **İşaretler:**
    - Bilinmeyen numara
    - Mağaza dışı .apk bağlantısı
    - SMS okuma izni
- **Gerçek öğeler:** Kargo firmasının gerçek SMS'i (takip numarası, bağlantısız), Bankam bildirimi.
- **Ana soru:** Kargonun nerede olduğunu nasıl öğrenirsin? Doğru: "Kargo firmasının resmî uygulamasında takip numarama bakarım". Yanlışlar: "SMS'teki uygulamayı kurarım"; "SMS'e cevap yazıp sorarım".
- **Bekleyen kod işi:** M2: Ek dosya tuzağı (M1 hazır).

#### Senaryo: Gerçek güncelleme hangisi?

Başlık: "Telefonunuz eski!" · Sahne: Cihaz · Sonuç: Veri sızıntısı · Yazılacak

- **Hikâye:** Bir film sitesinde tam ekran uyarı: "Telefonunuz eski! Virüs riski. Hemen güncelleyin" ve geri sayım. Aynı anda telefonun gerçek "Güncelleme hazır" bildirimi de bildirim çubuğunda duruyor.
- **Tuzak:** Sayfadaki "Güncelle"ye basıp dosyayı kurmak.
- **Doğru karar:** Sekmeyi kapatmak, güncellemeyi Ayarlar'dan yapmak.
- **İşaretler:**
    - Güncelleme tarayıcıdan geliyor
    - Geri sayım baskısı
    - İnen dosya .apk
- **Gerçek öğeler:** Ayarlar'ın gerçek güncelleme bildirimi.
- **Ana soru:** Gerçek güncelleme nereden gelir? Doğru: "Telefonun Ayarlar bölümünden". Yanlışlar: "Sitedeki tam ekran uyarıdan"; "SMS'le gelen bağlantıdan".
- **Bekleyen kod işi:** Cihaz şablonu (yeni sahne türü).

### İleri eğitim: Fidye yazılımı ve yedekleme

*Dosyaların rehin kalmasın*

Öğrenci bu odadan sonra:

- Fidye yazılımının ne yaptığını bilir; önemli dosyalarının biri başka yerde iki kopyasını tutar.
- Fidye ekranında ödeme yapmaz, cihazı internetten ayırıp yardım ister.
- Bulunmuş belleği takmaz, korsan sitedeki "oynatıcıyı kur" isteğini reddeder.

Kartlar:

1. Bilgi: fidye yazılımı nedir
2. Bilgi: iki kopya kuralı
3. Mini test: fidye ekranında ilk ne yaparsın
4. Bilgi: korsan siteler ve "eklenti kur"
5. Video (isteğe bağlı): bir okulun dosyaları kilitlenirse

#### Senaryo: Koridorda bulunan flash bellek

Başlık: "SINAV SORULARI" · Sahne: Cihaz · Sonuç: Fidye · Yazılacak · Tanıtım sayfasında sahnesi var

- **Hikâye:** Koridorda "SINAV SORULARI" etiketli bir flash bellek buldun. Laptopa takınca pencere açılıyor: sinav_cevaplari.pdf.exe, Tür: Uygulama, Yayıncı: Bilinmiyor; ardından "Bu program cihazında değişiklik yapmak istiyor".
- **Tuzak:** Dosyayı çalıştırmak.
- **Doğru karar:** "Hayır" deyip belleği güvenle çıkarmak (en iyisi hiç takmamak), öğretmene vermek.
- **İşaretler:**
    - .pdf.exe
    - Tür: Uygulama
    - Yayıncı: Bilinmiyor
- **Gerçek öğeler:** Kendi belleğindeki ödev klasörü.
- **Ana soru:** Koridorda etiketli bir bellek buldun. Ne yaparsın? Doğru: "Takmadan öğretmene veririm". Yanlışlar: "Takıp kimin olduğuna bakarım"; "Evdeki bilgisayarda açarım".
- **Bekleyen kod işi:** Cihaz şablonu (yeni sahne türü).

#### Senaryo: Korsan dizi sitesindeki oynatıcı

Başlık: "İzlemek için eklentiyi kur" · Sahne: Tarayıcı · Sonuç: Fidye · Yazılacak

- **Hikâye:** Sinemada olan filmi bedava izleyebileceğin bir site. Oynat'a basınca "Video oynatıcınız eski, HD Oynatıcı eklentisini kurun" çıkıyor; arkada reklamlar açılıyor.
- **Tuzak:** Eklentiyi ya da dosyayı kurmak.
- **Doğru karar:** Sekmeyi kapatmak, yasal platformlarda izlemek.
- **İşaretler:**
    - Yeni çıkan film bedava
    - İzlemek için indirme istiyor
    - Açılan reklamlar ve sahte kapatma (X) düğmeleri
- **Gerçek öğeler:** Tarayıcının kendi uyarısı ("Bu site zararlı olabilir").
- **Ana soru:** Ekranda "dosyaların kilitlendi, para öde" yazıyor. İlk ne yaparsın? Doğru: "Cihazı internetten ayırır, bir büyüğüme haber veririm". Yanlışlar: "Parayı öderim, dosyalarım geri gelsin"; "Kapatıp açarım, geçer".
- **Bekleyen kod işi:** Tarayıcı şablonu (yeni sahne türü).

## Para Çarşısı (Kişisel veri ve para)

Gençler artık kendi kartlarıyla, ailelerinin kartlarıyla ve oyun cüzdanlarıyla alışveriş yapıyor. Dolandırıcılar da bunu biliyor: "bedava", "çekiliş", "kolay para" ve "hesabını kirala" teklifleri doğrudan bu yaşa yapılıyor.

Bağlantılı mahalleler: Hesap Kalesi (kimlik bilgisi), Oltalama Limanı (kart isteyen sahte sayfa), Dostluk Parkı (para isteyen şantaj).

### Temel eğitim: Kişisel veri ve para güvenliği

*Kimseye verilmeyenler* · İlk dalga

Öğrenci bu odadan sonra:

- Kimseye verilmeyecek bilgileri sayar: T.C. kimlik numarası, kart numarası, son kullanma tarihi, CVV, SMS onay kodu, şifre.
- Aileden izinsiz ödeme yapmaz, "bedava ama küçük bir ücret" tuzağını tanır.
- Para ya da bilgi isteyen her şeyde durur, ailesine sorar, resmî yerden kontrol eder.

Kartlar:

1. Video (Ayşegül ve Ayça, soru durağı): üç kutu, TC kimlik numarası hangi kutuya
2. Bilgi, keşfet düzeni: kişisel veri nedir (kimlik, iletişim, konum, okul)
3. Kutulara ayırma: hangi bilgi hangi kutuya (Yeşil, Sarı, Kırmızı; sürükle bırak)
4. Eşleştirme: bilgi yanlış ele geçerse ne olabilir
5. Boşluk doldurma: kişisel veri, üç soru, aileye sor (cümleler tek tek)
6. Video (Ayşegül ve Ayça, soru durağı): kartın önü, arkası, SMS kodu; bedava elmas için 3 rakam
7. Bilgi, banka kartı düzeni: kartın önü ve arkası, SMS kodu imzadır
8. Mini test (4 şık, hediye çizimi): çekiliş formu neyi istemez
9. Tıkla-bul: "hediye kazandın" maili
10. Mini test (4 şık, 1 TL çizimi): "bedava ama 1 TL doğrulama" ne ister
11. Bilgi, adım adım düzeni: dur, sor, kontrol et

#### Senaryo: Kulaklık için veli kartı

Başlık: "Aynı mağaza, farklı adres" · Sahne: Postam + görev · Sonuç: Para · Kod yazıldı, oda dosyası taslak · İlk dalga

(Eski adı "Ücretsiz elmas için veli kartı"; 2 Kasım'da Murat'la görevli hâle geldi. Tam metin `docs/labs/rooms/para-carsisi/scenario/kulaklik-icin-veli-karti.md`.)

- **Hikâye:** Annen görüntülü arayıp kardeşin Ege'nin doğum günü için TeknoPazar'dan kablosuz kulaklık almanı istiyor (en çok 1.250 TL); kartının bilgileri sende, onay kodu ona gelecek. Postam'da birebir aynı iki TeknoPazar maili var.
- **Tuzak:** Sahte maildeki bağlantıdan (teknopazar-gercek-tr.com) annenin kartıyla ödemek ve annene gelen 4.850 TL'lik onay kodunu yazmak.
- **Doğru karar:** Gerçek mağazadan (teknopazar.com.tr) almak; SMS'teki tutar farklıysa kodu yazmayıp annene anlatmak; sahte maili bildirmek.
- **İşaretler:**
    - Gönderen teknopazar-gercek-tr.com, mağazanın adresi değil
    - Bağlantı benzer adlı başka bir siteye gidiyor
    - SMS'teki tutar ve mağaza adı farklı
- **Gerçek öğeler:** TeknoPazar'ın gerçek maili, annenin maili, okul duyurusu.
- **Ana soru:** Annenin telefonuna gelen kodda beklediğinden farklı bir tutar yazıyor. Ne yaparsın? Doğru: "Kodu yazdırmam, anneme anlatırım". Yanlışlar: "Sistem hatasıdır, yazarım"; "Önce yazar, sonra iptal ederim".
- **Kod işi:** Görev, annenin kartı, aynı görünen mağaza sayfası, onay kodu adımı, telefonla açılış ve bitişler: yazıldı (2 Kasım; `docs/guides/new-lab.md` 2.12). Oda dosyası `labs/rooms/para-carsisi/kulaklik-icin-veli-karti.json`, taslak.

#### Senaryo: Okul çekilişinde tablet kazandın

Başlık: "Tebrikler, kazandın!" · Sahne: Mesajlar · Sonuç: Veri sızıntısı · Yazılacak · İlk dalga

- **Hikâye:** "Okul Çekilişi" adlı bir hesaptan mesaj: "Tebrikler! Tablet kazandın, kargo için formu doldur." Form ad soyad, T.C. kimlik numarası, okul ve sınıf, ev adresi ve velinin telefonunu istiyor. Hiç katılmadığın bir çekiliş.
- **Tuzak:** Formu doldurmak; bilgiler satılır, velin "kargo ücreti" için aranır.
- **Doğru karar:** Doldurmamak, bildirmek, okulun resmî hesabına bakmak.
- **İşaretler:**
    - Katılmadığın çekiliş
    - Yeni açılmış, az takipçili hesap
    - T.C. kimlik ve veli telefonu istiyor
- **Gerçek öğeler:** Okulun resmî duyurusu, arkadaşının mesajı.
- **Ana soru:** Bir çekiliş formu hangisini asla istememeli? Doğru: "T.C. kimlik numaranı ve velinin telefonunu". Yanlışlar: "Kullanıcı adını"; "Hangi rengi istediğini".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır (M1 hazır: Mesajlar'da bağlantı sahte sayfa açar).

### İleri eğitim: Online alışveriş ve ikinci el

*Sepete atmadan önce*

Öğrenci bu odadan sonra:

- Sahte mağaza işaretlerini tanır: çok ucuz, yalnız havale, yorumlar kapalı, yeni hesap.
- İkinci elde "parayı almak için kart bilgini gir" tuzağını bilir.
- Ödemeyi platformun kendi ödeme sistemiyle yapar, konuşmayı platformda tutar.

Kartlar:

1. Bilgi: sahte mağazanın 5 işareti
2. Resimde bul (M5): ilan sayfasındaki işaretler
3. Mini test: satıcı "kapora at" diyor
4. Bilgi: satarken para almak için kart bilgisi gerekmez
5. Bilgi: platform içi ödeme

#### Senaryo: Yarı fiyatına telefon

Başlık: "Son 3 ürün, sadece havale" · Sahne: Akış · Sonuç: Para · Yazılacak

- **Hikâye:** Akışta "Telefon Dünyası Outlet" hesabı: yeni model telefon yarı fiyatına, "son 3 ürün", ödeme yalnız havale, yorumlar kapalı. Mesaj atınca "kapora at, ayırayım" diyor ve bir ödeme sayfası yolluyor.
- **Tuzak:** Ödeme sayfasına kart bilgisini girmek.
- **Doğru karar:** Almamak, hesabı bildirmek, güvenilir bir mağazadan almak.
- **İşaretler:**
    - Piyasanın yarı fiyatı
    - Yalnız havale, kişi adına IBAN
    - Yorumlar kapalı, bir haftalık hesap
- **Gerçek öğeler:** Bilinen bir mağazanın kampanya gönderisi, arkadaşının gönderisi.
- **Ana soru:** Mağazanın gerçek olup olmadığını nasıl anlarsın? Doğru: "Yorumlara, hesabın yaşına ve ödeme yoluna bakarım; yalnız havaleyse almam". Yanlışlar: "Fiyat çok iyi, kaçırmam"; "Önce küçük bir kapora atıp denerim".
- **Bekleyen kod işi:** Akış şablonu (yeni sahne türü).

#### Senaryo: Eski telefonunu sat

Başlık: "Para sana mı geliyor, senden mi gidiyor?" · Sahne: Mesajlar + satış görevi · Sonuç: Para · Kod yazıldı, oda dosyası taslak · Lise için önerilir

(Eski adı "Eski telefonunu satarken gelen ödeme linki"; 2 Kasım'da Murat'la ikinci görevli oda oldu. Tam metin `docs/labs/rooms/para-carsisi/scenario/eski-telefonunu-sat.md`.)

- **Hikâye:** Baban görüntülü arayıp eski telefonunun ilanını İkinci El Pazarı'na 4.000 TL'ye koyduğunu, satışı senin halledeceğini söylüyor; kargodan önce telefonu sıfırlamanı istiyor. Mesajlar'a iki alıcı yazıyor: Emre ödemeyi uygulamada yapmış, Selin "parayı gönderdim, almak için bankadaki ödeme isteğini onayla" diyor.
- **Tuzak:** Bankam'daki ödeme isteğini onaylamak (istek "Ödenecek hesap: Senin hesabın", 4.000 TL).
- **Doğru karar:** Parayı pazar yerinde beklemek, Selin'i bildirip engellemek; Emre'nin siparişini telefonu yedekleyip hesaplardan çıkarak ve sıfırlayarak kargoya vermek.
- **İşaretler:**
    - Konuşmayı pazar yerinin dışına, Mesajlar'a taşıyor
    - Satıcıdan "onay" istiyor; ödeme isteği senin hesabından para çıkarır
    - Acele ettiriyor
- **Gerçek öğeler:** İkinci El Pazarı'nın kendi bildirimi (siparişe gider), Emre, baban.
- **Ana soru:** Bir alıcı "Parayı gönderdim, almak için bankadaki ödeme isteğini onayla" diyor. Ne yaparsın? Doğru: "Onaylamam; parayı pazar yerinde beklerim, alıcıyı bildiririm". Yanlışlar: "Onaylarım, para bana geçer"; "Önce 1 TL'lik bir istekle denerim". İkinci soru: kargodan önce ne yaparsın (yedek, hesaplardan çıkış, sıfırlama).
- **Kod işi:** Satış görevi (ilan, bankanın ödeme isteği, pazar yerindeki sipariş ve kargodan önceki hazırlık), babanın çizimi: yazıldı (2 Kasım; `docs/guides/new-lab.md` 2.13). Oda dosyası `labs/rooms/para-carsisi/eski-telefonunu-sat.json`, taslak. Babanın sesi ("İbrahim", ElevenLabs) eklendi; iyi bitişin üçüncü satırı kayıtta yok.

### İleri eğitim: Kolay para tuzakları

*Kolay para diye bir şey yok* · Lise için önerilir

Öğrenci bu odadan sonra:

- Banka hesabını, IBAN'ını ya da kartını kimseye "kiralamaz"; bunun suça ortak olmak demek olduğunu bilir.
- Görev başı para, "kesin kazanç" ve yasa dışı bahis vaatlerini tanır.
- Böyle bir teklif aldığında ailesine ya da öğretmenine anlatır.

Kartlar:

1. Bilgi: hesap kiralama ve sonuçları (hesap dondurulur, soruşturma)
2. Bilgi: görev başı paranın basamakları (önce öder, sonra yatırım ister)
3. Mini test
4. Bilgi: kesin kazanç grupları ve yasa dışı bahis reklamları
5. Bilgi: kime anlatırsın

#### Senaryo: Hesabını kirala

Başlık: "Haftada 2.000 TL, hiçbir şey yapmadan" · Sahne: Mesajlar · Sonuç: Yeni: hesabın suçta kullanıldı · Yazılacak · Lise için önerilir

- **Hikâye:** Takip ettiğin bir hesaptan mesaj: "Banka hesabın var mı? Hesabına gelen parayı başka bir hesaba aktar, her işlemden %10 senin." Başvuru linki IBAN'ı, kartı ve mobil bankacılık şifresini istiyor.
- **Tuzak:** Başvuru formunu doldurmak; hesap dolandırıcılık parası taşır, dondurulur, soruşturma açılır.
- **Doğru karar:** Reddetmek, bildirmek, ailesine ya da öğretmenine anlatmak.
- **İşaretler:**
    - Emeksiz yüksek kazanç
    - Hesabın başkasının parasını taşıması
    - Mobil bankacılık şifresini istiyor
- **Gerçek öğeler:** Arkadaşının mesajı, Bankam bildirimi.
- **Ana soru:** Hesabını "kiralamak" ne demek? Doğru: "Dolandırıcılık parasını taşımak; hesap donar, soruşturma açılır". Yanlışlar: "Kolay bir ek gelir"; "Bankanın izin verdiği bir iş".
- **Bekleyen kod işi:** M3: Yeni sonuç türleri (M1 hazır).

#### Senaryo: Beğen, kazan

Başlık: "Her beğeniye 25 TL" · Sahne: Mesajlar · Sonuç: Para · Yazılacak · Lise için önerilir

- **Hikâye:** Bilinmeyen biri: "Evden iş: videoları beğen, ekran görüntüsünü at, her beğeniye 25 TL." İlk gün gerçekten 75 TL yatmış. Ertesi gün "VIP görevler için önce 500 TL yatır, üç katını al" deniyor.
- **Tuzak:** Ödeme sayfasında kartla para yatırmak.
- **Doğru karar:** Durmak, bildirmek, ailesine anlatmak.
- **İşaretler:**
    - İşe göre çok yüksek ücret
    - Önce küçük ödemeyle güven kazanma
    - "Para yatır, kazan" basamağı
- **Gerçek öğeler:** Arkadaşının mesajı, ailenin grubu.
- **Ana soru:** İlk gün 75 TL yattı, şimdi 500 TL yatırman isteniyor. Bu ne? Doğru: "Güveni kazanıp parayı almak için kurulmuş bir tuzak". Yanlışlar: "Gerçek bir iş, ilk gün ödediler"; "Yatırırsam üç katı gelir".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır (M1 hazır: Mesajlar'da bağlantı sahte sayfa açar).

#### Senaryo: Kesin kazanç grubu

Başlık: "Bugün yatır, yarın 10 katı" · Sahne: Mesajlar · Sonuç: Para · Yazılacak · Lise için önerilir

- **Hikâye:** Eklendiğin bir grupta her gün "kazanç" ekran görüntüleri paylaşılıyor: kripto ya da maç tahmini, "bugün 200 yatır, yarın 2.000". Yönetici "sadece bugün, son 5 kişi" diyor.
- **Tuzak:** Yatırım sayfasına kart bilgisini girmek.
- **Doğru karar:** Gruptan çıkmak, bildirmek; yasa dışı bahis ve "kesin kazanç" vaadinin dolandırıcılık olduğunu bilmek.
- **İşaretler:**
    - "Kesin", "garanti" kazanç
    - Sahte kazanç ekran görüntüleri
    - Son dakika baskısı
- **Gerçek öğeler:** Sınıf grubu, arkadaşının mesajı.
- **Ana soru:** "Kesin kazanç" diyen bir grup için hangisi doğru? Doğru: "Kesin kazanç yoktur; bu bir dolandırıcılık işaretidir". Yanlışlar: "Ekran görüntüleri kanıttır"; "Az yatırırsam risk olmaz".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır (M1 hazır: Mesajlar'da bağlantı sahte sayfa açar).

## Dostluk Parkı (Güvenli iletişim)

Bu mahallede tuzak bir bağlantı değil, bir insan: alay eden bir grup, iyi niyetli görünen bir yabancı, bir fotoğrafı koz olarak kullanan biri. Doğru karar çoğu zaman tek bir adımdır: güvendiğin bir yetişkine anlatmak.

Bağlantılı mahalleler: Hesap Kalesi (yabancıya verilen bilgi), Para Çarşısı (para isteyen şantaj), Oltalama Limanı (sahte hesaplar).

> Bu mahallede yanlış kararın sonucu "Hacklendin" değildir. Yumuşak bir sonuç ekranı gerekir (M3): "Paylaşım yayıldı", "Kavga büyüdü", "Fotoğraf artık senin değil" gibi. Dil suçlamaz: "Suç senin değil, bir büyüğüne anlat."

### Temel eğitim: Çevrim içi ilişkiler ve güven

*Ekranın öbür tarafı* · İlk dalga

Öğrenci bu odadan sonra:

- Çevrim içi tanıştığı kişinin söylediği kişi olmayabileceğini bilir; tehlike işaretlerini sayar: sır, hediye, başka uygulamaya geçme, fotoğraf, buluşma.
- Zorbalık gördüğünde ve yaşadığında "dur, kaydet, engelle, bildir, anlat" adımlarını uygular.
- Güvendiği yetişkinleri belirler (aile, öğretmen, rehber öğretmen).

Kartlar:

1. Bilgi: profil fotoğrafı ve yaş kanıt değildir
2. Bilgi: 5 kırmızı bayrak
3. Mini test
4. Bilgi: dur, kaydet, engelle, bildir, anlat
5. Bilgi: suç senin değil, kime anlatırsın
6. Video (isteğe bağlı)

#### Senaryo: Oyunda tanışılan "arkadaş"

Başlık: "Sadece bizim sırrımız" · Sahne: Mesajlar · Sonuç: Veri sızıntısı · Yazılacak · İlk dalga

- **Hikâye:** Oyunda tanıştığın "Arda, 13" haftalardır çok iyi davranıyor, sana elmas hediye etti. Şimdi başka bir uygulamada konuşmak, ailene söylememeni ve hangi okula, kaçta çıktığını istiyor: "Bir gün tesadüfen karşılaşırız belki."
- **Tuzak:** Okulunu ve çıkış saatini yazmak (gizli bilgi).
- **Doğru karar:** Bilgi vermemek, engellemek, bildirmek, ailesine anlatmak.
- **İşaretler:**
    - Hediye ve iltifatla hızlı yakınlık
    - "Ailene söyleme" sırrı
    - Okul, saat ve buluşma
- **Gerçek öğeler:** Sınıf arkadaşının mesajı, annenin servis mesajı.
- **Ana soru:** Arda "ailene söyleme" dedi. Bu ne demek? Doğru: "Bir tehlike işareti; aileme anlatırım". Yanlışlar: "Aramızda kalsın, normal"; "Ailem kızar, söylemem".
- **Bekleyen kod işi:** Yok, bugünkü sahneyle yazılır.

#### Senaryo: Sınıf grubunda alay edilen arkadaş

Başlık: "Sadece şakaydı" · Sahne: Mesajlar · Sonuç: Yeni: paylaşım yayıldı · Yazılacak · İlk dalga

- **Hikâye:** Sınıf grubunda biri Ece'nin fotoğrafını alaycı bir çıkartmaya çevirip paylaşıyor; gülme emojileri art arda geliyor, biri "sen de bir şey yaz" diyor. Az sonra Ece sana özelden yazıyor: "Herkes bana mı gülüyor?"
- **Tuzak:** Gülmek, "haha" yazmak ya da çıkartmayı iletmek; paylaşım yayılır.
- **Doğru karar:** Katılmamak, ekran görüntüsü almak, mesajı bildirmek, Ece'ye destek olmak, öğretmene söylemek.
- **İşaretler:**
    - Rızası olmadan kullanılan fotoğraf
    - Alay ve aşağılama
    - "Sen de yaz" baskısı
- **Gerçek öğeler:** Ece'nin özel mesajı (destek bekliyor), grubun ödev mesajı, öğretmenin duyurusu.
- **Ana soru:** Ece'ye ne yazarsın? Doğru: "Yanındayım; ekran görüntüsünü aldım, birlikte öğretmene söyleyelim". Yanlışlar: "Hiçbir şey, karışmam"; "Şakaydı, takma".
- **Akılda kalacak cümle:** M3 gelene kadar tuzaksız oynanır: bildir kararı ve sorular puanlanır.
- **Bekleyen kod işi:** M3: Yeni sonuç türleri.

### İleri eğitim: Siber zorbalık

*Hedef olursan, görürsen*

Öğrenci bu odadan sonra:

- Zorbalık türlerini tanır: alay, dışlama, sahte hesap, itiraf sayfası, ifşa.
- Hedef olduğunda cevap vermeden kanıt saklar, engeller, bildirir; seyirciyken yaymaz, destek olur.
- Şaka ile zorbalık arasındaki farkı bilir.

Kartlar:

1. Bilgi: zorbalık türleri
2. Bilgi: hedefsen
3. Bilgi: seyirciysen
4. Mini test: şaka mı zorbalık mı (karşı taraf da gülüyor mu?)
5. Bilgi: yapay zekâyla değiştirilmiş fotoğraf da zorbalıktır

#### Senaryo: İtiraf hesabında senin hakkında gönderi

Başlık: "#okulitiraflari" · Sahne: Akış · Sonuç: Yeni: kavga büyüdü · Yazılacak

- **Hikâye:** Okulun adını taşıyan anonim bir "itiraf" hesabı senin hakkında uydurma bir gönderi paylaşmış; altında tanıdık kullanıcı adlarıyla yorumlar birikiyor.
- **Tuzak:** Altına öfkeli bir cevap yazmak ya da aynı şekilde karşılık vermek.
- **Doğru karar:** Cevap vermemek, ekran görüntüsünü saklamak, gönderiyi ve hesabı bildirmek, rehber öğretmene ve ailesine söylemek.
- **İşaretler:**
    - Anonim hesap
    - Bir kişiyi hedef alan uydurma içerik
    - Yorumlarla büyüyen baskı
- **Gerçek öğeler:** Arkadaşının destek mesajı, okulun resmî hesabı.
- **Ana soru:** Gönderiyi gördün. İlk ne yaparsın? Doğru: "Ekran görüntüsü alır, bildirir, bir büyüğüme anlatırım". Yanlışlar: "Altına cevap yazıp yalanlarım"; "Ben de onlar hakkında yazarım".
- **Bekleyen kod işi:** Akış şablonu (yeni sahne türü); M3: Yeni sonuç türleri.

#### Senaryo: Senin adına açılmış sahte hesap

Başlık: "Bu ben değilim" · Sahne: Akış · Sonuç: Yeni: kavga büyüdü · Yazılacak

- **Hikâye:** Arkadaşların "Bu hesap senin mi? Herkese hakaret ediyor" diye yazıyor. Profil fotoğrafın ve adınla açılmış bir hesap sınıf arkadaşlarına kötü mesajlar atıyor.
- **Tuzak:** Sahte hesapla tartışmak ya da kendi hesabından herkese öfkeli bir gönderi yapmak.
- **Doğru karar:** Kanıtları kaydetmek, "kimliğime bürünülüyor" diye bildirmek, arkadaşlarından da bildirmelerini istemek, ailesine ve okula söylemek.
- **İşaretler:**
    - Senin fotoğrafın ama yeni kullanıcı adı
    - Ortak arkadaşlara hakaret
    - Kısa sürede çok takip isteği
- **Gerçek öğeler:** Kendi asıl hesabın, arkadaşlarının mesajları.
- **Ana soru:** Sahte hesabı nasıl kapattırırsın? Doğru: ""Kimliğime bürünülüyor" diye bildiririm, arkadaşlarım da bildirir". Yanlışlar: "Sahte hesaba yazıp kapatmasını isterim"; "Kendi hesabımı silerim".
- **Bekleyen kod işi:** Akış şablonu (yeni sahne türü); M3: Yeni sonuç türleri.

### İleri eğitim: Fotoğraf, sınırlar ve şantaj

*Hayır demek de bir karar* · Lise için önerilir

Öğrenci bu odadan sonra:

- Özel fotoğraf istendiğinde hayır der, bunun kendi hakkı olduğunu bilir; gönderilen fotoğrafın kontrolünün kaybolduğunu bilir.
- Şantaj gelince para ya da yeni fotoğraf göndermez; kanıtı saklar, engeller, bildirir ve güvendiği bir yetişkine anlatır.
- Yapay zekâyla üretilmiş sahte fotoğrafta da aynı adımları izler.

Kartlar:

1. Bilgi: gönderilen fotoğraf artık senin değil
2. Bilgi: baskı cümleleri ("arkadaş değil miyiz", "herkes atıyor")
3. Mini test
4. Bilgi: şantajda 5 adım (ödeme, gönderme, silme, engelle ve bildir, anlat)
5. Bilgi: suç senin değil, yardım hatları (karar bekliyor)

#### Senaryo: Fotoğraf isteyen "yaşıt"

Başlık: "Sadece bende kalır" · Sahne: Mesajlar · Sonuç: Yeni: fotoğraf kontrolden çıktı · Yazılacak

- **Hikâye:** Bir oyun sunucusunda tanıştığın "Selin, 14" ile birkaç gündür konuşuyorsun. Önce iltifat, sonra "bir fotoğrafını atsana, sadece bende kalır"; sen istemeyince "arkadaş değil miyiz, herkes atıyor".
- **Tuzak:** Fotoğraf göndermek (M6: hazır "Fotoğraf gönder" düğmesi).
- **Doğru karar:** Hayır demek, engellemek, bildirmek, ailesine anlatmak.
- **İşaretler:**
    - Kısa sürede yakınlık
    - Israr ve suçluluk hissettirme
    - "Sadece bende kalır" sözü
- **Gerçek öğeler:** Arkadaşının mesajı, ailenin grubu.
- **Ana soru:** "Herkes atıyor" dedi. Ne dersin? Doğru: "Hayır; ısrar ederse engeller, bildirir, anlatırım". Yanlışlar: "Peki, bir tane"; "Başkasının fotoğrafını atarım".
- **Bekleyen kod işi:** M6: Mesajlar'da hazır cevap düğmeleri; M3: Yeni sonuç türleri.

#### Senaryo: "Fotoğrafını yayarım"

Başlık: "24 saatin var" · Sahne: Mesajlar · Sonuç: Yeni: ödedin ama durmadı · Yazılacak · Lise için önerilir

- **Hikâye:** Tanımadığın bir hesap senin bir fotoğrafını (yapay zekâyla değiştirilmiş olabilir) atıp yazıyor: "24 saat içinde 500 TL'lik oyun kartı kodu göndermezsen bunu okul grubuna atarım." Ekranın köşesinde annenin hediye ettiği oyun kartının kodu duruyor.
- **Tuzak:** Kodu göndermek (gizli bilgi) ya da pazarlık etmek.
- **Doğru karar:** Ödememek, cevap vermemek, konuşmayı silmeden ekran görüntüsü almak, engellemek, bildirmek ve hemen bir büyüğüne anlatmak.
- **İşaretler:**
    - Tanımadığın hesap
    - Süre baskısı
    - Para ya da kod isteği
- **Gerçek öğeler:** Arkadaşının mesajı, annen.
- **Ana soru:** Şantaj gelince ilk ne yaparsın? Doğru: "Ödemem; ekran görüntüsü alır, engeller, bildirir, bir büyüğüme anlatırım". Yanlışlar: "Kodu gönderirim, biter"; "Konuşmayı silerim, kimse görmesin".
- **Akılda kalacak cümle:** Ödemek bitirmez; anlatmak bitirir.
- **Bekleyen kod işi:** M3: Yeni sonuç türleri.

### İleri eğitim: Dijital iyi oluş

*Telefonu ben mi kullanıyorum, o mu beni?*

Öğrenci bu odadan sonra:

- Ekran süresini ve gece bildirimlerini yönetir (rahatsız etme, uyku modu).
- Seri (streak) ve beğeni baskısını fark eder.
- Tehlikeli akımlara katılmaz, yaymaz, bildirir.

Kartlar:

1. Bilgi: uygulamalar seni tutmak için tasarlanır (sonsuz akış, seri, bildirim)
2. Bilgi: uyku ve ekran
3. Mini test
4. Bilgi: tehlikeli akımlar: yapma, paylaşma, bildir
5. Bilgi: sana iyi gelen ayarlar

#### Senaryo: Gece 01:00 bildirimleri

Başlık: "Serin bitmek üzere!" · Sahne: Mesajlar · Sonuç: Yeni: uykusuz kaldın · Yazılacak

- **Hikâye:** Yarın sınav var, saat 01:00. Grup sohbeti hâlâ akıyor, bir uygulama "Serin 1 saat içinde bitecek!" diye bildirim atıyor, bir arkadaşın "uyuyor musun, cevap ver" diye üst üste yazıyor.
- **Tuzak:** Hepsine cevap verip ekranda kalmak.
- **Doğru karar:** Rahatsız etme modunu açmak, sabah cevap vermek, seri bildirimlerini kapatmak.
- **İşaretler:**
    - Seni ekranda tutmak için gelen seri bildirimi
    - Gece yarısı "hemen cevap ver" baskısı
    - Yarın sınav: uyku önce gelir
- **Gerçek öğeler:** Annenin "iyi geceler" mesajı, sabah için servis hatırlatması.
- **Ana soru:** Saat 01:00, yarın sınav var. Ne yaparsın? Doğru: "Rahatsız etme modunu açar, sabah cevap veririm". Yanlışlar: "Seri bitmesin diye girerim"; "Herkese tek tek cevap verip uyurum".
- **Akılda kalacak cümle:** Soru ağırlıklı bir oda; Cihaz sahnesi gelince bildirim çubuğuyla daha gerçekçi olur.
- **Bekleyen kod işi:** M3: Yeni sonuç türleri.

#### Senaryo: Tehlikeli akım videosu

Başlık: "#cesaretdenemesi" · Sahne: Akış · Sonuç: Yeni: akım yayıldı · Yazılacak

- **Hikâye:** Akışında hızla yayılan bir "cesaret akımı" videosu var; arkadaşların seni etiketleyip "sıra sende, yapamazsın" yazıyor. Akım kendine zarar verebilecek bir hareket içeriyor.
- **Tuzak:** Akımı yapmak ya da videoyu paylaşmak.
- **Doğru karar:** Yapmamak, paylaşmamak, videoyu bildirmek, arkadaşlarına neden katılmadığını söylemek.
- **İşaretler:**
    - "Yapamazsın" baskısı
    - Zarar verebilecek hareket
    - İzlenme sayısıyla övülme
- **Gerçek öğeler:** Arkadaşının normal bir gönderisi, okulun duyurusu.
- **Ana soru:** Seni etiketlediler: "sıra sende". Ne yaparsın? Doğru: "Yapmam, paylaşmam, videoyu bildiririm". Yanlışlar: "Yaparım, yoksa korkak derler"; "Yapmam ama videoyu paylaşırım".
- **Bekleyen kod işi:** Akış şablonu (yeni sahne türü); M3: Yeni sonuç türleri.

## Kod işleri

Odaların beklediği eklentiler ve yeni sahne türleri. Boyut tahminidir.

| Kod | İş | Ne yapar | Boyut |
| --- | --- | --- | --- |
| M1 | Mesajlar'da bağlantı sahte sayfa açsın | **Hazır (29 Ekim).** Tuzak anında sahte sayfanın başlığı yazılınca sahte mesajdaki bağlantı sahte sayfa açar (`docs/guides/new-lab.md` 1.7). SMS oltalaması, ödeme linki ve başvuru formu odaları bunu ister. | Küçük |
| M2 | Ek dosya tuzağı | Bugün eki açmak hiçbir şey yapmıyor. Sahte öğedeki eki açmak ele geçirilme sayılsın (fidye, hesap); açmadan önce dosya adı ve türü görünsün. | Küçük |
| M3 | Yeni sonuç türleri | Dostluk Parkı için "Hacklendin" yerine yumuşak bir sonuç ekranı (paylaşım yayıldı, kavga büyüdü...) ve Para Çarşısı için "Hesabın suçta kullanıldı". Hacklendin ekranlarının yenilenmesiyle aynı işte. | Orta |
| M4 | Mesajlar'da sesli mesaj ve arama | Yazıya dökülmüş sesli mesaj ve gelen arama balonu. Yapay zekâ sesi ve "polisim, savcıyım" odaları. Gerçek ses dosyası gerekmez. | Küçük |
| M5 | Eğitim kartı: resimde tıkla-bul | Bugün tıkla-bul yalnız mail üstünde çalışıyor. Fotoğraf, SMS, profil ya da mağaza sayfası üstünde de çalışsın. | Orta |
| M6 | Mesajlar'da hazır cevap düğmeleri | Öğrenci yazmak yerine "Fotoğraf gönder", "Konum gönder" gibi düğmelerden seçer; biri tuzaktır. | Küçük |
| Akış | Sosyal medya (yeni şablon) | Profil, gönderi, yorum, takip isteği, özel mesaj, gizlilik ayarı, "yeni gönderi" ekranı. Kararlar: bildir, engelle, gizliye al, konumu sil. Planlanmıştı; önce tuvalde çizilir. | Büyük |
| Cihaz | Telefon ve bilgisayar ekranı (yeni şablon) | Bildirim çubuğu, kurulum ve izin penceresi, USB ve dosya penceresi (tür, yayıncı), Wi‑Fi listesi, QR önizleme, "şifreyi kaydet?" sorusu, güncelleme. Ana sayfadaki üç sahne bunu ister. | Büyük |
| Tarayıcı | Web sayfası (yeni şablon) | Adres çubuğu, indirme sayfası (birden çok İNDİR), tam ekran sahte uyarı, ilan sayfası. Bugünkü sahte sayfa bileşeni çekirdeği olabilir. | Orta |

## Kararlar (17 Ekim önerileri)

Sunumun son sayfasındaki sorular; cevap gelmediği için önerilerle ilerleniyor. Ekip değiştirirse burası güncellenir.

| Konu | Soru | Karar |
| --- | --- | --- |
| Dostluk Parkı'nın sonuç ekranı | "Hacklendin" yerine yumuşak bir "durum büyüdü" ekranı mı olsun? | Evet (M3); hacklendin ekranlarının yenilenmesiyle aynı işte yapılsın. |
| Hassas odalar | "Fotoğraf, sınırlar ve şantaj" ve "Kolay para tuzakları" ortaokula da açık mı? | Herkese açık kalsın; kapakta ve ödev penceresinde "lise için önerilir" notu olsun. Yaşa göre kilit kod ve veri ister. |
| Gerçek yardım hatları | Eğitim kartlarında 112, ALO 183, İhbar Web gibi resmî hatların adı geçsin mi? | Geçsin. Gerçek marka yasağı sahneler içindir; resmî yardım hatları ayrı tutulur. Ekip yazarken güncel bilgiyi kontrol eder. |
| İlk dalga | İlk 16 oda her mahallenin temel yolu olsun mu? | Evet: 5 mahallenin rozeti ve Şehir turu ilk dalgada kazanılır; yeni sahne türü beklemez. |
| Bir odada kaç tuzak | Odalar bugünkü gibi tek sahte öğeyle mi yazılsın? | Evet; birden çok sahte öğe gelince bazı odalara ikinci tuzak eklenir. |

