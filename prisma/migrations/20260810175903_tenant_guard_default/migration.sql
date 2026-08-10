-- AlterTable
ALTER TABLE "ai_conversations" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "ai_messages" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "ai_usages" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "class_attendances" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "class_sessions" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "content_legislation_links" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "content_nodes" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "document_chunks" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "enrollments" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "entitlements" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "exam_blueprints" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "groups" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "import_jobs" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "import_rows" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "knowledge_sources" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "legislation_articles" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "legislation_change_alerts" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "legislation_versions" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "legislations" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "memberships" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "opposition_editions" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "opposition_types" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "oppositions" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "product_grants" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "question_options" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "questions" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "stored_files" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "student_content_progress" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "student_question_stats" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "teacher_assignments" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "test_attempt_answers" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "test_attempts" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';

-- AlterTable
ALTER TABLE "test_definitions" ALTER COLUMN "academyId" SET DEFAULT 'SIN_TENANT';
