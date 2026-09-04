import { describe, expect, it } from "vitest";
import {
  BuscadorDeParecidas,
  palabrasConSignificado,
  parecido,
  revisarOpciones,
  UMBRAL_PARECIDO,
} from "@/server/imports/parecido";

/**
 * PREGUNTAS QUE SE PARECEN Y PREGUNTAS AMBIGUAS
 *
 * Lo que se prueba aquí no es que la comparación funcione «en general»: es que
 * acierte en los dos casos que importan y que son contrarios entre sí.
 *
 *   · Una pregunta reescrita **tiene** que detectarse. Es el caso frecuente en
 *     un banco heredado y el que la comparación exacta no veía.
 *   · Dos preguntas del mismo tema, con el mismo vocabulario y respuestas
 *     distintas, **no** pueden detectarse. Si se marcan, la simulación se llena
 *     de avisos falsos, la academia deja de leerlos y el aviso deja de servir
 *     para nada.
 *
 * El segundo es el que de verdad calibra el umbral, y es el que se olvida.
 */

describe("qué palabras cuentan", () => {
  it("las tildes no cambian la palabra", () => {
    expect(palabrasConSignificado("resolución máxima")).toEqual(
      palabrasConSignificado("resolucion maxima"),
    );
  });

  it("las palabras de andamiaje del tipo test no cuentan", () => {
    // «Señale la opción correcta» está en media España y no distingue nada.
    expect(palabrasConSignificado("Señale la opción correcta").size).toBe(0);
  });

  it("los números de artículo sí cuentan, aunque sean cortos", () => {
    // Sin esto, «artículo 21» y «artículo 103» serían la misma pregunta.
    const a = palabrasConSignificado("Segun el articulo 21 de la ley");
    const b = palabrasConSignificado("Segun el articulo 103 de la ley");
    expect(a.has("21")).toBe(true);
    expect(b.has("103")).toBe(true);
    expect(parecido(a, b)).toBeLessThan(UMBRAL_PARECIDO);
  });
});

describe("dos redacciones de la misma pregunta", () => {
  const buscador = new BuscadorDeParecidas();
  buscador.añadir(
    "el banco",
    "¿Cuál es el plazo máximo para resolver el procedimiento administrativo común?",
  );

  it("se detecta aunque esté escrita de otra forma", () => {
    const r = buscador.buscar(
      "Indique el plazo máximo de resolución del procedimiento administrativo común.",
    );
    expect(r).not.toBeNull();
    expect(r!.referencia).toBe("el banco");
  });

  it("se detecta aunque cambie el orden de las palabras", () => {
    // Por esto se compara por conjuntos y no por distancia de edición: quien
    // reescribe una pregunta reordena, y una distancia de edición lo castiga.
    const r = buscador.buscar(
      "El procedimiento administrativo común: plazo máximo para resolver, ¿cuál es?",
    );
    expect(r).not.toBeNull();
  });
});

describe("dos preguntas distintas del mismo tema", () => {
  const buscador = new BuscadorDeParecidas();
  buscador.añadir(
    "el banco",
    "¿Cuál es el plazo máximo para resolver el procedimiento administrativo común?",
  );

  it("no se marcan solo por compartir vocabulario", () => {
    const r = buscador.buscar(
      "¿Qué efectos tiene el silencio administrativo en el procedimiento común?",
    );
    expect(r).toBeNull();
  });

  it("una pregunta de otro tema tampoco", () => {
    expect(
      buscador.buscar("¿Quién nombra a los magistrados del Tribunal Constitucional?"),
    ).toBeNull();
  });

  it("una pregunta sin palabras con significado no se parece a nada", () => {
    expect(buscador.buscar("Señale la correcta")).toBeNull();
  });
});

describe("el parecido, como número", () => {
  it("dos conjuntos iguales dan 1", () => {
    const a = palabrasConSignificado("plazo maximo resolucion");
    expect(parecido(a, a)).toBe(1);
  });

  it("dos conjuntos sin nada en común dan 0", () => {
    expect(
      parecido(
        palabrasConSignificado("plazo maximo resolucion"),
        palabrasConSignificado("magistrados tribunal constitucional"),
      ),
    ).toBe(0);
  });

  it("dos conjuntos vacíos dan 0, no 1", () => {
    // Decir que dos textos sin palabras se parecen del todo sería inventárselo,
    // y además marcaría como duplicadas todas las filas rotas de un archivo.
    expect(parecido(new Set(), new Set())).toBe(0);
  });
});

describe("opciones ambiguas", () => {
  it("dos opciones que casi dicen lo mismo se avisan", () => {
    const p = revisarOpciones(
      [
        "El plazo es de tres meses desde la solicitud",
        "Tres meses desde la solicitud",
        "Seis meses desde la solicitud",
        "Un mes desde la solicitud",
      ],
      0,
    );
    expect(p.some((x) => x.texto.includes("casi lo mismo"))).toBe(true);
  });

  it("cuatro plazos distintos NO se avisan", () => {
    // Es la pregunta tipo de una oposición y comparten casi todas las palabras.
    // Si esto saltara, saltaría en medio banco.
    const p = revisarOpciones(
      ["Tres meses", "Seis meses", "Un mes", "Quince días"],
      0,
    );
    expect(p).toHaveLength(0);
  });

  it("«todas las anteriores» avisa de que el orden cambia al importar", () => {
    const p = revisarOpciones(
      ["Tres meses", "Seis meses", "Un mes", "Todas las anteriores son falsas"],
      0,
    );
    expect(p.some((x) => x.texto.includes("remite a las demás"))).toBe(true);
  });

  it("y avisa aparte si además es la respuesta marcada", () => {
    const p = revisarOpciones(
      ["Tres meses", "Seis meses", "Un mes", "Ninguna de las anteriores"],
      3,
    );
    expect(p.some((x) => x.texto.includes("la respuesta marcada"))).toBe(true);
  });

  it("una opción de relleno es un error, no un aviso", () => {
    // Una opción «-» no es una respuesta: la pregunta no se puede usar.
    const p = revisarOpciones(["Tres meses", "Seis meses", "-"], 0);
    const relleno = p.find((x) => x.texto.includes("no es una respuesta"));
    expect(relleno?.nivel).toBe("error");
  });

  it("cuatro opciones normales no dan ningún problema", () => {
    expect(
      revisarOpciones(
        [
          "El recurso de alzada",
          "El recurso potestativo de reposicion",
          "El recurso extraordinario de revision",
          "La reclamacion economico-administrativa",
        ],
        0,
      ),
    ).toHaveLength(0);
  });
});
