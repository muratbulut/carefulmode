-- Yayın testi için bilerek düşen migration (yalnızca CI'da ve yerel denemede, ayrı bir imajla).
-- Önce şemayı değiştirir, sonra hata verir. PostgreSQL migration dosyasını tek bir örtük işlemde
-- çalıştırdığı için hatadan sonra ilk iki değişiklik de geri alınmış olmalıdır; deploy.sh bunu
-- şema parmak iziyle denetler, migration'ı "geri alındı" olarak işaretler ve önceki sürüme döner.
CREATE TABLE "FailingProbe" ("id" INTEGER NOT NULL PRIMARY KEY);
ALTER TABLE "User" ADD COLUMN "failingProbe" TEXT;
DO $$ BEGIN RAISE EXCEPTION 'bilerek düşen migration (yayın testi)'; END $$;
