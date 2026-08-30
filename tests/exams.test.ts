import { describe, expect, it } from "vitest";
import {
  GRACIA_SEGUNDOS,
  admiteEscritura,
  estadoDelExamen,
  type EntregaParaEstado,
  type ExamenParaEstado,
} from "@/server/exams/estado";

/**
 * EL RELOJ DE UN EXAMEN DE DESARROLLO
 *
 * Lo que se comprueba aquí no es una función bonita: es que a nadie se le regale
 * tiempo y que a nadie se le quite. Las dos cosas se cuentan como injusticia en
 * una academia, y la segunda además pierde el trabajo del alumno.
 *
 * Todos los casos fijan la hora a mano. Un test de plazos que dependa del reloj
 * de la máquina falla un martes cualquiera a las dos de la mañana y nadie sabe
 * por qué.
 */

const T = (iso: string) => new Date(iso);

function examen(over: Partial<ExamenParaEstado> = {}): ExamenParaEstado {
  return {
    status: "PUBLISHED",
    opensAt: null,
    dueAt: null,
    timeLimitMinutes: 90,
    ...over,
  };
}

function entrega(over: Partial<EntregaParaEstado> = {}): EntregaParaEstado {
  return { status: "PENDING", startedAt: null, submittedAt: null, ...over };
}

describe("antes de empezar", () => {
  it("no deja empezar antes de la hora de apertura", () => {
    const estado = estadoDelExamen(
      examen({ opensAt: T("2026-09-01T10:00:00Z") }),
      entrega(),
      T("2026-09-01T09:59:00Z"),
    );
    expect(estado.fase).toBe("no_abierto");
  });

  it("deja empezar en cuanto llega la hora", () => {
    const estado = estadoDelExamen(
      examen({ opensAt: T("2026-09-01T10:00:00Z") }),
      entrega(),
      T("2026-09-01T10:00:00Z"),
    );
    expect(estado.fase).toBe("disponible");
  });

  it("marca como no presentado a quien no llegó a empezarlo", () => {
    const estado = estadoDelExamen(
      examen({ dueAt: T("2026-09-01T12:00:00Z") }),
      entrega(),
      T("2026-09-01T12:00:01Z"),
    );
    expect(estado.fase).toBe("caducado");
  });
});

describe("mientras se escribe", () => {
  it("cuenta los minutos desde que el ALUMNO abrió, no desde la convocatoria", () => {
    // Convocado a las 10:00, pero este alumno entró a las 10:20. Le quedan sus
    // 90 minutos completos menos lo que lleve escribiendo, no 70.
    const estado = estadoDelExamen(
      examen({ opensAt: T("2026-09-01T10:00:00Z"), timeLimitMinutes: 90 }),
      entrega({ startedAt: T("2026-09-01T10:20:00Z") }),
      T("2026-09-01T10:30:00Z"),
    );

    expect(estado.fase).toBe("en_curso");
    if (estado.fase !== "en_curso") return;
    expect(estado.terminaEn.toISOString()).toBe("2026-09-01T11:50:00.000Z");
    expect(estado.segundosRestantes).toBe(80 * 60);
  });

  it("el cierre de la convocatoria manda sobre el reloj personal", () => {
    // Entró tarde y sus 90 minutos se pasarían del cierre: manda el cierre.
    // Si no, quien entra el último se queda escribiendo cuando el examen ya
    // se ha cerrado para el resto.
    const estado = estadoDelExamen(
      examen({ dueAt: T("2026-09-01T12:00:00Z"), timeLimitMinutes: 90 }),
      entrega({ startedAt: T("2026-09-01T11:00:00Z") }),
      T("2026-09-01T11:30:00Z"),
    );

    expect(estado.fase).toBe("en_curso");
    if (estado.fase !== "en_curso") return;
    expect(estado.terminaEn.toISOString()).toBe("2026-09-01T12:00:00.000Z");
    expect(estado.segundosRestantes).toBe(30 * 60);
  });

  it("sin reloj sigue abierto hasta el cierre de la convocatoria", () => {
    const abierto = estadoDelExamen(
      examen({ timeLimitMinutes: null, dueAt: T("2026-09-01T14:00:00Z") }),
      entrega({ startedAt: T("2026-09-01T10:00:00Z") }),
      T("2026-09-01T13:59:00Z"),
    );
    expect(abierto.fase).toBe("en_curso");

    const cerrado = estadoDelExamen(
      examen({ timeLimitMinutes: null, dueAt: T("2026-09-01T14:00:00Z") }),
      entrega({ startedAt: T("2026-09-01T10:00:00Z") }),
      T("2026-09-01T14:00:00Z"),
    );
    expect(cerrado.fase).toBe("tiempo_agotado");
  });

  it("sin reloj y sin cierre no se agota nunca", () => {
    const estado = estadoDelExamen(
      examen({ timeLimitMinutes: null, dueAt: null }),
      entrega({ startedAt: T("2026-09-01T10:00:00Z") }),
      T("2030-01-01T00:00:00Z"),
    );
    expect(estado.fase).toBe("en_curso");
  });
});

describe("cuando se acaba", () => {
  it("al segundo exacto todavía se puede escribir; al siguiente ya no", () => {
    const justo = estadoDelExamen(
      examen({ timeLimitMinutes: 60 }),
      entrega({ startedAt: T("2026-09-01T10:00:00Z") }),
      T("2026-09-01T10:59:59Z"),
    );
    expect(admiteEscritura(justo)).toBe(true);

    const pasado = estadoDelExamen(
      examen({ timeLimitMinutes: 60 }),
      entrega({ startedAt: T("2026-09-01T10:00:00Z") }),
      T("2026-09-01T11:00:00Z"),
    );
    expect(pasado.fase).toBe("tiempo_agotado");
    expect(admiteEscritura(pasado)).toBe(false);
  });

  it("el margen de gracia cubre el retraso de la red, no un examen abandonado", () => {
    const fin = T("2026-09-01T11:00:00Z");

    const dentro = (Date.parse("2026-09-01T11:00:10Z") - fin.getTime()) / 1000;
    expect(dentro).toBeLessThanOrEqual(GRACIA_SEGUNDOS);

    const fuera = (Date.parse("2026-09-01T11:02:00Z") - fin.getTime()) / 1000;
    expect(fuera).toBeGreaterThan(GRACIA_SEGUNDOS);
  });
});

describe("después de entregar", () => {
  it("una vez entregado el reloj deja de importar", () => {
    // Aunque el tiempo se agotase hace horas, un examen entregado se queda
    // «entregado». Si esto se saltara, la pantalla del alumno le diría que se
    // le acabó el tiempo después de haberlo entregado a tiempo.
    const estado = estadoDelExamen(
      examen({ timeLimitMinutes: 30 }),
      entrega({
        status: "SUBMITTED",
        startedAt: T("2026-09-01T10:00:00Z"),
        submittedAt: T("2026-09-01T10:20:00Z"),
      }),
      T("2026-09-01T23:00:00Z"),
    );
    expect(estado.fase).toBe("entregado");
  });

  it("corregido gana a todo lo demás", () => {
    const estado = estadoDelExamen(
      examen(),
      entrega({ status: "GRADED", startedAt: T("2026-09-01T10:00:00Z") }),
      T("2026-09-02T10:00:00Z"),
    );
    expect(estado.fase).toBe("corregido");
  });
});
