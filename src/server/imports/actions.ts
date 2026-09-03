"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { ImportParseError, parseImportFile, suggestMapping } from "./parse";
import { MAX_ROWS } from "./parse";
import { MAX_BYTES_ARCHIVO } from "./zip-seguro";
import { limitarAccion } from "@/lib/rate-limit";
import {
  STUDENT_FIELDS,
  applyImport,
  evaluateRows,
  rollbackImport,
  summarize,
  type FieldKey,
} from "./students";

/** Lo que el asistente de importación devuelve en cada paso. */
export type ImportState = { error?: string; ok?: boolean } | undefined;

// El mismo tope que usa la inspección del archivo, para que no puedan
// separarse: un límite aquí y otro allí acaban siendo dos límites distintos.
const MAX_BYTES = MAX_BYTES_ARCHIVO;

/** Paso 1 y 2: subir el archivo y detectar sus columnas. */
export async function uploadImportAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const ctx = await requirePermission("imports.run");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elige un archivo." };
  }
  // Abrir un archivo de importación descomprime y analiza el contenido entero.
  // Ya no puede reventar el proceso —lo impide `zip-seguro.ts`— pero cien
  // seguidos siguen ocupando el servidor de todas las academias.
  const espera = await limitarAccion("importacion", ctx.membershipId);
  if (espera) return { error: espera };

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

  /*
   * Se niega en vez de recortar.
   *
   * El lector corta a MAX_ROWS, y antes eso no se decía en ningún sitio: quien
   * subiera treinta mil alumnos importaba veinte mil y perdía diez mil sin
   * enterarse. Entre fallar y quedarse dos tercios de los datos, hay que
   * fallar: el que ve un error parte el archivo, el que no ve nada descubre lo
   * que falta meses después.
   */
  if (hoja.totalRows > MAX_ROWS) {
    return {
      error:
        `El archivo trae ${hoja.totalRows.toLocaleString("es-ES")} filas y el máximo ` +
        `son ${MAX_ROWS.toLocaleString("es-ES")}. Pártelo en varios y súbelos uno a uno; ` +
        `así no se queda nadie fuera sin que te des cuenta.`,
    };
  }

  const job = await ctx.db.importJob.create({
    data: {
      type: "STUDENTS",
      status: "MAPPING",
      fileName: file.name,
      rowCount: hoja.rows.length,
      columnMapping: suggestMapping(hoja.headers, STUDENT_FIELDS),
      options: { onDuplicate: "update", headers: hoja.headers },
      createdById: ctx.membershipId,
    },
  });

  /*
   * Guardamos las filas tal cual venían: si el mapeo cambia, se reevalúa sin
   * volver a pedir el archivo.
   *
   * EN LOTES, no de una vez. Cada operación de academia va dentro de una
   * transacción para fijar el contexto de RLS, y una transacción tiene plazo.
   * Un archivo de treinta mil filas se lo comía entero y la importación moría
   * con «a commit cannot be executed on an expired transaction», que además no
   * le dice nada a quien lo lee.
   *
   * Mil por lote mantiene cada transacción corta. También es mejor para la base
   * de datos que una transacción larguísima bloqueando la tabla, que es lo que
   * pasa cuando alguien importa el histórico entero de la academia.
   */
  const LOTE = 1000;
  for (let desde = 0; desde < hoja.rows.length; desde += LOTE) {
    await ctx.db.importRow.createMany({
      data: hoja.rows.slice(desde, desde + LOTE).map((rawData, i) => ({
        jobId: job.id,
        // +2: la 1 es la cabecera y las hojas empiezan en 1.
        rowNumber: desde + i + 2,
        rawData,
        status: "PENDING" as const,
      })),
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "import.upload",
    entityType: "ImportJob",
    entityId: job.id,
    changes: { archivo: file.name, filas: hoja.rows.length },
  });

  redirect(`/gestion/importar/${job.id}`);
}

const mappingSchema = z.object({
  jobId: z.string().min(1),
  onDuplicate: z.enum(["update", "skip"]),
  defaultCourseId: z.string().optional(),
});

/** Paso 3, 4 y 5: guardar el mapeo, validar y simular. */
export async function saveMappingAction(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const ctx = await requirePermission("imports.run");
  const parsed = mappingSchema.safeParse({
    jobId: formData.get("jobId"),
    onDuplicate: formData.get("onDuplicate") ?? "update",
    defaultCourseId: formData.get("defaultCourseId") ?? undefined,
  });
  if (!parsed.success) return { error: "Datos no válidos." };

  const job = await ctx.db.importJob.findUnique({
    where: { id: parsed.data.jobId },
    select: { id: true, status: true, options: true },
  });
  if (!job) return { error: "Esa importación no existe." };
  if (job.status === "COMPLETED" || job.status === "ROLLED_BACK") {
    return { error: "Esta importación ya se ejecutó." };
  }

  const mapping: Record<string, string> = {};
  for (const field of STUDENT_FIELDS) {
    const valor = String(formData.get(`map.${field.key}`) ?? "").trim();
    if (valor) mapping[field.key] = valor;
  }

  const faltan = STUDENT_FIELDS.filter((f) => f.required && !mapping[f.key]);
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
        defaultCourseId: parsed.data.defaultCourseId || null,
      },
      status: "SIMULATED",
    },
  });

  revalidatePath(`/gestion/importar/${job.id}`);
  return { ok: true };
}

/** Paso 7: importar de verdad. */
export async function runImportAction(formData: FormData) {
  const ctx = await requirePermission("imports.run");
  const jobId = String(formData.get("jobId") ?? "");

  const job = await ctx.db.importJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true, columnMapping: true, options: true },
  });
  if (!job) throw new Error("Esa importación no existe.");
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

  const options = job.options as { onDuplicate?: "update" | "skip"; defaultCourseId?: string };

  const evaluadas = await evaluateRows(
    ctx.db,
    filas.map((f) => ({
      rowNumber: f.rowNumber,
      rawData: f.rawData as Record<string, string>,
    })),
    job.columnMapping as Partial<Record<FieldKey, string>>,
    {
      onDuplicate: options.onDuplicate ?? "update",
      defaultCourseId: options.defaultCourseId ?? null,
    },
  );

  const resultado = await applyImport(ctx.db, ctx.academy.id, job.id, evaluadas);

  await ctx.db.importJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      createdCount: resultado.creados,
      updatedCount: resultado.actualizados,
      skippedCount: resultado.saltados,
      errorCount: resultado.errores,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "import.run",
    entityType: "ImportJob",
    entityId: job.id,
    changes: resultado,
  });

  revalidatePath(`/gestion/importar/${job.id}`);
  revalidatePath("/gestion/alumnos");
}

/** Deshacer la importación completa. */
export async function rollbackImportAction(formData: FormData) {
  const ctx = await requirePermission("imports.rollback");
  const jobId = String(formData.get("jobId") ?? "");

  const job = await ctx.db.importJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true },
  });
  if (!job) throw new Error("Esa importación no existe.");
  if (job.status !== "COMPLETED") {
    throw new Error("Solo se puede revertir una importación completada.");
  }

  const resultado = await rollbackImport(ctx.db, job.id);

  await ctx.db.importJob.update({
    where: { id: job.id },
    data: { status: "ROLLED_BACK", rolledBackAt: new Date() },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "import.rollback",
    entityType: "ImportJob",
    entityId: job.id,
    changes: resultado,
  });

  revalidatePath(`/gestion/importar/${job.id}`);
  revalidatePath("/gestion/alumnos");
}

/** Datos de la previsualización: se calcula en cada visita, sin escribir nada. */
export async function previewImport(jobId: string) {
  const ctx = await requirePermission("imports.run");

  const job = await ctx.db.importJob.findUnique({ where: { id: jobId } });
  if (!job) return null;

  const filas = await ctx.db.importRow.findMany({
    where: { jobId },
    orderBy: { rowNumber: "asc" },
    select: { rowNumber: true, rawData: true, status: true, messages: true },
  });

  const options = job.options as {
    onDuplicate?: "update" | "skip";
    defaultCourseId?: string;
    headers?: string[];
  };

  if (job.status === "COMPLETED" || job.status === "ROLLED_BACK") {
    return {
      job,
      headers: options.headers ?? [],
      evaluadas: filas.map((f) => ({
        rowNumber: f.rowNumber,
        parsed: {} as Record<string, string | null>,
        status: f.status,
        messages: (f.messages as { level: "error" | "warning"; text: string }[]) ?? [],
        existingMembershipId: null,
        courseId: null,
        groupId: null,
      })),
      resumen: {
        total: filas.length,
        crear: job.createdCount,
        actualizar: job.updatedCount,
        saltar: job.skippedCount,
        errores: job.errorCount,
      },
    };
  }

  const evaluadas = await evaluateRows(
    ctx.db,
    filas.map((f) => ({
      rowNumber: f.rowNumber,
      rawData: f.rawData as Record<string, string>,
    })),
    job.columnMapping as Partial<Record<FieldKey, string>>,
    {
      onDuplicate: options.onDuplicate ?? "update",
      defaultCourseId: options.defaultCourseId ?? null,
    },
  );

  return {
    job,
    headers: options.headers ?? [],
    evaluadas,
    resumen: summarize(evaluadas),
  };
}
