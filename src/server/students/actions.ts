"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit, diff } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { prismaBase } from "@/lib/db/client";
import { addMemberToAcademy } from "@/server/academies/provision";
import { CAPACIDADES, capacidadesDisponibles } from "@/lib/access/capacidades";
import {
  anotarCambioDeFoto,
  guardarFotoDePersona,
  motivoParaRechazarFoto,
  quitarFotoDePersona,
} from "@/server/shared/foto";

/**
 * Acciones sobre alumnos.
 *
 * Cada acción comprueba el permiso EN EL SERVIDOR antes de tocar nada, valida
 * la entrada con Zod y deja rastro en la auditoría. Que la interfaz oculte un
 * botón no autoriza nada: la autorización se decide aquí.
 */

export type FormState = { error?: string; ok?: boolean } | undefined;

const studentSchema = z.object({
  firstName: z.string().trim().min(2, "El nombre es obligatorio."),
  lastName: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Introduce un correo válido."),
  phone: z.string().trim().max(30).optional(),
  code: z.string().trim().max(40).optional(),
  status: z.enum(["PENDING", "ACTIVE", "ON_HOLD", "INACTIVE", "ALUMNI"]),
  source: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
  courseId: z.string().trim().optional(),
  groupId: z.string().trim().optional(),
});

function readForm(formData: FormData) {
  const entries = Object.fromEntries(formData.entries());
  return studentSchema.safeParse({
    ...entries,
    status: entries.status || "ACTIVE",
  });
}

/**
 * Da de alta a un alumno.
 *
 * @returns Confirmación, o el motivo. Si ese correo ya existe en el sistema se
 *   le añade a esta academia en lugar de crear otra cuenta: la misma persona
 *   puede estudiar en dos academias con una sola contraseña.
 */
export async function createStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("students.write");
  const parsed = readForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const yaExiste = await ctx.db.membership.findFirst({
    where: { user: { email: data.email }, deletedAt: null },
    select: { id: true },
  });
  if (yaExiste) {
    return { error: "Ya hay una persona con ese correo en esta academia." };
  }

  const { membership } = await addMemberToAcademy(ctx.academy.id, {
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    roleKeys: ["STUDENT"],
  });

  await prismaBase.studentProfile.create({
    data: {
      membershipId: membership.id,
      code: data.code || null,
      status: data.status,
      source: data.source || null,
      notes: data.notes || null,
    },
  });

  // Matrícula opcional en el alta: es lo que hace la academia el 90 % de las
  // veces y ahorra un paso.
  if (data.courseId) {
    const course = await ctx.db.course.findUnique({
      where: { id: data.courseId },
      select: { id: true },
    });
    if (course) {
      await ctx.db.enrollment.create({
        data: {
          studentId: membership.id,
          courseId: course.id,
          groupId: data.groupId || null,
          status: "ACTIVE",
        },
      });
    }
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "student.create",
    entityType: "Membership",
    entityId: membership.id,
    changes: { email: data.email, nombre: `${data.firstName} ${data.lastName ?? ""}` },
  });

  revalidatePath("/gestion/alumnos");
  redirect(`/gestion/alumnos/${membership.id}`);
}

/**
 * Edita la ficha de un alumno.
 *
 * @remarks Queda registrado **qué campos** han cambiado, con su antes y su
 *   después. Guardar la fila entera haría el registro ilegible y arrastraría
 *   datos personales que no hacían falta.
 */
export async function updateStudentAction(
  membershipId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("students.write");
  const parsed = readForm(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const membership = await ctx.db.membership.findUnique({
    where: { id: membershipId },
    select: {
      id: true,
      userId: true,
      status: true,
      user: { select: { firstName: true, lastName: true, phone: true, email: true } },
      studentProfile: { select: { code: true, status: true, source: true, notes: true } },
    },
  });
  if (!membership?.studentProfile) return { error: "Ese alumno no existe." };

  await prismaBase.user.update({
    where: { id: membership.userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName || null,
      phone: data.phone || null,
    },
  });

  await prismaBase.studentProfile.update({
    where: { membershipId },
    data: {
      code: data.code || null,
      status: data.status,
      source: data.source || null,
      notes: data.notes || null,
    },
  });

  /*
   * La membresía va detrás del estado del alumno, no por libre.
   *
   * Dar de baja suspende la membresía, y `requireAcademy` solo carga las que
   * están activas. Si aquí se cambiara el estado del perfil sin tocarla, la
   * ficha diría «Activo» y el alumno seguiría sin poder entrar: la pantalla
   * enseñaría una cosa y la aplicación haría otra, que es la peor clase de
   * fallo porque nadie lo ve hasta que llama por teléfono.
   */
  const membresiaQueToca = data.status === "INACTIVE" ? "SUSPENDED" : "ACTIVE";
  if (membership.status !== membresiaQueToca) {
    await ctx.db.membership.update({
      where: { id: membershipId },
      data: { status: membresiaQueToca },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "student.update",
    entityType: "Membership",
    entityId: membershipId,
    changes: diff(
      {
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        phone: membership.user.phone,
        ...membership.studentProfile,
      },
      {
        firstName: data.firstName,
        lastName: data.lastName || null,
        phone: data.phone || null,
        code: data.code || null,
        status: data.status,
        source: data.source || null,
        notes: data.notes || null,
      },
    ),
  });

  revalidatePath(`/gestion/alumnos/${membershipId}`);
  revalidatePath("/gestion/alumnos");
  return { ok: true };
}

/**
 * Baja de un alumno.
 *
 * Es borrado lógico a propósito: dar de baja no puede destruir su historial
 * académico ni sus pagos. El borrado definitivo para RGPD es un proceso
 * distinto y explícito (docs/SECURITY_MODEL.md § RGPD).
 */
export async function archiveStudentAction(formData: FormData) {
  const ctx = await requirePermission("students.delete");
  const membershipId = String(formData.get("membershipId") ?? "");

  const membership = await ctx.db.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, studentProfile: { select: { id: true } } },
  });
  if (!membership?.studentProfile) throw new Error("Ese alumno no existe.");

  await prismaBase.studentProfile.update({
    where: { membershipId },
    data: { status: "INACTIVE" },
  });
  await ctx.db.membership.update({
    where: { id: membershipId },
    data: { status: "SUSPENDED" },
  });
  await ctx.db.enrollment.updateMany({
    where: { studentId: membershipId, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });
  await ctx.db.entitlement.updateMany({
    where: { studentId: membershipId, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "student.archive",
    entityType: "Membership",
    entityId: membershipId,
  });

  revalidatePath("/gestion/alumnos");
  redirect("/gestion/alumnos");
}

/**
 * Alta de un alumno que estaba de baja.
 *
 * Es la inversa de {@link archiveStudentAction}, y hacía falta que existiera:
 * la baja suspende la membresía, y sin nada que la devuelva a activa el alumno
 * se quedaba fuera para siempre. Cambiar el estado en el desplegable de la
 * ficha no bastaba, porque eso solo tocaba el perfil.
 *
 * Lo que NO hace es resucitar las matrículas ni los derechos de acceso que la
 * baja canceló. Volver a la academia y volver a tener pagado un curso son dos
 * cosas distintas: devolver el acceso a un temario porque alguien pulsó «dar
 * de alta» es regalar producto sin que nadie lo haya decidido. Se vuelve a
 * matricular a mano, que es un acto deliberado y queda registrado.
 */
export async function restoreStudentAction(formData: FormData) {
  const ctx = await requirePermission("students.write");
  const membershipId = String(formData.get("membershipId") ?? "");

  const membership = await ctx.db.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, studentProfile: { select: { id: true } } },
  });
  if (!membership?.studentProfile) throw new Error("Ese alumno no existe.");

  await prismaBase.studentProfile.update({
    where: { membershipId },
    data: { status: "ACTIVE" },
  });
  await ctx.db.membership.update({
    where: { id: membershipId },
    data: { status: "ACTIVE" },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "student.restore",
    entityType: "Membership",
    entityId: membershipId,
  });

  revalidatePath(`/gestion/alumnos/${membershipId}`);
  revalidatePath("/gestion/alumnos");
}

const accesoSchema = z.object({
  membershipId: z.string().min(1),
  editionId: z.string().min(1, "Elige una convocatoria."),
  capacidades: z.array(z.enum(CAPACIDADES.map((c) => c.codigo) as [string, ...string[]])),
  /// Vacío = sin caducidad.
  endsAt: z.string().trim().optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * QUÉ HERRAMIENTAS TIENE ESTE ALUMNO EN ESTA CONVOCATORIA
 *
 * El equivalente, un piso más abajo, de lo que hace la plataforma con los
 * módulos de la academia: allí se decide qué paneles ve la academia según lo
 * que paga; aquí, qué herramientas ve el alumno según lo que le paga a su
 * academia.
 *
 * Se guarda como un derecho de origen MANUAL por convocatoria, con un alcance
 * por capacidad marcada. Reescribe los alcances enteros en lugar de ir
 * añadiendo y quitando: el formulario manda el estado final, y comparar listas
 * es una fuente de fallos que aquí no compensa.
 *
 * Desmarcarlo todo revoca el derecho, no lo borra. Qué tuvo abierto un alumno y
 * hasta cuándo es exactamente lo que hay que poder consultar cuando alguien
 * reclama.
 */
export async function guardarAccesoAlumnoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("students.write");

  const parsed = accesoSchema.safeParse({
    membershipId: String(formData.get("membershipId") ?? ""),
    editionId: String(formData.get("editionId") ?? ""),
    capacidades: formData.getAll("capacidades").map(String),
    endsAt: String(formData.get("endsAt") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  /*
   * La academia no puede abrirle al alumno algo que ella no tiene contratado.
   * La interfaz ya esconde esas casillas, pero esconder no es autorizar: el
   * formulario se puede enviar a mano.
   */
  const permitidas = new Set(
    capacidadesDisponibles(ctx.modulos).map((c) => c.codigo),
  );
  const sobran = data.capacidades.filter((c) => !permitidas.has(c as never));
  if (sobran.length > 0) {
    return {
      error:
        "Tu academia no tiene contratado el módulo que hace falta para alguna de esas herramientas.",
    };
  }

  const alumno = await ctx.db.membership.findUnique({
    where: { id: data.membershipId },
    select: { id: true, studentProfile: { select: { id: true } } },
  });
  if (!alumno?.studentProfile) return { error: "Ese alumno no existe." };

  // La convocatoria tiene que ser de ESTA academia. `ctx.db` ya filtra por
  // inquilino, así que si no aparece es que no lo es.
  const convocatoria = await ctx.db.oppositionEdition.findUnique({
    where: { id: data.editionId },
    select: { id: true },
  });
  if (!convocatoria) return { error: "Esa convocatoria no existe." };

  const caduca = data.endsAt ? new Date(`${data.endsAt}T23:59:59.999Z`) : null;
  if (caduca && Number.isNaN(caduca.getTime())) {
    return { error: "La fecha de caducidad no es válida." };
  }

  const manuales = await ctx.db.entitlement.findMany({
    where: { studentId: data.membershipId, source: "MANUAL" },
    select: { id: true, scopes: { select: { editionId: true, capability: true } } },
  });
  const existente = manuales.find((e) =>
    e.scopes.some((alcance) => alcance.editionId === data.editionId),
  );
  const antes = existente
    ? existente.scopes
        .filter((a) => a.editionId === data.editionId)
        .map((a) => a.capability)
        .sort()
    : [];

  if (data.capacidades.length === 0) {
    if (existente) {
      await ctx.db.entitlement.update({
        where: { id: existente.id },
        data: { status: "CANCELLED", endsAt: new Date() },
      });
    }
  } else if (existente) {
    await prismaBase.entitlementScope.deleteMany({
      where: { entitlementId: existente.id, editionId: data.editionId },
    });
    await ctx.db.entitlement.update({
      where: { id: existente.id },
      data: {
        status: "ACTIVE",
        endsAt: caduca,
        note: data.note || null,
        scopes: {
          create: data.capacidades.map((capability) => ({
            editionId: data.editionId,
            capability: capability as never,
          })),
        },
      },
    });
  } else {
    await ctx.db.entitlement.create({
      data: {
        studentId: data.membershipId,
        source: "MANUAL",
        status: "ACTIVE",
        endsAt: caduca,
        grantedById: ctx.membershipId,
        note: data.note || null,
        scopes: {
          create: data.capacidades.map((capability) => ({
            editionId: data.editionId,
            capability: capability as never,
          })),
        },
      },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "entitlement.grant",
    entityType: "Membership",
    entityId: data.membershipId,
    changes: diff(
      { editionId: data.editionId, capacidades: antes.join(", ") },
      { editionId: data.editionId, capacidades: [...data.capacidades].sort().join(", ") },
    ),
  });

  revalidatePath(`/gestion/alumnos/${data.membershipId}`);
  return { ok: true };
}

const enrollmentSchema = z.object({
  membershipId: z.string().min(1),
  courseId: z.string().min(1, "Elige un curso."),
  groupId: z.string().optional(),
  priceCents: z.coerce.number().int().min(0).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * Matricula a un alumno y le concede el acceso correspondiente.
 *
 * Aquí se ve el modelo del producto: matricular NO da acceso por sí solo. Se
 * crea además un derecho de acceso (§109). Si el curso tiene un producto
 * asociado se copian sus concesiones; si no, el derecho cubre la convocatoria
 * completa, que es lo que espera una academia que vende "el curso entero".
 */
export async function enrollStudentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("enrollments.write");
  const parsed = enrollmentSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const yaMatriculado = await ctx.db.enrollment.findFirst({
    where: { studentId: data.membershipId, courseId: data.courseId, deletedAt: null },
    select: { id: true },
  });
  if (yaMatriculado) return { error: "El alumno ya está matriculado en ese curso." };

  const course = await ctx.db.course.findUnique({
    where: { id: data.courseId },
    select: { id: true, oppositionEditionId: true },
  });
  if (!course) return { error: "Ese curso no existe." };

  const enrollment = await ctx.db.enrollment.create({
    data: {
      studentId: data.membershipId,
      courseId: course.id,
      groupId: data.groupId || null,
      status: "ACTIVE",
      priceCents: data.priceCents ?? null,
      notes: data.notes || null,
    },
  });

  const producto = await ctx.db.product.findFirst({
    where: { courseId: course.id, status: "ACTIVE" },
    select: { id: true, grants: { select: { nodeId: true, capability: true } } },
  });

  await ctx.db.entitlement.create({
    data: {
      studentId: data.membershipId,
      enrollmentId: enrollment.id,
      productId: producto?.id ?? null,
      source: producto ? "PRODUCT" : "ENROLLMENT",
      status: "ACTIVE",
      ...(producto && producto.grants.length > 0
        ? {
            scopes: {
              create: producto.grants.map((grant) => ({
                nodeId: grant.nodeId,
                capability: grant.capability,
              })),
            },
          }
        : {}),
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "enrollment.create",
    entityType: "Enrollment",
    entityId: enrollment.id,
    changes: { courseId: course.id, groupId: data.groupId || null },
  });

  revalidatePath(`/gestion/alumnos/${data.membershipId}`);
  revalidatePath("/gestion/matriculas");
  return { ok: true };
}

/**
 * Sube o cambia la foto de un alumno.
 *
 * @param formData `membershipId` y `foto`.
 * @returns Confirmación, o el motivo.
 * @remarks El trabajo está en `@/server/shared/foto`: es idéntico para el
 *   profesorado y no tiene sentido tenerlo dos veces. Lo que cambia y se decide
 *   AQUÍ es el permiso —`students.write`— y qué queda escrito en la auditoría.
 */
export async function subirFotoAlumnoAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("students.write");

  const membershipId = String(formData.get("membershipId") ?? "");
  const foto = formData.get("foto");

  const motivo = motivoParaRechazarFoto(foto);
  if (motivo) return { error: motivo };

  const alumnoId = await guardarFotoDePersona(
    ctx.db,
    ctx.academy.id,
    membershipId,
    ctx.membershipId,
    foto as File,
  );
  if (!alumnoId) return { error: "Ese alumno no existe." };

  await anotarCambioDeFoto(ctx.academy.id, ctx.user.id, alumnoId, "student.photo");

  revalidatePath(`/gestion/alumnos/${alumnoId}`);
  revalidatePath("/gestion/alumnos");
  return { ok: true };
}

/**
 * Quita la foto de un alumno.
 *
 * @remarks No borra el archivo del almacén: la limpieza de archivos huérfanos
 *   es otra tarea, y borrar aquí dejaría rota cualquier referencia que hubiera
 *   quedado por el camino. Lo que se quita es el enlace desde la persona.
 */
export async function quitarFotoAlumnoAction(formData: FormData) {
  const ctx = await requirePermission("students.write");
  const membershipId = String(formData.get("membershipId") ?? "");

  const alumnoId = await quitarFotoDePersona(ctx.db, membershipId);
  if (!alumnoId) return;

  await anotarCambioDeFoto(
    ctx.academy.id,
    ctx.user.id,
    alumnoId,
    "student.photo.remove",
  );

  revalidatePath(`/gestion/alumnos/${alumnoId}`);
  revalidatePath("/gestion/alumnos");
}
