# Senaryo odası: <Oda adı>

<!-- Bu şablonu kopyala: docs/labs/rooms/<mahalle>/scenario/<oda-adresi>.md
     Parantez içindeki sayılar formdaki karakter sınırlarıdır (docs/guides/new-lab.md 1.5-1.9). -->

| Alan | Değer |
| --- | --- |
| Mahalle | |
| Açan eğitim | |
| Sahne | Postam / Mesajlar (yeni sahne gerekiyorsa adı: Akış, Cihaz, Tarayıcı, M1-M6) |
| Oda adresi | `/oda/...` |
| Yazan | |
| Durum | Senaryo yazılıyor |
| Plan | `docs/labs/room-plan.md` içindeki başlığı |

## Kapak

- **Oda adı** (80):
- **Esprili başlık** (80):
- **Kısa açıklama** (200):
- **Hikâye** (800):
- **Zorluk:** Kolay / Orta / Zor
- **Süre (dk):**
- **Bu odada ne öğreneceksin** (en fazla 3; başlık 80, açıklama 240):
  1. **Başlık:** açıklama
- **"Bu odada şunlara dikkat et"** (en az 2, en fazla 4; her biri 160; cevabı söyleme):
  1. **Başlık:** açıklama
  2.

## Sahne: mailler ya da mesajlar

<!-- En fazla 8 öğe. Tek sahte öğe, yanında gerçek öğeler. -->

### Öğe 1 (Sahte)

- **Gönderen adı / Kişi adı** (60):
- **Adres / Numara ya da kullanıcı adı** (80):
- **Konu** (120, yalnız Postam):
- **Saat** (20):
- **Metin** (1200):

  > Mesajın tam metni. Mesajlaşmada her balon ayrı satır.

- **Bağlantı** (isteğe bağlı; adres 120, düğme yazısı 40):
- **Ek** (yalnız Postam; dosya adı 60, boyut 20):
- **İşaretler** (her yere bir tane; Postam: Gönderen, Metin, Bağlantı; Mesajlar: Gönderen, Metin, İstek):
  - Gönderen: açıklama (300) · maildeki kelimeler (120):
  - Metin:
  - Bağlantı / İstek:
- **Raporda "Neden?"** (400):

### Öğe 2 (Gerçek)

- **Gönderen adı** (60):
- **Adres** (80):
- **Saat** (20):
- **Metin** (1200):
- **Raporda "Neden?"** (400):

## Tuzak

<!-- Postam ise "Sahte sayfa", Mesajlar ise "Tuzak anı" kısmını doldur, öbürünü sil. -->

**Sahte sayfa (Postam):**

- Adres (120):
- Sayfa başlığı (80):
- Kısa açıklama (300):
- Ne istiyor? (80):
- Verirse ne olur? Hesap / Fidye / Bilgi sızıntısı / Para
- Hangi hesap? (30, yalnız Hesap türünde; boşsa Postam):

**Tuzak anı (Mesajlar):**

- Ne istiyor? (80):
- Öğrenci bunu gönderirse hacklenir (40):
- Verirse ne olur? Hesap / Fidye / Bilgi sızıntısı / Para
- Hangi hesap? (30):

**Hacklendin hikâyesi** (isteğe bağlı; boşsa türün genel metni):

- Gerçek hayatta bu ne demek? (500):
- Bir dahaki sefere (en fazla 3, her biri 200):

## Görevler

<!-- En az 4, en fazla 8. Sıra: EYLEM, BİLDİR, sonra en az 2 SORU. Görev metni 200. -->

1. **EYLEM:** "Gelen kutunu aç"
2. **BİLDİR:** "Gelen kutunu incele, şüphelileri bildir"
3. **SORU:** <soru>
   - <seçenek (160)> · puan:
   - <seçenek> · puan:
   - <seçenek> · puan:
   - **Doğrusu** (300):
   - **Neden?** (400):
4. **SORU:** <soru>

**Puan toplamı:** sahte öğe 4 + gerçek öğeler (her biri 1) + soruların en yüksek puanları = **10**

## Rapor: "Bir dahaki sefere" ipuçları

<!-- En az 3, en fazla 8 (her biri 240). Koşul: engaged, hacked, missedFake, reportedReal, always ("always" en sona). -->

1. `engaged`:
2. `hacked`:
3. `missedFake`:
4. `always`:

## Notlar

<!-- Okuyan kişinin önerileri, açık sorular, tasarım için fikirler. -->
