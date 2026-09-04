-- SEGUNDA BARRERA DE AISLAMIENTO · Row Level Security
--
-- Hasta ahora el aislamiento entre academias descansaba en una sola barrera: la
-- guardia de aplicación de src/lib/db/tenant.ts. Está probada, pero es una sola,
-- y hay tres formas de rodearla sin querer:
--
--   · una consulta con $queryRaw, que no pasa por la extensión de Prisma;
--   · un error futuro al fusionar el WHERE de la guardia;
--   · una operación de Prisma que la extensión no contemple.
--
-- Con esto, PostgreSQL comprueba la academia por su cuenta. Si la aplicación se
-- equivoca, la base de datos no devuelve la fila.
--
-- Cómo funciona: la guardia fija 'catedria.academy_id' al principio de cada
-- transacción y la política solo deja ver las filas de esa academia. Cuando la
-- variable NO está puesta —migraciones, semillas, consola de plataforma,
-- autenticación— la política deja pasar: esos usos son deliberados y ya se
-- revisan uno a uno en la auditoría interna.
--
-- FORCE es imprescindible: el dueño de la tabla se salta RLS si no se fuerza, y
-- la aplicación se conecta con el dueño.
--
-- 50 tablas con datos de academia.

ALTER TABLE "ai_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_conversations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "ai_conversations";
CREATE POLICY "aislamiento_academia" ON "ai_conversations"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "ai_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "ai_messages";
CREATE POLICY "aislamiento_academia" ON "ai_messages"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "ai_usages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_usages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "ai_usages";
CREATE POLICY "aislamiento_academia" ON "ai_usages"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assignments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "assignments";
CREATE POLICY "aislamiento_academia" ON "assignments"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "audit_logs";
CREATE POLICY "aislamiento_academia" ON "audit_logs"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "class_attendances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_attendances" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "class_attendances";
CREATE POLICY "aislamiento_academia" ON "class_attendances"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "class_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "class_sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "class_sessions";
CREATE POLICY "aislamiento_academia" ON "class_sessions"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "content_legislation_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_legislation_links" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "content_legislation_links";
CREATE POLICY "aislamiento_academia" ON "content_legislation_links"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "content_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_nodes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "content_nodes";
CREATE POLICY "aislamiento_academia" ON "content_nodes"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "content_releases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_releases" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "content_releases";
CREATE POLICY "aislamiento_academia" ON "content_releases"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "courses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "courses";
CREATE POLICY "aislamiento_academia" ON "courses"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_chunks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "document_chunks";
CREATE POLICY "aislamiento_academia" ON "document_chunks"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "enrollments";
CREATE POLICY "aislamiento_academia" ON "enrollments"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entitlements" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "entitlements";
CREATE POLICY "aislamiento_academia" ON "entitlements"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "exam_blueprints" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_blueprints" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "exam_blueprints";
CREATE POLICY "aislamiento_academia" ON "exam_blueprints"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "groups";
CREATE POLICY "aislamiento_academia" ON "groups"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_jobs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "import_jobs";
CREATE POLICY "aislamiento_academia" ON "import_jobs"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "import_rows" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "import_rows" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "import_rows";
CREATE POLICY "aislamiento_academia" ON "import_rows"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "knowledge_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_sources" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "knowledge_sources";
CREATE POLICY "aislamiento_academia" ON "knowledge_sources"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "legislation_articles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legislation_articles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "legislation_articles";
CREATE POLICY "aislamiento_academia" ON "legislation_articles"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "legislation_change_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legislation_change_alerts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "legislation_change_alerts";
CREATE POLICY "aislamiento_academia" ON "legislation_change_alerts"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "legislation_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legislation_versions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "legislation_versions";
CREATE POLICY "aislamiento_academia" ON "legislation_versions"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "legislations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "legislations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "legislations";
CREATE POLICY "aislamiento_academia" ON "legislations"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "live_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "live_rooms" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "live_rooms";
CREATE POLICY "aislamiento_academia" ON "live_rooms"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "memberships";
CREATE POLICY "aislamiento_academia" ON "memberships"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "message_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_threads" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "message_threads";
CREATE POLICY "aislamiento_academia" ON "message_threads"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "messages";
CREATE POLICY "aislamiento_academia" ON "messages"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "notifications";
CREATE POLICY "aislamiento_academia" ON "notifications"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "official_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "official_calls" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "official_calls";
CREATE POLICY "aislamiento_academia" ON "official_calls"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "opposition_editions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opposition_editions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "opposition_editions";
CREATE POLICY "aislamiento_academia" ON "opposition_editions"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "opposition_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opposition_types" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "opposition_types";
CREATE POLICY "aislamiento_academia" ON "opposition_types"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "opposition_watches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "opposition_watches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "opposition_watches";
CREATE POLICY "aislamiento_academia" ON "opposition_watches"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "oppositions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oppositions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "oppositions";
CREATE POLICY "aislamiento_academia" ON "oppositions"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "payments";
CREATE POLICY "aislamiento_academia" ON "payments"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "product_grants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_grants" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "product_grants";
CREATE POLICY "aislamiento_academia" ON "product_grants"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "products";
CREATE POLICY "aislamiento_academia" ON "products"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "question_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_options" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "question_options";
CREATE POLICY "aislamiento_academia" ON "question_options"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "questions";
CREATE POLICY "aislamiento_academia" ON "questions"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "roles";
CREATE POLICY "aislamiento_academia" ON "roles"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "stored_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stored_files" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "stored_files";
CREATE POLICY "aislamiento_academia" ON "stored_files"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "student_content_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_content_progress" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "student_content_progress";
CREATE POLICY "aislamiento_academia" ON "student_content_progress"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "student_question_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_question_stats" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "student_question_stats";
CREATE POLICY "aislamiento_academia" ON "student_question_stats"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "submission_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submission_files" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "submission_files";
CREATE POLICY "aislamiento_academia" ON "submission_files"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "submissions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "submissions";
CREATE POLICY "aislamiento_academia" ON "submissions"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "teacher_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_assignments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "teacher_assignments";
CREATE POLICY "aislamiento_academia" ON "teacher_assignments"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "test_attempt_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_attempt_answers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "test_attempt_answers";
CREATE POLICY "aislamiento_academia" ON "test_attempt_answers"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "test_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_attempts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "test_attempts";
CREATE POLICY "aislamiento_academia" ON "test_attempts"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "test_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_definitions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "test_definitions";
CREATE POLICY "aislamiento_academia" ON "test_definitions"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "wall_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wall_comments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "wall_comments";
CREATE POLICY "aislamiento_academia" ON "wall_comments"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

ALTER TABLE "wall_posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wall_posts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aislamiento_academia" ON "wall_posts";
CREATE POLICY "aislamiento_academia" ON "wall_posts"
  USING (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  )
  WITH CHECK (
    "academyId" = current_setting('catedria.academy_id', true)
    OR coalesce(current_setting('catedria.academy_id', true), '') = ''
  );

