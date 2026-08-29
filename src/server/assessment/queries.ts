import type { QuestionStatus } from "@/generated/prisma/enums";
import type { TenantClient } from "@/lib/db/tenant";
import { studentNodeWhere, type StudentGrants } from "@/lib/access/content-access";

/**
 * Consultas del módulo de evaluación.
 *
 * La regla de oro: un alumno solo se examina de lo que tiene contratado. La
 * selección de preguntas parte SIEMPRE de los nodos accesibles, nunca del banco
 * completo.
 */

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "Pendiente de revisión",
  PUBLISHED: "Publicada",
  POSSIBLY_OUTDATED: "Posiblemente desactualizada",
  ARCHIVED: "Archivada",
};

export const QUESTION_STATUS_TONE: Record<
  QuestionStatus,
  "neutral" | "positive" | "caution" | "critical" | "info"
> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "info",
  PUBLISHED: "positive",
  POSSIBLY_OUTDATED: "caution",
  ARCHIVED: "neutral",
};

export const DIFFICULTY_LABEL = {
  EASY: "Fácil",
  MEDIUM: "Media",
  HARD: "Difícil",
} as const;

export async function listQuestions(
  db: TenantClient,
  filtros: {
    search?: string;
    status?: QuestionStatus | "ALL";
    nodeId?: string;
    editionId?: string;
    page?: number;
  },
) {
  const page = Math.max(1, filtros.page ?? 1);
  const take = 25;

  const where = {
    deletedAt: null,
    ...(filtros.status && filtros.status !== "ALL" ? { status: filtros.status } : {}),
    ...(filtros.nodeId ? { nodeId: filtros.nodeId } : {}),
    ...(filtros.editionId ? { editionId: filtros.editionId } : {}),
    ...(filtros.search
      ? { statement: { contains: filtros.search, mode: "insensitive" as const } }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      select: {
        id: true,
        statement: true,
        status: true,
        difficulty: true,
        source: true,
        timesAnswered: true,
        timesCorrect: true,
        createdAt: true,
        node: { select: { id: true, label: true } },
        options: { select: { id: true, text: true, isCorrect: true, position: true } },
        author: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    }),
    db.question.count({ where }),
  ]);

  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / take)) };
}

/** Temas disponibles para clasificar preguntas y montar tests. */
export async function loadTopicOptions(db: TenantClient) {
  return db.contentNode.findMany({
    where: { kind: { in: ["TOPIC", "FOLDER"] }, deletedAt: null },
    orderBy: [{ editionId: "asc" }, { path: "asc" }, { position: "asc" }],
    select: {
      id: true,
      label: true,
      kind: true,
      depth: true,
      editionId: true,
      edition: {
        select: { name: true, opposition: { select: { name: true } } },
      },
    },
  });
}

// ── Lado del alumno ──────────────────────────────────────────────────────────

/**
 * Temas sobre los que el alumno puede examinarse: los que tiene contratados y
 * que además tienen preguntas publicadas.
 */
/**
 * Incluye también los temas marcados como muestra gratuita: quien todavía no ha
 * comprado nada puede probar un test de ejemplo. Es deliberado y es una
 * herramienta comercial, no un descuido.
 */
export async function loadStudentTestTopics(
  db: TenantClient,
  grants: StudentGrants,
) {
  const accesibles = await db.contentNode.findMany({
    where: { kind: "TOPIC", ...studentNodeWhere(grants) },
    orderBy: [{ path: "asc" }, { position: "asc" }],
    select: {
      id: true,
      label: true,
      editionId: true,
      _count: { select: { questions: { where: { status: "PUBLISHED", deletedAt: null } } } },
    },
  });

  return accesibles.filter((t) => t._count.questions > 0);
}

/** Preguntas publicadas de un conjunto de temas, barajadas. */
export async function pickQuestions(
  db: TenantClient,
  nodeIds: string[],
  cantidad: number,
  soloFalladasDe?: string,
) {
  const where = {
    deletedAt: null,
    status: "PUBLISHED" as const,
    nodeId: { in: nodeIds },
    ...(soloFalladasDe
      ? {
          studentStats: {
            some: { studentId: soloFalladasDe, timesWrong: { gt: 0 } },
          },
        }
      : {}),
  };

  const candidatas = await db.question.findMany({
    where,
    select: {
      id: true,
      statement: true,
      explanation: true,
      difficulty: true,
      node: { select: { id: true, label: true } },
      options: {
        select: { id: true, text: true, isCorrect: true, position: true },
        orderBy: { position: "asc" },
      },
    },
  });

  // Barajado Fisher-Yates. Se hace en memoria porque el banco de un tema no es
  // grande; si algún día lo fuera, se pasa a un ORDER BY random() con límite.
  const mezcladas = [...candidatas];
  for (let i = mezcladas.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [mezcladas[i], mezcladas[j]] = [mezcladas[j], mezcladas[i]];
  }

  return mezcladas.slice(0, cantidad);
}

/**
 * Preguntas que hoy tocan por repetición espaciada.
 *
 * Se ordenan por fecha de repaso: primero las más atrasadas, que son las que
 * están más cerca de olvidarse del todo. Se respeta el filtro de temas, porque
 * un alumno puede haber perdido el acceso a un tema desde la última vez.
 */
export async function pickDueForReview(
  db: TenantClient,
  studentId: string,
  nodeIds: string[],
  cantidad: number,
) {
  const ahora = new Date();
  ahora.setHours(23, 59, 59, 999);

  const pendientes = await db.studentQuestionStat.findMany({
    where: {
      studentId,
      nextReviewAt: { not: null, lte: ahora },
      question: { deletedAt: null, status: "PUBLISHED", nodeId: { in: nodeIds } },
    },
    orderBy: { nextReviewAt: "asc" },
    take: cantidad,
    select: {
      question: {
        select: {
          id: true,
          statement: true,
          explanation: true,
          difficulty: true,
          node: { select: { id: true, label: true } },
          options: {
            select: { id: true, text: true, isCorrect: true, position: true },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  return pendientes.map((p) => p.question);
}

/** Cuántas preguntas tiene hoy pendientes de repaso. */
export async function countDueForReview(db: TenantClient, studentId: string) {
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  return db.studentQuestionStat.count({
    where: { studentId, nextReviewAt: { not: null, lte: hoy } },
  });
}

/** Historial de intentos del alumno. */
export async function loadAttempts(db: TenantClient, studentId: string, take = 20) {
  return db.testAttempt.findMany({
    where: { studentId },
    orderBy: { startedAt: "desc" },
    take,
    select: {
      id: true,
      kind: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      totalQuestions: true,
      correctCount: true,
      wrongCount: true,
      blankCount: true,
      scorePercent: true,
      config: true,
    },
  });
}

/** Resumen de errores del alumno, por tema. */
export async function loadWeakTopics(db: TenantClient, studentId: string) {
  const stats = await db.studentQuestionStat.findMany({
    where: { studentId, timesSeen: { gt: 0 } },
    select: {
      timesWrong: true,
      timesSeen: true,
      question: { select: { node: { select: { id: true, label: true } } } },
    },
  });

  const porTema = new Map<string, { label: string; fallos: number; vistas: number }>();
  for (const stat of stats) {
    const nodo = stat.question.node;
    if (!nodo) continue;
    const actual = porTema.get(nodo.id) ?? { label: nodo.label, fallos: 0, vistas: 0 };
    actual.fallos += stat.timesWrong;
    actual.vistas += stat.timesSeen;
    porTema.set(nodo.id, actual);
  }

  return [...porTema.entries()]
    .map(([id, datos]) => ({
      id,
      ...datos,
      aciertoPorcentaje:
        datos.vistas > 0
          ? Math.round(((datos.vistas - datos.fallos) / datos.vistas) * 100)
          : 0,
    }))
    .sort((a, b) => a.aciertoPorcentaje - b.aciertoPorcentaje);
}

/** Cuántas preguntas tiene falladas el alumno (para el test de errores). */
export async function countWrongQuestions(db: TenantClient, studentId: string) {
  return db.studentQuestionStat.count({
    where: { studentId, timesWrong: { gt: 0 } },
  });
}
