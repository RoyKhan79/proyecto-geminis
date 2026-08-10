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

/**
 * TAREAS Y ENTREGAS
 *
 * El profesor manda un supuesto práctico o un simulacro escrito, el alumno sube
 * su archivo y el profesor lo corrige y lo puntúa. Los tipo test se corrigen
 * solos; un supuesto lo tiene que leer una persona, y esto es lo que hace que
 * pueda hacerlo con orden.
 */

export type TaskState = { error?: string; ok?: string } | undefined;

const tareaSchema = z.object({
  title: z.string().trim().min(3, "Ponle un título."),
  instructions: z.string().trim().max(8000).optional(),
  groupId: z.string().trim().optional(),
  courseId: z.string().trim().optional(),
  nodeId: z.string().trim().optional(),
  dueAt: z.string().trim().optional(),
  maxScore: z.coerce.number().min(1).max(100).default(10),
  allowLate: z.string().optional(),
  publicar: z.string().optional(),
});

export async function createAssignmentAction(
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const ctx = await requirePermission("classes.write");
  const parsed = tareaSchema.safeParse(Object.fromEntries(formData.entries()));

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
    return { error: "Elige el curso o el grupo al que va dirigida." };
  }

  const publicada = data.publicar === "on";

  const tarea = await ctx.db.assignment.create({
    data: {
      title: data.title,
      instructions: data.instructions || null,
      courseId,
      groupId: data.groupId || null,
      editionId,
      nodeId: data.nodeId || null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      maxScore: data.maxScore,
      allowLate: data.allowLate !== "off",
      status: publicada ? "PUBLISHED" : "DRAFT",
      createdById: ctx.membershipId,
    },
  });

  // Al publicarla se crea la entrega vacía de cada alumno: así el profesor ve
  // desde el minuto uno quién falta, sin esperar a que alguien entregue.
  if (publicada) {
    const matriculados = await ctx.db.enrollment.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "PAST_DUE"] },
        ...(data.groupId ? { groupId: data.groupId } : { courseId: courseId! }),
      },
      select: { studentId: true },
    });

    if (matriculados.length > 0) {
      await ctx.db.submission.createMany({
        data: matriculados.map((m) => ({
          assignmentId: tarea.id,
          studentId: m.studentId,
          status: "PENDING" as const,
        })),
        skipDuplicates: true,
      });

      await ctx.db.notification.createMany({
        data: matriculados.map((m) => ({
          recipientId: m.studentId,
          type: "assignment.published",
          title: "Nueva tarea",
          body: data.dueAt
            ? `${data.title} · entrega antes del ${new Date(data.dueAt).toLocaleDateString("es-ES")}`
            : data.title,
          actionUrl: "/campus/tareas",
          status: "SENT" as const,
          sentAt: new Date(),
        })),
      });
    }
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: publicada ? "assignment.publish" : "assignment.create",
    entityType: "Assignment",
    entityId: tarea.id,
    changes: { titulo: data.title },
  });

  revalidatePath("/gestion/tareas");
  return { ok: publicada ? "Tarea publicada y avisada." : "Tarea guardada en borrador." };
}

/** El alumno entrega: texto y archivos. */
export async function submitAssignmentAction(
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const ctx = await requireAcademy();
  if (!ctx.permissions.has("campus.access")) return { error: "Sin acceso." };

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  const tarea = await ctx.db.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      status: true,
      dueAt: true,
      allowLate: true,
      groupId: true,
      courseId: true,
      deletedAt: true,
    },
  });
  if (!tarea || tarea.deletedAt || tarea.status !== "PUBLISHED") {
    return { error: "Esa tarea no está disponible." };
  }

  // El alumno tiene que estar matriculado donde va la tarea. Sin esto,
  // cualquiera con el identificador podría entregar en la clase de otro.
  const matricula = await ctx.db.enrollment.findFirst({
    where: {
      studentId: ctx.membershipId,
      deletedAt: null,
      status: { in: ["ACTIVE", "PAST_DUE"] },
      ...(tarea.groupId ? { groupId: tarea.groupId } : { courseId: tarea.courseId! }),
    },
    select: { id: true },
  });
  if (!matricula) return { error: "Esta tarea no es de tu clase." };

  const fueraDePlazo = Boolean(tarea.dueAt && tarea.dueAt.getTime() < Date.now());
  if (fueraDePlazo && !tarea.allowLate) {
    return { error: "El plazo de entrega ya se ha cerrado." };
  }

  const archivos = formData.getAll("files").filter((f): f is File => f instanceof File);

  const entrega = await ctx.db.submission.upsert({
    where: {
      assignmentId_studentId: { assignmentId, studentId: ctx.membershipId },
    },
    create: {
      assignmentId,
      studentId: ctx.membershipId,
      body: body || null,
      status: fueraDePlazo ? "LATE" : "SUBMITTED",
      submittedAt: new Date(),
    },
    update: {
      body: body || null,
      status: fueraDePlazo ? "LATE" : "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  for (const archivo of archivos) {
    if (archivo.size === 0) continue;
    if (archivo.size > MAX_UPLOAD_BYTES) {
      return { error: `«${archivo.name}» supera los 200 MB.` };
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

  revalidatePath("/campus/tareas");
  revalidatePath("/gestion/tareas");
  return {
    ok: fueraDePlazo
      ? "Entregado fuera de plazo. El profesor lo verá marcado."
      : "Entregado.",
  };
}

const correccionSchema = z.object({
  submissionId: z.string().min(1),
  score: z.coerce.number().min(0).max(100).optional(),
  feedback: z.string().trim().max(8000).optional(),
  devolver: z.string().optional(),
});

/** El profesor corrige: nota y comentario, o devuelve para rehacer. */
export async function gradeSubmissionAction(
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const ctx = await requirePermission("classes.write");
  const parsed = correccionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa la corrección." };
  }
  const data = parsed.data;

  const entrega = await ctx.db.submission.findUnique({
    where: { id: data.submissionId },
    select: {
      id: true,
      studentId: true,
      returnCount: true,
      assignment: { select: { title: true, maxScore: true } },
    },
  });
  if (!entrega) return { error: "Esa entrega no existe." };

  const devolver = data.devolver === "1";

  if (!devolver && data.score !== undefined) {
    const maximo = Number(entrega.assignment.maxScore);
    if (data.score > maximo) {
      return { error: `La nota no puede pasar de ${maximo}.` };
    }
  }

  await ctx.db.submission.update({
    where: { id: entrega.id },
    data: devolver
      ? {
          status: "RETURNED",
          feedback: data.feedback || null,
          returnCount: entrega.returnCount + 1,
          gradedById: ctx.membershipId,
          gradedAt: new Date(),
        }
      : {
          status: "GRADED",
          score: data.score ?? null,
          feedback: data.feedback || null,
          gradedById: ctx.membershipId,
          gradedAt: new Date(),
        },
  });

  await ctx.db.notification.create({
    data: {
      recipientId: entrega.studentId,
      type: devolver ? "assignment.returned" : "assignment.graded",
      title: devolver ? "Trabajo devuelto para rehacer" : "Trabajo corregido",
      body: devolver
        ? `«${entrega.assignment.title}»: revisa los comentarios y vuelve a entregarlo.`
        : `«${entrega.assignment.title}»: ${data.score ?? "—"} / ${entrega.assignment.maxScore}`,
      actionUrl: "/campus/tareas",
      status: "SENT",
      sentAt: new Date(),
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: devolver ? "submission.return" : "submission.grade",
    entityType: "Submission",
    entityId: entrega.id,
    changes: { nota: data.score ?? null },
  });

  revalidatePath("/gestion/tareas");
  revalidatePath("/campus/tareas");
  return { ok: devolver ? "Devuelto al alumno." : "Corregido." };
}

/** Sala online: alta y baja. */
export async function createRoomAction(
  _prev: TaskState,
  formData: FormData,
): Promise<TaskState> {
  const ctx = await requirePermission("classes.write");

  const schema = z.object({
    name: z.string().trim().min(3, "Ponle un nombre a la sala."),
    url: z.string().trim().url("El enlace no es válido."),
    description: z.string().trim().max(500).optional(),
    schedule: z.string().trim().max(160).optional(),
    groupId: z.string().trim().optional(),
    courseId: z.string().trim().optional(),
  });

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  await ctx.db.liveRoom.create({
    data: {
      name: parsed.data.name,
      url: parsed.data.url,
      description: parsed.data.description || null,
      schedule: parsed.data.schedule || null,
      groupId: parsed.data.groupId || null,
      courseId: parsed.data.courseId || null,
      createdById: ctx.membershipId,
      isOpen: true,
    },
  });

  revalidatePath("/gestion/salas");
  revalidatePath("/campus/salas");
  return { ok: "Sala creada." };
}

export async function toggleRoomAction(formData: FormData) {
  const ctx = await requirePermission("classes.write");
  const roomId = String(formData.get("roomId") ?? "");
  const abrir = String(formData.get("abrir") ?? "") === "1";

  await ctx.db.liveRoom.update({ where: { id: roomId }, data: { isOpen: abrir } });

  revalidatePath("/gestion/salas");
  revalidatePath("/campus/salas");
}

/**
 * Entrada a una sala. El enlace real NUNCA se pinta en la página del alumno:
 * se pasa por aquí, que comprueba que la sala es suya y está abierta, y de paso
 * queda registrado quién entra.
 */
export async function enterRoom(roomId: string): Promise<string | null> {
  const ctx = await requireAcademy();

  const sala = await ctx.db.liveRoom.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      url: true,
      isOpen: true,
      groupId: true,
      courseId: true,
      deletedAt: true,
    },
  });
  if (!sala || sala.deletedAt || !sala.isOpen) return null;

  if (!ctx.permissions.has("manager.access")) {
    const matricula = await ctx.db.enrollment.findFirst({
      where: {
        studentId: ctx.membershipId,
        deletedAt: null,
        status: { in: ["ACTIVE", "PAST_DUE"] },
        ...(sala.groupId
          ? { groupId: sala.groupId }
          : sala.courseId
            ? { courseId: sala.courseId }
            : {}),
      },
      select: { id: true },
    });
    if (!matricula) return null;
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "room.enter",
    entityType: "LiveRoom",
    entityId: sala.id,
  });

  return sala.url;
}
