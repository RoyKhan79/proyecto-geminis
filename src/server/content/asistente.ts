"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { prismaBase } from "@/lib/db/client";
import {
  MAX_UPLOAD_BYTES,
  buildStorageKey,
  isAllowedMime,
  resourceTypeForMime,
  storage,
} from "@/lib/storage";
import { createContentNode, subtreePrefix } from "./tree";

/**
 * ASISTENTE DE TEMARIO
 *
 * El problema que resuelve es de verdad el que impide que una academia pruebe
 * el producto: su temario está en una carpeta con sesenta PDF, y montarlo aquí
 * tema a tema es una tarde entera. Con esto es un rato.
 *
 * Tres decisiones que lo definen:
 *
 * 1. **Propone, no impone.** Lo que llega aquí son las etiquetas que la
 *    academia ha revisado en pantalla, no lo que dedujo el lector de nombres.
 *    Los nombres los pone la academia; eso no se negocia en este proyecto.
 *
 * 2. **Todo entra en borrador salvo que se diga lo contrario.** Sesenta temas
 *    publicándose de golpe a todo el alumnado es justo el tipo de cosa que no
 *    debe pasar por descuido. Igual que con lo que genera la IA: nada llega al
 *    alumno sin una decisión humana.
 *
 * 3. **Se puede deshacer.** Cada tanda lleva su marca en `metadata`, así que
 *    una importación que salió mal se retira entera en un clic en lugar de a
 *    mano, tema por tema. Es lo que hace que probar el asistente no dé miedo.
 */

export type AsistenteState =
  | { error?: string; ok?: string; batchId?: string; creados?: number }
  | undefined;

type FilaDeTemario = {
  indice: number;
  etiqueta: string;
  archivo: File;
};

/** Lee del formulario las filas que la academia ha revisado. */
function leerFilas(formData: FormData): FilaDeTemario[] {
  const archivos = formData.getAll("archivos").filter((f): f is File => f instanceof File);
  const etiquetas = formData.getAll("etiquetas").map((e) => String(e).trim());

  return archivos
    .map((archivo, indice) => ({
      indice,
      archivo,
      etiqueta: etiquetas[indice] || archivo.name,
    }))
    .filter((fila) => fila.archivo.size > 0);
}

export async function aplicarAsistenteAction(
  _prev: AsistenteState,
  formData: FormData,
): Promise<AsistenteState> {
  const ctx = await requirePermission("content.write");

  const parentId = String(formData.get("parentId") ?? "");
  const publicar = formData.get("publicar") === "on";
  const bandera = (nombre: string): boolean | null => {
    const valor = formData.get(nombre);
    if (valor === "si") return true;
    if (valor === "no") return false;
    return null; // heredar del apartado padre
  };

  const seccion = await ctx.db.contentNode.findUnique({
    where: { id: parentId },
    select: { id: true, editionId: true, label: true, path: true, deletedAt: true },
  });
  if (!seccion || seccion.deletedAt) {
    return { error: "El apartado de destino no existe." };
  }

  const filas = leerFilas(formData);
  if (filas.length === 0) return { error: "No has subido ningún archivo." };
  if (filas.length > 200) {
    return {
      error:
        "Son demasiados archivos de una vez (máximo 200). Súbelos en dos tandas: " +
        "así, si algo sale mal, se deshace la mitad y no todo.",
    };
  }

  for (const fila of filas) {
    if (fila.archivo.size > MAX_UPLOAD_BYTES) {
      return { error: `«${fila.archivo.name}» supera los 200 MB.` };
    }
    if (!isAllowedMime(fila.archivo.type)) {
      return {
        error: `«${fila.archivo.name}» es de un tipo que no admitimos (${fila.archivo.type || "desconocido"}).`,
      };
    }
  }

  // La marca de la tanda. Va en `metadata`, que es el campo libre de la
  // academia, para no añadir una tabla a algo que solo sirve para deshacer.
  const batchId = randomUUID();

  // A partir de dónde se numeran. Si la sección ya tenía temas, los nuevos van
  // detrás: nadie espera que subir una segunda tanda le reordene la primera.
  const yaHabia = await ctx.db.contentNode.count({
    where: { parentId: seccion.id, deletedAt: null },
  });

  let creados = 0;

  for (const fila of filas) {
    const tema = await createContentNode(ctx.db, {
      editionId: seccion.editionId,
      parentId: seccion.id,
      kind: "TOPIC",
      label: fila.etiqueta,
      status: publicar ? "PUBLISHED" : "DRAFT",
      position: yaHabia + fila.indice + 1,
      // Solo estas dos se preguntan en el asistente. Las demás banderas
      // —marca de agua, uso para generar preguntas— se heredan del apartado,
      // que es lo que la academia ya decidió al crearlo; volver a preguntarlas
      // aquí sería un formulario más largo para el mismo resultado.
      downloadable: bandera("descargable"),
      aiEnabled: bandera("ia"),
    });

    // `metadata` no está en `CreateNodeInput` porque es un campo libre de la
    // academia y el servicio del árbol no debe decidir qué va dentro.
    await ctx.db.contentNode.update({
      where: { id: tema.id },
      data: { metadata: { importBatch: batchId, archivoOriginal: fila.archivo.name } },
    });

    const buffer = Buffer.from(await fila.archivo.arrayBuffer());
    const key = buildStorageKey(ctx.academy.id, fila.archivo.name);
    const guardado = await storage().put(key, buffer, fila.archivo.type);

    const stored = await ctx.db.storedFile.create({
      data: {
        storageKey: guardado.key,
        storageDriver: storage().name,
        originalName: fila.archivo.name,
        mimeType: fila.archivo.type,
        sizeBytes: guardado.sizeBytes,
        checksumSha256: guardado.checksumSha256,
        uploadedById: ctx.membershipId,
      },
    });

    const recurso = await createContentNode(ctx.db, {
      editionId: seccion.editionId,
      parentId: tema.id,
      kind: "RESOURCE",
      label: fila.archivo.name,
      status: publicar ? "PUBLISHED" : "DRAFT",
    });

    await ctx.db.contentNode.update({
      where: { id: recurso.id },
      data: { metadata: { importBatch: batchId } },
    });

    // ContentResource cuelga del nodo, y el nodo ya está comprobado como de
    // esta academia, así que se crea con el cliente base.
    await prismaBase.contentResource.create({
      data: {
        nodeId: recurso.id,
        type: resourceTypeForMime(fila.archivo.type),
        fileId: stored.id,
      },
    });

    creados += 1;
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "content.import",
    entityType: "ContentNode",
    entityId: seccion.id,
    changes: { tanda: batchId, temas: creados, publicados: publicar },
  });

  revalidatePath(`/gestion/contenido/${seccion.editionId}`);

  return {
    ok: publicar
      ? `${creados} temas creados y publicados en «${seccion.label}».`
      : `${creados} temas creados en borrador dentro de «${seccion.label}». Revísalos y publícalos cuando quieras.`,
    batchId,
    creados,
  };
}

/**
 * Deshacer una tanda entera.
 *
 * Retira los temas creados en esa importación **y lo que cuelgue de ellos**. Eso
 * último se dice en pantalla antes de pulsar, porque si la academia ha añadido
 * algo dentro de un tema después de importarlo, se va también. Es la misma
 * semántica que borrar un apartado a mano, y esconderla sería peor.
 */
export async function deshacerImportacionAction(
  _prev: AsistenteState,
  formData: FormData,
): Promise<AsistenteState> {
  const ctx = await requirePermission("content.delete");
  const batchId = String(formData.get("batchId") ?? "");
  if (!batchId) return { error: "No se ha indicado qué importación deshacer." };

  const nodos = await ctx.db.contentNode.findMany({
    where: {
      deletedAt: null,
      metadata: { path: ["importBatch"], equals: batchId },
    },
    select: { id: true, path: true, editionId: true },
  });

  if (nodos.length === 0) {
    return { error: "Esa importación ya no está o ya se había deshecho." };
  }

  const ahora = new Date();

  // Los descendientes también: un tema retirado que dejara dentro un documento
  // vivo sería un archivo sin sitio, accesible por su identificador y sin nada
  // en pantalla que lo enseñe.
  for (const nodo of nodos) {
    await ctx.db.contentNode.updateMany({
      where: { path: { startsWith: subtreePrefix(nodo) } },
      data: { deletedAt: ahora, status: "ARCHIVED" },
    });
  }

  const { count } = await ctx.db.contentNode.updateMany({
    where: { id: { in: nodos.map((n) => n.id) } },
    data: { deletedAt: ahora, status: "ARCHIVED" },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "content.import.undo",
    entityType: "ContentNode",
    entityId: nodos[0].id,
    changes: { tanda: batchId, retirados: count },
  });

  revalidatePath(`/gestion/contenido/${nodos[0].editionId}`);
  return { ok: `Importación deshecha: ${count} elementos retirados.` };
}
