import type { TenantClient } from "@/lib/db/tenant";
import {
  loadStudentGrants,
  studentCanAccessNode,
  studentNodeWhere,
  type StudentGrants,
} from "@/lib/access/content-access";

/**
 * Consultas del Campus.
 *
 * Todas parten de los derechos de acceso del alumno y aplican el filtro DENTRO
 * de la consulta. El Campus nunca pide "todo el contenido" para después
 * esconder lo que no toca: lo que no ha contratado no llega ni a salir de la
 * base de datos.
 */

export async function loadGrants(academyId: string, studentId: string) {
  return loadStudentGrants(academyId, studentId);
}

/** Convocatorias en las que el alumno está matriculado y activo. */
export async function loadStudentEditions(db: TenantClient, studentId: string) {
  const enrollments = await db.enrollment.findMany({
    where: { studentId, status: { in: ["ACTIVE", "PAST_DUE"] }, deletedAt: null },
    select: {
      id: true,
      status: true,
      course: {
        select: {
          id: true,
          name: true,
          oppositionEdition: {
            select: {
              id: true,
              name: true,
              examDate: true,
              opposition: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      },
      group: { select: { id: true, name: true, schedule: true } },
    },
  });

  return enrollments;
}

/**
 * Secciones visibles de una convocatoria.
 *
 * Aquí se ve el efecto de los packs: quien compró "solo tests" recibe la
 * sección de tests y no la de temario, sin que el Campus tenga que saber nada
 * sobre productos.
 */
export async function loadAccessibleSections(
  db: TenantClient,
  grants: StudentGrants,
  editionId: string,
) {
  const nodes = await db.contentNode.findMany({
    where: {
      editionId,
      parentId: null,
      ...studentNodeWhere(grants),
    },
    orderBy: { position: "asc" },
    select: {
      id: true,
      label: true,
      description: true,
      icon: true,
      sectionKind: true,
      path: true,
      editionId: true,
      isFree: true,
      visibleToStudents: true,
      status: true,
    },
  });

  return nodes;
}

/** Hijos de un nodo que el alumno puede abrir, con su progreso. */
export async function loadChildren(
  db: TenantClient,
  grants: StudentGrants,
  studentId: string,
  parentId: string,
) {
  const children = await db.contentNode.findMany({
    where: { parentId, ...studentNodeWhere(grants) },
    orderBy: { position: "asc" },
    select: {
      id: true,
      label: true,
      description: true,
      kind: true,
      sectionKind: true,
      estimatedMinutes: true,
      path: true,
      editionId: true,
      isFree: true,
      visibleToStudents: true,
      status: true,
      progress: {
        where: { studentId },
        select: { status: true, lastViewedAt: true },
      },
    },
  });

  return children;
}

/** Nodo concreto, comprobando el derecho de acceso antes de devolverlo. */
export async function loadNodeForStudent(
  db: TenantClient,
  grants: StudentGrants,
  nodeId: string,
) {
  const node = await db.contentNode.findUnique({
    where: { id: nodeId },
    select: {
      id: true,
      label: true,
      description: true,
      kind: true,
      sectionKind: true,
      path: true,
      editionId: true,
      isFree: true,
      visibleToStudents: true,
      status: true,
      estimatedMinutes: true,
      parentId: true,
      resource: {
        select: {
          type: true,
          fileId: true,
          externalUrl: true,
          richText: true,
          durationSeconds: true,
          pageCount: true,
        },
      },
    },
  });

  if (!node) return null;
  if (!studentCanAccessNode(grants, node, "VIEW_CONTENT")) return null;
  return node;
}

/** Próximas clases del alumno según sus grupos y cursos. */
export async function loadUpcomingClasses(
  db: TenantClient,
  studentId: string,
  limit = 3,
) {
  const enrollments = await db.enrollment.findMany({
    where: { studentId, status: { in: ["ACTIVE", "PAST_DUE"] }, deletedAt: null },
    select: { courseId: true, groupId: true },
  });

  if (enrollments.length === 0) return [];

  const courseIds = enrollments.map((e) => e.courseId);
  const groupIds = enrollments.map((e) => e.groupId).filter((id): id is string => !!id);

  return db.classSession.findMany({
    where: {
      deletedAt: null,
      status: { in: ["SCHEDULED", "LIVE"] },
      startsAt: { gte: new Date() },
      OR: [
        { groupId: { in: groupIds } },
        { groupId: null, courseId: { in: courseIds } },
      ],
    },
    orderBy: { startsAt: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      meetingUrl: true,
      teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
      group: { select: { name: true } },
    },
  });
}

/** Resumen de progreso para el panel de inicio. */
export async function loadProgressSummary(
  db: TenantClient,
  grants: StudentGrants,
  studentId: string,
) {
  const [accesibles, completados, enCurso, ultimo] = await Promise.all([
    db.contentNode.count({ where: { kind: "TOPIC", ...studentNodeWhere(grants) } }),
    db.studentContentProgress.count({ where: { studentId, status: "COMPLETED" } }),
    db.studentContentProgress.count({ where: { studentId, status: "IN_PROGRESS" } }),
    db.studentContentProgress.findFirst({
      where: { studentId, status: { in: ["IN_PROGRESS", "COMPLETED"] } },
      orderBy: { lastViewedAt: "desc" },
      select: {
        lastViewedAt: true,
        node: { select: { id: true, label: true } },
      },
    }),
  ]);

  return {
    temasAccesibles: accesibles,
    completados,
    enCurso,
    porcentaje: accesibles > 0 ? Math.round((completados / accesibles) * 100) : 0,
    continuar: ultimo,
  };
}
