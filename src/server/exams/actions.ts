"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireAcademy, requirePermission } from "@/lib/auth/context";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  buildStorageKey,
  isAllowedMime,
  storage,
} from "@/lib/storage";
import { GRACIA_SEGUNDOS, estadoDelExamen } from "./estado";

/**
 * EXÁMENES DE DESARROLLO · lo que hace el alumno
 *
 * Tres acciones y una idea detrás de las tres: **nunca se pierde lo escrito**.
 *
 * Un alumno que lleva cincuenta minutos redactando un supuesto no puede quedarse
 * sin nada porque se le fue la cobertura, porque cerró la pestaña sin querer o
 * porque el reloj llegó a cero mientras releía. Por eso el borrador se guarda
 * solo cada pocos segundos, se conserva aunque se agote el tiempo y, cuando se
 * agota, lo último guardado ES la entrega.
 *
 * La otra idea es que el reloj lo lleva el servidor. `startedAt` se escribe una
 * sola vez y no se puede mover; a partir de ahí la hora que cuenta es la de la
 * base de datos. Cambiar la hora del móvil, recargar o abrir el examen en otro
 * dispositivo no da un segundo de más.
 */

export type ExamState = { error?: string; ok?: string } | undefined;

/**
 * Comprueba que el examen es de este alumno y devuelve lo necesario para
 * decidir. Un identificador ajeno no pasa de aquí.
 */
async function cargarPropio(submissionId: string) {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("campus.access")) return { ctx, entrega: null } as const;

  const entrega = await ctx.db.submission.findFirst({
    where: {
      id: submissionId,
      studentId: ctx.membershipId,
      assignment: { kind: "EXAM", status: "PUBLISHED", deletedAt: null },
    },
    select: {
      id: true,
      status: true,
      body: true,
      startedAt: true,
      submittedAt: true,
      assignment: {
        select: {
          id: true,
          title: true,
          status: true,
          opensAt: true,
          dueAt: true,
          timeLimitMinutes: true,
          allowFiles: true,
          maxScore: true,
        },
      },
    },
  });

  return { ctx, entrega } as const;
}

/**
 * Empezar el examen. Arranca el reloj.
 *
 * El `updateMany` con `startedAt: null` en el filtro no es un adorno: es lo que
 * impide reiniciar el reloj. Si llegan dos peticiones a la vez —doble toque en
 * el móvil, o alguien probando— la segunda no encuentra fila que actualizar y no
 * pasa nada. Con un `update` normal, el segundo toque regalaría el tiempo entero.
 */
export async function iniciarExamenAction(
  _prev: ExamState,
  formData: FormData,
): Promise<ExamState> {
  const submissionId = String(formData.get("submissionId") ?? "");
  const { ctx, entrega } = await cargarPropio(submissionId);
  if (!entrega) return { error: "Ese examen no está disponible." };

  if (entrega.startedAt) return { ok: "El examen ya estaba empezado." };

  const estado = estadoDelExamen(entrega.assignment, entrega);
  if (estado.fase === "no_abierto") {
    return { error: "Todavía no ha llegado la hora de este examen." };
  }
  if (estado.fase === "caducado") {
    return { error: "Este examen ya está cerrado." };
  }
  if (estado.fase !== "disponible") {
    return { error: "Este examen no se puede empezar ahora." };
  }

  const { count } = await ctx.db.submission.updateMany({
    where: { id: entrega.id, studentId: ctx.membershipId, startedAt: null },
    data: { startedAt: new Date() },
  });

  if (count === 0) return { ok: "El examen ya estaba empezado." };

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "exam.start",
    entityType: "Submission",
    entityId: entrega.id,
    context: { examen: entrega.assignment.title },
  });

  revalidatePath(`/campus/examenes/${entrega.id}`);
  revalidatePath("/campus/examenes");
  return { ok: "Examen empezado." };
}

const borradorSchema = z.object({
  submissionId: z.string().min(1),
  body: z.string().max(200_000),
});

/**
 * Guardado automático del borrador.
 *
 * La llama la pantalla cada pocos segundos mientras se escribe. Devuelve los
 * segundos que quedan según el SERVIDOR, y con eso la pantalla corrige su cuenta
 * atrás: así el reloj que ve el alumno se mantiene pegado al que decide de
 * verdad, sin que el navegador tenga que acertar la hora.
 */
export async function guardarBorradorAction(input: {
  submissionId: string;
  body: string;
}): Promise<
  | { ok: true; guardadoEn: string; segundosRestantes: number | null }
  | { ok: false; error: string; cerrado?: boolean }
> {
  const parsed = borradorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Borrador no válido." };

  const { ctx, entrega } = await cargarPropio(parsed.data.submissionId);
  if (!entrega) return { ok: false, error: "Ese examen no está disponible." };

  if (entrega.status === "SUBMITTED" || entrega.status === "LATE" || entrega.status === "GRADED") {
    return { ok: false, error: "El examen ya está entregado.", cerrado: true };
  }

  const estado = estadoDelExamen(entrega.assignment, entrega);

  if (estado.fase === "tiempo_agotado") {
    // Se acabó mientras escribía. Se cierra con lo que hubiera guardado antes,
    // no con este envío: aceptar texto escrito después del pitido sería dar
    // tiempo de más a quien tenga peor conexión, que es justo al revés.
    await cerrarPorTiempo(ctx, entrega.id, entrega.assignment.title);
    return { ok: false, error: "Se ha agotado el tiempo.", cerrado: true };
  }

  if (estado.fase !== "en_curso") {
    return { ok: false, error: "Este examen no admite cambios ahora.", cerrado: true };
  }

  const ahora = new Date();
  await ctx.db.submission.update({
    where: { id: entrega.id },
    data: { body: parsed.data.body, draftSavedAt: ahora },
  });

  return {
    ok: true,
    guardadoEn: ahora.toISOString(),
    segundosRestantes: Number.isFinite(estado.segundosRestantes)
      ? estado.segundosRestantes
      : null,
  };
}

/**
 * Cierra un examen al que se le ha agotado el tiempo, con lo último guardado.
 *
 * Se llama desde donde se detecte: al guardar, al entregar, al abrir la pantalla
 * o desde el mantenimiento nocturno. Es idempotente —el filtro exige que siga
 * sin entregar— para que dos caminos a la vez no den dos entregas.
 */
async function cerrarPorTiempo(
  ctx: Awaited<ReturnType<typeof requireAcademy>>,
  submissionId: string,
  titulo: string,
) {
  const { count } = await ctx.db.submission.updateMany({
    where: { id: submissionId, submittedAt: null },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      autoSubmitted: true,
    },
  });

  if (count === 0) return;

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "exam.autosubmit",
    entityType: "Submission",
    entityId: submissionId,
    context: { examen: titulo, motivo: "tiempo agotado" },
  });
}

/** Entregar el examen a mano, antes de que se agote el tiempo. */
export async function entregarExamenAction(
  _prev: ExamState,
  formData: FormData,
): Promise<ExamState> {
  const submissionId = String(formData.get("submissionId") ?? "");
  const body = String(formData.get("body") ?? "");

  const { ctx, entrega } = await cargarPropio(submissionId);
  if (!entrega) return { error: "Ese examen no está disponible." };

  if (entrega.status !== "PENDING" && entrega.status !== "RETURNED") {
    return { error: "Este examen ya está entregado." };
  }

  const estado = estadoDelExamen(entrega.assignment, entrega);

  if (estado.fase === "tiempo_agotado") {
    // Margen de gracia: el alumno pudo pulsar a tiempo y tardar la red. Se mira
    // cuánto hace que venció; si cabe en el margen, se acepta este texto.
    const vencidoHace = (Date.now() - estado.terminoEn.getTime()) / 1000;
    if (vencidoHace > GRACIA_SEGUNDOS) {
      await cerrarPorTiempo(ctx, entrega.id, entrega.assignment.title);
      return {
        error:
          "Se agotó el tiempo. Se ha entregado automáticamente lo último que habías escrito.",
      };
    }
  } else if (estado.fase !== "en_curso") {
    return { error: "Este examen no se puede entregar ahora." };
  }

  const archivos = entrega.assignment.allowFiles
    ? formData.getAll("files").filter((f): f is File => f instanceof File)
    : [];

  await ctx.db.submission.update({
    where: { id: entrega.id },
    data: {
      // Si el envío final llega vacío se conserva el borrador. Un fallo de red a
      // mitad no puede borrar cincuenta minutos de examen.
      body: body.trim() ? body : entrega.body,
      status: "SUBMITTED",
      submittedAt: new Date(),
      draftSavedAt: new Date(),
    },
  });

  for (const archivo of archivos) {
    if (archivo.size === 0) continue;
    if (archivo.size > MAX_UPLOAD_BYTES) {
      return { error: `«${archivo.name}» supera los 32 MB.` };
    }
    if (!isAllowedMime(archivo.type)) {
      return {
        error: `Tipo de archivo no admitido: ${archivo.type || "desconocido"}. Admitimos ${[
          ...new Set(Object.values(ALLOWED_MIME)),
        ].join(", ")}.`,
      };
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());
    const key = buildStorageKey(ctx.academy.id, archivo.name);
    const guardado = await storage().put(key, buffer, archivo.type);

    const stored = await ctx.db.storedFile.create({
      data: {
        storageKey: guardado.key,
        storageDriver: storage().name,
        originalName: archivo.name,
        mimeType: archivo.type,
        sizeBytes: guardado.sizeBytes,
        checksumSha256: guardado.checksumSha256,
        uploadedById: ctx.membershipId,
      },
    });

    await ctx.db.submissionFile.create({
      data: { submissionId: entrega.id, fileId: stored.id },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "exam.submit",
    entityType: "Submission",
    entityId: entrega.id,
    context: { examen: entrega.assignment.title },
  });

  revalidatePath("/campus/examenes");
  revalidatePath("/gestion/tareas");
  return { ok: "Examen entregado." };
}

// ── Lado de la academia ──────────────────────────────────────────────────────

const examenSchema = z.object({
  title: z.string().trim().min(3, "Ponle un título al examen."),
  instructions: z.string().trim().max(20_000).optional(),
  groupId: z.string().trim().optional(),
  courseId: z.string().trim().optional(),
  nodeId: z.string().trim().optional(),
  opensAt: z.string().trim().optional(),
  dueAt: z.string().trim().optional(),
  timeLimitMinutes: z.coerce.number().int().min(5).max(600).optional(),
  maxScore: z.coerce.number().min(1).max(100).default(10),
  allowFiles: z.string().optional(),
  publicar: z.string().optional(),
});

/** La academia convoca un examen de desarrollo. */
export async function createExamAction(
  _prev: ExamState,
  formData: FormData,
): Promise<ExamState> {
  const ctx = await requirePermission("classes.write");
  const parsed = examenSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  let courseId = data.courseId || null;
  let editionId: string | null = null;

  if (data.groupId) {
    const grupo = await ctx.db.group.findUnique({
      where: { id: data.groupId },
      select: {
        courseId: true,
        course: { select: { oppositionEditionId: true } },
      },
    });
    if (!grupo) return { error: "Ese grupo no existe." };
    courseId = grupo.courseId;
    editionId = grupo.course.oppositionEditionId;
  } else if (courseId) {
    const curso = await ctx.db.course.findUnique({
      where: { id: courseId },
      select: { oppositionEditionId: true },
    });
    if (!curso) return { error: "Ese curso no existe." };
    editionId = curso.oppositionEditionId;
  } else {
    return { error: "Elige el curso o el grupo que hace el examen." };
  }

  const abre = data.opensAt ? new Date(data.opensAt) : null;
  const cierra = data.dueAt ? new Date(data.dueAt) : null;

  if (abre && cierra && cierra <= abre) {
    return { error: "El cierre tiene que ser posterior a la apertura." };
  }

  const publicado = data.publicar === "on";

  const examen = await ctx.db.assignment.create({
    data: {
      kind: "EXAM",
      title: data.title,
      instructions: data.instructions || null,
      courseId,
      groupId: data.groupId || null,
      editionId,
      nodeId: data.nodeId || null,
      opensAt: abre,
      dueAt: cierra,
      timeLimitMinutes: data.timeLimitMinutes ?? null,
      allowFiles: data.allowFiles !== "off",
      maxScore: data.maxScore,
      // Un examen no admite entregas tardías: el reloj es el reloj.
      allowLate: false,
      status: publicado ? "PUBLISHED" : "DRAFT",
      createdById: ctx.membershipId,
    },
  });

  if (publicado) {
    const matriculados = await ctx.db.enrollment.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "PAST_DUE"] },
        ...(data.groupId ? { groupId: data.groupId } : { courseId: courseId! }),
      },
      select: { studentId: true },
    });

    if (matriculados.length > 0) {
      // La entrega vacía se crea al publicar, no al empezar. Así el profesor ve
      // la lista completa de quién tiene el examen desde el primer momento, y
      // sabe quién no se ha presentado sin tener que cruzar nada.
      await ctx.db.submission.createMany({
        data: matriculados.map((m) => ({
          assignmentId: examen.id,
          studentId: m.studentId,
          status: "PENDING" as const,
        })),
        skipDuplicates: true,
      });

      await ctx.db.notification.createMany({
        data: matriculados.map((m) => ({
          recipientId: m.studentId,
          type: "exam.published",
          title: "Nuevo examen de desarrollo",
          body: abre
            ? `${data.title} · se abre el ${abre.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}`
            : data.title,
          actionUrl: "/campus/examenes",
          status: "SENT" as const,
          sentAt: new Date(),
        })),
      });
    }
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: publicado ? "exam.publish" : "exam.create",
    entityType: "Assignment",
    entityId: examen.id,
    changes: { titulo: data.title, minutos: data.timeLimitMinutes ?? null },
  });

  revalidatePath("/gestion/examenes");
  return {
    ok: publicado
      ? "Examen convocado y avisado al alumnado."
      : "Examen guardado en borrador.",
  };
}
