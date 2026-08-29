import { createHash } from "node:crypto";
import { prismaBase } from "@/lib/db/client";
import { storage } from "@/lib/storage";

/**
 * INDEXADOR DE LA BASE DE CONOCIMIENTO
 *
 * Convierte el material autorizado de una academia en fragmentos consultables
 * por Geminis IA. Solo entra aquí lo que la academia ha marcado como usable por
 * la IA (§105), y cada fragmento guarda de dónde sale para poder citarlo.
 *
 * Los PDFs se procesan extrayendo el texto plano que llevan dentro. No se hace
 * OCR: un temario escaneado sin capa de texto no se puede indexar, y es mejor
 * decirlo que fingir que sí.
 */

/** Trocea un texto en fragmentos con solape, sin partir frases por la mitad. */
export function trocear(
  texto: string,
  tamano = 1200,
  solape = 150,
): { content: string; position: number }[] {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length === 0) return [];

  const trozos: { content: string; position: number }[] = [];
  let inicio = 0;
  let posicion = 0;

  while (inicio < limpio.length) {
    let fin = Math.min(inicio + tamano, limpio.length);

    // Se corta en un punto y seguido si hay uno cerca: partir una frase por la
    // mitad estropea tanto la búsqueda como la cita.
    if (fin < limpio.length) {
      const corte = limpio.lastIndexOf(". ", fin);
      if (corte > inicio + tamano * 0.5) fin = corte + 1;
    }

    trozos.push({ content: limpio.slice(inicio, fin).trim(), position: posicion });
    posicion += 1;

    // El solape arranca en el espacio anterior, no en el carácter exacto: si
    // no, el fragmento siguiente empieza a media palabra («...mite de
    // audiencia») y eso es justo lo que después se le cita al alumno.
    let siguiente = fin - solape;
    if (siguiente > inicio) {
      const espacio = limpio.indexOf(" ", siguiente);
      if (espacio !== -1 && espacio < fin) siguiente = espacio + 1;
    }
    inicio = siguiente > inicio ? siguiente : fin;
  }

  return trozos.filter((t) => t.content.length > 40);
}

/**
 * Extrae el texto de un PDF sin dependencias externas.
 *
 * Lee los flujos de contenido y recupera lo que hay entre paréntesis de los
 * operadores de texto. Funciona con PDFs generados digitalmente, que son la
 * mayoría de los temarios; con escaneados devuelve vacío, y el indexador lo
 * marca como no indexable en lugar de guardar basura.
 */
export function extraerTextoPdf(buffer: Buffer): string {
  const crudo = buffer.toString("latin1");
  const partes: string[] = [];

  for (const flujo of crudo.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
    const contenido = flujo[1];

    for (const texto of contenido.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g)) {
      const limpio = texto[1]
        .replace(/\\([()\\])/g, "$1")
        .replace(/\\n/g, " ")
        .trim();
      if (limpio) partes.push(limpio);
    }

    for (const bloque of contenido.matchAll(/\[((?:[^[\]\\]|\\.)*)\]\s*TJ/g)) {
      for (const texto of bloque[1].matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)) {
        const limpio = texto[1].replace(/\\([()\\])/g, "$1").trim();
        if (limpio) partes.push(limpio);
      }
    }
  }

  return quitarCabeceras(partes).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Quita encabezados y pies repetidos.
 *
 * Casi todo temario lleva el título del tema arriba de cada página y el número
 * de página abajo. Al extraer el texto eso se mete en mitad de las frases, y
 * después la IA lo cita como si fuera contenido: «...el plazo será de [título
 * del tema - pág. 4] tres meses». Se detecta por repetición, no por posición,
 * porque la extracción no conserva dónde acababa cada página.
 */
function quitarCabeceras(partes: string[]): string[] {
  const veces = new Map<string, number>();
  for (const parte of partes) {
    if (parte.length > 90) continue;
    veces.set(parte, (veces.get(parte) ?? 0) + 1);
  }

  // Una línea corta que se repite tres veces o más en un documento es un
  // encabezado. Un párrafo largo repetido, en cambio, puede ser contenido real
  // (una fórmula legal que se repite), así que ese no se toca.
  const cabeceras = new Set(
    [...veces.entries()]
      .filter(([texto, n]) => n >= 3 && texto.length <= 90)
      .map(([texto]) => texto),
  );

  // Y hay dos formas que son cabecera aunque no se repitan: el número de página
  // suelto, y la línea corta que termina en «pág. N».
  const numeroSuelto = /^\s*(pág\.?|pag\.?|página|pagina)?\s*\d{1,4}\s*$/i;
  const terminaEnPagina = /[-–·|]?\s*(pág\.?|pag\.?|página|pagina)\s*\d{1,4}\s*$/i;

  return partes.filter(
    (parte) =>
      !cabeceras.has(parte) &&
      !numeroSuelto.test(parte) &&
      !(parte.length <= 90 && terminaEnPagina.test(parte)),
  );
}

export type ResultadoIndexado = {
  fuente: string;
  fragmentos: number;
  estado: "INDEXED" | "FAILED";
  motivo?: string;
};

/** Indexa un nodo de contenido, comprobando antes que la academia lo autoriza. */
export async function indexarNodo(
  academyId: string,
  nodeId: string,
): Promise<ResultadoIndexado> {
  const nodo = await prismaBase.contentNode.findFirst({
    where: { id: nodeId, academyId, deletedAt: null },
    select: {
      id: true,
      label: true,
      path: true,
      editionId: true,
      aiEnabled: true,
      resource: {
        select: {
          type: true,
          richText: true,
          file: { select: { id: true, storageKey: true, mimeType: true } },
        },
      },
    },
  });

  if (!nodo) {
    return { fuente: nodeId, fragmentos: 0, estado: "FAILED", motivo: "No existe." };
  }

  // La bandera se hereda; aquí basta con respetar la negación explícita.
  if (nodo.aiEnabled === false) {
    return {
      fuente: nodo.label,
      fragmentos: 0,
      estado: "FAILED",
      motivo: "La academia ha excluido este contenido de la IA.",
    };
  }

  let texto = "";
  if (nodo.resource?.richText) {
    texto = nodo.resource.richText.replace(/<[^>]+>/g, " ");
  } else if (
    nodo.resource?.file &&
    nodo.resource.file.mimeType === "application/pdf"
  ) {
    const stream = await storage().getStream(nodo.resource.file.storageKey);
    const trozos: Buffer[] = [];
    for await (const trozo of stream) trozos.push(Buffer.from(trozo));
    texto = extraerTextoPdf(Buffer.concat(trozos));
  }

  if (texto.trim().length < 60) {
    return {
      fuente: nodo.label,
      fragmentos: 0,
      estado: "FAILED",
      motivo:
        "No se ha podido extraer texto. Si es un PDF escaneado, hará falta pasarle OCR antes.",
    };
  }

  const checksum = createHash("sha256").update(texto).digest("hex");

  const existente = await prismaBase.knowledgeSource.findFirst({
    where: { academyId, nodeId: nodo.id },
    select: { id: true, checksum: true, version: true, chunkCount: true },
  });

  // Si el contenido no ha cambiado, no se reindexa: es tiempo y dinero. Pero se
  // comprueba que los fragmentos siguen ahí. Sin esta comprobación, una fuente
  // a la que le faltan los fragmentos se queda marcada como indexada para
  // siempre y la IA no encuentra nada, sin que nadie sepa por qué.
  const fragmentosVivos =
    existente === null
      ? 0
      : await prismaBase.documentChunk.count({
          where: { academyId, sourceId: existente.id },
        });

  if (existente?.checksum === checksum && fragmentosVivos > 0) {
    return {
      fuente: nodo.label,
      fragmentos: 0,
      estado: "INDEXED",
      motivo: "Sin cambios.",
    };
  }

  const fuente = existente
    ? await prismaBase.knowledgeSource.update({
        where: { id: existente.id },
        data: {
          status: "PROCESSING",
          checksum,
          version: existente.version + 1,
          error: null,
        },
      })
    : await prismaBase.knowledgeSource.create({
        data: {
          academyId,
          nodeId: nodo.id,
          fileId: nodo.resource?.file?.id ?? null,
          title: nodo.label,
          status: "PROCESSING",
          checksum,
        },
      });

  await prismaBase.documentChunk.deleteMany({ where: { sourceId: fuente.id } });

  const trozos = trocear(texto);

  await prismaBase.documentChunk.createMany({
    data: trozos.map((trozo) => ({
      academyId,
      sourceId: fuente.id,
      nodeId: nodo.id,
      nodePath: nodo.path,
      editionId: nodo.editionId,
      position: trozo.position,
      content: trozo.content,
      tokens: Math.ceil(trozo.content.length / 4),
      locator: `fragmento ${trozo.position + 1}`,
    })),
  });

  await prismaBase.knowledgeSource.update({
    where: { id: fuente.id },
    data: {
      status: "INDEXED",
      chunkCount: trozos.length,
      lastIndexedAt: new Date(),
    },
  });

  return { fuente: nodo.label, fragmentos: trozos.length, estado: "INDEXED" };
}

/** Indexa todo el material indexable de una academia. */
export async function indexarAcademia(academyId: string) {
  const nodos = await prismaBase.contentNode.findMany({
    where: {
      academyId,
      deletedAt: null,
      OR: [
        { resource: { is: { type: "PDF" } } },
        { resource: { is: { type: "RICH_TEXT" } } },
      ],
    },
    select: { id: true },
  });

  const resultados: ResultadoIndexado[] = [];
  for (const nodo of nodos) {
    resultados.push(await indexarNodo(academyId, nodo.id));
  }
  return resultados;
}
