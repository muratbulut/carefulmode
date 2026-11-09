-- Bir mahallede birden çok eğitim labı (temel + ileri eğitimler) ve eğitime bağlı senaryo kilidi;
-- ödevde oda seçimi (15 Ekim, Murat). Var olan veride değişen bir şey yok: unlockedById boş olan
-- senaryoyu mahallenin temel eğitimi açar (eskisi gibi), labIds boş olan ödev bütün mahalledir.
--
-- "Bir mahallede tek eğitim labı" indeksi (20261014090100) artık kural değil; varsa kaldırılır.
DROP INDEX IF EXISTS "Lab_neighborhoodId_training_key";

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "labIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Lab" ADD COLUMN     "unlockedById" TEXT;

-- AddForeignKey
ALTER TABLE "Lab" ADD CONSTRAINT "Lab_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
