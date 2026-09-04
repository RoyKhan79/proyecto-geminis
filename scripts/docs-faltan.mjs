/**
 * QUÉ QUEDA SIN DOCUMENTAR
 *
 *   npm run docs:faltan
 *
 * TypeDoc avisa de todo lo que no lleva comentario, y eso incluye cada
 * propiedad de cada tipo inferido: el `where` que devuelve una función, la
 * forma de un objeto de configuración… Son mil cuatrocientos avisos de cosas
 * que nadie escribió a mano y que no se documentan, solo se leen.
 *
 * Esto los separa. Arriba lo que de verdad hay que documentar —funciones,
 * componentes, tipos exportados y constantes— y abajo el recuento del ruido,
 * para que quede claro que no se está escondiendo.
 *
 * Un informe que mezcla las dos cosas no se mira, y entonces no sirve.
 */
import { spawnSync } from "node:child_process";

/** Lo que no se documenta a mano: propiedades de tipos que infiere el compilador. */
const RUIDO = new Set(["Property"]);

/**
 * Exportaciones que lee el framework, no personas.
 *
 * `metadata`, `viewport` y compañía son convenciones de Next.js: se declaran
 * para que el framework las recoja y no forman parte de la API de nadie.
 * Escribir sesenta y cinco comentarios que digan «el título de la pestaña»
 * llenaría la referencia de ruido y no ayudaría a nadie a entender el sistema.
 * Se cuentan aparte para que quede dicho que no se están escondiendo.
 */
const CONVENCION = new Set([
  "metadata",
  "viewport",
  "dynamic",
  "revalidate",
  "runtime",
  "generateMetadata",
  "generateStaticParams",
]);

const salida = spawnSync(
  "node",
  ["node_modules/typedoc/bin/typedoc", "--emit", "none", "--logLevel", "Warn"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const texto = (salida.stdout ?? "") + (salida.stderr ?? "");

// Se quitan los códigos de color de la terminal antes de leer nada.
const lineas = texto
  .replace(/\[[0-9;]*m/g, "")
  .split("\n")
  .filter((l) => l.includes("does not have any documentation"));

const pendientes = [];
let ruido = 0;
let convencion = 0;

for (const linea of lineas) {
  const m = /\[warning\]\s*(\S+)\s+\((\w+)\),\s*defined in (.+?),/.exec(linea.trim());
  if (!m) continue;
  const [, nombre, tipo, archivo] = m;
  if (RUIDO.has(tipo)) {
    ruido += 1;
    continue;
  }
  if (CONVENCION.has(nombre.split(".").pop())) {
    convencion += 1;
    continue;
  }
  pendientes.push({ nombre, tipo, archivo: archivo.replace(/^catedria\//, "") });
}

const porArchivo = new Map();
for (const p of pendientes) {
  if (!porArchivo.has(p.archivo)) porArchivo.set(p.archivo, []);
  porArchivo.get(p.archivo).push(p);
}

const ordenados = [...porArchivo.entries()].sort((a, b) => b[1].length - a[1].length);

console.log(`\nSIN DOCUMENTAR\n${"=".repeat(62)}`);

if (pendientes.length === 0) {
  console.log("Todo lo exportado tiene su comentario.");
} else {
  for (const [archivo, items] of ordenados) {
    console.log(`\n${archivo}  ·  ${items.length}`);
    for (const item of items) {
      const corto = item.nombre.split(".").slice(1).join(".") || item.nombre;
      console.log(`   ${item.tipo.padEnd(14)} ${corto}`);
    }
  }
}

const porTipo = new Map();
for (const p of pendientes) porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1);

console.log(`\n${"=".repeat(62)}`);
console.log(
  `${pendientes.length} por documentar · ` +
    [...porTipo]
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${n} ${t}`)
      .join(", "),
);
console.log(`${ruido} propiedades de tipos inferidos, que no se documentan a mano.`);
console.log(`${convencion} exportaciones de convención de Next.js, que lee el framework.`);
