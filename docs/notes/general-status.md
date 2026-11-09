# Genel durum

Konu (sohbet) devri notu: projenin bugünkü hâli, sıradaki işler ve açık kararlar. İki tarafın Claude'u da yeni bir konuya buradan ve `CLAUDE.md`'den başlar. Büyük bir iş bitince (ya da konu kapanırken) bu dosya güncellenir; değişiklik de PR ile girer.

Son güncelleme: 3 Kasım 2026.

## Bugün

- **Platform:** Doküman Bölüm 9'daki 7 fazın hepsi bitti ve canlıda (https://bitirme.muratbulut.net). Hesap, oda motoru (Postam, Mesajlar, eğitim kartları, hacklendin, rapor), öğretmen, sınıf ve okul, yönetim paneli, gündem, günün ipucu, güvenlik başlıkları, yük testi, yedek ve izleme hazır. Her fazdan sonra bir güvenlik turu yapıldı (5 tur, raporlar `docs/security/`).
- **Mahalle yapısı (PR #24, 16 Ekim):** 5 mahalle; bir mahallede birden çok eğitim (ilki temel, diğerleri ileri eğitim), her senaryoyu kendi eğitimi açar, ödevde odalar tek tek seçilir. Kural `lib/lab/gates.ts`, kılavuz `docs/guides/new-lab.md` 2.7.
- **Oda planı (17 Ekim):** 18 eğitim ve 43 senaryo, toplam 61 oda: `docs/labs/room-plan.md`. Sitede 3 örnek oda var. İlk dalga her mahallenin temel yolu (16 oda).
- **Ekip (27 Ekim):** Murat ve Dilek; ikisi de kendi Claude'uyla çalışır. Her oda ve her iş kendi dalında, PR ile girer; PR'ları Murat onaylar. Odaların tam senaryoları `docs/labs/rooms/`.
- **Oda dosyaları (27 Ekim):** Odanın asıl yeri depodaki dosyadır (`labs/rooms/<mahalle>/<oda-adresi>.json`); dosya değişince oda sitede yeni sürümle güncellenir. Ayrıntı `docs/guides/new-lab.md` 2.9.
- **Yeni eğitim kartları (1 Kasım, PR #39):** eğitim odalarında Bilgi, Tıkla-bul, Mini test ve Video'ya ek olarak **Eşleştirme** (`match`), **Kutulara ayırma** (`sort`: renkli ve ikonlu kutular, sürükle bırak, ilk girişte "Nasıl oynanır" penceresi) ve **Boşluk doldurma** (`fill`) var. Her mahallenin eğitim odalarında kullanılabilir; oda dosyasında nasıl yazılacağı `docs/guides/new-lab.md` 1.6, örnek Para Çarşısı temel eğitimi (`labs/rooms/para-carsisi/kisisel-veri-ve-para-guvenligi.json`). Tasarımları Tur 6 tuvalinde (`docs/design/README.md`).
- **İlk yayındaki oda dosyası (1 Kasım, PR #43):** Para Çarşısı temel eğitimi "Kişisel veri ve para güvenliği" yayında: 11 kart, 9 dakika. İçinde iki video var (Ayşegül ve Ayça; `public/videolar/`, ortada soru durağı). Videolar yazılı kartların yerine değil, önüne geldi. Tur 7 tasarımlarıyla bilgi kartının yeni düzenleri geldi: keşfet, banka kartı, adım adım (`layout`). Bunlarda bütün maddeler açılmadan Devam açılmaz. Ayrıca madde ve eşleştirme ikonları (`icon`) ve mini test çizimleri (`art`) eklendi. Telefonda video sorusu artık videonun altında açılıyor. Oda dosyasında nasıl yazılacağı `docs/guides/new-lab.md` 1.6 ve 2.11'de, video ekleme ve küçültme 2.8'de anlatılıyor. Senaryosu `docs/labs/rooms/para-carsisi/training/`, tasarımı Tur 7 tuvalinde.
- **Para Çarşısı'nın ilk senaryosu (2 Kasım):** "Ücretsiz elmas için veli kartı" Murat'la görevli bir odaya dönüştü: **"Kulaklık için veli kartı"**. Annen görüntülü arayıp Ege'ye kulaklık almanı istiyor; Postam'da birebir aynı iki TeknoPazar maili var, fark gönderen adresi ve annene gelen SMS'teki tutar. Senaryo bitti: `docs/labs/rooms/para-carsisi/scenario/kulaklik-icin-veli-karti.md`; oynanabilir sahne tuvali https://claude.ai/artifact/S8v55Mmkjpv8xDDyskLi5H. Kod yazıldı ve main'de (2 Kasım, PR #50): görevli Postam odası (görev, annenin kartı, aynı mağaza sayfası, onay kodu SMS'i, görüntülü arama açılış ve bitişleri, son anda durma sonucu); nasıl yapıldığı `docs/guides/new-lab.md` 2.12. Oda dosyası `labs/rooms/para-carsisi/kulaklik-icin-veli-karti.json` taslak; yayın için `"status": "PUBLISHED"` PR'ı. Annenin sesi eklendi (ElevenLabs, her satır ayrı mp3, `public/sesler/kulaklik-icin-veli-karti/`); "Yazma, anneme anlat" diyene sahte mailden 0 puan (Murat). Annenin görüntüsü Notionists. Senaryo taslaklarını Murat önce tuvalde akış diyagramı ya da oynanabilir sahne olarak görmek istiyor.
- **Para Çarşısı'nın ikinci senaryosu (2 Kasım, PR #54):** **"Eski telefonunu sat"** (sıra 2; sıra 1 Kulaklık için veli kartı). Bu sefer öğrenci satıcı: baban (İbrahim) görüntülü arayıp eski telefonunun satışını sana bırakıyor. Mesajlar'da gerçek alıcı Emre (ödeme pazar yerinde), sahte alıcı Selin (bankanın "ödeme isteği", Onayla deyince para senden çıkar); kargodan önce telefonu yedekle, hesaplardan çık, sıfırla. Kod main'de: satış görevi (`mission.sale`, `request`, `order`, olay `item_shipped`), babanın çizimi, babanın sesi (`public/sesler/eski-telefonunu-sat/`; iyi bitişin 3. satırı "Telefonu da sıfırlamışsın, aferin sana." kayıtta yok, altyazıyla geçiyor) ve Murat'ın isteğiyle **telefon görünümü**: bu odada sahne masaüstünde de bir telefonun içinde açılır (`components/lab/frame/PhoneFrame.tsx`, Mesajlar Postam'a benzemesin diye). Nasıl yapıldığı `docs/guides/new-lab.md` 2.13; senaryo `docs/labs/rooms/para-carsisi/scenario/eski-telefonunu-sat.md`; oynanabilir tuval ve videolar https://claude.ai/artifact/GAkgh6nErokgZM2egWdGXM. Oda dosyası taslak; yayın için `"status": "PUBLISHED"` PR'ı. Murat aramaları ve oda içini video olarak görmek istiyor: kayıt betikleri `/mnt/project-files/para-carsisi/eski-telefonu-tuval/kayit/`.

- **Hoca öncesi revizeler, 1. grup Odalar (3 Kasım):** Murat 5 Kasım'daki hoca görüşmesinden önce bütün sayfaları kontrol listesinde işaretliyor (tuval https://claude.ai/artifact/5JtADf8jtmSQPAftrBM9Wm). Odalar grubunun revizeleri tek taslak PR'da: odanın çizimi (`public/odalar/`, `lib/lab/art.ts`), kapakta adım yolu ve "Seni neler bekliyor" (dersler oda bitene kadar kilitli), renkli çerçeveli etiketler, perde (oda adı) ve genel "Aklında olsun", hacklendin sonrası sonuç sahnesi (açıklama ekranı kalktı), adım adım okunan rapor, görev kartı ikonları, yeni rozet bildirimi. Notlar `/mnt/project-files/notes/hoca-oncesi-revizeler.md`. Sırada kontrol listesinin 2. grubu (Ziyaretçi sayfaları). Kargo odası hikâyeleri, Oltalama eğitiminin yeniden yazımı ve oda açılma animasyonu sonraya; hangi odada hangi sonuç sahnesi olacağını Murat söyleyecek.

## Sırada

1. **İlk dalganın senaryoları** (ekip). Mahalleler paylaşıldı (29 Ekim): Hesap Kalesi ve Yazılım Ormanı Dilek'te, Oltalama Limanı ve Para Çarşısı Murat'ta, Dostluk Parkı beklemede. Özet `docs/labs/room-overview.md`.
2. **İlk dalganın kod işleri** (Murat'ın Claude'u), bu sırayla, her biri kendi PR'ında:
   - M1: Mesajlar'da sahte sayfa ("Okul çekilişinde tablet kazandın"). Bitti, main'de (1 Kasım, PR #35): tuzak anında sahte sayfanın başlığı yazılınca bağlantı sahte sayfa açar (`docs/guides/new-lab.md` 1.7).
   - M2: ek dosya tuzağı (Yazılım Ormanı'nın iki senaryosu).
   - M3: yumuşak sonuç ekranı ("Sınıf grubunda alay edilen arkadaş", Dostluk Parkı).
   - Para Çarşısı "Kulaklık için veli kartı": kod ve ses girdi (2 Kasım); sırada oda dosyasını yayına alma (`"status": "PUBLISHED"`).
   - Para Çarşısı "Eski telefonunu sat": kod, ses ve telefon görünümü girdi (2 Kasım); sırada oda dosyasını yayına alma. Eksik ses satırı Murat'tan gelirse eklenir.
   - Para Çarşısı "Okul çekilişinde tablet kazandın": Murat akış diyagramını görmek istedi (2 Kasım akşamı, ayrı konuda); sıra 1'e girip girmeyeceğine akışa bakıp karar verecek.
3. Sonra `docs/labs/room-plan.md` sonundaki kod işi tablosu: diğer eklentiler (M4-M6) ve yeni şablonlar (Akış, Cihaz, Tarayıcı). Yeni sahne önce tasarım tuvalinde çizilir, ekip onaylar, sonra kodlanır.
4. **Actions dakikası:** Ekim'in dakikası 29 Ekim'de bitmişti; 1 Kasım'da yenilendi, CI ve yayın yeniden çalışıyor. Next.js güvenlik güncellemesi (#33) 1 Kasım sabahı yayınlandı, M1 ve hafif CI (#35) aynı gün main'e girdi. Dakikayı korumak için kurallar `CLAUDE.md`'de (Yayın): hafif CI, push'tan önce yerelde test, commit'leri biriktirip tek push. Ay içinde yine biterse sıradaki adım kendi makinemizde çalıştırıcı (canlı sunucuda değil) ya da açık depo. 2 Kasım ölçümü: 1 Kasım tek günde ~920 dakika gitti (kod PR'ı push başına ~52, main'e birleşince ~62 dakika; yalnızca oda dosyası PR'ı ~25 dakika). Üç önlem eklendi: main'de uçtan uca test yok, uçtan uca testler yalnızca taslak olmayan PR'da (PR taslak açılır), Dependabot npm'de ayda en çok iki PR.

## Murat'ın kararını bekleyenler

- 13 yaş altı öğrenciler için veli onayı (hocayla konuşulacak).
- Ürün adı, logo ve alan adı (ad ve logo tek dosyadan okunur: `lib/brand.tsx`).
- Okullara açmadan önce mail hizmetinin ücretli planı (Resend).
- Canlı yük testinin günü ve saati.
- Rozet ikonları ve avatar seti.
- Yönetimde oda silme yok, yalnızca gizleme ve yayından kaldırma var (öneri: böyle kalsın, öğrenci denemeleri odaya bağlı).

## Sonraya bırakılanlar

- İki adımlı giriş, ekip maili kuyruğu, iletişim e-postası, bir odada birden çok sahte öğe, hacklendin ekranının yeniden tasarımı, yavaş internette yazı tipleri, ürün alan adına geçiş, sunucuda ayrı kullanıcı.
- Pilottan önce: yasal metinlerdeki boşluklar (`lib/content/legal.ts`: veri sorumlusu, kayıt defteri saklama süresi, iletişim e-postası) ve hukuki kontrol; örnek verinin kaldırılması.
- Proje sonunda bütün site için son güvenlik testi; aynı turda bağımlılık güncellemeleri. Büyük sürüm atlamalı Dependabot PR'ları (1 Kasım: #3 typescript 7, #20 @types/node 26, #27 jsdom 30, #28 eslint 10) bilerek bekliyor; küçük yamalar (ör. #34) CI yeşil olunca birleşir.
- Yayından sonra (doküman Bölüm 9): revizyonlar, revizyon testleri, stres testi. İleride (Bölüm 10): Google ile giriş, oda başına ayrıntılı analiz, başka diller, harici oda paketleri.

## Depoda olmayanlar

Murat'ın Claude projesinde hoca sunumu belgesi, tanıtım videosu ve tasarım çalışmaları da durur; işin yürümesi için gereken her karar bu dosyada, `CLAUDE.md`'de ya da `docs/` altındadır. Tasarım tuvallerinin bağlantıları `docs/design/README.md`'de.
