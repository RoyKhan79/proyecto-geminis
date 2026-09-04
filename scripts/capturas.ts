/**
 * CAPTURAS DE PANTALLA DEL MANUAL
 *
 *   npm run manual:capturas [http://localhost:3000]
 *
 * Recorre las pantallas que el manual explica, entrando como cada rol, y las
 * guarda en `public/manual/`. El manual las enseña automáticamente; las que
 * falten se sustituyen por un aviso en lugar de por una imagen rota.
 *
 * Por qué un script y no unas capturas pegadas a mano: unas capturas pegadas
 * envejecen con el primer rediseño y nadie las rehace, así que el manual acaba
 * enseñando una aplicación que ya no existe. Esto se vuelve a lanzar en un
 * minuto después de cualquier cambio.
 *
 * NO SE LANZA CONTRA PRODUCCIÓN. Una captura de la lista de alumnos son datos
 * personales de gente real, y acabarían dentro de un manual que se comparte.
 * El script comprueba que existe la academia de demostración y se niega a
 * seguir si no la encuentra.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const CLAVE_DEMO = "Catedria2026!";
const DESTINO = path.resolve(process.cwd(), "public/manual");

/** Escritorio para Manager, teléfono para el Campus: el Campus se hace en el
 *  móvil, y enseñarlo estirado a 1440 px sería enseñar otra cosa. */
const ESCRITORIO = { width: 1440, height: 940 } as const;
const MOVIL = { width: 402, height: 874 } as const;

type Toma = {
  archivo: string;
  ruta: string;
  como: "admin" | "profesor" | "alumno";
  movil?: boolean;
  /** Espera a que aparezca esto antes de disparar. Evita capturar esqueletos. */
  esperar?: string;
  /** Recorta a la altura del contenido en lugar de a la del viewport. */
  completa?: boolean;
};

const TOMAS: Toma[] = [
  // ── Manager ───────────────────────────────────────────────────────────────
  { archivo: "gestion-inicio", ruta: "/gestion", como: "admin", esperar: "h1" },
  { archivo: "gestion-contenido", ruta: "/gestion/contenido", como: "admin", esperar: "h1" },
  { archivo: "gestion-alumnos", ruta: "/gestion/alumnos", como: "admin", esperar: "h1" },
  { archivo: "gestion-agenda", ruta: "/gestion/agenda", como: "admin", esperar: "h1" },
  { archivo: "gestion-examenes", ruta: "/gestion/examenes", como: "profesor", esperar: "h1" },
  { archivo: "gestion-pagos", ruta: "/gestion/pagos", como: "admin", esperar: "h1" },
  { archivo: "gestion-facturas", ruta: "/gestion/facturas", como: "admin", esperar: "h1" },
  { archivo: "gestion-remesas", ruta: "/gestion/pagos/remesas", como: "admin", esperar: "h1" },
  { archivo: "gestion-analitica", ruta: "/gestion/analitica", como: "admin", esperar: "h1" },
  { archivo: "gestion-ia", ruta: "/gestion/ia", como: "admin", esperar: "h1" },

  // ── Campus, en un teléfono ────────────────────────────────────────────────
  { archivo: "campus-inicio", ruta: "/campus", como: "alumno", movil: true, esperar: "h1" },
  { archivo: "campus-estudiar", ruta: "/campus/estudiar", como: "alumno", movil: true, esperar: "h1" },
  { archivo: "campus-descargas", ruta: "/campus/descargas", como: "alumno", movil: true, esperar: "h1" },
  { archivo: "campus-tests", ruta: "/campus/tests", como: "alumno", movil: true, esperar: "h1" },
  { archivo: "campus-examenes", ruta: "/campus/examenes", como: "alumno", movil: true, esperar: "h1" },
  { archivo: "campus-ia", ruta: "/campus/ia", como: "alumno", movil: true, esperar: "h1" },
  { archivo: "campus-perfil", ruta: "/campus/perfil", como: "alumno", movil: true, esperar: "h1" },
];

const CORREOS = {
  admin: "admin@academiademo.test",
  profesor: "laura@academiademo.test",
  alumno: "alumno1@academiademo.test",
} as const;

async function entrar(navegador: Browser, como: keyof typeof CORREOS, movil: boolean) {
  const contexto = await navegador.newContext({
    viewport: movil ? MOVIL : ESCRITORIO,
    deviceScaleFactor: 2, // pantallas retina: si no, el texto sale borroso
    locale: "es-ES",
    timezoneId: "Europe/Madrid",
    isMobile: movil,
    hasTouch: movil,
    // Las capturas se ven en el manual, que respeta el tema de quien lo lee.
    // Se fuerza el claro para que todas sean coherentes entre sí.
    colorScheme: "light",
  });

  const pagina = await contexto.newPage();
  await pagina.goto(`${BASE}/entrar`, { waitUntil: "networkidle" });
  await pagina.fill('input[name="email"]', CORREOS[como]);
  await pagina.fill('input[name="password"]', CLAVE_DEMO);
  await pagina.click('button[type="submit"]');
  await pagina.waitForURL((url: URL) => !url.pathname.startsWith("/entrar"), {
    timeout: 15_000,
  });

  return { contexto, pagina };
}

/**
 * Comprueba que estamos apuntando a una instalación de demostración.
 *
 * Si el correo de demostración no entra, o esto no está sembrado o —lo que
 * importa— es una instalación real. En los dos casos se para.
 */
async function esDemostracion(navegador: Browser): Promise<boolean> {
  const contexto = await navegador.newContext({ viewport: ESCRITORIO });
  const pagina = await contexto.newPage();
  try {
    await pagina.goto(`${BASE}/entrar`, { waitUntil: "networkidle", timeout: 15_000 });
    await pagina.fill('input[name="email"]', CORREOS.admin);
    await pagina.fill('input[name="password"]', CLAVE_DEMO);
    await pagina.click('button[type="submit"]');
    await pagina.waitForURL((url: URL) => !url.pathname.startsWith("/entrar"), {
      timeout: 15_000,
    });
    return true;
  } catch {
    return false;
  } finally {
    await contexto.close();
  }
}

async function disparar(pagina: Page, toma: Toma) {
  await pagina.goto(`${BASE}${toma.ruta}`, { waitUntil: "networkidle" });

  if (toma.esperar) {
    await pagina.waitForSelector(toma.esperar, { timeout: 15_000 });
  }

  // Las animaciones de entrada dejan tarjetas a medio aparecer si se dispara
  // demasiado pronto. Un respiro corto sale más barato que una captura mala.
  await pagina.waitForTimeout(600);

  await pagina.screenshot({
    path: path.join(DESTINO, `${toma.archivo}.png`),
    fullPage: toma.completa ?? false,
  });
}

/**
 * Abre un navegador.
 *
 * Se usa el Chrome que ya está instalado (`channel: "chrome"`) en lugar del
 * Chromium que Playwright se descarga. Motivo concreto: en macOS 12 Playwright
 * ya no publica su Chromium, y descargarlo falla con «does not support chromium
 * on mac12». El Chrome del sistema pinta igual y ahorra 150 MB de descarga.
 *
 * Si no hubiera Chrome, se cae al Chromium propio: en Linux y en Windows es lo
 * que habrá, y ahí sí está disponible.
 */
async function abrirNavegador(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return chromium.launch();
  }
}

async function main() {
  console.log(`\nCapturas del manual · ${BASE}`);
  console.log("=".repeat(58));

  if (!existsSync(DESTINO)) mkdirSync(DESTINO, { recursive: true });

  const navegador = await abrirNavegador();

  try {
    if (!(await esDemostracion(navegador))) {
      console.error(
        "\n✗ No he podido entrar con el usuario de demostración.\n" +
          "  O la demo no está sembrada (`npm run demo:todo`), o esto es una\n" +
          "  instalación real. No hago capturas de datos de personas reales.\n",
      );
      process.exit(1);
    }

    // Una sesión por rol y tamaño, reutilizada para todas sus tomas: entrar
    // diecisiete veces tarda diecisiete veces más y no aporta nada.
    const sesiones = new Map<string, Awaited<ReturnType<typeof entrar>>>();
    let hechas = 0;

    for (const toma of TOMAS) {
      const llave = `${toma.como}:${toma.movil ? "movil" : "escritorio"}`;
      if (!sesiones.has(llave)) {
        sesiones.set(llave, await entrar(navegador, toma.como, toma.movil ?? false));
      }
      const { pagina } = sesiones.get(llave)!;

      try {
        await disparar(pagina, toma);
        hechas += 1;
        console.log(`  ✓ ${toma.archivo}.png  ·  ${toma.ruta}`);
      } catch (error) {
        // Una pantalla que falla no puede tirar las dieciséis restantes.
        console.log(
          `  ✗ ${toma.archivo}  ·  ${error instanceof Error ? error.message.split("\n")[0] : error}`,
        );
      }
    }

    for (const { contexto } of sesiones.values()) await contexto.close();

    console.log("=".repeat(58));
    console.log(`${hechas} de ${TOMAS.length} capturas en public/manual/`);
    console.log("Abre /manual para verlas.\n");
  } finally {
    await navegador.close();
  }
}

main().catch((error) => {
  console.error("\n✗ Las capturas no se han podido hacer:", error);
  process.exit(1);
});
