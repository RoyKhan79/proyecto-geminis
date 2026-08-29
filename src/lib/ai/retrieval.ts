import { prismaBase } from "@/lib/db/client";
import {
  loadStudentGrants,
  releaseWhere,
  studentNodeWhere,
} from "@/lib/access/content-access";

/**
 * RECUPERACIÓN CON PERMISOS (RAG)
 *
 * La pieza que hace que Geminis IA no sea una puerta trasera al material de
 * pago. El orden es innegociable (§112):
 *
 *   sesión → academia → permisos → matrículas → derechos → ritmo del temario
 *   → fuentes autorizadas → BÚSQUEDA → contexto → modelo → respuesta con citas
 *
 * El filtro va ANTES de buscar, nunca después. Filtrar los resultados después
 * significa que el sistema ya ha leído material que esa persona no puede ver, y
 * basta un descuido para que acabe en la respuesta.
 *
 * ADR-0011: todavía sin vectores. La búsqueda es léxica sobre los fragmentos
 * indexados, con puntuación por coincidencia de términos. Cuando el entorno
 * tenga pgvector se sustituye SOLO esta función: el filtro de permisos, las
 * citas y el resto del flujo no cambian. Es deliberado que lo que condiciona el
 * diseño esté hecho y lo que es sustituible se pueda sustituir.
 */

export type Fragmento = {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  nodeLabel: string | null;
  locator: string | null;
  content: string;
  score: number;
};

const VACIAS = new Set([
  "el", "la", "los", "las", "un", "una", "de", "del", "que", "y", "o", "en",
  "por", "para", "con", "se", "es", "al", "a", "su", "sus", "lo", "como",
  "cual", "cuales", "cuando", "donde", "sobre", "entre", "este", "esta",
  "esto", "ese", "esa", "me", "mi", "te", "tu", "qué", "cómo", "cuál",
]);

function terminos(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9ñ]+/)
    .filter((t) => t.length > 2 && !VACIAS.has(t));
}

/**
 * Fragmentos que ESTA persona puede leer, ordenados por relevancia.
 *
 * Para el alumnado se aplican derechos de acceso y ritmo del temario. Para el
 * personal de la academia, todo el material autorizado para IA de su academia.
 */
export async function recuperarFragmentos(params: {
  academyId: string;
  membershipId: string;
  esPersonal: boolean;
  pregunta: string;
  nodeId?: string | null;
  limite?: number;
}): Promise<Fragmento[]> {
  const limite = params.limite ?? 6;
  const claves = terminos(params.pregunta);
  if (claves.length === 0) return [];

  // 1. Qué nodos puede ver esta persona. AQUÍ se aplica todo el control.
  let nodosPermitidos: string[] | null = null;

  if (!params.esPersonal) {
    const grants = await loadStudentGrants(params.academyId, params.membershipId);
    const nodos = await prismaBase.contentNode.findMany({
      where: {
        academyId: params.academyId,
        ...studentNodeWhere(grants),
        ...releaseWhere(grants.groupIds),
      },
      select: { id: true },
    });
    nodosPermitidos = nodos.map((n) => n.id);

    // Sin nodos accesibles no hay nada que buscar. Devolver vacío es lo
    // correcto: la IA dirá que no encuentra información, que es la verdad.
    if (nodosPermitidos.length === 0) return [];
  }

  // 1b. Si se pregunta por un tema concreto, la rama entera y no solo el nodo.
  //     Los documentos cuelgan DENTRO del tema, así que filtrar por el id del
  //     tema a secas no encontraba ni un fragmento: el material está en sus
  //     hijos. Se usa la ruta materializada (ADR-0007).
  let rama: string[] | null = null;

  if (params.nodeId) {
    const nodo = await prismaBase.contentNode.findFirst({
      where: { id: params.nodeId, academyId: params.academyId },
      select: { id: true, path: true },
    });
    if (!nodo) return [];

    const descendientes = await prismaBase.contentNode.findMany({
      where: {
        academyId: params.academyId,
        deletedAt: null,
        path: { startsWith: `${nodo.path}${nodo.id}/` },
      },
      select: { id: true },
    });
    rama = [nodo.id, ...descendientes.map((d) => d.id)];
  }

  // 2. Fragmentos de fuentes indexadas y activas, dentro de esos nodos.
  const fragmentos = await prismaBase.documentChunk.findMany({
    where: {
      academyId: params.academyId,
      source: { status: "INDEXED" },
      ...(nodosPermitidos ? { nodeId: { in: nodosPermitidos } } : {}),
      ...(rama ? { nodeId: { in: rama } } : {}),
      // Solo material que la academia ha autorizado para la IA.
      OR: [
        { node: { aiEnabled: true } },
        { node: { aiEnabled: null } },
        { nodeId: null },
      ],
    },
    select: {
      id: true,
      content: true,
      locator: true,
      sourceId: true,
      source: { select: { title: true } },
      node: { select: { label: true } },
    },
    take: 400,
  });

  // 3. Puntuación léxica. Simple y explicable; se sustituirá por vectores.
  const puntuados = fragmentos
    .map((fragmento) => {
      const texto = terminos(fragmento.content);
      const conjunto = new Set(texto);
      let score = 0;
      for (const clave of claves) {
        if (conjunto.has(clave)) score += 2;
        else if (texto.some((t) => t.startsWith(clave.slice(0, 5)))) score += 1;
      }
      return {
        chunkId: fragmento.id,
        sourceId: fragmento.sourceId,
        sourceTitle: fragmento.source.title,
        nodeLabel: fragmento.node?.label ?? null,
        locator: fragmento.locator,
        content: fragmento.content,
        score,
      };
    })
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score);

  return puntuados.slice(0, limite);
}

/**
 * Construye el contexto que se envía al modelo.
 *
 * Cada fragmento va numerado para que la respuesta pueda citarlo. Se envía solo
 * lo necesario: ni la ficha del alumno, ni sus pagos, ni nada personal (§10).
 */
export function construirContexto(fragmentos: Fragmento[]): string {
  return fragmentos
    .map(
      (f, i) =>
        `[${i + 1}] ${f.sourceTitle}${f.nodeLabel ? ` · ${f.nodeLabel}` : ""}${
          f.locator ? ` · ${f.locator}` : ""
        }\n${f.content}`,
    )
    .join("\n\n---\n\n");
}

/**
 * Instrucciones del sistema.
 *
 * Lo importante no es que la IA suene bien: es que NO invente y que se calle
 * cuando no sabe. En una oposición, una respuesta plausible y falsa sobre un
 * plazo administrativo puede costar la plaza.
 */
export const SYSTEM_ALUMNO = `Eres el asistente de estudio de una academia de oposiciones española.

REGLAS QUE NO PUEDES SALTARTE:
1. Responde ÚNICAMENTE con la información de los fragmentos que se te entregan.
2. Si los fragmentos no bastan, dilo con estas palabras: "No encuentro esa
   información en el material de tu academia. Consúltalo con tu preparador."
   Es preferible eso a una respuesta aproximada.
3. Cita SIEMPRE las fuentes usando su número entre corchetes, así: [1], [2].
   No cites un número que no exista.
4. No completes con conocimiento general de internet ni con lo que recuerdes de
   otras leyes: el material de la academia manda, aunque creas que está
   desactualizado. Si detectas una posible contradicción, señálala en lugar de
   corregirla por tu cuenta.
5. Escribe en español de España, claro y directo, como explicaría un buen
   preparador. Nada de rodeos ni de lenguaje comercial.`;

export const SYSTEM_COPILOTO = `Eres el copiloto de un preparador de oposiciones español.

REGLAS:
1. Trabaja SOLO con los fragmentos entregados, que son material de esa academia.
2. Todo lo que generes es un BORRADOR para que una persona lo revise. Dilo
   cuando corresponda.
3. Al generar preguntas tipo test: enunciado claro, cuatro opciones plausibles,
   una sola correcta y una explicación breve que cite la fuente [n].
4. Si el material no da para lo que se te pide, dilo en lugar de rellenar.
5. Español de España, tono profesional y directo.`;
