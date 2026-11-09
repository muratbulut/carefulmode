-- Yayın testi için yarıda düşen migration (yalnızca CI'da ve yerel denemede, ayrı bir imajla).
-- Kendi içinde COMMIT olduğu için ilk değişiklik kalıcı olur, sonra hata verir: şema yayından
-- önceki haliyle aynı değildir. deploy.sh bunu "geri alındı" diye işaretlemez. Bir sonraki yayın
-- da (şemanın yarım hali artık "yayından önceki hal" olsa bile) işaretlemez ve hiçbir şeyi
-- değiştirmeden durur (güvenlik turu 5). Geri dönüş elle: docker/server/README.md, "Migration
-- başarısız olursa".
CREATE TABLE "PartialProbe" ("id" INTEGER NOT NULL PRIMARY KEY);
COMMIT;
ALTER TABLE "User" ADD COLUMN "partialProbe" TEXT;
DO $$ BEGIN RAISE EXCEPTION 'yarıda düşen migration (yayın testi)'; END $$;
