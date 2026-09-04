/**
 * Normativa de demostración: las dos leyes que toda academia de Administración
 * General da en clase, con sus artículos más preguntados, enlazadas al temario
 * y a las preguntas del banco.
 *
 *   npm run demo:normativa
 */
import { prismaBase } from "../src/lib/db/client";
import { tenantDb } from "../src/lib/db/tenant";

const NORMAS = [
  {
    reference: "Ley 39/2015",
    title:
      "del Procedimiento Administrativo Común de las Administraciones Públicas",
    officialId: "BOE-A-2015-10565",
    officialUrl: "https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565",
    articulos: [
      { number: "21", title: "Obligación de resolver", claves: ["tres meses", "plazo", "resolver"] },
      { number: "24", title: "Silencio administrativo", claves: ["silencio"] },
      { number: "30", title: "Cómputo de plazos", claves: ["dias habiles", "plazos"] },
      { number: "40", title: "Notificación", claves: ["notificacion"] },
      { number: "47", title: "Nulidad de pleno derecho", claves: ["nulos de pleno derecho", "nulidad"] },
      { number: "121", title: "Recurso de alzada", claves: ["alzada"] },
      { number: "124", title: "Recurso potestativo de reposición", claves: ["reposicion"] },
    ],
  },
  {
    reference: "Real Decreto Legislativo 5/2015",
    title: "texto refundido del Estatuto Básico del Empleado Público",
    officialId: "BOE-A-2015-11719",
    officialUrl: "https://www.boe.es/buscar/act.php?id=BOE-A-2015-11719",
    articulos: [
      { number: "14", title: "Derechos individuales", claves: ["derecho individual", "empleado publico"] },
      { number: "89", title: "Excedencia", claves: ["excedencia"] },
    ],
  },
];

const normaliza = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function main() {
  const academia = await prismaBase.academy.findUnique({
    where: { slug: "catedria-demo" },
    select: { id: true },
  });
  if (!academia) {
    console.error("✗ No existe la academia demo.");
    process.exit(1);
  }
  const db = tenantDb(academia.id);

  const preguntas = await db.question.findMany({
    where: { deletedAt: null },
    select: { id: true, statement: true, explanation: true, nodeId: true },
  });

  let enlaces = 0;

  for (const norma of NORMAS) {
    const existente = await db.legislation.findFirst({
      where: { reference: norma.reference },
      select: { id: true },
    });

    const creada =
      existente ??
      (await db.legislation.create({
        data: {
          reference: norma.reference,
          title: norma.title,
          scope: "STATE",
          status: "IN_FORCE",
          officialId: norma.officialId,
          officialUrl: norma.officialUrl,
        },
      }));

    for (const articulo of norma.articulos) {
      const yaEsta = await db.legislationArticle.findFirst({
        where: { legislationId: creada.id, number: articulo.number },
        select: { id: true },
      });

      const art =
        yaEsta ??
        (await db.legislationArticle.create({
          data: {
            legislationId: creada.id,
            number: articulo.number,
            title: articulo.title,
          },
        }));

      // Enlace con las preguntas cuyo texto menciona el concepto del artículo.
      for (const pregunta of preguntas) {
        const texto = normaliza(`${pregunta.statement} ${pregunta.explanation ?? ""}`);

        // Se acepta cualquiera de las dos formas de citar que se usan en clase:
        // «Ley 39/2015 … silencio» o directamente «artículo 24».
        const citaArticulo = new RegExp(
          `articulo\\s+${articulo.number.replace(".", "\\.")}(\\D|$)`,
        ).test(texto);
        const citaNorma =
          texto.includes(normaliza(norma.reference)) &&
          articulo.claves.some((c) => texto.includes(normaliza(c)));

        if (!citaArticulo && !citaNorma) continue;

        const existeEnlace = await db.contentLegislationLink.findFirst({
          where: { articleId: art.id, questionId: pregunta.id },
          select: { id: true },
        });
        if (existeEnlace) continue;

        await db.contentLegislationLink.create({
          data: {
            articleId: art.id,
            questionId: pregunta.id,
            origin: "MANUAL",
            excerpt: pregunta.statement.slice(0, 200),
          },
        });
        enlaces += 1;

        // Y con el tema al que pertenece la pregunta.
        if (pregunta.nodeId) {
          const existeTema = await db.contentLegislationLink.findFirst({
            where: { articleId: art.id, nodeId: pregunta.nodeId },
            select: { id: true },
          });
          if (!existeTema) {
            await db.contentLegislationLink.create({
              data: { articleId: art.id, nodeId: pregunta.nodeId, origin: "MANUAL" },
            });
            enlaces += 1;
          }
        }
      }
    }
  }

  const totales = await db.contentLegislationLink.count();
  console.log(`✓ Normativa cargada · ${enlaces} enlaces nuevos · ${totales} en total`);
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
