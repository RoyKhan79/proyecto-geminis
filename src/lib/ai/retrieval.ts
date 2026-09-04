import { prismaBase } from "@/lib/db/client";
import {
  loadStudentGrants,
  studentNodeWhere,
} from "@/lib/access/content-access";

/**
 * RECUPERACIÓN CON PERMISOS (RAG)
 *
 * La pieza que hace que Catedria IA no sea una puerta trasera al material de
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
        // `studentNodeWhere` ya trae el ritmo del temario dentro. Repetirlo en
        // un segundo `spread` pisaba su clave `AND`; justo el patrón de H-07.
        /*
         * El tutor solo puede citar lo que este alumno podría leer por su
         * cuenta. Son dos permisos distintos y conviene no confundirlos: si
         * PUEDE usar el tutor lo decide «Catedria IA», y se comprueba a la
         * entrada; QUÉ puede citarle se decide aquí, y es exactamente su
         * derecho de lectura. Citar algo que ya puede abrir no es una fuga;
         * citar lo que no ha pagado sí, y por eso esto no puede ser el filtro
         * ciego a la capacidad que era antes.
         */
        ...studentNodeWhere(grants, "VIEW_CONTENT"),
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
  //
  //     OJO: la rama se INTERSECA con lo permitido, nunca lo sustituye. Aquí
  //     hubo un fallo real (H-07): se escribían las dos condiciones como dos
  //     `...spread` seguidos sobre la misma clave `nodeId`, y en JavaScript
  //     gana el último. El filtro de lo contratado se perdía en silencio y un
  //     alumno podía preguntar por la sección padre para que la IA le citara
  //     temario que no había pagado. TypeScript no avisa de esto.
  let rama: string[] | null = null;

  if (params.nodeId) {
    // El nodo por el que se pregunta tiene que estar TAMBIÉN entre los
    // permitidos. Si no, no se sigue: sin esta comprobación, un identificador
    // ajeno serviría para descubrir la ruta de una rama entera.
    const permitidos = nodosPermitidos ? new Set(nodosPermitidos) : null;
    if (permitidos && !permitidos.has(params.nodeId)) return [];

    // Llegados aquí, para el alumnado el nodo ya está comprobado contra la
    // lista de permitidos, que es la que lleva los derechos y el ritmo.
    const nodo = await prismaBase.contentNode.findFirst({
      where: { id: params.nodeId, academyId: params.academyId, deletedAt: null },
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

    const subarbol = [nodo.id, ...descendientes.map((d) => d.id)];

    // La intersección: de la rama, solo lo que además esté permitido.
    rama = permitidos ? subarbol.filter((id) => permitidos.has(id)) : subarbol;
    if (rama.length === 0) return [];
  }

  // Una sola lista de nodos, ya cruzada. Nunca dos condiciones sobre la misma
  // clave, que es lo que causó el fallo.
  const nodosFinales = rama ?? nodosPermitidos;

  // 2. Fragmentos de fuentes indexadas y activas, dentro de esos nodos.
  const fragmentos = await prismaBase.documentChunk.findMany({
    where: {
      academyId: params.academyId,
      source: { status: "INDEXED" },
      ...(nodosFinales ? { nodeId: { in: nodosFinales } } : {}),
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

/**
 * Las instrucciones del copiloto del profesorado.
 *
 * La regla que las gobierna todas: lo que genera es un **borrador** y hay que
 * decirlo. Nada llega al alumnado sin que una persona lo revise.
 */
export const SYSTEM_COPILOTO = `Eres el copiloto de un preparador de oposiciones español.

REGLAS:
1. Trabaja SOLO con los fragmentos entregados, que son material de esa academia.
2. Todo lo que generes es un BORRADOR para que una persona lo revise. Dilo
   cuando corresponda.
3. Al generar preguntas tipo test: enunciado claro, cuatro opciones plausibles,
   una sola correcta y una explicación breve que cite la fuente [n].
4. Si el material no da para lo que se te pide, dilo en lugar de rellenar.
5. Español de España, tono profesional y directo.`;
