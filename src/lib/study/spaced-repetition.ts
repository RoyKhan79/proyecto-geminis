/**
 * REPETICIÓN ESPACIADA · SM-2 adaptado a preguntas tipo test
 *
 * La idea es vieja y está bien probada: una pregunta que aciertas con soltura
 * no hay que volver a verla mañana, y una que fallas hay que verla hoy mismo.
 * El intervalo crece cuando aciertas y se reinicia cuando fallas.
 *
 * Adaptación respecto al SM-2 original: allí la persona se autocalifica de 0 a
 * 5 después de ver la respuesta. Aquí no hay autocalificación —hay un test tipo
 * test— así que la calidad se deduce de dos cosas que sí sabemos: si acertó y
 * cuánto tardó. Acertar rápido es dominio; acertar tras mucho rato es duda.
 *
 * Por qué importa en una oposición: el temario es enorme y el examen es en una
 * fecha fija. Sin un criterio, el alumno repasa lo que le gusta —lo que ya se
 * sabe— y llega al examen con los mismos agujeros de septiembre.
 */

export type ResultadoRepaso = {
  intervalDays: number;
  easeFactor: number;
  nextReviewAt: Date;
};

/** Calidad de la respuesta, de 0 a 5, como en SM-2. */
export function calidadDeRespuesta(params: {
  acerto: boolean;
  segundos: number | null;
  /// Segundos que se consideran una respuesta "de dominio" para esta pregunta.
  referencia?: number;
}): number {
  const referencia = params.referencia ?? 30;

  if (!params.acerto) {
    // Fallar deprisa suele ser desconocimiento; fallar despacio, confusión
    // entre dos opciones. La segunda está más cerca de saberlo.
    if (params.segundos !== null && params.segundos > referencia) return 2;
    return 1;
  }

  if (params.segundos === null) return 4;
  if (params.segundos <= referencia * 0.5) return 5;
  if (params.segundos <= referencia * 1.5) return 4;
  return 3;
}

/**
 * Siguiente repaso.
 *
 * `easeFactor` es la facilidad acumulada de esa pregunta para ese alumno. Baja
 * cuando cuesta y sube cuando sale sola; nunca por debajo de 1.3, porque por
 * debajo el intervalo deja de crecer y la pregunta se repite eternamente.
 */
export function programarRepaso(params: {
  calidad: number;
  intervalDays: number;
  easeFactor: number;
  desde: Date;
}): ResultadoRepaso {
  const calidad = Math.max(0, Math.min(5, params.calidad));

  let ease =
    params.easeFactor +
    (0.1 - (5 - calidad) * (0.08 + (5 - calidad) * 0.02));
  ease = Math.max(1.3, Math.min(3.0, Math.round(ease * 100) / 100));

  let intervalo: number;

  if (calidad < 3) {
    // Fallo: vuelve al día siguiente. No se castiga con "hoy otra vez" porque
    // repetir la misma pregunta en la misma sesión mide memoria de trabajo, no
    // aprendizaje.
    intervalo = 1;
  } else if (params.intervalDays === 0) {
    intervalo = 1;
  } else if (params.intervalDays === 1) {
    intervalo = 3;
  } else {
    intervalo = Math.round(params.intervalDays * ease);
  }

  // Tope de seis meses: más allá, en una oposición, ya no es repaso.
  intervalo = Math.min(intervalo, 180);

  const siguiente = new Date(params.desde);
  siguiente.setHours(0, 0, 0, 0);
  siguiente.setDate(siguiente.getDate() + intervalo);

  return { intervalDays: intervalo, easeFactor: ease, nextReviewAt: siguiente };
}

/**
 * Reparto del repaso pendiente en la sesión de hoy.
 *
 * Si alguien vuelve tras dos semanas puede tener 400 preguntas vencidas. Darle
 * las 400 garantiza que no haga ninguna. Se le da una tanda abarcable, con las
 * más atrasadas primero.
 */
export function tandaDeHoy<T extends { nextReviewAt: Date | null }>(
  pendientes: T[],
  maximo = 30,
): T[] {
  return [...pendientes]
    .sort((a, b) => {
      const fa = a.nextReviewAt?.getTime() ?? 0;
      const fb = b.nextReviewAt?.getTime() ?? 0;
      return fa - fb;
    })
    .slice(0, maximo);
}
