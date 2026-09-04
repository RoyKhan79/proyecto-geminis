import type { Capability } from "@/generated/prisma/enums";
import { prismaBase } from "@/lib/db/client";

/**
 * MOTOR DE ACCESO A CONTENIDO
 * ───────────────────────────
 * Responde a una única pregunta, y la responde igual para todo el sistema:
 *
 *   ¿puede ESTA persona hacer ESTO sobre ESTA rama del contenido?
 *
 * Lo usan el Campus (abrir un tema), el visor de documentos (firmar una URL),
 * el módulo de tests (lanzar un test) y —esto es lo importante— la recuperación
 * de Catedria IA (§111): la IA no puede citar un fragmento que el alumno no haya
 * contratado, porque preguntarle a la IA no puede ser una puerta trasera para
 * leer material de pago.
 *
 * Reglas:
 *   1. El personal de la academia (profesores, administración) no pasa por
 *      derechos de acceso: su alcance lo definen el rol y sus asignaciones.
 *   2. El alumno accede a un nodo si el nodo es libre (`isFree`) o si tiene un
 *      derecho activo que cubre ese nodo o alguno de sus ancestros.
 *   3. Las banderas de uso (descarga, IA, marca de agua) se HEREDAN del ancestro
 *      más cercano que las tenga definidas. Así la academia configura una vez
 *      "Temario" y toda la rama lo respeta, y puede afinar una carpeta suelta.
 */

export type GrantPrefix = {
  /// Prefijo de ruta que cubre el nodo y todos sus descendientes.
  prefix: string;
  nodeId: string;
  capabilities: Set<Capability>;
};

/**
 * Los derechos ACTIVOS de un alumno, ya traducidos a prefijos de ruta.
 *
 * Se carga una vez por petición y se reutiliza. Trabajar con prefijos y no con
 * listas de nodos es lo que hace que un derecho sobre «Temario» cubra sus
 * doscientos temas sin guardar doscientas filas.
 */
export type StudentGrants = {
  /// Ramas concedidas.
  prefixes: GrantPrefix[];
  /// Convocatorias concedidas al completo (derechos por curso, sin nodo concreto).
  editionIds: Set<string>;
  editionCapabilities: Map<string, Set<Capability>>;
  /// Grupos del alumno. Determinan el RITMO al que se le abre el temario.
  groupIds: string[];
};

const NOW = () => new Date();

/**
 * Carga los derechos ACTIVOS de un alumno y los traduce a prefijos de ruta.
 * Es la consulta que se hace una vez por petición y se reutiliza.
 */
export async function loadStudentGrants(
  academyId: string,
  studentMembershipId: string,
): Promise<StudentGrants> {
  const now = NOW();

  const entitlements = await prismaBase.entitlement.findMany({
    where: {
      academyId,
      studentId: studentMembershipId,
      status: "ACTIVE",
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    select: {
      id: true,
      enrollment: { select: { course: { select: { oppositionEditionId: true } } } },
      scopes: {
        select: {
          capability: true,
          courseId: true,
          editionId: true,
          node: { select: { id: true, path: true, editionId: true } },
        },
      },
    },
  });

  // Grupos del alumno: el profesor abre el temario grupo a grupo, así que sin
  // esto no se puede saber por qué tema va cada uno.
  const matriculas = await prismaBase.enrollment.findMany({
    where: {
      academyId,
      studentId: studentMembershipId,
      deletedAt: null,
      status: { in: ["ACTIVE", "PAST_DUE"] },
    },
    select: { groupId: true },
  });
  const groupIds = matriculas
    .map((m) => m.groupId)
    .filter((id): id is string => Boolean(id));

  const byNode = new Map<string, GrantPrefix>();
  const editionIds = new Set<string>();
  const editionCapabilities = new Map<string, Set<Capability>>();

  const addEditionCapability = (editionId: string, capability: Capability) => {
    editionIds.add(editionId);
    const set = editionCapabilities.get(editionId) ?? new Set<Capability>();
    set.add(capability);
    editionCapabilities.set(editionId, set);
  };

  for (const entitlement of entitlements) {
    const editionFromCourse = entitlement.enrollment?.course?.oppositionEditionId;

    for (const scope of entitlement.scopes) {
      if (scope.node) {
        const key = scope.node.id;
        const existing = byNode.get(key);
        const prefix = `${scope.node.path}${scope.node.id}/`;
        if (existing) {
          existing.capabilities.add(scope.capability);
        } else {
          byNode.set(key, {
            nodeId: scope.node.id,
            prefix,
            capabilities: new Set([scope.capability]),
          });
        }
      } else if (scope.editionId) {
        // Alcance dado a mano desde la ficha del alumno: la capacidad cubre esa
        // convocatoria entera, sin depender de que exista una matrícula.
        addEditionCapability(scope.editionId, scope.capability);
      } else if (editionFromCourse) {
        // Derecho sin nodo concreto: cubre toda la convocatoria del curso.
        addEditionCapability(editionFromCourse, scope.capability);
      }
    }

    // Un derecho sin alcances declarados y ligado a una matrícula concede la
    // convocatoria completa: es el caso "curso completo" y evita obligar a la
    // academia a configurar nada para el escenario más común.
    if (entitlement.scopes.length === 0 && editionFromCourse) {
      addEditionCapability(editionFromCourse, "VIEW_CONTENT");
      addEditionCapability(editionFromCourse, "TAKE_TESTS");
      addEditionCapability(editionFromCourse, "ATTEND_CLASSES");
      addEditionCapability(editionFromCourse, "WATCH_RECORDINGS");
      addEditionCapability(editionFromCourse, "USE_AI_TUTOR");
    }
  }

  return {
    prefixes: [...byNode.values()],
    editionIds,
    editionCapabilities,
    groupIds,
  };
}

/**
 * RITMO DE PUBLICACIÓN
 *
 * Condición que debe cumplir un nodo para estar abierto al alumno, además de
 * estar publicado y de que él tenga derecho de acceso:
 *
 *   · si el nodo no tiene reglas de apertura → basta con su fecha `availableFrom`
 *     (vacía = disponible ya);
 *   · si las tiene → el alumno debe pertenecer a un grupo con la regla abierta,
 *     o existir una regla para «todos los grupos» ya vencida.
 *
 * Es lo que permite subir el temario completo el primer día y que el alumno
 * solo vea por dónde va su clase.
 *
 * OJO al usarla: `studentNodeWhere` YA la incluye dentro. Esparcir las dos sobre
 * el mismo objeto —`...studentNodeWhere(g), ...releaseWhere(g.groupIds)`— hace
 * que la segunda pise la clave `AND` de la primera. Ahora mismo el resultado
 * salía igual de casualidad, porque las dos generaban el mismo filtro, pero es
 * exactamente la forma del fallo H-07: dos `spread` sobre la misma clave, gana
 * el último, y TypeScript no dice nada. Si hace falta otra hora de referencia,
 * pásala como segundo argumento de `studentNodeWhere`.
 */
export function releaseWhere(groupIds: string[], now: Date = new Date()) {
  return {
    AND: [
      { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
      {
        OR: [
          // 1. Sin ninguna regla: manda el estado global. Caso más común.
          { releases: { none: {} } },
          // 2. Regla abierta para el grupo del alumno: gana sobre la general.
          ...(groupIds.length > 0
            ? [
                {
                  releases: {
                    some: {
                      groupId: { in: groupIds },
                      isOpen: true,
                      releasedAt: { lte: now },
                    },
                  },
                },
              ]
            : []),
          // 3. Sin regla propia del grupo, pero abierta para todos.
          {
            AND: [
              ...(groupIds.length > 0
                ? [{ releases: { none: { groupId: { in: groupIds } } } }]
                : []),
              {
                releases: {
                  some: { groupId: null, isOpen: true, releasedAt: { lte: now } },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Lo mínimo de un nodo para decidir si alguien puede verlo.
 *
 * Se pide como tipo suelto y no como el modelo entero a propósito: así queda
 * escrito en la firma que estas funciones deciden con estos campos y con
 * ninguno más.
 */
export type NodeForAccess = {
  id: string;
  path: string;
  editionId: string;
  isFree: boolean;
  visibleToStudents: boolean;
  status: string;
};

/** ¿Cubre algún derecho a este nodo, con la capacidad indicada? */
export function grantsCover(
  grants: StudentGrants,
  node: NodeForAccess,
  capability: Capability = "VIEW_CONTENT",
): boolean {
  const ownPrefix = `${node.path}${node.id}/`;

  for (const grant of grants.prefixes) {
    const covered =
      grant.nodeId === node.id || ownPrefix.startsWith(grant.prefix);
    if (covered && grant.capabilities.has(capability)) return true;
  }

  const editionCaps = grants.editionCapabilities.get(node.editionId);
  if (editionCaps?.has(capability)) return true;

  return false;
}

/**
 * Decisión final para un alumno sobre un nodo.
 * `isFree` solo abre la visualización: descargar o usar la IA siguen exigiendo
 * un derecho, porque son cosas distintas (§113).
 */
export function studentCanAccessNode(
  grants: StudentGrants,
  node: NodeForAccess,
  capability: Capability = "VIEW_CONTENT",
): boolean {
  if (!node.visibleToStudents) return false;
  if (node.status !== "PUBLISHED") return false;
  if (capability === "VIEW_CONTENT" && node.isFree) return true;
  return grantsCover(grants, node, capability);
}

/**
 * Fragmento `where` de Prisma que limita una consulta de ContentNode a lo que
 * el alumno puede ver. Se aplica en la propia consulta, no filtrando después:
 * así no se pagina sobre datos que luego hay que descartar.
 *
 * ¿Tiene este alumno esta herramienta en alguna parte?
 *
 * Es la comprobación de ENTRADA, la que decide si se le deja abrir el tutor o
 * empezar un simulacro. `studentNodeWhere` contesta a otra pregunta —sobre QUÉ
 * contenido— y confundirlas es lo que dejaba las cinco capacidades que no son
 * de lectura sin comprobar en ningún sitio: la academia las marcaba en la ficha
 * y no servían para nada.
 */
export function tieneCapacidad(
  grants: StudentGrants,
  capability: Capability,
): boolean {
  for (const grant of grants.prefixes) {
    if (grant.capabilities.has(capability)) return true;
  }
  for (const capacidades of grants.editionCapabilities.values()) {
    if (capacidades.has(capability)) return true;
  }
  return false;
}

/**
 * @param grants Los derechos del alumno, ya cargados.
 * @param capability Para qué se pide el contenido. **No es opcional de
 *   verdad**: el valor por defecto es solo para las pantallas que enseñan
 *   temario, y pasarlo mal abre contenido que no toca.
 * @param now Momento con el que se compara el ritmo de apertura del profesor.
 * @returns Un `where` de Prisma. Si no tiene ningún derecho con esa capacidad,
 *   el `OR` sale vacío y la consulta no devuelve nada, que es lo correcto.
 */
export function studentNodeWhere(
  grants: StudentGrants,
  capability: Capability = "VIEW_CONTENT",
  now: Date = new Date(),
) {
  /*
   * ── EL FILTRO MIRA LA CAPACIDAD, NO SOLO LA CONVOCATORIA ────────────────────
   *
   * Antes se construía con `editionIds`, que es ciego a la capacidad: bastaba
   * UN derecho cualquiera sobre una convocatoria —«clases en directo», por
   * ejemplo— para que todos sus temas entraran en la consulta.
   *
   * Las pantallas que después vuelven a comprobar con `studentCanAccessNode`
   * quedaban a salvo, pero la IA, los tests y los simulacros usan este filtro
   * SOLO. Así que a quien se le abrían las clases se le abría también el
   * temario entero a través del tutor, que es exactamente la puerta trasera que
   * el §111 dice que no puede existir.
   */
  const branchFilters = grants.prefixes
    .filter((grant) => grant.capabilities.has(capability))
    .map((grant) => ({
      OR: [{ id: grant.nodeId }, { path: { startsWith: grant.prefix } }],
    }));

  const ediciones = [...grants.editionCapabilities.entries()]
    .filter(([, capacidades]) => capacidades.has(capability))
    .map(([editionId]) => editionId);

  const editionFilter =
    ediciones.length > 0 ? [{ editionId: { in: ediciones } }] : [];

  /*
   * Lo marcado como muestra gratuita se lee y se testea; no se descarga ni
   * entra en simulacros ni en el tutor.
   *
   * Que se pueda hacer un test de un tema libre es deliberado y es una
   * herramienta comercial: quien todavía no ha comprado nada prueba un test de
   * ejemplo. Lo dice `loadStudentTestTopics`, y dejarlo fuera al hacer este
   * filtro consciente de la capacidad le quitaba a la academia su gancho de
   * venta sin que nadie se enterara.
   *
   * Descargarlo es otra cosa: ahí hay un archivo de por medio, y el propio
   * `/api/archivos` ya lo niega.
   */
  const libre =
    capability === "VIEW_CONTENT" || capability === "TAKE_TESTS"
      ? [{ isFree: true }]
      : [];

  return {
    status: "PUBLISHED" as const,
    visibleToStudents: true,
    deletedAt: null,
    OR: [...libre, ...branchFilters, ...editionFilter],
    // El ritmo se aplica en la misma consulta: lo que el profesor todavía no ha
    // abierto no llega ni a salir de la base de datos.
    ...releaseWhere(grants.groupIds, now),
  };
}

/*
 * Si no tiene ningún derecho con esa capacidad, el `OR` queda vacío y Prisma no
 * devuelve nada. Es el comportamiento correcto —sin derecho no hay contenido— y
 * está aquí escrito para que nadie lo "arregle" añadiéndole un `undefined`.
 */

/**
 * ¿Está abierto este nodo para el alumno, según el ritmo del profesor?
 * Versión para comprobar UN nodo concreto (el filtro de consulta va aparte).
 */
export async function isNodeReleased(
  academyId: string,
  nodeId: string,
  groupIds: string[],
  now: Date = new Date(),
): Promise<boolean> {
  const nodo = await prismaBase.contentNode.findFirst({
    where: { id: nodeId, academyId },
    select: {
      availableFrom: true,
      releases: { select: { groupId: true, isOpen: true, releasedAt: true } },
    },
  });
  if (!nodo) return false;

  if (nodo.availableFrom && nodo.availableFrom.getTime() > now.getTime()) return false;
  if (nodo.releases.length === 0) return true;

  const vigente = (r: { isOpen: boolean; releasedAt: Date }) =>
    r.isOpen && r.releasedAt.getTime() <= now.getTime();

  // La regla del grupo del alumno manda sobre la general.
  const propia = nodo.releases.find(
    (r) => r.groupId !== null && groupIds.includes(r.groupId),
  );
  if (propia) return vigente(propia);

  const general = nodo.releases.find((r) => r.groupId === null);
  if (general) return vigente(general);

  // Hay reglas, pero ninguna aplica a este alumno: cerrado.
  return false;
}

// ── Banderas heredadas ───────────────────────────────────────────────────────

/**
 * Las banderas de uso de una rama del temario.
 *
 * Se heredan hacia abajo: gana el valor definido más cerca del nodo. `null` en
 * la base significa «lo que diga mi padre», y por eso aquí ya vienen resueltas
 * a `true` o `false`.
 */
export type InheritableFlags = {
  downloadable: boolean;
  aiEnabled: boolean;
  usableForTests: boolean;
  watermark: boolean;
  trackLegislation: boolean;
};

/**
 * Valores por defecto cuando ni el nodo ni sus ancestros dicen nada.
 * `downloadable` es false a propósito: si nadie lo ha autorizado, no se
 * descarga (§113). El resto son útiles por defecto y desactivables.
 */
export const DEFAULT_FLAGS: InheritableFlags = {
  downloadable: false,
  aiEnabled: true,
  usableForTests: true,
  watermark: false,
  trackLegislation: true,
};

type FlagCarrier = {
  id: string;
  path: string;
  downloadable: boolean | null;
  aiEnabled: boolean | null;
  usableForTests: boolean | null;
  watermark: boolean | null;
  trackLegislation: boolean | null;
};

/** Identificadores de los ancestros de un nodo, de la raíz hacia abajo. */
export function ancestorIds(path: string): string[] {
  return path.split("/").filter(Boolean);
}

/**
 * Resuelve las banderas efectivas: gana el valor definido más cercano al nodo.
 * `ancestors` debe venir ordenado de raíz a padre.
 */
export function resolveFlags(
  node: FlagCarrier,
  ancestors: FlagCarrier[],
): InheritableFlags {
  const chain = [...ancestors, node];
  const result = { ...DEFAULT_FLAGS };

  for (const link of chain) {
    if (link.downloadable !== null) result.downloadable = link.downloadable;
    if (link.aiEnabled !== null) result.aiEnabled = link.aiEnabled;
    if (link.usableForTests !== null) result.usableForTests = link.usableForTests;
    if (link.watermark !== null) result.watermark = link.watermark;
    if (link.trackLegislation !== null)
      result.trackLegislation = link.trackLegislation;
  }

  return result;
}

/** Carga el nodo y sus ancestros y devuelve las banderas efectivas. */
export async function getEffectiveFlags(
  academyId: string,
  nodeId: string,
): Promise<InheritableFlags | null> {
  const select = {
    id: true,
    path: true,
    downloadable: true,
    aiEnabled: true,
    usableForTests: true,
    watermark: true,
    trackLegislation: true,
  };

  const node = await prismaBase.contentNode.findFirst({
    where: { id: nodeId, academyId },
    select,
  });
  if (!node) return null;

  const ids = ancestorIds(node.path);
  if (ids.length === 0) return resolveFlags(node, []);

  const ancestors = await prismaBase.contentNode.findMany({
    where: { academyId, id: { in: ids } },
    select,
  });
  const order = new Map(ids.map((id, index) => [id, index]));
  ancestors.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return resolveFlags(node, ancestors);
}
