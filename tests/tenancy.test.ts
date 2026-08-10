import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { tenantDb, TenantViolationError } from "@/lib/db/tenant";
import { GLOBAL_MODELS, TENANT_MODELS } from "@/lib/db/tenant-models";
import { createAcademyWithRoles, addMemberToAcademy } from "@/server/academies/provision";

/**
 * AISLAMIENTO MULTI-TENANT
 *
 * Estas pruebas son la red de seguridad del producto. Si alguna falla, hay una
 * academia que puede ver datos de otra: eso no es un fallo funcional, es un
 * incidente de protección de datos.
 */

const SUFIJO = `t${Date.now().toString(36)}`;
let academiaA: { id: string };
let academiaB: { id: string };

beforeAll(async () => {
  academiaA = await createAcademyWithRoles({
    slug: `test-a-${SUFIJO}`,
    name: "Academia de prueba A",
  });
  academiaB = await createAcademyWithRoles({
    slug: `test-b-${SUFIJO}`,
    name: "Academia de prueba B",
  });
});

afterAll(async () => {
  await prismaBase.academy.deleteMany({
    where: { id: { in: [academiaA.id, academiaB.id] } },
  });
  await prismaBase.user.deleteMany({
    where: { email: { endsWith: `@${SUFIJO}.test` } },
  });
  await prismaBase.$disconnect();
});

describe("catálogo de modelos", () => {
  it("clasifica todos los modelos que tienen academyId", async () => {
    // La verdad está en PostgreSQL, no en nuestra lista: si alguien añade un
    // modelo nuevo con academyId y olvida registrarlo, esta prueba lo caza.
    const filas = await prismaBase.$queryRaw<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND column_name = 'academyId'
        AND is_nullable = 'NO'
    `;

    const declarados = new Set(
      [...TENANT_MODELS].map((m) => m.toLowerCase()),
    );
    const tablasSinDeclarar = filas
      .map((fila) => fila.table_name)
      // Las tablas usan snake_case en plural; comparamos sin separadores.
      .filter((tabla) => {
        const normalizada = tabla.replace(/_/g, "");
        return ![...declarados].some(
          (modelo) =>
            normalizada === `${modelo}s` ||
            normalizada === modelo ||
            normalizada.startsWith(modelo),
        );
      });

    expect(tablasSinDeclarar).toEqual([]);
  });

  it("no clasifica un modelo a la vez como global y de tenant", () => {
    const solapados = [...TENANT_MODELS].filter((modelo) =>
      GLOBAL_MODELS.has(modelo),
    );
    expect(solapados).toEqual([]);
  });
});

describe("guardia de lectura", () => {
  it("no devuelve registros de otra academia en findMany", async () => {
    const dbA = tenantDb(academiaA.id);
    const dbB = tenantDb(academiaB.id);

    await dbA.opposition.create({
      data: { name: "Oposición A", slug: "oposicion-a" },
    });
    await dbB.opposition.create({
      data: { name: "Oposición B", slug: "oposicion-b" },
    });

    const desdeA = await dbA.opposition.findMany();
    const desdeB = await dbB.opposition.findMany();

    expect(desdeA).toHaveLength(1);
    expect(desdeA[0].name).toBe("Oposición A");
    expect(desdeB).toHaveLength(1);
    expect(desdeB[0].name).toBe("Oposición B");
  });

  it("findUnique por id de otra academia devuelve null", async () => {
    const dbA = tenantDb(academiaA.id);
    const dbB = tenantDb(academiaB.id);

    const deB = await dbB.opposition.create({
      data: { name: "Solo de B", slug: "solo-de-b" },
    });

    // El identificador es correcto y existe: lo que impide leerlo es la guardia.
    const intento = await dbA.opposition.findUnique({ where: { id: deB.id } });
    expect(intento).toBeNull();

    const propio = await dbB.opposition.findUnique({ where: { id: deB.id } });
    expect(propio?.id).toBe(deB.id);
  });

  it("count y aggregate solo cuentan lo propio", async () => {
    const dbA = tenantDb(academiaA.id);
    const total = await dbA.opposition.count();
    const globales = await prismaBase.opposition.count({
      where: { academyId: { in: [academiaA.id, academiaB.id] } },
    });

    expect(total).toBeLessThan(globales);
  });
});

describe("guardia de escritura", () => {
  it("rellena academyId sin que el código lo indique", async () => {
    const dbA = tenantDb(academiaA.id);
    const creada = await dbA.opposition.create({
      data: { name: "Sin academyId explícito", slug: `auto-${SUFIJO}` },
    });

    const enBruto = await prismaBase.opposition.findUnique({
      where: { id: creada.id },
      select: { academyId: true },
    });
    expect(enBruto?.academyId).toBe(academiaA.id);
  });

  it("rechaza escribir con el academyId de otra academia", async () => {
    const dbA = tenantDb(academiaA.id);
    await expect(
      dbA.opposition.create({
        data: {
          academyId: academiaB.id,
          name: "Intento cruzado",
          slug: `cruzado-${SUFIJO}`,
        },
      }),
    ).rejects.toThrow(TenantViolationError);
  });

  it("no permite actualizar un registro de otra academia", async () => {
    const dbA = tenantDb(academiaA.id);
    const dbB = tenantDb(academiaB.id);

    const deB = await dbB.opposition.create({
      data: { name: "Intocable", slug: `intocable-${SUFIJO}` },
    });

    await expect(
      dbA.opposition.update({
        where: { id: deB.id },
        data: { name: "Modificada desde A" },
      }),
    ).rejects.toThrow();

    const sinCambios = await prismaBase.opposition.findUnique({
      where: { id: deB.id },
      select: { name: true },
    });
    expect(sinCambios?.name).toBe("Intocable");
  });

  it("no permite borrar un registro de otra academia", async () => {
    const dbA = tenantDb(academiaA.id);
    const dbB = tenantDb(academiaB.id);

    const deB = await dbB.opposition.create({
      data: { name: "Persistente", slug: `persistente-${SUFIJO}` },
    });

    await expect(dbA.opposition.delete({ where: { id: deB.id } })).rejects.toThrow();

    const sigueViva = await prismaBase.opposition.findUnique({
      where: { id: deB.id },
      select: { id: true },
    });
    expect(sigueViva).not.toBeNull();
  });

  it("deleteMany no alcanza a otra academia", async () => {
    const dbA = tenantDb(academiaA.id);
    const antes = await prismaBase.opposition.count({
      where: { academyId: academiaB.id },
    });

    await dbA.opposition.deleteMany({});

    const despues = await prismaBase.opposition.count({
      where: { academyId: academiaB.id },
    });
    expect(despues).toBe(antes);
    expect(await dbA.opposition.count()).toBe(0);
  });
});

describe("claves únicas compuestas", () => {
  it("las respeta al comprobar la propiedad", async () => {
    // Regresión: la guardia reescribía findUnique como findFirst añadiendo
    // academyId, y findFirst no admite claves compuestas como
    // `studentId_questionId`. El resultado era que el histórico de errores del
    // alumnado nunca se guardaba y el "test de mis errores" quedaba vacío.
    const dbA = tenantDb(academiaA.id);

    const oposicion = await dbA.opposition.create({
      data: { name: "Compuesta", slug: `compuesta-${SUFIJO}` },
    });
    const edicion = await dbA.oppositionEdition.create({
      data: { oppositionId: oposicion.id, name: "2026" },
    });

    // El par (academyId, key) de OppositionType es una clave única compuesta.
    const tipo = await dbA.oppositionType.create({
      data: { key: `TIPO_${SUFIJO}`, name: "Tipo de prueba" },
    });

    const leido = await dbA.oppositionType.findUnique({
      where: { academyId_key: { academyId: academiaA.id, key: `TIPO_${SUFIJO}` } },
    });
    expect(leido?.id).toBe(tipo.id);

    // Y desde la otra academia, ese mismo `where` no devuelve nada.
    const dbB = tenantDb(academiaB.id);
    const desdeB = await dbB.oppositionType.findUnique({
      where: { academyId_key: { academyId: academiaA.id, key: `TIPO_${SUFIJO}` } },
    });
    expect(desdeB).toBeNull();

    await dbA.oppositionEdition.delete({ where: { id: edicion.id } });
    await dbA.opposition.delete({ where: { id: oposicion.id } });
  });
});

describe("modelos derivados", () => {
  it("no se pueden consultar directamente desde un cliente de academia", async () => {
    const dbA = tenantDb(academiaA.id);
    // TypeScript sí deja escribirlo (el delegado existe); quien lo impide es la
    // guardia en tiempo de ejecución, que es donde importa.
    await expect(dbA.studentProfile.findMany()).rejects.toThrow(
      TenantViolationError,
    );
  });
});

describe("pertenencias", () => {
  it("una misma persona puede estar en dos academias sin mezclar datos", async () => {
    const email = `doble@${SUFIJO}.test`;

    const enA = await addMemberToAcademy(academiaA.id, {
      email,
      firstName: "Persona",
      lastName: "Doble",
      roleKeys: ["STUDENT"],
    });
    const enB = await addMemberToAcademy(academiaB.id, {
      email,
      firstName: "Persona",
      lastName: "Doble",
      roleKeys: ["TEACHER"],
    });

    expect(enA.user.id).toBe(enB.user.id);
    expect(enA.membership.id).not.toBe(enB.membership.id);

    const dbA = tenantDb(academiaA.id);
    const visiblesEnA = await dbA.membership.findMany({
      where: { user: { email } },
    });
    expect(visiblesEnA).toHaveLength(1);
    expect(visiblesEnA[0].id).toBe(enA.membership.id);
  });
});
