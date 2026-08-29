/**
 * AUDITORÍA INTERNA · revisión del código, no del servidor
 *
 *   node scripts/auditoria-interna.mjs
 *
 * La auditoría HTTP (`scripts/auditoria.mjs`) comprueba lo que hace la
 * aplicación levantada. Esta comprueba lo que dice el código, que es donde se
 * cuelan los descuidos que todavía no han llegado a ser un fallo:
 *
 *   · una pantalla nueva a la que se le olvidó pedir permiso,
 *   · una acción de servidor sin comprobación de sesión,
 *   · una consulta que se salta la guardia multi-tenant,
 *   · HTML sin sanear,
 *   · una tabla del esquema sin `academyId`.
 *
 * Se ejecuta sin arrancar nada. La idea es que falle en el momento en que
 * alguien añade una pantalla y se le olvida la comprobación, no seis meses
 * después.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

let pasadas = 0;
const fallos = [];

function comprobar(titulo, condicion, detalle = "") {
  if (condicion) {
    pasadas += 1;
    console.log(`  ✓ ${titulo}`);
  } else {
    fallos.push(`${titulo}${detalle ? ` · ${detalle}` : ""}`);
    console.log(`  ✗ ${titulo}${detalle ? ` · ${detalle}` : ""}`);
  }
}

/** Recorre un árbol de archivos y devuelve los que casen con la extensión. */
async function recorrer(dir, extension = ".ts") {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      salida.push(...(await recorrer(completo, extension)));
    } else if (entrada.name.endsWith(extension)) {
      salida.push(completo);
    }
  }
  return salida;
}

/** Rutas que son públicas a propósito. Cualquier otra tiene que exigir sesión. */
const PUBLICAS = new Set([
  "src/app/page.tsx",
  "src/app/entrar/page.tsx",
  "src/app/privacidad/page.tsx",
  "src/app/condiciones/page.tsx",
  "src/app/recuperar/page.tsx",
  "src/app/recuperar/[token]/page.tsx",
  "src/app/verificar/[token]/page.tsx",
  "src/app/sin-conexion/page.tsx",
  "src/app/sin-acceso/page.tsx",
]);

/** Acciones que no pueden exigir sesión porque son las que la crean. */
const ACCIONES_SIN_SESION = new Set([
  "src/lib/auth/actions.ts",
  "src/server/auth/recovery-actions.ts",
]);

async function main() {
  console.log(`\nAUDITORÍA INTERNA · Proyecto Geminis\n${"=".repeat(60)}`);

  const paginas = await recorrer("src/app", ".tsx");
  const servidor = await recorrer("src/server", ".ts");
  const librerias = await recorrer("src/lib", ".ts");

  // ── 1. Toda pantalla privada comprueba la sesión ──────────────────────────
  console.log("\n1. PANTALLAS · ninguna sin comprobación de acceso");

  const sinComprobacion = [];
  for (const archivo of paginas.filter((f) => f.endsWith("page.tsx"))) {
    const relativo = archivo.replace(/\\/g, "/");
    if (PUBLICAS.has(relativo)) continue;

    const contenido = await readFile(archivo, "utf8");
    const comprueba =
      /require(PagePermission|Permission|Academy|PlatformAdmin|Auth)/.test(contenido) ||
      /getAuthContext/.test(contenido);

    if (!comprueba) sinComprobacion.push(relativo);
  }

  comprobar(
    `las ${paginas.filter((f) => f.endsWith("page.tsx")).length - PUBLICAS.size} pantallas privadas comprueban el acceso`,
    sinComprobacion.length === 0,
    sinComprobacion.join(", "),
  );

  // Y las públicas lo son a propósito: si una deja de estar en la lista, salta.
  const publicasReales = paginas
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => f.endsWith("page.tsx") && PUBLICAS.has(f));
  comprobar(
    "la lista de pantallas públicas está al día",
    publicasReales.length === PUBLICAS.size,
    `${publicasReales.length} de ${PUBLICAS.size} encontradas`,
  );

  // ── 2. Acciones de servidor ───────────────────────────────────────────────
  console.log("\n2. ACCIONES DE SERVIDOR · ninguna sin comprobación");

  const accionesSinGuardia = [];
  for (const archivo of [...servidor, ...librerias]) {
    const relativo = archivo.replace(/\\/g, "/");
    const contenido = await readFile(archivo, "utf8");

    if (!contenido.startsWith('"use server"')) continue;
    if (ACCIONES_SIN_SESION.has(relativo)) continue;

    const comprueba =
      /require(Permission|Academy|PlatformAdmin|Auth)/.test(contenido) ||
      /getAuthContext/.test(contenido);

    if (!comprueba) accionesSinGuardia.push(relativo);
  }

  const totalAcciones = (
    await Promise.all(
      [...servidor, ...librerias].map(async (f) => {
        const c = await readFile(f, "utf8");
        return c.startsWith('"use server"') ? 1 : 0;
      }),
    )
  ).reduce((a, b) => a + b, 0);

  comprobar(
    `los ${totalAcciones} módulos de acciones comprueban sesión o permiso`,
    accionesSinGuardia.length === 0,
    accionesSinGuardia.join(", "),
  );

  // ── 3. Guardia multi-tenant ───────────────────────────────────────────────
  console.log("\n3. AISLAMIENTO · uso de la guardia multi-tenant");

  // `prismaBase` salta la guardia, y hay tres motivos legítimos para hacerlo:
  //
  //   · el modelo es global (User, Academy, Session…),
  //   · el modelo es derivado y la guardia PROHÍBE consultarlo directamente,
  //     así que la única forma de tocarlo es con el cliente base,
  //   · la función recibe `academyId` y lo pone a mano en la consulta.
  //
  // Lo que no vale es tocar un modelo de academia con el cliente base sin
  // acotar por academia: ahí es donde se filtran datos de una a otra. Eso es
  // lo que se comprueba, llamada por llamada.
  const { TENANT_MODELS, DERIVED_MODELS } = await import("../src/lib/db/tenant-models.ts")
    .catch(async () => {
      // El script corre en Node a secas, sin TypeScript: si no se puede
      // importar, se leen los conjuntos del propio archivo.
      const fuente = await readFile("src/lib/db/tenant-models.ts", "utf8");
      const leer = (nombre) => {
        const bloque = fuente.slice(fuente.indexOf(`${nombre} = new Set<string>([`));
        return new Set(
          [...bloque.slice(0, bloque.indexOf("]")).matchAll(/"(\w+)"/g)].map((m) => m[1]),
        );
      };
      return { TENANT_MODELS: leer("TENANT_MODELS"), DERIVED_MODELS: leer("DERIVED_MODELS") };
    });

  const enMinuscula = new Map(
    [...TENANT_MODELS].map((m) => [m.charAt(0).toLowerCase() + m.slice(1), m]),
  );

  const sinAcotar = [];
  let llamadasRevisadas = 0;

  for (const archivo of [...servidor, ...librerias]) {
    const relativo = archivo.replace(/\\/g, "/");
    // La propia guardia y las pruebas de aislamiento usan el cliente base por
    // definición: son quienes lo implementan.
    if (relativo.includes("src/lib/db/")) continue;

    const contenido = await readFile(archivo, "utf8");

    for (const llamada of contenido.matchAll(
      /prismaBase\.(\w+)\s*\.\s*(\w+)\(([\s\S]{0,400})/g,
    )) {
      const [, propiedad, operacion, argumentos] = llamada;
      const modelo = enMinuscula.get(propiedad);
      if (!modelo) continue; // global o derivado: permitido

      llamadasRevisadas += 1;

      // Hay consultas que tienen que cruzar academias a propósito —«¿esta
      // persona pertenece a alguna otra?»—. Se declaran en el propio código
      // con un comentario `tenant-ok` que explica por qué. Se exige el
      // comentario y no una lista aquí para que el motivo viva al lado de la
      // consulta y se revise cuando alguien la toque.
      const anterior = contenido.slice(
        Math.max(0, llamada.index - 320),
        llamada.index,
      );
      if (/tenant-ok/.test(anterior)) continue;

      // Basta con que la consulta mencione academyId: puede ir en el `where`
      // (lecturas) o en el `data` (escrituras).
      if (!/academyId/.test(argumentos)) {
        sinAcotar.push(`${relativo} · ${propiedad}.${operacion}`);
      }
    }
  }

  comprobar(
    `las ${llamadasRevisadas} consultas que saltan la guardia acotan por academia`,
    sinAcotar.length === 0,
    sinAcotar.join(", "),
  );

  // ── 4. Esquema: todo modelo está clasificado ──────────────────────────────
  console.log("\n4. ESQUEMA · todo modelo clasificado");

  const esquemas = await recorrer("prisma/schema", ".prisma");
  const modelos = [];

  for (const archivo of esquemas) {
    const contenido = await readFile(archivo, "utf8");
    for (const bloque of contenido.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
      modelos.push({ nombre: bloque[1], cuerpo: bloque[2] });
    }
  }

  const fuenteModelos = await readFile("src/lib/db/tenant-models.ts", "utf8");
  const globales = new Set(
    [
      ...fuenteModelos
        .slice(fuenteModelos.indexOf("GLOBAL_MODELS = new Set<string>(["))
        .slice(0, 900)
        .matchAll(/"(\w+)"/g),
    ].map((m) => m[1]),
  );

  const sinClasificar = modelos
    .filter((m) => !TENANT_MODELS.has(m.nombre) && !globales.has(m.nombre))
    .map((m) => m.nombre);

  comprobar(
    `los ${modelos.length} modelos del esquema están clasificados`,
    sinClasificar.length === 0,
    sinClasificar.join(", "),
  );

  // Y al revés: un modelo con academyId que no esté en TENANT_MODELS es una
  // tabla de academia que la guardia no filtra. Es el fallo más grave posible.
  const conTenantSinClasificar = modelos
    .filter((m) => /\bacademyId\b/.test(m.cuerpo) && !TENANT_MODELS.has(m.nombre))
    .map((m) => m.nombre);

  comprobar(
    "ninguna tabla con academyId se queda fuera de la guardia",
    conTenantSinClasificar.length === 0,
    conTenantSinClasificar.join(", "),
  );

  // Los derivados tienen que estar prohibidos en el cliente de academia.
  const guardia = await readFile("src/lib/db/tenant.ts", "utf8");
  comprobar(
    "los modelos derivados no se pueden consultar desde un cliente de academia",
    /DERIVED_MODELS\.has\(model\)/.test(guardia) &&
      /throw new TenantViolationError/.test(guardia),
    `${DERIVED_MODELS.size} modelos derivados`,
  );

  comprobar(
    "un modelo sin clasificar hace saltar la guardia en lugar de pasar",
    /no está clasificado como global ni de tenant/.test(guardia),
  );

  // ── 5. HTML sin sanear ────────────────────────────────────────────────────
  console.log("\n5. INYECCIÓN · HTML de usuario");

  const sinSanear = [];
  for (const archivo of paginas.concat(await recorrer("src/components", ".tsx"))) {
    const contenido = await readFile(archivo, "utf8");
    if (!/dangerouslySetInnerHTML/.test(contenido)) continue;
    if (!/sanitiz/i.test(contenido)) sinSanear.push(archivo.replace(/\\/g, "/"));
  }

  comprobar(
    "todo HTML pintado como tal pasa por el saneador",
    sinSanear.length === 0,
    sinSanear.join(", "),
  );

  // ── 6. Secretos ───────────────────────────────────────────────────────────
  console.log("\n6. SECRETOS · nada escrito a mano en el código");

  const sospechosos = [];
  const patron =
    /(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

  for (const archivo of [...servidor, ...librerias, ...paginas]) {
    const contenido = await readFile(archivo, "utf8");
    if (patron.test(contenido)) sospechosos.push(archivo.replace(/\\/g, "/"));
  }

  comprobar(
    "no hay claves ni certificados en el código",
    sospechosos.length === 0,
    sospechosos.join(", "),
  );

  // ── 7. Contraseñas ────────────────────────────────────────────────────────
  console.log("\n7. CONTRASEÑAS");

  const password = await readFile("src/lib/auth/password.ts", "utf8");
  comprobar(
    "se usa scrypt con coste de memoria, no una función de resumen a secas",
    /scrypt/.test(password) && /N\s*[:=]|65536/.test(password),
  );
  comprobar(
    "la comparación es en tiempo constante",
    /timingSafeEqual/.test(password),
    "sin timingSafeEqual se puede averiguar el hash por el tiempo de respuesta",
  );

  const sesion = await readFile("src/lib/auth/session.ts", "utf8");
  comprobar(
    "en la base solo vive el resumen del testigo de sesión",
    /createHash\("sha256"\)/.test(sesion) && /tokenHash/.test(sesion),
  );
  comprobar(
    "la cookie de sesión es HttpOnly y SameSite",
    /httpOnly:\s*true/.test(sesion) && /sameSite/.test(sesion),
  );

  const recovery = await readFile("src/lib/auth/recovery.ts", "utf8");
  comprobar(
    "los enlaces de recuperación se guardan resumidos y caducan",
    /hashToken/.test(recovery) && /expiresAt/.test(recovery),
  );
  comprobar(
    "un enlace de verificación no sirve para cambiar la contraseña",
    /proposito === "reset" && esVerificacion/.test(recovery),
  );

  // ── 8. Cabeceras de seguridad ─────────────────────────────────────────────
  console.log("\n8. CABECERAS");

  const config = await readFile("next.config.ts", "utf8");
  for (const cabecera of [
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
  ]) {
    comprobar(`se envía ${cabecera}`, config.includes(cabecera));
  }
  comprobar("no se anuncia la versión del servidor", /poweredByHeader:\s*false/.test(config));

  // ── 9. La IA no publica sola ──────────────────────────────────────────────
  console.log("\n9. IA · nada se publica sin que lo apruebe una persona");

  const iaActions = await readFile("src/server/ai/actions.ts", "utf8");
  comprobar(
    "lo que genera la IA nace en borrador",
    /status:\s*"DRAFT"/.test(iaActions),
  );
  comprobar(
    "se guarda de dónde salió cada pregunta generada",
    /aiProvenance/.test(iaActions),
  );

  const retrieval = await readFile("src/lib/ai/retrieval.ts", "utf8");
  comprobar(
    "la recuperación filtra por permisos ANTES de buscar",
    retrieval.indexOf("loadStudentGrants") < retrieval.indexOf("documentChunk.findMany"),
    "si se filtrara después, el sistema ya habría leído material ajeno",
  );

  // ── 10. Documentación al día ──────────────────────────────────────────────
  console.log("\n10. DOCUMENTACIÓN");

  const decisiones = await readFile("docs/DECISIONS.md", "utf8");
  const adrs = [...decisiones.matchAll(/### ADR-(\d{4})/g)].map((m) => Number(m[1]));
  const correlativos = adrs.every((n, i) => n === i + 1);

  comprobar(
    `hay ${adrs.length} decisiones anotadas y están numeradas sin saltos`,
    adrs.length > 0 && correlativos,
  );

  for (const doc of [
    "README.md",
    "docs/ARCHITECTURE.md",
    "docs/SECURITY_MODEL.md",
    "docs/PERMISSIONS.md",
    "docs/DESIGN_SYSTEM.md",
    "docs/GUIA_APP_MOVIL.md",
  ]) {
    const contenido = await readFile(doc, "utf8").catch(() => "");
    comprobar(`${doc} existe y tiene contenido`, contenido.length > 500);
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTADO: ${pasadas} comprobaciones superadas, ${fallos.length} fallidas`);
  if (fallos.length > 0) {
    console.log("\nFALLOS:");
    for (const fallo of fallos) console.log(`  · ${fallo}`);
    process.exit(1);
  }
  console.log("Sin incidencias.\n");
}

main().catch((error) => {
  console.error("La auditoría interna no ha podido completarse:", error);
  process.exit(1);
});
