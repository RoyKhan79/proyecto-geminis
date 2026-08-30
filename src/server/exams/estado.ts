/**
 * EL RELOJ DE UN EXAMEN DE DESARROLLO
 *
 * Una sola función decide en qué momento está un examen, y la usan por igual la
 * pantalla del alumno, la acción de guardar y la de entregar. Que sea una sola
 * es el punto: si la pantalla y la acción calculasen el tiempo cada una por su
 * lado, acabarían discrepando justo en el minuto que importa.
 *
 * Y el reloj es SIEMPRE el del servidor. El navegador solo pinta la cuenta
 * atrás; cambiar la hora del móvil no da ni un segundo de más, porque nadie
 * pregunta al móvil qué hora es.
 */

export type ExamenParaEstado = {
  status: string;
  opensAt: Date | null;
  dueAt: Date | null;
  timeLimitMinutes: number | null;
};

export type EntregaParaEstado = {
  status: string;
  startedAt: Date | null;
  submittedAt: Date | null;
};

export type EstadoExamen =
  /** Publicado pero todavía no ha llegado su hora. */
  | { fase: "no_abierto"; abreEn: Date }
  /** Se puede empezar. El reloj arranca cuando el alumno pulse. */
  | { fase: "disponible" }
  /** Empezado y con tiempo por delante. */
  | { fase: "en_curso"; terminaEn: Date; segundosRestantes: number }
  /** Empezado y sin tiempo: hay que cerrarlo con lo último guardado. */
  | { fase: "tiempo_agotado"; terminoEn: Date }
  /** Entregado, a la espera de corrección. */
  | { fase: "entregado" }
  /** Corregido. */
  | { fase: "corregido" }
  /** Se cerró la convocatoria y este alumno no llegó a empezarlo. */
  | { fase: "caducado"; cerroEn: Date };

export function estadoDelExamen(
  examen: ExamenParaEstado,
  entrega: EntregaParaEstado,
  ahora: Date = new Date(),
): EstadoExamen {
  if (entrega.status === "GRADED") return { fase: "corregido" };
  if (entrega.status === "SUBMITTED" || entrega.status === "LATE") {
    return { fase: "entregado" };
  }

  if (entrega.startedAt) {
    // Sin límite de tiempo, un examen empezado sigue abierto hasta que el
    // alumno entrega o hasta la fecha de cierre de la convocatoria.
    if (examen.timeLimitMinutes === null) {
      if (examen.dueAt && examen.dueAt.getTime() <= ahora.getTime()) {
        return { fase: "tiempo_agotado", terminoEn: examen.dueAt };
      }
      return {
        fase: "en_curso",
        terminaEn: examen.dueAt ?? new Date(8.64e15),
        segundosRestantes: examen.dueAt
          ? Math.max(0, Math.floor((examen.dueAt.getTime() - ahora.getTime()) / 1000))
          : Number.POSITIVE_INFINITY,
      };
    }

    const finPorReloj =
      entrega.startedAt.getTime() + examen.timeLimitMinutes * 60_000;

    // Si la convocatoria cierra antes de que se agote el tiempo personal, manda
    // el cierre: no se puede seguir escribiendo en un examen ya cerrado aunque
    // te queden minutos por haber entrado tarde.
    const fin = examen.dueAt
      ? Math.min(finPorReloj, examen.dueAt.getTime())
      : finPorReloj;

    const restante = fin - ahora.getTime();
    if (restante <= 0) return { fase: "tiempo_agotado", terminoEn: new Date(fin) };

    return {
      fase: "en_curso",
      terminaEn: new Date(fin),
      segundosRestantes: Math.floor(restante / 1000),
    };
  }

  if (examen.opensAt && examen.opensAt.getTime() > ahora.getTime()) {
    return { fase: "no_abierto", abreEn: examen.opensAt };
  }

  if (examen.dueAt && examen.dueAt.getTime() <= ahora.getTime()) {
    return { fase: "caducado", cerroEn: examen.dueAt };
  }

  return { fase: "disponible" };
}

/** ¿Se puede escribir ahora mismo en este examen? */
export function admiteEscritura(estado: EstadoExamen): boolean {
  return estado.fase === "en_curso";
}

/**
 * Margen de gracia al entregar, en segundos.
 *
 * Entre que el alumno pulsa «Entregar» y llega la petición pasa un tiempo: la
 * red del móvil, un texto largo, un túnel. Rechazar por dos segundos una
 * entrega que el alumno hizo a tiempo sería injusto y además no protege de
 * nada, porque el borrador ya estaba guardado. Se aceptan quince segundos y se
 * anota la hora real de llegada.
 */
export const GRACIA_SEGUNDOS = 15;
