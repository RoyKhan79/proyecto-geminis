import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import {
  addMemberToAcademy,
  createAcademyWithRoles,
} from "@/server/academies/provision";

/**
 * ESCAPAR DE LA ACADEMIA ESCRIBIENDO
 *
 * `tests/tenancy.test.ts` prueba a fondo las LECTURAS: que buscar por
 * identificador un registro ajeno devuelva «no encontrado», que un `findMany`
 * lleve siempre su `academyId`. Las escrituras estaban menos cubiertas, y son
 * las que hacen daño de verdad: una lectura cruzada es una fuga, una escritura
 * cruzada es una fuga y además un destrozo en los datos de otro.
 *
 * Se prueban aquí las cuatro formas de intentarlo que no son «pedir un id
 * ajeno», porque esas ya están probadas:
 *
 *   1. mover un registro propio a otra academia cambiando su `academyId`,
 *   2. crear un registro diciendo que es de otra,
 *   3. enlazar (`connect`) desde un registro propio a uno ajeno,
 *   4. borrar en bloque esperando alcanzar lo de al lado.
 *
 * Las tres primeras son las que se cuelan por un `where` bien puesto: el filtro
 * de la guardia mira a QUÉ registro se apunta, y estas tres no apuntan a un
 * registro ajeno, sino que intentan fabricar uno.
 */

const SUF = `tw${Date.now().toString(36)}`;
let academiaA: { id: string };
let academiaB: { id: string };
let cursoDeB: { id: string };
let edicionDeB: { id: string };
let alumnoDeA: { id: string };

beforeAll(async () => {
  academiaA = await createAcademyWithRoles({ slug: `tw-a-${SUF}`, name: "Escritura A" });
  academiaB = await createAcademyWithRoles({ slug: `tw-b-${SUF}`, name: "Escritura B" });

  const dbB = tenantDb(academiaB.id);
  const oposicionB = await dbB.opposition.create({
    data: { name: "Oposicion B", slug: `op-tw-b-${SUF}` },
  });
  edicionDeB = await dbB.oppositionEdition.create({
    data: { oppositionId: oposicionB.id, name: "2026" },
  });
  cursoDeB = await dbB.course.create({
    data: { oppositionEditionId: edicionDeB.id, name: "Curso de B" },
  });

  const miembro = await addMemberToAcademy(academiaA.id, {
    email: `alumno@${SUF}.test`,
    firstName: "Alumno",
    roleKeys: ["STUDENT"],
  });
  alumnoDeA = miembro.membership;
});

afterAll(async () => {
  await prismaBase.academy.deleteMany({
    where: { id: { in: [academiaA.id, academiaB.id] } },
  });
  await prismaBase.user.deleteMany({ where: { email: { endsWith: `@${SUF}.test` } } });
  await prismaBase.$disconnect();
});

describe("escritura cruzada · mover algo propio a otra academia", () => {
  it("no se puede cambiar el academyId de un registro propio", async () => {
    const dbA = tenantDb(academiaA.id);

    const oposicionA = await dbA.opposition.create({
      data: { name: "Oposicion A", slug: `op-tw-a-${SUF}` },
    });

    /*
     * Este es el intento más directo y el que menos se ve venir: el registro ES
     * de A, así que la comprobación de propiedad de la guardia lo deja pasar
     * —y hace bien—, y lo que se cuela es el CONTENIDO de la actualización.
     *
     * Debajo está la política de PostgreSQL, cuyo `WITH CHECK` mira la fila tal
     * como quedaría después de escribirla. Por eso la operación no puede
     * terminar bien: o la para la aplicación, o la para la base de datos.
     */
    await expect(
      dbA.opposition.update({
        where: { id: oposicionA.id },
        data: { academyId: academiaB.id },
      }),
    ).rejects.toThrow();

    // Y sobre todo: la fila sigue donde estaba.
    const despues = await prismaBase.opposition.findUniqueOrThrow({
      where: { id: oposicionA.id },
      select: { academyId: true },
    });
    expect(despues.academyId).toBe(academiaA.id);
  });

  it("tampoco en bloque con updateMany", async () => {
    const dbA = tenantDb(academiaA.id);

    await expect(
      dbA.opposition.updateMany({ data: { academyId: academiaB.id } }),
    ).rejects.toThrow();

    const deB = await prismaBase.opposition.count({
      where: { academyId: academiaB.id },
    });
    expect(deB).toBe(1);
  });
});

describe("escritura cruzada · crear algo diciendo que es de otro", () => {
  it("crear con el academyId de otra academia lanza y no escribe", async () => {
    const dbA = tenantDb(academiaA.id);
    const antes = await prismaBase.opposition.count({ where: { academyId: academiaB.id } });

    await expect(
      dbA.opposition.create({
        data: {
          name: "Colada",
          slug: `colada-${SUF}`,
          academyId: academiaB.id,
        },
      }),
    ).rejects.toThrow(/academyId ajeno/i);

    const despues = await prismaBase.opposition.count({ where: { academyId: academiaB.id } });
    expect(despues).toBe(antes);
  });

  it("createMany con una fila ajena escondida entre varias propias", async () => {
    const dbA = tenantDb(academiaA.id);
    const antes = await prismaBase.opposition.count({ where: { academyId: academiaB.id } });

    // Una fila mala entre dos buenas: si la guardia solo mirara la primera,
    // pasaría.
    await expect(
      dbA.opposition.createMany({
        data: [
          { name: "Buena 1", slug: `buena1-${SUF}` },
          { name: "Mala", slug: `mala-${SUF}`, academyId: academiaB.id },
          { name: "Buena 2", slug: `buena2-${SUF}` },
        ],
      }),
    ).rejects.toThrow(/academyId ajeno/i);

    const despues = await prismaBase.opposition.count({ where: { academyId: academiaB.id } });
    expect(despues).toBe(antes);
  });
});

describe("escritura cruzada · enlazar con algo de otra academia", () => {
  it("no se puede crear una edición colgando de una oposición ajena", async () => {
    const dbA = tenantDb(academiaA.id);

    // Este es el que estaba abierto: `oppositionId` no es un `academyId`, así
    // que la guardia no lo miraba, y la fila resultante era legítima —de A—
    // apuntando a una entidad de B. Ahora se comprueba cada clave foránea
    // contra la academia del contexto (src/lib/db/tenant-relations.ts).
    await expect(
      dbA.oppositionEdition.create({
        data: {
          oppositionId: (
            await prismaBase.opposition.findFirstOrThrow({
              where: { academyId: academiaB.id },
              select: { id: true },
            })
          ).id,
          name: "Edicion colada",
        },
      }),
    ).rejects.toThrow();
  });

  it("no se puede matricular a nadie en un curso de otra academia", async () => {
    const dbA = tenantDb(academiaA.id);

    await expect(
      dbA.enrollment.create({
        data: {
          studentId: alumnoDeA.id,
          courseId: cursoDeB.id,
          status: "ACTIVE",
        },
      }),
    ).rejects.toThrow();

    const matriculasDeB = await prismaBase.enrollment.count({
      where: { courseId: cursoDeB.id },
    });
    expect(matriculasDeB).toBe(0);
  });

  it("no se puede enlazar con `connect` a una entidad ajena", async () => {
    const dbA = tenantDb(academiaA.id);

    await expect(
      dbA.course.create({
        data: {
          name: "Curso colado",
          oppositionEdition: { connect: { id: edicionDeB.id } },
        },
      }),
    ).rejects.toThrow();

    const cursosDeB = await prismaBase.course.count({
      where: { academyId: academiaB.id },
    });
    expect(cursosDeB).toBe(1);
  });
});

describe("escritura cruzada · borrar lo de al lado", () => {
  it("un deleteMany sin filtro no toca a la otra academia", async () => {
    const dbA = tenantDb(academiaA.id);
    await dbA.opposition.deleteMany({});

    // Las de A se van; las de B, ni se enteran.
    expect(await prismaBase.opposition.count({ where: { academyId: academiaA.id } })).toBe(0);
    expect(await prismaBase.opposition.count({ where: { academyId: academiaB.id } })).toBe(1);
  });

  it("borrar por identificador algo ajeno dice «no encontrado», no lo borra", async () => {
    const dbA = tenantDb(academiaA.id);

    await expect(
      dbA.course.delete({ where: { id: cursoDeB.id } }),
    ).rejects.toThrow(/no se ha encontrado/i);

    expect(await prismaBase.course.count({ where: { id: cursoDeB.id } })).toBe(1);
  });
});
