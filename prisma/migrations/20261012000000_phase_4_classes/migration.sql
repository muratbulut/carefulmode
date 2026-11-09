-- Faz 4: öğretmenlik talebi (belge, bilgi iste), okul listesi ve okul sorumlusu, sınıflar ve ödev.
-- DropIndex
DROP INDEX "School_province_district_name_key";

-- AlterTable
ALTER TABLE "Classroom" ADD COLUMN     "level" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "coordinatorApproves" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nameKey" TEXT NOT NULL DEFAULT '';

-- Var olan okulların karşılaştırma adı (lib/school/names.ts ile aynı kural: küçük harf, tek boşluk).
UPDATE "School" SET "nameKey" = regexp_replace(lower(trim("name")), '\s+', ' ', 'g');
ALTER TABLE "School" ALTER COLUMN "nameKey" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TeacherApplication" DROP COLUMN "documentPath",
ADD COLUMN     "answeredAt" TIMESTAMP(3),
ADD COLUMN     "documentName" TEXT,
ADD COLUMN     "documentSize" INTEGER,
ADD COLUMN     "questionAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "applicationId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("applicationId")
);

-- CreateIndex
CREATE INDEX "Assignment_classroomId_closed_idx" ON "Assignment"("classroomId", "closed");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "School_coordinatorId_key" ON "School"("coordinatorId");

-- CreateIndex
CREATE UNIQUE INDEX "School_province_district_nameKey_key" ON "School"("province", "district", "nameKey");

-- CreateIndex
CREATE INDEX "TeacherApplication_userId_idx" ON "TeacherApplication"("userId");

-- CreateIndex
CREATE INDEX "TeacherApplication_status_idx" ON "TeacherApplication"("status");

-- CreateIndex
CREATE INDEX "TeacherApplication_schoolId_idx" ON "TeacherApplication"("schoolId");

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "TeacherApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

