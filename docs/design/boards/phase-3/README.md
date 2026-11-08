# Faz 3 tahtaları

Faz 3'te (lab motoru ve demo lab) kodlanan ekranların tasarım tahtaları (tuvaldeki son halleri). Dosyalar tuvalin kendi biçimindedir (`.dc.html`); tarayıcıda tek başına tam çizilmez, ölçü, renk, metin, durum mantığı ve animasyonlar için kaynak olarak okunur. Görsel hali için `docs/design/README.md` içindeki tuval bağlantılarına bak. Dosya adları tuvaldeki tahta adlarıdır, bu yüzden Türkçe kalır.

| Dosya | Ekran | Kodda |
|---|---|---|
| `Ana-Sayfa-Son`, `Ana-Sayfa-Son-Mobil` | Öğrenci ana sayfası (Tur 2): profil kartı, seviye, rozet vitrini, günün ipucu, sıradaki rozet, lab istatistikleri, yol haritan, son raporlar | `app/(visitor)/page.tsx`, `components/home/` |
| `Sehir-H4-Yakinlas` | Yol haritası, siber şehir (Tur 2, H4): genel ilerleme ve dört mahalle kartı | `app/(visitor)/yol-haritasi/page.tsx`, `components/roadmap/` |
| `Mahalle-I4A-Rota`, `Mahalle-I4A-Rota-Mobil` | Mahalle sayfası (İ4-A): eğitim labı ve senaryo rotası, sağda önizleme (telefonda alttan açılır) | `app/(visitor)/yol-haritasi/[mahalle]/page.tsx`, `components/roadmap/` |
| `Yol-Haritasi-Ziyaretci`, `Yol-Haritasi-Ziyaretci-Mobil` | Ziyaretçinin yol haritası: ilerleme yok, senaryolar kilitli, "Kayıt ol ve başla" | `components/roadmap/` |
| `Lablar-F1-Dugme`, `Lablar-F1-Dugme-Mobil` | Lablar kataloğu (L1 + F1): arama, açılır süzgeçler, sıralama, kartlar | `app/(visitor)/lablar/page.tsx`, `components/catalog/` |
| `Lablar-Ziyaretci`, `Lablar-Ziyaretci-Mobil` | Ziyaretçinin lablar sayfası: durum süzgeci yok, "Kayıtla açılır" | `components/catalog/` |
| `Lab-Detay-Masaustu`, `Lab-Detay-Mobil` | Lab detayı (Tur 1): hikâye, ne öğreneceksin, adımlar, önceki deneme | `app/(visitor)/lab/[lab]/page.tsx`, `components/lab/detail/` |
| `Egitim-Masaustu`, `Egitim-Mobil-1-Bilgi` ... `-5-Bitis` | Eğitim oynatıcısı: bilgi, tıkla-bul, mini test, video, bitiş kartları | `app/(focus)/lab/[lab]/oyna/page.tsx`, `components/lab/training/` |
| `Lab-Cerceve-Baslangic`, `Lab-Cerceve-Masaustu`, `Lab-Cerceve-Mobil-0` ... `-3` | Lab çerçevesi: başlangıç penceresi, üst şerit, görev paneli, çıkış onayı, Postam ve Mesajlar | `app/(focus)/lab/[lab]/oyna/page.tsx`, `components/lab/frame/`, `components/lab/inbox/`, `components/lab/messaging/` |
| `Sahte-Sayfa-Masaustu`, `Sahte-Sayfa-Mobil` | Bağlantıyla açılan sahte giriş sayfası | `components/lab/inbox/BrowserPage.tsx`, `lib/lab/story.ts` |
| `Hacklendin-Turler` | Ele geçirme türleri (hesap, fidye, veri sızıntısı, para) | `CompromiseKind` (`lib/lab/content.ts`), `components/lab/hacked/` |
| `Hacklendin-Son-Alarm`, `-Mobil` | "Hacklendin" alarmı (4 sn): sıralı bildirimler, sesi kapat | `components/lab/hacked/` |
| `Hacklendin-Son-Aciklama`, `-Mobil` | Hacklendin açıklaması (B zaman tüneli) | `components/lab/hacked/` |
| `Rapor-Son`, `Rapor-Son-Mobil` | Sonuç raporu: puan halkası, adım adım ne oldu, işaretli mail, bir dahaki sefere | `app/(focus)/lab/[lab]/sonuc/[deneme]/page.tsx`, `components/lab/report/`, `lib/lab/report.ts` |
| `Profil-Son`, `Profil-Son-Mobil` | Profildeki Rozetler bölümü ve vitrin | `components/profile/BadgesSection.tsx` |
| `Seviye-Son`, `Seviye-Son-Mobil` | Seviye ve puan gösterimi | `lib/progress/levels.ts`, `components/profile/LevelSummary.tsx` |
| `Lablar-Son`, `Lablar-Son-Mobil` | Yönetim: lab listesi (mahalle akordeonları, yayın düğmesi, sıra) | `app/yonetim/lablar/page.tsx`, `components/admin/` |
| `Lab-Duzenle-Son`, `-Mobil`, `Lab-Duzenle-Son-SMS`, `-SMS-Mobil` | Yönetim: Lab düzenleme formu (gelen kutusu ve mesajlaşma), yayına hazırlık listesi, önizleme ve öğrenci gibi dene | `app/yonetim/lablar/[id]/page.tsx`, `components/admin/editor/`, `lib/admin/`; tam ekran önizleme `app/yonetim/lablar/[id]/onizle/page.tsx`, `components/lab/preview/` |

Faz 3'te bilerek dışarıda kalanlar: ana sayfadaki "Sınıfına katıl" kartı (Faz 4), yönetim menüsünün Lablar dışındaki bölümleri (Faz 4 ve 5), günün ipucu ve gündemin veritabanından gelmesi (Faz 5; şimdilik `lib/content/landing.ts`). Eğitim labındaki video kartı çalışır ama örnek labda video yok, çünkü elimizde video dosyası yok.
