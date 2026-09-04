-- LA TERCERA BARRERA · NO SE PUEDE APUNTAR A OTRA ACADEMIA
--
-- GENERADO POR `npm run barrera:generar`. No editar a mano: se regenera
-- desde `src/lib/db/tenant-relations.ts`, que es donde está la lista.
--
-- Una fila de la academia A podía apuntar a una entidad de la B. La guardia
-- de aplicación no lo veía al crear —no hay registro al que apuntar— y
-- PostgreSQL tampoco: la fila que se escribe es legítima, y la integridad
-- referencial se verifica aparte, saltándose Row Level Security por diseño.
--
-- Va una función por relación, con la consulta escrita dentro en vez de una
-- función genérica que la componga al vuelo. Son 108 funciones en lugar de
-- una, y se hace así porque está medido: con la consulta dinámica, mil
-- inserciones pasaban de 32 ms a 110; con la consulta fija, PostgreSQL
-- guarda el plan y la diferencia se reduce mucho.

-- La versión con consulta dinámica tenía una sola función compartida. Se
-- quita en cascada: con ella se van sus disparadores, y justo debajo se
-- vuelven a crear todos. En una base nueva no existe y no hace nada.
DROP FUNCTION IF EXISTS comprobar_academia_de_relacion() CASCADE;

-- AIConversation.memberId → Membership
CREATE OR REPLACE FUNCTION "barrera_ai_conversations_memberId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."memberId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna ai_conversations.memberId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_ai_conversations_memberId" ON "ai_conversations";
CREATE TRIGGER "barrera_ai_conversations_memberId"
  BEFORE INSERT OR UPDATE OF "memberId", "academyId" ON "ai_conversations"
  FOR EACH ROW WHEN (NEW."memberId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_ai_conversations_memberId"();

-- AIMessage.conversationId → AIConversation
CREATE OR REPLACE FUNCTION "barrera_ai_messages_conversationId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "ai_conversations"
    WHERE id = NEW."conversationId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna ai_messages.conversationId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_ai_messages_conversationId" ON "ai_messages";
CREATE TRIGGER "barrera_ai_messages_conversationId"
  BEFORE INSERT OR UPDATE OF "conversationId", "academyId" ON "ai_messages"
  FOR EACH ROW WHEN (NEW."conversationId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_ai_messages_conversationId"();

-- AIUsage.memberId → Membership
CREATE OR REPLACE FUNCTION "barrera_ai_usages_memberId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."memberId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna ai_usages.memberId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_ai_usages_memberId" ON "ai_usages";
CREATE TRIGGER "barrera_ai_usages_memberId"
  BEFORE INSERT OR UPDATE OF "memberId", "academyId" ON "ai_usages"
  FOR EACH ROW WHEN (NEW."memberId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_ai_usages_memberId"();

-- Assignment.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_assignments_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna assignments.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_assignments_editionId" ON "assignments";
CREATE TRIGGER "barrera_assignments_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "assignments"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_assignments_editionId"();

-- Assignment.courseId → Course
CREATE OR REPLACE FUNCTION "barrera_assignments_courseId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "courses"
    WHERE id = NEW."courseId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna assignments.courseId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_assignments_courseId" ON "assignments";
CREATE TRIGGER "barrera_assignments_courseId"
  BEFORE INSERT OR UPDATE OF "courseId", "academyId" ON "assignments"
  FOR EACH ROW WHEN (NEW."courseId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_assignments_courseId"();

-- Assignment.groupId → Group
CREATE OR REPLACE FUNCTION "barrera_assignments_groupId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "groups"
    WHERE id = NEW."groupId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna assignments.groupId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_assignments_groupId" ON "assignments";
CREATE TRIGGER "barrera_assignments_groupId"
  BEFORE INSERT OR UPDATE OF "groupId", "academyId" ON "assignments"
  FOR EACH ROW WHEN (NEW."groupId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_assignments_groupId"();

-- Assignment.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_assignments_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna assignments.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_assignments_nodeId" ON "assignments";
CREATE TRIGGER "barrera_assignments_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "assignments"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_assignments_nodeId"();

-- Assignment.createdById → Membership
CREATE OR REPLACE FUNCTION "barrera_assignments_createdById"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."createdById";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna assignments.createdById apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_assignments_createdById" ON "assignments";
CREATE TRIGGER "barrera_assignments_createdById"
  BEFORE INSERT OR UPDATE OF "createdById", "academyId" ON "assignments"
  FOR EACH ROW WHEN (NEW."createdById" IS NOT NULL)
  EXECUTE FUNCTION "barrera_assignments_createdById"();

-- BillingProfile.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_billing_profiles_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna billing_profiles.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_billing_profiles_studentId" ON "billing_profiles";
CREATE TRIGGER "barrera_billing_profiles_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "billing_profiles"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_billing_profiles_studentId"();

-- ClassAttendance.classId → ClassSession
CREATE OR REPLACE FUNCTION "barrera_class_attendances_classId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "class_sessions"
    WHERE id = NEW."classId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna class_attendances.classId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_class_attendances_classId" ON "class_attendances";
CREATE TRIGGER "barrera_class_attendances_classId"
  BEFORE INSERT OR UPDATE OF "classId", "academyId" ON "class_attendances"
  FOR EACH ROW WHEN (NEW."classId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_class_attendances_classId"();

-- ClassAttendance.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_class_attendances_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna class_attendances.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_class_attendances_studentId" ON "class_attendances";
CREATE TRIGGER "barrera_class_attendances_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "class_attendances"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_class_attendances_studentId"();

-- ClassSession.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_class_sessions_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna class_sessions.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_class_sessions_editionId" ON "class_sessions";
CREATE TRIGGER "barrera_class_sessions_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "class_sessions"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_class_sessions_editionId"();

-- ClassSession.courseId → Course
CREATE OR REPLACE FUNCTION "barrera_class_sessions_courseId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "courses"
    WHERE id = NEW."courseId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna class_sessions.courseId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_class_sessions_courseId" ON "class_sessions";
CREATE TRIGGER "barrera_class_sessions_courseId"
  BEFORE INSERT OR UPDATE OF "courseId", "academyId" ON "class_sessions"
  FOR EACH ROW WHEN (NEW."courseId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_class_sessions_courseId"();

-- ClassSession.groupId → Group
CREATE OR REPLACE FUNCTION "barrera_class_sessions_groupId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "groups"
    WHERE id = NEW."groupId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna class_sessions.groupId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_class_sessions_groupId" ON "class_sessions";
CREATE TRIGGER "barrera_class_sessions_groupId"
  BEFORE INSERT OR UPDATE OF "groupId", "academyId" ON "class_sessions"
  FOR EACH ROW WHEN (NEW."groupId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_class_sessions_groupId"();

-- ClassSession.teacherId → Membership
CREATE OR REPLACE FUNCTION "barrera_class_sessions_teacherId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."teacherId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna class_sessions.teacherId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_class_sessions_teacherId" ON "class_sessions";
CREATE TRIGGER "barrera_class_sessions_teacherId"
  BEFORE INSERT OR UPDATE OF "teacherId", "academyId" ON "class_sessions"
  FOR EACH ROW WHEN (NEW."teacherId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_class_sessions_teacherId"();

-- ClassSession.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_class_sessions_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna class_sessions.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_class_sessions_nodeId" ON "class_sessions";
CREATE TRIGGER "barrera_class_sessions_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "class_sessions"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_class_sessions_nodeId"();

-- ContentLegislationLink.articleId → LegislationArticle
CREATE OR REPLACE FUNCTION "barrera_content_legislation_links_articleId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "legislation_articles"
    WHERE id = NEW."articleId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna content_legislation_links.articleId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_content_legislation_links_articleId" ON "content_legislation_links";
CREATE TRIGGER "barrera_content_legislation_links_articleId"
  BEFORE INSERT OR UPDATE OF "articleId", "academyId" ON "content_legislation_links"
  FOR EACH ROW WHEN (NEW."articleId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_content_legislation_links_articleId"();

-- ContentLegislationLink.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_content_legislation_links_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna content_legislation_links.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_content_legislation_links_nodeId" ON "content_legislation_links";
CREATE TRIGGER "barrera_content_legislation_links_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "content_legislation_links"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_content_legislation_links_nodeId"();

-- ContentLegislationLink.questionId → Question
CREATE OR REPLACE FUNCTION "barrera_content_legislation_links_questionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "questions"
    WHERE id = NEW."questionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna content_legislation_links.questionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_content_legislation_links_questionId" ON "content_legislation_links";
CREATE TRIGGER "barrera_content_legislation_links_questionId"
  BEFORE INSERT OR UPDATE OF "questionId", "academyId" ON "content_legislation_links"
  FOR EACH ROW WHEN (NEW."questionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_content_legislation_links_questionId"();

-- ContentNode.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_content_nodes_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna content_nodes.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_content_nodes_editionId" ON "content_nodes";
CREATE TRIGGER "barrera_content_nodes_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "content_nodes"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_content_nodes_editionId"();

-- ContentNode.parentId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_content_nodes_parentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."parentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna content_nodes.parentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_content_nodes_parentId" ON "content_nodes";
CREATE TRIGGER "barrera_content_nodes_parentId"
  BEFORE INSERT OR UPDATE OF "parentId", "academyId" ON "content_nodes"
  FOR EACH ROW WHEN (NEW."parentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_content_nodes_parentId"();

-- ContentRelease.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_content_releases_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna content_releases.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_content_releases_nodeId" ON "content_releases";
CREATE TRIGGER "barrera_content_releases_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "content_releases"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_content_releases_nodeId"();

-- ContentRelease.groupId → Group
CREATE OR REPLACE FUNCTION "barrera_content_releases_groupId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "groups"
    WHERE id = NEW."groupId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna content_releases.groupId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_content_releases_groupId" ON "content_releases";
CREATE TRIGGER "barrera_content_releases_groupId"
  BEFORE INSERT OR UPDATE OF "groupId", "academyId" ON "content_releases"
  FOR EACH ROW WHEN (NEW."groupId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_content_releases_groupId"();

-- Course.oppositionEditionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_courses_oppositionEditionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."oppositionEditionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna courses.oppositionEditionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_courses_oppositionEditionId" ON "courses";
CREATE TRIGGER "barrera_courses_oppositionEditionId"
  BEFORE INSERT OR UPDATE OF "oppositionEditionId", "academyId" ON "courses"
  FOR EACH ROW WHEN (NEW."oppositionEditionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_courses_oppositionEditionId"();

-- DocumentChunk.sourceId → KnowledgeSource
CREATE OR REPLACE FUNCTION "barrera_document_chunks_sourceId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "knowledge_sources"
    WHERE id = NEW."sourceId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna document_chunks.sourceId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_document_chunks_sourceId" ON "document_chunks";
CREATE TRIGGER "barrera_document_chunks_sourceId"
  BEFORE INSERT OR UPDATE OF "sourceId", "academyId" ON "document_chunks"
  FOR EACH ROW WHEN (NEW."sourceId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_document_chunks_sourceId"();

-- DocumentChunk.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_document_chunks_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna document_chunks.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_document_chunks_nodeId" ON "document_chunks";
CREATE TRIGGER "barrera_document_chunks_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "document_chunks"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_document_chunks_nodeId"();

-- Enrollment.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_enrollments_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna enrollments.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_enrollments_studentId" ON "enrollments";
CREATE TRIGGER "barrera_enrollments_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "enrollments"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_enrollments_studentId"();

-- Enrollment.courseId → Course
CREATE OR REPLACE FUNCTION "barrera_enrollments_courseId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "courses"
    WHERE id = NEW."courseId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna enrollments.courseId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_enrollments_courseId" ON "enrollments";
CREATE TRIGGER "barrera_enrollments_courseId"
  BEFORE INSERT OR UPDATE OF "courseId", "academyId" ON "enrollments"
  FOR EACH ROW WHEN (NEW."courseId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_enrollments_courseId"();

-- Enrollment.groupId → Group
CREATE OR REPLACE FUNCTION "barrera_enrollments_groupId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "groups"
    WHERE id = NEW."groupId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna enrollments.groupId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_enrollments_groupId" ON "enrollments";
CREATE TRIGGER "barrera_enrollments_groupId"
  BEFORE INSERT OR UPDATE OF "groupId", "academyId" ON "enrollments"
  FOR EACH ROW WHEN (NEW."groupId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_enrollments_groupId"();

-- Entitlement.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_entitlements_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna entitlements.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_entitlements_studentId" ON "entitlements";
CREATE TRIGGER "barrera_entitlements_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "entitlements"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_entitlements_studentId"();

-- Entitlement.productId → Product
CREATE OR REPLACE FUNCTION "barrera_entitlements_productId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "products"
    WHERE id = NEW."productId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna entitlements.productId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_entitlements_productId" ON "entitlements";
CREATE TRIGGER "barrera_entitlements_productId"
  BEFORE INSERT OR UPDATE OF "productId", "academyId" ON "entitlements"
  FOR EACH ROW WHEN (NEW."productId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_entitlements_productId"();

-- Entitlement.enrollmentId → Enrollment
CREATE OR REPLACE FUNCTION "barrera_entitlements_enrollmentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "enrollments"
    WHERE id = NEW."enrollmentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna entitlements.enrollmentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_entitlements_enrollmentId" ON "entitlements";
CREATE TRIGGER "barrera_entitlements_enrollmentId"
  BEFORE INSERT OR UPDATE OF "enrollmentId", "academyId" ON "entitlements"
  FOR EACH ROW WHEN (NEW."enrollmentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_entitlements_enrollmentId"();

-- ExamBlueprint.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_exam_blueprints_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna exam_blueprints.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_exam_blueprints_editionId" ON "exam_blueprints";
CREATE TRIGGER "barrera_exam_blueprints_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "exam_blueprints"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_exam_blueprints_editionId"();

-- Group.courseId → Course
CREATE OR REPLACE FUNCTION "barrera_groups_courseId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "courses"
    WHERE id = NEW."courseId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna groups.courseId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_groups_courseId" ON "groups";
CREATE TRIGGER "barrera_groups_courseId"
  BEFORE INSERT OR UPDATE OF "courseId", "academyId" ON "groups"
  FOR EACH ROW WHEN (NEW."courseId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_groups_courseId"();

-- ImportRow.jobId → ImportJob
CREATE OR REPLACE FUNCTION "barrera_import_rows_jobId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "import_jobs"
    WHERE id = NEW."jobId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna import_rows.jobId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_import_rows_jobId" ON "import_rows";
CREATE TRIGGER "barrera_import_rows_jobId"
  BEFORE INSERT OR UPDATE OF "jobId", "academyId" ON "import_rows"
  FOR EACH ROW WHEN (NEW."jobId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_import_rows_jobId"();

-- Invoice.seriesId → InvoiceSeries
CREATE OR REPLACE FUNCTION "barrera_invoices_seriesId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "invoice_series"
    WHERE id = NEW."seriesId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna invoices.seriesId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_invoices_seriesId" ON "invoices";
CREATE TRIGGER "barrera_invoices_seriesId"
  BEFORE INSERT OR UPDATE OF "seriesId", "academyId" ON "invoices"
  FOR EACH ROW WHEN (NEW."seriesId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_invoices_seriesId"();

-- Invoice.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_invoices_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna invoices.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_invoices_studentId" ON "invoices";
CREATE TRIGGER "barrera_invoices_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "invoices"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_invoices_studentId"();

-- Invoice.rectifiesId → Invoice
CREATE OR REPLACE FUNCTION "barrera_invoices_rectifiesId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "invoices"
    WHERE id = NEW."rectifiesId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna invoices.rectifiesId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_invoices_rectifiesId" ON "invoices";
CREATE TRIGGER "barrera_invoices_rectifiesId"
  BEFORE INSERT OR UPDATE OF "rectifiesId", "academyId" ON "invoices"
  FOR EACH ROW WHEN (NEW."rectifiesId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_invoices_rectifiesId"();

-- Invoice.paymentId → Payment
CREATE OR REPLACE FUNCTION "barrera_invoices_paymentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "payments"
    WHERE id = NEW."paymentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna invoices.paymentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_invoices_paymentId" ON "invoices";
CREATE TRIGGER "barrera_invoices_paymentId"
  BEFORE INSERT OR UPDATE OF "paymentId", "academyId" ON "invoices"
  FOR EACH ROW WHEN (NEW."paymentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_invoices_paymentId"();

-- InvoiceLine.invoiceId → Invoice
CREATE OR REPLACE FUNCTION "barrera_invoice_lines_invoiceId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "invoices"
    WHERE id = NEW."invoiceId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna invoice_lines.invoiceId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_invoice_lines_invoiceId" ON "invoice_lines";
CREATE TRIGGER "barrera_invoice_lines_invoiceId"
  BEFORE INSERT OR UPDATE OF "invoiceId", "academyId" ON "invoice_lines"
  FOR EACH ROW WHEN (NEW."invoiceId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_invoice_lines_invoiceId"();

-- KnowledgeSource.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_knowledge_sources_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna knowledge_sources.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_knowledge_sources_nodeId" ON "knowledge_sources";
CREATE TRIGGER "barrera_knowledge_sources_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "knowledge_sources"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_knowledge_sources_nodeId"();

-- KnowledgeSource.fileId → StoredFile
CREATE OR REPLACE FUNCTION "barrera_knowledge_sources_fileId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "stored_files"
    WHERE id = NEW."fileId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna knowledge_sources.fileId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_knowledge_sources_fileId" ON "knowledge_sources";
CREATE TRIGGER "barrera_knowledge_sources_fileId"
  BEFORE INSERT OR UPDATE OF "fileId", "academyId" ON "knowledge_sources"
  FOR EACH ROW WHEN (NEW."fileId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_knowledge_sources_fileId"();

-- LegislationArticle.legislationId → Legislation
CREATE OR REPLACE FUNCTION "barrera_legislation_articles_legislationId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "legislations"
    WHERE id = NEW."legislationId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna legislation_articles.legislationId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_legislation_articles_legislationId" ON "legislation_articles";
CREATE TRIGGER "barrera_legislation_articles_legislationId"
  BEFORE INSERT OR UPDATE OF "legislationId", "academyId" ON "legislation_articles"
  FOR EACH ROW WHEN (NEW."legislationId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_legislation_articles_legislationId"();

-- LegislationArticle.versionId → LegislationVersion
CREATE OR REPLACE FUNCTION "barrera_legislation_articles_versionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "legislation_versions"
    WHERE id = NEW."versionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna legislation_articles.versionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_legislation_articles_versionId" ON "legislation_articles";
CREATE TRIGGER "barrera_legislation_articles_versionId"
  BEFORE INSERT OR UPDATE OF "versionId", "academyId" ON "legislation_articles"
  FOR EACH ROW WHEN (NEW."versionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_legislation_articles_versionId"();

-- LegislationChangeAlert.legislationId → Legislation
CREATE OR REPLACE FUNCTION "barrera_legislation_change_alerts_legislationId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "legislations"
    WHERE id = NEW."legislationId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna legislation_change_alerts.legislationId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_legislation_change_alerts_legislationId" ON "legislation_change_alerts";
CREATE TRIGGER "barrera_legislation_change_alerts_legislationId"
  BEFORE INSERT OR UPDATE OF "legislationId", "academyId" ON "legislation_change_alerts"
  FOR EACH ROW WHEN (NEW."legislationId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_legislation_change_alerts_legislationId"();

-- LegislationChangeAlert.versionId → LegislationVersion
CREATE OR REPLACE FUNCTION "barrera_legislation_change_alerts_versionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "legislation_versions"
    WHERE id = NEW."versionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna legislation_change_alerts.versionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_legislation_change_alerts_versionId" ON "legislation_change_alerts";
CREATE TRIGGER "barrera_legislation_change_alerts_versionId"
  BEFORE INSERT OR UPDATE OF "versionId", "academyId" ON "legislation_change_alerts"
  FOR EACH ROW WHEN (NEW."versionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_legislation_change_alerts_versionId"();

-- LegislationChangeAlert.articleId → LegislationArticle
CREATE OR REPLACE FUNCTION "barrera_legislation_change_alerts_articleId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "legislation_articles"
    WHERE id = NEW."articleId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna legislation_change_alerts.articleId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_legislation_change_alerts_articleId" ON "legislation_change_alerts";
CREATE TRIGGER "barrera_legislation_change_alerts_articleId"
  BEFORE INSERT OR UPDATE OF "articleId", "academyId" ON "legislation_change_alerts"
  FOR EACH ROW WHEN (NEW."articleId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_legislation_change_alerts_articleId"();

-- LegislationVersion.legislationId → Legislation
CREATE OR REPLACE FUNCTION "barrera_legislation_versions_legislationId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "legislations"
    WHERE id = NEW."legislationId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna legislation_versions.legislationId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_legislation_versions_legislationId" ON "legislation_versions";
CREATE TRIGGER "barrera_legislation_versions_legislationId"
  BEFORE INSERT OR UPDATE OF "legislationId", "academyId" ON "legislation_versions"
  FOR EACH ROW WHEN (NEW."legislationId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_legislation_versions_legislationId"();

-- LiveRoom.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_live_rooms_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna live_rooms.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_live_rooms_editionId" ON "live_rooms";
CREATE TRIGGER "barrera_live_rooms_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "live_rooms"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_live_rooms_editionId"();

-- LiveRoom.courseId → Course
CREATE OR REPLACE FUNCTION "barrera_live_rooms_courseId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "courses"
    WHERE id = NEW."courseId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna live_rooms.courseId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_live_rooms_courseId" ON "live_rooms";
CREATE TRIGGER "barrera_live_rooms_courseId"
  BEFORE INSERT OR UPDATE OF "courseId", "academyId" ON "live_rooms"
  FOR EACH ROW WHEN (NEW."courseId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_live_rooms_courseId"();

-- LiveRoom.groupId → Group
CREATE OR REPLACE FUNCTION "barrera_live_rooms_groupId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "groups"
    WHERE id = NEW."groupId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna live_rooms.groupId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_live_rooms_groupId" ON "live_rooms";
CREATE TRIGGER "barrera_live_rooms_groupId"
  BEFORE INSERT OR UPDATE OF "groupId", "academyId" ON "live_rooms"
  FOR EACH ROW WHEN (NEW."groupId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_live_rooms_groupId"();

-- Message.threadId → MessageThread
CREATE OR REPLACE FUNCTION "barrera_messages_threadId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "message_threads"
    WHERE id = NEW."threadId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna messages.threadId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_messages_threadId" ON "messages";
CREATE TRIGGER "barrera_messages_threadId"
  BEFORE INSERT OR UPDATE OF "threadId", "academyId" ON "messages"
  FOR EACH ROW WHEN (NEW."threadId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_messages_threadId"();

-- Message.authorId → Membership
CREATE OR REPLACE FUNCTION "barrera_messages_authorId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."authorId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna messages.authorId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_messages_authorId" ON "messages";
CREATE TRIGGER "barrera_messages_authorId"
  BEFORE INSERT OR UPDATE OF "authorId", "academyId" ON "messages"
  FOR EACH ROW WHEN (NEW."authorId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_messages_authorId"();

-- MessageThread.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_message_threads_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna message_threads.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_message_threads_studentId" ON "message_threads";
CREATE TRIGGER "barrera_message_threads_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "message_threads"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_message_threads_studentId"();

-- MessageThread.teacherId → Membership
CREATE OR REPLACE FUNCTION "barrera_message_threads_teacherId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."teacherId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna message_threads.teacherId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_message_threads_teacherId" ON "message_threads";
CREATE TRIGGER "barrera_message_threads_teacherId"
  BEFORE INSERT OR UPDATE OF "teacherId", "academyId" ON "message_threads"
  FOR EACH ROW WHEN (NEW."teacherId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_message_threads_teacherId"();

-- Notification.recipientId → Membership
CREATE OR REPLACE FUNCTION "barrera_notifications_recipientId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."recipientId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna notifications.recipientId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_notifications_recipientId" ON "notifications";
CREATE TRIGGER "barrera_notifications_recipientId"
  BEFORE INSERT OR UPDATE OF "recipientId", "academyId" ON "notifications"
  FOR EACH ROW WHEN (NEW."recipientId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_notifications_recipientId"();

-- OfficialCall.watchId → OppositionWatch
CREATE OR REPLACE FUNCTION "barrera_official_calls_watchId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_watches"
    WHERE id = NEW."watchId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna official_calls.watchId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_official_calls_watchId" ON "official_calls";
CREATE TRIGGER "barrera_official_calls_watchId"
  BEFORE INSERT OR UPDATE OF "watchId", "academyId" ON "official_calls"
  FOR EACH ROW WHEN (NEW."watchId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_official_calls_watchId"();

-- Opposition.typeId → OppositionType
CREATE OR REPLACE FUNCTION "barrera_oppositions_typeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_types"
    WHERE id = NEW."typeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna oppositions.typeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_oppositions_typeId" ON "oppositions";
CREATE TRIGGER "barrera_oppositions_typeId"
  BEFORE INSERT OR UPDATE OF "typeId", "academyId" ON "oppositions"
  FOR EACH ROW WHEN (NEW."typeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_oppositions_typeId"();

-- OppositionEdition.oppositionId → Opposition
CREATE OR REPLACE FUNCTION "barrera_opposition_editions_oppositionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "oppositions"
    WHERE id = NEW."oppositionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna opposition_editions.oppositionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_opposition_editions_oppositionId" ON "opposition_editions";
CREATE TRIGGER "barrera_opposition_editions_oppositionId"
  BEFORE INSERT OR UPDATE OF "oppositionId", "academyId" ON "opposition_editions"
  FOR EACH ROW WHEN (NEW."oppositionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_opposition_editions_oppositionId"();

-- OppositionEdition.clonedFromId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_opposition_editions_clonedFromId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."clonedFromId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna opposition_editions.clonedFromId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_opposition_editions_clonedFromId" ON "opposition_editions";
CREATE TRIGGER "barrera_opposition_editions_clonedFromId"
  BEFORE INSERT OR UPDATE OF "clonedFromId", "academyId" ON "opposition_editions"
  FOR EACH ROW WHEN (NEW."clonedFromId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_opposition_editions_clonedFromId"();

-- OppositionWatch.oppositionId → Opposition
CREATE OR REPLACE FUNCTION "barrera_opposition_watches_oppositionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "oppositions"
    WHERE id = NEW."oppositionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna opposition_watches.oppositionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_opposition_watches_oppositionId" ON "opposition_watches";
CREATE TRIGGER "barrera_opposition_watches_oppositionId"
  BEFORE INSERT OR UPDATE OF "oppositionId", "academyId" ON "opposition_watches"
  FOR EACH ROW WHEN (NEW."oppositionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_opposition_watches_oppositionId"();

-- Payment.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_payments_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna payments.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_payments_studentId" ON "payments";
CREATE TRIGGER "barrera_payments_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "payments"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_payments_studentId"();

-- Payment.enrollmentId → Enrollment
CREATE OR REPLACE FUNCTION "barrera_payments_enrollmentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "enrollments"
    WHERE id = NEW."enrollmentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna payments.enrollmentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_payments_enrollmentId" ON "payments";
CREATE TRIGGER "barrera_payments_enrollmentId"
  BEFORE INSERT OR UPDATE OF "enrollmentId", "academyId" ON "payments"
  FOR EACH ROW WHEN (NEW."enrollmentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_payments_enrollmentId"();

-- Payment.productId → Product
CREATE OR REPLACE FUNCTION "barrera_payments_productId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "products"
    WHERE id = NEW."productId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna payments.productId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_payments_productId" ON "payments";
CREATE TRIGGER "barrera_payments_productId"
  BEFORE INSERT OR UPDATE OF "productId", "academyId" ON "payments"
  FOR EACH ROW WHEN (NEW."productId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_payments_productId"();

-- Payment.recurringChargeId → RecurringCharge
CREATE OR REPLACE FUNCTION "barrera_payments_recurringChargeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "recurring_charges"
    WHERE id = NEW."recurringChargeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna payments.recurringChargeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_payments_recurringChargeId" ON "payments";
CREATE TRIGGER "barrera_payments_recurringChargeId"
  BEFORE INSERT OR UPDATE OF "recurringChargeId", "academyId" ON "payments"
  FOR EACH ROW WHEN (NEW."recurringChargeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_payments_recurringChargeId"();

-- Payment.directDebitRunId → DirectDebitRun
CREATE OR REPLACE FUNCTION "barrera_payments_directDebitRunId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "direct_debit_runs"
    WHERE id = NEW."directDebitRunId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna payments.directDebitRunId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_payments_directDebitRunId" ON "payments";
CREATE TRIGGER "barrera_payments_directDebitRunId"
  BEFORE INSERT OR UPDATE OF "directDebitRunId", "academyId" ON "payments"
  FOR EACH ROW WHEN (NEW."directDebitRunId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_payments_directDebitRunId"();

-- Product.oppositionId → Opposition
CREATE OR REPLACE FUNCTION "barrera_products_oppositionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "oppositions"
    WHERE id = NEW."oppositionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna products.oppositionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_products_oppositionId" ON "products";
CREATE TRIGGER "barrera_products_oppositionId"
  BEFORE INSERT OR UPDATE OF "oppositionId", "academyId" ON "products"
  FOR EACH ROW WHEN (NEW."oppositionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_products_oppositionId"();

-- Product.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_products_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna products.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_products_editionId" ON "products";
CREATE TRIGGER "barrera_products_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "products"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_products_editionId"();

-- Product.courseId → Course
CREATE OR REPLACE FUNCTION "barrera_products_courseId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "courses"
    WHERE id = NEW."courseId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna products.courseId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_products_courseId" ON "products";
CREATE TRIGGER "barrera_products_courseId"
  BEFORE INSERT OR UPDATE OF "courseId", "academyId" ON "products"
  FOR EACH ROW WHEN (NEW."courseId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_products_courseId"();

-- ProductGrant.productId → Product
CREATE OR REPLACE FUNCTION "barrera_product_grants_productId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "products"
    WHERE id = NEW."productId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna product_grants.productId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_product_grants_productId" ON "product_grants";
CREATE TRIGGER "barrera_product_grants_productId"
  BEFORE INSERT OR UPDATE OF "productId", "academyId" ON "product_grants"
  FOR EACH ROW WHEN (NEW."productId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_product_grants_productId"();

-- ProductGrant.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_product_grants_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna product_grants.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_product_grants_nodeId" ON "product_grants";
CREATE TRIGGER "barrera_product_grants_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "product_grants"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_product_grants_nodeId"();

-- Question.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_questions_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna questions.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_questions_editionId" ON "questions";
CREATE TRIGGER "barrera_questions_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "questions"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_questions_editionId"();

-- Question.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_questions_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna questions.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_questions_nodeId" ON "questions";
CREATE TRIGGER "barrera_questions_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "questions"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_questions_nodeId"();

-- Question.authorId → Membership
CREATE OR REPLACE FUNCTION "barrera_questions_authorId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."authorId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna questions.authorId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_questions_authorId" ON "questions";
CREATE TRIGGER "barrera_questions_authorId"
  BEFORE INSERT OR UPDATE OF "authorId", "academyId" ON "questions"
  FOR EACH ROW WHEN (NEW."authorId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_questions_authorId"();

-- Question.reviewerId → Membership
CREATE OR REPLACE FUNCTION "barrera_questions_reviewerId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."reviewerId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna questions.reviewerId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_questions_reviewerId" ON "questions";
CREATE TRIGGER "barrera_questions_reviewerId"
  BEFORE INSERT OR UPDATE OF "reviewerId", "academyId" ON "questions"
  FOR EACH ROW WHEN (NEW."reviewerId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_questions_reviewerId"();

-- QuestionOption.questionId → Question
CREATE OR REPLACE FUNCTION "barrera_question_options_questionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "questions"
    WHERE id = NEW."questionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna question_options.questionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_question_options_questionId" ON "question_options";
CREATE TRIGGER "barrera_question_options_questionId"
  BEFORE INSERT OR UPDATE OF "questionId", "academyId" ON "question_options"
  FOR EACH ROW WHEN (NEW."questionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_question_options_questionId"();

-- RecurringCharge.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_recurring_charges_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna recurring_charges.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_recurring_charges_studentId" ON "recurring_charges";
CREATE TRIGGER "barrera_recurring_charges_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "recurring_charges"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_recurring_charges_studentId"();

-- RecurringCharge.billingProfileId → BillingProfile
CREATE OR REPLACE FUNCTION "barrera_recurring_charges_billingProfileId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "billing_profiles"
    WHERE id = NEW."billingProfileId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna recurring_charges.billingProfileId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_recurring_charges_billingProfileId" ON "recurring_charges";
CREATE TRIGGER "barrera_recurring_charges_billingProfileId"
  BEFORE INSERT OR UPDATE OF "billingProfileId", "academyId" ON "recurring_charges"
  FOR EACH ROW WHEN (NEW."billingProfileId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_recurring_charges_billingProfileId"();

-- RecurringCharge.enrollmentId → Enrollment
CREATE OR REPLACE FUNCTION "barrera_recurring_charges_enrollmentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "enrollments"
    WHERE id = NEW."enrollmentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna recurring_charges.enrollmentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_recurring_charges_enrollmentId" ON "recurring_charges";
CREATE TRIGGER "barrera_recurring_charges_enrollmentId"
  BEFORE INSERT OR UPDATE OF "enrollmentId", "academyId" ON "recurring_charges"
  FOR EACH ROW WHEN (NEW."enrollmentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_recurring_charges_enrollmentId"();

-- StudentContentProgress.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_student_content_progress_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna student_content_progress.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_student_content_progress_studentId" ON "student_content_progress";
CREATE TRIGGER "barrera_student_content_progress_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "student_content_progress"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_student_content_progress_studentId"();

-- StudentContentProgress.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_student_content_progress_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna student_content_progress.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_student_content_progress_nodeId" ON "student_content_progress";
CREATE TRIGGER "barrera_student_content_progress_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "student_content_progress"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_student_content_progress_nodeId"();

-- StudentQuestionStat.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_student_question_stats_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna student_question_stats.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_student_question_stats_studentId" ON "student_question_stats";
CREATE TRIGGER "barrera_student_question_stats_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "student_question_stats"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_student_question_stats_studentId"();

-- StudentQuestionStat.questionId → Question
CREATE OR REPLACE FUNCTION "barrera_student_question_stats_questionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "questions"
    WHERE id = NEW."questionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna student_question_stats.questionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_student_question_stats_questionId" ON "student_question_stats";
CREATE TRIGGER "barrera_student_question_stats_questionId"
  BEFORE INSERT OR UPDATE OF "questionId", "academyId" ON "student_question_stats"
  FOR EACH ROW WHEN (NEW."questionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_student_question_stats_questionId"();

-- Submission.assignmentId → Assignment
CREATE OR REPLACE FUNCTION "barrera_submissions_assignmentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "assignments"
    WHERE id = NEW."assignmentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna submissions.assignmentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_submissions_assignmentId" ON "submissions";
CREATE TRIGGER "barrera_submissions_assignmentId"
  BEFORE INSERT OR UPDATE OF "assignmentId", "academyId" ON "submissions"
  FOR EACH ROW WHEN (NEW."assignmentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_submissions_assignmentId"();

-- Submission.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_submissions_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna submissions.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_submissions_studentId" ON "submissions";
CREATE TRIGGER "barrera_submissions_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "submissions"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_submissions_studentId"();

-- Submission.gradedById → Membership
CREATE OR REPLACE FUNCTION "barrera_submissions_gradedById"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."gradedById";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna submissions.gradedById apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_submissions_gradedById" ON "submissions";
CREATE TRIGGER "barrera_submissions_gradedById"
  BEFORE INSERT OR UPDATE OF "gradedById", "academyId" ON "submissions"
  FOR EACH ROW WHEN (NEW."gradedById" IS NOT NULL)
  EXECUTE FUNCTION "barrera_submissions_gradedById"();

-- SubmissionFile.submissionId → Submission
CREATE OR REPLACE FUNCTION "barrera_submission_files_submissionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "submissions"
    WHERE id = NEW."submissionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna submission_files.submissionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_submission_files_submissionId" ON "submission_files";
CREATE TRIGGER "barrera_submission_files_submissionId"
  BEFORE INSERT OR UPDATE OF "submissionId", "academyId" ON "submission_files"
  FOR EACH ROW WHEN (NEW."submissionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_submission_files_submissionId"();

-- SubmissionFile.fileId → StoredFile
CREATE OR REPLACE FUNCTION "barrera_submission_files_fileId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "stored_files"
    WHERE id = NEW."fileId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna submission_files.fileId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_submission_files_fileId" ON "submission_files";
CREATE TRIGGER "barrera_submission_files_fileId"
  BEFORE INSERT OR UPDATE OF "fileId", "academyId" ON "submission_files"
  FOR EACH ROW WHEN (NEW."fileId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_submission_files_fileId"();

-- TeacherAssignment.teacherId → Membership
CREATE OR REPLACE FUNCTION "barrera_teacher_assignments_teacherId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."teacherId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna teacher_assignments.teacherId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_teacher_assignments_teacherId" ON "teacher_assignments";
CREATE TRIGGER "barrera_teacher_assignments_teacherId"
  BEFORE INSERT OR UPDATE OF "teacherId", "academyId" ON "teacher_assignments"
  FOR EACH ROW WHEN (NEW."teacherId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_teacher_assignments_teacherId"();

-- TeacherAssignment.oppositionId → Opposition
CREATE OR REPLACE FUNCTION "barrera_teacher_assignments_oppositionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "oppositions"
    WHERE id = NEW."oppositionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna teacher_assignments.oppositionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_teacher_assignments_oppositionId" ON "teacher_assignments";
CREATE TRIGGER "barrera_teacher_assignments_oppositionId"
  BEFORE INSERT OR UPDATE OF "oppositionId", "academyId" ON "teacher_assignments"
  FOR EACH ROW WHEN (NEW."oppositionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_teacher_assignments_oppositionId"();

-- TeacherAssignment.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_teacher_assignments_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna teacher_assignments.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_teacher_assignments_editionId" ON "teacher_assignments";
CREATE TRIGGER "barrera_teacher_assignments_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "teacher_assignments"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_teacher_assignments_editionId"();

-- TeacherAssignment.courseId → Course
CREATE OR REPLACE FUNCTION "barrera_teacher_assignments_courseId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "courses"
    WHERE id = NEW."courseId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna teacher_assignments.courseId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_teacher_assignments_courseId" ON "teacher_assignments";
CREATE TRIGGER "barrera_teacher_assignments_courseId"
  BEFORE INSERT OR UPDATE OF "courseId", "academyId" ON "teacher_assignments"
  FOR EACH ROW WHEN (NEW."courseId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_teacher_assignments_courseId"();

-- TeacherAssignment.groupId → Group
CREATE OR REPLACE FUNCTION "barrera_teacher_assignments_groupId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "groups"
    WHERE id = NEW."groupId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna teacher_assignments.groupId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_teacher_assignments_groupId" ON "teacher_assignments";
CREATE TRIGGER "barrera_teacher_assignments_groupId"
  BEFORE INSERT OR UPDATE OF "groupId", "academyId" ON "teacher_assignments"
  FOR EACH ROW WHEN (NEW."groupId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_teacher_assignments_groupId"();

-- TestAttempt.studentId → Membership
CREATE OR REPLACE FUNCTION "barrera_test_attempts_studentId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."studentId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna test_attempts.studentId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_test_attempts_studentId" ON "test_attempts";
CREATE TRIGGER "barrera_test_attempts_studentId"
  BEFORE INSERT OR UPDATE OF "studentId", "academyId" ON "test_attempts"
  FOR EACH ROW WHEN (NEW."studentId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_test_attempts_studentId"();

-- TestAttempt.testDefinitionId → TestDefinition
CREATE OR REPLACE FUNCTION "barrera_test_attempts_testDefinitionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "test_definitions"
    WHERE id = NEW."testDefinitionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna test_attempts.testDefinitionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_test_attempts_testDefinitionId" ON "test_attempts";
CREATE TRIGGER "barrera_test_attempts_testDefinitionId"
  BEFORE INSERT OR UPDATE OF "testDefinitionId", "academyId" ON "test_attempts"
  FOR EACH ROW WHEN (NEW."testDefinitionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_test_attempts_testDefinitionId"();

-- TestAttemptAnswer.attemptId → TestAttempt
CREATE OR REPLACE FUNCTION "barrera_test_attempt_answers_attemptId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "test_attempts"
    WHERE id = NEW."attemptId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna test_attempt_answers.attemptId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_test_attempt_answers_attemptId" ON "test_attempt_answers";
CREATE TRIGGER "barrera_test_attempt_answers_attemptId"
  BEFORE INSERT OR UPDATE OF "attemptId", "academyId" ON "test_attempt_answers"
  FOR EACH ROW WHEN (NEW."attemptId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_test_attempt_answers_attemptId"();

-- TestAttemptAnswer.questionId → Question
CREATE OR REPLACE FUNCTION "barrera_test_attempt_answers_questionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "questions"
    WHERE id = NEW."questionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna test_attempt_answers.questionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_test_attempt_answers_questionId" ON "test_attempt_answers";
CREATE TRIGGER "barrera_test_attempt_answers_questionId"
  BEFORE INSERT OR UPDATE OF "questionId", "academyId" ON "test_attempt_answers"
  FOR EACH ROW WHEN (NEW."questionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_test_attempt_answers_questionId"();

-- TestAttemptAnswer.selectedOptionId → QuestionOption
CREATE OR REPLACE FUNCTION "barrera_test_attempt_answers_selectedOptionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "question_options"
    WHERE id = NEW."selectedOptionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna test_attempt_answers.selectedOptionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_test_attempt_answers_selectedOptionId" ON "test_attempt_answers";
CREATE TRIGGER "barrera_test_attempt_answers_selectedOptionId"
  BEFORE INSERT OR UPDATE OF "selectedOptionId", "academyId" ON "test_attempt_answers"
  FOR EACH ROW WHEN (NEW."selectedOptionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_test_attempt_answers_selectedOptionId"();

-- TestDefinition.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_test_definitions_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna test_definitions.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_test_definitions_editionId" ON "test_definitions";
CREATE TRIGGER "barrera_test_definitions_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "test_definitions"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_test_definitions_editionId"();

-- TestDefinition.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_test_definitions_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna test_definitions.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_test_definitions_nodeId" ON "test_definitions";
CREATE TRIGGER "barrera_test_definitions_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "test_definitions"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_test_definitions_nodeId"();

-- TestDefinition.blueprintId → ExamBlueprint
CREATE OR REPLACE FUNCTION "barrera_test_definitions_blueprintId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "exam_blueprints"
    WHERE id = NEW."blueprintId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna test_definitions.blueprintId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_test_definitions_blueprintId" ON "test_definitions";
CREATE TRIGGER "barrera_test_definitions_blueprintId"
  BEFORE INSERT OR UPDATE OF "blueprintId", "academyId" ON "test_definitions"
  FOR EACH ROW WHEN (NEW."blueprintId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_test_definitions_blueprintId"();

-- WallComment.postId → WallPost
CREATE OR REPLACE FUNCTION "barrera_wall_comments_postId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "wall_posts"
    WHERE id = NEW."postId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna wall_comments.postId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_wall_comments_postId" ON "wall_comments";
CREATE TRIGGER "barrera_wall_comments_postId"
  BEFORE INSERT OR UPDATE OF "postId", "academyId" ON "wall_comments"
  FOR EACH ROW WHEN (NEW."postId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_wall_comments_postId"();

-- WallComment.authorId → Membership
CREATE OR REPLACE FUNCTION "barrera_wall_comments_authorId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."authorId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna wall_comments.authorId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_wall_comments_authorId" ON "wall_comments";
CREATE TRIGGER "barrera_wall_comments_authorId"
  BEFORE INSERT OR UPDATE OF "authorId", "academyId" ON "wall_comments"
  FOR EACH ROW WHEN (NEW."authorId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_wall_comments_authorId"();

-- WallPost.authorId → Membership
CREATE OR REPLACE FUNCTION "barrera_wall_posts_authorId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "memberships"
    WHERE id = NEW."authorId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna wall_posts.authorId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_wall_posts_authorId" ON "wall_posts";
CREATE TRIGGER "barrera_wall_posts_authorId"
  BEFORE INSERT OR UPDATE OF "authorId", "academyId" ON "wall_posts"
  FOR EACH ROW WHEN (NEW."authorId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_wall_posts_authorId"();

-- WallPost.editionId → OppositionEdition
CREATE OR REPLACE FUNCTION "barrera_wall_posts_editionId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "opposition_editions"
    WHERE id = NEW."editionId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna wall_posts.editionId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_wall_posts_editionId" ON "wall_posts";
CREATE TRIGGER "barrera_wall_posts_editionId"
  BEFORE INSERT OR UPDATE OF "editionId", "academyId" ON "wall_posts"
  FOR EACH ROW WHEN (NEW."editionId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_wall_posts_editionId"();

-- WallPost.courseId → Course
CREATE OR REPLACE FUNCTION "barrera_wall_posts_courseId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "courses"
    WHERE id = NEW."courseId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna wall_posts.courseId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_wall_posts_courseId" ON "wall_posts";
CREATE TRIGGER "barrera_wall_posts_courseId"
  BEFORE INSERT OR UPDATE OF "courseId", "academyId" ON "wall_posts"
  FOR EACH ROW WHEN (NEW."courseId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_wall_posts_courseId"();

-- WallPost.groupId → Group
CREATE OR REPLACE FUNCTION "barrera_wall_posts_groupId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "groups"
    WHERE id = NEW."groupId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna wall_posts.groupId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_wall_posts_groupId" ON "wall_posts";
CREATE TRIGGER "barrera_wall_posts_groupId"
  BEFORE INSERT OR UPDATE OF "groupId", "academyId" ON "wall_posts"
  FOR EACH ROW WHEN (NEW."groupId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_wall_posts_groupId"();

-- WallPost.nodeId → ContentNode
CREATE OR REPLACE FUNCTION "barrera_wall_posts_nodeId"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_academia text;
BEGIN
  SELECT "academyId" INTO v_academia FROM "content_nodes"
    WHERE id = NEW."nodeId";

  -- Si no aparece, o aparece con otra academia, se rechaza. No aparecer
  -- ya es motivo suficiente: la clave foránea normal habría rechazado
  -- antes una fila que apuntara a algo inexistente, así que si llega
  -- hasta aquí y no se ve, es que existe y es de otra academia.
  IF v_academia IS NULL OR v_academia IS DISTINCT FROM NEW."academyId" THEN
    RAISE EXCEPTION
      'La columna wall_posts.nodeId apunta a un registro de otra academia'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS "barrera_wall_posts_nodeId" ON "wall_posts";
CREATE TRIGGER "barrera_wall_posts_nodeId"
  BEFORE INSERT OR UPDATE OF "nodeId", "academyId" ON "wall_posts"
  FOR EACH ROW WHEN (NEW."nodeId" IS NOT NULL)
  EXECUTE FUNCTION "barrera_wall_posts_nodeId"();
