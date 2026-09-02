import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RELACIONES_DE_TENANT } from "@/lib/db/tenant-relations";
import { TENANT_MODELS } from "@/lib/db/tenant-models";

/**
 * LA LISTA DE CLAVES FORÁNEAS TIENE QUE ESTAR AL DÍA
 *
 * `tenant-relations.ts` es una lista escrita a mano, y una lista escrita a mano
 * se queda vieja: es exactamente lo que le pasó a la migración de Row Level
 * Security, que enumeraba 50 tablas y se quedó corta en cuanto llegó la
 * facturación.
 *
 * Así que la lista no se mantiene a mano: se comprueba aquí contra el esquema
 * de Prisma, que es la fuente de verdad. Si alguien añade un modelo con una
 * relación hacia otro modelo de academia y no la apunta, esto falla y dice cuál
 * es. Si alguien apunta una que ya no existe, también.
 *
 * El esquema se lee como texto en lugar de preguntárselo al cliente de Prisma
 * porque el modelo que este expone en tiempo de ejecución no dice de qué campo
 * sale cada relación, que es justo el dato que hace falta.
 */

/** Las relaciones que salen del esquema: modelo → [campo, destino]. */
function relacionesDelEsquema(): Record<string, { campo: string; destino: string }[]> {
  const dir = path.join(process.cwd(), "prisma", "schema");
  const esquema = readdirSync(dir)
    .filter((f) => f.endsWith(".prisma"))
    .sort()
    .map((f) => readFileSync(path.join(dir, f), "utf8"))
    .join("\n");

  const salida: Record<string, { campo: string; destino: string }[]> = {};

  for (const bloque of esquema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const [, modelo, cuerpo] = bloque;
    if (!TENANT_MODELS.has(modelo)) continue;

    const fks: { campo: string; destino: string }[] = [];

    for (const linea of cuerpo.split("\n")) {
      const rel = linea.match(/@relation\((?:"[^"]*",\s*)?fields:\s*\[([^\]]+)\]/);
      if (!rel) continue;

      const campos = rel[1].split(",").map((c) => c.trim());
      const tipo = linea.match(/^\s*(\w+)\s+(\w+)/);
      if (!tipo) continue;

      const destino = tipo[2];
      // Solo interesan las que apuntan a otro modelo de academia: las globales
      // (User, Academy, Plan) no pertenecen a ninguna y no hay qué comprobar.
      if (!TENANT_MODELS.has(destino)) continue;
      // Las relaciones compuestas se dejan fuera de la comprobación; si algún
      // día aparece una, este mismo test lo cantará por descuadre.
      if (campos.length !== 1) continue;

      fks.push({ campo: campos[0], destino });
    }

    if (fks.length > 0) salida[modelo] = fks;
  }

  return salida;
}

function comoTexto(fks: { campo: string; destino: string }[]) {
  return fks.map((f) => `${f.campo}→${f.destino}`).sort();
}

describe("claves foráneas entre modelos de academia", () => {
  const esquema = relacionesDelEsquema();

  it("el esquema tiene relaciones que comprobar (la prueba sirve de algo)", () => {
    // Si la lectura del esquema se rompiera, todo lo de abajo pasaría sin
    // comprobar nada. Esto lo detecta.
    expect(Object.keys(esquema).length).toBeGreaterThan(30);
  });

  it("no falta ningún modelo en la lista", () => {
    const faltan = Object.keys(esquema).filter((m) => !RELACIONES_DE_TENANT[m]);
    expect(
      faltan,
      `modelos con claves foráneas de academia que NO están en tenant-relations.ts: ${faltan.join(", ")}`,
    ).toEqual([]);
  });

  it("no sobra ningún modelo en la lista", () => {
    const sobran = Object.keys(RELACIONES_DE_TENANT).filter((m) => !esquema[m]);
    expect(
      sobran,
      `modelos en tenant-relations.ts que ya no tienen claves foráneas: ${sobran.join(", ")}`,
    ).toEqual([]);
  });

  it("las claves de cada modelo coinciden una a una con el esquema", () => {
    const descuadres: string[] = [];

    for (const [modelo, delEsquema] of Object.entries(esquema)) {
      const deLaLista = RELACIONES_DE_TENANT[modelo];
      if (!deLaLista) continue;

      const a = comoTexto(delEsquema);
      const b = comoTexto(deLaLista);
      if (a.join("|") !== b.join("|")) {
        descuadres.push(`${modelo}: esquema [${a.join(", ")}] · lista [${b.join(", ")}]`);
      }
    }

    expect(descuadres, descuadres.join(" · ")).toEqual([]);
  });

  it("todos los destinos son modelos de academia", () => {
    // Un destino global colado en la lista haría que la guardia intentara
    // filtrar por `academyId` una tabla que no lo tiene, y reventaría en
    // producción la primera vez que alguien escribiera ahí.
    for (const [modelo, fks] of Object.entries(RELACIONES_DE_TENANT)) {
      for (const { campo, destino } of fks) {
        expect(
          TENANT_MODELS.has(destino),
          `${modelo}.${campo} apunta a ${destino}, que no es un modelo de academia`,
        ).toBe(true);
      }
    }
  });

  it("ningún modelo se apunta dos veces el mismo campo", () => {
    for (const [modelo, fks] of Object.entries(RELACIONES_DE_TENANT)) {
      const campos = fks.map((f) => f.campo);
      expect(new Set(campos).size, `${modelo} repite campos`).toBe(campos.length);
    }
  });
});
