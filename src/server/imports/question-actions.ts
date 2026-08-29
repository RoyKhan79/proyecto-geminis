"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { ImportParseError, parseImportFile, suggestMapping } from "./parse";
import {
  QUESTION_FIELDS,
  applyQuestionImport,
  evaluateQuestionRows,
  rollbackQuestionImport,
  summarizeQuestions,
  type QuestionFieldKey,
} from "./questions";

/**
 * Importar un banco de preguntas.
 *
 * Mismo recorrido que la importación de alumnos —subir, mapear, simular,
 * importar, poder deshacer— pero con su propia lógica: interpretar cuál es la
 * respuesta correcta, resolver el tema por nombre y avisar de las repetidas.
 */

export type QuestionImportState = { error?: string; ok?: boolean } | undefined;

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadQuestionsAction(
  _prev: QuestionImportState,
  formData: FormData,
): Promise<QuestionImportState> {
  const ctx = await requirePermission("imports.run");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elige un archivo." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "El archivo supera los 10 MB." };
  }

  let hoja;
  try {
    hoja = await parseImportFile(file.name, await file.arrayBuffer());
  } catch (error) {
    return {
      error:
        error instanceof ImportParseError
          ? error.message
          : "No se ha podido leer el archivo.",
    };
  }

  if (hoja.rows.length === 0) {
    return { error: "El archivo no contiene filas con datos." };
  }

  const job = await ctx.db.importJob.create({
    data: {
      type: "QUESTIONS",
      status: "MAPPING",
      fileName: file.name,
      rowCount: hoja.rows.length,
      columnMapping: suggestMapping(hoja.headers, QUESTION_FIELDS),
      options: { onDuplicate: "skip", headers: hoja.headers },
      createdById: ctx.membershipId,
    },
  });

  await ctx.db.importRow.createMany({
    data: hoja.rows.map((rawData, index) => ({
      jobId: job.id,
      rowNumber: index + 2,
      rawData,
      status: "PENDING" as const,
    })),
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "import.questions.upload",
    entityType: "ImportJob",
    entityId: job.id,
    changes: { archivo: file.name, filas: hoja.rows.length },
  });

  redirect(`/gestion/tests/importar/${job.id}`);
}

const mapeoSchema = z.object({
  jobId: z.string().min(1),
  onDuplicate: z.enum(["skip", "import"]),
  editionId: z.string().optional(),
});

export async function saveQuestionMappingAction(
  _prev: QuestionImportState,
  formData: FormData,
): Promise<QuestionImportState> {
  const ctx = await requirePermission("imports.run");
  const parsed = mapeoSchema.safeParse({
    jobId: formData.get("jobId"),
    onDuplicate: formData.get("onDuplicate") ?? "skip",
    editionId: formData.get("editionId") ?? undefined,
  });
  if (!parsed.success) return { error: "Datos no válidos." };

  const job = await ctx.db.importJob.findUnique({
    where: { id: parsed.data.jobId },
    select: { id: true, status: true, options: true, type: true },
  });
  if (!job || job.type !== "QUESTIONS") return { error: "Esa importación no existe." };
  if (job.status === "COMPLETED" || job.status === "ROLLED_BACK") {
    return { error: "Esta importación ya se ejecutó." };
  }

  const mapping: Record<string, string> = {};
  for (const field of QUESTION_FIELDS) {
    const valor = String(formData.get(`map.${field.key}`) ?? "").trim();
    if (valor) mapping[field.key] = valor;
  }

  const faltan = QUESTION_FIELDS.filter((f) => f.required && !mapping[f.key]);
  if (faltan.length > 0) {
    return {
      error: `Falta asignar una columna para: ${faltan.map((f) => f.label).join(", ")}.`,
    };
  }

  await ctx.db.importJob.update({
    where: { id: job.id },
    data: {
      columnMapping: mapping,
      options: {
        ...(job.options as Record<string, unknown>),
        onDuplicate: parsed.data.onDuplicate,
        editionId: parsed.data.editionId || null,
      },
      status: "SIMULATED",
    },
  });

  revalidatePath(`/gestion/tests/importar/${job.id}`);
  return { ok: true };
}

export async function runQuestionImportAction(formData: FormData) {
  const ctx = await requirePermission("imports.run");
  const jobId = String(formData.get("jobId") ?? "");

  const job = await ctx.db.importJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      type: true,
      columnMapping: true,
      options: true,
    },
  });
  if (!job || job.type !== "QUESTIONS") throw new Error("Esa importación no existe.");
  if (job.status === "COMPLETED") throw new Error("Ya se importó.");

  await ctx.db.importJob.update({
    where: { id: job.id },
    data: { status: "IMPORTING", startedAt: new Date() },
  });

  const filas = await ctx.db.importRow.findMany({
    where: { jobId: job.id },
    orderBy: { rowNumber: "asc" },
    select: { rowNumber: true, rawData: true },
  });

  const options = job.options as {
    onDuplicate?: "skip" | "import";
    editionId?: string | null;
  };

  const evaluadas = await evaluateQuestionRows(
    ctx.db,
    filas.map((f) => ({
      rowNumber: f.rowNumber,
      rawData: f.rawData as Record<string, string>,
    })),
    job.columnMapping as Partial<Record<QuestionFieldKey, string>>,
    {
      editionId: options.editionId ?? null,
      onDuplicate: options.onDuplicate ?? "skip",
    },
  );

  const resultado = await applyQuestionImport(ctx.db, job.id, evaluadas, {
    editionId: options.editionId ?? null,
    authorId: ctx.membershipId,
  });

  await ctx.db.importJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      createdCount: resultado.creados,
      updatedCount: 0,
      skippedCount: resultado.saltados,
      errorCount: resultado.errores,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "import.questions.run",
    entityType: "ImportJob",
    entityId: job.id,
    changes: resultado,
  });

  revalidatePath(`/gestion/tests/importar/${job.id}`);
  revalidatePath("/gestion/tests");
}

export async function rollbackQuestionImportAction(formData: FormData) {
  const ctx = await requirePermission("imports.rollback");
  const jobId = String(formData.get("jobId") ?? "");

  const job = await ctx.db.importJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, type: true },
  });
  if (!job || job.type !== "QUESTIONS") throw new Error("Esa importación no existe.");
  if (job.status !== "COMPLETED") {
    throw new Error("Solo se puede revertir una importación completada.");
  }

  const resultado = await rollbackQuestionImport(ctx.db, job.id);

  await ctx.db.importJob.update({
    where: { id: job.id },
    data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "import.questions.rollback",
    entityType: "ImportJob",
    entityId: job.id,
    changes: resultado,
  });

  revalidatePath(`/gestion/tests/importar/${job.id}`);
  revalidatePath("/gestion/tests");
}

/** Lo que se enseña en la simulación. No escribe nada. */
export async function previewQuestionImport(jobId: string) {
  const ctx = await requirePermission("imports.run");

  const job = await ctx.db.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.type !== "QUESTIONS") return null;

  const filas = await ctx.db.importRow.findMany({
    where: { jobId },
    orderBy: { rowNumber: "asc" },
    select: { rowNumber: true, rawData: true, status: true, messages: true },
  });

  const options = job.options as {
    onDuplicate?: "skip" | "import";
    editionId?: string | null;
    headers?: string[];
  };

  // Una vez ejecutada, se enseña lo que quedó registrado y no se recalcula: el
  // banco ya ha cambiado y volver a evaluar daría un resultado distinto al que
  // de verdad ocurrió.
  if (job.status === "COMPLETED" || job.status === "ROLLED_BACK") {
    return {
      job,
      headers: options.headers ?? [],
      evaluadas: filas.map((f) => ({
        rowNumber: f.rowNumber,
        statement: String((f.rawData as Record<string, string>)?.[
          (job.columnMapping as Record<string, string>).statement
        ] ?? ""),
        options: [] as string[],
        correctIndex: -1,
        explanation: null,
        nodeId: null,
        nodeLabel: null,
        difficulty: "MEDIUM" as const,
        tags: [] as string[],
        officialExamRef: null,
        status: f.status,
        messages: (f.messages as { level: "error" | "warning"; text: string }[]) ?? [],
      })),
      resumen: {
        total: filas.length,
        crear: job.createdCount,
        saltar: job.skippedCount,
        errores: job.errorCount,
        sinTema: 0,
      },
    };
  }

  const evaluadas = await evaluateQuestionRows(
    ctx.db,
    filas.map((f) => ({
      rowNumber: f.rowNumber,
      rawData: f.rawData as Record<string, string>,
    })),
    job.columnMapping as Partial<Record<QuestionFieldKey, string>>,
    {
      editionId: options.editionId ?? null,
      onDuplicate: options.onDuplicate ?? "skip",
    },
  );

  return {
    job,
    headers: options.headers ?? [],
    evaluadas,
    resumen: summarizeQuestions(evaluadas),
  };
}
