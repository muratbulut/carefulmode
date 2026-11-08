# Tur 5 planı: son tasarım turu (11 Ekim 2026, gece)

Tuval: [Careful Mode Ekranlar · Tur 5](https://claude.ai/artifact/HrcHYiRY4kD5iwRJTjLMPA). Yedek: `tasarim/tur5/` (tahtalar + `canvas.json`), çizim kaynakları `tasarim/tur5/kaynak/` (Tur 4 modüllerini kullanır: `tasarim/tur4/kaynak/`).

Murat (11 Ekim, 02:18): "Tur 5 var mı? Başka neler kaldı? Tasarımsal. Onlara geçelim ve onları bitirelim." Bu tur, "çizilmeden kodlanacak" denen ekranları (4, 20, 25, 26), fark edilen bir eksiği (mobil ziyaretçi menüsü) ve açık kararları tek tuvalde topluyor. Tur 5 bitince ekran tasarımı biter; sıradaki iş dokümana tasarım kararları, GitHub reposu ve Faz 03 altyapı.

## Tuvaldeki satırlar

1. **20 Yönetim özet paneli** (`Ozet-P1..P4`): yönetim ekibinin girince ilk gördüğü sayfa. Ortak parçalar: bekleyen işler (6 talep, gündemde 3 boş hafta, 2 taslak lab, okul sorumlusundan 1 not; "Bugün değil" ile ertelenir, geri alınır), sayılar (dönem: bu hafta / bu ay / tüm zamanlar), son 6 haftanın grafiği (biten lab / yeni kayıt / aktif öğrenci), en çok tuzağa düşülen lablar ve en çok kaçırılan işaret, bu hafta öğrencinin gördüğü gündem ve ipucu, son kayıtlar. Hepsi toplam sayı; öğrenci adı yok.
   - P1 Önce yapılacaklar: "Merhaba Murat, seni bekleyen 4 iş var" kartları üstte.
   - P2 Sayılar paneli: sayı kutuları ve grafik üstte, bekleyenler sağda.
   - P3 Siber şehir: 4 mahalle kartı (yayındaki lab, biten, güvende kalma oranı, en zor lab); mahalleye dokununca labları.
   - P4 Sürpriz, canlı nabız: "Şu an 37 öğrenci labda", mahalle mahalle dağılım, son 1 saat, isimsiz akış ("Biri Sahte kargo maili'nde göndereni fark etti"). Toplantı ya da okul ziyaretinde ekrana yansıtmak için. Duraklat düğmesi.
2. **26 Çerez / KVKK bandı** (`Cerez-C1..C4`): öneri sadece gerekli çerezler (oturum, güvenlik, tercih) + isteğe bağlı, varsayılan kapalı isimsiz istatistik; reklam ve takip çerezi yok. "Kabul et" ile "Sadece gerekli" aynı boyutta. Seçim alt bilgideki "Çerez ayarları"ndan değişir. Ç1 alt şerit, Ç2 köşe kartı (anahtar içinde), Ç3 ortada pencere (çerez listesi), Ç4 sürpriz: dürüst bant ("Biz ikisini aynı boyutta koyduk", "Neden önemli?" ile karanlık desen mini dersi).
3. **25 Durum ekranları** (`404-D1..D3`, `Durumlar`): 404 için D1 sade, D2 "Adresi kontrol et" (yazım hatasını gösterir, "sahte siteler de tek harfle oynar", arama, bozuk bağlantıyı bildir), D3 sürpriz: kayıp paket (404 sahte kargo SMS'i taklidi, "gerçek 404 senden bilgi istemez", 3 işaret). Ortak durumlar: yükleniyor (gri bloklar), boş durum (Lablar filtre, Sınıflarım, Raporlar), bağlantı koptu ("ilerlemen kaydedildi"), lab açılamadı, sunucu hatası ("bizim hatamız" + kısa kod), oturum kapandı, bakım. "Tekrar dene" çalışır.
4. **4 Yasal sayfalar** (`Yasal-Y1..Y3`): KVKK aydınlatma metni, gizlilik politikası, kullanım koşulları; tek şablon, üstte üç belge. Her bölümde "Kısaca" (öğrencinin anlayacağı tek cümle). Metinler TASLAK, hukuki kontrolden geçecek; bilinmeyenler köşeli parantezli ([VERİ SORUMLUSU], [KVKK BAŞVURU E-POSTASI], [BARINDIRMA HİZMETİ], [SÜRE]). Y1 klasik (solda içindekiler), Y2 kısaca + tam metin yan yana ("Sadece kısaca oku"), Y3 sürpriz: haklarım (görmek, düzeltmek, silmek, sormak için nereye basılır) + metin.
   - Y3 seçilirse Profil > Hesap bilgileri'ne "Verilerimi indir" eklenmeli (16'da yok).
5. **Mobil ziyaretçi menüsü** (yeni, `Menu-M1..M3`, kapalı ve açık): telefonda giriş yapmamış kişinin Gündem, SSS, Öğretmenler için'e yolu yoktu. Sıra masaüstüyle aynı (Yol haritası, Lablar, Gündem, Öğretmenler için, SSS). M1 sağdan menü, M2 alt menü (öğrencinin alt menüsüyle aynı yerde, ortada "Kayıt ol", "Daha fazla" ile Lablar, Öğretmenler için, SSS), M3 tam ekran menü (günün ipucu ile).
6. **Açık kararlar 1** (`Karar-Seviye`, `Karar-VeliOnayi`):
   - Seviye ve rozetler: Tur 2 taslağı bugünkü lab sayısıyla (4 eğitim + 16 senaryo labı, en fazla 3.600 puan; Tur 2'de 2.800). 10 seviye aynı (10. seviye tavanın %75'i), örnek öğrenci seçici (Yeni başlayan / Ayşe 660 / Çalışkan 2.450). 12 rozet; "Tüm kategoriler" rozetine yeni ad önerisi **Şehir turu** (dört mahallenin her birinde en az bir senaryo labı). Soru: Evet / Ölçekle / Değiştir (önerim Evet).
   - 13 yaş altı ve veli onayı (danışmana götürülecek): A veli e-postası, B sınıf koduyla okul üzerinden (öğretmen "veli izin formu kapsıyor mu?" onayı), C 13 yaş altına kayıt yok. Her biri mini ekranlarla, artı ve eksileriyle. Önerim B.
7. **Açık kararlar 2 ve 3** (Tur 1 tuvalinden kopya, değiştirilmedi): 14 alarm tonu (şu anki bordo + pembe, A mor-gül, B gece mavisi + mercan) ve açıklama B / C; 15 masaüstü "Adım adım" A kartlar / C seç ve gör.

## Murat'tan beklenenler

- 20: P1 / P2 / P3 / P4
- 26: Ç1 / Ç2 / Ç3 / Ç4 (ve istatistik çerezi hiç olsun mu)
- 25: 404 için D1 / D2 / D3 (ortak durumlar tek)
- 4: Y1 / Y2 / Y3
- Mobil menü: M1 / M2 / M3
- Seviye tablosu: Evet / Ölçekle / Değiştir
- Veli onayı: danışmanla konuşuldu mu? A / B / C
- 14 ton ve açıklama, 15 masaüstü Adım adım

## En alt seçim satırı (02:52)

Murat (02:52): "Nelere bakmam gerekiyorsa en alt satıra hepsini tek tek koyar mısın? Aynısını. Ve soruları tek tek sorar mısın?" Önce tuvalin en altına tek satır eklendi; 53 bin px uzunluğunda olunca tuval boş bir yerden açıldı (Murat 03:08, ekran görüntüsü boş). Bu yüzden seçim ayrı sayfaya alındı: tuvalde iki sayfa var, "1-7 Seçim" (tuval buradan açılır; `Secim-1..7-*`, tahtaların birebir kopyası, her madde kendi satırında yukarıdan aşağı, seçilenler satır başlığında yazıyor) ve "Tur 5 tamamı" (önceki düzen). Kaynak `kaynak/mk5secim.py`. Sorular sohbette tek tek soruluyor, sırası:

1. Özet paneli P1 / P2 / P3 / P4
2. Çerez bandı Ç1 / Ç2 / Ç3 / Ç4
3. İsimsiz istatistik çerezi olsun mu
4. 404 D1 / D2 / D3
5. Yasal Y1 / Y2 / Y3
6. Mobil menü M1 / M2 / M3
7. Seviye tablosu Evet / Ölçekle / Değiştir
8. Veli onayı A / B / C (ya da danışmana soracağım)
9. 14 alarm tonu: şu anki / A / B
10. 14 açıklama B / C
11. 15 Adım adım A / C

## Murat seçimleri (tek tek)
Murat 03:11: tuval boş göründüğü için ilk iki cevap (P1, Ç4) tahtaları görmeden verildi; en baştan yeniden soruluyor.
- 1/11 Özet paneli: **P1 Önce yapılacaklar** (03:17). Ekler: (a) işler bittikçe kartlar kalkar, Sayılar ve grafik yukarı kayar; son hali bir de "işler bitince" durumuyla çizilecek. (b) P4'teki canlı nabız ayrı bir sekme olacak: soldaki menüde Özet'in altında "Canlı nabız"; solda şu an kaç kişi labda ve mahalle dağılımı, sağda "Şu an ne oluyor?" akışı (yeni kayıt, ipucuna bakan, labı bitiren...). Akış isimsiz kalır.
- 2/11 Çerez bandı: **Ç4 Dürüst bant** (03:22). "Çerezlerde bile eğitim veriyoruz."
- 3/11 İstatistik çerezi: **Evet, isteğe bağlı** (varsayılan kapalı, isimsiz; 03:22)
- 4/11 404: **D1 Sade** (03:25). "Bu seferlik sade olsun, 404 açıkça yazsın." Ortak durumların hepsi onaylandı (yükleniyor, bağlantı koptu, boş durumlar, sunucu hatası, lab açılamadı, oturum kapandı, bakım).
- 5/11 Yasal sayfalar: **Y2 Kısaca + tam metin** (03:27). Profil'e "Verilerimi indir" eklenmiyor (Y3 seçilmedi).
- 6/11 Mobil ziyaretçi menüsü: **M2 Alt menü** (03:27). Bütün ziyaretçi sayfalarının mobil haline uygulanacak.
- 7/11 Seviye tablosu: **Evet** (03:32), eşikler sabit, puan hesabı aynen. Ekler: (a) öğrenci toplam seviye sayısını görmez; Profil'deki "Seviye 3/10" yerine "Seviye 3 · Sonraki seviyeye 40 puan kaldı" (Ayşe 660 puan örneği), 10. seviyede "Bütün seviyeleri tamamladın" mesajı. (b) Rozet ikonları değiştirilebilir olacak: her rozetin ikonu ayrı dosya, Murat başka yerde hazırladığı ikonu koyabilsin. 12 rozet şimdilik yeterli, ileride eklenebilir.
- 8/11 Veli onayı (13 yaş altı): **Bekliyor.** Murat danışman hocayla konuşacak; tamamen kaldırılabilir. Tasarımı yapılmıyor.
- 9/11 Hacklendin alarm tonu: **Şu anki, yumuşak bordo + pembe** (03:35). A ve B kapandı.
- 10/11 Hacklendin açıklaması: **B Zaman tüneli** (03:35).
- 11/11 Rapor masaüstü "Adım adım": **C Seç ve gör** (03:36).

## Tur 5 kapanış (11 Ekim gece)

Bütün sorular cevaplandı, ekran tasarımı bitti. Tuval artık **"Son haller"** sayfasından açılıyor (sayfalar: Son haller, 1-7 Seçim, Tur 5 tamamı). Çizim kaynakları `kaynak/t5son.py`, `kaynak/t5profil.py` (Tur 2 profil modülleriyle), `kaynak/t5hack.py` (Tur 1 Hacklendin modülleriyle), yerleşim `kaynak/mk5son.py`, test `kaynak/chk37.js`.

Son haller sayfasındaki tahtalar:
- `Ozet-Son` (+ mobil, mobilde menü açık hali), `Ozet-Son-Bitti` (bütün işler bitince), `CanliNabiz-Son` (+ mobil)
- `Cerez-Son` (+ mobil), `Menu-Son-Mobil`, `Menu-Son-Acik-Mobil`, `Menu-Son-IlkGelis-Mobil` (M2 alt menü + çerez bandı birlikte)
- `404-Son`, `Durumlar-Son`, `Yasal-Son` (hepsi + mobil)
- `Seviye-Son` (+ mobil), `Profil-Son` (+ mobil)
- `Hacklendin-Son-Alarm`, `Hacklendin-Son-Aciklama` (telefon hali bu turda yeni çizildi), `Rapor-Son` (+ mobil)

Kodlarken unutulmaması gerekenler:
- Yönetim menüsü sırası: Özet, **Canlı nabız**, Öğretmen talepleri, Kullanıcılar, Lablar, Günün ipucu, Gündem, Kayıt defteri. Canlı nabız P4'ün içeriği; bekleyenler şeridi Özet'te kaldığı için oradan çıkarıldı. Akış isimsiz.
- Özet'teki iş kartları gerçek sayılardan gelir: iş bitince kart kendiliğinden kalkar, "Bugün değil" bir günlüğüne saklar.
- M2 alt menü bütün ziyaretçi sayfalarının telefon halinde. Çerez bandı telefonda alt menünün üstünde yüzen kart olarak durur, "Daha fazla" açılınca altında kalır.
- Seviye: öğrenciye hiçbir yerde "x/10" gösterilmez; "Sonraki seviyeye N puan kaldı", 10. seviyede "Bütün seviyeleri tamamladın". "Siber kahraman" rozetinin şartı "En üst seviyeye ulaş". "Tam tur" rozetinin yeni adı "Şehir turu".
- Rozet ikonları: her rozet için ayrı dosya (`rozetler/<rozet-adi>.svg`, PNG de olur). Kazanılmamışta aynı ikon gri ve soluk. Murat ikonları sonra kendi tasarımıyla değiştirecek; yeni rozet = listeye bir satır + bir ikon dosyası.
- Veli onayı (13 yaş altı): Murat danışman hocayla konuşacak, kaldırılabilir. Karar gelene kadar kayıt akışı değişmiyor.
