# Careful Mode ekran listesi

Son güncelleme: 11 Ekim 2026 (gece, Tur 4 kapandı)

**Hedef tarih:** Aralık 2026 başına kadar bitmesi iyi olur ama kesin sınır değil (Murat, 11 Ekim): iş hem iyi hem hızlı yapılacak, kalite tarih için feda edilmeyecek. Yayından sonra revizyonlar, revizyon testleri ve stres testi gelecek. Faz planı ve tarihleri dokümanın 9. bölümünde.

Bu dosya platformun (altyapının) ekranlarını takip eder. Lab içerikleri burada yok, onlar ayrı yazılacak.

**Durum işaretleri**

- ✅ Bitti: yeni temada tasarlandı ve onaylandı
- 🟡 Eski temada var: v1 tasarımında çizildi, yeni temada yeniden çizilecek
- 🔵 Çizildi: tasarım hazır, Murat'ın onayı bekleniyor
- ⬜ Yapılmadı
- ✏️ Çizim gerekmez: doğrudan kodlanır

**Seçilen tema**

- Koyu: H13A3 (masaüstü), Mobil 1.3D
- Açık: gri tema
- Tasarım dosyası: [Careful Mode Tema H](https://claude.ai/artifact/FgxEtBMShrGeZKwMTkWRoN), en alttaki "Seçilen tasarım v2" sırası
- Yedek: `tasarim/Careful Mode-Tema-H.zip`
- Tur 1 ekranları: [Careful Mode Ekranlar · Tur 1](https://claude.ai/artifact/M5CPjhpqjLwWyLFcgbrE6R), yedek `tasarim/Careful Mode-Tur1.zip`, çizim kaynakları `tasarim/tur1/kaynak/`
- Tur 2 ekranları: [Careful Mode Ekranlar · Tur 2](https://claude.ai/artifact/37CyJtkysjEVCX7WM1CzVc), çizim kaynakları `tasarim/tur2/kaynak/`
- Tur 3 ekranları: [Careful Mode Ekranlar · Tur 3](https://claude.ai/artifact/9wsRpX3LRq3SUc3j9z5i7E), plan `round-3-plan.md`, çizim kaynakları `tasarim/tur3/kaynak/`
- Tur 4 ekranları (yönetim): [Careful Mode Ekranlar · Tur 4](https://claude.ai/artifact/TxyQFgGbsAHxdjzqwsHEkL), plan `round-4-plan.md`, çizim kaynakları `tasarim/tur4/kaynak/`
- Tur 5 ekranları (son tur, kalanlar ve açık kararlar): [Careful Mode Ekranlar · Tur 5](https://claude.ai/artifact/HrcHYiRY4kD5iwRJTjLMPA), plan `round-5-plan.md`, çizim kaynakları `tasarim/tur5/kaynak/`

## Biten ekranlar

| Ekran | Durum | Not |
|---|---|---|
| Tanıtım sayfası (masaüstü + mobil, koyu + gri) | ✅ | Akan iplikler, kaydırmalı adım kartları. Giriş bölümünde altı oda sahnesi (Postam, flash bellek, QR afiş, oyun sohbeti, kütüphane bilgisayarı, profil haritası) her ziyarette karışık sırayla 10 sn'de bir döner; nokta ya da geç düğmesi yok, fare üstündeyken ve sekme arka plandayken durur, hareketi azaltta tek sahne. **Masaüstünde bant bant (16 Ekim, 2 Kasım güncellendi, Murat):** kahraman ilk ekranı doldurur, ilk ekran tek parça görünür; ipucu + üç adım, gündem ve yol haritası içerikleri kadar yer tutar, gruplar arasında yaklaşık 150-170 px boşluk kalır (kahramanın altında ekranı doldurmaktan kalan boşluk) (önceden her bant bir ekran boyuydu, gruplar arası 350-450 px boşluk göz yoruyordu); ekrana giren bölüm aşağıdan belirir (hareketi azaltta belirmeden durur). Tuvalde `ana-sayfada` (sahneler `oda-sahneleri` v6) |
| Öğrenci ana sayfası, mobil (koyu + gri) | ✅ | Tema H'deki 1.3D. Tur 2'de yeni yapıya göre güncellendi (M2), bkz. C bölümü |
| Tema düğmesi, günün ipucu şeridi | ✅ | Header'ın sağında tek düğme |

## A. Ziyaretçi (giriş yapmadan)

| No | Ekran | Durum | Not |
|---|---|---|---|
| 1 | Yol haritası sayfası (herkese açık) | ✅ | Tur 2: İ4-A üzerinden, ilerleme ve durum yok, senaryo labları kilitli, laba tıklayınca önizleme, "Kayıt ol ve başla" ile kayıt penceresi. Masaüstü + mobil |
| 2 | Kategori sayfası (içerik kilitli) | ✅ | Ayrı sayfa çizilmeyecek (Tur 2 kararı): yol haritasındaki mahalle içi kategori sayfası sayılır, ziyaretçi hali 1 ile birlikte çizildi |
| 3 | Öğretmenler için tanıtım sayfası | ✅ | Tur 3: T4 "İki ekran, bir ders" (öğretmen ekranı + öğrenci telefonu eş zamanlı), ne görürsün / görmezsin, 4 adım, SSS, kapanış. Tuvalde `Ogretmen-Tanitim-Son`. **4 Kasım (Murat, Tur 8 tuvali "16 Öğretmenler için"):** başlık "Dijital güvenliği anlatma...", kahraman B (solda yazı, sağda kara tahta: tebeşir "Tıklamadan önce / bir düşün." yazar, altını çizer, silgi siler; fare tahtanın üstündeyken tebeşir imleci izler, basılı tutunca tahtaya yazılır, `components/teachers/Chalkboard.tsx`), "Ne görürsün" yerine Gizlilik 2 (tek şerit), Veliler A (üç güvence kartı). |
| 4 | KVKK, gizlilik, kullanım koşulları | ✅ | Tur 5: **Y2 kısaca + tam metin** (11 Ekim). Tek şablon, üstte üç belge, her bölümde öğrencinin anlayacağı "Kısaca". Metinler taslak, hukuki kontrolden geçecek. Tuvalde `Yasal-Son` |
| 4d | Mobil ziyaretçi menüsü | ✅ | Tur 5: **M2 alt menü** (Ana sayfa, Yol haritası, ortada Kayıt ol, Gündem, Daha fazla: Lablar, Öğretmenler için, SSS). Bütün ziyaretçi sayfalarının telefon haline uygulanacak. Çerez bandı 4 Kasım'da kalktı (yalnızca gerekli çerezler). Tuvalde `Menu-Son`, `Menu-Son-IlkGelis-Mobil` |
| 4b | Gündem listesi + haber detay (herkese açık) | ✅ | Tur 2: liste G2 zaman çizelgesi (sağda konular + kayıt kutusu), detay H2 yan sütunlu ("Kısaca", lab kutusu, kaynak; kaynağa giderken "Careful Mode'dan ayrılıyorsun" penceresi), tanıtım sayfasına S2 manşet + liste. Masaüstü + mobil. **4 Kasım (Murat, revize 15; Tur 8 Gündem tuvali):** haber sayfası **A "Dergi"**: tam genişlikte kapak (16:9, masaüstünde 21:9), ortada başlık ve özet, altında üç "Kısaca" kartı, numaralı bölümler (Ne oluyor?, Nasıl anlarsın?, Ne yapmalısın?), örnek mesaj ortada bir telefonda, "Bunu odada dene" kutusu, kaynak ve "Bir şey mi gördün? Nereye bildirilir" yan yana, en altta küçük kapaklı diğer haberler. Liste: her haberin kare kapağı (telefonda da), ilk ay başlığı yalnızca sol sütunda, sağ sütun ilk kartla aynı hizada; sağda son 3 ayın konuları (çubuklu), bu ayın en çok okunanı (ayın ilk haftasında geçen ayın; yalnızca toplam sayı) ve "Nereye bildirilir" (aile ya da öğretmen, USOM, İhbar Web, 112); telefonda bu iki kutu listenin altında. Son 7 günün haberinde "YENİ". |
| 4c | Sık sorulan sorular (herkese açık) | ✅ | Tur 4: **Murat F3'ü seçti (11 Ekim): "Önce söyle: sen kimsin?"** (Öğrenciyim / Öğretmenim / Aileyim / Sadece bakıyorum, sana göre sorular). Altta diğer grupların sorularına geçiş ve "Diğer bütün sorular". **SSS üst menüde:** Yol haritası, Lablar, Gündem, Öğretmenler için, SSS, sonra Giriş yap. 19 soru, 4 konu. Tuvalde `SSS-Son`, `SSS-Son-Ogrenci`. **4 Kasım (Murat): tasarım B "Yanda konular"** (Tur 8 Design tuvali, sayfa "17 SSS"): solda arama, 5 konu (Genel, Odalar, Öğrenciler, Öğretmenler, Gizlilik ve aileler; soru sayılarıyla) ve iletişim kutusu, sağda açık konunun soruları; telefonda konular kaydırılan şerit. 25 soru (6'sı YENİ), arama bütün konularda, her sorunun bağlantısı (`/sss#arayan-kim`, kopyala düğmesi), konu adreste (`?konu=odalar`). |

## B. Hesap

| No | Ekran | Durum | Not |
|---|---|---|---|
| 5 | Kayıt ol | ✅ | Koyu + gri. Masaüstünde ortada tek kart, eğitim durumunda varsayılan yok. **Veli onayı bekliyor:** Murat danışman hocayla konuşacak, tamamen kaldırılabilir; tasarımı yapılmadı |
| 6 | Giriş yap | ✅ | Koyu + gri. 3 dönen animasyonlu ipucu, hatalı giriş, 5 deneme kilidi. İlk gelişte "Hoş geldin", sonra "Tekrar hoş geldin" |
| 7 | E-posta doğrulama (6 haneli kod ekranı + giden mail) | ✅ | Koyu + gri. Giden mail ve doğrulanmamış hesap şeridi dahil |
| 8 | Şifremi unuttum / yeni şifre | ✅ | Koyu + gri. Önce 4 adımlık rehber, sonra adım adım akış |

## C. Öğrenci

| No | Ekran | Durum | Not |
|---|---|---|---|
| — | Öğrenci ana sayfası, masaüstü + mobil | ✅ | Tur 2: A1 profil kartı, ipucu, sınıfa katıl, sıradaki rozet; ortada "Gündem ve istatistikler"; altta yol haritası (siber şehrin 4 mahallesi) ve son raporlar. Mobil: M2 kaydırmalı kartlar (sade profil kartı + yana kayan "Bugün" şeridi). Tuvalde `Ana-Sayfa-Son`. Ayrıntı `round-2-plan.md` |
| 9 | Yol haritası (kişinin ilerlemesiyle) | ✅ | Tur 2: siber şehir. Önce mahalle kartları (H4), mahalleye girince İ4-A rota çizgili liste + önizleme. Mobilde mahalleler tek sütun, laba dokununca alttan panel. Masaüstü + mobil |
| 10 | Lablar sekmesi (kategori filtreli) | ✅ | Tur 2: L1 kart ızgarası + F1 açılır filtre düğmeleri (kategori, tür, zorluk, durum), seçili filtreler etiket olarak; arama, sıralama. Ziyaretçi hali de çizildi. Masaüstü + mobil |
| 11 | Lab detay sayfası (senaryo labı kapağı) | ✅ | Lab kapağı şablonu. Adımlar: eğitim labı ✓ → senaryo → rapor. Ziyaretçi detay görmez, kayıt penceresi çıkar |
| 12 | Eğitim labı oynatıcısı | ✅ | 1. revize: masaüstünde sabit header + ince oynatıcı şeridi, bitişte senaryo labları açılıyor. Kart kataloğu ayrıca konuşulacak |
| 13 | Lab çerçevesi | ✅ | **Üst menü yok (16 Ekim, Murat):** odada yalnızca oynatıcının şeridi (Çık ve ilerleme) kalır, öğrenci odanın içindedir; sonuç raporunda masaüstünde üst menü geri gelir. Görevler sırayla açılır; her mailde Bildir/Yanıtla/Sil; yanlış bildirim hata sayılır |
| 14 | "Hacklendin" ekranı | ✅ | Önce sahte sayfa (şifre girince hacklenme), sonra alarm: **yumuşak bordo + pembe** (Tur 5'te kesinleşti), avatar griye döner, art arda Postam bildirimleri. Açıklama: **B zaman tüneli** (Tur 5; telefon hali de çizildi). Tuvalde `Hacklendin-Son-Alarm`, `Hacklendin-Son-Aciklama`. **3 Kasım (19 ve 22. revize):** açıklama kalktı; alarmdan sonra telefonun içinde **sonuç sahnesi** (Para, Kart, Hesap, Adres), "Devam" deyince rapor (`HackedScene.tsx`) |
| 15 | Sonuç raporu | ✅ | Labdaki gerçek kararlara göre değişir. Mobil: aç-kapa adımlar, ortalanmış üst kısım, deneme grafiği. Masaüstü "Adım adım": **C seç ve gör** (Tur 5). Sadece koyu. Tuvalde `Rapor-Son`. **3 Kasım (14. revize):** rapor okunur, etkileşim yok; adım adım gelir: 1 Odada ne oldu (kaçırılan karar işaretli, doğrusu açık), 2 Kaçırdığın an (işaretler), 3 Bir dahaki sefere (kurallar görselli kartlar); tek ekranda hepsi yok |
| 16 | Profil | ✅ | Tur 2: P2 ayarlar menüsü (masaüstünde solda menü, mobilde liste + sağdan kayan sayfa). Sıra: Hesap bilgileri (açılış), Rozetler, Avatar, Görünüm, Güvenlik, Sınıf, Öğretmenlik, Hesabı sil. Tur 5: rozet ilerlemesinde "Seviye 3/10" yerine "Şu an Seviye 3", "Tam tur" rozeti "Şehir turu" oldu. Tuvalde `Profil-Son` |

## D. Öğretmen

| No | Ekran | Durum | Not |
|---|---|---|---|
| 17 | Öğretmenlik talep formu | ✅ | Tur 3: ayrı ekran yok, profildeki Öğretmenlik bölümü. Okul + branş, isteğe bağlı kurumsal e-posta ve belge; inceleniyor / onaylandı / onaylanmadı halleri. Tuvalde `Ogretmenlik-Talep/Onay/Ret`. **Tur 4 revizyonu (11 Ekim):** okul artık yazılmıyor, il ve ilçe seçilip listeden seçiliyor; yoksa "Okulum listede yok" ile ad yazılır, yönetici ekler. Yeni hal "Bilgi istendi": yöneticinin sorusu, cevap kutusu, belge ekleme. Tur 4 tuvalinde `Ogretmenlik-Son`, `Ogretmenlik-Son-Bilgi`. **Sabah soruları 26b (12 Ekim, Murat):** okul listesi kalktı; il ve ilçe seçilip okulun adı yazılır, yönetici eşler ya da adı düzeltip ekler. Davetten ya da önceki talepten gelen okul seçili gelir ("Başka bir okul" ile ad yazılır). Tuvaldeki liste artık geçerli değil |
| 18 | Sınıflarım + sınıf oluştur | ✅ | Tur 3: C1 kartlar + C3 özet kutuları ve "Dikkat isteyenler", masaüstü + mobil. Tuvalde `Siniflarim-Son` |
| 19 | Sınıf detayı | ✅ | Tur 3: D2 sekmeli (Genel bakış / Öğrenciler / Konular), öğrenci çekmecesi, "Ödev ver". Tuvalde `Sinif-Detay-Son`. Kodun yanında "Kodu yenile" ve onay penceresi (12 Ekim, sabah soruları 14; tuvalde yok, öğretmen pencerelerinin düzeniyle) |

## E. Admin

| No | Ekran | Durum | Not |
|---|---|---|---|
| 20 | Özet paneli | ✅ | Tur 5: **P1 önce yapılacaklar** (11 Ekim). İşler bittikçe kartlar kalkar, sayılar ve grafik yukarı çıkar; hepsi bitince tek satır. Yönetim menüsünde Özet'in altına yeni sekme **Canlı nabız** (şu an labdaki kişi sayısı, mahalle dağılımı, isimsiz "Şu an ne oluyor?" akışı). Tuvalde `Ozet-Son`, `Ozet-Son-Bitti`, `CanliNabiz-Son` |
| 21 | Öğretmen talepleri (onayla/reddet) | ✅ | Tur 4: **Murat A4'ü seçti (11 Ekim): kontrol listesi** (A1 düzeni + en az 2 kontrol işaretlenmeden onay yok). Ret notu kullanıcının profiline gider, her kararda 5 sn geri al. Tuvalde `Talepler-A4-Kontrol`. **Son hali (Murat, 11 Ekim 01:41):** üçüncü düğme "Bilgi iste" (hazır sorular, öğretmenin profiline gider, cevap gelince Bekleyen'e döner) ve dördüncü sekme Bilgi istendi. Listede olmayan okuldan gelen talep "Yeni okul" etiketli: yönetici benzer okulla eşler ya da adı düzeltip onaylarken ekler. Tuvalde `Talepler-Son`, `Talepler-Son-YeniOkul` |
| 22 | Kullanıcılar (öğrenci, öğretmen, yönetim ekibi, okullar) | ✅ | Tur 4 son hali (Murat, 11 Ekim): üstte iki görünüm. **Genel** = K1 (Öğrenciler / Öğretmenler / Yönetim ekibi, öğretmeni aç, ekip izinleri). **Okullar** = K2 + okul sorumlusu (yönetici okul ekler, sorumlu atar; sorumlu öğretmen de olabilir, öğrenci olamaz). Ekip izinleri 7: Talepler, Lab düzenleme, Lab yayını, İpucu, Gündem, Kayıt defteri, Roller (Roller sadece yönetici). K3 ve K4 elendi. 01:41 revizyonu: öğrenciye tıklayınca kısa profil (Ad S., bitirdiği lablar, son aktif, haftada kaç lab, 4 haftalık takvim; e-posta, soyad, puan yok, bakmak kayıt defterine yazılır). Okul ekle il + ilçe seçmeli, benzer ve aynı ad uyarısı. Öğrenci yönetim ekibine sadece İpucu ve Gündem izniyle girebilir (Murat onayladı, 11 Ekim), okul sorumlusu olamaz. Tuvalde `Kullanicilar-Son`, `Kullanicilar-Son-Okullar`, `Kullanicilar-Son-Ogrenci` |
| 22c | Okulum (okul sorumlusunun sitedeki sayfası) | ✅ | Tur 4, 11 Ekim: **Murat O4'ü seçti: haftalık okul bülteni** (müdür ya da sorumlu okuyunca durumu hemen anlar; küçük değişiklikler gelebilir). sadece kendi okulu, öğrenci adı yok. Öğretmenler ve 5 adımlık kurulum, sınıfların toplam durumu, okulundan gelen talepleri onaylar ("Tanımıyorum" derse karar yöneticiye kalır), takılan öğretmene hatırlatma, öğretmen davet bağlantısı (okul seçili gelir). 4 varyant: O1 Pano, O2 Sekmeler, O3 Kurulum hunisi, O4 Sürpriz: haftalık okul bülteni (müdüre gönder, PDF). Tuvalde `Okulum-O1..O4` |
| 22b | Kayıt defteri (kim neyi yaptı) | ✅ | Tur 4, 11 Ekim (Murat'ın fikri): menüde ayrı sayfa. Yöneticiler ve "Kayıt defteri" izni olan sorumlular görür, sayfanın üstünde kimlerin gördüğü yazar. Arama + tür ve kişi filtresi, kayıtlar silinmez. Tuvalde `Kayit-Defteri` |
| 23 | Lab yönetimi (yayınla/gizle) | ✅ | Tur 4 son hali (Murat, 11 Ekim): B1 mahalle grupları + B2'nin üstteki Yayında / Taslak / Gizli sayıları. Mahalleler tek tıkla açılır, her labda Düzenle, sağ üstte ve her mahallede "Lab ekle" (mahalle + şablon + ad, taslak açılır). Sıra öğrencinin haritasındaki gerçek sıra. Gizleme uyarısındaki ödev satırı sadece lab ödevse. Mahalle / şehir adları ileride değişecek. Tuvalde `Lablar-Son` |
| 23b | Lab düzenleme (içerik) | ✅ | Tur 4 son hali (Murat L1'i seçti, 11 Ekim): solda bölümler, ortada form, sağda öğrencinin göreceği. Kapak, görevler, rapor ve ipuçları her labda aynı; sahne ve tuzak bölümü labın şablonuna göre değişir (gelen kutusu, mesajlaşma; ileride video vb.). Kod yok, her şey form. Sağda "Önizleme / Öğrenci gibi dene" sekmesi (L4 buraya girdi). Tuvalde `Lab-Duzenle-Son` (Sahte kargo maili) ve `Lab-Duzenle-Son-SMS` (Kodu soran "arkadaş") |
| 24 | Günün ipucu yönetimi | ✅ | Tur 4: **Murat C3'ü seçti (11 Ekim): bugün + sıradaki 6 gün + havuz** (bugün kaç kişi gördü, "Neden?"e bakan). Havuzdan sırayla döner, güne sabitlenebilir. C4 (dil kontrolü) beğenilmedi. Tuvalde `Ipucu-C3-Bugun` |
| 24b | Gündem yönetimi (haber yazma) | ✅ | Tur 4: **Murat E1'i seçti (11 Ekim): liste + editör.** Yan yana canlı önizleme (E2) yazma ve görme alanını daralttığı için yok; Taslak kaydet ile Planla arasında "Önizle" düğmesi, önizleme ayrı ekranda açılır (bilgisayarda / telefonda, oradan planlanabilir). "Yayına hazır mı?" listesi, güvenilir kaynak kontrolü. Tuvalde `Gundem-Son`, `Gundem-Son-Onizleme`. **4 Kasım (revize 15): kapak görseli** formda: her boyut seçilir, önerilen 1600 × 900 yazar; tarayıcı en çok 1600 px genişliğe küçültüp WebP'ye çevirir (konum ve cihaz bilgisi gider), 1200 px'ten darda "bulanık görünebilir" uyarısı; görsele tıklayarak odak noktası, alt metin, görselin kaynağı; haber kapağı, liste ve telefon kırpımları; kapak yoksa konunun çizimi. Görsel ilk taslak kaydından sonra eklenir ve hemen yüklenir |

## F. Ortak parçalar

| No | Ekran | Durum | Not |
|---|---|---|---|
| 25 | Boş durum, yükleniyor, hata, 404 | ✅ | Tur 5: 404 **D1 sade** (büyük "404" yazısı). Ortak durumların hepsi onaylı: yükleniyor, boş durumlar, bağlantı koptu, lab açılamadı, sunucu hatası, oturum kapandı, bakım. Tuvalde `404-Son`, `Durumlar-Son` |
| 26 | Çerez/KVKK onay bandı | ✅ | Tur 5: **Ç4 dürüst bant** ("Neden önemli?" ile karanlık desen mini dersi). Gerekli çerezler + **isteğe bağlı, varsayılan kapalı isimsiz istatistik**, reklam ve takip yok, Reddet ile Kabul et aynı boyutta. Tuvalde `Cerez-Son` |

## Tasarım sırası

Ekranlar sadece koyu temada çizilecek (B hesap ekranları istisna olarak gri temada da çizildi). Gri tema, kodda renkler tek yerden yönetildiği için otomatik çıkacak. İstisna: 14 iki temada da çizilecek.

1. **Tur 1 (bitti, 9 Ekim):** 5, 6, 7, 8 (hesap) ve 11, 12, 13, 14, 15 (lab akışı). Açık konular `round-1-plan.md` sonunda.
2. **Tur 2 (yeni tuvalde çizilecek, Tur 1 tuvali olduğu gibi kalır):** Öğrenci ana sayfası masaüstü, 9 + 1, 10 + 2, 16. Yol haritası ve kategori sayfaları ziyaretçi ve öğrenci için aynı tasarım, birlikte çizilecek.
3. **Tur 3:** 17, 18, 19 (öğretmen), 3 (öğretmenler için tanıtım).
4. **Tur 4:** 21, 23, 24, 24b (admin), ardından 4c genel SSS.
5. **Tur 5 (son tur, 11 Ekim gece):** 4, 20, 25, 26 (önce "çizilmeden kodlanacak" denmişti; Murat bitirmek istedi), mobil ziyaretçi menüsü (4d) ve açık kararlar. Ayrıntı `round-5-plan.md`.

## Tasarım ilerlemesi (11 Ekim)

Ekran sayısı mobil ziyaretçi menüsüyle (4d) 31. **Hepsi çizildi ve onaylandı; ekran tasarımı %100 (Tur 5 kapandı, 11 Ekim gece).** Tek açık konu veli onayı: danışmanla konuşulacak, kaldırılabilir. Tüm proje içinde (planlama, tasarım, altyapı, içerik ve lablar, test ve teslim) genel durum tahminen %30-35 (tahmin).

1. ~~**Tur 2 kapanışı**~~ (bitti): mobil ana sayfa M2, gündem paketi G2 + H2 + S2.
2. ~~**Tur 3, öğretmen**~~ (bitti, 10 Ekim): 18 C1 + C3, 19 D2 ("Ödev ver"), 17 profil bölümü, 3 T4.
3. **Tur 4, admin:** 21, 23, 24, 24b ve 4c çizildi (10 Ekim, gece). 11 Ekim: 21 = A4, 23 = B1 + B2 son hali, 23b = L1 son hali, 22 = Genel + Okullar son hali, 22b kayıt defteri eklendi. 01:41 revizyonları: 17 ve 21 okul listesi + Bilgi iste, 22 öğrenci profili, 22c Okulum çizildi. 02:18: 24 = C3, 24b = E1 + Önizle düğmesi, 4c = F3 + üst menüde SSS, 22c = O4. **Tur 4 kapandı (11 Ekim).**
4. ~~**Açık kararlar**~~ (kapandı, 11 Ekim): 14 bordo + pembe ve açıklama B, 15 C seç ve gör, seviye tablosu Evet (öğrenci toplam seviyeyi görmez, sıradakine kalan puanı görür, rozet ikonları dosyadan). Veli onayı danışmana kaldı.
5. ~~**Tur 5**~~ (kapandı, 11 Ekim gece): 20 = P1 + Canlı nabız sekmesi, 26 = Ç4 + isteğe bağlı istatistik, 25 = D1 + ortak durumlar, 4 = Y2, 4d = M2. Son haller tuvalin "Son haller" sayfasında.

## Ekran dışı açık konular (tasarım değil, sonra karar)

- Veli onayı (13 yaş altı): Murat danışman hocayla konuşacak, kaldırılabilir.
- "Lab" kelimesinin Türkçesi: "Eğitim odası / Senaryo odası" ya da "Eğitim / Tatbikat" (Tur 1'den). Sadece yazı değişir, kodlarken de karar verilebilir.
- Mahalle ve şehir adları ileride değişecek (Murat, Tur 4).
- Rozet ikonları: Murat kendi tasarımıyla hazırlayıp dosyaları değiştirecek.
- Kart kataloğu, karşılaştırma kartı (marka ve telif sorusu) ve labdaki "lab kimliği": lab içerikleri yazılırken konuşulacak.

## Tasarım bitince

- ~~Dokümana tasarım kararlarını ve linkini ekle~~ (bitti, 11 Ekim: [Careful Mode Platform Dokümanı](https://claude.ai/artifact/R5caxAQG8vWKdRFY1j3Lav), Bölüm 3 sonundaki tasarım kısımları)
- GitHub reposunu aç
- Kodlama Faz 0: proje iskeleti, tema sistemi, giriş
