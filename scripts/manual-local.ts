/**
 * EL MANUAL COMO UN SOLO ARCHIVO
 *
 *   npm run manual:local [http://localhost:3000] [destino.html]
 *
 * Genera un `.html` que se abre con doble clic, sin servidor, sin conexión y
 * sin nada instalado. Dentro va TODO: el texto, los estilos, las tipografías y
 * las diecisiete capturas, incrustadas en el propio archivo.
 *
 * Por qué se genera y no se escribe aparte: el manual de verdad vive en
 * `/manual`, dentro del producto, y así se corrige en el mismo cambio que la
 * pantalla que describe. Un segundo manual escrito a mano empezaría a mentir el
 * primer día. Esto es una fotografía del de dentro, y se vuelve a hacer en un
 * minuto.
 *
 * Se entra como administrador a propósito: es el único rol que ve también la
 * parte de operación, y un manual recortado sería un manual peor.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const DESTINO = path.resolve(
  process.cwd(),
  process.argv[3] ?? "Manual de Geminis.html",
);

const CORREO = "admin@academiademo.test";
const CLAVE = "Geminis2026!";

/** Tipos que se incrustan y con qué cabecera. */
const TIPOS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

/**
 * Lee un recurso del propio proyecto y lo convierte en `data:`.
 *
 * Se lee del disco y no por HTTP: las tipografías y las capturas están en
 * `public/` y en `.next/`, y buscarlas ahí es más rápido y no depende de que el
 * servidor siga en pie a mitad de la generación.
 */
async function incrustar(url: string): Promise<string | null> {
  // Las imágenes de la página no apuntan al archivo: apuntan al optimizador de
  // Next (`/_next/image?url=%2Fmanual%2Fx.png&w=…`). Se saca de ahí la ruta de
  // verdad. Sin esto el archivo salía con cero fotos, que es justo lo contrario
  // de lo que se pedía.
  let ruta = url;
  if (ruta.startsWith("/_next/image")) {
    const parametros = new URLSearchParams(ruta.slice(ruta.indexOf("?") + 1));
    const original = parametros.get("url");
    if (!original) return null;
    ruta = original;
  }

  const limpia = ruta.split("?")[0].split("#")[0];
  const extension = path.extname(limpia).toLowerCase();
  const tipo = TIPOS[extension];
  if (!tipo) return null;

  const candidatos = [
    path.join(process.cwd(), "public", limpia),
    path.join(process.cwd(), limpia.replace(/^\/_next\//, ".next/")),
    path.join(process.cwd(), ".next/static", limpia.replace(/^\/_next\/static\//, "")),
  ];

  for (const ruta of candidatos.map((c) => decodeURIComponent(c))) {
    try {
      const datos = await readFile(ruta);
      return `data:${tipo};base64,${datos.toString("base64")}`;
    } catch {
      // Siguiente candidato.
    }
  }
  return null;
}

/** Sustituye cada `url(...)` de una hoja de estilos por su versión incrustada. */
async function incrustarEnCss(css: string): Promise<string> {
  const referencias = [
    ...new Set(
      [...css.matchAll(/url\((['"]?)(\/[^)'"]+)\1\)/g)].map((m) => m[2]),
    ),
  ];

  let resultado = css;
  for (const referencia of referencias) {
    const dato = await incrustar(referencia);
    if (!dato) continue;
    resultado = resultado.split(referencia).join(dato);
  }
  return resultado;
}

async function abrirNavegador(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return chromium.launch();
  }
}

async function main() {
  console.log(`\nManual en local · ${BASE}`);
  console.log("=".repeat(58));

  const navegador = await abrirNavegador();

  try {
    const contexto = await navegador.newContext({
      viewport: { width: 1280, height: 1200 },
      locale: "es-ES",
      // Un archivo que se guarda y se comparte tiene que verse igual en el
      // ordenador de cualquiera, y no según el tema que tenga puesto.
      colorScheme: "light",
    });
    const pagina = await contexto.newPage();

    await pagina.goto(`${BASE}/entrar`, { waitUntil: "networkidle" });
    await pagina.fill('input[name="email"]', CORREO);
    await pagina.fill('input[name="password"]', CLAVE);
    await pagina.click('button[type="submit"]');
    await pagina.waitForURL((url: URL) => !url.pathname.startsWith("/entrar"), {
      timeout: 20_000,
    });

    await pagina.goto(`${BASE}/manual`, { waitUntil: "networkidle" });
    await pagina.waitForSelector("h1", { timeout: 15_000 });

    // Las capturas van con carga diferida: sin bajar hasta el final, la mitad
    // no llegan a pedirse y el archivo saldría con la mitad de las fotos.
    await pagina.evaluate(async () => {
      for (const imagen of document.querySelectorAll("img")) {
        imagen.loading = "eager";
        imagen.scrollIntoView();
        await new Promise((listo) => setTimeout(listo, 60));
      }
      window.scrollTo(0, 0);
    });
    await pagina.waitForTimeout(1500);

    // Hojas de estilo, en orden y ya resueltas por el navegador.
    const estilos: string[] = await pagina.evaluate(() =>
      [...document.styleSheets]
        .map((hoja) => {
          try {
            return [...hoja.cssRules].map((regla) => regla.cssText).join("\n");
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    );

    const titulo = await pagina.title();
    let cuerpo = await pagina.evaluate(() => document.body.innerHTML);

    await contexto.close();

    // ── Incrustar imágenes ──────────────────────────────────────────────────
    const fuentes = [
      ...new Set([...cuerpo.matchAll(/src="(\/[^"]+)"/g)].map((m) => m[1])),
    ];

    // En el HTML los `&` van escapados como `&amp;`; hay que deshacerlo antes
    // de leer los parámetros de la dirección.
    const desescapar = (texto: string) => texto.replace(/&amp;/g, "&");

    let incrustadas = 0;
    for (const fuente of fuentes) {
      const dato = await incrustar(desescapar(fuente));
      if (!dato) continue;
      cuerpo = cuerpo.split(fuente).join(dato);
      incrustadas += 1;
    }

    // Fuera el JavaScript. Un manual es texto y fotos: no necesita ninguno, y
    // el que trae la aplicación intentaría pedir archivos que en un archivo
    // suelto no existen. Deja errores en la consola y no aporta nada.
    cuerpo = cuerpo.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    cuerpo = cuerpo.replace(/<script\b[^>]*\/?>/gi, "");

    // `srcset` con rutas relativas ya no sirve fuera del servidor: se quita
    // para que el navegador use el `src` incrustado y no intente pedir nada.
    cuerpo = cuerpo.replace(/\ssrcset="[^"]*"/g, "");
    // Y lo que quede apuntando al servidor tampoco: enlaces internos que en un
    // archivo suelto no llevan a ninguna parte.
    cuerpo = cuerpo.replace(/href="\/(?!\/)[^"#][^"]*"/g, 'href="#"');

    const css = await incrustarEnCss(estilos.join("\n"));

    const documento = `<!doctype html>
<html lang="es" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<!--
  Generado con \`npm run manual:local\` a partir de /manual.
  No lo edites a mano: el manual de verdad vive dentro de la aplicación y este
  archivo se vuelve a generar en un minuto.
-->
<style>
${css}

/* Es un archivo suelto: los enlaces internos no llevan a ninguna parte, así
   que se pintan como texto normal para no prometer lo que no pueden cumplir.
   Los del índice sí funcionan, porque son anclas dentro de la misma página. */
a[href="#"] { color: inherit; text-decoration: none; cursor: default; }
</style>
</head>
<body>
${cuerpo}
</body>
</html>
`;

    await writeFile(DESTINO, documento, "utf8");

    const tamaño = Buffer.byteLength(documento) / 1024 / 1024;
    console.log(`  · ${incrustadas} imágenes incrustadas`);
    console.log(`  · ${estilos.length} hojas de estilo y sus tipografías dentro`);
    console.log("=".repeat(58));
    console.log(`✓ ${DESTINO}`);
    console.log(`  ${tamaño.toFixed(1)} MB · se abre con doble clic, sin conexión.\n`);
  } finally {
    await navegador.close();
  }
}

main().catch((error) => {
  console.error("\n✗ El manual no se ha podido generar:", error);
  process.exit(1);
});
