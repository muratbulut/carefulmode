# Başlarken

Projeye yeni katılan ekip arkadaşı ve onun Claude'u için tek sayfalık giriş. Önce bunu, sonra `CLAUDE.md`'yi oku; ayrıntılar oradan bağlanan dosyalarda.

## Proje

Careful Mode (çalışma adı; isim ve logo değişecek), ortaokul ve lise öğrencileri için Türkçe bir dijital güvenlik eğitim platformudur. Öğrenci önce **eğitim odasında** kısa kartlarla öğrenir, sonra **senaryo odasında** sahte bir mail kutusunda ya da mesajlaşmada karar verir. Yanlış kararda "Hacklendin" ekranını görür, sonunda bir rapor alır. Öğretmen sınıf açar ve ödev verir; yönetim ekibi odaları, gündemi ve günün ipucunu yönetir.

Murat Bulut'un bitirme projesidir. Fikirleri ve oda içeriğini ekip yazar, kodu Claude Code yazar. Canlı site: https://bitirme.muratbulut.net.

## Önce okunacaklar

| Dosya | Ne var |
| --- | --- |
| `CLAUDE.md` | Kesin kurallar, kod düzeni, komutlar, yayın. Claude Code her işe başlarken kendiliğinden okur. |
| `docs/labs/room-plan.md` | Bütün odaların planı: 61 odanın her biri için hikâye, tuzak, doğru karar, işaretler, ana soru, bekleyen kod işi. |
| `docs/labs/room-overview.md` | Planın tek sayfalık özeti: mahalleler, sahneler, her odanın türü ve beklediği kod işi, kimin hangi mahalleyi yazdığı. |
| `docs/labs/rooms/` | Odaların tam senaryoları, her mahalle kendi klasöründe; kimin hangi odayı yazdığı ve odaların durumu da orada. |
| `docs/guides/new-lab.md` | 1. kısım: odanın alanları (kapak, mailler, görevler, puan, rapor) ve formdaki önizleme. 2. kısım: yeni sahne türü (şablon) eklemek, depodaki oda dosyaları (2.9). |
| `docs/notes/general-status.md` | Projenin bugünkü durumu, sıradaki işler ve açık kararlar. Her büyük işten sonra güncellenir. |
| `docs/platform-document.md` | Platformun bütün dokümanı (Bölüm 4 oda yapısı, Bölüm 6 veri modeli). |
| `docs/glossary.md` | Türkçe terimlerin koddaki İngilizce adları. |
| `docs/design/` | Ekranların tasarım kararları ve tuval bağlantıları. |

## Mahalle ve oda yapısı

Harita bir **siber şehir**dir. 5 mahalle var: Hesap Kalesi (hesap güvenliği), Oltalama Limanı (oltalama ve sahte içerik), Yazılım Ormanı (zararlı yazılım), Para Çarşısı (kişisel veri ve para), Dostluk Parkı (güvenli iletişim).

- Her mahallede birden çok **eğitim odası** olur. İlki **temel eğitim**dir ve her zaman açıktır; diğerleri **ileri eğitim**dir ve temel bitince açılır.
- Her **senaryo odasını** bir eğitim açar (`Lab.unlockedById`; boşsa temel eğitim). Öğrenci sırayı kendisi seçer.
- Mahalle rozeti temel yolu ister: temel eğitim ve onun açtığı senaryolar.
- Öğretmen ödevde odaları tek tek seçer; seçilen senaryoyu açan eğitim ödeve kendiliğinden girer.
- Odalar içeriktir, asıl yerleri depodaki **oda dosyasıdır** (`labs/rooms/<mahalle>/<oda-adresi>.json`). Dosya PR'la girer, birleşince odayı sitede ekler ya da günceller. **Yönetim > Odalar** formu önizleme ve deneme içindir. Sahne türleri (Postam, Mesajlar, eğitim kartları) koddadır.

Plan 18 eğitim ve 43 senaryo, toplam 61 oda. **İlk dalga** her mahallenin temel yoludur (16 oda); sitede 3'ü var. Hangi odanın bugün yazılabildiği, hangisinin kod işi beklediği `docs/labs/room-plan.md`'de.

## Çalışma düzeni

- **Her oda ve her iş kendi dalında yapılır**, PR ile `main`'e girer. Dal her zaman güncel `main`'den açılır. Oda dalının adı `oda/<oda-adresi>` (ör. `oda/gece-gelen-giris-uyarisi`); Claude Code'un açtığı `claude/...` dalları da olur.
- Bir oda dalında şunlar olur: odanın senaryosu (`docs/labs/rooms/`, akış oradaki README'de), oda dosyası (`labs/rooms/`), odanın gerektirdiği kod (sahne eklentisi, tasarım düzeltmesi, test) ve `docs/labs/room-plan.md`'deki o odanın güncellenmesi (durum, değişen hikâye ya da soru). Oda formla yazılmaz (27 Ekim, Murat).
- PR'ı açan, CI (lint, birim testleri, masaüstü ve telefon uçtan uca testleri, Docker) yeşile dönmeden birleştirmez. Öbür kişi PR'a bakar.
- `main`'e giren her değişiklik testler geçince kendiliğinden canlı siteye yüklenir (`.github/workflows/deploy.yml`). Elle yükleme yapılmaz.
- Aynı dosyaya iki kişi aynı anda dokunacaksa önce haber verilir. En çok çakışan yerler: dil sözlüğü `lib/i18n/messages/tr.ts`, `docs/labs/room-plan.md`, `CLAUDE.md`.
- Commit mesajları, PR açıklamaları, kod yorumları ve arayüz metinleri Türkçe; dosya adları ve koddaki adlar İngilizce.

## Oda yazarken kurallar

1. **Gerçek marka, logo ve alan adı yok.** Mail uygulaması kurgusal "Postam"; sahte adresler uydurma (`kargo-teslimat-tr.xyz` gibi), bankalar ve oyunlar kurgusal. Resmî yardım hatları (112, ALO 183, İhbar Web) eğitim kartlarında geçebilir; yazarken güncel bilgi kontrol edilir.
2. **Odada tek tuzak**, yanında güvenli **gerçek öğeler** olur. Amaç her şeyden şüphelenmek değil, ayırt etmek.
3. **Doğru karar ve puan tarayıcıya gitmez**, sunucuda hesaplanır. Sahte formlara yazılan metin kaydedilmez, yalnız "bilgi girildi" olayı kaydedilir. Sahneler gerçek ağ isteği yapmaz, gerçek dosya indirmez.
4. **Arayüzde "lab" denmez, "oda" denir.** Kodda kavramın adı `lab` kalır.
5. **Dil kısa ve yaşa uygun**, suçlamaz. Dostluk Parkı'nda yanlış kararın sonucu "Hacklendin" değil, daha yumuşak bir ekrandır ("Paylaşım yayıldı"); dil "Suç senin değil, bir büyüğüne anlat" der.
6. **Hassas odalar** (fotoğraf ve şantaj, kolay para) herkese açıktır; kapakta "lise için önerilir" notu olur.
7. **Öğrenciye toplam seviye sayısı gösterilmez**, toplu ekranlarda öğrenci adı görünmez (gizlilik kuralları `CLAUDE.md`'de).
8. Oda önce dosyada `"status": "DRAFT"` ile birleşir; sitede taslak olarak durur, öğrenciler görmez. Yönetim > Odalar'da **Önizleme** ve **Öğrenci gibi dene** ile bakılır, sonra `"PUBLISHED"` yapan küçük bir PR açılır. Yayından sonra bir kez öğrenci hesabıyla baştan sona oynanır.

## Yeni sahne gerekirse

Odanın planındaki "Bekleyen kod işi" bir eklenti (M1-M6) ya da yeni şablon (Akış, Cihaz, Tarayıcı) diyorsa, oda bugünkü sahnelerle yazılamaz; önce o kod işi `main`'e girer. Yeni sahne önce tasarım tuvalinde çizilir, ekip onaylar, sonra kodlanır. Hangi dosyalara dokunulacağı ve hangi testlerin yazılacağı `docs/guides/new-lab.md` 2. kısımda.

## Hesaplar

- Yönetim paneline girmek için sitede hesap açılır, Murat **Yönetim > Kullanıcılar > Yönetim ekibi**'nden ekler ve "Oda ekleme ve düzenleme" (gerekirse "Oda yayınlama ve gizleme") iznini verir.
- Denemek için örnek veride üç öğrenci (`ogrenci@`, `ogrenci2@`, `ogrenci3@ornek.invalid`), öğretmen (`ogretmen@`), okul sorumlusu (`sorumlu@`) ve yönetici (`yonetici@ornek.invalid`) hesapları var; şifre `DEMO_PASSWORD` depo sırrındadır (liste `docker/server/README.md`, "Örnek veri").
- Sırlar (SSH, `DEMO_PASSWORD`) yalnız GitHub depo sırlarında durur; koda ve belgelere yazılmaz.
