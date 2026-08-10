-- CreateEnum
CREATE TYPE "ThreadStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "OfficialSource" AS ENUM ('BOE', 'REGIONAL', 'PROVINCIAL', 'LOCAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('NEW', 'REVIEWING', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LATE', 'RETURNED', 'GRADED');

-- CreateTable
CREATE TABLE "wall_posts" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "authorId" TEXT NOT NULL,
    "editionId" TEXT,
    "courseId" TEXT,
    "groupId" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "wall_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wall_comments" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "wall_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_threads" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "editionId" TEXT,
    "nodeId" TEXT,
    "subject" TEXT NOT NULL,
    "status" "ThreadStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unreadForStudent" BOOLEAN NOT NULL DEFAULT false,
    "unreadForStaff" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opposition_watches" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "name" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sources" "OfficialSource"[] DEFAULT ARRAY[]::"OfficialSource"[],
    "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "oppositionId" TEXT,
    "notifyEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opposition_watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_calls" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "watchId" TEXT,
    "source" "OfficialSource" NOT NULL DEFAULT 'BOE',
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "department" TEXT,
    "region" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT,
    "pdfUrl" TEXT,
    "status" "CallStatus" NOT NULL DEFAULT 'NEW',
    "oppositionId" TEXT,
    "editionId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "official_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radar_runs" (
    "id" TEXT NOT NULL,
    "source" "OfficialSource" NOT NULL DEFAULT 'BOE',
    "bulletinDate" TIMESTAMP(3) NOT NULL,
    "itemsScanned" INTEGER NOT NULL DEFAULT 0,
    "matches" INTEGER NOT NULL DEFAULT 0,
    "notified" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,

    CONSTRAINT "radar_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "editionId" TEXT,
    "courseId" TEXT,
    "groupId" TEXT,
    "nodeId" TEXT,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "dueAt" TIMESTAMP(3),
    "allowLate" BOOLEAN NOT NULL DEFAULT true,
    "maxScore" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "briefFileId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "body" TEXT,
    "submittedAt" TIMESTAMP(3),
    "score" DECIMAL(5,2),
    "feedback" TEXT,
    "gradedById" TEXT,
    "gradedAt" TIMESTAMP(3),
    "returnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_files" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "submissionId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_rooms" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL DEFAULT 'SIN_TENANT',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "editionId" TEXT,
    "courseId" TEXT,
    "groupId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'external',
    "url" TEXT NOT NULL,
    "schedule" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "live_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wall_posts_academyId_groupId_createdAt_idx" ON "wall_posts"("academyId", "groupId", "createdAt");

-- CreateIndex
CREATE INDEX "wall_posts_academyId_courseId_createdAt_idx" ON "wall_posts"("academyId", "courseId", "createdAt");

-- CreateIndex
CREATE INDEX "wall_comments_academyId_postId_createdAt_idx" ON "wall_comments"("academyId", "postId", "createdAt");

-- CreateIndex
CREATE INDEX "message_threads_academyId_status_lastMessageAt_idx" ON "message_threads"("academyId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "message_threads_academyId_studentId_lastMessageAt_idx" ON "message_threads"("academyId", "studentId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "messages_academyId_threadId_createdAt_idx" ON "messages"("academyId", "threadId", "createdAt");

-- CreateIndex
CREATE INDEX "opposition_watches_academyId_isActive_idx" ON "opposition_watches"("academyId", "isActive");

-- CreateIndex
CREATE INDEX "official_calls_academyId_status_publishedAt_idx" ON "official_calls"("academyId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "official_calls_academyId_externalId_key" ON "official_calls"("academyId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "radar_runs_source_bulletinDate_key" ON "radar_runs"("source", "bulletinDate");

-- CreateIndex
CREATE INDEX "assignments_academyId_status_dueAt_idx" ON "assignments"("academyId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "assignments_academyId_groupId_idx" ON "assignments"("academyId", "groupId");

-- CreateIndex
CREATE INDEX "submissions_academyId_status_idx" ON "submissions"("academyId", "status");

-- CreateIndex
CREATE INDEX "submissions_academyId_studentId_idx" ON "submissions"("academyId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignmentId_studentId_key" ON "submissions"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "submission_files_academyId_submissionId_idx" ON "submission_files"("academyId", "submissionId");

-- CreateIndex
CREATE INDEX "live_rooms_academyId_isOpen_idx" ON "live_rooms"("academyId", "isOpen");

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_posts" ADD CONSTRAINT "wall_posts_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_comments" ADD CONSTRAINT "wall_comments_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_comments" ADD CONSTRAINT "wall_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "wall_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wall_comments" ADD CONSTRAINT "wall_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opposition_watches" ADD CONSTRAINT "opposition_watches_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opposition_watches" ADD CONSTRAINT "opposition_watches_oppositionId_fkey" FOREIGN KEY ("oppositionId") REFERENCES "oppositions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "official_calls" ADD CONSTRAINT "official_calls_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "official_calls" ADD CONSTRAINT "official_calls_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "opposition_watches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_rooms" ADD CONSTRAINT "live_rooms_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
