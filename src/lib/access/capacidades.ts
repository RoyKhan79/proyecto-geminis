import type { Capability } from "@/generated/prisma/enums";
import type { CodigoModulo } from "@/lib/modules/catalogo";

/**
 * LAS HERRAMIENTAS QUE SE LE PUEDEN ABRIR A UN ALUMNO
 *
 * El mismo trato que la plataforma le da a la academia, un piso más abajo: la
 * academia paga módulos y se le encienden paneles; el alumno paga a su academia
 * y se le encienden herramientas. Esto es el catálogo de las de abajo.
 *
 * Cada capacidad declara de qué módulo depende, y eso no es decorativo: una
 * academia no puede abrirle a un alumno algo que ella misma no tiene
 * contratado. Sin esta tabla, un desplegable acabaría regalando la IA de una
 * academia que no la paga.
 */
export type Capacidad = {
  codigo: Capability;
  nombre: string;
  /// Qué significa en la práctica, con las palabras de quien atiende el
  /// mostrador y no con las del modelo de datos.
  detalle: string;
  /// El módulo que la academia necesita tener contratado para poder darla.
  modulo: CodigoModulo;
};

export const CAPACIDADES: Capacidad[] = [
  {
    codigo: "VIEW_CONTENT",
    nombre: "Ver contenido",
    detalle: "Abre el temario de la convocatoria en el Campus.",
    modulo: "CONTENIDO",
  },
  {
    codigo: "DOWNLOAD_CONTENT",
    nombre: "Descargar",
    detalle: "Además de leerlo, puede guardarse los PDF.",
    modulo: "CONTENIDO",
  },
  {
    codigo: "TAKE_TESTS",
    nombre: "Hacer tests",
    detalle: "Tests por tema, aleatorios y de sus fallos.",
    modulo: "EVALUACION",
  },
  {
    codigo: "TAKE_SIMULATIONS",
    nombre: "Simulacros",
    detalle: "Exámenes completos y cronometrados.",
    modulo: "EVALUACION",
  },
  {
    codigo: "ATTEND_CLASSES",
    nombre: "Clases en directo",
    detalle: "Entra a las clases y a las salas online.",
    modulo: "AGENDA",
  },
  {
    codigo: "WATCH_RECORDINGS",
    nombre: "Grabaciones",
    detalle: "Ve las clases ya dadas cuando quiera.",
    modulo: "AGENDA",
  },
  {
    codigo: "USE_AI_TUTOR",
    nombre: "Geminis IA",
    detalle: "Pregunta al tutor sobre el material de la academia.",
    modulo: "IA",
  },
];

/** Búsqueda por código, para pintar una capacidad suelta. */
export const CAPACIDAD: Record<Capability, Capacidad> = Object.fromEntries(
  CAPACIDADES.map((c) => [c.codigo, c]),
) as Record<Capability, Capacidad>;

/** Solo el nombre. Es lo que va en una lista o en un distintivo. */
export const CAPABILITY_LABEL: Record<Capability, string> = Object.fromEntries(
  CAPACIDADES.map((c) => [c.codigo, c.nombre]),
) as Record<Capability, string>;

/**
 * Las que esta academia puede repartir, dados los módulos que tiene.
 *
 * Se filtra en el servidor y se vuelve a comprobar al guardar: esconder una
 * casilla no impide que alguien envíe el formulario a mano.
 */
export function capacidadesDisponibles(
  modulos: ReadonlySet<CodigoModulo> | ReadonlySet<string>,
): Capacidad[] {
  return CAPACIDADES.filter((c) => modulos.has(c.modulo));
}
