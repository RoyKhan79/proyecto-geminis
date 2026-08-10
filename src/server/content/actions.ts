"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { prismaBase } from "@/lib/db/client";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  buildStorageKey,
  isAllowedMime,
  resourceTypeForMime,
  storage,
} from "@/lib/storage";
import { sanitizeHtml } from "@/lib/sanitize";
import { createContentNode, subtreePrefix } from "./tree";

/**
 * Acciones del árbol de contenido.
 *
 * Aquí es donde la academia construye su material como quiera: crea los
 * apartados que necesita, les pone el nombre que usa de verdad y decide qué se
 * ve, qué se descarga y qué puede usar la IA.
 */

export type ContentState = { error?: string; ok?: boolean } | undefined;

const createSchema = z.object({
  editionId: z.string().min(1),
  parentId: z.string().optional(),
  kind: z.enum(["SECTION", "FOLDER", "TOPIC", "RESOURCE"]),
  sectionKind: z
    .enum([
      "SYLLABUS",
      "LIBRARY",
      "CLASSES",
      "TESTS",
      "SIMULATIONS",
      "LEGISLATION",
      "VIDEO",
      "PRACTICAL",
      "CUSTOM",
    ])
    .optional(),
  label: z.string().trim().min(1, "Escribe un nombre."),
  description: z.string().trim().max(2000).optional(),
  estimatedMinutes: z.coerce.number().int().min(0).max(10000).optional(),
});

export async function createNodeAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const ctx = await requirePermission("content.write");
  const parsed = createSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const edicion = await ctx.db.oppositionEdition.findUnique({
    where: { id: data.editionId },
    select: { id: true },
  });
  if (!edicion) return { error: "Esa convocatoria no existe." };

  const nodo = await createContentNode(ctx.db, {
    editionId: data.editionId,
    parentId: data.parentId || null,
    kind: data.kind,
    sectionKind: data.kind === "SECTION" ? (data.sectionKind ?? "CUSTOM") : null,
    label: data.label,
    description: data.description || null,
    estimatedMinutes: data.estimatedMinutes ?? null,
    status: "DRAFT",
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "content.create",
    entityType: "ContentNode",
    entityId: nodo.id,
    changes: { label: data.label, kind: data.kind },
  });

  revalidatePath(`/gestion/contenido/${data.editionId}`);
  return { ok: true };
}

const updateSchema = z.object({
  nodeId: z.string().min(1),
  label: z.string().trim().min(1, "Escribe un nombre."),
  description: z.string().trim().max(2000).optional(),
  estimatedMinutes: z.coerce.number().int().min(0).max(10000).optional(),
  // Las banderas heredables llegan como "", "true" o "false".
  downloadable: z.string().optional(),
  aiEnabled: z.string().optional(),
  usableForTests: z.string().optional(),
  watermark: z.string().optional(),
  isFree: z.string().optional(),
  visibleToStudents: z.string().optional(),
});

function tristate(value?: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export async function updateNodeAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const ctx = await requirePermission("content.write");
  const parsed = updateSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const antes = await ctx.db.contentNode.findUnique({
    where: { id: data.nodeId },
    select: { id: true, editionId: true, label: true },
  });
  if (!antes) return { error: "Ese contenido no existe." };

  await ctx.db.contentNode.update({
    where: { id: data.nodeId },
    data: {
      label: data.label,
      description: data.description || null,
      estimatedMinutes: data.estimatedMinutes ?? null,
      downloadable: tristate(data.downloadable),
      aiEnabled: tristate(data.aiEnabled),
      usableForTests: tristate(data.usableForTests),
      watermark: tristate(data.watermark),
      isFree: data.isFree === "on",
      visibleToStudents: data.visibleToStudents === "on",
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "content.update",
    entityType: "ContentNode",
    entityId: data.nodeId,
    changes: { antes: antes.label, despues: data.label },
  });

  revalidatePath(`/gestion/contenido/${antes.editionId}`);
  return { ok: true };
}

/**
 * Publicar o retirar. Publicar una rama publica también lo que cuelga de ella:
 * es lo que la academia espera al pulsar «publicar» en un bloque entero.
 */
export async function togglePublishAction(formData: FormData) {
  const ctx = await requirePermission("content.publish");
  const nodeId = String(formData.get("nodeId") ?? "");
  const publicar = String(formData.get("publicar") ?? "") === "1";
  const enCascada = String(formData.get("cascada") ?? "") === "1";

  const nodo = await ctx.db.contentNode.findUnique({
    where: { id: nodeId },
    select: { id: true, path: true, editionId: true, label: true },
  });
  if (!nodo) throw new Error("Ese contenido no existe.");

  const estado = publicar ? "PUBLISHED" : "DRAFT";

  await ctx.db.contentNode.update({
    where: { id: nodeId },
    data: { status: estado, publishedAt: publicar ? new Date() : null },
  });

  if (enCascada) {
    await ctx.db.contentNode.updateMany({
      where: { path: { startsWith: subtreePrefix(nodo) } },
      data: { status: estado, publishedAt: publicar ? new Date() : null },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: publicar ? "content.publish" : "content.unpublish",
    entityType: "ContentNode",
    entityId: nodeId,
    changes: { label: nodo.label, cascada: enCascada },
  });

  revalidatePath(`/gestion/contenido/${nodo.editionId}`);
}

/** Reordenar entre hermanos. */
export async function moveNodeAction(formData: FormData) {
  const ctx = await requirePermission("content.write");
  const nodeId = String(formData.get("nodeId") ?? "");
  const direccion = String(formData.get("direccion") ?? "");

  const nodo = await ctx.db.contentNode.findUnique({
    where: { id: nodeId },
    select: { id: true, parentId: true, position: true, editionId: true },
  });
  if (!nodo) throw new Error("Ese contenido no existe.");

  const hermanos = await ctx.db.contentNode.findMany({
    where: { editionId: nodo.editionId, parentId: nodo.parentId, deletedAt: null },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  const indice = hermanos.findIndex((h) => h.id === nodeId);
  const destino = direccion === "arriba" ? indice - 1 : indice + 1;
  if (destino < 0 || destino >= hermanos.length) return;

  const reordenados = [...hermanos];
  const [movido] = reordenados.splice(indice, 1);
  reordenados.splice(destino, 0, movido);

  // Reescribimos las posiciones de toda la lista: es barato y deja el orden
  // consistente aunque hubiera huecos de operaciones anteriores.
  for (const [posicion, hermano] of reordenados.entries()) {
    await ctx.db.contentNode.update({
      where: { id: hermano.id },
      data: { position: posicion },
    });
  }

  revalidatePath(`/gestion/contenido/${nodo.editionId}`);
}

/** Borrado lógico. Se lleva la rama entera, porque un tema sin su bloque no existe. */
export async function deleteNodeAction(formData: FormData) {
  const ctx = await requirePermission("content.delete");
  const nodeId = String(formData.get("nodeId") ?? "");

  const nodo = await ctx.db.contentNode.findUnique({
    where: { id: nodeId },
    select: { id: true, path: true, editionId: true, label: true },
  });
  if (!nodo) throw new Error("Ese contenido no existe.");

  const ahora = new Date();
  await ctx.db.contentNode.update({
    where: { id: nodeId },
    data: { deletedAt: ahora, status: "ARCHIVED" },
  });
  await ctx.db.contentNode.updateMany({
    where: { path: { startsWith: subtreePrefix(nodo) } },
    data: { deletedAt: ahora, status: "ARCHIVED" },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "content.delete",
    entityType: "ContentNode",
    entityId: nodeId,
    changes: { label: nodo.label },
  });

  revalidatePath(`/gestion/contenido/${nodo.editionId}`);
}

/**
 * Subir un archivo y colgarlo del árbol.
 *
 * Crea un nodo RESOURCE dentro del nodo indicado. El archivo queda en el
 * almacén y solo se sirve a través de la ruta protegida.
 */
export async function uploadResourceAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const ctx = await requirePermission("content.write");

  const parentId = String(formData.get("parentId") ?? "");
  const editionId = String(formData.get("editionId") ?? "");
  const etiqueta = String(formData.get("label") ?? "").trim();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) return { error: "Elige un archivo." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "El archivo supera los 200 MB." };
  }
  if (!isAllowedMime(file.type)) {
    return {
      error: `Tipo de archivo no admitido (${file.type || "desconocido"}). Admitimos: ${[
        ...new Set(Object.values(ALLOWED_MIME)),
      ].join(", ")}.`,
    };
  }

  const padre = await ctx.db.contentNode.findUnique({
    where: { id: parentId },
    select: { id: true, editionId: true },
  });
  if (!padre) return { error: "El apartado de destino no existe." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildStorageKey(ctx.academy.id, file.name);
  const guardado = await storage().put(key, buffer, file.type);

  const stored = await ctx.db.storedFile.create({
    data: {
      storageKey: guardado.key,
      storageDriver: storage().name,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: guardado.sizeBytes,
      checksumSha256: guardado.checksumSha256,
      uploadedById: ctx.membershipId,
    },
  });

  const nodo = await createContentNode(ctx.db, {
    editionId: padre.editionId || editionId,
    parentId: padre.id,
    kind: "RESOURCE",
    label: etiqueta || file.name,
    status: "DRAFT",
  });

  // ContentResource cuelga del nodo, así que se crea con el cliente base tras
  // haber comprobado que el nodo es de esta academia.
  await prismaBase.contentResource.create({
    data: {
      nodeId: nodo.id,
      type: resourceTypeForMime(file.type),
      fileId: stored.id,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "content.upload",
    entityType: "ContentNode",
    entityId: nodo.id,
    changes: { archivo: file.name, tamaño: guardado.sizeBytes },
  });

  revalidatePath(`/gestion/contenido/${padre.editionId}`);
  return { ok: true };
}

/** Enlace externo: vídeo alojado fuera, web oficial, formulario… */
export async function addLinkResourceAction(
  _prev: ContentState,
  formData: FormData,
): Promise<ContentState> {
  const ctx = await requirePermission("content.write");

  const schema = z.object({
    parentId: z.string().min(1),
    label: z.string().trim().min(1, "Escribe un nombre."),
    url: z.string().trim().url("La dirección no es válida."),
    type: z.enum(["LINK", "VIDEO", "EMBED"]),
  });

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const padre = await ctx.db.contentNode.findUnique({
    where: { id: parsed.data.parentId },
    select: { id: true, editionId: true },
  });
  if (!padre) return { error: "El apartado de destino no existe." };

  const nodo = await createContentNode(ctx.db, {
    editionId: padre.editionId,
    parentId: padre.id,
    kind: "RESOURCE",
    label: parsed.data.label,
    status: "DRAFT",
  });

  await prismaBase.contentResource.create({
    data: {
      nodeId: nodo.id,
      type: parsed.data.type,
      externalUrl: parsed.data.url,
    },
  });

  revalidatePath(`/gestion/contenido/${padre.editionId}`);
  return { ok: true };
}
