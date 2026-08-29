/**
 * COPIAS DE SEGURIDAD
 *
 *   npm run copia            · copia completa de la base
 *   npm run copia -- --academia geminis-demo   · solo una academia
 *   npm run copia:restaurar -- <archivo>       · restaura en una base de pruebas
 *
 * Dos tipos de copia, porque resuelven dos miedos distintos:
 *
 *   · **Completa** (`pg_dump`). Es la que salva de un desastre: disco muerto,
 *     borrado accidental, migración que sale mal. Restaura la base entera.
 *   · **Por academia** (JSON). Es la que salva de un error humano acotado:
 *     alguien borra una convocatoria con todo dentro y hay que devolver SOLO lo
 *     de esa academia sin tocar a las demás. Con una copia completa eso no se
 *     puede hacer: restaurarla se llevaría por delante el trabajo de todos los
 *     demás desde la copia.
 *
 * Lo que NO hace esto: programarse solo. Va en cron, y el comando está en
 * docs/SECURITY_MODEL.md. Y una advertencia que no es retórica: **una copia que
 * no se ha restaurado nunca no es una copia**. Por eso existe `copia:restaurar`
 * y por eso conviene ejecutarlo de vez en cuando.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prismaBase } from "@/lib/db/client";
import { env } from "@/lib/env";

const CARPETA = process.env.BACKUP_DIR ?? ".dev/copias";

/** Marca de tiempo legible y ordenable: 2026-08-11-2214. */
function marca(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Ejecuta un comando y devuelve su salida. */
function ejecutar(comando: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proceso = spawn(comando, args, { env: process.env });
    let salida = "";
    let error = "";
    proceso.stdout.on("data", (d) => (salida += d));
    proceso.stderr.on("data", (d) => (error += d));
    proceso.on("error", reject);
    proceso.on("close", (codigo) =>
      codigo === 0 ? resolve(salida) : reject(new Error(error || `código ${codigo}`)),
    );
  });
}

/**
 * Copia completa con `pg_dump`.
 *
 * Se usa la conexión del DUEÑO: el rol de la aplicación no puede leerlo todo, y
 * eso es a propósito. Una copia hecha con el rol restringido saldría incompleta
 * y nadie se daría cuenta hasta el día que hiciera falta.
 */
async function copiaCompleta() {
  const url = env.DATABASE_URL_OWNER ?? env.DATABASE_URL;
  const destino = path.join(CARPETA, `geminis-${marca()}.sql`);

  await mkdir(CARPETA, { recursive: true });

  const binario = process.env.PG_DUMP ?? "pg_dump";

  try {
    const volcado = await ejecutar(binario, [
      url,
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
    ]);

    await writeFile(destino, volcado, "utf8");
    console.log(`  ✓ Copia completa (pg_dump): ${destino}`);
    console.log(`    ${(volcado.length / 1024 / 1024).toFixed(2)} MB`);
    return destino;
  } catch {
    // `pg_dump` no está: se hace una copia completa igualmente, leyendo las
    // tablas. Es más lenta y ocupa más, pero una copia que solo funciona si
    // alguien instaló el cliente de PostgreSQL no es una copia: es un deseo.
    console.log(
      `  · «${binario}» no está disponible; se hace la copia completa leyendo las tablas.`,
    );
    return copiaCompletaSinPgDump();
  }
}

/**
 * Copia completa sin `pg_dump`, tabla a tabla.
 *
 * Se guarda en el orden en que aparecen las tablas, y al restaurar hay que
 * respetar las claves foráneas. No sustituye a `pg_dump` para un desastre
 * grande —para eso, instala el cliente de PostgreSQL—, pero sirve para no
 * quedarse sin nada.
 */
async function copiaCompletaSinPgDump() {
  const destino = path.join(CARPETA, `geminis-completa-${marca()}.json`);
  await mkdir(CARPETA, { recursive: true });

  const tablas = await prismaBase.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'
    ORDER BY tablename`;

  const datos: Record<string, unknown[]> = {};
  let filas = 0;

  for (const { tablename } of tablas) {
    const contenido = await prismaBase.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${tablename}"`,
    );
    datos[tablename] = contenido;
    filas += contenido.length;
  }

  const contenido = JSON.stringify(
    {
      version: 1,
      tipo: "completa",
      generada: new Date().toISOString(),
      tablas: tablas.length,
      filas,
      datos,
    },
    (_clave, valor) => (typeof valor === "bigint" ? valor.toString() : valor),
    2,
  );

  await writeFile(destino, contenido, "utf8");
  console.log(`  ✓ Copia completa: ${destino}`);
  console.log(
    `    ${tablas.length} tablas · ${filas} filas · ${(contenido.length / 1024 / 1024).toFixed(2)} MB`,
  );

  return destino;
}

/**
 * Copia de UNA academia, en JSON.
 *
 * Recorre las tablas de academia leyendo por `academyId`. No usa `pg_dump`
 * porque `pg_dump` no sabe filtrar por academia, y eso es justo lo que aquí
 * hace falta.
 */
async function copiaDeAcademia(slug: string) {
  const academia = await prismaBase.academy.findFirst({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });

  if (!academia) {
    console.error(`  ✗ No existe ninguna academia con el identificador «${slug}».`);
    return null;
  }

  await mkdir(CARPETA, { recursive: true });

  // Se leen directamente de PostgreSQL las tablas que tienen academyId. Así, si
  // mañana se añade una tabla nueva, entra sola en la copia: una copia que hay
  // que acordarse de actualizar es una copia que un día sale incompleta.
  const tablas = await prismaBase.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND column_name = 'academyId'
    ORDER BY table_name`;

  const datos: Record<string, unknown[]> = {};
  let filas = 0;

  for (const { table_name } of tablas) {
    const contenido = await prismaBase.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${table_name}" WHERE "academyId" = $1`,
      academia.id,
    );
    datos[table_name] = contenido;
    filas += contenido.length;
  }

  // La propia fila de la academia, que no tiene academyId.
  datos.academies = await prismaBase.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM academies WHERE id = $1`,
    academia.id,
  );

  // Y las personas que pertenecen a ella. Sin esto, la copia tendría las
  // matrículas pero no a quién pertenecen.
  datos.users = await prismaBase.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT u.* FROM users u
     WHERE EXISTS (SELECT 1 FROM memberships m WHERE m."userId" = u.id AND m."academyId" = $1)`,
    academia.id,
  );

  const destino = path.join(CARPETA, `${academia.slug}-${marca()}.json`);

  const contenido = JSON.stringify(
    {
      version: 1,
      academia: { id: academia.id, slug: academia.slug, nombre: academia.name },
      generada: new Date().toISOString(),
      tablas: Object.keys(datos).length,
      filas,
      datos,
    },
    // Los BigInt y las fechas no son JSON por sí solos.
    (_clave, valor) =>
      typeof valor === "bigint" ? valor.toString() : valor,
    2,
  );

  await writeFile(destino, contenido, "utf8");

  console.log(`  ✓ Copia de «${academia.name}»: ${destino}`);
  console.log(
    `    ${Object.keys(datos).length} tablas · ${filas} filas · ${(contenido.length / 1024).toFixed(0)} KB`,
  );
  console.log(
    "    Incluye los datos bancarios CIFRADOS: sin FIELD_ENCRYPTION_KEY no se pueden leer.",
  );

  return destino;
}

async function main() {
  const args = process.argv.slice(2);
  const indice = args.indexOf("--academia");
  const slug = indice >= 0 ? args[indice + 1] : null;

  console.log(`\nCOPIA DE SEGURIDAD\n${"=".repeat(60)}`);

  if (slug) {
    await copiaDeAcademia(slug);
  } else {
    await copiaCompleta();

    // Además, una copia por academia: son pequeñas y son las que de verdad se
    // acaban usando cuando alguien borra algo sin querer.
    const academias = await prismaBase.academy.findMany({
      select: { slug: true },
      where: { deletedAt: null },
    });
    for (const academia of academias) {
      await copiaDeAcademia(academia.slug);
    }
  }

  console.log("");
  console.log("  Recuerda: una copia que no se ha restaurado nunca no es una copia.");
  console.log("  Pruébala con `npm run copia:restaurar -- <archivo>`.\n");
}

main()
  .catch((error) => {
    console.error("✗", error);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
