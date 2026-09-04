import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { createAcademyWithRoles } from "@/server/academies/provision";
import { createContentNode } from "@/server/content/tree";
import { revisarDisposiciones } from "@/server/legislation/radar-normativa";
import type { ItemBoletin } from "@/server/radar/boe";

/**
 * EL RADAR DE NORMATIVA, DE PUNTA A PUNTA
 *
 * `deteccion-normativa.test.ts` prueba si un título del BOE anuncia un cambio.
 * Esto prueba lo que pasa después, que es lo que la academia nota: se abre la
 * alerta, se calcula qué contenido dependía de esa norma y las preguntas se
 * marcan para revisar.
 *
 * Y prueba lo que NO puede pasar:
 *
 *   · que la alerta de una academia acabe en otra, aunque las dos sigan la
 *     misma ley —el boletín es común, las normas no—;
 *   · que reprocesar un día abra la alerta otra vez. El sumario no cambia y
 *     reprocesar es normal: sin esa protección, una modificación publicada el
 *     lunes generaría una alerta nueva cada mañana y la academia acabaría
 *     ignorando el aviso.
 */

const SUF = `nor${Date.now().toString(36)}`;

let academiaA: { id: string };
let academiaB: { id: string };
let normaA: { id: string };
let preguntaA: { id: string };

/**
 * Revisa, pero solo para las academias de esta prueba.
 *
 * En la base de desarrollo hay otras academias que siguen la misma ley —la de
 * demostración, sin ir más lejos— y sin acotar, la prueba dependería de lo que
 * haya sembrado en ese momento y además le abriría alertas a la demo.
 */
function revisar(items: ItemBoletin[]) {
  return revisarDisposiciones(items, {
    academyIds: [academiaA.id, academiaB.id],
  });
}

/** Un anuncio del BOE tal como llega del adaptador. */
function anuncio(externalId: string, title: string): ItemBoletin {
  return {
    source: "BOE",
    externalId,
    section: "1",
    title,
    department: "MINISTERIO DE POLITICA TERRITORIAL",
    epigraph: null,
    url: `https://www.boe.es/diario_boe/txt.php?id=${externalId}`,
    pdfUrl: null,
    publishedAt: new Date(),
  };
}

const MODIFICA =
  "Real Decreto 203/2021, de 30 de marzo, por el que se aprueba el Reglamento " +
  "de actuación y funcionamiento del sector público por medios electrónicos y " +
  "se modifica la Ley 39/2015, de 1 de octubre.";

beforeAll(async () => {
  academiaA = await createAcademyWithRoles({ slug: `nor-a-${SUF}`, name: "Nor A" });
  academiaB = await createAcademyWithRoles({ slug: `nor-b-${SUF}`, name: "Nor B" });

  // El radar solo mira academias con el módulo contratado, así que hay que
  // dárselo: sin esto la prueba pasaría en verde sin ejecutar nada.
  await prismaBase.academyModule.createMany({
    data: [academiaA.id, academiaB.id].map((academyId) => ({
      academyId,
      module: "NORMATIVA" as const,
      active: true,
    })),
  });

  const db = tenantDb(academiaA.id);

  // La academia A sigue la Ley 39/2015 y tiene contenido enlazado a un artículo.
  normaA = await db.legislation.create({
    data: { reference: "Ley 39/2015", title: "Procedimiento Administrativo Comun" },
  });
  const articulo = await db.legislationArticle.create({
    data: { legislationId: normaA.id, number: "21", title: "Obligacion de resolver" },
  });

  const oposicion = await db.opposition.create({
    data: { name: "Oposicion", slug: `op-nor-${SUF}` },
  });
  const edicion = await db.oppositionEdition.create({
    data: { oppositionId: oposicion.id, name: "2026" },
  });
  const temario = await createContentNode(db, {
    editionId: edicion.id,
    kind: "SECTION",
    sectionKind: "SYLLABUS",
    label: "Temario",
    status: "PUBLISHED",
  });
  const tema = await createContentNode(db, {
    editionId: edicion.id,
    parentId: temario.id,
    kind: "TOPIC",
    label: "Procedimiento",
    status: "PUBLISHED",
  });

  preguntaA = await db.question.create({
    data: {
      statement: "¿Cuál es el plazo máximo para resolver?",
      status: "PUBLISHED",
      nodeId: tema.id,
    },
  });
  await db.questionOption.createMany({
    data: [
      { questionId: preguntaA.id, text: "Tres meses", position: 0, isCorrect: true },
      { questionId: preguntaA.id, text: "Seis meses", position: 1 },
    ],
  });

  await db.contentLegislationLink.createMany({
    data: [
      { articleId: articulo.id, nodeId: tema.id },
      { articleId: articulo.id, questionId: preguntaA.id },
    ],
  });

  // La academia B sigue la MISMA ley, sin nada enlazado.
  await tenantDb(academiaB.id).legislation.create({
    data: { reference: "Ley 39/2015", title: "Procedimiento Administrativo Comun" },
  });
});

afterAll(async () => {
  await prismaBase.academy.deleteMany({
    where: { id: { in: [academiaA.id, academiaB.id] } },
  });
});

describe("una modificación publicada en el BOE", () => {
  it("abre alerta en las dos academias que siguen la norma", async () => {
    const r = await revisar([anuncio("BOE-A-2021-4757", MODIFICA)]);
    expect(r.alertas).toBe(2);
    expect(r.preguntasMarcadas).toBe(1);
  });

  it("cada alerta queda en su academia", async () => {
    const deA = await tenantDb(academiaA.id).legislationChangeAlert.findMany({
      select: { id: true, changeType: true, officialId: true, impact: true },
    });
    expect(deA).toHaveLength(1);
    expect(deA[0].changeType).toBe("AMENDED");
    expect(deA[0].officialId).toBe("BOE-A-2021-4757");

    // El impacto de A: su tema y su pregunta. La academia B no tiene nada
    // enlazado, así que su alerta sale a cero.
    const impacto = deA[0].impact as { totalTemas: number; totalPreguntas: number };
    expect(impacto.totalTemas).toBe(1);
    expect(impacto.totalPreguntas).toBe(1);

    const deB = await tenantDb(academiaB.id).legislationChangeAlert.findMany({
      select: { impact: true },
    });
    expect(deB).toHaveLength(1);
    expect((deB[0].impact as { totalPreguntas: number }).totalPreguntas).toBe(0);
  });

  it("la pregunta queda marcada, no cambiada", async () => {
    // ADR-0013: Catedria señala, no reescribe el material del preparador.
    const p = await tenantDb(academiaA.id).question.findUnique({
      where: { id: preguntaA.id },
      select: { status: true, statement: true, outdatedReason: true },
    });
    expect(p?.status).toBe("POSSIBLY_OUTDATED");
    expect(p?.statement).toBe("¿Cuál es el plazo máximo para resolver?");
    expect(p?.outdatedReason).toContain("Ley 39/2015");
  });
});

describe("reprocesar el mismo día", () => {
  it("no abre la alerta otra vez", async () => {
    const r = await revisar([anuncio("BOE-A-2021-4757", MODIFICA)]);
    expect(r.alertas).toBe(0);

    const cuantas = await tenantDb(academiaA.id).legislationChangeAlert.count();
    expect(cuantas).toBe(1);
  });
});

describe("lo que no es un cambio", () => {
  it("una norma solo citada no abre nada", async () => {
    const r = await revisar([
      anuncio(
        "BOE-A-2026-9999",
        "Resolución por la que se publica el Convenio suscrito de acuerdo con " +
          "lo previsto en la Ley 39/2015, de 1 de octubre.",
      ),
    ]);
    expect(r.alertas).toBe(0);
  });

  it("los anuncios de otra sección ni se miran", async () => {
    // Aunque el título diga «se modifica la Ley 39/2015», si viene de la
    // sección de oposiciones no es una disposición general.
    const convocatoria = { ...anuncio("BOE-A-2026-8888", MODIFICA), section: "2B" };
    const r = await revisar([convocatoria]);
    expect(r.disposiciones).toBe(0);
    expect(r.alertas).toBe(0);
  });
});
