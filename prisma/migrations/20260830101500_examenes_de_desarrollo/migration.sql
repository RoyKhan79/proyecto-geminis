-- EXÁMENES DE DESARROLLO
--
-- Hasta ahora una tarea era siempre un trabajo para casa. Un examen de
-- desarrollo se corrige igual —lo lee una persona y le pone nota— pero no se
-- hace igual: tiene hora de apertura y reloj. En lugar de duplicar todo el
-- flujo de corrección se distinguen aquí los dos tipos.

-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('TASK', 'EXAM');

-- AlterTable
ALTER TABLE "assignments"
  ADD COLUMN "kind" "AssignmentKind" NOT NULL DEFAULT 'TASK',
  ADD COLUMN "opensAt" TIMESTAMP(3),
  ADD COLUMN "timeLimitMinutes" INTEGER,
  ADD COLUMN "allowFiles" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "submissions"
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "draftSavedAt" TIMESTAMP(3);

-- El listado de exámenes de un grupo se pide por tipo y por hora de apertura.
CREATE INDEX "assignments_academyId_kind_opensAt_idx"
  ON "assignments" ("academyId", "kind", "opensAt");
