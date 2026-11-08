-- Faz 3: lab motoru. Mahalle renkleri sabit renk kodundan tema rengi adına geçer; konu ve
-- ikon eklenir. Örnek lablar yayınlayansız gelebilsin diye LabVersion.publishedById boş olabilir.

-- DropForeignKey
ALTER TABLE "LabVersion" DROP CONSTRAINT "LabVersion_publishedById_fkey";

-- DropIndex
DROP INDEX "LabEvent_attemptId_idx";

-- AlterTable
ALTER TABLE "Lab" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
-- Henüz hiç lab olayı yok (Faz 3 öncesi); var olsaydı sıra numarası 0 olurdu.
ALTER TABLE "LabEvent" ADD COLUMN     "seq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LabEvent" ALTER COLUMN "seq" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LabVersion" ALTER COLUMN "publishedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Neighborhood" ADD COLUMN     "icon" TEXT NOT NULL DEFAULT 'mail',
ADD COLUMN     "topic" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TrainingProgress" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "LabAttempt_labId_status_idx" ON "LabAttempt"("labId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LabEvent_attemptId_seq_key" ON "LabEvent"("attemptId", "seq");

-- AddForeignKey
ALTER TABLE "LabVersion" ADD CONSTRAINT "LabVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Faz 1 başlangıç verisindeki renk kodları tema rengi adlarına çevrilir; konu ve ikon eklenir.
UPDATE "Neighborhood" SET "color" = 'success', "icon" = 'lock', "topic" = 'Hesap güvenliği' WHERE "slug" = 'hesap-kalesi' AND "color" LIKE '#%';
UPDATE "Neighborhood" SET "color" = 'accent', "icon" = 'mail', "topic" = 'Oltalama' WHERE "slug" = 'oltalama-limani' AND "color" LIKE '#%';
UPDATE "Neighborhood" SET "color" = 'purple', "icon" = 'download', "topic" = 'Zararlı yazılım' WHERE "slug" = 'yazilim-ormani' AND "color" LIKE '#%';
UPDATE "Neighborhood" SET "color" = 'warning', "icon" = 'card', "topic" = 'Kişisel veri ve para' WHERE "slug" = 'para-carsisi' AND "color" LIKE '#%';
