-- Haberin kapak görseli (4 Kasım, 15): odak noktası, alt metin, kaynak ve görselin kendisi.
-- AlterTable
ALTER TABLE "NewsArticle" ADD COLUMN     "coverAlt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "coverCredit" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "coverFocusX" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "coverFocusY" INTEGER NOT NULL DEFAULT 50;

-- CreateTable
CREATE TABLE "NewsCover" (
    "articleId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsCover_pkey" PRIMARY KEY ("articleId")
);

-- AddForeignKey
ALTER TABLE "NewsCover" ADD CONSTRAINT "NewsCover_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Odak noktası yüzde: 0-100.
ALTER TABLE "NewsArticle" ADD CONSTRAINT "NewsArticle_coverFocus_check" CHECK ("coverFocusX" BETWEEN 0 AND 100 AND "coverFocusY" BETWEEN 0 AND 100);
