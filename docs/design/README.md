# Tasarım notları

Tasarım 8-11 Ekim 2026 arasında yapıldı ve onaylandı. Seçilen tema, ekranlar ve kodlamaya taşınacak kararların özeti platform dokümanının 3. bölümünün sonundadır. Bu klasördeki dosyalar ayrıntıdır:

- `screen-list.md` (ekran listesi): bütün ekranlar, her birinin son kararı ve tuvaldeki tahta adı
- `round-1-plan.md` (Tur 1): hesap ekranları ve lab akışı
- `round-2-plan.md` (Tur 2): öğrenci ekranları (ana sayfa, siber şehir, lablar, profil, gündem), seviye ve rozet taslağı
- `round-3-plan.md` (Tur 3): öğretmen ekranları
- `round-4-plan.md` (Tur 4): yönetim ekranları ve SSS
- `round-5-plan.md` (Tur 5): kalan ekranlar ve son kararlar
- `boards/`: kodlanan fazların tahtaları (`boards/phase-1/`: Faz 1, `boards/phase-2/`: Faz 2)

Notlarda geçen `tasarim/...` yolları (`tasarim/turN/kaynak/`, zip yedekleri) depoda değil, projenin paylaşılan dosyalarındadır (tahtaları üreten çizim kaynakları); oradaki adlar Türkçe kalır.

## Tuvaller (görsel son haller)

| Tuval | İçerik |
|---|---|
| [Careful Mode Tema H](https://claude.ai/artifact/FgxEtBMShrGeZKwMTkWRoN) | Seçilen tema (koyu ve gri), tanıtım sayfası |
| [Tur 1](https://claude.ai/artifact/M5CPjhpqjLwWyLFcgbrE6R) | Hesap ekranları ve lab akışı |
| [Tur 2](https://claude.ai/artifact/37CyJtkysjEVCX7WM1CzVc) | Öğrenci ekranları |
| [Tur 3](https://claude.ai/artifact/9wsRpX3LRq3SUc3j9z5i7E) | Öğretmen ekranları |
| [Tur 4](https://claude.ai/artifact/TxyQFgGbsAHxdjzqwsHEkL) | Yönetim ekranları ve SSS |
| [Tur 5](https://claude.ai/artifact/HrcHYiRY4kD5iwRJTjLMPA) | Kalan ekranlar ve son kararlar ("Son haller" sayfası) |
| [Tur 6](https://claude.ai/artifact/EWLY7NALmwUCDYC8gujhh6) | Eğitim kartları: eşleştirme, kutulara ayırma (yeni hali: renkli kutular, sürükle bırak, "Nasıl oynanır" penceresi), boşluk doldurma, bitiş |
| [Tur 7](https://claude.ai/artifact/1X3FG7p2c3uK1YE8Arwcgy) | Para Çarşısı eğitimi: eşleştirme A (hizalı satırlar, tepsi), keşfet, boşluk doldurma B (tek tek cümle), banka kartı, 4 şıklı çizimli testler, adım adım (kodlandı, PR #43) |

Son haller tahtalarda adı "-Son" ile biten tasarımlardır. Bir faz başlarken o fazın ekranlarının tahtaları (HTML) `docs/design/boards/phase-N/` altına eklenir. Tahta dosyaları tuvaldeki adlarıyla (Türkçe) kopyalanır, böylece tuvalde aranabilir.
