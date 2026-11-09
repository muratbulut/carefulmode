# Faz 4 tahtaları

Faz 4'te (öğretmen, sınıf ve okullar) kodlanan ekranların tasarım tahtaları (tuvaldeki son halleri). Dosyalar tuvalin kendi biçimindedir (`.dc.html`); tarayıcıda tek başına tam çizilmez, ölçü, renk, metin, durum mantığı ve animasyonlar için kaynak olarak okunur. Görsel hali için `docs/design/README.md` içindeki tuval bağlantılarına bak (Tur 3 ve Tur 4). Dosya adları tuvaldeki tahta adlarıdır, bu yüzden Türkçe kalır.

| Dosya | Ekran | Kodda |
|---|---|---|
| `Ogretmenlik-Son`, `-Mobil` (Tur 4) | Profil > Öğretmenlik: il, ilçe ve okul listesi, "Okulum listede yok", branş, kurumsal e-posta, belge | `components/profile/TeachingSection.tsx`, `lib/teacher/application*.ts` |
| `Ogretmenlik-Son-Bilgi`, `-Mobil` (Tur 4) | Bilgi istendi hali: yöneticinin sorusu, cevap ve belge | aynı |
| `Ogretmenlik-Talep`, `-Onay`, `-Ret` (+ `-Mobil`, Tur 3) | İnceleniyor, onaylandı, onaylanmadı halleri | aynı |
| `Siniflarim-Son`, `-Mobil` (Tur 3) | Sınıflarım: özet kutuları, sınıf kartları, "Dikkat isteyenler", yeni sınıf penceresi | `app/(visitor)/siniflarim/page.tsx`, `components/classroom/`, `lib/classroom/teacher*.ts` |
| `Siniflarim-C4-Yansit`, `-Mobil` (Tur 3) | Tahtaya yansıt ekranı: büyük kod, QR, katılan öğrenciler | `components/classroom/` |
| `Sinif-Detay-Son`, `-Mobil` (Tur 3) | Sınıf detayı (D2 sekmeli): genel bakış, öğrenciler ve çekmece, konular, "Ödev ver" | `app/(visitor)/siniflarim/[sinif]/page.tsx`, `components/classroom/` |
| `Ana-Sayfa-Odev`, `-Mobil` (Tur 3) | Öğrenci ana sayfasında "Sınıfına katıl" kartı ve öğretmenin verdiği ödev | `components/home/`, `lib/classroom/student*.ts` |
| `Okulum-O4-Bulten`, `-Mobil` (Tur 4) | Okulum: haftalık okul bülteni, öğretmenlerin kurulum adımları, okuldan gelen talepler, davet bağlantısı | `app/(visitor)/okulum/page.tsx`, `components/school/`, `lib/school/bulletin.ts`, `lib/teacher/decide.ts` |

Profildeki "Sınıfın" bölümü (sınıf koduyla katıl, sınıftan ayrıl) `Ogretmenlik-Son` tahtasının içinde çizilidir; kodda `components/profile/ClassroomSection.tsx`.

Faz 4'te bilerek dışarıda kalanlar: yönetimdeki "Öğretmen talepleri", "Kullanıcılar ve okullar" (okul ekleme, sorumlu atama) ve kayıt defteri sayfası Faz 5'te gelir. Talep kararlarının ortak çekirdeği (`lib/teacher/decide.ts`) ve kararlardan sonra giden mailler Faz 4'te yazıldı; Okulum onları kullanır, Faz 5'teki talepler ekranı da aynı çekirdeği kullanacak.
