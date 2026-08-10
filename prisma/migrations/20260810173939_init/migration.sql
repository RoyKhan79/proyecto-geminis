-- CreateEnum
CREATE TYPE "OppositionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EditionStatus" AS ENUM ('PLANNED', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CourseModality" AS ENUM ('PRESENCIAL', 'ONLINE', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('PENDING', 'PROCESSING', 'INDEXED', 'FAILED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AIAssistantKind" AS ENUM ('STUDENT_TUTOR', 'TEACHER_COPILOT');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'OPEN');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'POSSIBLY_OUTDATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('MANUAL', 'IMPORT', 'AI_GENERATED', 'OFFICIAL_EXAM');

-- CreateEnum
CREATE TYPE "TestKind" AS ENUM ('TOPIC', 'BLOCK', 'CUSTOM', 'RANDOM', 'ERRORS', 'REVIEW', 'FAVORITES', 'SIMULATION', 'OFFICIAL_EXAM', 'AI_GENERATED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ProductBilling" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('VIEW_CONTENT', 'DOWNLOAD_CONTENT', 'TAKE_TESTS', 'TAKE_SIMULATIONS', 'ATTEND_CLASSES', 'WATCH_RECORDINGS', 'USE_AI_TUTOR');

-- CreateEnum
CREATE TYPE "EntitlementSource" AS ENUM ('ENROLLMENT', 'PRODUCT', 'MANUAL', 'TRIAL');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'SEPA_DIRECT_DEBIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ContentNodeKind" AS ENUM ('SECTION', 'FOLDER', 'TOPIC', 'RESOURCE');

-- CreateEnum
CREATE TYPE "SectionKind" AS ENUM ('SYLLABUS', 'LIBRARY', 'CLASSES', 'TESTS', 'SIMULATIONS', 'LEGISLATION', 'VIDEO', 'PRACTICAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PDF', 'VIDEO', 'AUDIO', 'IMAGE', 'LINK', 'RICH_TEXT', 'DOWNLOADABLE', 'EMBED');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'EXCUSED', 'ONLINE', 'WATCHED_RECORDING');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'LEFT');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('PENDING', 'ACTIVE', 'ON_HOLD', 'INACTIVE', 'ALUMNI');

-- CreateEnum
CREATE TYPE "LegislationScope" AS ENUM ('EUROPEAN', 'STATE', 'REGIONAL', 'LOCAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LegislationStatus" AS ENUM ('IN_FORCE', 'AMENDED', 'REPEALED', 'DRAFT');

-- CreateEnum
CREATE TYPE "LegislationChangeType" AS ENUM ('CREATED', 'AMENDED', 'REPEALED', 'CORRECTED');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPLIED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('STUDENTS', 'TEACHERS', 'QUESTIONS', 'ENROLLMENTS', 'CONTENT');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'MAPPING', 'VALIDATED', 'SIMULATED', 'IMPORTING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'VALID', 'WARNING', 'ERROR', 'CREATED', 'UPDATED', 'SKIPPED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "AcademyStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE');

-- CreateTable
CREATE TABLE "opposition_types" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template" JSONB NOT NULL DEFAULT '{}',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opposition_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oppositions" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "typeId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "coverUrl" TEXT,
    "status" "OppositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "authority" TEXT,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "oppositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opposition_editions" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "oppositionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER,
    "examDate" TIMESTAMP(3),
    "positions" INTEGER,
    "status" "EditionStatus" NOT NULL DEFAULT 'OPEN',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "clonedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "opposition_editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "oppositionEditionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "modality" "CourseModality" NOT NULL DEFAULT 'PRESENCIAL',
    "status" "CourseStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schedule" TEXT,
    "capacity" INTEGER,
    "modality" "CourseModality" NOT NULL DEFAULT 'PRESENCIAL',
    "status" "CourseStatus" NOT NULL DEFAULT 'ACTIVE',
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "groupId" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "priceCents" INTEGER,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "discountNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_assignments" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "oppositionId" TEXT,
    "editionId" TEXT,
    "courseId" TEXT,
    "groupId" TEXT,
    "isCoordinator" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "nodeId" TEXT,
    "fileId" TEXT,
    "title" TEXT NOT NULL,
    "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "checksum" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "lastIndexedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "nodeId" TEXT,
    "nodePath" TEXT,
    "editionId" TEXT,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "locator" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" "AIAssistantKind" NOT NULL DEFAULT 'STUDENT_TUTOR',
    "title" TEXT,
    "contextNodeId" TEXT,
    "contextData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "confidence" TEXT,
    "model" TEXT,
    "provider" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usages" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "memberId" TEXT,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "embeddingTokens" INTEGER NOT NULL DEFAULT 0,
    "costMilliCents" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "editionId" TEXT,
    "nodeId" TEXT,
    "type" "QuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "QuestionSource" NOT NULL DEFAULT 'MANUAL',
    "statement" TEXT NOT NULL,
    "explanation" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "officialExamRef" TEXT,
    "authorId" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "aiProvenance" JSONB,
    "outdatedReason" TEXT,
    "outdatedAt" TIMESTAMP(3),
    "timesAnswered" INTEGER NOT NULL DEFAULT 0,
    "timesCorrect" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "feedback" TEXT,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_blueprints" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "editionId" TEXT,
    "name" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "reserveQuestions" INTEGER NOT NULL DEFAULT 0,
    "optionsPerQuestion" INTEGER NOT NULL DEFAULT 4,
    "durationMinutes" INTEGER NOT NULL,
    "penaltyPerWrong" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "passingScore" DECIMAL(6,3),
    "distribution" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_definitions" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "editionId" TEXT,
    "nodeId" TEXT,
    "blueprintId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "TestKind" NOT NULL DEFAULT 'TOPIC',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "questionCount" INTEGER NOT NULL DEFAULT 20,
    "timeLimitMinutes" INTEGER,
    "penaltyPerWrong" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "revealMode" TEXT NOT NULL DEFAULT 'AT_END',
    "maxAttempts" INTEGER,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "test_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempts" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "testDefinitionId" TEXT,
    "kind" "TestKind" NOT NULL DEFAULT 'CUSTOM',
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "config" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "blankCount" INTEGER NOT NULL DEFAULT 0,
    "score" DECIMAL(8,3),
    "scorePercent" DECIMAL(6,2),
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "test_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempt_answers" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "selectedOptionId" TEXT,
    "answerText" TEXT,
    "isCorrect" BOOLEAN,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "test_attempt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_question_stats" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "timesSeen" INTEGER NOT NULL DEFAULT 0,
    "timesCorrect" INTEGER NOT NULL DEFAULT 0,
    "timesWrong" INTEGER NOT NULL DEFAULT 0,
    "lastCorrect" BOOLEAN,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "easeFactor" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_question_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billing" "ProductBilling" NOT NULL DEFAULT 'MONTHLY',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "oppositionId" TEXT,
    "editionId" TEXT,
    "courseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_grants" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "nodeId" TEXT,
    "capability" "Capability" NOT NULL DEFAULT 'VIEW_CONTENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "source" "EntitlementSource" NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'PENDING',
    "productId" TEXT,
    "enrollmentId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_scopes" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "nodeId" TEXT,
    "courseId" TEXT,
    "capability" "Capability" NOT NULL DEFAULT 'VIEW_CONTENT',

    CONSTRAINT "entitlement_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "productId" TEXT,
    "concept" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod" NOT NULL DEFAULT 'TRANSFER',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "receiptNo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_nodes" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "parentId" TEXT,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "kind" "ContentNodeKind" NOT NULL,
    "sectionKind" "SectionKind",
    "label" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "visibleToStudents" BOOLEAN NOT NULL DEFAULT true,
    "downloadable" BOOLEAN,
    "aiEnabled" BOOLEAN,
    "usableForTests" BOOLEAN,
    "watermark" BOOLEAN,
    "trackLegislation" BOOLEAN,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "estimatedMinutes" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "content_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_resources" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "fileId" TEXT,
    "externalUrl" TEXT,
    "provider" TEXT,
    "providerRef" TEXT,
    "richText" TEXT,
    "durationSeconds" INTEGER,
    "pageCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_node_versions" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_node_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageDriver" TEXT NOT NULL DEFAULT 'local',
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_content_progress" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "secondsSpent" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "lastPosition" JSONB,
    "firstStartedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_content_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "editionId" TEXT,
    "courseId" TEXT,
    "groupId" TEXT,
    "teacherId" TEXT,
    "nodeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ClassStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER,
    "location" TEXT,
    "meetingProvider" TEXT,
    "meetingUrl" TEXT,
    "meetingRef" TEXT,
    "recordingUrl" TEXT,
    "recordingReadyAt" TIMESTAMP(3),
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_attendances" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'es-ES',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_roles" (
    "membershipId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_roles_pkey" PRIMARY KEY ("membershipId","roleId")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "code" TEXT,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "birthDate" TIMESTAMP(3),
    "nationalId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "source" TEXT,
    "notes" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isExternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "activeAcademyId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "impersonatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislations" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" "LegislationScope" NOT NULL DEFAULT 'STATE',
    "status" "LegislationStatus" NOT NULL DEFAULT 'IN_FORCE',
    "officialId" TEXT,
    "officialUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "inForceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "legislations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislation_versions" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "legislationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "sourceUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legislation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislation_articles" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "legislationId" TEXT NOT NULL,
    "versionId" TEXT,
    "number" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legislation_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_legislation_links" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "nodeId" TEXT,
    "questionId" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" DECIMAL(4,3),
    "excerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_legislation_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legislation_change_alerts" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "legislationId" TEXT NOT NULL,
    "versionId" TEXT,
    "articleId" TEXT,
    "changeType" "LegislationChangeType" NOT NULL DEFAULT 'AMENDED',
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "previousText" TEXT,
    "newText" TEXT,
    "impact" JSONB,
    "aiProposal" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legislation_change_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "academyId" TEXT,
    "actorId" TEXT,
    "impersonatorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "changes" JSONB,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "actionUrl" TEXT,
    "data" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "type" "ImportType" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "fileName" TEXT NOT NULL,
    "fileId" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "columnMapping" JSONB NOT NULL DEFAULT '{}',
    "options" JSONB NOT NULL DEFAULT '{}',
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "errorSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "academyId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "parsedData" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "entityType" TEXT,
    "entityId" TEXT,
    "wasCreated" BOOLEAN,
    "previousData" JSONB,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "billingPeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
    "maxStudents" INTEGER,
    "maxTeachers" INTEGER,
    "maxAdmins" INTEGER,
    "maxOppositions" INTEGER,
    "storageGb" INTEGER,
    "aiTokensPerMonth" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT NOT NULL DEFAULT 'ES',
    "status" "AcademyStatus" NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "planId" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'es-ES',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#4F46E5',
    "customDomain" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "academies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "opposition_types_academyId_key_key" ON "opposition_types"("academyId", "key");

-- CreateIndex
CREATE INDEX "oppositions_academyId_status_idx" ON "oppositions"("academyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "oppositions_academyId_slug_key" ON "oppositions"("academyId", "slug");

-- CreateIndex
CREATE INDEX "opposition_editions_academyId_oppositionId_idx" ON "opposition_editions"("academyId", "oppositionId");

-- CreateIndex
CREATE INDEX "courses_academyId_status_idx" ON "courses"("academyId", "status");

-- CreateIndex
CREATE INDEX "groups_academyId_courseId_idx" ON "groups"("academyId", "courseId");

-- CreateIndex
CREATE INDEX "enrollments_academyId_status_idx" ON "enrollments"("academyId", "status");

-- CreateIndex
CREATE INDEX "enrollments_academyId_courseId_idx" ON "enrollments"("academyId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_studentId_courseId_key" ON "enrollments"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "teacher_assignments_academyId_teacherId_idx" ON "teacher_assignments"("academyId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_assignments_teacherId_oppositionId_editionId_course_key" ON "teacher_assignments"("teacherId", "oppositionId", "editionId", "courseId", "groupId");

-- CreateIndex
CREATE INDEX "knowledge_sources_academyId_status_idx" ON "knowledge_sources"("academyId", "status");

-- CreateIndex
CREATE INDEX "document_chunks_academyId_nodeId_idx" ON "document_chunks"("academyId", "nodeId");

-- CreateIndex
CREATE INDEX "document_chunks_academyId_editionId_idx" ON "document_chunks"("academyId", "editionId");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_sourceId_position_key" ON "document_chunks"("sourceId", "position");

-- CreateIndex
CREATE INDEX "ai_conversations_academyId_memberId_updatedAt_idx" ON "ai_conversations"("academyId", "memberId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usages_academyId_createdAt_idx" ON "ai_usages"("academyId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usages_academyId_feature_createdAt_idx" ON "ai_usages"("academyId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "questions_academyId_status_idx" ON "questions"("academyId", "status");

-- CreateIndex
CREATE INDEX "questions_academyId_nodeId_status_idx" ON "questions"("academyId", "nodeId", "status");

-- CreateIndex
CREATE INDEX "questions_academyId_editionId_status_idx" ON "questions"("academyId", "editionId", "status");

-- CreateIndex
CREATE INDEX "question_options_questionId_position_idx" ON "question_options"("questionId", "position");

-- CreateIndex
CREATE INDEX "exam_blueprints_academyId_idx" ON "exam_blueprints"("academyId");

-- CreateIndex
CREATE INDEX "test_definitions_academyId_status_idx" ON "test_definitions"("academyId", "status");

-- CreateIndex
CREATE INDEX "test_definitions_academyId_nodeId_idx" ON "test_definitions"("academyId", "nodeId");

-- CreateIndex
CREATE INDEX "test_attempts_academyId_studentId_startedAt_idx" ON "test_attempts"("academyId", "studentId", "startedAt");

-- CreateIndex
CREATE INDEX "test_attempts_academyId_testDefinitionId_idx" ON "test_attempts"("academyId", "testDefinitionId");

-- CreateIndex
CREATE INDEX "test_attempt_answers_academyId_questionId_idx" ON "test_attempt_answers"("academyId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "test_attempt_answers_attemptId_questionId_key" ON "test_attempt_answers"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "student_question_stats_academyId_studentId_nextReviewAt_idx" ON "student_question_stats"("academyId", "studentId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "student_question_stats_academyId_studentId_timesWrong_idx" ON "student_question_stats"("academyId", "studentId", "timesWrong");

-- CreateIndex
CREATE UNIQUE INDEX "student_question_stats_studentId_questionId_key" ON "student_question_stats"("studentId", "questionId");

-- CreateIndex
CREATE INDEX "products_academyId_status_idx" ON "products"("academyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "products_academyId_slug_key" ON "products"("academyId", "slug");

-- CreateIndex
CREATE INDEX "product_grants_academyId_productId_idx" ON "product_grants"("academyId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_grants_productId_nodeId_capability_key" ON "product_grants"("productId", "nodeId", "capability");

-- CreateIndex
CREATE INDEX "entitlements_academyId_studentId_status_idx" ON "entitlements"("academyId", "studentId", "status");

-- CreateIndex
CREATE INDEX "entitlements_academyId_status_endsAt_idx" ON "entitlements"("academyId", "status", "endsAt");

-- CreateIndex
CREATE INDEX "entitlement_scopes_nodeId_idx" ON "entitlement_scopes"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_scopes_entitlementId_nodeId_courseId_capability_key" ON "entitlement_scopes"("entitlementId", "nodeId", "courseId", "capability");

-- CreateIndex
CREATE INDEX "payments_academyId_status_dueDate_idx" ON "payments"("academyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "payments_academyId_studentId_idx" ON "payments"("academyId", "studentId");

-- CreateIndex
CREATE INDEX "content_nodes_academyId_editionId_parentId_position_idx" ON "content_nodes"("academyId", "editionId", "parentId", "position");

-- CreateIndex
CREATE INDEX "content_nodes_academyId_path_idx" ON "content_nodes"("academyId", "path");

-- CreateIndex
CREATE INDEX "content_nodes_academyId_kind_status_idx" ON "content_nodes"("academyId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "content_nodes_editionId_parentId_slug_key" ON "content_nodes"("editionId", "parentId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_resources_nodeId_key" ON "content_resources"("nodeId");

-- CreateIndex
CREATE INDEX "content_node_versions_nodeId_idx" ON "content_node_versions"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "content_node_versions_nodeId_version_key" ON "content_node_versions"("nodeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storageKey_key" ON "stored_files"("storageKey");

-- CreateIndex
CREATE INDEX "stored_files_academyId_createdAt_idx" ON "stored_files"("academyId", "createdAt");

-- CreateIndex
CREATE INDEX "student_content_progress_academyId_studentId_status_idx" ON "student_content_progress"("academyId", "studentId", "status");

-- CreateIndex
CREATE INDEX "student_content_progress_academyId_nodeId_idx" ON "student_content_progress"("academyId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "student_content_progress_studentId_nodeId_key" ON "student_content_progress"("studentId", "nodeId");

-- CreateIndex
CREATE INDEX "class_sessions_academyId_startsAt_idx" ON "class_sessions"("academyId", "startsAt");

-- CreateIndex
CREATE INDEX "class_sessions_academyId_groupId_startsAt_idx" ON "class_sessions"("academyId", "groupId", "startsAt");

-- CreateIndex
CREATE INDEX "class_attendances_academyId_studentId_idx" ON "class_attendances"("academyId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "class_attendances_classId_studentId_key" ON "class_attendances"("classId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "memberships_academyId_status_idx" ON "memberships"("academyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_academyId_userId_key" ON "memberships"("academyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_academyId_key_key" ON "roles"("academyId", "key");

-- CreateIndex
CREATE INDEX "role_permissions_permission_idx" ON "role_permissions"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permission_key" ON "role_permissions"("roleId", "permission");

-- CreateIndex
CREATE INDEX "membership_roles_roleId_idx" ON "membership_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_membershipId_key" ON "student_profiles"("membershipId");

-- CreateIndex
CREATE INDEX "student_profiles_status_idx" ON "student_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_membershipId_key" ON "teacher_profiles"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "legislations_academyId_status_idx" ON "legislations"("academyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "legislations_academyId_reference_key" ON "legislations"("academyId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "legislation_versions_legislationId_version_key" ON "legislation_versions"("legislationId", "version");

-- CreateIndex
CREATE INDEX "legislation_articles_academyId_legislationId_idx" ON "legislation_articles"("academyId", "legislationId");

-- CreateIndex
CREATE UNIQUE INDEX "legislation_articles_legislationId_versionId_number_key" ON "legislation_articles"("legislationId", "versionId", "number");

-- CreateIndex
CREATE INDEX "content_legislation_links_academyId_articleId_idx" ON "content_legislation_links"("academyId", "articleId");

-- CreateIndex
CREATE INDEX "content_legislation_links_academyId_nodeId_idx" ON "content_legislation_links"("academyId", "nodeId");

-- CreateIndex
CREATE INDEX "content_legislation_links_academyId_questionId_idx" ON "content_legislation_links"("academyId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "content_legislation_links_articleId_nodeId_questionId_key" ON "content_legislation_links"("articleId", "nodeId", "questionId");

-- CreateIndex
CREATE INDEX "legislation_change_alerts_academyId_status_createdAt_idx" ON "legislation_change_alerts"("academyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_academyId_createdAt_idx" ON "audit_logs"("academyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_academyId_entityType_entityId_idx" ON "audit_logs"("academyId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_academyId_recipientId_readAt_idx" ON "notifications"("academyId", "recipientId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_academyId_createdAt_idx" ON "notifications"("academyId", "createdAt");

-- CreateIndex
CREATE INDEX "import_jobs_academyId_type_status_idx" ON "import_jobs"("academyId", "type", "status");

-- CreateIndex
CREATE INDEX "import_rows_academyId_jobId_status_idx" ON "import_rows"("academyId", "jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_jobId_rowNumber_key" ON "import_rows"("jobId", "rowNumber");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "academies_slug_key" ON "academies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "academies_customDomain_key" ON "academies"("customDomain");

-- CreateIndex
CREATE INDEX "academies_status_idx" ON "academies"("status");

-- AddForeignKey
ALTER TABLE "opposition_types" ADD CONSTRAINT "opposition_types_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oppositions" ADD CONSTRAINT "oppositions_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oppositions" ADD CONSTRAINT "oppositions_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "opposition_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opposition_editions" ADD CONSTRAINT "opposition_editions_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opposition_editions" ADD CONSTRAINT "opposition_editions_oppositionId_fkey" FOREIGN KEY ("oppositionId") REFERENCES "oppositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opposition_editions" ADD CONSTRAINT "opposition_editions_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "opposition_editions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_oppositionEditionId_fkey" FOREIGN KEY ("oppositionEditionId") REFERENCES "opposition_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_oppositionId_fkey" FOREIGN KEY ("oppositionId") REFERENCES "oppositions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_assignments" ADD CONSTRAINT "teacher_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usages" ADD CONSTRAINT "ai_usages_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_blueprints" ADD CONSTRAINT "exam_blueprints_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_blueprints" ADD CONSTRAINT "exam_blueprints_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_definitions" ADD CONSTRAINT "test_definitions_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_definitions" ADD CONSTRAINT "test_definitions_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_definitions" ADD CONSTRAINT "test_definitions_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_definitions" ADD CONSTRAINT "test_definitions_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "exam_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_testDefinitionId_fkey" FOREIGN KEY ("testDefinitionId") REFERENCES "test_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_answers" ADD CONSTRAINT "test_attempt_answers_selectedOptionId_fkey" FOREIGN KEY ("selectedOptionId") REFERENCES "question_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_question_stats" ADD CONSTRAINT "student_question_stats_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_question_stats" ADD CONSTRAINT "student_question_stats_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_question_stats" ADD CONSTRAINT "student_question_stats_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_oppositionId_fkey" FOREIGN KEY ("oppositionId") REFERENCES "oppositions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_grants" ADD CONSTRAINT "product_grants_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_grants" ADD CONSTRAINT "product_grants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_grants" ADD CONSTRAINT "product_grants_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_scopes" ADD CONSTRAINT "entitlement_scopes_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_scopes" ADD CONSTRAINT "entitlement_scopes_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_nodes" ADD CONSTRAINT "content_nodes_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_nodes" ADD CONSTRAINT "content_nodes_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_nodes" ADD CONSTRAINT "content_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_resources" ADD CONSTRAINT "content_resources_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_resources" ADD CONSTRAINT "content_resources_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_node_versions" ADD CONSTRAINT "content_node_versions_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_content_progress" ADD CONSTRAINT "student_content_progress_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_content_progress" ADD CONSTRAINT "student_content_progress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_content_progress" ADD CONSTRAINT "student_content_progress_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "opposition_editions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_attendances" ADD CONSTRAINT "class_attendances_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_attendances" ADD CONSTRAINT "class_attendances_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_attendances" ADD CONSTRAINT "class_attendances_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_activeAcademyId_fkey" FOREIGN KEY ("activeAcademyId") REFERENCES "academies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_impersonatedById_fkey" FOREIGN KEY ("impersonatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislations" ADD CONSTRAINT "legislations_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_versions" ADD CONSTRAINT "legislation_versions_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_versions" ADD CONSTRAINT "legislation_versions_legislationId_fkey" FOREIGN KEY ("legislationId") REFERENCES "legislations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_articles" ADD CONSTRAINT "legislation_articles_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_articles" ADD CONSTRAINT "legislation_articles_legislationId_fkey" FOREIGN KEY ("legislationId") REFERENCES "legislations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_articles" ADD CONSTRAINT "legislation_articles_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "legislation_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_legislation_links" ADD CONSTRAINT "content_legislation_links_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_legislation_links" ADD CONSTRAINT "content_legislation_links_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "legislation_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_legislation_links" ADD CONSTRAINT "content_legislation_links_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "content_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_legislation_links" ADD CONSTRAINT "content_legislation_links_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_change_alerts" ADD CONSTRAINT "legislation_change_alerts_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_change_alerts" ADD CONSTRAINT "legislation_change_alerts_legislationId_fkey" FOREIGN KEY ("legislationId") REFERENCES "legislations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_change_alerts" ADD CONSTRAINT "legislation_change_alerts_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "legislation_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legislation_change_alerts" ADD CONSTRAINT "legislation_change_alerts_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "legislation_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academies" ADD CONSTRAINT "academies_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
