"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import {
  getAuthContext,
  requirePermission,
  requirePlatformAdmin,
} from "@/lib/auth/context";
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { addMemberToAcademy, createAcademyWithRoles } from "@/server/academies/provision";
import { slugify } from "@/lib/utils";

/**
 * PLATAFORMA
 *
 * Lo que usa el equipo de Proyecto Geminis para dar de alta academias, mirar
 * consumo y hacer soporte. Nada de esto da acceso al contenido de una academia:
 * para eso está la impersonación, que es explícita y queda registrada (§3).
 */

export type PlatformState = { error?: string; ok?: string } | undefined;

const altaSchema = z.object({
  name: z.string().trim().min(3, "Nombre de la academia."),
  slug: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email("Correo de contacto no válido."),
  planCode: z.enum(["STARTER", "PRO", "BUSINESS", "ENTERPRISE"]),
  adminNombre: z.string().trim().min(2, "Nombre de la persona responsable."),
  adminApellidos: z.string().trim().optional(),
  adminEmail: z.string().trim().toLowerCase().email("Correo del administrador no válido."),
  adminPassword: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres."),
});

/** Alta completa de una academia con su primer administrador. */
export async function createAcademyAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await requirePlatformAdmin();
  const parsed = altaSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const slug = slugify(data.slug || data.name);
  const existe = await prismaBase.academy.findUnique({ where: { slug } });
  if (existe) return { error: "Ya hay una academia con ese identificador." };

  const academia = await createAcademyWithRoles({
    slug,
    name: data.name,
    email: data.email,
    planCode: data.planCode,
    status: "TRIAL",
  });

  await addMemberToAcademy(academia.id, {
    email: data.adminEmail,
    firstName: data.adminNombre,
    lastName: data.adminApellidos,
    password: data.adminPassword,
    roleKeys: ["ACADEMY_ADMIN"],
  });

  await recordAudit({
    academyId: academia.id,
    actorId: ctx.user.id,
    action: "platform.academy.create",
    entityType: "Academy",
    entityId: academia.id,
    changes: { nombre: data.name, plan: data.planCode },
  });

  revalidatePath("/plataforma");
  return {
    ok: `Academia «${data.name}» creada. ${data.adminEmail} ya puede entrar.`,
  };
}

/**
 * Activa o suspende una academia entera.
 *
 * Suspender corta el acceso a todo el mundo de esa academia, alumnado incluido.
 * Es para impagos, no para el día a día.
 */
export async function setAcademyStatusAction(formData: FormData) {
  const ctx = await requirePlatformAdmin();
  const academyId = String(formData.get("academyId") ?? "");
  const status = String(formData.get("status") ?? "");

  const validos = ["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"] as const;
  if (!validos.includes(status as (typeof validos)[number])) {
    throw new Error("Estado no válido.");
  }

  await prismaBase.academy.update({
    where: { id: academyId },
    data: { status: status as (typeof validos)[number] },
  });

  await recordAudit({
    academyId,
    actorId: ctx.user.id,
    action: "platform.academy.status",
    entityType: "Academy",
    entityId: academyId,
    changes: { estado: status },
  });

  revalidatePath("/plataforma");
}

/**
 * IMPERSONACIÓN DE SOPORTE (§3).
 *
 * El superadmin entra como una persona concreta para resolver una incidencia.
 * Tres cosas lo hacen aceptable:
 *   · queda registrado quién suplanta a quién y por qué,
 *   · la sesión va marcada y la interfaz lo muestra en todo momento,
 *   · no es silenciosa: la academia lo ve en su registro de auditoría.
 */
export async function impersonateAction(formData: FormData) {
  const ctx = await requirePlatformAdmin();
  const membershipId = String(formData.get("membershipId") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (motivo.length < 5) {
    throw new Error("Hay que indicar el motivo del acceso de soporte.");
  }

  const membership = await prismaBase.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true, academyId: true },
  });
  if (!membership) throw new Error("Esa persona no existe.");

  const { token } = await createSession({
    userId: membership.userId,
    activeAcademyId: membership.academyId,
    impersonatedById: ctx.user.id,
  });
  await setSessionCookie(token);

  await recordAudit({
    academyId: membership.academyId,
    actorId: membership.userId,
    impersonatorId: ctx.user.id,
    action: "platform.impersonate",
    entityType: "Membership",
    entityId: membership.id,
    context: { motivo },
  });

  redirect("/inicio");
}

/**
 * EXPORTACIÓN DE DATOS (§89, RGPD).
 *
 * Una academia debe poder llevarse lo suyo. Facilitar la salida es lo que hace
 * creíble la entrada: nadie confía en un producto del que no puede salir.
 */
export async function exportAcademyDataAction(): Promise<PlatformState> {
  const ctx = await requirePermission("data.export");
  const db = tenantDb(ctx.academy.id);

  const [
    academia,
    personas,
    oposiciones,
    cursos,
    matriculas,
    contenido,
    preguntas,
    intentos,
    pagos,
  ] = await Promise.all([
    prismaBase.academy.findUnique({
      where: { id: ctx.academy.id },
      select: { name: true, slug: true, legalName: true, email: true, createdAt: true },
    }),
    db.membership.findMany({
      select: {
        id: true,
        status: true,
        joinedAt: true,
        user: { select: { email: true, firstName: true, lastName: true, phone: true } },
        studentProfile: { select: { code: true, status: true, source: true } },
        teacherProfile: { select: { headline: true, specialties: true } },
        roles: { select: { role: { select: { key: true } } } },
      },
    }),
    db.opposition.findMany({
      select: {
        name: true,
        slug: true,
        code: true,
        authority: true,
        editions: { select: { name: true, year: true, examDate: true } },
      },
    }),
    db.course.findMany({
      select: {
        name: true,
        code: true,
        modality: true,
        startDate: true,
        groups: { select: { name: true, schedule: true } },
      },
    }),
    db.enrollment.findMany({
      select: {
        status: true,
        startDate: true,
        priceCents: true,
        student: { select: { user: { select: { email: true } } } },
        course: { select: { name: true } },
        group: { select: { name: true } },
      },
    }),
    db.contentNode.findMany({
      select: {
        label: true,
        kind: true,
        sectionKind: true,
        path: true,
        position: true,
        status: true,
        estimatedMinutes: true,
      },
    }),
    db.question.findMany({
      select: {
        statement: true,
        explanation: true,
        difficulty: true,
        status: true,
        source: true,
        node: { select: { label: true } },
        options: { select: { text: true, isCorrect: true, position: true } },
      },
    }),
    db.testAttempt.findMany({
      select: {
        kind: true,
        startedAt: true,
        submittedAt: true,
        totalQuestions: true,
        correctCount: true,
        scorePercent: true,
        student: { select: { user: { select: { email: true } } } },
      },
    }),
    db.payment.findMany({
      select: {
        concept: true,
        amountCents: true,
        status: true,
        method: true,
        dueDate: true,
        paidAt: true,
        receiptNo: true,
        student: { select: { user: { select: { email: true } } } },
      },
    }),
  ]);

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "data.export",
    changes: {
      personas: personas.length,
      preguntas: preguntas.length,
      intentos: intentos.length,
    },
  });

  const paquete = {
    exportadoEl: new Date().toISOString(),
    academia,
    personas,
    oposiciones,
    cursos,
    matriculas,
    contenido,
    preguntas,
    intentos,
    pagos,
    nota:
      "Exportación completa de los datos de la academia en Proyecto Geminis. Los archivos subidos se entregan aparte desde el almacén.",
  };

  return { ok: JSON.stringify(paquete) };
}

const brandingSchema = z.object({
  name: z.string().trim().min(2, "Nombre de la academia."),
  legalName: z.string().trim().max(160).optional(),
  email: z.string().trim().email("Correo no válido.").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "El color debe ser un hexadecimal, p. ej. #4F46E5.")
    .optional()
    .or(z.literal("")),
  logoUrl: z.string().trim().url("La dirección del logotipo no es válida.").optional().or(z.literal("")),
  /// Sesiones simultáneas por alumno. 0 = sin límite.
  maxSessionsPerStudent: z.coerce.number().int().min(0).max(10).default(2),
});

/** Personalización de la academia: nombre, color y logotipo (§60). */
export async function updateBrandingAction(
  _prev: PlatformState,
  formData: FormData,
): Promise<PlatformState> {
  const ctx = await requirePermission("settings.write");
  const parsed = brandingSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  await prismaBase.academy.update({
    where: { id: ctx.academy.id },
    data: {
      name: parsed.data.name,
      legalName: parsed.data.legalName || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      primaryColor: parsed.data.primaryColor || null,
      logoUrl: parsed.data.logoUrl || null,
      maxSessionsPerStudent: parsed.data.maxSessionsPerStudent,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "academy.branding",
    changes: {
      nombre: parsed.data.name,
      color: parsed.data.primaryColor,
      sesionesPorAlumno: parsed.data.maxSessionsPerStudent,
    },
  });

  revalidatePath("/gestion/configuracion");
  return { ok: "Configuración guardada." };
}

/**
 * BORRADO RGPD de una persona.
 *
 * No se elimina la fila: se anonimiza. Borrarla rompería resultados, pagos y
 * estadísticas que la academia necesita conservar, y dejaría huecos imposibles
 * de cuadrar. Lo que desaparece es lo que identifica a la persona, que es
 * exactamente lo que exige el derecho de supresión.
 */
export async function anonymizeStudentAction(formData: FormData) {
  const ctx = await requirePermission("students.delete");
  const membershipId = String(formData.get("membershipId") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  const membership = await ctx.db.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, userId: true },
  });
  if (!membership) throw new Error("Esa persona no existe.");

  // tenant-ok · se pregunta a propósito por TODAS las academias: si la persona
  // está en otra, su identidad global no se toca.
  const otrasAcademias = await prismaBase.membership.count({
    where: { userId: membership.userId, NOT: { id: membership.id } },
  });

  // Si la persona está en otra academia, no se toca su identidad global: solo
  // se anula su vínculo con esta. Su derecho aquí no puede borrarla de allí.
  if (otrasAcademias === 0) {
    await prismaBase.user.update({
      where: { id: membership.userId },
      data: {
        email: `anonimo-${membership.userId.slice(0, 12)}@borrado.local`,
        firstName: "Persona",
        lastName: "anonimizada",
        phone: null,
        avatarUrl: null,
        passwordHash: null,
        status: "DISABLED",
        deletedAt: new Date(),
      },
    });
  }

  await prismaBase.studentProfile.updateMany({
    where: { membershipId },
    data: { notes: null, source: null, nationalId: null, address: null, city: null, postalCode: null },
  });

  await ctx.db.membership.update({
    where: { id: membershipId },
    data: { status: "LEFT", deletedAt: new Date() },
  });

  await prismaBase.session.updateMany({
    where: { userId: membership.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "rgpd.anonymize",
    entityType: "Membership",
    entityId: membershipId,
    context: { motivo, identidadGlobalBorrada: otrasAcademias === 0 },
  });

  revalidatePath("/gestion/alumnos");
  redirect("/gestion/alumnos");
}

/** Cierra la sesión de soporte y vuelve a la consola de plataforma. */
export async function stopImpersonationAction() {
  const ctx = await getAuthContext();
  if (!ctx?.impersonatedById) redirect("/inicio");

  await prismaBase.session.update({
    where: { id: ctx.sessionId },
    data: { revokedAt: new Date() },
  });

  await recordAudit({
    academyId: ctx.academy?.id ?? null,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "platform.impersonate.stop",
  });

  redirect("/entrar");
}
