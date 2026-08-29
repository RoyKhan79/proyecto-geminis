/**
 * ¿Aguanta la segunda barrera bajo concurrencia?
 *
 * La pregunta que hay que responder: si dos academias hacen consultas a la vez
 * y comparten el pool de conexiones, ¿puede una ver los datos de la otra?
 *
 * Es la duda razonable al fijar una variable de sesión por consulta. La
 * variable se fija como local a la transacción, que es justo lo que debería
 * impedirlo, pero eso hay que comprobarlo, no suponerlo.
 */
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";

async function main() {
  const academias = await prismaBase.academy.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (academias.length < 2) {
    console.error("Hacen falta dos academias. Ejecuta antes `npm run rls:probar`.");
    process.exit(1);
  }

  const [a, b] = academias;
  const dbA = tenantDb(a.id);
  const dbB = tenantDb(b.id);

  const esperadoA = await prismaBase.course.count({ where: { academyId: a.id } });
  const esperadoB = await prismaBase.course.count({ where: { academyId: b.id } });

  console.log(`\nCONCURRENCIA · ${academias.length} academias\n${"=".repeat(60)}`);
  console.log(`  ${a.name}: ${esperadoA} cursos`);
  console.log(`  ${b.name}: ${esperadoB} cursos\n`);

  // 200 consultas alternando academia, todas a la vez.
  const VUELTAS = 100;
  const trabajos: Promise<{ quien: string; visto: number }>[] = [];

  for (let i = 0; i < VUELTAS; i += 1) {
    trabajos.push(dbA.course.count().then((n) => ({ quien: "A", visto: n })));
    trabajos.push(dbB.course.count().then((n) => ({ quien: "B", visto: n })));
  }

  const resultados = await Promise.all(trabajos);

  const malA = resultados.filter((r) => r.quien === "A" && r.visto !== esperadoA);
  const malB = resultados.filter((r) => r.quien === "B" && r.visto !== esperadoB);

  console.log(`  ${resultados.length} consultas simultáneas`);
  console.log(
    `  ${malA.length === 0 ? "✓" : "✗"} la academia A siempre vio sus ${esperadoA} cursos${
      malA.length ? ` · ${malA.length} fallos: ${[...new Set(malA.map((m) => m.visto))].join(", ")}` : ""
    }`,
  );
  console.log(
    `  ${malB.length === 0 ? "✓" : "✗"} la academia B siempre vio sus ${esperadoB} cursos${
      malB.length ? ` · ${malB.length} fallos: ${[...new Set(malB.map((m) => m.visto))].join(", ")}` : ""
    }`,
  );

  // Y con consultas distintas mezcladas, que es lo que hace una pantalla real.
  const mezcla = await Promise.all([
    dbA.course.count(),
    dbB.course.count(),
    dbA.membership.count(),
    dbB.membership.count(),
    dbA.course.count(),
    dbB.course.count(),
  ]);
  const okMezcla =
    mezcla[0] === esperadoA && mezcla[1] === esperadoB && mezcla[4] === esperadoA && mezcla[5] === esperadoB;
  console.log(`  ${okMezcla ? "✓" : "✗"} consultas mezcladas en paralelo: ${JSON.stringify(mezcla)}`);

  const fallos = malA.length + malB.length + (okMezcla ? 0 : 1);
  console.log(`\n${"=".repeat(60)}`);
  if (fallos > 0) {
    console.log("✗ La variable de academia se cruza entre conexiones. NO desplegar así.");
    process.exit(1);
  }
  console.log("✓ Ninguna consulta vio datos de otra academia.\n");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
