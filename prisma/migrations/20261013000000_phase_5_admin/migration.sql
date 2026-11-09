-- CreateEnum
CREATE TYPE "TipStatus" AS ENUM ('POOL', 'DRAFT', 'ARCHIVED');

-- AlterTable: "active" yerine durum. Önceden etkin olan ipucu havuza girer.
ALTER TABLE "DailyTip" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "labId" TEXT,
ADD COLUMN     "status" "TipStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "DailyTip" SET "status" = 'POOL' WHERE "active";
ALTER TABLE "DailyTip" DROP COLUMN "active",
DROP COLUMN "sortOrder";

-- AlterTable: düz metin gövde yerine yapılı içerik. Önceki gövde "Ne oluyor?" bölümüne taşınır.
ALTER TABLE "NewsArticle" ADD COLUMN     "content" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "readCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "title" SET DEFAULT '',
ALTER COLUMN "summary" SET DEFAULT '',
ALTER COLUMN "sourceName" SET DEFAULT '',
ALTER COLUMN "sourceUrl" SET DEFAULT '',
ALTER COLUMN "neighborhoodId" DROP NOT NULL;
UPDATE "NewsArticle" SET "content" = jsonb_build_object('what', "body");
ALTER TABLE "NewsArticle" DROP COLUMN "body",
ALTER COLUMN "content" DROP DEFAULT;

-- CreateTable
CREATE TABLE "TipDay" (
    "date" DATE NOT NULL,
    "tipId" TEXT NOT NULL,

    CONSTRAINT "TipDay_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE INDEX "TipDay_tipId_date_idx" ON "TipDay"("tipId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTip_pinnedDate_key" ON "DailyTip"("pinnedDate");

-- CreateIndex
CREATE INDEX "DailyTip_status_idx" ON "DailyTip"("status");

-- CreateIndex
CREATE INDEX "NewsArticle_status_publishedAt_idx" ON "NewsArticle"("status", "publishedAt");

-- AddForeignKey
ALTER TABLE "DailyTip" ADD CONSTRAINT "DailyTip_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipDay" ADD CONSTRAINT "TipDay_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "DailyTip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

