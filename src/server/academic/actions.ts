"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { diff, recordAudit } from "@/lib/audit";
import {
  anotarCambioDeFoto,
  guardarFotoDePersona,
  motivoParaRechazarFoto,
  quitarFotoDePersona,
} from "@/server/shared/foto";
import { requirePermission } from "@/lib/auth/context";
import { transaccionDeAcademia } from "@/lib/db/tenant";
import { slugify } from "@/lib/utils";
import { createContentNode } from "@/server/content/tree";

/**
 * Acciones sobre la estructura académica: oposiciones, convocatorias, cursos y
 * grupos. Mismas reglas que en el resto: permiso en servidor, validación con
 * Zod y auditoría.
 */

export type FormState = { error?: string; ok?: boolean } | undefined;

// ── Oposiciones ──────────────────────────────────────────────────────────────

const oppositionSchema = z.object({
  name: z.string().trim().min(3, "El nombre es obligatorio."),
  typeId: z.string().trim().optional(),
  code: z.string().trim().max(40).optional(),
  authority: z.string().trim().max(160).optional(),
  scope: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  editionName: z.string().trim().min(1, "Indica el nombre de la convocatoria."),
  editionYear: z.coerce.number().int().min(2000).max(2100).optional(),
  examDate: z.string().trim().optional(),
});

/**
 * Crea una oposición con su primera convocatoria y unas secciones iniciales.
 *
 * Las secciones se crean con nombres corrientes ("Temario", "Clases"…) solo
 * como punto de partida: la academia las renombra, borra o añade a su gusto.
 * Catedria no depende de esos nombres para nada (ADR-0006).
 */
export async function createOppositionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("oppositions.write");
  const parsed = oppositionSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const slug = slugify(data.name);
  const existe = await ctx.db.opposition.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true },
  });
  if (existe) return { error: "Ya existe una oposición con ese nombre." };

  const opposition = await ctx.db.opposition.create({
    data: {
      name: data.name,
      slug,
      typeId: data.typeId || null,
      code: data.code || null,
      authority: data.authority || null,
      scope: data.scope || null,
      description: data.description || null,
      status: "ACTIVE",
    },
  });

  const edition = await ctx.db.oppositionEdition.create({
    data: {
      oppositionId: opposition.id,
      name: data.editionName,
      year: data.editionYear ?? null,
      examDate: data.examDate ? new Date(data.examDate) : null,
      status: "OPEN",
      isDefault: true,
    },
  });

  for (const [position, seccion] of [
    { label: "Temario", sectionKind: "SYLLABUS" as const },
    { label: "Clases", sectionKind: "CLASSES" as const },
    { label: "Tests y simulacros", sectionKind: "TESTS" as const },
  ].entries()) {
    await createContentNode(ctx.db, {
      editionId: edition.id,
      kind: "SECTION",
      sectionKind: seccion.sectionKind,
      label: seccion.label,
      status: "PUBLISHED",
      position,
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "opposition.create",
    entityType: "Opposition",
    entityId: opposition.id,
    changes: { name: data.name, convocatoria: data.editionName },
  });

  revalidatePath("/gestion/oposiciones");
  return { ok: true };
}

// ── Convocatorias ────────────────────────────────────────────────────────────

const editionSchema = z.object({
  oppositionId: z.string().min(1),
  name: z.string().trim().min(1, "Indica el nombre de la convocatoria."),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  examDate: z.string().trim().optional(),
});

/**
 * Crea una convocatoria de una oposición.
 *
 * La convocatoria es de la que cuelgan el temario y las preguntas, y por eso
 * una nueva no obliga a rehacer nada: se duplica lo que sirva.
 *
 * @returns Confirmación, o el motivo.
 */
export async function createEditionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("oppositions.write");
  const parsed = editionSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const opposition = await ctx.db.opposition.findUnique({
    where: { id: data.oppositionId },
    select: { id: true },
  });
  if (!opposition) return { error: "Esa oposición no existe." };

  const edition = await ctx.db.oppositionEdition.create({
    data: {
      oppositionId: opposition.id,
      name: data.name,
      year: data.year ?? null,
      examDate: data.examDate ? new Date(data.examDate) : null,
      status: "OPEN",
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "edition.create",
    entityType: "OppositionEdition",
    entityId: edition.id,
    changes: { name: data.name },
  });

  revalidatePath("/gestion/oposiciones");
  return { ok: true };
}

// ── Cursos ───────────────────────────────────────────────────────────────────

const courseSchema = z.object({
  oppositionEditionId: z.string().min(1, "Elige una convocatoria."),
  name: z.string().trim().min(2, "El nombre del curso es obligatorio."),
  code: z.string().trim().max(40).optional(),
  modality: z.enum(["PRESENCIAL", "ONLINE", "HIBRIDO"]),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  capacity: z.coerce.number().int().min(0).optional(),
});

/**
 * Crea un curso: lo que la academia vende.
 *
 * @returns Confirmación, o el motivo.
 * @remarks El curso lleva asociados los derechos de acceso al contenido, así
 *   que matricular a alguien en él es lo que le abre el temario. No hay que
 *   hacer las dos cosas por separado.
 */
export async function createCourseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("courses.write");
  const parsed = courseSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const edition = await ctx.db.oppositionEdition.findUnique({
    where: { id: data.oppositionEditionId },
    select: { id: true },
  });
  if (!edition) return { error: "Esa convocatoria no existe." };

  const course = await ctx.db.course.create({
    data: {
      oppositionEditionId: edition.id,
      name: data.name,
      code: data.code || null,
      modality: data.modality,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      capacity: data.capacity ?? null,
      status: "ACTIVE",
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "course.create",
    entityType: "Course",
    entityId: course.id,
    changes: { name: data.name },
  });

  revalidatePath("/gestion/cursos");
  return { ok: true };
}

// ── Grupos ───────────────────────────────────────────────────────────────────

const groupSchema = z.object({
  courseId: z.string().min(1, "Elige un curso."),
  name: z.string().trim().min(1, "El nombre del grupo es obligatorio."),
  schedule: z.string().trim().max(160).optional(),
  modality: z.enum(["PRESENCIAL", "ONLINE", "HIBRIDO"]),
  capacity: z.coerce.number().int().min(0).optional(),
});

/**
 * Crea un grupo: la clase concreta, con su horario y su profesor.
 *
 * @returns Confirmación, o el motivo.
 * @remarks El grupo manda sobre el **ritmo** al que se abre el temario, así que
 *   conviene tenerlos creados antes de subir contenido.
 */
export async function createGroupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("groups.write");
  const parsed = groupSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const course = await ctx.db.course.findUnique({
    where: { id: data.courseId },
    select: { id: true },
  });
  if (!course) return { error: "Ese curso no existe." };

  const group = await ctx.db.group.create({
    data: {
      courseId: course.id,
      name: data.name,
      schedule: data.schedule || null,
      modality: data.modality,
      capacity: data.capacity ?? null,
      status: "ACTIVE",
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "group.create",
    entityType: "Group",
    entityId: group.id,
    changes: { name: data.name },
  });

  revalidatePath("/gestion/cursos");
  return { ok: true };
}

// ── Profesores ───────────────────────────────────────────────────────────────

const teacherSchema = z.object({
  firstName: z.string().trim().min(2, "El nombre es obligatorio."),
  lastName: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Introduce un correo válido."),
  phone: z.string().trim().max(30).optional(),
  headline: z.string().trim().max(120).optional(),
  specialties: z.string().trim().max(400).optional(),
});

/**
 * Da de alta a un profesor o a personal administrativo.
 *
 * @returns Confirmación, o el motivo. Si ese correo ya existe en el sistema, se
 *   le añade a esta academia en lugar de crear una cuenta nueva: la misma
 *   persona puede dar clase en dos academias sin tener dos contraseñas.
 */
export async function createTeacherAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("teachers.write");
  const parsed = teacherSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const { addMemberToAcademy } = await import("@/server/academies/provision");
  const { prismaBase } = await import("@/lib/db/client");

  const existente = await ctx.db.membership.findFirst({
    where: { user: { email: data.email }, deletedAt: null },
    select: { id: true, teacherProfile: { select: { id: true } } },
  });
  if (existente?.teacherProfile) {
    return { error: "Ya hay un profesor con ese correo en esta academia." };
  }

  const { membership } = await addMemberToAcademy(ctx.academy.id, {
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    roleKeys: ["TEACHER"],
  });

  await prismaBase.teacherProfile.upsert({
    where: { membershipId: membership.id },
    create: {
      membershipId: membership.id,
      headline: data.headline || null,
      specialties: splitSpecialties(data.specialties),
    },
    update: {
      headline: data.headline || null,
      specialties: splitSpecialties(data.specialties),
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "teacher.create",
    entityType: "Membership",
    entityId: membership.id,
    changes: { email: data.email },
  });

  revalidatePath("/gestion/profesores");
  return { ok: true };
}

const editarProfesorSchema = teacherSchema.extend({
  membershipId: z.string().min(1),
});

/**
 * Cambia los datos de un profesor.
 *
 * El correo se puede cambiar porque la gente cambia de correo, pero **no se
 * toca la cuenta de otra persona**: si el nuevo ya lo tiene alguien distinto,
 * se rechaza. Sin esa comprobación, escribir el correo de un compañero
 * secuestraría su acceso.
 *
 * @param formData `membershipId` y los mismos campos que el alta.
 * @returns Confirmación, o el motivo.
 */
export async function updateTeacherAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("teachers.write");
  const parsed = editarProfesorSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const { prismaBase } = await import("@/lib/db/client");

  const profesor = await ctx.db.membership.findUnique({
    where: { id: data.membershipId },
    select: {
      id: true,
      userId: true,
      user: { select: { email: true, firstName: true, lastName: true, phone: true } },
      teacherProfile: { select: { headline: true, specialties: true } },
    },
  });
  if (!profesor?.teacherProfile) return { error: "Ese profesor no existe." };

  if (data.email !== profesor.user.email) {
    const ocupado = await prismaBase.user.findFirst({
      where: { email: data.email, id: { not: profesor.userId } },
      select: { id: true },
    });
    if (ocupado) {
      return { error: "Ese correo ya es de otra persona." };
    }
  }

  await prismaBase.user.update({
    where: { id: profesor.userId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName || null,
      email: data.email,
      phone: data.phone || null,
    },
  });

  /*
   * El perfil se actualiza A TRAVÉS de la matrícula, no directamente.
   *
   * `TeacherProfile` no tiene `academyId` —cuelga de `Membership`, que sí lo
   * tiene—, así que el guardián de academia no deja tocarlo por su cuenta: no
   * podría comprobar que ese perfil es de esta academia. Escrito así, el filtro
   * va sobre la matrícula y Row Level Security se aplica igual que en todo lo
   * demás.
   */
  await ctx.db.membership.update({
    where: { id: profesor.id },
    data: {
      teacherProfile: {
        update: {
          headline: data.headline || null,
          specialties: splitSpecialties(data.specialties),
        },
      },
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "teacher.update",
    entityType: "Membership",
    entityId: profesor.id,
    changes: diff(
      {
        nombre: `${profesor.user.firstName} ${profesor.user.lastName ?? ""}`.trim(),
        correo: profesor.user.email,
        telefono: profesor.user.phone,
        titulo: profesor.teacherProfile.headline,
        especialidades: profesor.teacherProfile.specialties.join(", "),
      },
      {
        nombre: `${data.firstName} ${data.lastName ?? ""}`.trim(),
        correo: data.email,
        telefono: data.phone || null,
        titulo: data.headline || null,
        especialidades: splitSpecialties(data.specialties).join(", "),
      },
    ),
  });

  revalidatePath(`/gestion/profesores/${profesor.id}`);
  revalidatePath("/gestion/profesores");
  return { ok: true };
}

/**
 * Sube o cambia la foto de un profesor.
 *
 * Mismo trabajo que la del alumnado y el mismo código
 * (`@/server/shared/foto`). Lo que cambia, y por eso son dos acciones y no una,
 * es el permiso: quien lleva las matrículas no tiene por qué poder cambiarle la
 * cara a un compañero.
 */
export async function subirFotoProfesorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("teachers.write");

  const membershipId = String(formData.get("membershipId") ?? "");
  const foto = formData.get("foto");

  const motivo = motivoParaRechazarFoto(foto);
  if (motivo) return { error: motivo };

  const profesorId = await guardarFotoDePersona(
    ctx.db,
    ctx.academy.id,
    membershipId,
    ctx.membershipId,
    foto as File,
  );
  if (!profesorId) return { error: "Ese profesor no existe." };

  await anotarCambioDeFoto(ctx.academy.id, ctx.user.id, profesorId, "teacher.photo");

  revalidatePath(`/gestion/profesores/${profesorId}`);
  revalidatePath("/gestion/profesores");
  return { ok: true };
}

/** Quita la foto de un profesor. */
export async function quitarFotoProfesorAction(formData: FormData) {
  const ctx = await requirePermission("teachers.write");
  const membershipId = String(formData.get("membershipId") ?? "");

  const profesorId = await quitarFotoDePersona(ctx.db, membershipId);
  if (!profesorId) return;

  await anotarCambioDeFoto(
    ctx.academy.id,
    ctx.user.id,
    profesorId,
    "teacher.photo.remove",
  );

  revalidatePath(`/gestion/profesores/${profesorId}`);
  revalidatePath("/gestion/profesores");
}

// ── Editar y archivar oposiciones ────────────────────────────────────────────

const editarOposicionSchema = z.object({
  oppositionId: z.string().min(1),
  name: z.string().trim().min(3, "El nombre es obligatorio."),
  typeId: z.string().trim().optional(),
  code: z.string().trim().max(40).optional(),
  authority: z.string().trim().max(160).optional(),
  scope: z.string().trim().max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

/**
 * Editar una oposición.
 *
 * El `slug` se recalcula al cambiar el nombre, pero solo si el nuevo está
 * libre. Es la parte delicada: el slug se usa en rutas y referencias, y dos
 * oposiciones con el mismo nombre en una academia serían indistinguibles para
 * quien las gestiona.
 */
export async function updateOppositionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("oppositions.write");
  const parsed = editarOposicionSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const actual = await ctx.db.opposition.findUnique({
    where: { id: data.oppositionId },
    select: { id: true, name: true, slug: true, deletedAt: true },
  });
  if (!actual || actual.deletedAt) return { error: "Esa oposición no existe." };

  const slug = slugify(data.name);
  if (slug !== actual.slug) {
    const ocupado = await ctx.db.opposition.findFirst({
      where: { slug, deletedAt: null, NOT: { id: actual.id } },
      select: { id: true },
    });
    if (ocupado) return { error: "Ya existe otra oposición con ese nombre." };
  }

  await ctx.db.opposition.update({
    where: { id: actual.id },
    data: {
      name: data.name,
      slug,
      typeId: data.typeId || null,
      code: data.code || null,
      authority: data.authority || null,
      scope: data.scope || null,
      description: data.description || null,
      status: data.status,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "opposition.update",
    entityType: "Opposition",
    entityId: actual.id,
    changes: { antes: actual.name, ahora: data.name, estado: data.status },
  });

  revalidatePath("/gestion/oposiciones");
  return { ok: true };
}

/**
 * Eliminar una oposición.
 *
 * Es un borrado lógico, y con una comprobación delante que importa: si hay
 * alumnos matriculados en alguno de sus cursos, no se borra. Hacerlo dejaría
 * gente pagando por algo que ha desaparecido de su Campus sin explicación, y
 * eso se arregla mal después.
 *
 * Para una oposición que ya no se prepara pero que tuvo alumnos, lo correcto es
 * archivarla: deja de aparecer para dar de alta y conserva el histórico.
 */
export async function deleteOppositionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("oppositions.write");
  const oppositionId = String(formData.get("oppositionId") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "").trim();

  const oposicion = await ctx.db.opposition.findUnique({
    where: { id: oppositionId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!oposicion || oposicion.deletedAt) return { error: "Esa oposición no existe." };

  // Se pide escribir el nombre. Un botón de borrar detrás de un "¿seguro?" se
  // pulsa sin leer; escribir el nombre obliga a mirar qué se está borrando.
  if (confirmacion !== oposicion.name) {
    return {
      error: `Para eliminarla, escribe exactamente su nombre: ${oposicion.name}`,
    };
  }

  const matriculados = await ctx.db.enrollment.count({
    where: {
      deletedAt: null,
      course: { oppositionEdition: { oppositionId: oposicion.id } },
    },
  });

  if (matriculados > 0) {
    return {
      error: `No se puede eliminar: hay ${matriculados} ${
        matriculados === 1 ? "alumno matriculado" : "alumnos matriculados"
      } en sus cursos. Archívala si ya no la preparas: dejará de aparecer al dar de alta y conservarás el histórico.`,
    };
  }

  const ahora = new Date();

  // El borrado baja en cascada por las tablas que cuelgan de ella. Se hace en
  // una transacción: media oposición borrada es peor que no haberla borrado.
  await transaccionDeAcademia(ctx.academy.id, async (tx) => {
    const convocatorias = await tx.oppositionEdition.findMany({
      where: { academyId: ctx.academy.id, oppositionId: oposicion.id, deletedAt: null },
      select: { id: true },
    });
    const ids = convocatorias.map((c) => c.id);

    if (ids.length > 0) {
      await tx.contentNode.updateMany({
        where: { academyId: ctx.academy.id, editionId: { in: ids }, deletedAt: null },
        data: { deletedAt: ahora },
      });
      await tx.course.updateMany({
        where: {
          academyId: ctx.academy.id,
          oppositionEditionId: { in: ids },
          deletedAt: null,
        },
        data: { deletedAt: ahora },
      });
      await tx.oppositionEdition.updateMany({
        where: { academyId: ctx.academy.id, id: { in: ids } },
        data: { deletedAt: ahora },
      });
    }

    await tx.opposition.update({
      where: { id: oposicion.id },
      data: { deletedAt: ahora, status: "ARCHIVED" },
    });
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "opposition.delete",
    entityType: "Opposition",
    entityId: oposicion.id,
    changes: { nombre: oposicion.name },
  });

  revalidatePath("/gestion/oposiciones");
  revalidatePath("/gestion/cursos");
  return { ok: true };
}

// ── Editar y eliminar convocatorias ──────────────────────────────────────────

const editarConvocatoriaSchema = z.object({
  editionId: z.string().min(1),
  name: z.string().trim().min(1, "El nombre es obligatorio."),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  examDate: z.string().trim().optional(),
  positions: z.coerce.number().int().min(0).max(100000).optional(),
  status: z.enum(["PLANNED", "OPEN", "CLOSED", "ARCHIVED"]).default("OPEN"),
});

/**
 * Edita una convocatoria.
 *
 * @returns Confirmación, o el motivo.
 */
export async function updateEditionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("oppositions.write");
  const parsed = editarConvocatoriaSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const actual = await ctx.db.oppositionEdition.findUnique({
    where: { id: data.editionId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!actual || actual.deletedAt) return { error: "Esa convocatoria no existe." };

  await ctx.db.oppositionEdition.update({
    where: { id: actual.id },
    data: {
      name: data.name,
      year: data.year ?? null,
      examDate: data.examDate ? new Date(data.examDate) : null,
      positions: data.positions ?? null,
      status: data.status,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "edition.update",
    entityType: "OppositionEdition",
    entityId: actual.id,
    changes: { antes: actual.name, ahora: data.name, estado: data.status },
  });

  revalidatePath("/gestion/oposiciones");
  return { ok: true };
}

/**
 * Eliminar una convocatoria.
 *
 * Misma regla que arriba —no se borra con alumnos dentro— y una más: no se
 * borra si es la única que le queda a la oposición. Una oposición sin
 * convocatorias no se puede usar para nada y deja la pantalla en un estado que
 * no se entiende.
 */
export async function deleteEditionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requirePermission("oppositions.write");
  const editionId = String(formData.get("editionId") ?? "");

  const convocatoria = await ctx.db.oppositionEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, oppositionId: true, deletedAt: true },
  });
  if (!convocatoria || convocatoria.deletedAt) {
    return { error: "Esa convocatoria no existe." };
  }

  const matriculados = await ctx.db.enrollment.count({
    where: {
      deletedAt: null,
      course: { oppositionEditionId: convocatoria.id },
    },
  });
  if (matriculados > 0) {
    return {
      error: `No se puede eliminar: hay ${matriculados} ${
        matriculados === 1 ? "alumno matriculado" : "alumnos matriculados"
      }. Ciérrala o archívala en lugar de borrarla.`,
    };
  }

  const hermanas = await ctx.db.oppositionEdition.count({
    where: {
      oppositionId: convocatoria.oppositionId,
      deletedAt: null,
      NOT: { id: convocatoria.id },
    },
  });
  if (hermanas === 0) {
    return {
      error:
        "Es la única convocatoria de esta oposición. Elimina la oposición entera o crea otra convocatoria antes.",
    };
  }

  const ahora = new Date();

  await transaccionDeAcademia(ctx.academy.id, async (tx) => {
    await tx.contentNode.updateMany({
      where: { academyId: ctx.academy.id, editionId: convocatoria.id, deletedAt: null },
      data: { deletedAt: ahora },
    });
    await tx.course.updateMany({
      where: {
        academyId: ctx.academy.id,
        oppositionEditionId: convocatoria.id,
        deletedAt: null,
      },
      data: { deletedAt: ahora },
    });
    await tx.oppositionEdition.update({
      where: { id: convocatoria.id },
      data: { deletedAt: ahora, status: "ARCHIVED" },
    });
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "edition.delete",
    entityType: "OppositionEdition",
    entityId: convocatoria.id,
    changes: { nombre: convocatoria.name },
  });

  revalidatePath("/gestion/oposiciones");
  revalidatePath("/gestion/cursos");
  return { ok: true };
}

function splitSpecialties(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}
