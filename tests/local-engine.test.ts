import { describe, expect, it } from "vitest";
import {
  detectarIntencion,
  explicarFallo,
  generarPreguntasLocales,
  responderConMaterial,
} from "@/lib/ai/local-engine";
import type { Fragmento } from "@/lib/ai/retrieval";

/**
 * El motor local es lo que hace que Geminis IA funcione sin contratar ninguna
 * API. Se comprueba lo que de verdad importa: que responde con el material y
 * que NO responde cuando el material no lo dice.
 */

function fragmento(content: string, i = 1): Fragmento {
  return {
    chunkId: `chunk-${i}`,
    sourceId: `src-${i}`,
    sourceTitle: `Documento ${i}`,
    nodeLabel: `Tema ${i}`,
    locator: `pág. ${i}`,
    content,
    score: 1,
  } as Fragmento;
}

describe("detectarIntencion", () => {
  it("distingue lo que se le está pidiendo", () => {
    expect(detectarIntencion("Resúmeme el tema 3")).toBe("RESUMEN");
    expect(detectarIntencion("¿Qué diferencia hay entre A y B?")).toBe("COMPARACION");
    expect(detectarIntencion("¿Cuántos días hay de plazo?")).toBe("PLAZO_O_CIFRA");
    expect(detectarIntencion("¿Qué es el silencio administrativo?")).toBe("DEFINICION");
    expect(detectarIntencion("Enumera los requisitos")).toBe("ENUMERACION");
    expect(detectarIntencion("Explícame por qué pasa eso")).toBe("EXPLICACION");
  });

  it("no se confunde con los acentos", () => {
    expect(detectarIntencion("¿Cuántos días?")).toBe("PLAZO_O_CIFRA");
    expect(detectarIntencion("cuantos dias")).toBe("PLAZO_O_CIFRA");
  });
});

describe("responderConMaterial", () => {
  const material = [
    fragmento(
      "El plazo máximo para resolver el procedimiento será de tres meses desde la fecha del acuerdo de iniciación. Transcurrido dicho plazo sin resolución expresa se producirá la caducidad. El art. 21 regula la obligación de resolver.",
      1,
    ),
    fragmento(
      "Las administraciones públicas deberán dictar resolución expresa en todos los procedimientos. La falta de resolución tiene consecuencias distintas según el procedimiento.",
      2,
    ),
  ];

  it("encuentra la cifra cuando se pregunta por un plazo", () => {
    const r = responderConMaterial("¿Cuál es el plazo para resolver?", material);
    expect(r.intencion).toBe("PLAZO_O_CIFRA");
    expect(r.texto).toContain("tres meses");
    expect(r.citas).toContain(1);
  });

  it("cita siempre de dónde sale cada frase", () => {
    const r = responderConMaterial("Resume la obligación de resolver", material);
    expect(r.texto).toMatch(/\[\d\]/);
  });

  it("no se inventa nada cuando el material no habla de eso", () => {
    const r = responderConMaterial(
      "¿Cuál es la capital de Mongolia?",
      material,
    );
    expect(r.texto).toContain("No encuentro esa información");
    expect(r.citas).toHaveLength(0);
    expect(r.confianza).toBe("baja");
  });

  it("sin fragmentos no responde", () => {
    const r = responderConMaterial("¿Qué plazo hay?", []);
    expect(r.texto).toContain("No encuentro esa información");
  });
});

describe("generarPreguntasLocales", () => {
  const material = [
    fragmento(
      "El plazo para interponer el recurso de alzada será de un mes. El recurso potestativo de reposición se interpondrá en el plazo de un mes. El plazo para resolver el recurso extraordinario de revisión será de tres meses.",
      1,
    ),
  ];

  it("construye preguntas con la respuesta en distintas posiciones", () => {
    const preguntas = generarPreguntasLocales(material, 3);
    expect(preguntas.length).toBeGreaterThan(0);

    for (const pregunta of preguntas) {
      expect(pregunta.opciones.length).toBeGreaterThanOrEqual(3);
      expect(pregunta.enunciado).toContain("________");
      // La correcta apunta a una opción real.
      expect(pregunta.opciones[pregunta.correcta]).toBeDefined();
      // Y la explicación cita el material.
      expect(pregunta.explicacion).toMatch(/\[\d\]/);
    }
  });

  it("no repite la misma frase dos veces", () => {
    const preguntas = generarPreguntasLocales(material, 10);
    const enunciados = new Set(preguntas.map((p) => p.enunciado));
    expect(enunciados.size).toBe(preguntas.length);
  });

  it("devuelve una lista vacía si el material no tiene datos concretos", () => {
    const vago = [fragmento("Este tema trata sobre cuestiones generales de interés.")];
    expect(generarPreguntasLocales(vago, 5)).toHaveLength(0);
  });
});

describe("explicarFallo", () => {
  it("da prioridad a la explicación del preparador", () => {
    const r = explicarFallo({
      enunciado: "¿Plazo para resolver?",
      respuestaDada: "Seis meses",
      respuestaCorrecta: "Tres meses",
      explicacionProfesor: "Lo dice el artículo 21 con claridad.",
      fragmentos: [],
    });

    expect(r.texto).toContain("Tres meses");
    expect(r.texto).toContain("Seis meses");
    expect(r.texto).toContain("artículo 21");
    expect(r.confianza).toBe("alta");
  });

  it("dice cuándo se dejó en blanco", () => {
    const r = explicarFallo({
      enunciado: "¿Plazo?",
      respuestaDada: null,
      respuestaCorrecta: "Tres meses",
      explicacionProfesor: null,
      fragmentos: [],
    });

    expect(r.texto).toContain("en blanco");
  });
});
