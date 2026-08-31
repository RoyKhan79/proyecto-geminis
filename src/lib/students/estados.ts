import type { StudentStatus } from "@/generated/prisma/enums";

/**
 * CÓMO SE PINTA EL ESTADO DE UN ALUMNO
 *
 * Está aquí, en `lib/`, y no junto a las consultas del servidor por un motivo
 * concreto que costó un fallo: un componente de cliente que importe algo de
 * `server/` se arrastra al navegador **todo el árbol de ese módulo**, y ahí
 * dentro está el cliente de base de datos y la validación del entorno. En el
 * navegador no existe `DATABASE_URL`, así que la validación reventaba al cargar
 * y la pantalla de alta de alumnos no llegaba a pintarse: «This page couldn't
 * load».
 *
 * La regla que evita que vuelva a pasar: si algo lo necesita el navegador, no
 * vive en `server/`. Una etiqueta y un color son presentación, no consulta.
 */

/** El nombre de cada estado, en el idioma de la academia. */
export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  PENDING: "Pendiente",
  ACTIVE: "Activo",
  ON_HOLD: "Baja temporal",
  INACTIVE: "Baja",
  ALUMNI: "Antiguo alumno",
};

/**
 * El color de cada estado.
 *
 * Va aparte de la etiqueta para que signifique lo mismo en toda la aplicación:
 * un alumno de baja se ve igual en su ficha, en el listado y en los cobros.
 */
export const STUDENT_STATUS_TONE: Record<
  StudentStatus,
  "neutral" | "positive" | "caution" | "critical" | "info"
> = {
  PENDING: "caution",
  ACTIVE: "positive",
  ON_HOLD: "caution",
  INACTIVE: "critical",
  ALUMNI: "neutral",
};
