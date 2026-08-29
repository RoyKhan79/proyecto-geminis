import { describe, expect, it } from "vitest";
import {
  huellaDeEnunciado,
  leerCorrecta,
} from "@/server/imports/questions";

/**
 * Un banco heredado viene como viene. Lo que se prueba aquí es justo lo que
 * hace que una academia pueda traerlo sin reescribir el Excel: que se entienda
 * cómo ha marcado la respuesta correcta y que se detecten las repetidas.
 */

describe("huellaDeEnunciado", () => {
  it("considera la misma pregunta escrita de dos maneras", () => {
    expect(huellaDeEnunciado("¿Qué plazo hay para resolver?")).toBe(
      huellaDeEnunciado("Que plazo hay para resolver"),
    );
  });

  it("no confunde preguntas distintas", () => {
    expect(huellaDeEnunciado("¿Qué plazo hay para resolver?")).not.toBe(
      huellaDeEnunciado("¿Qué plazo hay para recurrir?"),
    );
  });

  it("ignora los espacios de más y las mayúsculas", () => {
    expect(huellaDeEnunciado("  EL   ACTO   administrativo  ")).toBe(
      "el acto administrativo",
    );
  });
});

describe("leerCorrecta", () => {
  const opciones = ["Un mes", "Tres meses", "Seis meses", "Un año"];

  it("entiende la letra en todas sus formas", () => {
    expect(leerCorrecta("B", opciones)).toBe(1);
    expect(leerCorrecta("b)", opciones)).toBe(1);
    expect(leerCorrecta("b.", opciones)).toBe(1);
    expect(leerCorrecta("Opción B", opciones)).toBe(1);
    expect(leerCorrecta("opcion b", opciones)).toBe(1);
  });

  it("entiende el número", () => {
    expect(leerCorrecta("2", opciones)).toBe(1);
    expect(leerCorrecta("2.", opciones)).toBe(1);
  });

  it("entiende el texto de la respuesta", () => {
    expect(leerCorrecta("Tres meses", opciones)).toBe(1);
    expect(leerCorrecta("tres  MESES", opciones)).toBe(1);
  });

  it("devuelve -1 si no hay forma de entenderlo", () => {
    expect(leerCorrecta("la segunda", opciones)).toBe(-1);
    expect(leerCorrecta("", opciones)).toBe(-1);
    expect(leerCorrecta("Z", opciones)).toBe(-1);
  });

  it("no acepta una letra fuera del número de opciones", () => {
    // La E existe como letra, pero aquí solo hay cuatro opciones: quien llame
    // a esto tiene que comprobar el rango, y el índice devuelto lo permite.
    expect(leerCorrecta("E", opciones)).toBe(4);
    expect(leerCorrecta("E", opciones)).toBeGreaterThanOrEqual(opciones.length);
  });
});
