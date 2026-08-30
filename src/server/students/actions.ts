"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit, diff } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { prismaBase } from "@/lib/db/client";
import { addMemberToAcademy } from "@/server/academies/provision";

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
