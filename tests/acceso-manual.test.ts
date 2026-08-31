import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { createAcademyWithRoles, addMemberToAcademy } from "@/server/academies/provision";
import {
  grantsCover,
  loadStudentGrants,
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
