/**
 * Indexa el material de una academia para que Catedria IA pueda citarlo.
 *
 *   npm run indexar                 # todas las academias
 *   npm run indexar -- academia-demo
 *
 * Lo mismo que el botón «Indexar material» de `/gestion/ia`, pero desde la
 * terminal. Hace falta para dos cosas: dejar la demostración lista sin tener
 * que entrar a pulsar un botón, y poder comprobar la IA en un despliegue recién
 * hecho, donde `npm run ia:fuga` no sirve de nada si no hay nada indexado.
 */
import { prismaBase } from "@/lib/db/client";
import { indexarAcademia } from "@/lib/ai/indexer";

async function main() {
  const slug = process.argv[2];

  const academias = await prismaBase.academy.findMany({
    where: { deletedAt: null, ...(slug ? { slug } : {}) },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  if (academias.length === 0) {
    console.error(
      slug
        ? `✗ No hay ninguna academia con el identificador «${slug}».`
        : "✗ No hay ninguna academia.",
    );
    process.exit(1);
  }

  for (const academia of academias) {
    process.stdout.write(`  · ${academia.name} … `);
    const resultado = await indexarAcademia(academia.id);
    console.log(
      typeof resultado === "object" && resultado !== null
        ? JSON.stringify(resultado)
        : String(resultado),
    );
  }

  const fragmentos = await prismaBase.documentChunk.count();
  console.log(`\n✓ ${fragmentos} fragmentos en total.`);
}

main()
  .catch((error) => {
    console.error("✗ La indexación ha fallado:", error);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
