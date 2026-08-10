"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";

/**
 * Clases.
 *
 * Para el MVP la videoconferencia es un enlace externo (Zoom, Meet, Teams…):
 * es lo que la academia ya usa y no aporta nada replicarlo. El proveedor queda
 * guardado para poder integrarlo de verdad más adelante sin migrar datos.
 */

export type ClassState = { error?: string; ok?: string } | undefined;

const classSchema = z.object({
  title: z.string().trim().min(3, "Ponle un título a la clase."),
  description: z.string().trim().max(2000).optional(),
  courseId: z.string().trim().optional(),
  groupId: z.string().trim().optional(),
  teacherId: z.string().trim().optional(),
  nodeId: z.string().trim().optional(),
  fecha: z.string().min(1, "Indica la fecha."),
  horaInicio: z.string().min(1, "Indica la hora de inicio."),
  duracion: z.coerce.number().int().min(15).max(600).default(90),
  location: z.string().trim().max(160).optional(),
  meetingUrl: z.string().trim().url("El enlace no es válido.").optional().or(z.literal("")),
});

export async function createClassAction(
  _prev: ClassState,
  formData: FormData,
): Promise<ClassState> {
  const ctx = await requirePermission("classes.write");
  const parsed = classSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const startsAt = new Date(`${data.fecha}T${data.horaInicio}:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: "La fecha no es válida." };
  const endsAt = new Date(startsAt.getTime() + data.duracion * 60 * 1000);

  // El grupo manda sobre el curso: si se elige grupo, la clase es de su curso.
  let courseId = data.courseId || null;
  let editionId: string | null = null;

  if (data.groupId) {
    const grupo = await ctx.db.group.findUnique({
      where: { id: data.groupId },
      select: { id: true, courseId: true, course: { select: { oppositionEditionId: true } } },
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
  }

  const clase = await ctx.db.classSession.create({
    data: {
      title: data.title,
      description: data.description || null,
      courseId,
      groupId: data.groupId || null,
      editionId,
      teacherId: data.teacherId || null,
      nodeId: data.nodeId || null,
      status: "SCHEDULED",
      startsAt,
      endsAt,
      durationMinutes: data.duracion,
      location: data.location || null,
      meetingUrl: data.meetingUrl || null,
      meetingProvider: data.meetingUrl ? "external" : null,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "class.create",
    entityType: "ClassSession",
    entityId: clase.id,
    changes: { titulo: data.title, cuando: startsAt.toISOString() },
  });

  // Aviso al alumnado del grupo: una clase nueva que nadie ve no sirve de nada.
  if (data.groupId) {
    const matriculados = await ctx.db.enrollment.findMany({
      where: { groupId: data.groupId, status: "ACTIVE", deletedAt: null },
      select: { studentId: true },
    });
    if (matriculados.length > 0) {
      await ctx.db.notification.createMany({
        data: matriculados.map((m) => ({
          recipientId: m.studentId,
          type: "class.created",
          title: "Nueva clase programada",
          body: `${data.title} · ${startsAt.toLocaleString("es-ES")}`,
          actionUrl: "/campus/calendario",
        })),
      });
    }
  }

  revalidatePath("/gestion/clases");
  return { ok: "Clase programada." };
}

const updateSchema = z.object({
  classId: z.string().min(1),
  status: z.enum(["SCHEDULED", "LIVE", "FINISHED", "CANCELLED"]).optional(),
  recordingUrl: z.string().trim().url("El enlace de la grabación no es válido.").optional().or(z.literal("")),
  summary: z.string().trim().max(4000).optional(),
});

export async function updateClassAction(
  _prev: ClassState,
  formData: FormData,
): Promise<ClassState> {
  const ctx = await requirePermission("classes.write");
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const { classId, status, recordingUrl, summary } = parsed.data;

  const clase = await ctx.db.classSession.findUnique({
    where: { id: classId },
    select: { id: true, title: true, groupId: true },
  });
  if (!clase) return { error: "Esa clase no existe." };

  await ctx.db.classSession.update({
    where: { id: classId },
    data: {
      ...(status ? { status } : {}),
      ...(recordingUrl !== undefined
        ? {
            recordingUrl: recordingUrl || null,
            recordingReadyAt: recordingUrl ? new Date() : null,
          }
        : {}),
      ...(summary !== undefined ? { summary: summary || null } : {}),
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "class.update",
    entityType: "ClassSession",
    entityId: classId,
    changes: { estado: status, grabacion: Boolean(recordingUrl) },
  });

  if (recordingUrl && clase.groupId) {
    const matriculados = await ctx.db.enrollment.findMany({
      where: { groupId: clase.groupId, status: "ACTIVE", deletedAt: null },
      select: { studentId: true },
    });
    if (matriculados.length > 0) {
      await ctx.db.notification.createMany({
        data: matriculados.map((m) => ({
          recipientId: m.studentId,
          type: "class.recording",
          title: "Grabación disponible",
          body: `Ya puedes ver la grabación de «${clase.title}».`,
          actionUrl: "/campus/calendario",
        })),
      });
    }
  }

  revalidatePath(`/gestion/clases/${classId}`);
  revalidatePath("/gestion/clases");
  return { ok: "Clase actualizada." };
}

export async function deleteClassAction(formData: FormData) {
  const ctx = await requirePermission("classes.write");
  const classId = String(formData.get("classId") ?? "");

  await ctx.db.classSession.update({
    where: { id: classId },
    data: { deletedAt: new Date(), status: "CANCELLED" },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "class.cancel",
    entityType: "ClassSession",
    entityId: classId,
  });

  revalidatePath("/gestion/clases");
}

/**
 * Pasar lista.
 *
 * Llega el estado de todos los alumnos de golpe: es más rápido que ir uno a uno
 * y evita dejar la lista a medias.
 */
export async function saveAttendanceAction(formData: FormData) {
  const ctx = await requirePermission("attendance.write");
  const classId = String(formData.get("classId") ?? "");

  const clase = await ctx.db.classSession.findUnique({
    where: { id: classId },
    select: { id: true, groupId: true, courseId: true },
  });
  if (!clase) throw new Error("Esa clase no existe.");

  const matriculados = await ctx.db.enrollment.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "PAST_DUE"] },
      ...(clase.groupId
        ? { groupId: clase.groupId }
        : clase.courseId
          ? { courseId: clase.courseId }
          : {}),
    },
    select: { studentId: true },
  });

  const validos = new Set(["PRESENT", "ABSENT", "EXCUSED", "ONLINE", "WATCHED_RECORDING"]);

  for (const matricula of matriculados) {
    const valor = String(formData.get(`asistencia.${matricula.studentId}`) ?? "ABSENT");
    if (!validos.has(valor)) continue;

    const estado = valor as "PRESENT" | "ABSENT" | "EXCUSED" | "ONLINE" | "WATCHED_RECORDING";

    await ctx.db.classAttendance.upsert({
      where: { classId_studentId: { classId, studentId: matricula.studentId } },
      create: { classId, studentId: matricula.studentId, status: estado },
      update: { status: estado },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "class.attendance",
    entityType: "ClassSession",
    entityId: classId,
    changes: { alumnos: matriculados.length },
  });

  revalidatePath(`/gestion/clases/${classId}`);
}
