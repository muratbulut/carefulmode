-- Taslağın sayısal sürümü (güvenlik turu 2, D9). Kaydetme ve yayınlama "taslak hâlâ bu sürümde mi"
-- koşuluyla tek yazımda yazar; aynı anda düzenleyen iki kişiden sonra gelen öncekinin üstüne yazmaz.
-- Var olan lablar 0'dan başlar (açık düzenleme sayfaları zaten yeni sürümle yeniden yüklenir).

-- AlterTable
ALTER TABLE "Lab" ADD COLUMN     "draftRevision" INTEGER NOT NULL DEFAULT 0;
