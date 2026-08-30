"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";

/**
 * AGENDA · crear clases desde el calendario
 *
 * La diferencia con `server/classes/actions.ts` es la repetición. Una academia
 * no programa una clase: programa «los lunes y miércoles de 10 a 12, de
 * septiembre a junio». Crear eso a mano son ochenta formularios.
 *
 * Se generan sesiones reales, una por día, en lugar de guardar una regla de
 * repetición. Es más filas, pero permite lo que de verdad pasa: mover la clase
 * del 12 de octubre porque es festivo, cambiarle el profesor a una sola, o
 * anular la de Navidad. Con una regla, cada excepción es un caso especial.
 */

export type AgendaState = { error?: string; ok?: string } | undefined;

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];

const claseSchema = z.object({
  title: z.string().trim().min(3, "Ponle un título a la clase."),
  description: z.string().trim().max(2000).optional(),
  groupId: z.string().trim().optional(),
  teacherId: z.string().trim().optional(),
  nodeId: z.string().trim().optional(),
  fecha: z.string().min(1, "Indica la fecha."),
  horaInicio: z.string().min(1, "Indica la hora de inicio."),
  duracion: z.coerce.number().int().min(15).max(600).default(90),
  location: z.string().trim().max(160).optional(),
  meetingUrl: z
    .string()
    .trim()
    .url("El enlace no es válido.")
    .optional()
    .or(z.literal("")),

  /// Repetición: si se marca, se crean varias sesiones.
  repetir: z.string().optional(),
  hasta: z.string().trim().optional(),
});

/** Construye una fecha local a partir de «2026-09-14» y «10:00». */
function fechaLocal(dia: string, hora: string): Date | null {
  const [anio, mes, d] = dia.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  if ([anio, mes, d, h, m].some((n) => !Number.isFinite(n))) return null;
  return new Date(anio, mes - 1, d, h, m, 0, 0);
}

/**
 * Fechas en las que hay clase.
 *
 * Si no se repite, es solo la primera. Si se repite, todas las que caigan en
 * los días marcados hasta la fecha de fin, con un tope de 200 sesiones: pasado
 * eso, casi seguro que alguien se ha equivocado con la fecha final y lo que
 * quiere no es llenar la agenda de aquí a 2040.
 */
function calcularFechas(
  primera: Date,
  diasSemana: number[],
  hasta: Date | null,
): Date[] {
  if (diasSemana.length === 0 || !hasta) return [primera];

  const fechas: Date[] = [];
  const cursor = new Date(primera);

  // Se empieza el lunes de la semana de la primera clase, para no perder los
  // días marcados que caigan antes que ella en su misma semana... salvo los
  // anteriores a la fecha de inicio, que no tendrían sentido.
  while (cursor.getTime() <= hasta.getTime() && fechas.length < 200) {
    // getDay(): 0 domingo … 6 sábado. Aquí 0 es lunes.
    const indice = (cursor.getDay() + 6) % 7;
    if (diasSemana.includes(indice) && cursor.getTime() >= primera.getTime()) {
      fechas.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return fechas.length > 0 ? fechas : [primera];
}

/**
 * Crea clases en la agenda, de una en una o repetidas cada semana.
 *
 * @returns Cuántas se han creado, o el motivo.
 * @remarks Las fechas se manejan en hora **local**. Con `toISOString()`, una
 *   clase a las 00:00 en España se guardaría el día anterior, y el error se
 *   acumula sin que nadie lo note hasta que el calendario va corrido.
 */
export async function crearClasesAction(
  _prev: AgendaState,
  formData: FormData,
): Promise<AgendaState> {
  const ctx = await requirePermission("classes.write");
  const parsed = claseSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const primera = fechaLocal(data.fecha, data.horaInicio);
  if (!primera) return { error: "La fecha o la hora no son válidas." };

  // El grupo manda: la clase hereda su curso y su convocatoria.
  let courseId: string | null = null;
  let editionId: string | null = null;

  if (data.groupId) {
    const grupo = await ctx.db.group.findUnique({
      where: { id: data.groupId },
      select: {
        id: true,
        courseId: true,
        course: { select: { oppositionEditionId: true } },
      },
    });
    if (!grupo) return { error: "Ese grupo no existe." };
    courseId = grupo.courseId;
    editionId = grupo.course.oppositionEditionId;
  }

  const repite = data.repetir === "on";
  const diasSemana = repite
    ? DIAS.map((dia, i) => (formData.get(`dia.${dia}`) === "on" ? i : -1)).filter(
        (i) => i >= 0,
      )
    : [];

  if (repite && diasSemana.length === 0) {
    return { error: "Marca al menos un día de la semana para repetir." };
  }

  let hasta: Date | null = null;
  if (repite) {
    if (!data.hasta) return { error: "Indica hasta qué fecha se repite." };
    const fin = fechaLocal(data.hasta, "23:59");
    if (!fin) return { error: "La fecha de fin no es válida." };
    if (fin.getTime() < primera.getTime()) {
      return { error: "La fecha de fin es anterior a la de la primera clase." };
    }
    hasta = fin;
  }

  const fechas = calcularFechas(primera, diasSemana, hasta);

  // Se avisa de los solapes en lugar de bloquear: una academia puede tener dos
  // clases a la vez en aulas distintas, pero el mismo profesor en dos sitios a
  // la vez no, y eso conviene verlo antes de crear cuarenta sesiones.
  const solapes: string[] = [];

  if (data.teacherId) {
    const desde = fechas[0];
    const fin = new Date(fechas[fechas.length - 1]);
    fin.setDate(fin.getDate() + 1);

    const ocupadas = await ctx.db.classSession.findMany({
      where: {
        deletedAt: null,
        teacherId: data.teacherId,
        startsAt: { gte: desde, lt: fin },
      },
      select: { startsAt: true, endsAt: true, title: true },
    });

    for (const fecha of fechas) {
      const inicio = new Date(fecha);
      inicio.setHours(primera.getHours(), primera.getMinutes(), 0, 0);
      const final = new Date(inicio.getTime() + data.duracion * 60 * 1000);

      const choque = ocupadas.find(
        (o) => o.startsAt < final && o.endsAt > inicio,
      );
      if (choque) {
        solapes.push(
          `${inicio.toLocaleDateString("es-ES")} con «${choque.title}»`,
        );
      }
    }
  }

  let creadas = 0;

  for (const fecha of fechas) {
    const startsAt = new Date(fecha);
    startsAt.setHours(primera.getHours(), primera.getMinutes(), 0, 0);
    const endsAt = new Date(startsAt.getTime() + data.duracion * 60 * 1000);

    await ctx.db.classSession.create({
      data: {
        title: data.title,
        description: data.description || null,
        courseId,
        editionId,
        groupId: data.groupId || null,
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
    creadas += 1;
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: creadas > 1 ? "class.create_series" : "class.create",
    entityType: "ClassSession",
    changes: { titulo: data.title, sesiones: creadas },
  });

  revalidatePath("/gestion/agenda");
  revalidatePath("/gestion/clases");
  revalidatePath("/campus/calendario");

  const aviso =
    solapes.length > 0
      ? ` Ojo: el profesor ya tenía clase el ${solapes.slice(0, 3).join(", ")}${
          solapes.length > 3 ? ` y ${solapes.length - 3} días más` : ""
        }.`
      : "";

  return {
    ok:
      creadas === 1
        ? `Clase creada.${aviso}`
        : `${creadas} clases creadas.${aviso}`,
  };
}

const moverSchema = z.object({
  classId: z.string().min(1),
  fecha: z.string().min(1),
  horaInicio: z.string().min(1),
  duracion: z.coerce.number().int().min(15).max(600),
});

/** Mover o alargar una clase concreta sin tocar el resto de la serie. */
export async function moverClaseAction(
  _prev: AgendaState,
  formData: FormData,
): Promise<AgendaState> {
  const ctx = await requirePermission("classes.write");
  const parsed = moverSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) return { error: "Datos no válidos." };

  const clase = await ctx.db.classSession.findUnique({
    where: { id: parsed.data.classId },
    select: { id: true, title: true, startsAt: true, deletedAt: true },
  });
  if (!clase || clase.deletedAt) return { error: "Esa clase no existe." };

  const startsAt = fechaLocal(parsed.data.fecha, parsed.data.horaInicio);
  if (!startsAt) return { error: "La fecha o la hora no son válidas." };

  await ctx.db.classSession.update({
    where: { id: clase.id },
    data: {
      startsAt,
      endsAt: new Date(startsAt.getTime() + parsed.data.duracion * 60 * 1000),
      durationMinutes: parsed.data.duracion,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "class.move",
    entityType: "ClassSession",
    entityId: clase.id,
    changes: {
      titulo: clase.title,
      antes: clase.startsAt.toISOString(),
      ahora: startsAt.toISOString(),
    },
  });

  revalidatePath("/gestion/agenda");
  revalidatePath("/campus/calendario");
  return { ok: "Clase movida." };
}

/** Anular una clase concreta: se marca cancelada, no se borra. */
export async function cancelarClaseAction(formData: FormData) {
  const ctx = await requirePermission("classes.write");
  const classId = String(formData.get("classId") ?? "");

  const clase = await ctx.db.classSession.findUnique({
    where: { id: classId },
    select: { id: true, title: true, status: true },
  });
  if (!clase) return;

  // Cancelar y no borrar: el alumno tiene que ver en su calendario que esa
  // clase se anuló, no que nunca existió.
  await ctx.db.classSession.update({
    where: { id: clase.id },
    data: { status: clase.status === "CANCELLED" ? "SCHEDULED" : "CANCELLED" },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: clase.status === "CANCELLED" ? "class.restore" : "class.cancel",
    entityType: "ClassSession",
    entityId: clase.id,
    changes: { titulo: clase.title },
  });

  revalidatePath("/gestion/agenda");
  revalidatePath("/campus/calendario");
}
