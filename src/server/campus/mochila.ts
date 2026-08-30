import { prismaBase } from "@/lib/db/client";
import {
  DEFAULT_FLAGS,
  ancestorIds,
  isNodeReleased,
  loadStudentGrants,
  resolveFlags,
  studentCanAccessNode,
  studentNodeWhere,
} from "@/lib/access/content-access";

/**
 * LA MOCHILA · qué temas puede llevarse el alumno al móvil
 *
 * Quien estudia una oposición no siempre estudia con cobertura: el metro, un
 * pueblo, la sala de espera de una entrevista. Esto es lo que permite que el
 * temario que la academia va colgando se pueda guardar en el dispositivo y
 * abrirse después sin red.
 *
 * La regla de oro es que la mochila NO abre ninguna puerta nueva. Un tema entra
 * en ella solo si el alumno ya podía descargarlo a mano, lo que exige las
 * cuatro cosas de siempre:
 *
 *   1. derecho de acceso que cubra el nodo (VIEW_CONTENT),
 *   2. derecho de descarga sobre ese mismo nodo (DOWNLOAD_CONTENT),
 *   3. que la academia haya marcado la rama como descargable,
 *   4. que el profesor ya haya abierto el tema a su grupo (ritmo del temario).
 *
 * Si alguna falla, el tema no aparece en el manifiesto y el navegador no tiene
 * de dónde guardarlo. Y como el manifiesto se vuelve a pedir cada vez que hay
 * red, un tema que deja de estar autorizado —una baja, un derecho que caduca,
 * la academia que quita la descarga— desaparece también del dispositivo.
 *
 * Decisión: la marca de agua desactiva la mochila para esa rama. Una marca de
 * agua dice «quiero saber de quién es cada copia que circula», y un archivo
 * guardado sin conexión se serviría sin ella. Antes que servirlo sin marca,
 * no se guarda.
 */

export type TemaDeMochila = {
  nodeId: string;
  label: string;
  ruta: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Cambia cuando la academia sustituye el documento: obliga a refrescar. */
  version: string;
};

export type Mochila = {
  temas: TemaDeMochila[];
  /** Suma de todo lo descargable, para avisar antes de llenar el móvil. */
  totalBytes: number;
  generadoEn: string;
};

/**
 * Banderas efectivas de MUCHOS nodos de una vez.
 *
 * `getEffectiveFlags` resuelve uno solo y hace dos consultas por nodo. Con un
 * temario de doscientos temas eso son cuatrocientas consultas para pintar una
 * lista, así que aquí se cargan todos los implicados —los nodos y sus
 * ancestros— en una sola y se resuelve la herencia en memoria.
 */
async function banderasEnLote(
  academyId: string,
  nodos: { id: string; path: string }[],
) {
  const necesarios = new Set<string>();
  for (const nodo of nodos) {
    necesarios.add(nodo.id);
    for (const ancestro of ancestorIds(nodo.path)) necesarios.add(ancestro);
  }

  const filas = await prismaBase.contentNode.findMany({
    where: { academyId, id: { in: [...necesarios] } },
    select: {
      id: true,
      path: true,
      downloadable: true,
      aiEnabled: true,
      usableForTests: true,
      watermark: true,
      trackLegislation: true,
    },
  });

  const porId = new Map(filas.map((f) => [f.id, f]));

  return (nodo: { id: string; path: string }) => {
    const propio = porId.get(nodo.id);
    if (!propio) return DEFAULT_FLAGS;
    const ancestros = ancestorIds(nodo.path)
      .map((id) => porId.get(id))
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
    return resolveFlags(propio, ancestros);
  };
}

/** Los temas que este alumno puede llevarse al móvil, ahora mismo. */
export async function construirMochila(
  academyId: string,
  membershipId: string,
): Promise<Mochila> {
  const grants = await loadStudentGrants(academyId, membershipId);

  // Se pide solo lo que tiene documento: un tema sin PDF no se descarga.
  const nodos = await prismaBase.contentNode.findMany({
    where: {
      academyId,
      // `deletedAt: null` NO se repite aquí: `studentNodeWhere` ya lo trae, y
      // escribirlo dos veces sobre la misma clave es el patrón del fallo H-07.
      // `studentNodeWhere` ya aplica el ritmo del temario dentro. No se vuelve
      // a esparcir `releaseWhere` encima: pisaría su clave `AND` y es la forma
      // exacta del fallo H-07, aunque el resultado saliera igual.
      ...studentNodeWhere(grants),
      resource: { type: "PDF", fileId: { not: null } },
    },
    select: {
      id: true,
      path: true,
      label: true,
      editionId: true,
      isFree: true,
      visibleToStudents: true,
      status: true,
      updatedAt: true,
      resource: {
        select: {
          fileId: true,
          updatedAt: true,
          file: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              deletedAt: true,
            },
          },
        },
      },
    },
    orderBy: [{ path: "asc" }, { position: "asc" }],
    take: 1000,
  });

  // `studentNodeWhere` filtra por rama; la capacidad concreta la decide
  // `studentCanAccessNode`. Son cosas distintas y aquí hacen falta las dos: un
  // alumno puede tener derecho a VER una rama y no a DESCARGARLA.
  const conAcceso = nodos.filter(
    (n) =>
      studentCanAccessNode(grants, n, "VIEW_CONTENT") &&
      studentCanAccessNode(grants, n, "DOWNLOAD_CONTENT") &&
      n.resource?.file &&
      !n.resource.file.deletedAt,
  );

  const flags = await banderasEnLote(academyId, conAcceso);

  const temas: TemaDeMochila[] = [];

  for (const nodo of conAcceso) {
    const bandera = flags(nodo);
    if (!bandera.downloadable) continue;
    // Marca de agua: ver el porqué en la cabecera del módulo.
    if (bandera.watermark) continue;

    // El ritmo del temario se comprueba por nodo porque depende del grupo y de
    // las fechas de apertura, que `releaseWhere` no puede resolver del todo.
    if (!(await isNodeReleased(academyId, nodo.id, grants.groupIds))) continue;

    const archivo = nodo.resource!.file!;

    temas.push({
      nodeId: nodo.id,
      label: nodo.label,
      ruta: nodo.path,
      fileId: archivo.id,
      fileName: archivo.originalName,
      mimeType: archivo.mimeType,
      sizeBytes: archivo.sizeBytes,
      // El sello de la última modificación del recurso: si la academia sube una
      // versión nueva del tema, cambia y el móvil sabe que lo suyo caducó.
      version: (nodo.resource!.updatedAt ?? nodo.updatedAt).toISOString(),
    });
  }

  return {
    temas,
    totalBytes: temas.reduce((suma, t) => suma + t.sizeBytes, 0),
    generadoEn: new Date().toISOString(),
  };
}
