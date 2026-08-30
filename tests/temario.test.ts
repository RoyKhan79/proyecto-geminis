import { describe, expect, it } from "vitest";
import {
  arreglarMayusculas,
  avisosDeLaPropuesta,
  leerNombre,
  proponerTemario,
} from "@/lib/content/nombres";

/**
 * EL ASISTENTE DE TEMARIO
 *
 * Los nombres de archivo reales de una academia española: con y sin ceros
 * delante, en mayúsculas, con guiones bajos, con bloques romanos y con siglas
 * que no se pueden tocar. Si esto falla, el asistente propone basura y la
 * academia acaba corrigiendo sesenta títulos a mano, que es exactamente el
 * trabajo que venía a ahorrar.
 */

describe("leer el nombre de un archivo", () => {
  const casos: [string, number | null, string][] = [
    ["Tema 01 - El acto administrativo.pdf", 1, "El acto administrativo"],
    ["Tema 12 – Fuentes del Derecho.pdf", 12, "Fuentes del Derecho"],
    ["T12_Fuentes del Derecho.PDF", 12, "Fuentes del Derecho"],
    ["T-3 Procedimiento.docx", 3, "Procedimiento"],
    ["Tema7.pdf", 7, ""],
    ["01. El acto administrativo.pdf", 1, "El acto administrativo"],
    ["12 - Fuentes.pdf", 12, "Fuentes"],
    ["3_Procedimiento administrativo.pdf", 3, "Procedimiento administrativo"],
    ["Anexo de legislación.pdf", null, "Anexo de legislación"],
  ];

  for (const [nombre, numero, titulo] of casos) {
    it(`«${nombre}»`, () => {
      const leido = leerNombre(nombre);
      expect(leido.numero).toBe(numero);
      expect(leido.titulo).toBe(titulo);
    });
  }

  it("saca el bloque cuando viene delante, y el número sigue siendo el del tema", () => {
    const leido = leerNombre("Bloque II - Tema 3 - Fuentes.pdf");
    expect(leido.bloque).toBe("Bloque 2");
    expect(leido.numero).toBe(3);
    expect(leido.titulo).toBe("Fuentes");
  });

  it("un año al principio no es un número de tema", () => {
    // «2024 Convocatoria.pdf» sin separador: si esto se leyera como el tema
    // 2024, ese archivo se iría al final de un temario de sesenta temas y la
    // academia tardaría en encontrarlo.
    expect(leerNombre("2024 Convocatoria.pdf").numero).toBeNull();
  });
});

describe("mayúsculas", () => {
  it("arregla un título gritado sin destrozar las siglas", () => {
    expect(arreglarMayusculas("EL ACTO ADMINISTRATIVO EN LA LPAC")).toBe(
      "El acto administrativo en la LPAC",
    );
  });

  it("no toca lo que ya está bien escrito", () => {
    const bueno = "El acto administrativo en la LPAC";
    expect(arreglarMayusculas(bueno)).toBe(bueno);
  });
});

describe("proponer el temario", () => {
  it("ordena por número y deja al final lo que no supo leer", () => {
    const propuesta = proponerTemario([
      "Tema 10 - Décimo.pdf",
      "Anexo.pdf",
      "Tema 2 - Segundo.pdf",
      "Tema 1 - Primero.pdf",
    ]);

    expect(propuesta.map((p) => p.etiqueta)).toEqual([
      "Tema 1 · Primero",
      "Tema 2 · Segundo",
      "Tema 10 · Décimo",
      "Anexo",
    ]);
    expect(propuesta.map((p) => p.posicion)).toEqual([1, 2, 3, 4]);
  });

  it("ordena por número, no alfabéticamente", () => {
    // El fallo clásico: el tema 10 antes que el 2 porque «10» < «2» como texto.
    const propuesta = proponerTemario(["Tema 2 - B.pdf", "Tema 10 - A.pdf"]);
    expect(propuesta[0].numero).toBe(2);
  });
});

describe("avisos antes de crear nada", () => {
  it("canta los números repetidos", () => {
    const avisos = avisosDeLaPropuesta(
      proponerTemario(["Tema 7 - Uno.pdf", "Tema 7 - Otro.pdf"]),
    );
    expect(avisos.some((a) => a.includes("mismo número"))).toBe(true);
  });

  it("canta los huecos en la numeración", () => {
    const avisos = avisosDeLaPropuesta(
      proponerTemario(["Tema 1 - A.pdf", "Tema 2 - B.pdf", "Tema 5 - E.pdf"]),
    );
    expect(avisos.some((a) => a.includes("Faltan los temas 3, 4"))).toBe(true);
  });

  it("no inventa huecos cuando el temario está completo", () => {
    const avisos = avisosDeLaPropuesta(
      proponerTemario(["Tema 1 - A.pdf", "Tema 2 - B.pdf", "Tema 3 - C.pdf"]),
    );
    expect(avisos.some((a) => a.includes("Faltan"))).toBe(false);
  });

  it("avisa de los temas que se quedarían sin título", () => {
    const avisos = avisosDeLaPropuesta(proponerTemario(["Tema7.pdf"]));
    expect(avisos.some((a) => a.includes("solo con su número"))).toBe(true);
  });
});
