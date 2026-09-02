import { describe, expect, it } from "vitest";
import {
  esLaMismaBase,
  motivoParaNoRestaurar,
} from "@/lib/db/destino-de-restauracion";

/**
 * DÓNDE SE PUEDE RESTAURAR
 *
 * Restaurar vacía tablas y las vuelve a llenar. Contra la base equivocada no es
 * un error, es un desastre, y encima ocurre el día que alguien está nervioso
 * porque acaba de perder datos.
 *
 * Estas pruebas no restauran nada: comprueban al guardián, que es la única
 * pieza cuyo fallo no se puede deshacer.
 */

const VIVA = "postgresql://app:secreto@db.geminis.es:5432/geminis";
const OWNER = "postgresql://owner:secreto@db.geminis.es:5432/geminis";
const ENTORNO = { DATABASE_URL: VIVA, DATABASE_URL_OWNER: OWNER };

describe("dónde NO se puede restaurar", () => {
  it("nunca encima de la base con la que funciona la aplicación", () => {
    const r = motivoParaNoRestaurar(VIVA, ENTORNO);
    expect(r).not.toBeNull();
    expect(r!.motivo).toContain("DATABASE_URL");
  });

  it("tampoco entrando con el usuario del dueño, que es la misma base", () => {
    expect(motivoParaNoRestaurar(OWNER, ENTORNO)).not.toBeNull();
  });

  it("ni cambiando el usuario, el puerto por defecto o mayúsculas", () => {
    // Lo que identifica a una base es anfitrión y nombre. Quien vaya a pisar la
    // de producción no lo hará escribiendo la URL exacta del .env.
    const disfraces = [
      "postgresql://otro:otra@db.geminis.es:5432/geminis",
      "postgresql://app:x@DB.GEMINIS.ES:5432/geminis",
      "postgresql://app:x@db.geminis.es:5432/GEMINIS",
      "postgresql://app:x@db.geminis.es:5432/geminis?sslmode=require",
    ];
    for (const url of disfraces) {
      expect(motivoParaNoRestaurar(url, ENTORNO), url).not.toBeNull();
    }
  });

  it("la confirmación a mano NO abre la puerta a la base viva", () => {
    // Es la excepción que no existe: para una recuperación real se para el
    // servicio y se usan las herramientas de PostgreSQL, no este script.
    const r = motivoParaNoRestaurar(VIVA, {
      ...ENTORNO,
      GEMINIS_RESTAURAR_AQUI: "confirmo",
    });
    expect(r).not.toBeNull();
  });

  it("una base con nombre normal tampoco vale sin confirmarlo", () => {
    const r = motivoParaNoRestaurar(
      "postgresql://u:p@otro-servidor.es:5432/clientes",
      ENTORNO,
    );
    expect(r).not.toBeNull();
    expect(r!.motivo).toContain("desechable");
  });

  it("la base de desarrollo de todos los días tampoco es desechable", () => {
    // No es producción, pero machacarla pierde el trabajo del día.
    const r = motivoParaNoRestaurar("postgresql://u:p@127.0.0.1:55432/geminis", {});
    expect(r).not.toBeNull();
  });

  it("sin destino, se dice qué hacer en vez de adivinar uno", () => {
    for (const vacio of [undefined, null, ""]) {
      const r = motivoParaNoRestaurar(vacio, ENTORNO);
      expect(r).not.toBeNull();
      expect(r!.salida).toContain("--probar");
    }
  });

  it("una dirección que no se entiende se rechaza, no se interpreta", () => {
    expect(motivoParaNoRestaurar("esto no es una url", ENTORNO)).not.toBeNull();
  });
});

describe("dónde SÍ se puede restaurar", () => {
  it("en la base desechable que crea --probar", () => {
    const destino = "postgresql://u:p@127.0.0.1:55432/geminis_restauracion_1788329";
    expect(motivoParaNoRestaurar(destino, ENTORNO)).toBeNull();
  });

  it("en nombres que se reconocen como de usar y tirar", () => {
    for (const base of ["geminis_test", "geminis_prueba", "restore_2026", "scratch"]) {
      const url = `postgresql://u:p@127.0.0.1:55432/${base}`;
      expect(motivoParaNoRestaurar(url, ENTORNO), base).toBeNull();
    }
  });

  it("y en cualquier otra si se escribe la confirmación a mano", () => {
    const r = motivoParaNoRestaurar("postgresql://u:p@recuperacion.es:5432/copia", {
      ...ENTORNO,
      GEMINIS_RESTAURAR_AQUI: "confirmo",
    });
    expect(r).toBeNull();
  });
});

describe("comparar dos direcciones", () => {
  it("mismo anfitrión y mismo nombre es la misma base", () => {
    expect(esLaMismaBase(VIVA, OWNER)).toBe(true);
  });

  it("el puerto cuenta: 5432 y 55432 son servidores distintos", () => {
    expect(
      esLaMismaBase(
        "postgresql://u:p@127.0.0.1:5432/geminis",
        "postgresql://u:p@127.0.0.1:55432/geminis",
      ),
    ).toBe(false);
  });

  it("y el puerto que no se escribe es el 5432", () => {
    expect(
      esLaMismaBase(
        "postgresql://u:p@db.geminis.es/geminis",
        "postgresql://u:p@db.geminis.es:5432/geminis",
      ),
    ).toBe(true);
  });

  it("dos bases distintas en el mismo servidor no son la misma", () => {
    expect(
      esLaMismaBase(
        "postgresql://u:p@127.0.0.1:55432/geminis",
        "postgresql://u:p@127.0.0.1:55432/geminis_test",
      ),
    ).toBe(false);
  });
});
