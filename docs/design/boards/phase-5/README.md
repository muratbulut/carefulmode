# Faz 5 tahtaları

Faz 5'te (yönetim, gündem ve ipucu) kodlanan ekranların tasarım tahtaları (tuvaldeki son halleri). Dosyalar tuvalin kendi biçimindedir (`.dc.html`); tarayıcıda tek başına tam çizilmez, ölçü, renk, metin, durum mantığı ve animasyonlar için kaynak olarak okunur. Görsel hali için `docs/design/README.md` içindeki tuval bağlantılarına bak (Tur 2, 3, 4, 5). Dosya adları tuvaldeki tahta adlarıdır, bu yüzden Türkçe kalır.

| Dosya | Ekran | Kodda |
|---|---|---|
| `Ozet-Son`, `-Mobil`, `-Menu-Mobil`, `Ozet-Son-Bitti`, `-Mobil` (Tur 5) | Yönetim özeti: bekleyen işler, sayılar, grafik, en çok tuzağa düşülen lablar, bu haftanın gündemi ve ipucu, son kayıtlar; işler bitince hali | `app/yonetim/page.tsx`, `components/admin/overview/`, `lib/admin/overview.ts` |
| `CanliNabiz-Son`, `-Mobil` (Tur 5) | Canlı nabız: şu an labda olanlar, mahalle dağılımı, isimsiz akış | `app/yonetim/canli-nabiz/page.tsx`, `components/admin/pulse/` |
| `Talepler-Son`, `-Mobil`, `Talepler-Son-YeniOkul`, `-Mobil` (Tur 4) | Öğretmen talepleri: kontrol listesi, Onayla / Bilgi iste / Reddet, yeni okul | `app/yonetim/talepler/page.tsx`, `components/admin/applications/` |
| `Kullanicilar-Son`, `-Okullar`, `-Ogrenci` (+ `-Mobil`, Tur 4) | Kullanıcılar: Genel (öğrenciler, öğretmenler, yönetim ekibi) ve Okullar; öğrenci kısa profili | `app/yonetim/kullanicilar/page.tsx`, `components/admin/users/` |
| `Kayit-Defteri`, `-Mobil` (Tur 4) | Kayıt defteri: kim, neyi, ne zaman yaptı | `app/yonetim/kayit-defteri/page.tsx`, `components/admin/audit/` |
| `Ipucu-C3-Bugun`, `-Mobil` (Tur 4) | Günün ipucu yönetimi: bugün, sıradaki 6 gün, havuz | `app/yonetim/ipucu/page.tsx`, `components/admin/tips/`, `lib/tips/` |
| `Gundem-Son`, `-Mobil`, `Gundem-Son-Onizleme`, `-Mobil` (Tur 4) | Gündem yönetimi: liste, editör, "Yayına hazır mı?", önizleme | `app/yonetim/gundem/`, `components/admin/news/`, `lib/news/` |
| `Gundem-G2-Zaman`, `Gundem-G2-Ogrenci` (+ `-Mobil`, Tur 2) | Herkese açık gündem listesi (ziyaretçi ve öğrenci) | `app/(visitor)/gundem/page.tsx`, `components/news/` |
| `Gundem-Detay-H2-Yan`, `Gundem-Detay-H2-Ogrenci` (+ `-Mobil`, Tur 2) | Haber detayı | `app/(visitor)/gundem/[haber]/page.tsx`, `components/news/` |
| `Tanitim-Gundemde-S2-Manset`, `-Mobil` (Tur 2) | Tanıtım sayfasındaki "Gündemde" bölümü | `components/landing/NewsSection.tsx` |
| `SSS-Son`, `-Mobil`, `SSS-Son-Ogrenci`, `-Mobil` (Tur 4) | SSS: "Önce söyle: sen kimsin?" | `app/(visitor)/sss/page.tsx`, `components/faq/` |
| `Ogretmen-Tanitim-Son`, `-Mobil` (Tur 3) | Öğretmenler için | `app/(visitor)/ogretmenler/page.tsx`, `components/teachers/` |
