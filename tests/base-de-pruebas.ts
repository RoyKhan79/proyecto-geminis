/**
 * ¿ES ESTA BASE DE DATOS UNA BASE DE PRUEBAS?
 *
 * Vive en su propio archivo, separado de `setup.ts`, por una razón práctica:
 * `setup.ts` se ejecuta ANTES que cualquier prueba, así que la comprobación que
 * hay dentro no se puede probar desde dentro. Aquí es una función normal que
 * recibe lo que tiene que mirar y devuelve motivos, y por tanto se puede probar
 * con veinte direcciones distintas sin tocar ninguna base de datos.
 *
 * Ver `setup.ts` para el porqué de todo esto.
 */

/** Anfitriones que solo pueden ser la máquina de quien programa. */
const ANFITRIONES_LOCALES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
  "host.docker.internal",
  "postgres", // el nombre del servicio en docker-compose
  "db",
]);

/**
 * Un nombre de base de datos que se reconoce como de pruebas.
 *
 * `geminis` a secas vale porque es la que crea `npm run db:start` en el
 * portátil, y exigir que se llamara `geminis_test` obligaría a todo el mundo a
 * rehacer su entorno. Lo que la hace segura no es el nombre: es que además
 * tiene que estar en un anfitrión local.
 */
const NOMBRES_DE_DESARROLLO = /^(geminis|geminis_dev|geminis_test|postgres|test|dev)/i;

export type Entorno = {
  NODE_ENV?: string;
  /** La confirmación explícita que permite ejecutar contra otra base. */
  GEMINIS_BASE_DE_PRUEBAS?: string;
};

/**
 * Por qué NO se debería ejecutar la suite contra esta base.
 *
 * La pregunta que se hace no es «¿parece de producción?» sino «¿se puede
 * afirmar que es de desarrollo?». La primera es una lista de sospechas que
 * siempre se queda corta —basta un servidor con un nombre que no esté en la
 * lista—; la segunda falla del lado seguro ante cualquier cosa que no reconozca.
 *
 * @param cadena El valor de `DATABASE_URL`.
 * @param entorno Las variables que también deciden.
 * @returns La lista de motivos. **Vacía significa que se puede ejecutar.**
 *
 * @example
 * ```ts
 * motivosParaNoEjecutar("postgresql://u:p@localhost:5432/geminis", {});  // []
 * motivosParaNoEjecutar("postgresql://u:p@db.acme.com/geminis", {});     // 1 motivo
 * ```
 */
export function motivosParaNoEjecutar(
  cadena: string | undefined,
  entorno: Entorno,
): string[] {
  if (!cadena) return ["no hay DATABASE_URL"];

  // La confirmación explícita existe para el caso legítimo —una base de pruebas
  // en un servidor de integración con otro nombre— y hay que escribirla a mano,
  // que es justo lo que un despiste no hace.
  if (entorno.GEMINIS_BASE_DE_PRUEBAS === "confirmo") return [];

  let url: URL;
  try {
    url = new URL(cadena);
  } catch {
    return ["DATABASE_URL no se entiende como una dirección"];
  }

  const anfitrion = url.hostname.toLowerCase();
  const nombre = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const motivos: string[] = [];

  if (!ANFITRIONES_LOCALES.has(anfitrion)) {
    motivos.push(`el anfitrión «${anfitrion}» no es local`);
  }
  if (!NOMBRES_DE_DESARROLLO.test(nombre)) {
    motivos.push(`el nombre de la base «${nombre}» no se reconoce como de pruebas`);
  }
  if (entorno.NODE_ENV === "production") {
    motivos.push("NODE_ENV=production");
  }
  // Señales de que alguien ha apuntado a un servicio gestionado. No son la
  // comprobación principal —esa es que el anfitrión sea local— pero dan un
  // mensaje mucho más útil cuando saltan.
  if (/(^|[_-])(prod|produccion|producción|live)([_-]|$)/i.test(nombre)) {
    motivos.push("el nombre de la base dice «producción»");
  }
  if (
    url.searchParams.get("sslmode") === "require" &&
    !ANFITRIONES_LOCALES.has(anfitrion)
  ) {
    motivos.push("la conexión exige SSL, algo propio de un servidor remoto");
  }

  return motivos;
}

/**
 * El texto que se le enseña a quien ha lanzado las pruebas donde no debía.
 *
 * Se separa del cálculo para que la prueba compruebe los motivos y no la
 * redacción, que cambiará.
 */
export function explicarRechazo(cadena: string, motivos: string[]): string {
  let donde = cadena.slice(0, 60);
  try {
    const url = new URL(cadena);
    donde = `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    /* se queda el recorte */
  }

  return [
    "",
    "═".repeat(72),
    "  LAS PRUEBAS NO SE EJECUTAN CONTRA ESTA BASE DE DATOS",
    "═".repeat(72),
    "",
    `  Base:      ${donde}`,
    "",
    "  Motivos:",
    ...motivos.map((m) => `    · ${m}`),
    "",
    "  Estas pruebas CREAN Y BORRAN academias y usuarios, y el borrado de una",
    "  academia arrastra en cascada todo su contenido. Ejecutarlas contra una",
    "  base que no sea de desarrollo es una pérdida de datos, no un fallo de",
    "  pruebas.",
    "",
    "  Si querías la base local:",
    "    npm run db:start",
    "",
    "  Si de verdad es una base de pruebas y solo tiene otro nombre:",
    "    GEMINIS_BASE_DE_PRUEBAS=confirmo npm test",
    "",
    "═".repeat(72),
    "",
  ].join("\n");
}
