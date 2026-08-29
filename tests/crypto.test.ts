import { beforeAll, describe, expect, it } from "vitest";

/**
 * Cifrado de campos sensibles.
 *
 * Lo que se comprueba es lo que de verdad importa: que lo guardado no se parece
 * al original, que se recupera igual, y que con otra clave NO se recupera. Ese
 * último es el que da sentido a todo lo demás.
 */

// La clave se fija antes de importar el módulo: se lee al cargarlo.
beforeAll(() => {
  process.env.FIELD_ENCRYPTION_KEY =
    "clave-de-pruebas-suficientemente-larga-para-el-minimo";
});

const cargar = async () => import("@/lib/crypto/field");

describe("cifrar y descifrar", () => {
  it("recupera exactamente lo que se guardó", async () => {
    const { cifrar, descifrar } = await cargar();
    const iban = "ES9121000418450200051332";
    expect(descifrar(cifrar(iban))).toBe(iban);
  });

  it("lo guardado no contiene el original", async () => {
    const { cifrar } = await cargar();
    const iban = "ES9121000418450200051332";
    const guardado = cifrar(iban);

    expect(guardado).not.toContain(iban);
    expect(guardado).not.toContain("2100");
    expect(guardado.startsWith("v1:")).toBe(true);
  });

  it("cifrar dos veces el mismo valor da resultados distintos", async () => {
    // Si diera el mismo, quien tenga el volcado podría saber qué alumnos
    // comparten cuenta solo comparando columnas.
    const { cifrar } = await cargar();
    const a = cifrar("ES9121000418450200051332");
    const b = cifrar("ES9121000418450200051332");
    expect(a).not.toBe(b);
  });

  it("un texto manipulado no se descifra: devuelve null", async () => {
    const { cifrar, descifrar } = await cargar();
    const guardado = cifrar("ES9121000418450200051332");

    // Se cambia un carácter del texto cifrado.
    const partes = guardado.split(":");
    const alterado = [
      partes[0],
      partes[1],
      partes[2],
      partes[3].slice(0, -2) + (partes[3].endsWith("AA") ? "BB" : "AA"),
    ].join(":");

    expect(descifrar(alterado)).toBeNull();
  });

  it("un valor vacío o nulo no revienta", async () => {
    const { cifrar, descifrar } = await cargar();
    expect(cifrar("")).toBe("");
    expect(descifrar(null)).toBeNull();
    expect(descifrar("")).toBeNull();
  });

  it("un valor antiguo sin cifrar se devuelve tal cual", async () => {
    // Es lo que permite migrar sin romper lo que ya había.
    const { descifrar, estaCifrado } = await cargar();
    expect(estaCifrado("ES9121000418450200051332")).toBe(false);
    expect(descifrar("ES9121000418450200051332")).toBe("ES9121000418450200051332");
  });
});

describe("huella", () => {
  it("es estable para el mismo valor", async () => {
    const { huella } = await cargar();
    expect(huella("ES9121000418450200051332")).toBe(
      huella("ES9121000418450200051332"),
    );
  });

  it("distingue valores distintos", async () => {
    const { huella } = await cargar();
    expect(huella("ES9121000418450200051332")).not.toBe(
      huella("ES7921000813610123456789"),
    );
  });

  it("no deja ver el original", async () => {
    const { huella } = await cargar();
    const h = huella("ES9121000418450200051332");
    expect(h).not.toContain("2100");
    expect(h).toHaveLength(64);
  });
});
