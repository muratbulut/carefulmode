-- Bir mahallede tek eğitim labı (güvenlik turu 2, D10). Kural kodda da var (lib/admin/lab-actions.ts,
-- createLab), ama aynı anda gelen iki "Yeni lab" isteği ikisi de "henüz yok" görüp iki eğitim labı
-- açabiliyordu. Kısmi tekil indeks bunu veritabanında kapatır. Prisma şemasında yazılamaz (önizleme
-- özelliği gerekir); Prisma bu indeksi görmezden gelir, sonraki migration'larda silmez.
--
-- Var olan veri: indeksten önce aynı mahallede birden fazla eğitim labı var mı diye bakılır.
--   - Yoksa indeks oluşturulur.
--   - Varsa indeks OLUŞTURULMAZ, migration yine de başarıyla biter ve bir NOTICE yazar. Bu migration
--     hata verirse _prisma_migrations'ta "failed" satırı kalır, deploy.sh'nin döndüğü önceki sürümün
--     migration işi de P3009 ile durur ve site açılmaz; bu yüzden burada hata verilmez. Fazla labı
--     silmek ya da taşımak içerik kararıdır, kendiliğinden yapılmaz. Kod kuralı (createLab'deki sayım)
--     korumaya devam eder; yalnızca aynı anda gelen isteklere karşı veritabanı kilidi eksik kalır.
-- "prisma migrate deploy" NOTICE'u çıktısında göstermez: ilk yayından sonra indeksin varlığına bir kez
-- bakılır. Denetleme, fazla labları bulma ve indeksi elle oluşturma: docs/guides/new-lab.md,
-- "Eğitim labı indeksi" (2. kısım).

DO $$
DECLARE
  duplicates text;
BEGIN
  -- Denetimle indeks arasında yeni eğitim labı eklenmesin: işlem bitene kadar Lab'a yazmalar bekler
  -- (okumalar sürer). İndeks küçük bir tabloda oluşturulduğu için bekleme kısadır.
  LOCK TABLE "Lab" IN SHARE MODE;

  SELECT string_agg(format('%s: %s', n."slug", labs.slugs), '; ')
    INTO duplicates
    FROM (
      SELECT "neighborhoodId", string_agg("slug", ', ' ORDER BY "createdAt") AS slugs
        FROM "Lab"
       WHERE "type" = 'TRAINING'
       GROUP BY "neighborhoodId"
      HAVING count(*) > 1
    ) labs
    JOIN "Neighborhood" n ON n."id" = labs."neighborhoodId";

  IF duplicates IS NOT NULL THEN
    RAISE NOTICE 'D10: Aynı mahallede birden fazla eğitim labı var (%). "Lab_neighborhoodId_training_key" indeksi oluşturulmadı; migration yine de bitti. Fazla labı düzeltip indeksi elle oluşturun (docs/guides/new-lab.md, "Eğitim labı indeksi").', duplicates;
    RETURN;
  END IF;

  CREATE UNIQUE INDEX IF NOT EXISTS "Lab_neighborhoodId_training_key" ON "Lab"("neighborhoodId") WHERE "type" = 'TRAINING';
END $$;
