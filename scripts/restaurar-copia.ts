/**
 * Comprueba que una copia se puede restaurar.
 *
 *   npm run copia:restaurar -- <archivo>            · lee y comprueba, sin escribir
 *   npm run copia:probar    -- <archivo>            · la restaura de verdad y la tira
 *   npm run copia:restaurar -- <archivo> --en <url> · la restaura donde le digas
 *
 * ── POR QUÉ HAY DOS MODOS ──────────────────────────────────────────────────
 *
 * Leer el archivo y ver que se entiende está bien, pero **no es probar una
 * copia**. Un JSON perfectamente legible puede ser irrestaurable: claves
 * foráneas que no cuadran, filas que ya no caben en su tabla, enumerados que
 * dejaron de existir. Eso solo se descubre metiéndola en una base de datos, y
 * si no se descubre hoy se descubre el día que hace falta.
 *
 * Este script se llamaba «restaurar» y no restauraba, y el requisito de
 * despliegue «restauración probada» se daba por cumplido ejecutándolo. Era una
 * comprobación que decía que sí sin haber comprobado lo que dice su nombre.
 *
 * `--probar` crea una base desechable, aplica las migraciones, mete la copia,
 * comprueba que las claves foráneas vuelven a poder crearse —que es lo que
 * demuestra que los datos son coherentes— y borra la base. No toca nada más.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { prismaBase } from "@/lib/db/client";
import { descifrar, estaCifrado } from "@/lib/crypto/field";
import { motivoParaNoRestaurar } from "@/lib/db/destino-de-restauracion";
import { restaurarCopia, type Copia } from "@/lib/db/restaurar";


/** Lee el archivo de copia y aborta con un mensaje claro si no se puede. */
async function leerCopia(archivo: string): Promise<Copia> {
  try {
    return JSON.parse(await readFile(archivo, "utf8")) as Copia;
  } catch (error) {
    console.error(`✗ No se puede leer el archivo: ${(error as Error).message}`);
    process.exit(1);
  }
}

/** Cambia el nombre de la base en una dirección, dejando el resto igual. */
function conBase(cadena: string, base: string): string {
  const url = new URL(cadena);
  url.pathname = `/${base}`;
  return url.toString();
}

/**
 * Lanza el CLI de Prisma heredando el entorno más lo que se le añada.
 *
 * Se invoca el `index.js` de Prisma con el propio Node en vez de `npx`. Con
 * `npx` hay que elegir entre dos cosas malas en Windows: `shell: true`, que
 * concatena los argumentos sin escapar —Node avisa de que es una vía de
 * inyección—, o llamar al `.cmd`, que desde Node 20 falla con EINVAL. Llamar al
 * script directamente evita las dos y además es más rápido.
 */
function ejecutarPrisma(
  args: string[],
  extra: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cli = require.resolve("prisma/build/index.js");
    const proceso = spawn(process.execPath, [cli, ...args], {
      env: { ...process.env, ...extra },
      stdio: "pipe",
    });
    let error = "";
    proceso.stderr.on("data", (d) => (error += d));
    proceso.on("error", reject);
    proceso.on("close", (codigo) =>
      codigo === 0 ? resolve() : reject(new Error(error.trim() || `código ${codigo}`)),
    );
  });
}

/**
 * Restaura la copia de verdad y dice si ha entrado entera.
 *
 * @param copia El contenido del archivo.
 * @param destino Dónde escribir. Ya validado por `motivoParaNoRestaurar`.
 * @param migrar Si hay que aplicar las migraciones antes (base recién creada).
 * @returns `true` si la copia entró entera y las claves foráneas volvieron.
 */
async function restaurarYComprobar(
  copia: Copia,
  destino: string,
  migrar: boolean,
): Promise<boolean> {
  if (migrar) {
    console.log("  · Aplicando las migraciones…");
    // Prisma migra con DATABASE_URL_OWNER (ver prisma.config.ts). Se le pasa la
    // base desechable solo a este proceso hijo: el .env no se toca.
    await ejecutarPrisma(["migrate", "deploy"], {
      DATABASE_URL_OWNER: destino,
      DATABASE_URL: destino,
    });
  }

  const db = new Client({ connectionString: destino });
  await db.connect();
  try {
    console.log("  · Metiendo la copia…");
    const r = await restaurarCopia(db, copia);

    const conError = r.tablas.filter((t) => t.error);
    const incompletas = r.tablas.filter(
      (t) => !t.error && t.restauradas !== t.enLaCopia,
    );

    console.log("");
    console.log(`  Filas:  ${r.filasRestauradas} de ${r.filasEsperadas}`);
    console.log(
      `  Claves foráneas: ${r.clavesRepuestas} de ${r.clavesRetiradas} vuelven a crearse`,
    );

    for (const t of conError) console.log(`  ✗ ${t.tabla}: ${t.error}`);
    for (const t of incompletas) {
      console.log(`  ✗ ${t.tabla}: entraron ${t.restauradas} de ${t.enLaCopia}`);
    }
    for (const c of r.clavesRotas) {
      console.log(`  ✗ ${c.tabla} · ${c.nombre}: ${c.error}`);
    }

    const bien =
      conError.length === 0 &&
      incompletas.length === 0 &&
      r.clavesRotas.length === 0 &&
      r.filasRestauradas === r.filasEsperadas;

    console.log("");
    console.log(
      bien
        ? "  ✓ La copia se restaura entera y los datos son coherentes."
        : "  ✗ La copia NO se restaura entera.",
    );
    return bien;
  } finally {
    await db.end();
  }
}

/**
 * Crea una base desechable, restaura dentro y la borra pase lo que pase.
 *
 * El borrado va en `finally` a propósito: una base huérfana con datos reales
 * dentro es exactamente lo que no queremos dejar por ahí si esto falla a mitad.
 */
async function probarEnBaseDesechable(
  copia: Copia,
): Promise<boolean> {
  const base = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL;
  if (!base) {
    console.error("✗ Falta DATABASE_URL_OWNER para saber en qué servidor crearla.");
    return false;
  }

  const nombre = `catedria_restauracion_${Date.now()}`;
  const destino = conBase(base, nombre);

  const rechazo = motivoParaNoRestaurar(destino, {
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_OWNER: process.env.DATABASE_URL_OWNER,
  });
  if (rechazo) {
    console.error(`✗ ${rechazo.motivo}`);
    console.error(`  ${rechazo.salida}`);
    return false;
  }

  // Para crear y borrar bases hay que estar conectado a otra distinta.
  const admin = new Client({ connectionString: conBase(base, "postgres") });
  await admin.connect();

  console.log(`
  Base desechable: ${nombre}`);
  await admin.query(`CREATE DATABASE "${nombre}"`);

  try {
    return await restaurarYComprobar(copia, destino, true);
  } finally {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
      [nombre],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${nombre}"`);
    await admin.end();
    console.log(`  · Base desechable borrada.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const archivo = args.find((a) => !a.startsWith("--"));
  const indiceEn = args.indexOf("--en");
  const siguienteAEn = indiceEn >= 0 ? args[indiceEn + 1] : undefined;
  const restaurarEn =
    siguienteAEn && !siguienteAEn.startsWith("--") ? siguienteAEn : null;
  const probar = args.includes("--probar");

  if (!archivo) {
    console.error(
      "Uso: npm run copia:restaurar -- <archivo.json> [--probar | --en <url>]",
    );
    process.exit(1);
  }

  console.log(`\nCOMPROBACIÓN DE UNA COPIA\n${"=".repeat(60)}`);

  const copia = await leerCopia(archivo);

  let fallos = 0;
  const comprobar = (t: string, ok: boolean, detalle = "") => {
    console.log(`  ${ok ? "✓" : "✗"} ${t}${detalle ? ` · ${detalle}` : ""}`);
    if (!ok) fallos += 1;
  };

  /*
   * Hay dos clases de copia y no se comprueban igual.
   *
   * La de una academia tiene que ser de UNA sola, y eso se verifica fila a
   * fila. La completa contiene a todas por definición, y exigirle lo mismo
   * sería inventarse un fallo. Antes esto no se distinguía: pasarle una copia
   * completa daba dos comprobaciones en rojo por un motivo falso.
   */
  const esCompleta = copia.tipo === "completa" || !copia.academia;

  console.log(
    esCompleta
      ? "  Copia completa: todas las academias"
      : `  Academia: ${copia.academia?.nombre ?? "?"}`,
  );
  console.log(`  Generada: ${copia.generada ?? "?"}\n`);

  comprobar("el archivo tiene una versión reconocible", copia.version === 1);
  if (!esCompleta) {
    comprobar("dice de qué academia es", Boolean(copia.academia?.id));
  }

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
  if (!esCompleta) {
    let ajenas = 0;
    for (const [tabla, filas] of Object.entries(copia.datos ?? {})) {
      if (tabla === "academies" || tabla === "users") continue;
      for (const fila of filas) {
        if (fila.academyId && fila.academyId !== copia.academia!.id) ajenas += 1;
      }
    }
    comprobar(
      "no hay ni una fila de otra academia",
      ajenas === 0,
      ajenas > 0 ? `${ajenas} filas ajenas` : "",
    );
  }

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
  if (!esCompleta) {
    const enBase = await prismaBase.academy.findFirst({
      where: { id: copia.academia!.id },
      select: { name: true },
    });

    console.log("");
    console.log(
      enBase
        ? `  La academia sigue existiendo («${enBase.name}»): esta copia serviría para devolver datos borrados.`
        : "  La academia YA NO existe: esta copia es lo único que queda de ella.",
    );
  }

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
  console.log("✓ La copia está completa y se entiende.");

  // Hasta aquí solo se ha leído el archivo. Lo que sigue es lo que de verdad
  // demuestra que la copia sirve.
  if (!probar && !restaurarEn) {
    console.log(
      "\n  Esto NO ha restaurado nada. Para probarla de verdad:\n" +
        `    npm run copia:probar -- ${archivo}\n`,
    );
    return;
  }

  console.log(`\nRESTAURACIÓN DE VERDAD\n${"=".repeat(60)}`);

  let bien: boolean;
  if (probar) {
    bien = await probarEnBaseDesechable(copia);
  } else {
    const rechazo = motivoParaNoRestaurar(restaurarEn, {
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_URL_OWNER: process.env.DATABASE_URL_OWNER,
    });
    if (rechazo) {
      console.error(`\n✗ No se restaura ahí: ${rechazo.motivo}`);
      console.error(`  ${rechazo.salida}\n`);
      process.exit(1);
    }
    bien = await restaurarYComprobar(copia, restaurarEn!, false);
  }

  console.log("");
  if (!bien) process.exit(1);
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
