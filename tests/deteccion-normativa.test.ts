import { describe, expect, it } from "vitest";
import {
  articulosCitados,
  detectarCambio,
} from "@/server/legislation/deteccion";

/**
 * DETECTAR UN CAMBIO DE LEY EN EL TÍTULO DEL BOE
 *
 * Los títulos de esta prueba están copiados de anuncios reales, con su
 * puntuación y su longitud. Es a propósito: un detector que solo acierte con
 * ejemplos redondos no sirve, porque el BOE no escribe ejemplos redondos.
 *
 * Lo que hay que probar en los dos sentidos:
 *
 *   · Que **detecte** «por el que se modifica la Ley 39/2015».
 *   · Que **no detecte** «de acuerdo con lo previsto en la Ley 39/2015», que es
 *     mucho más frecuente. Una norma importante se cita cada semana sin que la
 *     toquen, y una alerta falsa por semana es una academia que deja de mirar
 *     las alertas.
 *
 * El segundo es el que decide si esto se puede encender o no.
 */

const LEY = "Ley 39/2015";

describe("cambios que hay que detectar", () => {
  it("una modificación dentro de un real decreto", () => {
    const r = detectarCambio(
      "Real Decreto 203/2021, de 30 de marzo, por el que se aprueba el " +
        "Reglamento de actuación y funcionamiento del sector público por medios " +
        "electrónicos y se modifica la Ley 39/2015, de 1 de octubre.",
      LEY,
    );
    expect(r?.tipo).toBe("AMENDED");
  });

  it("una derogación", () => {
    const r = detectarCambio(
      "Ley Orgánica 1/2025, de 2 de enero, de medidas en materia de eficiencia " +
        "del Servicio Público de Justicia, por la que se deroga la Ley 39/2015, " +
        "de 1 de octubre.",
      LEY,
    );
    expect(r?.tipo).toBe("REPEALED");
  });

  it("una corrección de errores, aunque el verbo vaya al principio", () => {
    const r = detectarCambio(
      "Corrección de errores de la Ley 39/2015, de 1 de octubre, del " +
        "Procedimiento Administrativo Común de las Administraciones Públicas.",
      LEY,
    );
    expect(r?.tipo).toBe("CORRECTED");
  });

  it("la referencia se reconoce aunque la academia la escriba de otra forma", () => {
    // La academia guarda «L 39/2015» y el BOE escribe «Ley 39/2015». Lo que no
    // cambia nunca es el número y el año.
    const r = detectarCambio(
      "Real Decreto por el que se modifica la Ley 39/2015, de 1 de octubre.",
      "L 39/2015",
    );
    expect(r?.tipo).toBe("AMENDED");
  });
});

describe("menciones que NO son cambios", () => {
  it("una norma citada como fundamento no abre alerta", () => {
    expect(
      detectarCambio(
        "Resolución de 12 de marzo, por la que se publica el Convenio suscrito " +
          "de acuerdo con lo previsto en la Ley 39/2015, de 1 de octubre.",
        LEY,
      ),
    ).toBeNull();
  });

  it("un artículo citado tampoco", () => {
    expect(
      detectarCambio(
        "Orden por la que se delegan competencias al amparo del artículo 9 de " +
          "la Ley 39/2015, de 1 de octubre.",
        LEY,
      ),
    ).toBeNull();
  });

  it("si lo que se modifica es OTRA norma, no abre alerta", () => {
    /*
     * El caso difícil y el que justifica exigir que el verbo vaya delante: el
     * título nombra las dos normas, pero la Ley 39/2015 solo sale citada y lo
     * que se modifica es el Real Decreto que va después.
     */
    expect(
      detectarCambio(
        "Real Decreto por el que se aprueba el reglamento previsto en la " +
          "Ley 39/2015, de 1 de octubre, y se modifica el Real Decreto " +
          "1065/2007, de 27 de julio.",
        LEY,
      ),
    ).toBeNull();
  });

  it("un anuncio que no la nombra no abre alerta", () => {
    expect(
      detectarCambio(
        "Real Decreto 1065/2007, de 27 de julio, por el que se modifica el " +
          "Reglamento General de Recaudación.",
        LEY,
      ),
    ).toBeNull();
  });

  it("una referencia vacía no engancha con nada", () => {
    expect(detectarCambio("Se modifica todo", "")).toBeNull();
  });
});

describe("los artículos que cita el título", () => {
  it("uno solo", () => {
    expect(
      articulosCitados("por el que se modifica el artículo 21 de la Ley"),
    ).toEqual(["21"]);
  });

  it("varios, escritos como los escribe el BOE", () => {
    expect(
      articulosCitados("se modifican los artículos 21, 22 y 24 de la Ley"),
    ).toEqual(["21", "22", "24"]);
  });

  it("un apartado concreto", () => {
    expect(articulosCitados("se da nueva redacción al art. 21.2")).toEqual([
      "21.2",
    ]);
  });

  it("cuando el título no baja al artículo, no se inventa ninguno", () => {
    // Es el caso más frecuente, y la alerta tiene que abrirse igual: sobre la
    // norma entera en lugar de sobre un artículo.
    expect(
      articulosCitados("por el que se modifica la Ley 39/2015, de 1 de octubre"),
    ).toEqual([]);
  });
});
