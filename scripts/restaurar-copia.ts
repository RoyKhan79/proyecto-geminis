/**
 * Comprueba que una copia se puede restaurar.
 *
 *   npm run copia:restaurar -- .dev/copias/geminis-demo-2026-08-11-2214.json
 *
 * NO escribe en la base de datos. Lee el archivo, comprueba que está completo y
 * que se entiende, y dice qué se recuperaría. Es la comprobación que convierte
 * un archivo en una copia de seguridad de verdad.
 *
 * Se hace así, sin restaurar, porque restaurar de verdad sobre la base buena es
 * exactamente lo que no hay que hacer para probar una copia. Para una prueba
 * completa, se levanta una base vacía y se aplica el `.sql` con `psql`.
 */
import { readFile } from "node:fs/promises";
import { prismaBase } from "@/lib/db/client";
import { descifrar, estaCifrado } from "@/lib/crypto/field";

type Copia = {
  version: number;
  academia: { id: string; slug: string; nombre: string };
  generada: string;
  tablas: number;
  filas: number;
  datos: Record<string, Record<string, unknown>[]>;
};

async function main() {
  const archivo = process.argv[2];
  if (!archivo) {
    console.error("Uso: npm run copia:restaurar -- <archivo.json>");
    process.exit(1);
  }

  console.log(`\nCOMPROBACIÓN DE UNA COPIA\n${"=".repeat(60)}`);

  let copia: Copia;
  try {
    copia = JSON.parse(await readFile(archivo, "utf8")) as Copia;
  } catch (error) {
    console.error(`✗ No se puede leer el archivo: ${(error as Error).message}`);
    process.exit(1);
  }

  let fallos = 0;
  const comprobar = (t: string, ok: boolean, detalle = "") => {
    console.log(`  ${ok ? "✓" : "✗"} ${t}${detalle ? ` · ${detalle}` : ""}`);
    if (!ok) fallos += 1;
  };

  console.log(`  Academia: ${copia.academia?.nombre ?? "?"}`);
  console.log(`  Generada: ${copia.generada ?? "?"}\n`);

  comprobar("el archivo tiene una versión reconocible", copia.version === 1);
  comprobar("dice de qué academia es", Boolean(copia.academia?.id));

  const tablasConDatos = Object.entries(copia.datos ?? {}).filter(
    ([, filas]) => filas.length > 0,
  );
  comprobar(
    "contiene datos",
    tablasConDatos.length > 0,
    `${tablasConDatos.length} tablas con filas`,
  );

  // Todo lo que hay dentro tiene que ser de esa academia. Si se colara una fila
  // de otra, restaurarla mezclaría datos de dos academias, que es el peor fallo
  // posible en este producto.
  let ajenas = 0;
  for (const [tabla, filas] of Object.entries(copia.datos ?? {})) {
    if (tabla === "academies" || tabla === "users") continue;
    for (const fila of filas) {
      if (fila.academyId && fila.academyId !== copia.academia.id) ajenas += 1;
    }
  }
  comprobar(
    "no hay ni una fila de otra academia",
    ajenas === 0,
    ajenas > 0 ? `${ajenas} filas ajenas` : "",
  );

  // Los datos bancarios tienen que estar cifrados también dentro de la copia:
  // es justo el escenario del que protege el cifrado.
  const perfiles = copia.datos?.billing_profiles ?? [];
  const conIban = perfiles.filter((p) => p.iban);
  if (conIban.length > 0) {
    const todosCifrados = conIban.every((p) => estaCifrado(String(p.iban)));
    comprobar(
      "los datos bancarios están cifrados dentro de la copia",
      todosCifrados,
      `${conIban.length} con IBAN`,
    );

    const legibles = conIban.filter((p) => descifrar(String(p.iban)) !== null);
    comprobar(
      "y se pueden descifrar con la clave actual",
      legibles.length === conIban.length,
      `${legibles.length} de ${conIban.length}`,
    );
  } else {
    console.log("  · No hay datos bancarios en esta copia");
  }

  // Comparación con lo que hay ahora, para ver qué se recuperaría.
  const enBase = await prismaBase.academy.findFirst({
    where: { id: copia.academia?.id },
    select: { name: true },
  });

  console.log("");
  console.log(
    enBase
      ? `  La academia sigue existiendo («${enBase.name}»): esta copia serviría para devolver datos borrados.`
      : "  La academia YA NO existe: esta copia es lo único que queda de ella.",
  );

  console.log("\n  Qué se recuperaría:");
  for (const [tabla, filas] of tablasConDatos
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)) {
    console.log(`    ${String(filas.length).padStart(6)} · ${tabla}`);
  }
  if (tablasConDatos.length > 12) {
    console.log(`    …y ${tablasConDatos.length - 12} tablas más`);
  }

  console.log(`\n${"=".repeat(60)}`);
  if (fallos > 0) {
    console.log(`✗ ${fallos} comprobaciones han fallado: esta copia NO es fiable.`);
    process.exit(1);
  }
  console.log("✓ La copia está completa y se entiende.\n");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
