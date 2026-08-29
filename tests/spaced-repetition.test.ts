import { describe, expect, it } from "vitest";
import {
  calidadDeRespuesta,
  programarRepaso,
  tandaDeHoy,
} from "@/lib/study/spaced-repetition";

/**
 * Esto decide cuándo vuelve a aparecer cada pregunta. Si se equivoca, el alumno
 * repasa lo que ya sabe y no ve lo que falla, así que se prueba en serio.
 */

describe("calidadDeRespuesta", () => {
  it("acertar rápido es dominio", () => {
    expect(calidadDeRespuesta({ acerto: true, segundos: 8 })).toBe(5);
  });

  it("acertar tras mucho rato cuenta menos", () => {
    expect(calidadDeRespuesta({ acerto: true, segundos: 90 })).toBe(3);
  });

  it("fallar despacio puntúa más que fallar deprisa", () => {
    const dudando = calidadDeRespuesta({ acerto: false, segundos: 60 });
    const enBlanco = calidadDeRespuesta({ acerto: false, segundos: 3 });
    expect(dudando).toBeGreaterThan(enBlanco);
  });

  it("sin dato de tiempo asume una respuesta normal", () => {
    expect(calidadDeRespuesta({ acerto: true, segundos: null })).toBe(4);
  });
});

describe("programarRepaso", () => {
  const desde = new Date("2026-03-10T10:00:00Z");

  it("un fallo devuelve la pregunta al día siguiente", () => {
    const r = programarRepaso({ calidad: 1, intervalDays: 30, easeFactor: 2.5, desde });
    expect(r.intervalDays).toBe(1);
  });

  it("los aciertos van espaciando la pregunta", () => {
    const primera = programarRepaso({
      calidad: 5,
      intervalDays: 0,
      easeFactor: 2.5,
      desde,
    });
    expect(primera.intervalDays).toBe(1);

    const segunda = programarRepaso({
      calidad: 5,
      intervalDays: primera.intervalDays,
      easeFactor: primera.easeFactor,
      desde,
    });
    expect(segunda.intervalDays).toBe(3);

    const tercera = programarRepaso({
      calidad: 5,
      intervalDays: segunda.intervalDays,
      easeFactor: segunda.easeFactor,
      desde,
    });
    expect(tercera.intervalDays).toBeGreaterThan(segunda.intervalDays);
  });

  it("la facilidad nunca baja de 1.3 por muchos fallos que haya", () => {
    let ease = 2.5;
    for (let i = 0; i < 20; i += 1) {
      ease = programarRepaso({ calidad: 0, intervalDays: 1, easeFactor: ease, desde })
        .easeFactor;
    }
    expect(ease).toBe(1.3);
  });

  it("no programa más allá de seis meses", () => {
    const r = programarRepaso({
      calidad: 5,
      intervalDays: 170,
      easeFactor: 3.0,
      desde,
    });
    expect(r.intervalDays).toBe(180);
  });

  it("la fecha siguiente cae al inicio del día que toca", () => {
    const r = programarRepaso({ calidad: 4, intervalDays: 0, easeFactor: 2.5, desde });
    expect(r.nextReviewAt.getHours()).toBe(0);
    expect(r.nextReviewAt.getTime()).toBeGreaterThan(desde.getTime() - 86400000);
  });
});

describe("tandaDeHoy", () => {
  it("prioriza lo más atrasado y no abruma", () => {
    const pendientes = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      nextReviewAt: new Date(2026, 0, 1 + i),
    }));

    const tanda = tandaDeHoy(pendientes, 30);
    expect(tanda).toHaveLength(30);
    expect(tanda[0].id).toBe(0);
    expect(tanda[29].id).toBe(29);
  });
});
