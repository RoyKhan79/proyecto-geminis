import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const CLAVE = "Catedria2026!";
const SALIDA = "docs/manuales/capturas";

const ESCRITORIO = { width: 1440, height: 900 };
const MOVIL = { width: 414, height: 896 };

/*
 * A cuánta resolución se captura.
 *
 * En el manual una captura de escritorio se imprime a 174 mm de ancho. A 1,5x
 * son 2160 px sobre 6,85 pulgadas: unos 315 puntos por pulgada, por encima de
 * los 300 que da por buenos cualquier imprenta. Subirlo a 2x solo engorda el
 * PDF —que además se manda por correo— sin que se note en el papel.
 */
const ESCALA = 1.5;

async function entrar(ctx, correo) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/entrar`, { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', correo);
  await p.fill('input[name="password"]', CLAVE);
  await p.click('button[type="submit"]');
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(1200);
  return p;
}

async function foto(p, ruta, nombre, { espera = 2000 } = {}) {
  try {
    if (ruta) {
      await p.goto(`${BASE}${ruta}`, { waitUntil: "networkidle", timeout: 30000 });
    }
    await p.waitForTimeout(espera);
    // Se quitan animaciones y cursores para que la captura salga estable.
    // Se quita el indicador de `next dev`: es andamio de desarrollo y no debe
    // salir en un manual que ve una academia.
    await p.addStyleTag({
      content: [
        "*{animation:none!important;transition:none!important;caret-color:transparent!important}",
        "nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}",
      ].join(""),
    });
    const destino = `${SALIDA}/${nombre}.png`;
    await p.screenshot({ path: destino, fullPage: false });
    const kb = Math.round(fs.statSync(destino).size / 1024);
    console.log(`  ok  ${nombre}  (${kb} KB)  ${p.url().replace(BASE, "")}`);
    return true;
  } catch (e) {
    console.log(`  FALLO ${nombre}: ${String(e.message).split("\n")[0]}`);
    return false;
  }
}

const navegador = await chromium.launch();

// ── LA ACADEMIA ─────────────────────────────────────────────────────────────
const ctxAcademia = await navegador.newContext({ viewport: ESCRITORIO, locale: "es-ES", deviceScaleFactor: ESCALA });
const academia = await entrar(ctxAcademia, "admin@academiademo.test");
console.log("ACADEMIA · sesión en", academia.url().replace(BASE, ""));

const pantallasAcademia = [
  ["/gestion", "a-panel"],
  ["/gestion/alumnos", "a-alumnos"],
  ["/gestion/analitica", "a-analitica"],
  ["/gestion/contenido", "a-contenido"],
  ["/gestion/convocatorias", "a-convocatorias"],
  ["/gestion/importar", "a-importar"],
  ["/gestion/tests", "a-tests"],
  ["/gestion/pagos", "a-pagos"],
  ["/gestion/facturas", "a-facturas"],
  ["/gestion/agenda", "a-agenda"],
  ["/gestion/normativa", "a-normativa"],
  ["/gestion/ia", "a-ia"],
  ["/gestion/matriculas", "a-matriculas"],
  ["/gestion/comunicaciones", "a-comunicaciones"],
  ["/gestion/pagos/remesas", "a-remesas"],
  ["/gestion/configuracion", "a-configuracion"],
];
for (const [ruta, nombre] of pantallasAcademia) await foto(academia, ruta, nombre);

// La ficha de un alumno y el ritmo del temario necesitan un id: se buscan.
await academia.goto(`${BASE}/gestion/alumnos`, { waitUntil: "networkidle" });
const enlaceAlumno = await academia.locator('a[href^="/gestion/alumnos/"]').first().getAttribute("href").catch(() => null);
if (enlaceAlumno) await foto(academia, enlaceAlumno, "a-ficha-alumno");

await academia.goto(`${BASE}/gestion/contenido`, { waitUntil: "networkidle" });
const enlaceEdicion = await academia.locator('a[href^="/gestion/contenido/"]').first().getAttribute("href").catch(() => null);
if (enlaceEdicion) {
  await foto(academia, enlaceEdicion, "a-arbol-temario");
  await foto(academia, `${enlaceEdicion}/ritmo`, "a-ritmo");
}

// ── EL ALUMNADO ─────────────────────────────────────────────────────────────
const ctxAlumna = await navegador.newContext({ viewport: ESCRITORIO, locale: "es-ES", deviceScaleFactor: ESCALA });
const alumna = await entrar(ctxAlumna, "alumno1@academiademo.test");
console.log("ALUMNA · sesión en", alumna.url().replace(BASE, ""));

const pantallasAlumna = [
  ["/campus", "c-inicio"],
  ["/campus/estudiar", "c-estudiar"],
  ["/campus/tests", "c-tests"],
  ["/campus/ia", "c-ia"],
  ["/campus/calendario", "c-calendario"],
  ["/campus/muro", "c-muro"],
  ["/campus/tareas", "c-tareas"],
  ["/campus/examenes", "c-examenes"],
  ["/campus/descargas", "c-descargas"],
  ["/campus/mensajes", "c-mensajes"],
  ["/campus/perfil", "c-perfil"],
];
for (const [ruta, nombre] of pantallasAlumna) await foto(alumna, ruta, nombre);

/**
 * Pulsa algo y dice si pudo.
 *
 * Cada respuesta del test es una acción de servidor: al contestar, la página se
 * vuelve a pintar y el botón que se acaba de pulsar deja de existir. Playwright
 * lo reintenta hasta agotar el tiempo y lanza. Aquí eso no es un error: es lo
 * normal, y lo único que hay que hacer es seguir.
 *
 * Antes iba sin proteger y una sola pulsación fallida tumbaba la tanda entera,
 * dejando sin hacer el móvil y la portada.
 */
async function pulsar(loc) {
  try {
    await loc.click({ timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/*
 * UN TEST HECHO DE VERDAD
 *
 * Las capturas del manual del alumnado tienen que enseñar una pregunta y una
 * corrección, y la demo recién sembrada no tiene ningún intento. En vez de
 * fabricar datos por detrás, la alumna hace el test por la interfaz: se pulsa
 * una opción de cada pregunta y se entrega. Así lo que sale en el manual es
 * exactamente lo que verá quien lo use, y de paso la Analítica deja de estar a
 * cero.
 *
 * Se responde a propósito sin mirar cuál es la correcta: interesa que haya
 * fallos, porque la corrección y el «¿Por qué he fallado?» son justo lo que hay
 * que enseñar.
 */
async function hacerUnTest(p) {
  await p.goto(`${BASE}/campus/tests`, { waitUntil: "networkidle" });
  const empezar = p.getByRole("button", { name: /preguntas al azar/i });
  if (!(await empezar.count())) {
    console.log("  (sin preguntas disponibles: no se hace el test)");
    return;
  }
  if (!(await pulsar(empezar.first()))) {
    console.log("  (no se pudo empezar el test)");
    return;
  }
  await p.waitForURL(/\/campus\/tests\/[^/]+/, { timeout: 20000 });
  await p.waitForLoadState("networkidle");

  for (let i = 0; i < 60; i++) {
    // Se elige la opción B cuando existe, y si no la primera. Sin mirar cuál
    // es la buena: hacen falta aciertos y fallos.
    const opciones = p.locator('form button[type="submit"]').filter({ hasText: /\S/ });
    const cuantas = await opciones.count();
    if (cuantas > 1) {
      await pulsar(opciones.nth(Math.min(1, cuantas - 1)));
      await p.waitForLoadState("networkidle").catch(() => {});
      await p.waitForTimeout(300);
    }

    if (i === 0) await foto(p, null, "c-test-pregunta", { espera: 800 });

    const siguiente = p.getByRole("link", { name: "Siguiente" });
    if (await siguiente.count()) {
      if (!(await pulsar(siguiente.first()))) break;
      await p.waitForLoadState("networkidle").catch(() => {});
      continue;
    }

    const entregar = p.getByRole("button", { name: /^Entregar test$/ });
    if (await entregar.count()) {
      await pulsar(entregar.first());
      await p.waitForLoadState("networkidle").catch(() => {});
      await p.waitForTimeout(1500);
      break;
    }
    break;
  }

  await foto(p, null, "c-test-correccion", { espera: 1500 });
  console.log("  test entregado ·", p.url().replace(BASE, ""));
}

// Aun con las pulsaciones protegidas, esto es lo unico del guion que navega a
// ciegas por una interfaz: si algo se tuerce, se pierde el test pero no la tanda.
await hacerUnTest(alumna).catch((e) => {
  console.log("  FALLO haciendo el test:", String(e.message).split("\n")[0]);
});

// El inicio y los tests, ya con historial detrás.
await foto(alumna, "/campus", "c-inicio");
await foto(alumna, "/campus/tests", "c-tests");

// Un tema abierto de verdad.
await alumna.goto(`${BASE}/campus/estudiar`, { waitUntil: "networkidle" });
const enlaceTema = await alumna.locator('a[href^="/campus/estudiar/"]').first().getAttribute("href").catch(() => null);
if (enlaceTema) await foto(alumna, enlaceTema, "c-tema");

// La Analítica se repite ahora, con el test ya entregado: antes salía a cero
// porque las capturas de la academia se toman antes de que la alumna estudie.
await foto(academia, "/gestion/analitica", "a-analitica");
await foto(academia, "/gestion/tests", "a-tests");

// ── EL MÓVIL ────────────────────────────────────────────────────────────────
const ctxMovil = await navegador.newContext({ viewport: MOVIL, locale: "es-ES", deviceScaleFactor: ESCALA * 2, isMobile: true, hasTouch: true });
const movil = await entrar(ctxMovil, "alumno1@academiademo.test");
for (const [ruta, nombre] of [["/campus", "m-inicio"], ["/campus/estudiar", "m-estudiar"], ["/campus/tests", "m-tests"], ["/campus/ia", "m-ia"]]) {
  await foto(movil, ruta, `${nombre}`);
}

// ── LA PORTADA, sin sesión ──────────────────────────────────────────────────
const ctxPublico = await navegador.newContext({ viewport: ESCRITORIO, locale: "es-ES", deviceScaleFactor: ESCALA });
const publico = await ctxPublico.newPage();
await foto(publico, "/entrar", "p-entrar");

await navegador.close();
console.log("\nCapturas en", SALIDA);
