# Tur 1 planı: hesap ekranları ve lab akışı

Son güncelleme: 9 Ekim 2026 · Durum: **Tur 1 kapandı.** B (5–8) ve C (11–15) bitti. Açık konular en altta. Tur 2 yeni bir tuvalde başlayacak.

Her ekran masaüstü ve mobil olarak, koyu temada çizilecek. B ekranları Murat'ın isteğiyle gri temada da çizildi (koyuların sağında). "Hacklendin" ekranı gri temada da çizilecek. Genel liste: [screen-list.md](screen-list.md)

---

## B. Hesap ekranları (5–8)

Ortak fikir: hesap ekranları da öğretici olsun. Öğrenci kayıt olurken bile güvenlikle ilgili bir şey öğrensin.

**Ortak yerleşim**

- **Masaüstü:**
  - Kayıt ve şifre sıfırlama: ortada tek kart, arka planda soluk akan iplikler. Yan panel yok.
  - Giriş ve doğrulama: solda form, sağda iplikli panel. Paneldeki ipucu dikeyde ortalı.
- **Mobil:** Tek sütun. Üstte logo, altında form. Giriş ve doğrulamada ipucu formun altına iner. Kayıtta ipucu yok.

### 5. Kayıt ol

- **Alanlar:**
  - Görünen ad. Gerçek ad zorunlu değil, takma ad da olur.
  - E-posta
  - Şifre, göster/gizle düğmesiyle
- **Canlı şifre gücü göstergesi** (öğretici kısım). Şifre yazıldıkça şu maddeler tek tek yeşile döner:
  - En az 12 karakter
  - Harf + rakam
  - Sembol
  - "Yaygın şifre değil"

  Altında şu açıklama çıkar: "Bu şifre bir bilgisayarla yaklaşık X sürede kırılır."
- **KVKK onay kutusu:** Aydınlatma metnine bağlantı verir. Ön işaretli olmaz.
- **Doğum yılı:** Sadece yıl seçilir, açıklama yazısı yok.
- **Eğitim durumu:** Hiçbiri seçili gelmez. Seçince kademe kutusu açılır, o da "Seç" ile boş başlar. Seçili düğmeye tekrar basınca seçim kalkar.
- **İpucu yok.** Masaüstünde form ortada tek kart. Mobilde adres çubuğu ipucu kaldırıldı (1. revize).
- **Altta:** "Zaten hesabın var mı? Giriş yap"

### 6. Giriş yap

- **Alanlar:** E-posta, şifre, "Şifremi unuttum" bağlantısı.
- **Başlık:** Bu cihazdan daha önce giriş yapılmışsa "Tekrar hoş geldin", ilk kez geliyorsa "Hoş geldin" (Murat, 9 Ekim).
- **Hatalı girişte:** "E-posta ya da şifre hatalı" mesajı çıkar. Hangisinin yanlış olduğu söylenmez, bu bir güvenlik kuralı.
- **5 hatalı denemeden sonra:** "Birkaç dakika bekle" uyarısı ve geri sayım.
- **Dönen ipucu (1. revize):** Her girişte 3 ipucundan biri rastgele gelir, 9 saniyede bir sıradakine geçer, altındaki noktalarla seçilebilir. Her birinin kendi kısa animasyonu var. Hiçbirinde kullanıcı adı ya da gerçek isim görünmez.
  1. **Çıkış yap:** İmleç "Çıkış yap"a gidip tıklar, "Oturum kapatıldı" çıkar.
  2. **Şifreyi kaydetme:** Tarayıcı "Şifre kaydedilsin mi?" diye sorar, imleç "Hiçbir zaman"a tıklar.
  3. **Omuz sörfü:** Şifre yazılırken yandan bir göz belirir, "Biri bakıyor" uyarısı çıkar.

### 7. E-posta doğrulama

- **Ekran:**
  - 6 kutulu kod girişi. Her rakamdan sonra imleç bir sonraki kutuya geçer. Kodun tamamı tek seferde yapıştırılabilir.
  - "Kodu tekrar gönder" düğmesi 60 saniyelik geri sayımdan sonra açılır.
  - "E-postanı mı yanlış yazdın? Değiştir" bağlantısı.
- **İpucu:** "Bu kodu kimse senden isteyemez. Careful Mode bile." Doğrulayıcı labıyla bağlantılı.
- **Giden mail tasarımı:**
  - Logo, büyük harflerle kod, 10 dakikalık geçerlilik süresi.
  - "Bu kodu kimseyle paylaşma."
  - "Bu maili sen istemediysen görmezden gel."
- **Doğrulanmamış hesap uyarısı:** Doğrulanmamış hesapla girilince ana sayfanın üstünde ince bir şerit çıkar: "E-postanı doğrula, ilerlemen kaybolmasın."

### 8. Şifremi unuttum

Önce bir rehber ekranı gelir: "Şifreni sıfırlayalım, 4 kısa adım var", adımların listesi ve "Anladım, başlayalım" düğmesi. Sonra üstte adım çubuğu (Adım 2/4) ve "Geri" ile şu dört adım gelir (1. revize, tıklanabilir):

1. **E-posta gir.**
2. **"Kod gönderildi" ekranı.** Bu mesaj hesap olsa da olmasa da aynıdır, kimin kayıtlı olduğu belli olmaz.
3. **6 haneli kod.** 7'deki bileşenin aynısı.
4. **Yeni şifre.** Kayıttaki canlı güç göstergesinin aynısı. Şifre yeterince güçlü olmadan "Şifremi değiştir" açılmaz. Sonunda başarı ekranı çıkar.

Mail ile bağlantı göndermek yerine kod kullanmayı öneriyorum. Hem 7 ile tutarlı olur hem de "maildeki bağlantıya tıkla" alışkanlığını öğretmemiş oluruz. Oltalama labında tam tersini öğretiyoruz.

---

## C. Lab akışı (11–15)

Akış: Lab detayı → Eğitim kartları → Lab → (hacklendin) → Rapor

**Çizim sırası (9 Ekim):** Hikâye sırasıyla, iki parti. 1. parti: 11 ve 12. 2. parti: 13, 14, 15.

**Tema katmanları (9 Ekim önerisi):**
- Careful Mode ekranları (detay, kart oynatıcısı, lab üst barı ve görev paneli, rapor) seçilen temada (koyu/gri).
- Labın içindeki uygulama (Postam) kendi açık ve sade görünümünde, site temasıyla değişmez. Postam'ın rengi turuncu (#EA580C), beyaz zemin.
- Hacklendin ekranı iki temanın da dışında, kırmızı ağırlıklı tam ekran alarm.

### 11. Lab detay sayfası

- **Üst kısım:**
  - Kategori rozeti (Oltalama), lab adı (Sahte kargo maili)
  - Zorluk, süre (8 dk)
  - "Bu labı 124 kişi tamamladı" satırı
- **Bu labda ne öğreneceksin:** 3 kısa madde.
- **Adımlar:** Mobil 1.3D'deki Eğitim → Lab → Rapor adımları, durumlarıyla birlikte.
- **Uygulama önizlemesi:** "Bu labda Postam'ı kullanacaksın" yazısı ve küçük bir önizleme.
- **Önceki denemelerin:** En iyi puan ve son deneme tarihi. Sadece kişinin kendisi görür.
- **Ana buton:** "Başla" ya da "Kaldığın yerden devam et".
- **Ziyaretçi hali:** Sayfa açık ama içerik kilitli, "Kayıt ol ve başla" butonu var. Bu ekran 2 numaralı kategori sayfasının yarısını da çözüyor.

### 12. Eğitim kartı oynatıcısı

- **Odak modu:** Menüler gizlenir.
  - Üstte parçalı ilerleme çubuğu (Kart 3/6) ve kapatma düğmesi.
  - Altta "Geri" ve "Devam" düğmeleri. Mobilde kartlar parmakla kaydırılır.
- **Kart türleri:** Hepsini yan yana göstereceğim.
  1. **Bilgi kartı:** Bir görsel ve en fazla 2–3 cümle.
  2. **Tıkla-bul:** Bir mail ya da SMS görseli üzerinde "3 şüpheli yeri bul". Bulunan yer halkayla işaretlenir ve kısa açıklama çıkar. Sayaç "2/3 bulundu" diye ilerler.
  3. **Mini test:** Çoktan seçmeli. Cevaptan sonra anında doğru/yanlış ve "neden" açıklaması gelir.
  4. **Video kartı:** 2–3 dakikalık video. Belirli anlarda durur ve soru sorar.
  5. **Bitiş kartı:** "Eğitim bitti" ve "Laba geç" butonu.

### 13. Lab çerçevesi

Labların hepsinin içine oturduğu çerçeve. İçindeki uygulama (Postam) lab yazarı tarafından yazılır.

- **Üst bar:**
  - Lab adı, ilerleme (Görev 2/4) ve "Çık" düğmesi.
  - İnce bir "Simülasyon" etiketi. Öğrenci gerçek mail sanmasın, ama gerçekçilik de bozulmasın.
- **Görev paneli:**
  - Masaüstünde sağda durur. Mobilde alttan açılan bir çekmece olur, kapalıyken sadece "Görev 2/4" yazan bir şerit görünür.
  - Görevler sırayla açılır. Sonrakiler kilitli ve bulanıktır. Cevap gönderilince bir sonraki görev açılır.
  - İki tür görev var:
    - **Uygulamada yap:** Örneğin "Şüpheli maili bildir".
    - **Soru cevapla:** Çoktan seçmeli ya da kısa seçim.
- **Uygulama alanı:**
  - Postam gelen kutusu, 3 mail.
  - Her mailin açık halinde Bildir / Yanıtla / Sil araç çubuğu var.
  - Gerçek bir maili "oltalama" diye bildirmek hata sayılır.
- **Masaüstü / mobil:** Postam masaüstünde iki sütunlu (liste + mail), mobilde telefon mail uygulaması gibi (liste → mail). Görünüm aynı kalır, sadece yerleşim değişir.

### 14. "Hacklendin" ekranı

- **Tetiklenme:** Yanlış bir eylem tetikler, örneğin sahte linke tıklamak.
- **İlk 3–4 saniye dramatik:**
  - Ekran sarsılır, kırmızı flaş ve hafif bir bozulma (glitch) efekti çıkar.
  - Bir ses çalar. Köşede sessiz düğmesi var, seçim hatırlanır.
- **Türüne göre değişen mesaj:** Doküman ile aynı dört tür:
  - **Hesap:** "Şifren değiştirildi, hesabından atıldın."
  - **Fidye:** "Dosyaların kilitlendi" ve sahte geri sayım.
  - **Veri sızıntısı:** "Bilgilerin satışa çıkarıldı."
  - **Finansal:** "Kartından 2.450 TL çekildi."
- **Sonra sakin bir açıklama kartı gelir:**
  - "Ne oldu? Gerçek hayatta bu tıklama şu anlama gelirdi…"
  - "Raporu gör" ve "Tekrar dene" butonları.
- **Hareket hassasiyeti:** Telefonda "hareketi azalt" açıksa sarsıntı ve flaş olmaz, sadece renk değişir.
- **Temalar:** Koyu ve gri iki temada da çizilecek.

### 15. Sonuç raporu

- **Üst kısım:**
  - Puan halkası (8/10).
  - Durum rozeti: "Güvende kaldın" ya da "Hacklendin".
  - Varsa önceki denemeyle karşılaştırma ("Geçen sefer 6/10").
- **Adım adım ne oldu:** Her görev için şu üç şey yazar:
  - Ne yaptın
  - Doğrusu neydi
  - Neden
- **Kaçırılan işaretler:** Mail görselinin üzerinde işaretlenmiş olarak gösterilir.
- **Bir dahaki sefere:** 3 maddelik özet.
- **Butonlar:** "Tekrar dene", "Sıradaki lab", "Eğitime dön". Lab sıfırlama yok.
- **İleride:** Yazdırılabilir hali (öğretmen önerisi). Şimdilik çizilmeyecek.

---

## Genel kararlar (9 Ekim, 11 yorumlarından)

- **Sabit header:** Tanıtım sayfasındaki düzen her yerde. Logo solda, geri kalan her şey sağda; menü hiçbir sayfada yer değiştirmez, sadece bulunulan sayfa vurgulanır.
  - Ziyaretçi: Yol haritası · Lablar · Öğretmenler için | Giriş yap | Ücretsiz kayıt ol | tema
  - Giriş yapmış: Ana sayfa · Yol haritası · Lablar | profil | tema
  - İstisna: eğitim kartları ve lab odak modunda, header yerine sadece kapat + ilerleme.
- **İsim birliği:** Her yerde "Lablar" denir, "Kategoriler" denmez (tanıtım sayfasındaki menü de değişecek).
- **Mizah:** Lab başlıkları esprili olur ("Kargonuz kapıda... değil!"), hemen altında ciddi bir etiket ne öğrettiğini söyler ("Sahte kargo maili"). İsimler sonra birlikte yazılacak.
- **Ziyaretçi:** Lab listesi herkese açık (ad, süre, kısa açıklama). Bir laba tıklayınca detay sayfası açılmaz, "Ücretsiz hesabını aç" penceresi çıkar. Ziyaretçi lab detay sayfası yok.
- **Lab evreni markaları:** Labların içindeki uygulamalar hayali markalardır ve her labda aynı kalır.
  - **Postam:** mail markası. Turuncu (#EA580C) logo, beyaz zemin, kendi görünümü; site temasıyla değişmez.
  - İleride: banka, sosyal medya vb. için mizahi isimli markalar (isimleri sonra).
- **Kişi sayısı:** "124 öğrenci tamamladı" renkli yuvarlaklarla vurgulanır; isim ya da fotoğraf gösterilmez.
- **Avatar seçimi (fikir, Murat):** Kayıttan sonra öğrenci 10–15 hazır avatardan birini seçer, fotoğraf yüklenmez. Header'daki profil düğmesinde ve "tamamlayanlar" kalabalığında bu avatarlar görünür. Tasarımlarda şimdilik hayvan/robot emojileriyle temsil ediliyor; gerçek avatar seti ileride çizilecek. Avatar seçme adımı Tur 2'deki profil (16) ve kayıt sonrası akışa eklenecek.
- **Lab kapağı şablonu (Murat onayladı):** Her lab detay sayfası aynı düzende: solda etiketler (kategori, zorluk, süre), esprili başlık + ciddi etiket, kısa hikâye metni, tek ana düğme, tamamlayan sayısı; sağda labın uygulamasını gösteren animasyonlu görsel. Altta öğreneceklerin, adımlar, önceki deneme.
- **Dil:** Eğitim platformu olduğu için "oynamak" denmez. "Laba başlamak", "labı tamamlamak" gibi ifadeler kullanılır.
- **Lab detayı önizlemesi (Murat seçti):** Telefona düşen Postam bildirimi. Üstündeki "Bu labda Postam'ı kullanacaksın" yazısı kaldırıldı, yerine "Postam ile" etiketi geldi (Murat telefonun sağ üst köşesindekini seçti).

## Eğitim labı ve senaryo labı (9 Ekim, Murat onayladı)

- **Lablar ikiye ayrılır:**
  - **Eğitim labı:** Her konunun bir tane eğitim labı var (Oltalama, Zararlı yazılım, KVKK…). Kart kart ilerleyen öğretici kısım; anında doğru/yanlış geri bildirimi var.
  - **Senaryo labı:** Her konunun birkaç senaryo labı var ("Kargonuz kapıda... değil!" gibi). Postam gibi uygulamalarda geçen simülasyon; anında geri bildirim yok, sonuç raporda.
- **Sıra ve kilit:** Konunun eğitim labı bitmeden o konunun senaryo labları kilitli.
- **Senaryo labının başında** sadece 1 kartlık hatırlatma ("Bu labda şunlara dikkat et"). Bu kart 13 (lab çerçevesi) ile çizilecek.
- **Lab kapağındaki adımlar:** Oltalama eğitim labı ✓ (Tekrar bak) → Senaryo → Rapor.
- **Lab listesi:** Konunun sayfasında en üstte "Buradan başla" etiketli eğitim labı, altında senaryo labları.
- **Masaüstü eğitim oynatıcısı:** Sabit header görünür kalır, altında ince bir oynatıcı şeridi (geri dön, "EĞİTİM LABI · Oltalama eğitim labı", ilerleme). Mobilde odak modu kalır (sadece kapat + ilerleme).
- **Kart türleri (kabul edilenler):** bilgi, tıkla-bul, mini test, anlatım videosu, soru duraklı video, gerçek mi sahte mi (sağa/sola kaydırma), sürükle-bırak, sıralama, adresi çöz, mini sohbet (cevaba göre dallanan konuşma).
  - **Beklemede:** karşılaştırma (gerçek marka kullanma ve telif sorusu var, sonra konuşulacak), mini çizgi roman, şifre deneme alanı.
  - **Sıra kuralı:** Bir eğitim labındaki kart sırası sabittir, her girişte aynıdır. Farklı eğitim labları farklı sırada olabilir (her lab video ile başlamak zorunda değil).
  - **Kart kataloğu** (her türün ayrıntılı tasarımı) ayrı bir başlıkta konuşulacak; şimdilik genel çerçeve çiziliyor.
- **Geçiş animasyonları** (kartlar arası kayma) standart olarak kalıyor.

## Ek notlar (9 Ekim akşam)

- **"Lab" kelimesi Türkçe arayüzde kalkacak** (ortaokul öğrencisi bilmez). Şimdilik "lab" deniyor, karar sonra. Seçenekler:
  - Murat: "Eğitim odası / Senaryo odası"
  - Claude önerisi: "Eğitim" ve "Tatbikat" ("Oltalama eğitimi", "Oltalama tatbikatı"). Tatbikat okuldaki deprem tatbikatından bilinir.
  - Kodda içeride "lab" kalabilir, öğrenci görmez. İngilizce dil desteğinde "lab" kullanılabilir.
- **Adresi çöz kartı:** Orta/ileri seviye. İleride yeni kart ya da lab gerektiğinde kullanılacak. Örnek: `ptt.gov.tr.kargo-teslim.xyz/takip` → gerçek sahibi `kargo-teslim.xyz`.
- **Mini sohbet:** Sonuç sayısı serbest (2 de olabilir, 9 da). Sohbet bir veri dosyasında "harita" olarak tutulur; motor dal sayısından bağımsız.
- **Eğitim labı:** Yarıda bırakılırsa kaldığı karttan devam eder. Kendi kapağı 11'deki şablonla aynı ("EĞİTİM LABI" etiketiyle), ayrıca çizilmeyecek.
- **Videolar:** Altyazı zorunlu. İleride küçük yaşlar için "metni sesli oku" düğmesi düşünülebilir.

## Murat'ın kararları (9 Ekim)

- Kayıtta **ad soyad + kullanıcı adı** alınır. Kullanıcı adı gerçek ad olmak zorunda değil. KVKK önlemlerine ayrıca bakılacak.
- **Eğitim durumu** isteğe bağlı: Okuyorum (ortaokul, lise, ön lisans, lisans, yüksek lisans; üniversitede bölüm) / Mezunum (… mezunu) / Belirtmeyeyim.
- **13 yaş altı** için kapı açık bırakıldı. En kötü senaryo tasarlandı: doğum yılı 13 yaş altını gösterirse veli e-postası istenir, veli onaylayınca hesap açılır. Sadece doğum **yılı** alınır. Gerekmezse bu adım kaldırılır. Danışmana sorulacak.
- Labda anlık doğru/yanlış yok, sonuç raporda. Süre sayacı yok. Hacklendin sesi açık ama düşük. Şifre sıfırlama kodla.
- **13 yaş altı / veli onayı açık soru olarak kalıyor.** Murat'ın notu: öğrenci veli e-postası yerine kendi ikinci adresini yazabilir, yani tek başına güvenilir değil. Danışmanla konuşulunca değişebilir. Alternatif: 13 yaş altı hesaplar sadece öğretmenin sınıf koduyla açılır, veli izni okul üzerinden alınır.
- **Animasyon ölçüsü:** Hesap ekranlarında sadece hafif hareket: girişteki dönen ipucu animasyonları, hata sarsıntısı, şifre göstergesi geçişleri, başarı tik animasyonu. Daha fazlası yok.

## İlk öneriler (karar öncesi)

| No | Soru | Önerim |
|---|---|---|
| 1 | Kayıtta gerçek ad mı, görünen ad mı? | Görünen ad yeterli. Çocuk verisi az tutulur, KVKK için iyi. |
| 2 | Kayıtta okul türü (ortaokul/lise) sorulsun mu? | Evet, isteğe bağlı. İleride içerik zorluğu için işe yarar. |
| 3 | 13 yaş altı için veli onayı gerekli mi? | Danışmana sorulmalı. Ortaokulda 10–13 yaş var, KVKK açısından önemli. |
| 4 | Labda yaptığı şey doğru mu yanlış mı, anında söylensin mi? | Hayır. Gerçek hayatta da söylenmez, sonuç raporda görünür. Hacklenme anı istisna. |
| 5 | Labda süre sayacı olsun mu? | Hayır. Stres yaratır, amaç doğru karar vermek. |
| 6 | Hacklendin sesi ilk seferde açık mı? | Açık ama düşük sesle. Sessiz seçimi hatırlansın. |
| 7 | Şifre sıfırlama kodla mı, mail bağlantısıyla mı? | Kodla (yukarıdaki gerekçe). |

## 13 Lab çerçevesi kararları (9 Ekim akşam, Murat onayladı)
- Yapı onaylandı (masaüstü + mobil). Görev paneli, soru görevleri ve SİMÜLASYON etiketi kalıyor.
- "Doğru/yanlış söylenmez, sonuç raporda" vurgusu dozunda: hatırlatma kartının ana başlığı bu, görev panelinde tek satır, şeritte "Rapora yazılan karar: n" sayacı (her kararda hafifçe zıplar). Pop-up yok.
- Bildir görevi hiçbir maile göre tiklenmez: "Gelen kutunu incele, şüphelileri bildir" + 4 mail açılınca "İncelemeyi bitirdim". 0–4 mail bildirilebilir.
- Sahte maile özel soru sorulmaz: bildirmek, görmezden gelmek ya da linke tıklamak (→ 14) asıl ölçülen davranış.
- Spam ve Çöp klasörleri açılabilir, mail "Gelen kutusuna geri taşı" ile geri alınır (o da rapora yazılır).
- Önceki ekranlara (5–12) ileride küçük revizeler gelebilir.

## 14 Hacklendin (9 Ekim akşam, çizildi)
- Linke tıklamak tek başına hacklenme değil. Link labın içinde sahte bir kargo sayfası açar (adres çubuğunda "Güvenli değil · kargo-teslimat-tr.xyz"), sayfa "Postam ile doğrula" diye şifre ister. Şifreyi yazıp gönderirse Hacklendin. Sekmeyi kapatırsa laba döner, tıklama yine rapora yazılır.
- Bu labın türü: Hesap ele geçirme. Alarm 4 sn: sarsıntı, kırmızı flaş, glitch başlık, art arda 4 Postam bildirimi, köşede ses düğmesi (seçim hatırlanır), "Bu bir simülasyon, gerçek hesabın güvende" satırı.
- Sonra sakin açıklama (temada): Ne oldu? 3 adım, "Gerçek hayatta bu ne demek?", "Gerçek olsaydı hemen şunları yapardın", Raporu gör + Tekrar dene. Lab burada biter.
- Dört tür için ayrı alarm kartları çizildi: hesap, fidye (geri sayım), veri sızıntısı, finansal.

## 13 ve 14 revizeleri (9 Ekim gece)
- 13: Görev paneli uzayınca kaydırılıyor. Mobil çekmeceye kapanış animasyonu ve kapatma düğmesi eklendi, şerit görünür kalıyor. Çık'a basınca "Labdan çıkmak istiyor musun?" penceresi çıkıyor (yanlış basma için). Sahte sayfaya gidip geri dönünce görevler korunuyor (sessionStorage); tıklama rapora yazılıyor.
- 14 alarm fazla kırmızı bulundu. Üç varyant çizildi (hepsi daha az kırmızı): V1 Kilit (kehribar, sakin), V2 Bildirim akışı (hikâyeyi bildirimler anlatır), V3 Terminal (soğuk ton, teknik). Murat birini seçecek. Eski kırmızı sürüm yedek.
- Açıklama için 2 varyant: B (adım adım zaman tüneli), C (senin yaptığın / doğrusu karşılaştırması).
- Görev sayısı en az 4; lab zorluğuna göre artırılabilir (ileride). Sahte sayfada şifre alanı: lab içeriği, sonra çözülecek.

## 14 alarm kararı (9 Ekim gece, Murat)
- V1 Kilit ve V3 Terminal elendi (terminal o yaşa uygun değil). Asıl 14 kalıyor: bildirimlerle olay örgüsü.
- Kırmızı azaltıldı: varsayılan ton mor-gül (koyu mor zemin, gül vurgu). Flaş tek ve yumuşak, sarsıntı küçük. Kafatası yerine kişinin avatarı griye döner, köşesine açık kilit rozeti gelir. 5. bildirim olarak Elif'in tepkisi eklendi.
- Alternatif tonlar: B gece mavisi + mercan, C yumuşak bordo + pembe. Murat seçecek.
- Açıklama varyantları (B, C) daha sonra konuşulacak.

## 14 kapandı (9 Ekim gece, Murat)
- Bildirimlerle anlatılan olay örgüsü çok beğenildi, tasarım böyle kalıyor.
- **Alarm tonu: yumuşak bordo + pembe** (ana akışta bu). Mor-gül (A) ve gece mavisi + mercan (B) tuvalde duruyor, sonra tekrar bakılacak.
- **Açıklama varyantı B (zaman tüneli) mi C (senin yaptığın / doğrusu) mi: karar verilmedi.** Ana akışta şimdilik ilk sürüm duruyor.
- Hacklendin tasarımına ileride geri dönülecek; Murat burada fazla oyalanmak istemiyor.

## 15 Sonuç raporu (9 Ekim gece, çizildi)
- Rapor, labda gerçekten yapılanlara göre oluşur (tuvalde de çalışıyor: 13'te ne yaptıysan rapora o yansır; doğrudan açılınca örnek veri görünür).
- Puanlama (10 üzerinden): sahte kargo maili 4 (bildirdin 4, sildin ya da tıklayıp bildirdin 2, dokunmadın 1, tıkladın ya da şifre girdin 0), 3 gerçek mail 1'er (yanlış bildirim 0, silme 1/2 sayılmaz → kısmen), okul sorusu 2, market sorusu 1.
- Durum: Güvende kaldın (yeşil) · Kıl payı (sahte maili fark etmedi, kehribar) · Hacklendin (bordo-pembe).
- Bölümler: puan halkası + durum + başlık + "Geçen sefer 6/10" (sadece sen görürsün) · adım adım ne oldu (6 satır: ne yaptın / doğrusu / neden / puan; mobilde dokununca açılır) · maildeki 3 işaret (mail görseli üzerinde numaralı) · bir dahaki sefere (hatalara göre 3 madde) · butonlar.
- Butonlar: güvende kaldıysa "Sıradaki lab" öne çıkar, değilse "Tekrar dene". "Eğitime dön" her zaman var. Lab sıfırlama yok.

## 15 revizesi (9 Ekim gece)
- Murat: mobil "Adım adım" (aç-kapa), işaretler ve "Bir dahaki sefere" beğenildi. Masaüstü üst kısım (süre sağda, durum ortada) beğenildi.
- Mobil üst kısım ortalandı ve görselleştirildi: süre/tarih/görev 3 kutu, "Denemelerin" küçük sütun grafiği (1., 2., bu sefer), "+3 geçen sefere göre", en iyi puan, "Sadece sen görürsün" ortada.
- Masaüstü "Adım adım" tablosu Excel gibi bulundu. 3 seçenek çizildi: A kartlar, B zaman tüneli, C seç ve gör (Claude'un önerisi: C). Murat seçecek.

## Tur 1 kapanışı (9 Ekim gece, Murat)
Tur 1 bitti. Tuval olduğu gibi kalıyor, Tur 2 yeni bir tuvalde çizilecek. Sonraki sıra: Tur 2 (öğrenci), Tur 3 (öğretmen), Tur 4 (admin), sonra doküman güncellemesi, GitHub reposu ve kodlama Faz 0. Önceki ekranlara (5–15) ileride küçük revizeler gelebilir.

**Açık konular (sonra dönülecek)**
- 14 alarm tonu: seçilen yumuşak bordo + pembe; mor-gül (A) ve gece mavisi + mercan (B) tekrar bakılacak.
- 14 açıklama: B (zaman tüneli) mi C (senin yaptığın / doğrusu) mı, karar yok. Ana akışta ilk sürüm duruyor.
- 15 masaüstü "Adım adım ne oldu": A (kartlar) ya da C (seç ve gör). Küçük düzeltmeler gelebilir.
- "Lab" kelimesinin Türkçesi: "Eğitim odası / Senaryo odası" ya da "Eğitim / Tatbikat".
- Kart kataloğu ayrı bir başlıkta konuşulacak.
- Labda şifre isteyen sahnelerde öğrencinin "lab kimliği" (ad, mail, örnek şifre) nerede görünecek: lab içeriği, sonra.
- Görev sayısı en az 4, lab zorluğuna göre artabilir.
- Veli onayı (13 yaş altı) danışmana sorulacak.
