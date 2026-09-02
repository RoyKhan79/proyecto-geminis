import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * LOS MANUALES, A PDF
 * ───────────────────
 * Los manuales se escriben en HTML y se imprimen con el mismo motor que dibuja
 * la aplicación. Se hace así, y no con una biblioteca de PDF, por dos razones:
 * el resultado usa la tipografía y los colores reales del producto, y las
 * capturas son las que genera `scripts/capturas-manual.mjs` contra el servidor
 * de verdad, no maquetas.
 *
 * Uso:  node scripts/manuales-pdf.mjs
 */

const RAIZ = process.cwd();
const CARPETA = path.join(RAIZ, "docs", "manuales");

const DOCUMENTOS = [
  ["manual-academias", "Proyecto Geminis · manual para academias"],
  ["manual-alumnado", "Proyecto Geminis · manual del alumnado"],
];

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ locale: "es-ES" });

for (const [nombre, titulo] of DOCUMENTOS) {
  const origen = path.join(CARPETA, `${nombre}.html`);
  if (!fs.existsSync(origen)) {
    console.log(`  falta ${nombre}.html · se omite`);
    continue;
  }

  const p = await ctx.newPage();
  await p.goto(pathToFileURL(origen).href, { waitUntil: "networkidle" });

  // Sin esto, una imagen que aún no ha decodificado sale en blanco en el PDF.
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((i) => !i.complete)
        .map((i) => new Promise((ok) => { i.onload = i.onerror = ok; })),
    );
  });
  await p.waitForTimeout(600);

  // Se avisa de las imágenes que no han cargado: un manual con huecos en blanco
  // no debe llegar a una academia sin que nos enteremos.
  const rotas = await p.evaluate(() =>
    [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")),
  );
  if (rotas.length) {
    console.log(`  AVISO · ${rotas.length} imagen(es) sin cargar en ${nombre}:`);
    for (const r of rotas.slice(0, 10)) console.log(`     ${r}`);
  }

  const destino = path.join(CARPETA, `${nombre}.pdf`);

  /*
   * En Windows, un PDF abierto en un visor queda bloqueado y la escritura falla
   * con EBUSY. Sin este aviso lo que sale es una traza de pila que parece un
   * fallo del generador, y se pierde un rato buscando en el sitio equivocado.
   */
  try {
    fs.closeSync(fs.openSync(destino, "r+"));
  } catch (e) {
    if (e.code === "EBUSY" || e.code === "EPERM") {
      console.log(`  ${nombre}.pdf está abierto en otro programa. Ciérralo y repite.`);
      await p.close();
      continue;
    }
    // ENOENT es lo normal la primera vez: todavía no existe.
  }

  await p.pdf({
    path: destino,
    format: "A4",
    printBackground: true,
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    displayHeaderFooter: false,
  });

  const mb = (fs.statSync(destino).size / 1024 / 1024).toFixed(2);

  /*
   * Se cuentan las páginas del PDF, no las secciones del HTML.
   *
   * Contar `.pagina` es lo que parece obvio y engaña: si una sección se pasa de
   * los 297 mm, Chromium la parte en dos y el PDF acaba con páginas de relleno
   * medio vacías, mientras el recuento sigue diciendo el número bonito. Aquí ya
   * pasó: el HTML decía 22 y el PDF tenía 32.
   */
  const secciones = await p.evaluate(() => document.querySelectorAll(".pagina").length);
  const paginas = (fs.readFileSync(destino).toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  const descuadre = paginas === secciones ? "" : `  ← ¡OJO! ${secciones} secciones: algo se sale de la página`;
  console.log(`  ok  ${nombre}.pdf  ·  ${paginas} páginas  ·  ${mb} MB  ·  ${titulo}${descuadre}`);
  await p.close();
}

await navegador.close();
