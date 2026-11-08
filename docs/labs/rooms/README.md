# Oda senaryoları

Bu klasör odaların **tam metnini** tutar: mailler, mesajlar, kartlar, sorular, rapor metinleri. Ekipteki iki kişi kendi odalarını burada yazar, birbirinin senaryosunu okur ve düzeltme önerir.

`docs/labs/room-plan.md` odaların kısa planıdır (hikâye, tuzak, doğru karar, ana soru, bekleyen kod işi). Buradaki dosya o planın açılmış hâlidir; plan ile senaryo çelişirse önce plan güncellenir.

## Klasör düzeni

Her mahallenin kendi klasörü var. Klasör adı mahallenin site adresidir (`/yol-haritasi/<mahalle>`).

| Klasör | Mahalle | Konu | Yazan (29 Ekim) |
| --- | --- | --- | --- |
| [`hesap-kalesi/`](hesap-kalesi/README.md) | Hesap Kalesi | Hesap güvenliği | Dilek |
| [`oltalama-limani/`](oltalama-limani/README.md) | Oltalama Limanı | Oltalama ve sahte içerik | Murat |
| [`yazilim-ormani/`](yazilim-ormani/README.md) | Yazılım Ormanı | Zararlı yazılım | Dilek |
| [`para-carsisi/`](para-carsisi/README.md) | Para Çarşısı | Kişisel veri ve para | Murat |
| [`dostluk-parki/`](dostluk-parki/README.md) | Dostluk Parkı | Güvenli iletişim | Beklemede |

Mahalleler 29 Ekim'de paylaşıldı: her mahallenin bütün odaları (eğitimler ve senaryolar) aynı kişide. Dostluk Parkı diğer dört mahalle bitince paylaşılacak. Bütün planın tek sayfalık özeti: [`../room-overview.md`](../room-overview.md).

Her mahalle klasöründe:

- `README.md`: mahallenin bütün odaları; kimin yazdığı ve her odanın durumu bu tabloda izlenir.
- `training/`: eğitim odalarının senaryoları (temel ve ileri eğitimler).
- `scenario/`: senaryo odalarının senaryoları.

Dosya adı odanın adresidir (`/oda/<oda-adresi>`), mahalle README'sindeki tabloda her oda için yazılıdır. Örnek: `hesap-kalesi/scenario/gece-gelen-giris-uyarisi.md`.

## Akış: senaryodan canlıya

1. **Üstlen.** Mahalle README'sindeki tabloda odanın "Yazan" sütununa adını yaz.
2. **Dal aç.** Güncel `main`'den `oda/<oda-adresi>` dalı açılır.
3. **Senaryoyu yaz.** Şablonu kopyala ([`templates/training.md`](templates/training.md) ya da [`templates/scenario.md`](templates/scenario.md)), odanın klasörüne koy, doldur. Durum: "Senaryo yazılıyor".
4. **Oku ve düzelt.** Öbür kişi senaryoyu okur, önerisini dosyanın sonundaki "Notlar" bölümüne ya da PR yorumuna yazar.
5. **Tasarla.** Senaryo bitince ekranları tasarım tuvalinde çizilir (Claude Code); ekip tuvale bakar. Durum: "Tasarımda".
6. **Kodla.** Onaylanan senaryo ve tasarım oda dosyasına (`labs/rooms/<mahalle>/<oda-adresi>.json`, `"status": "DRAFT"`) çevrilir, gerekiyorsa sahne kodu eklenir, testler yazılır. Durum: "PR açık". Dosyanın biçimi ve yayına nasıl girdiği `docs/guides/new-lab.md` 2.9'da.
7. **Birleştir.** Murat PR'ı onaylar, CI yeşilse `main`'e girer ve oda sitede taslak olarak açılır. Durum: "Sitede taslak". Yönetim > Odalar'da önizlenir ve öğrenci gibi denenir.
8. **Yayınla.** Dosyada `"status": "PUBLISHED"` yapan küçük bir PR; birleşince oda canlıda. Durum: "Sitede yayında". `room-plan.md`'deki satır da aynı PR'da güncellenir. Sonradan yapılan her düzeltme de dosyada ve PR'la olur; oda yeni sürümle güncellenir.

Durumlar: Yazılacak → Senaryo yazılıyor → Tasarımda → PR açık → Sitede taslak / Sitede yayında.

## Yazarken kurallar

Kısa hâli; tamamı `docs/guides/getting-started.md` ("Oda yazarken kurallar") ve `docs/guides/new-lab.md`'de.

- Arayüzde ve senaryo metninde **"lab" denmez, "oda" denir.**
- Gerçek marka, logo ve alan adı yok (mail uygulaması "Postam"; adresler uydurma: `kargo-teslimat-tr.xyz`).
- Odada **tek tuzak**, yanında güvenli **gerçek öğeler**.
- Dil kısa, yaşa uygun, suçlamayan. Dostluk Parkı'nda sonuç "Hacklendin" değil, daha yumuşak bir ekrandır.
- Puan toplamı tam **10**: sahte öğe 4, her gerçek öğe 1, kalan sorulara (`new-lab.md` 1.8).
- Şablondaki karakter sınırları formdaki sınırlarla aynıdır; aşan metin koda çevrilirken kısaltılmak zorunda kalır.
