/**
 * Recalcula la firma de una migración ya aplicada.
 *
 *   node --env-file=.env --import tsx scripts/refirmar-migracion.ts <nombre>
 *
 * Prisma guarda el sha256 de cada migración y se niega a seguir si el archivo
 * cambia después de aplicarse. Es una protección correcta: normalmente eso
 * significa que alguien ha editado historia y la base no coincide con el
 * código.
 *
 * Hay un caso en el que sí es legítimo: cuando el cambio NO altera lo que la
 * migración hace sobre una base que ya la tiene aplicada —hacerla idempotente,
 * o que funcione también en la base de sombra—. Entonces la alternativa sería
 * borrar la base de desarrollo entera, y eso no compensa.
 *
 * Úsalo sabiendo eso. Si el cambio sí altera el resultado, lo correcto es una
 * migración nueva.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

// Se conecta como DUEÑO y no con el rol de la aplicación: la tabla de
// migraciones está deliberadamente fuera del alcance del rol con el que corre
// el servidor web, y que este script falle sin él es la prueba de que funciona.
const prismaBase = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: env.DATABASE_URL_OWNER ?? env.DATABASE_URL,
  }),
});

async function main() {
  const nombre = process.argv[2];
  if (!nombre) {
    console.error("Falta el nombre de la migración.");
    process.exit(1);
  }

  const sql = await readFile(`prisma/migrations/${nombre}/migration.sql`);
  const checksum = createHash("sha256").update(sql).digest("hex");

  const antes = await prismaBase.$queryRawUnsafe<{ checksum: string }[]>(
    `SELECT checksum FROM _prisma_migrations WHERE migration_name = $1`,
    nombre,
  );

  if (antes.length === 0) {
    console.error(`La migración ${nombre} no está aplicada.`);
    process.exit(1);
  }

  console.log(`  registrada: ${antes[0].checksum.slice(0, 20)}…`);
  console.log(`  del archivo: ${checksum.slice(0, 20)}…`);

  if (antes[0].checksum === checksum) {
    console.log("  ya coinciden, no hay nada que hacer.");
    return;
  }

  await prismaBase.$executeRawUnsafe(
    `UPDATE _prisma_migrations SET checksum = $1 WHERE migration_name = $2`,
    checksum,
    nombre,
  );
  console.log("  ✓ firma actualizada, sin tocar ningún dato.");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
