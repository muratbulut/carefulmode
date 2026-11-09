# Faz 2 tahtaları

Faz 2'de (hesap ve yasal) kodlanan ekranların tasarım tahtaları (tuvaldeki son halleri). Dosyalar tuvalin kendi biçimindedir (`.dc.html`); tarayıcıda tek başına tam çizilmez, ölçü, renk, metin ve animasyonlar için kaynak olarak okunur. Görsel hali için `docs/design/README.md` içindeki tuval bağlantılarına bak. Dosya adları tuvaldeki tahta adlarıdır, bu yüzden Türkçe kalır.

| Dosya | Ekran | Kodda |
|---|---|---|
| `Kayit-Masaustu`, `Kayit-Mobil` | Kayıt (Tur 1, ekran 5): canlı şifre gücü, eğitim durumu, KVKK onayı, 18 yaş altında veli kutusu | `app/(auth)/kayit/`, `components/auth/SignUpForm.tsx`, `PasswordStrength.tsx`, `EducationFields.tsx` |
| `Giris-Masaustu`, `Giris-Mobil` | Giriş (Tur 1): kalan deneme, 5 hatada kilit ve geri sayım | `app/(auth)/giris/`, `components/auth/SignInForm.tsx` |
| `Dogrulama-Masaustu`, `Dogrulama-Mobil` | E-posta doğrulama: 6 kutulu kod, tekrar gönderme geri sayımı, adres değiştirme | `app/(auth)/dogrula/`, `components/auth/VerifyForm.tsx`, `CodeInput.tsx` |
| `Dogrulama-Maili` | Kod maili (ad, kod, 10 dakika, "kimseyle paylaşma" uyarısı) | `lib/mail/code-mail.ts` |
| `Dogrulanmamis-Serit` | Doğrulanmamış hesap şeridi | `components/auth/UnverifiedStrip.tsx` |
| `Sifre-Sifirlama`, `Sifre-Sifirlama-Mobil` | Şifre sıfırlama: e-posta, kod, yeni şifre | `app/(auth)/sifre-sifirla/`, `components/auth/ResetWizard.tsx` |
| `Profil-P2-Son`, `Profil-P2-Son-Mobil` | Profil, P2 ayarlar menüsü (Tur 2, ekran 16): hesap bilgileri, avatar, görünüm, güvenlik, hesabı sil; telefonda liste ve kayan sayfa | `app/(visitor)/profil/`, `components/profile/` |
| `Yasal-Son`, `Yasal-Son-Mobil` | KVKK, gizlilik, kullanım koşulları ("Kısaca" ve tam metin) | `app/(visitor)/kvkk/`, `gizlilik/`, `kosullar/`, `components/legal/` |
| `Cerez-Son`, `Cerez-Son-Mobil` | Çerez bandı, ayarlar penceresi ve "Neden önemli?" dersi | Kaldırıldı (4 Kasım): yalnızca gerekli çerezler var |
| `Menu-Son-IlkGelis-Mobil` | Ziyaretçinin ilk gelişi, telefon: alt menü ve çerez bandı birlikte (bant 4 Kasım'da kalktı) | `components/visitor/BottomNav.tsx` |

Faz 2'de bilerek dışarıda kalanlar: profildeki Rozetler, Sınıf ve Öğretmenlik bölümleri (ilgili fazlarla gelir), "Verilerimi indir" (ilk sürümde yok). Giriş yapmış kullanıcının üst menüsü (avatar menüsü) ve alt menüsü (ortada "Kaldığın yerden devam et") Tur 1 ve Tur 2 kararlarından kodlandı; ayrı tahtası yok.
