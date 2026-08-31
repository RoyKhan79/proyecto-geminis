"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import {
  calidadDeRespuesta,
  programarRepaso,
} from "@/lib/study/spaced-repetition";
import { requireAcademy, requirePermission } from "@/lib/auth/context";
import { loadStudentGrants, studentNodeWhere } from "@/lib/access/content-access";
import { prismaBase } from "@/lib/db/client";
import { pickDueForReview, pickQuestions } from "./queries";

/**
 * Lo que una acción devuelve a la pantalla.
 *
 * `undefined` es el estado inicial, antes de que nadie haya enviado nada. El
 * error viaja como dato y no como excepción a propósito: una excepción en una
 * acción de servidor llega al navegador como «algo ha fallado», y aquí hace
 * falta poder decir qué exactamente y volver a pintar el formulario con lo que
 * la persona había escrito.
 */
export type AssessmentState = { error?: string; ok?: boolean } | undefined;

// ─────────────────────────────────────────────────────────────────────────────
// BANCO DE PREGUNTAS (Manager)
// ─────────────────────────────────────────────────────────────────────────────

const questionSchema = z.object({
  nodeId: z.string().min(1, "Elige un tema."),
  statement: z.string().trim().min(10, "El enunciado es demasiado corto."),
  explanation: z.string().trim().max(4000).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  option0: z.string().trim().min(1, "Escribe la opción A."),
  option1: z.string().trim().min(1, "Escribe la opción B."),
  option2: z.string().trim().optional(),
  option3: z.string().trim().optional(),
  correct: z.coerce.number().int().min(0).max(3),
  publicar: z.string().optional(),
});

/**
 * Crea una pregunta en el banco.
 *
 * @returns Confirmación, o el motivo. Se comprueba que haya una sola respuesta
 *   correcta y que las opciones no estén vacías: una pregunta mal montada no
 *   se detecta hasta que veinte alumnos la han fallado sin poder acertarla.
 */
export async function createQuestionAction(
  _prev: AssessmentState,
  formData: FormData,
): Promise<AssessmentState> {
  const ctx = await requirePermission("questions.write");
  const parsed = questionSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const opciones = [data.option0, data.option1, data.option2, data.option3]
    .map((texto) => texto?.trim() ?? "")
    .filter(Boolean);

  if (opciones.length < 2) return { error: "Hacen falta al menos dos opciones." };
  if (data.correct >= opciones.length) {
    return { error: "La respuesta correcta señala una opción que no existe." };
  }

  const nodo = await ctx.db.contentNode.findUnique({
    where: { id: data.nodeId },
    select: { id: true, editionId: true },
  });
  if (!nodo) return { error: "Ese tema no existe." };

  // Publicar exige un permiso distinto de crear: quien redacta no tiene por qué
  // ser quien aprueba (§22).
  const quierePublicar = data.publicar === "on";
  if (quierePublicar && !ctx.permissions.has("questions.publish")) {
    return { error: "No tienes permiso para publicar preguntas." };
  }

  const pregunta = await ctx.db.question.create({
    data: {
      nodeId: nodo.id,
      editionId: nodo.editionId,
      type: "SINGLE_CHOICE",
      difficulty: data.difficulty,
      status: quierePublicar ? "PUBLISHED" : "DRAFT",
      source: "MANUAL",
      statement: data.statement,
      explanation: data.explanation || null,
      authorId: ctx.membershipId,
      reviewerId: quierePublicar ? ctx.membershipId : null,
      reviewedAt: quierePublicar ? new Date() : null,
    },
  });

  await ctx.db.questionOption.createMany({
    data: opciones.map((text, position) => ({
      questionId: pregunta.id,
      text,
      position,
      isCorrect: position === data.correct,
    })),
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: quierePublicar ? "question.publish" : "question.create",
    entityType: "Question",
    entityId: pregunta.id,
  });

  revalidatePath("/gestion/tests");
  return { ok: true };
}

/**
 * Cambia el estado de una pregunta: borrador, publicada, archivada.
 *
 * Publicar es la decisión humana que exige el flujo de la IA: lo que genera el
 * copiloto entra siempre como borrador y no llega a ningún alumno hasta que
 * alguien pasa por aquí.
 */
export async function setQuestionStatusAction(formData: FormData) {
  const ctx = await requirePermission("questions.publish");
  const questionId = String(formData.get("questionId") ?? "");
  const estado = String(formData.get("estado") ?? "");

  const permitidos = ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED"] as const;
  if (!permitidos.includes(estado as (typeof permitidos)[number])) {
    throw new Error("Estado no válido.");
  }

  await ctx.db.question.update({
    where: { id: questionId },
    data: {
      status: estado as (typeof permitidos)[number],
      reviewerId: ctx.membershipId,
      reviewedAt: new Date(),
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "question.status",
    entityType: "Question",
    entityId: questionId,
    changes: { estado },
  });

  revalidatePath("/gestion/tests");
}

// ─────────────────────────────────────────────────────────────────────────────
// REALIZAR UN TEST (Campus)
// ─────────────────────────────────────────────────────────────────────────────

const startSchema = z.object({
  modo: z.enum(["TOPIC", "RANDOM", "ERRORS", "REVIEW"]),
  nodeId: z.string().optional(),
  cantidad: z.coerce.number().int().min(5).max(100).default(10),
});

/**
 * Empieza un intento.
 *
 * Las preguntas se eligen aquí, en el servidor, entre las de los temas que el
 * alumno tiene contratados. Nunca se envían al cliente las respuestas correctas
 * antes de responder.
 */
export async function startAttemptAction(formData: FormData) {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("attempts.take")) {
    throw new Error("No puedes realizar tests.");
  }

  const parsed = startSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Configuración de test no válida.");
  const { modo, nodeId, cantidad } = parsed.data;

  /** Vuelve a la pantalla de tests con un aviso legible en lugar de romper. */
  const avisar = (mensaje: string): never =>
    redirect(`/campus/tests?aviso=${encodeURIComponent(mensaje)}`);

  const grants = await loadStudentGrants(ctx.academy.id, ctx.membershipId);

  // Temas accesibles: es el filtro que impide examinarse de lo no contratado.
  const accesibles = await ctx.db.contentNode.findMany({
    where: { kind: "TOPIC", ...studentNodeWhere(grants, "TAKE_TESTS") },
    select: { id: true },
  });
  let nodeIds = accesibles.map((n) => n.id);

  if (modo === "TOPIC") {
    if (!nodeId || !nodeIds.includes(nodeId)) {
      avisar("Ese tema no está incluido en lo que tienes contratado.");
    }
    nodeIds = [nodeId as string];
  }

  if (nodeIds.length === 0) {
    avisar("Todavía no tienes temas disponibles para hacer tests.");
  }

  const preguntas =
    modo === "REVIEW"
      ? await pickDueForReview(ctx.db, ctx.membershipId, nodeIds, cantidad)
      : await pickQuestions(
          ctx.db,
          nodeIds,
          cantidad,
          modo === "ERRORS" ? ctx.membershipId : undefined,
        );

  if (preguntas.length === 0) {
    avisar(
      modo === "ERRORS"
        ? "Todavía no tienes preguntas falladas. Haz primero algún test."
        : modo === "REVIEW"
          ? "Hoy no te toca repasar nada. Vuelve mañana o haz un test normal."
          : "Aún no hay preguntas publicadas en estos temas.",
    );
  }

  const intento = await ctx.db.testAttempt.create({
    data: {
      studentId: ctx.membershipId,
      kind: modo,
      status: "IN_PROGRESS",
      totalQuestions: preguntas.length,
      config: {
        modo,
        cantidad: preguntas.length,
        // Guardamos el orden con el que se lanzó: el histórico debe poder
        // reconstruirse aunque el banco cambie después.
        preguntas: preguntas.map((p) => p.id),
      },
    },
  });

  await ctx.db.testAttemptAnswer.createMany({
    data: preguntas.map((pregunta, position) => ({
      attemptId: intento.id,
      questionId: pregunta.id,
      position,
    })),
  });

  redirect(`/campus/tests/${intento.id}`);
}

const answerSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  optionId: z.string().optional(),
});

/** Guarda una respuesta y corrige al momento. */
export async function answerQuestionAction(formData: FormData) {
  const ctx = await requireAcademy();
  const parsed = answerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Respuesta no válida.");

  const intento = await ctx.db.testAttempt.findUnique({
    where: { id: parsed.data.attemptId },
    select: { id: true, studentId: true, status: true, startedAt: true },
  });
  if (!intento || intento.studentId !== ctx.membershipId) {
    throw new Error("Ese intento no es tuyo.");
  }
  if (intento.status !== "IN_PROGRESS") throw new Error("El test ya está entregado.");

  const opcion = parsed.data.optionId
    ? await ctx.db.questionOption.findFirst({
        where: { id: parsed.data.optionId, questionId: parsed.data.questionId },
        select: { id: true, isCorrect: true },
      })
    : null;

  // Cuánto ha tardado en esta pregunta: desde la anterior respuesta, o desde
  // que empezó si es la primera. Se limita a 5 minutos porque dejar la pestaña
  // abierta mientras se come no significa que la pregunta costara una hora, y
  // ese número alimenta la repetición espaciada.
  const ultima = await ctx.db.testAttemptAnswer.findFirst({
    where: { attemptId: intento.id, answeredAt: { not: null } },
    orderBy: { answeredAt: "desc" },
    select: { answeredAt: true },
  });

  const ahora = new Date();
  const desde = ultima?.answeredAt ?? intento.startedAt;
  const segundos = Math.min(
    300,
    Math.max(0, Math.round((ahora.getTime() - new Date(desde).getTime()) / 1000)),
  );

  await ctx.db.testAttemptAnswer.updateMany({
    where: { attemptId: intento.id, questionId: parsed.data.questionId },
    data: {
      selectedOptionId: opcion?.id ?? null,
      isCorrect: opcion ? opcion.isCorrect : null,
      answeredAt: ahora,
      timeSpentSeconds: segundos,
    },
  });

  revalidatePath(`/campus/tests/${intento.id}`);
}

/** Entrega el test, calcula la nota y actualiza el historial de errores. */
export async function submitAttemptAction(formData: FormData) {
  const ctx = await requireAcademy();
  const attemptId = String(formData.get("attemptId") ?? "");

  const intento = await ctx.db.testAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      status: true,
      startedAt: true,
      expiresAt: true,
      kind: true,
      config: true,
      testDefinitionId: true,
    },
  });
  if (!intento || intento.studentId !== ctx.membershipId) {
    throw new Error("Ese intento no es tuyo.");
  }
  if (intento.status !== "IN_PROGRESS") redirect(`/campus/tests/${attemptId}`);

  const respuestas = await ctx.db.testAttemptAnswer.findMany({
    where: { attemptId },
    select: {
      questionId: true,
      isCorrect: true,
      selectedOptionId: true,
      timeSpentSeconds: true,
    },
  });

  const aciertos = respuestas.filter((r) => r.isCorrect === true).length;
  const fallos = respuestas.filter((r) => r.isCorrect === false).length;
  const blancos = respuestas.filter((r) => !r.selectedOptionId).length;
  const total = respuestas.length;

  // En un simulacro la nota se calcula con la fórmula del examen, no con el
  // porcentaje de aciertos: si la convocatoria penaliza un tercio por fallo,
  // responder a todo sin saber baja la nota. Un simulacro que no lo refleje
  // enseña una estrategia equivocada (ADR-0027).
  const config = (intento.config ?? {}) as { penalizacion?: number };
  const penalizacion = Number(config.penalizacion ?? 0);
  const notaNeta = Math.max(0, aciertos - fallos * penalizacion);
  const porcentaje =
    total > 0 ? Math.round((notaNeta / total) * 10000) / 100 : 0;

  const expirado = Boolean(
    intento.expiresAt && intento.expiresAt.getTime() < Date.now(),
  );

  await ctx.db.testAttempt.update({
    where: { id: attemptId },
    data: {
      // Entregar fuera de tiempo se marca, pero se corrige igual: perder el
      // trabajo del alumno por unos segundos sería un castigo absurdo.
      status: expirado ? "EXPIRED" : "SUBMITTED",
      submittedAt: new Date(),
      correctCount: aciertos,
      wrongCount: fallos,
      blankCount: blancos,
      score: Math.round(notaNeta * 1000) / 1000,
      scorePercent: porcentaje,
      timeSpentSeconds: Math.round(
        (Date.now() - new Date(intento.startedAt).getTime()) / 1000,
      ),
    },
  });

  // Historial de errores: alimenta el "test de mis errores" y la repetición
  // espaciada, que programa cuándo toca volver a ver cada pregunta.
  const ahora = new Date();
  const previas = await ctx.db.studentQuestionStat.findMany({
    where: {
      studentId: ctx.membershipId,
      questionId: { in: respuestas.map((r) => r.questionId) },
    },
    select: { questionId: true, intervalDays: true, easeFactor: true },
  });
  const previaPorPregunta = new Map(previas.map((p) => [p.questionId, p]));

  for (const respuesta of respuestas) {
    const acerto = respuesta.isCorrect === true;
    const previa = previaPorPregunta.get(respuesta.questionId);

    const repaso = programarRepaso({
      calidad: calidadDeRespuesta({
        acerto,
        segundos: respuesta.timeSpentSeconds || null,
      }),
      intervalDays: previa?.intervalDays ?? 0,
      easeFactor: previa ? Number(previa.easeFactor) : 2.5,
      desde: ahora,
    });

    await ctx.db.studentQuestionStat.upsert({
      where: {
        studentId_questionId: {
          studentId: ctx.membershipId,
          questionId: respuesta.questionId,
        },
      },
      create: {
        studentId: ctx.membershipId,
        questionId: respuesta.questionId,
        timesSeen: 1,
        timesCorrect: acerto ? 1 : 0,
        timesWrong: acerto ? 0 : 1,
        lastCorrect: acerto,
        lastSeenAt: ahora,
        intervalDays: repaso.intervalDays,
        easeFactor: repaso.easeFactor,
        nextReviewAt: repaso.nextReviewAt,
      },
      update: {
        timesSeen: { increment: 1 },
        timesCorrect: { increment: acerto ? 1 : 0 },
        timesWrong: { increment: acerto ? 0 : 1 },
        lastCorrect: acerto,
        lastSeenAt: ahora,
        intervalDays: repaso.intervalDays,
        easeFactor: repaso.easeFactor,
        nextReviewAt: repaso.nextReviewAt,
      },
    });

    // Estadística agregada de la pregunta, para la analítica del profesorado.
    await ctx.db.question.update({
      where: { id: respuesta.questionId },
      data: {
        timesAnswered: { increment: 1 },
        timesCorrect: { increment: acerto ? 1 : 0 },
      },
    });
  }

  await prismaBase.studentProfile.updateMany({
    where: { membershipId: ctx.membershipId },
    data: { lastActivityAt: new Date() },
  });

  revalidatePath(`/campus/tests/${attemptId}`);
  revalidatePath("/campus/tests");
  redirect(`/campus/tests/${attemptId}`);
}
