import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { createAcademyWithRoles, addMemberToAcademy } from "@/server/academies/provision";
import {
  grantsCover,
  loadStudentGrants,
  studentNodeWhere,
  type NodeForAccess,
} from "@/lib/access/content-access";
import { CAPACIDADES, capacidadesDisponibles } from "@/lib/access/capacidades";

/**
 * ACCESO CONCEDIDO A MANO
 *
 * La academia abre herramientas alumno a alumno desde su ficha, sin pasar por
 * una matrícula. Lo que se comprueba aquí es que eso llegue de verdad al motor
 * de acceso: si el derecho se guarda pero el motor no lo mira, la pantalla dice
 * que el alumno tiene tests y el alumno no los tiene.
 *
 * Y sobre todo la otra dirección: que conceder «hacer tests» no abra el
 * temario. Un acceso que concede de más es dinero regalado.
 */

const SUFIJO = `am${Date.now().toString(36)}`;
let academia: { id: string };
let alumno: { id: string };
let edicionId: string;
let temaId: string;

beforeAll(async () => {
  academia = await createAcademyWithRoles({
    slug: `test-acceso-${SUFIJO}`,
    name: "Academia de prueba · acceso",
  });

  const { membership } = await addMemberToAcademy(academia.id, {
    email: `alumna@${SUFIJO}.test`,
    firstName: "Alumna",
    roleKeys: ["STUDENT"],
  });
  alumno = { id: membership.id };

  const oposicion = await prismaBase.opposition.create({
    data: {
      academyId: academia.id,
      name: "Oposición de prueba",
      slug: `oposicion-${SUFIJO}`,
    },
  });
  const edicion = await prismaBase.oppositionEdition.create({
    data: {
      academyId: academia.id,
      oppositionId: oposicion.id,
      name: "Convocatoria de prueba",
    },
  });
  edicionId = edicion.id;

  const tema = await prismaBase.contentNode.create({
    data: {
      academyId: academia.id,
      editionId: edicionId,
      label: "Tema 1",
      slug: "tema-1",
      path: "/",
      kind: "TOPIC",
      status: "PUBLISHED",
      visibleToStudents: true,
    },
  });
  temaId = tema.id;
});

afterAll(async () => {
  await prismaBase.academy.deleteMany({ where: { id: academia.id } });
  await prismaBase.user.deleteMany({
    where: { email: { endsWith: `@${SUFIJO}.test` } },
  });
  await prismaBase.$disconnect();
});

function nodo(): NodeForAccess {
  return {
    id: temaId,
    path: "/",
    editionId: edicionId,
    isFree: false,
    visibleToStudents: true,
    status: "PUBLISHED",
  };
}

async function concederAMano(
  capacidades: string[],
  extra: { endsAt?: Date } = {},
) {
  await prismaBase.entitlement.deleteMany({ where: { studentId: alumno.id } });
  await prismaBase.entitlement.create({
    data: {
      academyId: academia.id,
      studentId: alumno.id,
      source: "MANUAL",
      status: "ACTIVE",
      endsAt: extra.endsAt ?? null,
      scopes: {
        create: capacidades.map((capability) => ({
          editionId: edicionId,
          capability: capability as never,
        })),
      },
    },
  });
}

describe("el motor respeta lo que concede la ficha del alumno", () => {
  it("sin ningún derecho no llega al contenido", async () => {
    await prismaBase.entitlement.deleteMany({ where: { studentId: alumno.id } });
    const grants = await loadStudentGrants(academia.id, alumno.id);
    expect(grantsCover(grants, nodo(), "VIEW_CONTENT")).toBe(false);
  });

  it("concede exactamente las herramientas marcadas, y ninguna más", async () => {
    await concederAMano(["TAKE_TESTS", "USE_AI_TUTOR"]);
    const grants = await loadStudentGrants(academia.id, alumno.id);

    expect(grantsCover(grants, nodo(), "TAKE_TESTS")).toBe(true);
    expect(grantsCover(grants, nodo(), "USE_AI_TUTOR")).toBe(true);

    // Lo que no se marcó sigue cerrado. Es la mitad que importa: dar tests no
    // puede regalar el temario ni las descargas.
    expect(grantsCover(grants, nodo(), "VIEW_CONTENT")).toBe(false);
    expect(grantsCover(grants, nodo(), "DOWNLOAD_CONTENT")).toBe(false);
    expect(grantsCover(grants, nodo(), "TAKE_SIMULATIONS")).toBe(false);
  });

  it("quitar una herramienta la cierra de verdad", async () => {
    await concederAMano(["TAKE_TESTS", "VIEW_CONTENT"]);
    expect(
      grantsCover(await loadStudentGrants(academia.id, alumno.id), nodo(), "VIEW_CONTENT"),
    ).toBe(true);

    await concederAMano(["TAKE_TESTS"]);
    expect(
      grantsCover(await loadStudentGrants(academia.id, alumno.id), nodo(), "VIEW_CONTENT"),
    ).toBe(false);
  });

  it("un derecho caducado deja de contar", async () => {
    await concederAMano(["VIEW_CONTENT"], {
      endsAt: new Date(Date.now() - 60_000),
    });
    const grants = await loadStudentGrants(academia.id, alumno.id);
    expect(grantsCover(grants, nodo(), "VIEW_CONTENT")).toBe(false);
  });

  it("un derecho revocado deja de contar", async () => {
    await concederAMano(["VIEW_CONTENT"]);
    await prismaBase.entitlement.updateMany({
      where: { studentId: alumno.id },
      data: { status: "CANCELLED" },
    });
    const grants = await loadStudentGrants(academia.id, alumno.id);
    expect(grantsCover(grants, nodo(), "VIEW_CONTENT")).toBe(false);
  });
});

describe("el filtro de la consulta respeta la capacidad, no solo la convocatoria", () => {
  /*
   * La otra mitad del motor. `grantsCover` se usa cuando ya se tiene el nodo
   * delante; `studentNodeWhere` es el filtro que va a la base de datos, y la
   * IA, los tests y los simulacros usan SOLO ese.
   *
   * Mientras fue ciego a la capacidad, conceder «clases en directo» sobre una
   * convocatoria le abría al alumno el temario entero a través del tutor.
   */
  const ediciones = (where: ReturnType<typeof studentNodeWhere>) =>
    (where.OR ?? []).flatMap((c: Record<string, unknown>) =>
      "editionId" in c ? [(c.editionId as { in: string[] }).in] : [],
    ).flat();

  it("con «clases en directo» la IA no alcanza NADA del temario", async () => {
    await concederAMano(["ATTEND_CLASSES"]);
    const grants = await loadStudentGrants(academia.id, alumno.id);

    expect(ediciones(studentNodeWhere(grants, "ATTEND_CLASSES"))).toContain(edicionId);
    // Lo que importa: por aquí entraba el temario de pago.
    expect(ediciones(studentNodeWhere(grants, "USE_AI_TUTOR"))).toHaveLength(0);
    expect(ediciones(studentNodeWhere(grants, "VIEW_CONTENT"))).toHaveLength(0);
    expect(ediciones(studentNodeWhere(grants, "TAKE_TESTS"))).toHaveLength(0);
  });

  it("con «hacer tests» puede hacer tests pero no descargarse el temario", async () => {
    await concederAMano(["TAKE_TESTS"]);
    const grants = await loadStudentGrants(academia.id, alumno.id);

    expect(ediciones(studentNodeWhere(grants, "TAKE_TESTS"))).toContain(edicionId);
    expect(ediciones(studentNodeWhere(grants, "DOWNLOAD_CONTENT"))).toHaveLength(0);
    expect(ediciones(studentNodeWhere(grants, "TAKE_SIMULATIONS"))).toHaveLength(0);
  });

  it("sin ningún derecho el filtro no deja pasar nada", async () => {
    await prismaBase.entitlement.deleteMany({ where: { studentId: alumno.id } });
    const grants = await loadStudentGrants(academia.id, alumno.id);
    const where = studentNodeWhere(grants, "USE_AI_TUTOR");
    // Ni siquiera lo marcado como libre: gratis es gratis para LEERLO.
    expect(where.OR).toHaveLength(0);
  });

  it("lo libre se lee, pero no se descarga ni se testea", async () => {
    await prismaBase.entitlement.deleteMany({ where: { studentId: alumno.id } });
    const grants = await loadStudentGrants(academia.id, alumno.id);

    expect(studentNodeWhere(grants, "VIEW_CONTENT").OR).toContainEqual({
      isFree: true,
    });
    expect(studentNodeWhere(grants, "DOWNLOAD_CONTENT").OR).toHaveLength(0);
  });
});

describe("una academia solo reparte lo que tiene contratado", () => {
  it("sin el módulo de IA no puede ofrecer el tutor", () => {
    const sinIa = new Set(["CONTENIDO", "EVALUACION", "AGENDA"]);
    const codigos = capacidadesDisponibles(sinIa).map((c) => c.codigo);
    expect(codigos).not.toContain("USE_AI_TUTOR");
    expect(codigos).toContain("TAKE_TESTS");
  });

  it("sin ningún módulo no puede ofrecer nada", () => {
    expect(capacidadesDisponibles(new Set<string>())).toHaveLength(0);
  });

  it("cada capacidad declara un módulo del catálogo", async () => {
    const { MODULOS } = await import("@/lib/modules/catalogo");
    for (const capacidad of CAPACIDADES) {
      expect(MODULOS[capacidad.modulo], capacidad.codigo).toBeDefined();
    }
  });
});
