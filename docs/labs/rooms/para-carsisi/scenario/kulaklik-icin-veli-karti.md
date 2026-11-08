# Senaryo odası: Kulaklık için veli kartı

| Alan | Değer |
| --- | --- |
| Mahalle | Para Çarşısı |
| Açan eğitim | Kişisel veri ve para güvenliği (temel eğitim) |
| Sahne | Postam + görev (annenin isteği, annenin kartı, mağaza sayfası, onay kodu adımı: yeni parçalar, aşağıda "Bekleyen kod işi") |
| Oda adresi | `/oda/kulaklik-icin-veli-karti` |
| Yazan | Murat |
| Durum | Kod yazıldı, oda dosyası taslak (2 Kasım 2026): `labs/rooms/para-carsisi/kulaklik-icin-veli-karti.json` |
| Plan | `docs/labs/room-plan.md` içindeki "Senaryo: Kulaklık için veli kartı" (eski adı "Ücretsiz elmas için veli kartı") |
| Tasarım | Oynanabilir sahne tuvali: https://claude.ai/artifact/S8v55Mmkjpv8xDDyskLi5H (açılış, Postam, mağaza, SMS, iki bitiş) |

## Nasıl değişti

İlk taslakta sahte bir "10.000 elmas, 1 TL doğrulama" maili vardı. Murat (2 Kasım): öğrencinin bir karta bilgi girmesi için hiçbir sebep yok, oda sıradan kalıyor. Bu yüzden oda **görevli** oldu: annen bir şey almanı istiyor, kart bilgisi elinde; öğrenci görevi yaparken tuzaktan etkilenmemeye çalışıyor. Görev elmas yerine internetten elektronik alışverişe döndü.

Murat'ın kararları (2 Kasım):

- Açılış ve bitişler annenin **görüntülü aramasıyla**: telefon titreyerek çalar, oynatıcı kararır, telefonun arkasında yumuşak bir sahne ışığı yanar ve çalarken nabız gibi atar (3 Kasım, 9B). Öğrenci "Aç"a basar. Görüşmede öğrencinin kendi küçük görüntüsü ("Sen" penceresi) **yok**.
- Annenin görüntüsü Ayşegül ve Ayça videolarındaki gibi **Notionists** karakteriyle yapılır (aşağıda "Animasyon kaynağı").
- "Tamam anne, anladım" düğmesi üstüne gelince renk değiştirir.
- Sahne sitenin oda oynatıcısının kalıbındadır: üstte oynatıcı şeridi, ortada Postam, **sağda Görevler paneli**.
- Gerçek ve sahte TeknoPazar maili ile mağaza sayfaları **birebir aynıdır**. Farklı olan yalnızca gönderen ve site adresi (sahtesi kolay fark edilsin: `teknopazar-gercek-tr.com`) ve annenin telefonuna gelen SMS'teki tutar. Sahte sayfada bugünkü "Güvenli değil" uyarısı gösterilmez.

## Kapak

- **Oda adı** (80): Kulaklık için veli kartı
- **Esprili başlık** (80): Aynı mağaza, farklı adres
- **Kısa açıklama** (200): Annen Ege'nin doğum günü hediyesini almanı istedi, kartı da sende. Gelen kutunda iki tane TeknoPazar maili var. Hangisinden alırsın?
- **Hikâye** (800): Yarın kardeşin Ege'nin doğum günü. Annen seni arıyor: TeknoPazar'dan ona kablosuz kulaklık almanı istiyor, 1.250 TL'yi geçmemen şartıyla. Kartının bilgileri sende, onay kodu ise annenin telefonuna gelecek. Postam'da TeknoPazar'dan iki mail var, ikisi de aynı kulaklığı aynı fiyata gösteriyor. Görevi yaparken dikkatli ol: bir tanesi gerçek değil.
- **Zorluk:** Orta
- **Süre (dk):** 8
- **Bu odada ne öğreneceksin** (en fazla 3):
  1. **Aynı görünen iki mail:** Logo, metin ve fiyat kopyalanabilir. Gerçeği ayıran gönderen adresi ve sitenin adresidir.
  2. **Onay kodu bir imzadır:** SMS'teki tutar ve mağaza adı beklediğin gibi değilse kod kimseye yazılmaz.
  3. **Veli kartı, velinin kararıdır:** Ailenin kartını yalnızca onların izniyle ve onların bildiği yerde kullanırsın.
- **"Bu odada şunlara dikkat et"** (en az 2, en fazla 4):
  1. **Gönderene bak:** @ işaretinden sonrasını oku. Mağazanın gerçek adresi ne?
  2. **Adres çubuğuna bak:** Ödeme sayfası hangi sitede açıldı?
  3. **SMS'i oku:** Kodla birlikte gelen tutar ve mağaza adı doğru mu?

## Açılış: annenin araması

Oda açılınca oynatıcı kararır, telefon titreyerek çalar ("Annem · Görüntülü arama…"). Öğrenci "Aç"a basar (Reddet'e basarsa "Annen tekrar arıyor…"). Annen altyazıyla konuşur:

1. "Canım, bir şey rica edeceğim."
2. "Yarın Ege'nin doğum günü. TeknoPazar'dan ona kablosuz kulaklık alır mısın?"
3. "Sitesi teknopazar.com.tr, başka bir adrese girme ha!" (3 Kasım, 12. revize: gerçek adresi görevi veren söyler. Ses Lisa'yla yeniden kaydedilecek; kayıt gelene kadar yalnızca altyazı, `voice.lines`'ta boş.)
4. "Kartımın bilgileri sende. 1.250 TL'yi geçme, tamam mı?"
5. "Onay kodu benim telefonuma gelecek, gelince sana söylerim."

Telefonun altından görev kartı çıkar, maddeler ikonlarıyla sırayla gelir, düğme en son (3 Kasım, 10. revize): **Görevin: Ege'ye kablosuz kulaklık al** · **TeknoPazar**'dan kulaklığı al · Sitesi **teknopazar.com.tr**, başka adrese girme · En çok **1.250 TL** harca · **Annenin kartını** kullan · Onay kodu **annende**, o söyleyecek. Düğme: **Tamam anne, anladım**. Basınca ışık kalkar; "Annenin isteği" kutusu ve annenin kartı (4821 •••• •••• 3307, SKT 08/29, CVV) Görevler panelinin en üstüne yerleşir. "Tekrar dinle" aramayı yeniden açar. "Geç" bütün konuşmayı atlar.

## Sahne: mailler

### Öğe 1 (Sahte): TeknoPazar

- **Gönderen adı** (60): TeknoPazar
- **Adres** (80): kampanya@teknopazar-gercek-tr.com
- **Konu** (120): Favorindeki kulaklık stokta: 1.199 TL
- **Saat** (20): 19:42
- **Metin** (1200):

  > Merhaba,
  >
  > Favorilerine eklediğin **kablosuz kulaklık** stoklarımıza geri geldi. Fiyatı **1.199 TL**.
  >
  > Stoklar sınırlı, siparişini bugün verirsen yarın kargoda.

- **Alt satır** (300): TeknoPazar · Bu maili favorilerin için aldın.
- **Bağlantı:** `teknopazar-gercek-tr.com/urun/kablosuz-kulaklik` · "Ürüne git"
- **İşaretler:**
  - Gönderen: Gerçek mağazanın adresi teknopazar.com.tr. Bu mail teknopazar-gercek-tr.com'dan geliyor; gerçek bir mağaza adresine "gerçek" yazmaz. · `teknopazar-gercek-tr.com`
  - Bağlantı: "Ürüne git" mağazanın kendi sitesine değil, benzer adlı başka bir siteye gidiyor. · `Ürüne git`
  - Metin (SMS anı): Ödeme yapınca annene gelen kodda 1.199 TL değil "TKNPZR*ODEME, 4.850 TL" yazıyor. · `1.199 TL`
- **Raporda "Neden?"** (400): Mail, metni ve fiyatı gerçeğinin aynısı; tek fark gönderen adresi. Bağlantı da benzer adlı başka bir siteye gidiyor ve oradaki ödeme, annenin telefonuna bambaşka bir tutar için onay kodu gönderiyor.

### Öğe 2 (Gerçek): TeknoPazar

- **Gönderen adı** (60): TeknoPazar
- **Adres** (80): kampanya@teknopazar.com.tr
- **Konu** (120): Favorindeki kulaklık stokta: 1.199 TL
- **Saat** (20): 18:10
- **Metin:** Öğe 1'in aynısı.
- **Bağlantı:** `teknopazar.com.tr/urun/kablosuz-kulaklik` · "Ürüne git"
- **Raporda "Neden?"** (400): Mağazanın kendi adresinden geliyor ve bağlantısı kendi sitesine gidiyor. Ödeme yapınca annene gelen kodda da doğru mağaza ve doğru tutar yazıyor.

### Öğe 3 (Gerçek): Annem

- **Adres:** ayse.k@postam.com · **Saat:** 17:30 · **Konu:** Ege'nin hediyesi
- **Metin:** "Canım, telefonda konuştuğumuz gibi Ege'nin kulaklığını TeknoPazar'dan alırsın. Kartımın bilgileri sende. Onay kodu bana gelecek. Öptüm, annen"
- **Raporda "Neden?"** (400): Annenin bildiğin adresi. Kart bilgisini mailde açık yazmıyor, senden bir şey istemiyor.

### Öğe 4 (Gerçek): Okul Duyuru

- **Adres:** duyuru@ornek-ortaokulu.k12.tr · **Saat:** 16:05 · **Konu:** Dijital güvenlik haftası
- **Metin:** "Sevgili öğrencilerimiz, önümüzdeki hafta dijital güvenlik haftası. Perşembe 3. derste internetten alışveriş tuzakları üzerine kısa bir sunum yapılacak."
- **Raporda "Neden?"** (400): Okulun bilinen adresi, link yok, senden bir şey istemiyor.

## Mağaza sayfası ve onay kodu

İki bağlantı da aynı mağaza sayfasını açar (TEKNOPAZAR şeridi, "Kablosuz Kulaklık · Siyah", 1.199 TL, "Yarın kargoda · Ücretsiz kargo", kilit simgesi). Fark yalnızca adres çubuğunda.

1. **Annenin kartını kullan:** kart bilgileri karttan dolar; öğrenci hiçbir şey yazmaz (rastgele metin girilip "bilgi girildi" sayılmasın diye).
2. **1.199 TL öde.**
3. **Annenden mesaj:**
   - Gerçek sitede: "Bankadan kod geldi: '**TeknoPazar, 1.199 TL** tutarındaki işlem için onay kodu: 481 920'. Tutar doğru, yazabilirsin."
   - Sahte sitede: "Bankadan kod geldi: '**TKNPZR*ODEME, 4.850 TL** tutarındaki işlem için onay kodu: 481 920'. Sen 1.199 TL demiştin?"
4. **Seçim:** "Kodu yaz" ya da "Yazma, anneme anlat".
   - Gerçek sitede "Kodu yaz": görev tamam, iyi bitiş.
   - Sahte sitede "Kodu yaz": **Para** türünde ele geçirilme, kötü bitiş.
   - Sahte sitede "Yazma, anneme anlat": annen "İyi ki yazmadın! Kartı hemen kapattırıyorum, kart bilgileri o siteye gitti." der. Hacklenmiş sayılmaz ama sahte mailden 0 puan alır; raporda "Son anda durdun, ama kart bilgisi gitti; annen kartı kapattırmalı." (Murat'ın itirazı yoksa böyle kalır.)
   - Gerçek sitede "Yazma, anneme anlat": annen "Tutar doğruydu aslında, ama sorman iyi oldu." der ve kodu söyler; görev tamamlanır.

## Bitişler

- **İyi bitiş:** Annen geri arar (sıcak ışık): "Kulaklık yarın geliyormuş, Ege çok sevinecek!" · "Bankadan gelen mesajda TeknoPazar ve 1.199 TL yazıyordu, tam doğru." · Sahte maili bildirdiyse: "Öbür sahte TeknoPazar mailini de bildirmişsin. Teşekkürler canım!" Konfeti (hareketi azalt açıksa yok), kart: "Görev tamam · Ege'nin kulaklığı yolda", düğme "Raporu gör".
- **Kötü bitiş:** Işık kırmızıya döner, annen panikle arar: "Bankadan mesaj geldi: kartımdan 4.850 TL çekilmiş!" · "Sen bana 1.199 TL demiştin. Hangi siteye girdin?" · "Hemen bankayı arayıp kartı kapattırıyorum." Ekran sarsılır (hareketi azalt açıksa yok), sonra bugünkü "Hacklendin" alarmı: "Annenin kartından 2.400 TL çekildi · TKN*PAY", "2.450 TL çekildi · Online alışveriş", "Kart limiti doldu · Toplam 4.850 TL".

**Hacklendin hikâyesi:**

- Gerçek hayatta bu ne demek? (500): Kart bilgisi ve onay kodu bir araya gelince dolandırıcı yalnızca senin gördüğün tutarı değil, kartın limiti kadar harcama yapabilir. Kart annenin olduğu için para ailenin hesabından gider; bankaya itiraz etmek günler sürer, bazen para geri alınamaz.
- Bir dahaki sefere:
  1. Hemen veline söyle: kartı bankanın uygulamasından ya da müşteri hizmetlerinden kapattırsın.
  2. Bankaya "bu harcamayı ben yapmadım" diye itiraz edilsin; ne kadar erken, o kadar iyi.
  3. Sahte maili Postam'da "Oltalama" diye bildir ve sil.

## Görevler

1. **UYGULAMADA YAP:** Gelen kutunu aç, maillere göz at
2. **ANNENİN GÖREVİ** (yeni): Kulaklığı doğru yerden al · puan 1 (gerçek siteden alırsa)
3. **UYGULAMADA YAP:** Gelen kutunu incele, şüpheli bulduklarını bildir
4. **SORU:** Annenin telefonuna gelen onay kodunda senin beklediğinden farklı bir tutar yazıyor. Ne yaparsın?
   - Kodu kimseye yazdırmam, anneme durumu anlatırım · puan 1
   - Sistem hatasıdır, kodu yazarım · 0
   - Önce kodu yazar, sonra iptal ederim · 0
   - Annemden kodu alır, tutara bakmadan girerim · 0
   - **Doğrusu:** Kodu yazmamak ve durumu annene anlatmak.
   - **Neden?** Onay kodu, mesajda yazan tutarı ve mağazayı onaylayan imzadır. Tutar ya da mağaza beklediğin gibi değilse kod yazılmaz; yazılınca harcama geri alınamayabilir.
5. **SORU:** İnternetten alışverişin güvenli yolu hangisi?
   - Mağazanın kendi sitesine adresini kendim yazarak girerim · puan 1
   - Mailde gelen indirim linkinden · 0
   - En ucuz fiyatı gösteren siteden · 0
   - Arkadaşımın attığı linkten · 0
   - **Doğrusu:** Mağazanın sitesine adresini kendin yazarak girmek.
   - **Neden?** Mailin görünüşü, logosu ve fiyatı kopyalanabilir. Adresi kendin yazınca sahte bir siteye düşmezsin.

(4. ve 5. soru 2 Kasım'da Murat'ın onayından geçti.)

**Puan toplamı:** sahte mail 4 + gerçek mailler 3 + görev 1 + sorular 2 = **10**

## Rapor: "Bir dahaki sefere" ipuçları

1. `engaged`: "Ürüne git"e basmadan önce adresi oku: teknopazar-gercek-tr.com mağazanın adresi değil.
2. `hacked`: Onay kodunu yazmadan önce SMS'teki tutarı ve mağaza adını oku. Beklediğin gibi değilse kod yazılmaz.
3. `missedFake`: İki mail birebir aynı olabilir. Gerçeğini ayıran gönderen adresidir: @ işaretinden sonrasına bak.
4. `reportedReal`: Gerçek TeknoPazar maili de aynı görünür ama mağazanın kendi adresinden gelir.
5. `always`: Ailenin kartını yalnızca onların izniyle, adresini kendin yazdığın mağazada kullan.

## Animasyon kaynağı (annenin görüntüsü)

Kişisel veri videosundaki kararlar (`/mnt/project-files/para-carsisi/video-kisisel-veri-nedir.md`, "Kararlar"):

- Bütün oda videolarında karakterler **Notionists** setinden çizilir (CC0: ücretsiz, kaynak göstermek gerekmez). Başka bir sete geçilmez.
- Set DiceBear kütüphanesinde gelir: `@dicebear/collection`, stil `notionists` (64 saç, 25 kıyafet, 30 ağız, 20 burun, 13 kaş, 5 göz, 11 gözlük, 12 sakal, 10 el hareketi). Çizim siyah beyaz; renk arka plan dairesinden ve temadan gelir. Belden yukarı çizilir; konuşurken ağız şekilleri, göz kırpma, baş eğme ve hazır kol pozları arasında geçiş yapılır.
- Ses ElevenLabs'te (Eleven v4 ya da Multilingual v2, dil Turkish, Stability yaklaşık %60, hız 0,8). Murat okutur, mp3'leri yükler; videolarda altyazı gömülüdür.
- Önceki animasyonların kaynakları (karakter motoru, sahne betikleri): `/mnt/project-files/para-carsisi/video/kaynak/`; karakter adayları `video/notionists-adaylar.png`, `video/notionists-karakterler.png`.

Anne bu set içinden yetişkin bir kadın karakter olarak kurulur. Aramanın içinde (gelen arama ekranında yuvarlak, görüşmede tam ekran) konuşur; sesli mi yalnız altyazılı mı olacağı kod konusunda Murat'a sorulur.

## Bekleyen kod işi

**Durum (2 Kasım):** yedisi de yazıldı; nasıl yapıldığı `docs/guides/new-lab.md` 2.12'de. Annenin sesi (ElevenLabs, Murat 2 Kasım) her satırda çalar; ses kapalıyken altyazı kalır. "Yazma, anneme anlat" diyen sahte mailden 0 puan alır (Murat 2 Kasım: kartı sahte siteye yazmak zaten hata).

Bugünkü Postam sahnesine şu parçalar eklenecek (geriye uyumlu şema alanları; `docs/guides/new-lab.md` 2. kısım ve oda dosyası aynı PR'da):

1. **Görev (mission):** odanın başındaki istek (kimden, altyazı satırları, görev maddeleri), Görevler panelinin üstündeki "Annenin isteği" kutusu ve "Tekrar dinle"; yeni görev türü "Annenin görevi" ve puanı.
2. **Kart (wallet):** görev panelinde annenin kartı; formlar "Annenin kartını kullan" ile dolar. Kart bilgisi hiçbir yere gönderilmez, yalnızca "bilgi girildi" olayı kaydedilir.
3. **Mağaza sayfası:** gerçek ve sahte bağlantı aynı mağaza şablonunu açar; fark adres. Sahte sayfa bu odada "Güvenli değil" uyarısı göstermez (alan: gerçeğe benzeyen sahte sayfa).
4. **Onay kodu adımı:** ödeyince annenden gelen SMS (mağaza adı ve tutar öğeye göre), "Kodu yaz" / "Yazma, anneme anlat"; yeni sonuç: son anda durdu.
5. **Açılış ve bitişler:** telefonla gelen görüntülü arama, kararan oynatıcı, yumuşak sahne ışığı, iyi ve kötü bitiş aramaları; hareketi azalt açıksa sarsıntı, flaş ve konfeti yok.
6. **Alarm metni:** "Annenin kartından" (tuzakta isteğe bağlı "kimin kartı" alanı).
7. **Rapor:** görev satırı ("Ege'nin kulaklığını doğru mağazadan aldın" ya da "Görev yarım kaldı") ve son anda durma sonucu.
