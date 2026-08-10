-- AlterTable
ALTER TABLE "content_nodes" ADD COLUMN     "availableFrom" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "content_releases" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "nodeId" TEXT NOT NULL,
    "groupId" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_releases_academyId_nodeId_idx" ON "content_releases"("academyId", "nodeId");

-- CreateIndex
CREATE INDEX "content_releases_academyId_groupId_releasedAt_idx" ON "content_releases"("academyId", "groupId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_releases_nodeId_groupId_key" ON "content_releases"("nodeId", "groupId");

-- AddForeignKey
ALTER TABLE "content_releases" ADD CONSTRAINT "content_releases_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_releases" ADD CONSTRAINT "content_releases_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_releases" ADD CONSTRAINT "content_releases_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
