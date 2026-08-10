"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
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
 * Geminis no depende de esos nombres para nada (ADR-0006).
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

function splitSpecialties(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}
