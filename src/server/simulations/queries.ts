import type { TenantClient } from "@/lib/db/tenant";

/**
 * Consultas de simulacros.
 *
 * El percentil solo se calcula con muestra suficiente. Decirle a alguien que
 * está «en el percentil 80» cuando lo han hecho cuatro personas no informa:
 * confunde y da una falsa sensación de seguridad (§14).
 */
export const MUESTRA_MINIMA_PERCENTIL = 8;

export async function loadSimulationPanel(db: TenantClient) {
  const [plantillas, simulacros, ediciones] = await Promise.all([
    db.examBlueprint.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        totalQuestions: true,
        durationMinutes: true,
        penaltyPerWrong: true,
        passingScore: true,
        optionsPerQuestion: true,
        edition: { select: { name: true, opposition: { select: { name: true } } } },
        _count: { select: { tests: true } },
      },
    }),
    db.testDefinition.findMany({
      where: { kind: "SIMULATION", deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        questionCount: true,
        timeLimitMinutes: true,
        penaltyPerWrong: true,
        availableFrom: true,
        availableUntil: true,
        maxAttempts: true,
        blueprint: { select: { name: true } },
        attempts: {
          where: { status: { in: ["SUBMITTED", "EXPIRED"] } },
          select: { scorePercent: true, correctCount: true, totalQuestions: true },
        },
      },
    }),
    db.oppositionEdition.findMany({
      where: { deletedAt: null },
      orderBy: { name: "desc" },
      select: {
        id: true,
        name: true,
        opposition: { select: { name: true } },
      },
    }),
  ]);

  return {
    plantillas,
    simulacros: simulacros.map((s) => {
      const notas = s.attempts
        .map((a) => Number(a.scorePercent ?? 0))
        .filter((n) => !Number.isNaN(n));
      return {
        ...s,
        realizados: notas.length,
        media:
          notas.length > 0
            ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length)
            : null,
      };
    }),
    ediciones,
  };
}

/** Simulacros que este alumno puede hacer ahora mismo. */
export async function loadStudentSimulations(
  db: TenantClient,
  studentId: string,
  ahora = Date.now(),
) {
  const simulacros = await db.testDefinition.findMany({
    where: {
      kind: "SIMULATION",
      status: "PUBLISHED",
      deletedAt: null,
      OR: [{ availableFrom: null }, { availableFrom: { lte: new Date(ahora) } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      questionCount: true,
      timeLimitMinutes: true,
      penaltyPerWrong: true,
      availableUntil: true,
      maxAttempts: true,
      attempts: {
        where: { studentId },
        select: { id: true, status: true, scorePercent: true, submittedAt: true },
      },
    },
  });

  return simulacros
    .filter((s) => !s.availableUntil || s.availableUntil.getTime() >= ahora)
    .map((s) => ({
      ...s,
      intentosHechos: s.attempts.length,
      agotado: Boolean(s.maxAttempts && s.attempts.length >= s.maxAttempts),
      mejorNota:
        s.attempts.length > 0
          ? Math.max(...s.attempts.map((a) => Number(a.scorePercent ?? 0)))
          : null,
    }));
}

/**
 * Percentil del alumno dentro de la academia en ese simulacro.
 * Devuelve null si la muestra es pequeña: es preferible no decir nada.
 */
export async function calcularPercentil(
  db: TenantClient,
  testDefinitionId: string,
  miNota: number,
): Promise<{ percentil: number; muestra: number; media: number } | null> {
  const intentos = await db.testAttempt.findMany({
    where: {
      testDefinitionId,
      status: { in: ["SUBMITTED", "EXPIRED"] },
      scorePercent: { not: null },
    },
    select: { scorePercent: true },
  });

  if (intentos.length < MUESTRA_MINIMA_PERCENTIL) return null;

  const notas = intentos.map((i) => Number(i.scorePercent));
  const pordebajo = notas.filter((n) => n < miNota).length;

  return {
    percentil: Math.round((pordebajo / notas.length) * 100),
    muestra: notas.length,
    media: Math.round(notas.reduce((a, b) => a + b, 0) / notas.length),
  };
}
