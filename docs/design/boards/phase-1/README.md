# Faz 1 tahtaları

Faz 1'de kodlanan ekranların tasarım tahtaları (tuvaldeki son halleri). Dosyalar tuvalin kendi biçimindedir (`.dc.html`); tarayıcıda tek başına tam çizilmez, ölçü, renk, metin ve animasyonlar için kaynak olarak okunur. Görsel hali için `docs/design/README.md` içindeki tuval bağlantılarına bak. Dosya adları tuvaldeki tahta adlarıdır, bu yüzden Türkçe kalır.

| Dosya | Ekran | Kodda |
|---|---|---|
| `Secim2-1-Masaustu-Koyu`, `Secim2-2-Masaustu-Gri` | Tanıtım sayfası, masaüstü (Tema H, H13A3) | `app/(visitor)/page.tsx`, `components/landing/` |
| `Secim2-3-Mobil-Koyu`, `Secim2-4-Mobil-Tanitim-Gri`, `Secim2-5-Mobil-Gri` | Tanıtım sayfası, telefon (1.3D) | aynı bileşenler, telefon düzeni |
| `Tanitim-Gundemde-S2-Manset(-Mobil)` | Tanıtım sayfasının "Gündemde" bölümü (Tur 2, S2) ve son masaüstü düzeni | `components/landing/NewsSection.tsx` |
| `Menu-Son-Mobil`, `Menu-Son-Acik-Mobil` | Ziyaretçi alt menüsü M2 ve "Daha fazla" penceresi (Tur 5) | `components/visitor/BottomNav.tsx` |
| `404-Son(-Mobil)` | 404, D1 sade (Tur 5); üst menünün son hali de burada | `app/not-found.tsx`, `components/visitor/TopNav.tsx` |
| `Durumlar-Son(-Mobil)` | Durum ekranları (Tur 5) | `components/status/`, `/onizleme` |

Tanıtım tahtalarındaki "Yol haritan" ve "Bileşenler" bölümleri tema vitrinidir; tanıtım sayfasında ziyaretçi için ilerlemesiz bir "Yol haritası" bölümü var.
