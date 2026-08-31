import type { Permission } from "@/lib/auth/permissions";

/**
 * EL CATÁLOGO DE MÓDULOS
 * ──────────────────────
 * Una academia no compra «Geminis»: compra las partes que necesita. Una
 * academia pequeña que solo da clases presenciales no quiere pagar por la app
 * del alumnado; una que vende temario online no necesita la facturación si ya
 * la lleva su gestoría.
 *
 * Aquí está qué se puede contratar, qué incluye cada cosa y qué depende de qué.
 * El precio de catálogo también, pero cada academia puede tener el suyo: los
 * precios se negocian, y un sistema que no lo admita obliga a mentir en algún
 * sitio.
 *
 * ── LO QUE HACE QUE ESTO NO SEA DECORACIÓN ─────────────────────────────────
 *
 * Un módulo sin contratar **no se puede usar**, no solo «no se ve». Cada
 * permiso pertenece a un módulo (`MODULO_DE_PERMISO`), y las guardas que ya
 * comprueban permisos comprueban además el módulo. Así la protección entra por
 * el mismo sitio por el que entra todo —`requirePermission`— y no hay que
 * acordarse de añadirla en cada pantalla nueva.
 *
 * Esconder el menú es cortesía; lo que protege es que la acción diga que no.
 */

/** Lo que se puede contratar. */
export type CodigoModulo =
  | "NUCLEO"
  | "CONTENIDO"
  | "EVALUACION"
  | "TAREAS"
  | "AGENDA"
  | "COBROS"
  | "FACTURACION"
  | "COMUNICACION"
  | "CAMPUS"
  | "IA"
  | "ANALITICA"
  | "NORMATIVA";

export type Modulo = {
  codigo: CodigoModulo;
  nombre: string;
  /** Para qué sirve, en una frase que entienda quien va a pagarlo. */
  resumen: string;
  /** Qué entra exactamente. Se enseña tal cual al contratar. */
  incluye: string[];
  /** Precio de catálogo al mes, en céntimos. */
  precioCents: number;
  /**
   * No se puede quitar.
   *
   * Sin el núcleo no hay producto: un sistema sin alumnos ni matrículas no es
   * un ERP de academia, es una carpeta.
   */
  esNucleo?: boolean;
  /** Módulos sin los cuales este no tiene sentido. */
  requiere?: CodigoModulo[];
  /** Orden en el que se enseña. De lo más básico a lo más específico. */
  orden: number;
};

/**
 * El catálogo.
 *
 * Los precios son de catálogo y mensuales. Están aquí y no solo en la base de
 * datos para que exista una lista de referencia versionada: si alguien cambia
 * un precio en producción, se puede ver contra qué lo cambió.
 */
export const CATALOGO: Modulo[] = [
  {
    codigo: "NUCLEO",
    nombre: "Núcleo",
    resumen:
      "El alumnado, las matrículas y la configuración de la academia. Es la base de todo lo demás.",
    incluye: [
      "Ficha de cada alumno, con su historial",
      "Oposiciones, convocatorias, cursos y grupos",
      "Matrículas y derechos de acceso",
      "Profesorado y personal, con sus roles y permisos",
      "Importación desde otro sistema, con simulación y vuelta atrás",
      "Registro de auditoría y copias de seguridad",
    ],
    precioCents: 4900,
    esNucleo: true,
    orden: 1,
  },
  {
    codigo: "CONTENIDO",
    nombre: "Temario",
    resumen:
      "Subir el temario, organizarlo como lo tenga la academia y decidir quién ve qué y cuándo.",
    incluye: [
      "Árbol de contenido con los nombres de la academia",
      "Asistente para subir una carpeta entera de PDF de una vez",
      "Ritmo del temario: abrir temas por grupo",
      "Descarga, marca de agua y visibilidad por rama",
      "Versiones de cada documento",
    ],
    precioCents: 3900,
    orden: 2,
  },
  {
    codigo: "EVALUACION",
    nombre: "Tests y simulacros",
    resumen:
      "El banco de preguntas y los exámenes tipo test, que se corrigen solos.",
    incluye: [
      "Banco de preguntas por tema, con estados y revisión",
      "Importación de preguntas con detección de repetidas",
      "Simulacros con reloj, penalización e intentos",
      "Repaso programado y estadísticas por pregunta",
    ],
    precioCents: 3900,
    orden: 3,
  },
  {
    codigo: "TAREAS",
    nombre: "Tareas y exámenes de desarrollo",
    resumen:
      "Lo que corrige una persona: supuestos, trabajos y exámenes escritos con reloj.",
    incluye: [
      "Tareas con plazo y entrega de archivos",
      "Exámenes de desarrollo con hora, reloj y guardado automático",
      "Corrección con nota y comentario",
      "Devolver un trabajo para rehacerlo sin perder lo anterior",
    ],
    precioCents: 2900,
    orden: 4,
  },
  {
    codigo: "AGENDA",
    nombre: "Agenda y clases",
    resumen: "El calendario de la academia, la asistencia y las salas online.",
    incluye: [
      "Agenda con vista de mes y de semana",
      "Clases con su tema, su profesor y su aula",
      "Asistencia con cinco estados",
      "Salas online permanentes",
    ],
    precioCents: 2400,
    orden: 5,
  },
  {
    codigo: "COBROS",
    nombre: "Cobros",
    resumen:
      "Quién ha pagado y quién debe, con los cargos mensuales al banco.",
    incluye: [
      "Recibos en efectivo, tarjeta y transferencia",
      "Cargo mensual en cuenta, con el IBAN cifrado",
      "Remesas SEPA listas para subir al banco",
      "Suspensión automática del acceso al devolver un recibo",
    ],
    precioCents: 3400,
    orden: 6,
  },
  {
    codigo: "FACTURACION",
    nombre: "Facturación",
    resumen:
      "Facturas con numeración correlativa, IVA y rectificativas. Como pide la ley.",
    incluye: [
      "Series con numeración correlativa e inmutable",
      "IVA por línea y exención del artículo 20.Uno.9º",
      "Facturas rectificativas",
      "Exportación para la gestoría",
    ],
    precioCents: 2400,
    requiere: ["COBROS"],
    orden: 7,
  },
  {
    codigo: "COMUNICACION",
    nombre: "Comunicación",
    resumen: "Hablar con el alumnado: muro, mensajes y envíos a muchos.",
    incluye: [
      "Muro de clase con comentarios",
      "Mensajes uno a uno",
      "Envíos a un grupo, a un curso o a quien deba dinero",
      "Avisos automáticos de tareas y correcciones",
    ],
    precioCents: 1900,
    orden: 8,
  },
  {
    codigo: "CAMPUS",
    nombre: "App del alumnado",
    resumen:
      "La aplicación con la que estudia el alumnado, en el móvil y sin tienda de apps.",
    incluye: [
      "Se instala desde el navegador, con su icono",
      "Estudiar el temario contratado",
      "Descargar temas para estudiar sin cobertura",
      "Hacer tests, simulacros y exámenes",
      "Calendario, muro, mensajes y salas",
      "Límite de dispositivos por alumno",
    ],
    precioCents: 4900,
    orden: 9,
  },
  {
    codigo: "IA",
    nombre: "Geminis IA",
    resumen:
      "El asistente que responde con el material de la academia, y el copiloto del preparador.",
    incluye: [
      "Responde solo con el material de la academia, y cita de dónde",
      "Explica por qué se ha fallado cada pregunta",
      "Copiloto: genera preguntas y resúmenes en borrador",
      "Plan de estudio diario con su motivo",
      "Funciona sin contratar ninguna API externa",
    ],
    precioCents: 4900,
    requiere: ["CONTENIDO"],
    orden: 10,
  },
  {
    codigo: "ANALITICA",
    nombre: "Analítica",
    resumen:
      "Cómo va la academia y, sobre todo, quién está a punto de dejarlo.",
    incluye: [
      "Alumnado en riesgo de abandono, con el motivo",
      "Rendimiento por tema y por grupo",
      "Preguntas que más se fallan",
      "Actividad y uso del material",
    ],
    precioCents: 1900,
    orden: 11,
  },
  {
    codigo: "NORMATIVA",
    nombre: "Normativa y radar del BOE",
    resumen:
      "Vigilar las leyes que cambian y las convocatorias que salen.",
    incluye: [
      "Normas y artículos enlazados con los temas que los explican",
      "Aviso cuando cambia una ley que afecta a tu temario",
      "Radar del BOE: avisa cuando sale la convocatoria",
      "Marcado automático del material posiblemente desactualizado",
    ],
    precioCents: 1900,
    orden: 12,
  },
];

/** El catálogo indexado por código, para no recorrerlo cada vez. */
export const MODULOS: Record<CodigoModulo, Modulo> = Object.fromEntries(
  CATALOGO.map((m) => [m.codigo, m]),
) as Record<CodigoModulo, Modulo>;

/** Los módulos que no se pueden quitar. */
export const MODULOS_NUCLEO = CATALOGO.filter((m) => m.esNucleo).map((m) => m.codigo);

/**
 * PACKS PREPARADOS
 *
 * Nadie quiere elegir doce casillas la primera vez. Estos son los tres montajes
 * que cubren casi todas las academias; a partir de ahí se ajusta.
 */
export type Pack = {
  codigo: string;
  nombre: string;
  para: string;
  modulos: CodigoModulo[];
};

export const PACKS: Pack[] = [
  {
    codigo: "esencial",
    nombre: "Esencial",
    para: "Academia presencial que quiere dejar de llevar las matrículas y los cobros en hojas de cálculo.",
    modulos: ["NUCLEO", "AGENDA", "COBROS", "COMUNICACION"],
  },
  {
    codigo: "online",
    nombre: "Online",
    para: "Academia que vende temario y tests, con su app para el alumnado.",
    modulos: [
      "NUCLEO",
      "CONTENIDO",
      "EVALUACION",
      "CAMPUS",
      "COMUNICACION",
      "COBROS",
    ],
  },
  {
    codigo: "completo",
    nombre: "Completo",
    para: "Todo, incluida la IA y el radar del BOE.",
    modulos: CATALOGO.map((m) => m.codigo),
  },
];

// ── Qué permiso pertenece a qué módulo ───────────────────────────────────────

/**
 * El mapa que convierte el catálogo en algo que se cumple.
 *
 * Cada permiso pertenece a un módulo. Las guardas que ya comprueban permisos
 * comprueban también esto, así que una pantalla de un módulo no contratado no
 * es que se esconda: es que su acción responde que no.
 *
 * Un permiso que falte aquí se considera del núcleo, que es lo prudente:
 * olvidarse de añadir uno deja la función disponible, no la rompe. Y hay una
 * prueba que comprueba que están todos, para que ese olvido se vea.
 */
export const MODULO_DE_PERMISO: Partial<Record<Permission, CodigoModulo>> = {
  // Temario
  "content.read": "CONTENIDO",
  "content.write": "CONTENIDO",
  "content.publish": "CONTENIDO",
  "content.delete": "CONTENIDO",
  "content.settings": "CONTENIDO",

  // Tests y simulacros
  "questions.read": "EVALUACION",
  "questions.write": "EVALUACION",
  "questions.publish": "EVALUACION",
  "tests.read": "EVALUACION",
  "tests.write": "EVALUACION",
  "tests.publish": "EVALUACION",
  "attempts.read.all": "EVALUACION",
  "attempts.take": "EVALUACION",

  // Agenda y clases
  "classes.read": "AGENDA",
  "classes.write": "AGENDA",
  "attendance.write": "AGENDA",

  // Cobros
  "payments.read": "COBROS",
  "payments.write": "COBROS",

  // Comunicación
  "communications.send": "COMUNICACION",

  // App del alumnado
  "campus.access": "CAMPUS",

  // Geminis IA
  "ai.student": "IA",
  "ai.copilot": "IA",
  "ai.settings": "IA",

  // Analítica
  "analytics.read": "ANALITICA",

  // Normativa y radar
  "legislation.read": "NORMATIVA",
  "legislation.write": "NORMATIVA",
  "legislation.review": "NORMATIVA",
};

/**
 * ¿A qué módulo pertenece este permiso?
 *
 * @param permiso El permiso.
 * @returns Su módulo, o `NUCLEO` si no está mapeado. Lo no mapeado es del
 *   núcleo a propósito: un permiso olvidado deja la función disponible en
 *   lugar de romperla sin avisar.
 */
export function moduloDelPermiso(permiso: Permission): CodigoModulo {
  return MODULO_DE_PERMISO[permiso] ?? "NUCLEO";
}

// ── Composición y precio ─────────────────────────────────────────────────────

/**
 * Completa una selección con lo que hace falta para que funcione.
 *
 * El núcleo entra siempre, y las dependencias también: contratar Geminis IA sin
 * temario deja un asistente sin nada que citar, y facturación sin cobros deja
 * facturas que no se cruzan con ningún pago. Se añaden en lugar de dar un
 * error, y en pantalla se dice cuáles se han añadido.
 *
 * @param elegidos Lo que ha marcado quien contrata.
 * @returns La selección completa, ordenada como el catálogo.
 */
export function resolverDependencias(elegidos: CodigoModulo[]): CodigoModulo[] {
  const completa = new Set<CodigoModulo>([...MODULOS_NUCLEO, ...elegidos]);

  // Se repite hasta que no se añade nada más: una dependencia puede traer otra.
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const codigo of [...completa]) {
      for (const necesario of MODULOS[codigo]?.requiere ?? []) {
        if (!completa.has(necesario)) {
          completa.add(necesario);
          cambio = true;
        }
      }
    }
  }

  return CATALOGO.filter((m) => completa.has(m.codigo)).map((m) => m.codigo);
}

/** Qué módulos se han añadido solos al resolver dependencias. */
export function anadidosPorDependencia(elegidos: CodigoModulo[]): CodigoModulo[] {
  const pedidos = new Set(elegidos);
  return resolverDependencias(elegidos).filter(
    (c) => !pedidos.has(c) && !MODULOS_NUCLEO.includes(c),
  );
}

/**
 * Qué otros módulos se caerían al quitar este.
 *
 * Sirve para avisar antes de desmarcar: quitar Cobros se lleva Facturación por
 * delante, y es mejor decirlo que hacerlo callando.
 *
 * @param codigo El que se quiere quitar.
 * @param actuales Lo que hay contratado ahora.
 * @returns Los que dejarían de tener sentido. Vacío si no arrastra a nadie.
 */
export function arrastraAlQuitar(
  codigo: CodigoModulo,
  actuales: CodigoModulo[],
): CodigoModulo[] {
  const sinEl = actuales.filter((c) => c !== codigo);
  return sinEl.filter((c) => (MODULOS[c]?.requiere ?? []).includes(codigo));
}

export type Presupuesto = {
  lineas: {
    codigo: CodigoModulo;
    nombre: string;
    /** Lo que se cobra por esta línea. */
    precioCents: number;
    /** El de catálogo, para poder enseñar el tachado cuando se ha pactado otro. */
    precioCatalogoCents: number;
    /** Si esta línea lleva un precio negociado distinto del de catálogo. */
    pactado: boolean;
  }[];
  /** Suma antes del descuento. */
  subtotalCents: number;
  descuentoCents: number;
  /** Porcentaje aplicado, para poder enseñarlo. */
  descuentoPorcentaje: number;
  /** De dónde sale ese porcentaje. Se enseña, porque cambia la conversación. */
  descuentoOrigen: "volumen" | "pactado";
  totalCents: number;
};

/**
 * Descuento por volumen.
 *
 * Cuantos más módulos, más barato sale cada uno. No es generosidad: una
 * academia que contrata ocho módulos da menos trabajo de soporte por módulo que
 * ocho academias con uno, y sobre todo se queda. Los tramos son redondos a
 * propósito, para poder explicarlos por teléfono sin una calculadora.
 */
export function descuentoPorVolumen(cuantosModulos: number): number {
  if (cuantosModulos >= 10) return 20;
  if (cuantosModulos >= 7) return 15;
  if (cuantosModulos >= 5) return 10;
  return 0;
}

/**
 * Calcula lo que paga una academia al mes.
 *
 * @param modulos Los módulos contratados. Se resuelven las dependencias antes
 *   de sumar, para que el precio sea el de lo que se va a activar de verdad.
 * @param preciosPactados Precios negociados con esa academia, por módulo y en
 *   céntimos. Lo que no esté aquí se cobra al precio de catálogo.
 * @returns El desglose línea a línea, el descuento y el total. Todo en
 *   céntimos y en enteros: con decimales, la suma de doce líneas no cuadra con
 *   el total y alguien acaba discutiendo un céntimo por teléfono.
 */
export function calcularPresupuesto(
  modulos: CodigoModulo[],
  preciosPactados: Partial<Record<CodigoModulo, number>> = {},
  descuentoPactado?: number | null,
): Presupuesto {
  const completos = resolverDependencias(modulos);

  const lineas = completos.map((codigo) => {
    const catalogo = MODULOS[codigo].precioCents;
    const pactado = preciosPactados[codigo];
    return {
      codigo,
      nombre: MODULOS[codigo].nombre,
      precioCents: pactado ?? catalogo,
      precioCatalogoCents: catalogo,
      pactado: pactado !== undefined && pactado !== catalogo,
    };
  });

  const subtotalCents = lineas.reduce((suma, l) => suma + l.precioCents, 0);

  // Un descuento pactado sustituye al de volumen, incluido el cero: un acuerdo
  // puede ser precisamente que no haya descuento porque los precios de línea ya
  // se negociaron. Por eso se comprueba contra null/undefined y no por
  // «si es verdadero».
  const hayPactado = descuentoPactado !== null && descuentoPactado !== undefined;
  const descuentoPorcentaje = hayPactado
    ? Math.max(0, Math.min(100, Math.round(descuentoPactado)))
    : descuentoPorVolumen(completos.length);

  const descuentoCents = Math.round((subtotalCents * descuentoPorcentaje) / 100);

  return {
    lineas,
    subtotalCents,
    descuentoCents,
    descuentoPorcentaje,
    descuentoOrigen: hayPactado ? "pactado" : "volumen",
    totalCents: subtotalCents - descuentoCents,
  };
}
