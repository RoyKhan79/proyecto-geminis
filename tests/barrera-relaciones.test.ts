import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createAcademyWithRoles } from "@/server/academies/provision";
import { RELACIONES_DE_TENANT } from "@/lib/db/tenant-relations";

/** Nombre de tabla de cada modelo, igual que hace el generador. */
function tablasPorModelo(): Map<string, string> {
  const dir = path.join(process.cwd(), "prisma", "schema");
  const tablas = new Map<string, string>();
  for (const archivo of readdirSync(dir).filter((f) => f.endsWith(".prisma"))) {
    const texto = readFileSync(path.join(dir, archivo), "utf8");
    for (const bloque of texto.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
      const [, modelo, cuerpo] = bloque;
      const mapa = cuerpo.match(/@@map\("([^"]+)"\)/);
      tablas.set(modelo, mapa ? mapa[1] : modelo);
    }
  }
  return tablas;
}

/**
 * LA TERCERA BARRERA · NO SE PUEDE APUNTAR A OTRA ACADEMIA
 *
 * `tenant-relaciones.test.ts` comprueba la guardia de aplicación. Esto
 * comprueba la de la base, y la comprueba como hay que comprobarla: **con SQL
 * crudo, saltándose la guardia entera**. Si la única prueba pasara por
 * `tenantDb`, estaría midiendo la barrera de arriba otra vez.
 *
 * El ataque es el que motivó todo esto:
 *
 *     INSERT INTO opposition_editions ("academyId", "oppositionId", ...)
 *     VALUES (<academia A>, <oposición de la academia B>, ...)
 *
 * La fila es legítima para Row Level Security —es de A— y la clave foránea
 * también la da por buena, porque la integridad referencial se verifica
 * saltándose RLS por diseño. Sin el disparador, entra. Y en cuanto alguien
 * hiciera `include: { opposition: true }`, la academia A estaría leyendo el
 * nombre de una oposición de la B.
 */

const SUF = `bar${Date.now().toString(36)}`;

let academiaA: { id: string };
let academiaB: { id: string };
let oposicionDeB: { id: string };
let oposicionDeA: { id: string };

beforeAll(async () => {
  academiaA = await createAcademyWithRoles({ slug: `bar-a-${SUF}`, name: "Bar A" });
  academiaB = await createAcademyWithRoles({ slug: `bar-b-${SUF}`, name: "Bar B" });

  oposicionDeA = await tenantDb(academiaA.id).opposition.create({
    data: { name: "Oposicion de A", slug: `op-bar-a-${SUF}` },
  });
  oposicionDeB = await tenantDb(academiaB.id).opposition.create({
    data: { name: "Oposicion de B", slug: `op-bar-b-${SUF}` },
  });
});

afterAll(async () => {
  await prismaBase.academy.deleteMany({
    where: { id: { in: [academiaA.id, academiaB.id] } },
  });
});

/**
 * Inserta una edición con SQL crudo, sin pasar por la guardia.
 *
 * Se fija la academia en la sesión igual que hace `tenantDb`, para que la
 * política de RLS se comporte exactamente como en la aplicación: lo que se
 * quiere probar es lo que hay DEBAJO de la guardia, no lo que hay encima.
 */
async function insertarEdicion(academyId: string, oppositionId: string) {
  return prismaBase.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('catedria.academy_id', $1, true)`,
      academyId,
    );
    return tx.$executeRawUnsafe(
      `INSERT INTO opposition_editions (id, "academyId", "oppositionId", name, "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, '2026', now(), now())`,
      academyId,
      oppositionId,
    );
  });
}

describe("apuntar a otra academia", () => {
  it("se rechaza al crear, con SQL crudo y saltándose la guardia", async () => {
    await expect(
      insertarEdicion(academiaA.id, oposicionDeB.id),
    ).rejects.toThrow(/otra academia/i);
  });

  it("lo legítimo sigue funcionando", async () => {
    // Importa tanto como lo anterior: una barrera que además bloquee el uso
    // normal no es una barrera, es una avería.
    await expect(
      insertarEdicion(academiaA.id, oposicionDeA.id),
    ).resolves.toBeGreaterThan(0);
  });

  it("tampoco se puede reapuntar una fila ya creada", async () => {
    // La otra mitad: crear bien y cambiar después el destino a uno ajeno.
    const edicion = await tenantDb(academiaA.id).oppositionEdition.create({
      data: { oppositionId: oposicionDeA.id, name: "2027" },
    });

    await expect(
      prismaBase.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT set_config('catedria.academy_id', $1, true)`,
          academiaA.id,
        );
        return tx.$executeRawUnsafe(
          `UPDATE opposition_editions SET "oppositionId" = $1 WHERE id = $2`,
          oposicionDeB.id,
          edicion.id,
        );
      }),
    ).rejects.toThrow(/otra academia/i);
  });

  it("y no se puede mudar una fila de academia dejando el padre atrás", async () => {
    // Cambiar el `academyId` de una fila que apunta a un padre de A la dejaría
    // en B apuntando a A. El disparador también salta con `UPDATE OF academyId`.
    const edicion = await tenantDb(academiaA.id).oppositionEdition.create({
      data: { oppositionId: oposicionDeA.id, name: "2028" },
    });

    await expect(
      prismaBase.$executeRawUnsafe(
        `UPDATE opposition_editions SET "academyId" = $1 WHERE id = $2`,
        academiaB.id,
        edicion.id,
      ),
    ).rejects.toThrow(/otra academia/i);
  });
});

describe("las tareas del sistema, sin academia fijada", () => {
  it("tampoco pueden cruzar academias", async () => {
    // Sin `catedria.academy_id`, la política deja verlo todo: aquí la barrera
    // no puede apoyarse en «no lo veo» y tiene que comparar los identificadores.
    await expect(
      prismaBase.$executeRawUnsafe(
        `INSERT INTO opposition_editions (id, "academyId", "oppositionId", name, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, '2029', now(), now())`,
        academiaA.id,
        oposicionDeB.id,
      ),
    ).rejects.toThrow(/otra academia/i);
  });
});

describe("la cobertura de la barrera", () => {
  it("cada relación de la lista tiene su disparador en la base", async () => {
    /*
     * La red que evita que esto se pudra.
     *
     * `tenant-relaciones.test.ts` ya comprueba que la lista no se quede corta
     * frente al esquema. Aquí se comprueba lo siguiente: que lo que hay en la
     * lista esté de verdad ejecutándose en la base. Sin esto, añadir una
     * relación a la lista y olvidarse de `npm run barrera:generar` dejaría la
     * tercera barrera con un agujero, y en verde.
     */
    const disparadores = await prismaBase.$queryRaw<{ tgname: string }[]>`
      SELECT tgname FROM pg_trigger
      WHERE NOT tgisinternal AND tgname LIKE 'barrera\_%'
    `;
    const puestos = new Set(disparadores.map((d) => d.tgname));

    const tablas = tablasPorModelo();
    const faltan: string[] = [];

    for (const [modelo, relaciones] of Object.entries(RELACIONES_DE_TENANT)) {
      const tabla = tablas.get(modelo);
      expect(tabla, `sin tabla para ${modelo}`).toBeTruthy();
      for (const { campo } of relaciones) {
        const nombre = `barrera_${tabla}_${campo}`.slice(0, 63);
        if (!puestos.has(nombre)) faltan.push(`${modelo}.${campo}`);
      }
    }

    expect(
      faltan,
      `Sin disparador: ${faltan.join(", ")}. Ejecuta \`npm run barrera:generar\` y aplica la migración.`,
    ).toEqual([]);
  });
});
