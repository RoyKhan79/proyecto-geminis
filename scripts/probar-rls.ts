/**
 * ¿Sirve de algo la segunda barrera?
 *
 *   npm run rls:probar
 *
 * Comprueba lo único que importa de Row Level Security: que **si la guardia de
 * aplicación fallara**, PostgreSQL seguiría tapando. Para eso usa `$queryRaw`,
 * que no pasa por la guardia: es exactamente el agujero que RLS existe para
 * cerrar.
 *
 * Crea una segunda academia de prueba con un curso dentro, y después intenta
 * leerlo, escribir en ella y borrarla desde la academia demo.
 */
import { prismaBase } from "@/lib/db/client";
import { env } from "@/lib/env";

async function prepararSegundaAcademia() {
  const existente = await prismaBase.academy.findFirst({
    where: { slug: "rls-prueba" },
    select: { id: true },
  });

  const academia =
    existente ??
    (await prismaBase.academy.create({
      data: { slug: "rls-prueba", name: "Academia RLS Prueba" },
      select: { id: true },
    }));

  const tipo =
    (await prismaBase.oppositionType.findFirst({
      where: { academyId: academia.id },
      select: { id: true },
    })) ??
    (await prismaBase.oppositionType.create({
      data: { academyId: academia.id, key: "general-b", name: "General B" },
      select: { id: true },
    }));

  const oposicion =
    (await prismaBase.opposition.findFirst({
      where: { academyId: academia.id },
      select: { id: true },
    })) ??
    (await prismaBase.opposition.create({
      data: {
        academyId: academia.id,
        name: "Oposición B",
        slug: "op-b",
        typeId: tipo.id,
      },
      select: { id: true },
    }));

  const convocatoria =
    (await prismaBase.oppositionEdition.findFirst({
      where: { academyId: academia.id },
      select: { id: true },
    })) ??
    (await prismaBase.oppositionEdition.create({
      data: {
        academyId: academia.id,
        oppositionId: oposicion.id,
        name: "Convocatoria B",
      },
      select: { id: true },
    }));

  const curso =
    (await prismaBase.course.findFirst({
      where: { academyId: academia.id },
      select: { id: true, name: true },
    })) ??
    (await prismaBase.course.create({
      data: {
        academyId: academia.id,
        name: "Curso secreto de B",
        oppositionEditionId: convocatoria.id,
      },
      select: { id: true, name: true },
    }));

  return { academia, convocatoria, curso };
}

/** Ejecuta algo con la variable de academia puesta, como hace la guardia. */
function comoLaAcademia<T>(
  academyId: string,
  fn: (tx: Parameters<Parameters<typeof prismaBase.$transaction>[0]>[0]) => Promise<T>,
): Promise<T> {
  return prismaBase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('catedria.academy_id', ${academyId}, true)`;
    return fn(tx);
  });
}

async function main() {
  console.log(`\nSEGUNDA BARRERA · Row Level Security\n${"=".repeat(60)}`);
  console.log(`DB_RLS = ${env.DB_RLS}\n`);

  const politicas = await prismaBase.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = current_schema()`;
  const forzadas = await prismaBase.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM pg_class
    WHERE relrowsecurity AND relforcerowsecurity AND relnamespace = 'public'::regnamespace`;

  console.log(`Políticas activas: ${politicas[0].n} · tablas con FORCE: ${forzadas[0].n}`);

  const a = await prismaBase.academy.findFirst({
    where: { slug: "catedria-demo" },
    select: { id: true, name: true },
  });
  if (!a) throw new Error("No existe la academia demo. Ejecuta `npm run db:seed`.");

  const b = await prepararSegundaAcademia();

  const totales = await prismaBase.course.count();
  console.log(`Cursos en toda la base de datos: ${totales}\n`);

  let fallos = 0;
  const comprobar = (titulo: string, ok: boolean, detalle: string) => {
    console.log(`  ${ok ? "✓" : "✗"} ${titulo} · ${detalle}`);
    if (!ok) fallos += 1;
  };

  // A · Sin variable, una consulta cruda lo ve todo. Es el punto de partida:
  //     así de expuesto estaría el sistema si solo hubiera una barrera.
  const sinVariable = await prismaBase.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM courses`,
  );
  console.log(
    `  · punto de partida: una consulta cruda sin variable ve ${sinVariable[0].n} cursos`,
  );

  // B · Con la variable de A, la misma consulta cruda solo ve lo de A.
  const conVariable = await comoLaAcademia(a.id, (tx) =>
    tx.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM courses`),
  );
  const cursosDeA = await prismaBase.course.count({ where: { academyId: a.id } });
  comprobar(
    "una consulta cruda solo ve los cursos de su academia",
    conVariable[0].n === cursosDeA && conVariable[0].n < sinVariable[0].n,
    `ve ${conVariable[0].n} de ${sinVariable[0].n}`,
  );

  // C · Pedir por id el curso de la otra academia no devuelve nada.
  const fuga = await comoLaAcademia(a.id, (tx) =>
    tx.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM courses WHERE id = $1`,
      b.curso.id,
    ),
  );
  comprobar(
    "pedir por id el curso de la otra academia no devuelve nada",
    fuga.length === 0,
    fuga.length === 0 ? "bloqueado" : `FUGA: «${fuga[0].name}»`,
  );

  // D · Escribir una fila marcada como de la otra academia se rechaza.
  let escrituraBloqueada = true;
  try {
    await comoLaAcademia(a.id, (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO courses (id, "academyId", "oppositionEditionId", name, "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, now(), now())`,
        b.academia.id,
        b.convocatoria.id,
        "Curso colado",
      ),
    );
    escrituraBloqueada = false;
  } catch {
    // La cláusula WITH CHECK de la política lo rechaza.
  }
  comprobar(
    "no se puede escribir una fila marcada como de otra academia",
    escrituraBloqueada,
    escrituraBloqueada ? "rechazado por la política" : "FUGA: se ha escrito",
  );

  // E · Borrar lo de la otra academia no borra nada.
  const antes = await prismaBase.course.count({ where: { academyId: b.academia.id } });
  await comoLaAcademia(a.id, (tx) =>
    tx.$executeRawUnsafe(`DELETE FROM courses WHERE "academyId" = $1`, b.academia.id),
  );
  const despues = await prismaBase.course.count({ where: { academyId: b.academia.id } });
  comprobar(
    "un borrado masivo no alcanza a la otra academia",
    despues === antes,
    `la otra academia conserva sus ${despues} cursos`,
  );

  // F · La variable no se queda pegada a la conexión del pool.
  const tras = await prismaBase.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM courses`,
  );
  comprobar(
    "la variable no se queda pegada a la conexión",
    tras[0].n === sinVariable[0].n,
    `después vuelve a ver ${tras[0].n}`,
  );

  console.log(`\n${"=".repeat(60)}`);
  if (fallos > 0) {
    console.log(`✗ ${fallos} comprobaciones han fallado. La segunda barrera NO protege.`);
    process.exit(1);
  }
  console.log("✓ La segunda barrera protege aunque la guardia de aplicación falle.\n");
}

main()
  .catch((error) => {
    console.error("✗", error);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
