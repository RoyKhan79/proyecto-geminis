import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { createAcademyWithRoles } from "@/server/academies/provision";
import { createContentNode } from "@/server/content/tree";
import { recuperarFragmentos } from "@/lib/ai/retrieval";

/**
 * CÓMO BUSCA CATEDRIA IA
 *
 * `ia-ataque.test.ts` comprueba lo que la IA NO puede recuperar. Esto comprueba
 * lo contrario: que **encuentra lo que sí está**, que es la otra mitad y la que
 * nadie mira hasta que un alumno se queja.
 *
 * Las tres cosas que se prueban aquí fallaban antes:
 *
 *   1. Con más de 400 fragmentos indexados se buscaba en un trozo arbitrario
 *      del material. La consulta traía 400 filas a la aplicación y las puntuaba
 *      en JavaScript, así que el fragmento bueno podía no estar entre ellas. No
 *      daba error: la IA decía «no encuentro esa información» sobre algo que sí
 *      estaba, y eso es indistinguible de que el material no lo cubra.
 *   2. «plazos» no encontraba «plazo». La comparación era por palabra exacta,
 *      con un apaño de prefijo de cinco letras que fallaba en cuanto la raíz era
 *      más corta o la palabra cambiaba de forma.
 *   3. «administracion» sin tilde no encontraba «administración», que es como
 *      escribe cualquiera con prisa desde el móvil.
 */

const SUF = `bus${Date.now().toString(36)}`;

/** Cuántos fragmentos de relleno. Por encima del tope de 400 que había. */
const RELLENO = 450;

/**
 * La frase que hay que encontrar. Va con tilde a propósito, y con una palabra
 * en plural que solo aparece en singular en la pregunta.
 */
const AGUJA =
  "La Administración está obligada a dictar resolución expresa dentro del " +
  "plazo máximo de tres meses en los procedimientos de responsabilidad " +
  "patrimonial iniciados de oficio.";

let academia: { id: string };

beforeAll(async () => {
  academia = await createAcademyWithRoles({
    slug: `bus-${SUF}`,
    name: "Busqueda",
  });
  const db = tenantDb(academia.id);

  const oposicion = await db.opposition.create({
    data: { name: "Oposicion", slug: `op-bus-${SUF}` },
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
    label: "Responsabilidad patrimonial",
    status: "PUBLISHED",
  });

  const fuente = await db.knowledgeSource.create({
    data: {
      nodeId: tema.id,
      title: "Tema.pdf",
      status: "INDEXED",
      chunkCount: RELLENO + 1,
    },
  });

  /*
   * El relleno va PRIMERO y la aguja al final, en la posición 450.
   *
   * El orden importa y es el corazón de la prueba: con el tope de 400 y sin
   * ningún criterio de ordenación, la aguja quedaba fuera de las filas que la
   * base devolvía y la búsqueda no la veía nunca.
   *
   * El relleno habla de otra cosa —oposiciones, temario, exámenes— para que no
   * compita por relevancia. Lo que se prueba es que la aguja se encuentre, no
   * que gane a un empate.
   */
  await db.documentChunk.createMany({
    data: [
      ...Array.from({ length: RELLENO }, (_, i) => ({
        sourceId: fuente.id,
        nodeId: tema.id,
        position: i,
        content: `Apuntes de clase numero ${i}. Repaso de esquemas y ejercicios del temario para el examen.`,
        locator: `pagina ${i}`,
      })),
      {
        sourceId: fuente.id,
        nodeId: tema.id,
        position: RELLENO,
        content: AGUJA,
        locator: "pagina final",
      },
    ],
  });
});

afterAll(async () => {
  await prismaBase.academy.deleteMany({ where: { id: academia.id } });
});

/** Busca como personal de la academia, que ve todo el material autorizado. */
function buscar(pregunta: string) {
  return recuperarFragmentos({
    academyId: academia.id,
    membershipId: "no-se-usa-para-personal",
    esPersonal: true,
    pregunta,
  });
}

describe("la búsqueda alcanza a todo el material", () => {
  it("encuentra un fragmento que está más allá del fragmento 400", async () => {
    const r = await buscar("responsabilidad patrimonial iniciada de oficio");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].content).toContain("responsabilidad");
    expect(r[0].locator).toBe("pagina final");
  });
});

describe("la búsqueda entiende español", () => {
  it("«plazos» en plural encuentra «plazo» en singular", async () => {
    const r = await buscar("plazos maximos de resolucion");
    expect(r.some((f) => f.content === AGUJA)).toBe(true);
  });

  it("«resolver» encuentra «resolución»: es la misma raíz", async () => {
    const r = await buscar("cuando tiene que resolver la administracion");
    expect(r.some((f) => f.content === AGUJA)).toBe(true);
  });

  it("sin tildes encuentra lo que sí las lleva", async () => {
    // «Administración» y «máximo» van con tilde en el material.
    const r = await buscar("administracion plazo maximo");
    expect(r.some((f) => f.content === AGUJA)).toBe(true);
  });
});

describe("la búsqueda no inventa", () => {
  it("una pregunta sin nada que ver no devuelve fragmentos", async () => {
    // Importa porque el paso siguiente es el modelo: sin fragmentos, la IA dice
    // que no lo encuentra. Con fragmentos irrelevantes, respondería con ellos.
    const r = await buscar("recetas de cocina mediterranea con pescado azul");
    expect(r).toHaveLength(0);
  });

  it("una pregunta que solo tiene palabras vacías no busca nada", async () => {
    expect(await buscar("de la que y el")).toHaveLength(0);
  });
});
