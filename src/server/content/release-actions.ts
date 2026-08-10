"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { subtreePrefix } from "./tree";

/**
 * RITMO DEL TEMARIO
 *
 * El profesor sube el temario completo el primer día y va abriendo temas según
 * avanza la clase. Cada grupo puede llevar su propio ritmo: el de mañana por el
 * tema 7 y el de tarde por el 5, con el mismo material.
 *
 * Tres formas de abrir un tema:
 *   · a todos los grupos (lo habitual),
 *   · a un grupo concreto,
 *   · programado para una fecha, que se abre solo.
 *
 * Cerrar un tema borra sus reglas y lo devuelve a borrador, de modo que
 * desaparece del Campus al instante.
 */

export type ReleaseState = { error?: string; ok?: string } | undefined;

/**
 * Crea (o reemplaza) la regla de apertura de un nodo para un grupo.
 * Se borra antes de insertar porque no hay índice único: ver el comentario del
 * modelo `ContentRelease`.
 */
async function fijarRegla(
  db: Awaited<ReturnType<typeof requirePermission>>["db"],
  nodeId: string,
  groupId: string | null,
  isOpen: boolean,
  releasedAt: Date,
  createdById: string,
) {
  await db.contentRelease.deleteMany({ where: { nodeId, groupId } });
  await db.contentRelease.create({
    data: { nodeId, groupId, isOpen, releasedAt, createdById },
  });
}

const releaseSchema = z.object({
  nodeId: z.string().min(1),
  editionId: z.string().min(1),
  groupId: z.string().optional(),
  /// "abrir" | "cerrar" | "programar"
  accion: z.enum(["abrir", "cerrar", "programar"]),
  fecha: z.string().optional(),
});

export async function setNodeReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const ctx = await requirePermission("content.publish");
  const parsed = releaseSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) return { error: "Datos no válidos." };
  const { nodeId, editionId, accion } = parsed.data;
  const groupId = parsed.data.groupId || null;

  const nodo = await ctx.db.contentNode.findUnique({
    where: { id: nodeId },
    select: { id: true, label: true, path: true, editionId: true },
  });
  if (!nodo) return { error: "Ese contenido no existe." };

  if (groupId) {
    const grupo = await ctx.db.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!grupo) return { error: "Ese grupo no existe." };
  }

  if (accion === "cerrar") {
    // Se guarda un cierre EXPLÍCITO en lugar de borrar la regla: sin él, el
    // nodo volvería a caer en "sin reglas → manda el estado global" y seguiría
    // viéndose. Es el fallo que tuvo la primera versión.
    await fijarRegla(ctx.db, nodeId, groupId, false, new Date(), ctx.membershipId);

    await recordAudit({
      academyId: ctx.academy.id,
      actorId: ctx.user.id,
      action: "content.release.close",
      entityType: "ContentNode",
      entityId: nodeId,
      changes: { tema: nodo.label, grupo: groupId ?? "todos" },
    });

    revalidatePath(`/gestion/contenido/${editionId}/ritmo`);
    return { ok: `«${nodo.label}» ya no se ve.` };
  }

  const releasedAt =
    accion === "programar" && parsed.data.fecha
      ? new Date(parsed.data.fecha)
      : new Date();

  if (accion === "programar" && Number.isNaN(releasedAt.getTime())) {
    return { error: "La fecha no es válida." };
  }

  // El nodo debe estar publicado; el ritmo decide a quién y desde cuándo.
  await ctx.db.contentNode.update({
    where: { id: nodeId },
    data: { status: "PUBLISHED", publishedAt: new Date(), availableFrom: null },
  });

  await fijarRegla(ctx.db, nodeId, groupId, true, releasedAt, ctx.membershipId);

  // Un tema no se abre sin su material: se publican también sus descendientes.
  await ctx.db.contentNode.updateMany({
    where: { path: { startsWith: subtreePrefix(nodo) }, status: { not: "PUBLISHED" } },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "content.release.open",
    entityType: "ContentNode",
    entityId: nodeId,
    changes: {
      tema: nodo.label,
      grupo: groupId ?? "todos",
      desde: releasedAt.toISOString(),
    },
  });

  revalidatePath(`/gestion/contenido/${editionId}/ritmo`);
  return {
    ok:
      accion === "programar"
        ? `«${nodo.label}» se abrirá solo el ${releasedAt.toLocaleDateString("es-ES")}.`
        : `«${nodo.label}» ya está disponible.`,
  };
}

const hastaAquiSchema = z.object({
  editionId: z.string().min(1),
  nodeId: z.string().min(1),
  groupId: z.string().optional(),
});

/**
 * «Abrir hasta aquí»: abre todos los temas anteriores y este, y cierra los
 * posteriores. Es el gesto natural del día a día: "hoy hemos llegado al tema 7".
 */
export async function releaseUpToAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  const ctx = await requirePermission("content.publish");
  const parsed = hastaAquiSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Datos no válidos." };

  const { editionId, nodeId } = parsed.data;
  const groupId = parsed.data.groupId || null;

  const temas = await ctx.db.contentNode.findMany({
    where: { editionId, kind: "TOPIC", deletedAt: null },
    orderBy: [{ path: "asc" }, { position: "asc" }],
    select: { id: true, label: true, path: true, position: true },
  });

  const ordenados = [...temas].sort((a, b) =>
    a.path === b.path ? a.position - b.position : a.path.localeCompare(b.path),
  );

  const corte = ordenados.findIndex((t) => t.id === nodeId);
  if (corte === -1) return { error: "Ese tema no pertenece a esta convocatoria." };

  const abrir = ordenados.slice(0, corte + 1);
  const cerrar = ordenados.slice(corte + 1);
  const ahora = new Date();

  for (const tema of abrir) {
    await ctx.db.contentNode.update({
      where: { id: tema.id },
      data: { status: "PUBLISHED", publishedAt: ahora, availableFrom: null },
    });
    await fijarRegla(ctx.db, tema.id, groupId, true, ahora, ctx.membershipId);
    await ctx.db.contentNode.updateMany({
      where: { path: { startsWith: subtreePrefix(tema) } },
      data: { status: "PUBLISHED", publishedAt: ahora },
    });
  }

  for (const tema of cerrar) {
    await fijarRegla(ctx.db, tema.id, groupId, false, ahora, ctx.membershipId);
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "content.release.up_to",
    entityType: "ContentNode",
    entityId: nodeId,
    changes: {
      hasta: ordenados[corte].label,
      abiertos: abrir.length,
      cerrados: cerrar.length,
      grupo: groupId ?? "todos",
    },
  });

  revalidatePath(`/gestion/contenido/${editionId}/ritmo`);
  return {
    ok: `Abiertos ${abrir.length} temas hasta «${ordenados[corte].label}».`,
  };
}
