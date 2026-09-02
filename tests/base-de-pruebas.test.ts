import { describe, expect, it } from "vitest";
import { motivosParaNoEjecutar } from "./base-de-pruebas";

/**
 * LA PUERTA QUE SEPARA LAS PRUEBAS DE PRODUCCIÓN
 *
 * La suite crea y borra academias enteras. Antes, lo único que decidía sobre
 * qué base lo hacía era el valor que tuviera `DATABASE_URL` en ese momento.
 *
 * Estas pruebas comprueban las dos mitades del asunto, y las dos importan igual:
 * que ninguna dirección que no sea reconociblemente local pase, y que las que sí
 * lo son sigan pasando. Una guarda que además estorba se acaba desactivando, y
 * una guarda desactivada no protege de nada.
 */

const DEV = "postgresql://geminis:geminis@127.0.0.1:55432/geminis";

describe("guarda de la base de pruebas · lo que NO puede pasar", () => {
  const prohibidas: [string, string][] = [
    [
      "un servidor remoto cualquiera",
      "postgresql://u:p@db.ejemplo.com:5432/geminis",
    ],
    [
      "un servicio gestionado con SSL",
      "postgresql://u:p@ep-cool-1234.eu-central-1.aws.neon.tech/geminis?sslmode=require",
    ],
    [
      "una base que se llama producción",
      "postgresql://u:p@10.0.0.5:5432/geminis_prod",
    ],
    [
      "una base con otro nombre en un servidor remoto",
      "postgresql://u:p@interno.acme.local:5432/clientes",
    ],
    ["una dirección que no se entiende", "esto-no-es-una-url"],
    ["sin DATABASE_URL", undefined as unknown as string],
  ];

  for (const [caso, cadena] of prohibidas) {
    it(`no deja ejecutar contra ${caso}`, () => {
      expect(motivosParaNoEjecutar(cadena, {}).length).toBeGreaterThan(0);
    });
  }

  it("no deja ejecutar con NODE_ENV=production, ni siquiera en local", () => {
    // Una base local con la aplicación marcada como producción es un despliegue
    // mal configurado, y ahí puede haber datos de verdad.
    expect(motivosParaNoEjecutar(DEV, { NODE_ENV: "production" })).toContain(
      "NODE_ENV=production",
    );
  });

  it("da el motivo concreto, no un «no» a secas", () => {
    const motivos = motivosParaNoEjecutar(
      "postgresql://u:p@db.ejemplo.com:5432/clientes",
      {},
    );
    expect(motivos.join(" ")).toContain("db.ejemplo.com");
    expect(motivos.join(" ")).toContain("clientes");
  });
});

describe("guarda de la base de pruebas · lo que SÍ tiene que pasar", () => {
  const permitidas: [string, string][] = [
    ["la base que crea `npm run db:start`", DEV],
    ["localhost por su nombre", "postgresql://u:p@localhost:5432/geminis"],
    ["una base llamada geminis_test", "postgresql://u:p@localhost:5432/geminis_test"],
    ["el servicio de docker-compose", "postgresql://u:p@postgres:5432/geminis"],
    ["IPv6 local", "postgresql://u:p@[::1]:5432/geminis"],
  ];

  for (const [caso, cadena] of permitidas) {
    it(`deja ejecutar contra ${caso}`, () => {
      expect(motivosParaNoEjecutar(cadena, {})).toEqual([]);
    });
  }

  it("la confirmación explícita abre la puerta, y solo esa palabra", () => {
    const remota = "postgresql://u:p@ci.interno:5432/lo_que_sea";

    expect(motivosParaNoEjecutar(remota, { GEMINIS_BASE_DE_PRUEBAS: "confirmo" })).toEqual([]);

    // Cualquier otro valor no vale: la idea es que haya que escribirlo a
    // conciencia, no que valga un «1» o un «true» puestos de pasada.
    for (const valor of ["1", "true", "si", "yes", "", "CONFIRMO"]) {
      expect(
        motivosParaNoEjecutar(remota, { GEMINIS_BASE_DE_PRUEBAS: valor }).length,
      ).toBeGreaterThan(0);
    }
  });
});
