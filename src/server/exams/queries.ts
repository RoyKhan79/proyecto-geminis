import type { TenantClient } from "@/lib/db/tenant";
import { estadoDelExamen, type EstadoExamen } from "./estado";

/**
 * Consultas de exámenes de desarrollo.
 *
 * Un examen de desarrollo es una tarea de tipo EXAM: se corrige como cualquier
 * otra —lo lee una persona y le pone nota— pero se hace con reloj. Por eso
 * comparten tabla y se separan solo aquí, al leerlos.
 */

export type ExamenDeAlumno = {
  submissionId: string;
  assignmentId: string;
  titulo: string;
  enunciado: string | null;
  maxScore: number;
  opensAt: Date | null;
  dueAt: Date | null;
  timeLimitMinutes: number | null;
  allowFiles: boolean;
  borrador: string | null;
  draftSavedAt: Date | null;
  autoSubmitted: boolean;
  score: number | null;
  feedback: string | null;
  submittedAt: Date | null;
  archivos: { id: string; fileId: string; nombre: string }[];
  estado: EstadoExamen;
};

const SELECT = {
  id: true,
  status: true,
  score: true,
  feedback: true,
  body: true,
  submittedAt: true,
  startedAt: true,
  draftSavedAt: true,
  autoSubmitted: true,
  files: {
    select: { id: true, file: { select: { id: true, originalName: true } } },
  },
  assignment: {
    select: {
      id: true,
      title: true,
      instructions: true,
      maxScore: true,
      status: true,
      kind: true,
      opensAt: true,
      dueAt: true,
      timeLimitMinutes: true,
      allowFiles: true,
      deletedAt: true,
    },
  },
} as const;

/** Lo que Prisma devuelve en una columna `Decimal`: un objeto, no un número. */
type Decimal = { toString(): string };

function componer(
  entrega: {
    id: string;
    status: string;
    score: Decimal | null;
    feedback: string | null;
    body: string | null;
    submittedAt: Date | null;
    startedAt: Date | null;
    draftSavedAt: Date | null;
    autoSubmitted: boolean;
    files: { id: string; file: { id: string; originalName: string } }[];
    assignment: {
      id: string;
      title: string;
      instructions: string | null;
      maxScore: Decimal;
      opensAt: Date | null;
      dueAt: Date | null;
      timeLimitMinutes: number | null;
      allowFiles: boolean;
      status: string;
    };
  },
  ahora: Date,
): ExamenDeAlumno {
  return {
    submissionId: entrega.id,
    assignmentId: entrega.assignment.id,
    titulo: entrega.assignment.title,
    enunciado: entrega.assignment.instructions,
    maxScore: Number(entrega.assignment.maxScore),
    opensAt: entrega.assignment.opensAt,
    dueAt: entrega.assignment.dueAt,
    timeLimitMinutes: entrega.assignment.timeLimitMinutes,
    allowFiles: entrega.assignment.allowFiles,
    borrador: entrega.body,
    draftSavedAt: entrega.draftSavedAt,
    autoSubmitted: entrega.autoSubmitted,
    score: entrega.score === null ? null : Number(entrega.score),
    feedback: entrega.feedback,
    submittedAt: entrega.submittedAt,
    archivos: entrega.files.map((f) => ({
      id: f.id,
      fileId: f.file.id,
      nombre: f.file.originalName,
    })),
    estado: estadoDelExamen(entrega.assignment, entrega, ahora),
  };
}

/** Todos los exámenes de desarrollo de un alumno, con su estado calculado. */
export async function loadStudentExams(
  db: TenantClient,
  studentId: string,
): Promise<ExamenDeAlumno[]> {
  const ahora = new Date();

  const entregas = await db.submission.findMany({
    where: {
      studentId,
      assignment: { kind: "EXAM", status: "PUBLISHED", deletedAt: null },
    },
    orderBy: [{ createdAt: "desc" }],
    select: SELECT,
  });

  return entregas.map((e) => componer(e, ahora));
}

/**
 * Un examen concreto, comprobando que es de este alumno.
 *
 * Se busca por `submissionId` y `studentId` a la vez: así el identificador de la
 * entrega de otro no sirve de nada aunque se conozca. El aislamiento por
 * academia ya lo pone el cliente de tenant; esto es la capa de «y además, tuyo».
 */
export async function loadExamForStudent(
  db: TenantClient,
  studentId: string,
  submissionId: string,
): Promise<ExamenDeAlumno | null> {
  const entrega = await db.submission.findFirst({
    where: {
      id: submissionId,
      studentId,
      assignment: { kind: "EXAM", status: "PUBLISHED", deletedAt: null },
    },
    select: SELECT,
  });

  return entrega ? componer(entrega, new Date()) : null;
}
