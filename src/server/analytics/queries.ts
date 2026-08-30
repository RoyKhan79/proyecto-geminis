import type { TenantClient } from "@/lib/db/tenant";

/**
 * ANALÍTICA Y RIESGO DE ABANDONO
 *
 * Decisión ADR-0020: el riesgo se calcula con REGLAS EXPLICABLES, no con un
 * modelo estadístico. Motivos:
 *
 *   · el preparador tiene que poder discutir el resultado ("¿por qué me sale
 *     María en rojo?") y actuar en consecuencia;
 *   · con pocos alumnos, un modelo aprendido daría resultados inestables y
 *     falsa autoridad;
 *   · las reglas se ajustan en una tarde; un modelo, no.
 *
 * Cuando haya volumen suficiente y merezca la pena, estas mismas señales serán
 * las variables de entrada de algo más fino. Hasta entonces, esto es más útil
 * y mucho más honesto.
 */

export type NivelRiesgo = "ALTO" | "MEDIO" | "BAJO" | "OK";

/**
 * Un alumno que necesita atención, con **el motivo**.
 *
 * Los motivos van en la propia fila a propósito: un número de riesgo sin
 * explicación no sirve para llamar a nadie, y acaba ignorándose.
 */
export type AlumnoEnRiesgo = {
  membershipId: string;
  nombre: string;
  email: string;
  nivel: NivelRiesgo;
  puntos: number;
  /// Motivos en lenguaje llano, para poder enseñárselos al preparador.
  motivos: string[];
  diasSinActividad: number | null;
  ultimaActividad: Date | null;
  testsUltimos30: number;
  mediaUltimos5: number | null;
  tendencia: "sube" | "baja" | "estable" | null;
};

const DIA = 24 * 60 * 60 * 1000;

function dias(desde: Date | null | undefined, ahora: number): number | null {
  if (!desde) return null;
  return Math.floor((ahora - desde.getTime()) / DIA);
}

/**
 * Quién está en riesgo de dejarlo, y por qué.
 *
 * Con reglas explicables y no con un modelo: días sin entrar, tests sin hacer,
 * material sin abrir, faltas a clase y resultados que bajan. Una academia tiene
 * que poder discutir el criterio, y para eso tiene que poder leerlo.
 *
 * @returns La lista con su nivel y sus motivos. **No juzga a quien acaba de
 *   matricularse**: sin historial, cualquier señal sería ruido.
 */
export async function loadRiesgoAbandono(
  db: TenantClient,
  ahora = Date.now(),
): Promise<AlumnoEnRiesgo[]> {
  const alumnos = await db.membership.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      studentProfile: { is: { status: { in: ["ACTIVE", "PENDING"] } } },
      enrollments: { some: { status: { in: ["ACTIVE", "PAST_DUE"] }, deletedAt: null } },
    },
    select: {
      id: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true, email: true, lastLoginAt: true } },
      studentProfile: { select: { lastActivityAt: true } },
      testAttempts: {
        where: { status: "SUBMITTED" },
        orderBy: { submittedAt: "desc" },
        take: 10,
        select: { submittedAt: true, scorePercent: true },
      },
      contentProgress: {
        where: { lastViewedAt: { gte: new Date(ahora - 30 * DIA) } },
        select: { id: true },
      },
      attendances: {
        where: { class: { startsAt: { gte: new Date(ahora - 30 * DIA) } } },
        select: { status: true },
      },
    },
  });

  const resultado: AlumnoEnRiesgo[] = [];

  for (const alumno of alumnos) {
    const motivos: string[] = [];
    let puntos = 0;

    // Un alumno recién matriculado todavía no tiene historial: no se le juzga.
    const antiguedad = dias(alumno.createdAt, ahora) ?? 0;
    const esNuevo = antiguedad < 10;

    const ultimaActividad =
      alumno.studentProfile?.lastActivityAt ?? alumno.user.lastLoginAt ?? null;
    const sinActividad = dias(ultimaActividad, ahora);

    // ── Señal 1: hace cuánto que no aparece ──────────────────────────────────
    if (sinActividad === null) {
      if (!esNuevo) {
        puntos += 3;
        motivos.push("No ha entrado nunca en el Campus");
      }
    } else if (sinActividad >= 21) {
      puntos += 4;
      motivos.push(`${sinActividad} días sin actividad`);
    } else if (sinActividad >= 14) {
      puntos += 3;
      motivos.push(`${sinActividad} días sin actividad`);
    } else if (sinActividad >= 7) {
      puntos += 2;
      motivos.push(`${sinActividad} días sin actividad`);
    }

    // ── Señal 2: tests hechos en el último mes ───────────────────────────────
    const testsUltimos30 = alumno.testAttempts.filter(
      (t) => t.submittedAt && t.submittedAt.getTime() >= ahora - 30 * DIA,
    ).length;

    if (!esNuevo && testsUltimos30 === 0) {
      puntos += 2;
      motivos.push("Ningún test en los últimos 30 días");
    }

    // ── Señal 3: material sin abrir ──────────────────────────────────────────
    if (!esNuevo && alumno.contentProgress.length === 0) {
      puntos += 2;
      motivos.push("No ha abierto material este mes");
    }

    // ── Señal 4: faltas a clase ──────────────────────────────────────────────
    const total = alumno.attendances.length;
    const faltas = alumno.attendances.filter((a) => a.status === "ABSENT").length;
    if (total >= 3 && faltas / total >= 0.5) {
      puntos += 2;
      motivos.push(`Ha faltado a ${faltas} de ${total} clases`);
    }

    // ── Señal 5: los resultados bajan ────────────────────────────────────────
    const notas = alumno.testAttempts
      .filter((t) => t.scorePercent !== null)
      .map((t) => Number(t.scorePercent));

    let mediaUltimos5: number | null = null;
    let tendencia: AlumnoEnRiesgo["tendencia"] = null;

    if (notas.length >= 2) {
      const ultimos = notas.slice(0, 5);
      mediaUltimos5 = Math.round(ultimos.reduce((a, b) => a + b, 0) / ultimos.length);

      if (notas.length >= 4) {
        const recientes = notas.slice(0, 2);
        const previos = notas.slice(2, 5);
        const mediaReciente = recientes.reduce((a, b) => a + b, 0) / recientes.length;
        const mediaPrevia = previos.reduce((a, b) => a + b, 0) / previos.length;
        const delta = mediaReciente - mediaPrevia;

        if (delta <= -15) {
          puntos += 2;
          tendencia = "baja";
          motivos.push(`Sus resultados han bajado ${Math.round(-delta)} puntos`);
        } else if (delta >= 10) {
          tendencia = "sube";
        } else {
          tendencia = "estable";
        }
      }

      if (mediaUltimos5 < 40) {
        puntos += 1;
        motivos.push(`Media baja: ${mediaUltimos5}%`);
      }
    }

    const nivel: NivelRiesgo =
      puntos >= 6 ? "ALTO" : puntos >= 4 ? "MEDIO" : puntos >= 2 ? "BAJO" : "OK";

    resultado.push({
      membershipId: alumno.id,
      nombre: `${alumno.user.firstName} ${alumno.user.lastName ?? ""}`.trim(),
      email: alumno.user.email,
      nivel,
      puntos,
      motivos,
      diasSinActividad: sinActividad,
      ultimaActividad,
      testsUltimos30,
      mediaUltimos5,
      tendencia,
    });
  }

  const orden: Record<NivelRiesgo, number> = { ALTO: 0, MEDIO: 1, BAJO: 2, OK: 3 };
  return resultado.sort(
    (a, b) => orden[a.nivel] - orden[b.nivel] || b.puntos - a.puntos,
  );
}

/** Cifras generales de la academia. */
export async function loadResumenAcademia(db: TenantClient, ahora = Date.now()) {
  const hace30 = new Date(ahora - 30 * 24 * 60 * 60 * 1000);
  const hace7 = new Date(ahora - 7 * 24 * 60 * 60 * 1000);

  const [
    alumnosActivos,
    altas30,
    bajas30,
    activosSemana,
    testsSemana,
    intentos,
    clases30,
    pagosPendientes,
  ] = await Promise.all([
    db.membership.count({
      where: { deletedAt: null, studentProfile: { is: { status: "ACTIVE" } } },
    }),
    db.membership.count({
      where: { deletedAt: null, studentProfile: { isNot: null }, createdAt: { gte: hace30 } },
    }),
    db.membership.count({
      where: {
        deletedAt: null,
        studentProfile: { is: { status: { in: ["INACTIVE", "ON_HOLD"] } } },
        updatedAt: { gte: hace30 },
      },
    }),
    db.membership.count({
      where: {
        deletedAt: null,
        studentProfile: { is: { lastActivityAt: { gte: hace7 } } },
      },
    }),
    db.testAttempt.count({ where: { status: "SUBMITTED", submittedAt: { gte: hace7 } } }),
    db.testAttempt.findMany({
      where: { status: "SUBMITTED", submittedAt: { gte: hace30 } },
      select: { scorePercent: true },
    }),
    db.classSession.count({
      where: { deletedAt: null, startsAt: { gte: hace30, lte: new Date(ahora) } },
    }),
    db.payment.count({ where: { status: "PENDING" } }),
  ]);

  const notas = intentos
    .map((i) => Number(i.scorePercent ?? 0))
    .filter((n) => !Number.isNaN(n));
  const media =
    notas.length > 0 ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null;

  return {
    alumnosActivos,
    altas30,
    bajas30,
    activosSemana,
    testsSemana,
    mediaResultados: media,
    clases30,
    pagosPendientes,
    participacion:
      alumnosActivos > 0 ? Math.round((activosSemana / alumnosActivos) * 100) : 0,
  };
}

/** Temas donde el alumnado falla más, para saber qué reforzar en clase. */
export async function loadTemasProblematicos(db: TenantClient, limite = 8) {
  const preguntas = await db.question.findMany({
    where: { deletedAt: null, status: "PUBLISHED", timesAnswered: { gte: 3 } },
    select: {
      timesAnswered: true,
      timesCorrect: true,
      node: { select: { id: true, label: true } },
    },
  });

  const porTema = new Map<
    string,
    { label: string; respuestas: number; aciertos: number }
  >();

  for (const pregunta of preguntas) {
    if (!pregunta.node) continue;
    const actual = porTema.get(pregunta.node.id) ?? {
      label: pregunta.node.label,
      respuestas: 0,
      aciertos: 0,
    };
    actual.respuestas += pregunta.timesAnswered;
    actual.aciertos += pregunta.timesCorrect;
    porTema.set(pregunta.node.id, actual);
  }

  return [...porTema.entries()]
    .map(([id, datos]) => ({
      id,
      label: datos.label,
      respuestas: datos.respuestas,
      acierto: Math.round((datos.aciertos / datos.respuestas) * 100),
    }))
    .sort((a, b) => a.acierto - b.acierto)
    .slice(0, limite);
}

/** Preguntas que conviene revisar: casi nadie acierta o acierta todo el mundo. */
export async function loadPreguntasARevisar(db: TenantClient) {
  const preguntas = await db.question.findMany({
    where: { deletedAt: null, status: "PUBLISHED", timesAnswered: { gte: 5 } },
    select: {
      id: true,
      statement: true,
      timesAnswered: true,
      timesCorrect: true,
      node: { select: { label: true } },
    },
  });

  return preguntas
    .map((p) => ({
      ...p,
      acierto: Math.round((p.timesCorrect / p.timesAnswered) * 100),
    }))
    .filter((p) => p.acierto < 25 || p.acierto > 97)
    .map((p) => ({
      ...p,
      motivo:
        p.acierto < 25
          ? ("Casi nadie la acierta: puede estar mal redactada o mal la respuesta" as const)
          : ("La acierta todo el mundo: aporta poco" as const),
    }))
    .sort((a, b) => a.acierto - b.acierto)
    .slice(0, 10);
}
