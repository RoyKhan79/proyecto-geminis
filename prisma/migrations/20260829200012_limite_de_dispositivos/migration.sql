-- AlterTable
ALTER TABLE "academies" ADD COLUMN     "maxSessionsPerStudent" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "deviceLabel" TEXT;
