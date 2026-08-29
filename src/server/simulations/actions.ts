"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireAcademy, requirePermission } from "@/lib/auth/context";
import { loadStudentGrants, releaseWhere, studentNodeWhere } from "@/lib/access/content-access";

/**
 * SIMULACROS
 *
 * Un simulacro no es un test más largo: es un intento de reproducir el examen
 * real. Por eso tiene plantilla propia (`ExamBlueprint`) con el número de
 * preguntas, el tiempo, la penalización por fallo y la distribución por bloques.
 *
 * Decisión ADR-0027: la nota se calcula con la fórmula del examen, no con el
 * porcentaje de aciertos. En una oposición con penalización de un tercio,
 * responder a todo sin saber baja la nota; si el simulacro no lo refleja, el
 * alumno aprende una estrategia equivocada.
 */

export type SimState = { error?: string; ok?: string } | undefined;

const blueprintSchema = z.object({
  name: z.string().trim().min(3, "Ponle un nombre a la plantilla."),
  editionId: z.string().trim().optional(),
  totalQuestions: z.coerce.number().int().min(5).max(300),
  optionsPerQuestion: z.coerce.number().int().min(2).max(6).default(4),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  /// Penalización expresada como "1/3", "1/4" o "0".
  penalty: z.string().trim().default("0"),
  passingScore: z.coerce.number().min(0).max(100).optional(),
});

/** Convierte "1/3" en 0.333. Es como lo dicen las bases de la convocatoria. */
function parsePenalizacion(texto: string): number {
  const limpio = texto.trim().replace(",", ".");
  if (limpio.includes("/")) {
    const [arriba, abajo] = limpio.split("/").map(Number);
    if (!abajo || Number.isNaN(arriba) || Number.isNaN(abajo)) return 0;
    return Math.round((arriba / abajo) * 1000) / 1000;
  }
  const valor = Number(limpio);
  return Number.isFinite(valor) && valor >= 0 ? valor : 0;
}

export async function createBlueprintAction(
  _prev: SimState,
  formData: FormData,
): Promise<SimState> {
  const ctx = await requirePermission("tests.write");
  const parsed = blueprintSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const plantilla = await ctx.db.examBlueprint.create({
    data: {
      name: data.name,
      editionId: data.editionId || null,
      totalQuestions: data.totalQuestions,
      optionsPerQuestion: data.optionsPerQuestion,
      durationMinutes: data.durationMinutes,
      penaltyPerWrong: parsePenalizacion(data.penalty),
      passingScore: data.passingScore ?? null,
      distribution: [],
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "blueprint.create",
    entityType: "ExamBlueprint",
    entityId: plantilla.id,
    changes: { nombre: data.name, preguntas: data.totalQuestions },
  });

  revalidatePath("/gestion/simulacros");
  return { ok: "Plantilla creada. Ahora puedes montar simulacros con ella." };
}

const simulacroSchema = z.object({
  blueprintId: z.string().min(1, "Elige una plantilla."),
  title: z.string().trim().min(3, "Ponle un título."),
  description: z.string().trim().max(1000).optional(),
  availableFrom: z.string().trim().optional(),
  availableUntil: z.string().trim().optional(),
  maxAttempts: z.coerce.number().int().min(0).max(10).optional(),
  publicar: z.string().optional(),
});

export async function createSimulationAction(
  _prev: SimState,
  formData: FormData,
): Promise<SimState> {
  const ctx = await requirePermission("tests.write");
  const parsed = simulacroSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const plantilla = await ctx.db.examBlueprint.findUnique({
    where: { id: data.blueprintId },
    select: {
      id: true,
      editionId: true,
      totalQuestions: true,
      durationMinutes: true,
      penaltyPerWrong: true,
    },
  });
  if (!plantilla) return { error: "Esa plantilla no existe." };

  const publicar = data.publicar === "on";
  if (publicar && !ctx.permissions.has("tests.publish")) {
    return { error: "No tienes permiso para publicar simulacros." };
  }

  // Un simulacro sin preguntas suficientes engaña: mejor avisar ahora.
  const disponibles = await ctx.db.question.count({
    where: {
      deletedAt: null,
      status: "PUBLISHED",
      ...(plantilla.editionId ? { editionId: plantilla.editionId } : {}),
    },
  });

  if (disponibles < plantilla.totalQuestions) {
    return {
      error: `La plantilla pide ${plantilla.totalQuestions} preguntas y solo hay ${disponibles} publicadas. Publica más o baja el número.`,
    };
  }

  const simulacro = await ctx.db.testDefinition.create({
    data: {
      blueprintId: plantilla.id,
      editionId: plantilla.editionId,
      title: data.title,
      description: data.description || null,
      kind: "SIMULATION",
      status: publicar ? "PUBLISHED" : "DRAFT",
      questionCount: plantilla.totalQuestions,
      timeLimitMinutes: plantilla.durationMinutes,
      penaltyPerWrong: plantilla.penaltyPerWrong,
      shuffleQuestions: true,
      shuffleOptions: true,
      // En un simulacro las soluciones se ven al terminar, como en el examen.
      revealMode: "AT_END",
      maxAttempts: data.maxAttempts || null,
      availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
      availableUntil: data.availableUntil ? new Date(data.availableUntil) : null,
      createdById: ctx.membershipId,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: publicar ? "simulation.publish" : "simulation.create",
    entityType: "TestDefinition",
    entityId: simulacro.id,
    changes: { titulo: data.title },
  });

  revalidatePath("/gestion/simulacros");
  return {
    ok: publicar
      ? "Simulacro publicado. Ya aparece en el Campus."
      : "Simulacro guardado en borrador.",
  };
}

export async function toggleSimulationAction(formData: FormData) {
  const ctx = await requirePermission("tests.publish");
  const id = String(formData.get("simulationId") ?? "");
  const publicar = String(formData.get("publicar") ?? "") === "1";

  await ctx.db.testDefinition.update({
    where: { id },
    data: { status: publicar ? "PUBLISHED" : "DRAFT" },
  });

  revalidatePath("/gestion/simulacros");
  revalidatePath("/campus/tests");
}

/**
 * Empezar un simulacro.
 *
 * Se comprueba el plazo, el número de intentos y —lo importante— que las
 * preguntas salgan solo de lo que ese alumno tiene contratado y abierto.
 */
export async function startSimulationAction(formData: FormData) {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("attempts.take")) throw new Error("No puedes hacer tests.");

  const simulationId = String(formData.get("simulationId") ?? "");

  const avisar = (mensaje: string): never =>
    redirect(`/campus/tests?aviso=${encodeURIComponent(mensaje)}`);

  const simulacro = await ctx.db.testDefinition.findUnique({
    where: { id: simulationId },
    select: {
      id: true,
      title: true,
      status: true,
      questionCount: true,
      timeLimitMinutes: true,
      penaltyPerWrong: true,
      maxAttempts: true,
      availableFrom: true,
      availableUntil: true,
      editionId: true,
      deletedAt: true,
    },
  });

  if (!simulacro || simulacro.deletedAt || simulacro.status !== "PUBLISHED") {
    avisar("Ese simulacro no está disponible.");
  }
  const sim = simulacro!;

  const ahora = Date.now();
  if (sim.availableFrom && sim.availableFrom.getTime() > ahora) {
    avisar(`Este simulacro se abre el ${sim.availableFrom.toLocaleDateString("es-ES")}.`);
  }
  if (sim.availableUntil && sim.availableUntil.getTime() < ahora) {
    avisar("El plazo de este simulacro ya se ha cerrado.");
  }

  if (sim.maxAttempts) {
    const hechos = await ctx.db.testAttempt.count({
      where: { studentId: ctx.membershipId, testDefinitionId: sim.id },
    });
    if (hechos >= sim.maxAttempts) {
      avisar(`Ya has agotado tus ${sim.maxAttempts} intentos en este simulacro.`);
    }
  }

  // Preguntas de lo que tiene contratado y abierto. Misma barrera de siempre.
  const grants = await loadStudentGrants(ctx.academy.id, ctx.membershipId);
  const nodos = await ctx.db.contentNode.findMany({
    where: {
      kind: "TOPIC",
      ...studentNodeWhere(grants),
      ...releaseWhere(grants.groupIds),
    },
    select: { id: true },
  });

  if (nodos.length === 0) avisar("Todavía no tienes temas abiertos para este simulacro.");

  const candidatas = await ctx.db.question.findMany({
    where: {
      deletedAt: null,
      status: "PUBLISHED",
      nodeId: { in: nodos.map((n) => n.id) },
      ...(sim.editionId ? { editionId: sim.editionId } : {}),
    },
    select: { id: true },
  });

  if (candidatas.length < 5) {
    avisar("No hay suficientes preguntas publicadas de tus temas para montar el simulacro.");
  }

  const mezcladas = [...candidatas];
  for (let i = mezcladas.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [mezcladas[i], mezcladas[j]] = [mezcladas[j], mezcladas[i]];
  }
  const elegidas = mezcladas.slice(0, Math.min(sim.questionCount, mezcladas.length));

  const expira = sim.timeLimitMinutes
    ? new Date(ahora + sim.timeLimitMinutes * 60 * 1000)
    : null;

  const intento = await ctx.db.testAttempt.create({
    data: {
      studentId: ctx.membershipId,
      testDefinitionId: sim.id,
      kind: "SIMULATION",
      status: "IN_PROGRESS",
      totalQuestions: elegidas.length,
      expiresAt: expira,
      config: {
        modo: "SIMULATION",
        titulo: sim.title,
        penalizacion: Number(sim.penaltyPerWrong),
        minutos: sim.timeLimitMinutes,
        preguntas: elegidas.map((q) => q.id),
      },
    },
  });

  await ctx.db.testAttemptAnswer.createMany({
    data: elegidas.map((pregunta, position) => ({
      attemptId: intento.id,
      questionId: pregunta.id,
      position,
    })),
  });

  redirect(`/campus/tests/${intento.id}`);
}
