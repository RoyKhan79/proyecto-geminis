import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ROTACIÓN DE LA CLAVE DE CIFRADO
 *
 * La documentación de `env.ts` mencionaba un `npm run cifrar:rotar` que no
 * existía, y el descifrado usaba una sola clave: cambiar `FIELD_ENCRYPTION_KEY`
 * dejaba todos los IBAN ilegibles para siempre. Una clave que no se puede rotar
 * es una clave que, comprometida, se queda comprometida.
 *
 * Estas pruebas comprueban las tres cosas que hacen que una rotación sea
 * posible sin parar el servicio ni perder nada:
 *
 *   · lo cifrado con la clave vieja se sigue leyendo,
 *   · lo nuevo se cifra con la nueva,
 *   · y cuando se retira la clave vieja, lo que quedara con ella se detecta en
 *     lugar de devolver basura.
 *
 * El módulo lee `env` al cargarse, así que cada caso lo vuelve a importar con
 * las variables puestas. Es aparatoso y es la única forma de probar de verdad
 * el paso de una clave a otra.
 */

const VIEJA = "clave-anterior-de-al-menos-32-caracteres-0000";
const NUEVA = "clave-nueva-distinta-de-al-menos-32-caracteres-1111";

/** Carga el módulo de cifrado con las claves que se le indiquen. */
async function cargarCon(actual?: string, anterior?: string) {
  vi.resetModules();
  process.env.FIELD_ENCRYPTION_KEY = actual;
  process.env.FIELD_ENCRYPTION_KEY_ANTERIOR = anterior;
  if (actual === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
  if (anterior === undefined) delete process.env.FIELD_ENCRYPTION_KEY_ANTERIOR;
  return import("@/lib/crypto/field");
}

const original = {
  actual: process.env.FIELD_ENCRYPTION_KEY,
  anterior: process.env.FIELD_ENCRYPTION_KEY_ANTERIOR,
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env.FIELD_ENCRYPTION_KEY = original.actual;
  process.env.FIELD_ENCRYPTION_KEY_ANTERIOR = original.anterior;
  if (original.actual === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
  if (original.anterior === undefined) delete process.env.FIELD_ENCRYPTION_KEY_ANTERIOR;
  vi.resetModules();
});

const IBAN = "ES9121000418450200051332";

describe("rotación de clave · el paso de una a otra", () => {
  it("lo cifrado con la clave vieja se lee durante la rotación", async () => {
    const antes = await cargarCon(VIEJA);
    const guardado = antes.cifrar(IBAN);

    // Se despliega con las dos claves: la nueva como actual, la vieja detrás.
    const durante = await cargarCon(NUEVA, VIEJA);

    expect(durante.descifrar(guardado)).toBe(IBAN);
  });

  it("lo nuevo se cifra con la clave nueva, no con la vieja", async () => {
    const durante = await cargarCon(NUEVA, VIEJA);
    const guardado = durante.cifrar(IBAN);

    // Con la vieja sola ya no se puede abrir: es la prueba de que se ha
    // cifrado con la nueva y no de que «funciona porque están las dos».
    const soloVieja = await cargarCon(VIEJA);
    expect(soloVieja.descifrar(guardado)).toBeNull();

    const soloNueva = await cargarCon(NUEVA);
    expect(soloNueva.descifrar(guardado)).toBe(IBAN);
  });

  it("dice con qué clave está cifrado cada valor", async () => {
    const conVieja = (await cargarCon(VIEJA)).cifrar(IBAN);

    const durante = await cargarCon(NUEVA, VIEJA);
    const conNueva = durante.cifrar(IBAN);

    // Es lo que permite a la rotación reescribir solo lo que falta en vez de
    // pasar por encima de toda la tabla.
    expect(durante.claveDe(conVieja)).toBe("anterior");
    expect(durante.claveDe(conNueva)).toBe("actual");
    expect(durante.claveDe(IBAN)).toBe("claro");
    expect(durante.claveDe(null)).toBe("claro");
  });

  it("al retirar la clave vieja, lo que quedara con ella se detecta", async () => {
    const conVieja = (await cargarCon(VIEJA)).cifrar(IBAN);

    // Terminada la rotación se quita FIELD_ENCRYPTION_KEY_ANTERIOR. Si algo se
    // hubiera quedado sin migrar, tiene que decirlo, no devolver medio dato.
    const despues = await cargarCon(NUEVA);

    expect(despues.descifrar(conVieja)).toBeNull();
    expect(despues.claveDe(conVieja)).toBe("ilegible");
  });

  it("avisa de que hay una rotación a medias", async () => {
    expect((await cargarCon(NUEVA, VIEJA)).rotacionEnCurso()).toBe(true);
    expect((await cargarCon(NUEVA)).rotacionEnCurso()).toBe(false);
  });
});

describe("rotación de clave · lo que no puede cambiar al añadirla", () => {
  it("sigue siendo AES-GCM: un texto manipulado no se descifra", async () => {
    const cripto = await cargarCon(NUEVA, VIEJA);
    const guardado = cripto.cifrar(IBAN);

    const partes = guardado.split(":");
    // Se cambia un byte del texto cifrado. La etiqueta de autenticación ya no
    // cuadra y GCM tiene que negarse, con las dos claves puestas.
    const datos = Buffer.from(partes[3], "base64");
    datos[0] ^= 0xff;
    partes[3] = datos.toString("base64");

    expect(cripto.descifrar(partes.join(":"))).toBeNull();
  });

  it("dos cifrados del mismo valor siguen siendo distintos", async () => {
    const cripto = await cargarCon(NUEVA, VIEJA);
    expect(cripto.cifrar(IBAN)).not.toBe(cripto.cifrar(IBAN));
  });

  it("un secreto demasiado corto se rechaza, también el anterior", async () => {
    const cripto = await cargarCon(NUEVA, "corta");
    // El fallo salta al usarlo, que es cuando se deriva la clave.
    expect(() => cripto.descifrar(cripto.cifrar(IBAN))).toThrow(
      /FIELD_ENCRYPTION_KEY_ANTERIOR/,
    );
  });

  it("los valores guardados antes de existir el cifrado se siguen leyendo", async () => {
    const cripto = await cargarCon(NUEVA, VIEJA);
    expect(cripto.descifrar(IBAN)).toBe(IBAN);
    expect(cripto.estaCifrado(IBAN)).toBe(false);
  });
});
