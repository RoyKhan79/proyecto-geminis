"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requireAcademy } from "@/lib/auth/context";
import { loadStudentGrants } from "@/lib/access/content-access";

/**
 * MURO DE LA CLASE
 *
 * Donde el profesor escribe a su gente y donde el alumnado de un mismo grupo
 * se ayuda entre sí. Es lo que hoy pasa en un grupo de WhatsApp y acaba
 * perdiéndose entre memes y notas de voz.
 *
 * Quién puede escribir:
 *   · el profesorado y la administración, siempre;
 *   · el alumnado, en los muros de los grupos donde está matriculado.
 *
 * Quién puede leer: solo quien pertenece a ese ámbito. Un alumno del grupo de
 * mañana no ve el muro del de tarde, y quien no está matriculado no ve nada.
 */

export type WallState = { error?: string; ok?: string } | undefined;

const publicarSchema = z.object({
  body: z.string().trim().min(2, "Escribe algo.").max(4000),
  title: z.string().trim().max(160).optional(),
  groupId: z.string().trim().optional(),
  courseId: z.string().trim().optional(),
  editionId: z.string().trim().optional(),
  pinned: z.string().optional(),
});

/** Ámbitos (grupos y cursos) donde esta persona puede leer y escribir. */
export async function ambitosDelUsuario(
  ctx: Awaited<ReturnType<typeof requireAcademy>>,
) {
  const esPersonal = ctx.permissions.has("manager.access");

  if (esPersonal) {
    const [grupos, cursos] = await Promise.all([
      ctx.db.group.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, course: { select: { name: true } } },
      }),
      ctx.db.course.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);
    return {
      esPersonal,
      groupIds: grupos.map((g) => g.id),
      courseIds: cursos.map((c) => c.id),
      grupos: grupos.map((g) => ({ id: g.id, name: `${g.course.name} · ${g.name}` })),
      cursos,
    };
  }

  const matriculas = await ctx.db.enrollment.findMany({
    where: {
      studentId: ctx.membershipId,
      deletedAt: null,
      status: { in: ["ACTIVE", "PAST_DUE"] },
    },
    select: {
      courseId: true,
      groupId: true,
      course: { select: { name: true } },
      group: { select: { name: true } },
    },
  });

  return {
    esPersonal,
    groupIds: matriculas.map((m) => m.groupId).filter((x): x is string => Boolean(x)),
    courseIds: matriculas.map((m) => m.courseId),
    grupos: matriculas
      .filter((m) => m.groupId)
      .map((m) => ({
        id: m.groupId as string,
        name: `${m.course.name} · ${m.group?.name ?? ""}`,
      })),
    cursos: matriculas.map((m) => ({ id: m.courseId, name: m.course.name })),
  };
}

export async function publishWallPostAction(
  _prev: WallState,
  formData: FormData,
): Promise<WallState> {
  const ctx = await requireAcademy();
  const parsed = publicarSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };
  }
  const data = parsed.data;

  const ambitos = await ambitosDelUsuario(ctx);

  // Publicar en un ámbito ajeno es exactamente el tipo de cosa que hay que
  // impedir en servidor: el desplegable del formulario no vale como control.
  if (data.groupId && !ambitos.groupIds.includes(data.groupId)) {
    return { error: "No perteneces a ese grupo." };
  }
  if (data.courseId && !ambitos.courseIds.includes(data.courseId)) {
    return { error: "No perteneces a ese curso." };
  }
  if (!data.groupId && !data.courseId && !ambitos.esPersonal) {
    return { error: "Elige el grupo en el que quieres publicar." };
  }

  // Fijar arriba es cosa del profesorado: si lo pudiera hacer cualquiera, el
  // muro se llenaría de mensajes fijados.
  const fijar = data.pinned === "on" && ambitos.esPersonal;

  const publicacion = await ctx.db.wallPost.create({
    data: {
      authorId: ctx.membershipId,
      groupId: data.groupId || null,
      courseId: data.courseId || null,
      editionId: data.editionId || null,
      title: data.title || null,
      body: data.body,
      pinned: fijar,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "wall.post",
    entityType: "WallPost",
    entityId: publicacion.id,
    changes: { grupo: data.groupId ?? null, curso: data.courseId ?? null },
  });

  revalidatePath("/campus/muro");
  revalidatePath("/gestion/muro");
  return { ok: "Publicado." };
}

const comentarSchema = z.object({
  postId: z.string().min(1),
  body: z.string().trim().min(1, "Escribe tu comentario.").max(2000),
});

export async function commentWallPostAction(
  _prev: WallState,
  formData: FormData,
): Promise<WallState> {
  const ctx = await requireAcademy();
  const parsed = comentarSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el comentario." };
  }

  const publicacion = await ctx.db.wallPost.findUnique({
    where: { id: parsed.data.postId },
    select: { id: true, groupId: true, courseId: true, deletedAt: true },
  });
  if (!publicacion || publicacion.deletedAt) {
    return { error: "Esa publicación ya no existe." };
  }

  const ambitos = await ambitosDelUsuario(ctx);
  const puedeVer =
    ambitos.esPersonal ||
    (publicacion.groupId && ambitos.groupIds.includes(publicacion.groupId)) ||
    (publicacion.courseId && ambitos.courseIds.includes(publicacion.courseId));

  if (!puedeVer) return { error: "No puedes comentar en ese muro." };

  await ctx.db.wallComment.create({
    data: {
      postId: publicacion.id,
      authorId: ctx.membershipId,
      body: parsed.data.body,
    },
  });

  revalidatePath("/campus/muro");
  revalidatePath("/gestion/muro");
  return { ok: "Comentado." };
}

/**
 * Borrar. El autor puede borrar lo suyo; el profesorado, cualquier cosa de su
 * academia. Es borrado lógico: moderar no debe destruir el historial.
 */
export async function deleteWallPostAction(formData: FormData) {
  const ctx = await requireAcademy();
  const postId = String(formData.get("postId") ?? "");

  const publicacion = await ctx.db.wallPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!publicacion) return;

  const esAutor = publicacion.authorId === ctx.membershipId;
  const esPersonal = ctx.permissions.has("manager.access");
  if (!esAutor && !esPersonal) throw new Error("No puedes borrar esa publicación.");

  await ctx.db.wallPost.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "wall.delete",
    entityType: "WallPost",
    entityId: postId,
    changes: { moderado: !esAutor },
  });

  revalidatePath("/campus/muro");
  revalidatePath("/gestion/muro");
}

/** Publicaciones visibles para esta persona, con sus comentarios. */
export async function loadWall(ctx: Awaited<ReturnType<typeof requireAcademy>>) {
  const ambitos = await ambitosDelUsuario(ctx);

  // Sin ámbitos no hay muro: evita que una consulta sin filtros lo enseñe todo.
  if (
    !ambitos.esPersonal &&
    ambitos.groupIds.length === 0 &&
    ambitos.courseIds.length === 0
  ) {
    return { publicaciones: [], ambitos };
  }

  const publicaciones = await ctx.db.wallPost.findMany({
    where: {
      deletedAt: null,
      ...(ambitos.esPersonal
        ? {}
        : {
            OR: [
              { groupId: { in: ambitos.groupIds } },
              { courseId: { in: ambitos.courseIds }, groupId: null },
            ],
          }),
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      title: true,
      body: true,
      pinned: true,
      createdAt: true,
      authorId: true,
      group: { select: { name: true } },
      course: { select: { name: true } },
      author: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
          teacherProfile: { select: { id: true } },
        },
      },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: {
            select: {
              user: { select: { firstName: true, lastName: true } },
              teacherProfile: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  // Los derechos de acceso no gobiernan el muro (es conversación, no material),
  // pero sí se usan para saber si el alumno sigue activo en la academia.
  if (!ambitos.esPersonal) {
    await loadStudentGrants(ctx.academy.id, ctx.membershipId);
  }

  return { publicaciones, ambitos };
}
