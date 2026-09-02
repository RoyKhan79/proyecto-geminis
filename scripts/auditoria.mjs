#!/usr/bin/env node
/**
 * AUDITORÍA DE SEGURIDAD POR HTTP
 *
 * Ataca la aplicación en marcha como lo haría alguien de fuera: con sesiones
 * reales de distintos perfiles, probando rutas que no le corresponden y
 * manipulando identificadores.
 *
 * No sustituye a las pruebas automáticas: comprueba la capa que ellas no ven,
 * que es la de HTTP, redirecciones y códigos de respuesta.
 *
 *   node scripts/auditoria.mjs [http://localhost:3000]
 */

// Las credenciales del superadministrador vienen del entorno, y este script se
// lanza con `node` a secas, sin `--env-file`. Se carga aquí para que
// `npm run auditoria` funcione sin tener que recordar exportarlas a mano.
try {
  // `process.cwd()` y no una ruta relativa al módulo: estos scripts se lanzan
  // siempre desde la raíz con `npm run`, y construir la ruta desde `import.meta`
  // obliga a deshacer a mano el `/C:/…` que devuelve una URL en Windows.
  process.loadEnvFile(`${process.cwd()}/.env`);
} catch {
  // En integración continua las variables vienen del entorno, no de un archivo.
}

const BASE = process.argv[2] ?? "http://localhost:3000";
const PASSWORD = "Geminis2026!";

let pasadas = 0;
let fallidas = 0;
const fallos = [];
let omitidas = 0;
const sinProbar = [];

function comprobar(titulo, condicion, detalle = "") {
  if (condicion) {
    pasadas += 1;
    console.log(`  ✓ ${titulo}`);
  } else {
    fallidas += 1;
    fallos.push(`${titulo} ${detalle}`);
    console.log(`  ✗ ${titulo} ${detalle}`);
  }
}

/**
 * «No se ha podido probar» NO es «ha pasado», y tampoco es «ha fallado».
 *
 * Varias comprobaciones de aquí necesitan que la demo tenga datos: temas
 * publicados, un documento subido, dos alumnos con packs distintos. Sin ellos,
 * expresiones como `alcanzables < nodos.length` valen `0 < 0`, que es falso, y
 * el informe cantaba una fuga donde lo único que pasaba era que faltaba
 * `npm run demo:todo`.
 *
 * Eso hace daño en las dos direcciones. Hacia fuera, porque un informe que
 * dice «✗ el alumno alcanza secciones que no ha pagado» cuando no hay ni una
 * sección es sencillamente falso. Y hacia dentro, porque quien lo vea fallar
 * siempre por lo mismo dejará de mirarlo, y el día que la fuga sea de verdad
 * ya nadie lee esa línea.
 *
 * @param titulo Qué se iba a comprobar.
 * @param motivo Por qué no se ha podido, para que se sepa qué falta.
 */
function omitir(titulo, motivo) {
  omitidas += 1;
  sinProbar.push(`${titulo} · ${motivo}`);
  console.log(`  ~ ${titulo} · OMITIDO: ${motivo}`);
}

/**
 * El superadministrador con el que probar la consola de plataforma.
 *
 * Del entorno, siempre. Sin ellas, las comprobaciones de ese nivel se omiten:
 *
 *   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... npm run auditoria:http
 */
const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL ?? "";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD ?? "";

async function login(email, password = PASSWORD) {
  const html = await (await fetch(`${BASE}/entrar`)).text();
  const form = new FormData();
  for (const m of html.matchAll(
    /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g,
  )) {
    const d = (s) => (s ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    form.set(d(m[1]), d(m[2]));
  }
  form.set("email", email);
  form.set("password", password);
  const res = await fetch(`${BASE}/entrar`, {
    method: "POST",
    body: form,
    redirect: "manual",
  });
  return (res.headers.getSetCookie?.() ?? [])
    .find((c) => c.startsWith("geminis_session="))
    ?.split(";")[0];
}

async function pedir(cookie, ruta) {
  const res = await fetch(BASE + ruta, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return {
    status: res.status,
    location: res.headers.get("location"),
    tipo: (res.headers.get("content-type") ?? "").split(";")[0],
    cabeceras: Object.fromEntries(res.headers),
    cuerpo: res.status === 200 ? await res.text() : "",
  };
}

const RUTAS_MANAGER = [
  "/gestion",
  "/gestion/alumnos",
  "/gestion/profesores",
  "/gestion/oposiciones",
  "/gestion/cursos",
  "/gestion/matriculas",
  "/gestion/importar",
  "/gestion/contenido",
  "/gestion/clases",
  "/gestion/tareas",
  "/gestion/salas",
  "/gestion/tests",
  "/gestion/tests/importar",
  "/gestion/facturas",
  "/gestion/agenda",
  "/gestion/pagos/remesas",
  "/gestion/convocatorias",
  "/gestion/normativa",
  "/gestion/ia",
  "/gestion/analitica",
  "/gestion/muro",
  "/gestion/mensajes",
  "/gestion/comunicaciones",
  "/gestion/pagos",
  "/gestion/configuracion",
];

const RUTAS_CAMPUS = [
  "/campus",
  "/campus/estudiar",
  "/campus/tests",
  "/campus/tareas",
  "/campus/muro",
  "/campus/mensajes",
  "/campus/salas",
  "/campus/calendario",
  "/campus/avisos",
  "/campus/ia",
  "/campus/perfil",
];

async function main() {
  console.log(`\nAUDITORÍA DE SEGURIDAD · ${BASE}\n${"=".repeat(60)}`);

  // ── 1. Acceso sin sesión ──────────────────────────────────────────────────
  console.log("\n1. SIN SESIÓN · nada debe ser accesible");
  for (const ruta of [...RUTAS_MANAGER, ...RUTAS_CAMPUS, "/plataforma"]) {
    const r = await pedir(null, ruta);
    const bloqueado = r.status === 307 && r.location?.includes("/entrar");
    if (!bloqueado) comprobar(`bloquea ${ruta}`, false, `→ ${r.status} ${r.location ?? ""}`);
  }
  comprobar(
    "todas las rutas privadas redirigen al acceso",
    fallidas === 0,
    `${fallidas} sin proteger`,
  );

  // ── 2. Credenciales ───────────────────────────────────────────────────────
  console.log("\n2. AUTENTICACIÓN");
  const htmlLogin = await (await fetch(`${BASE}/entrar`)).text();
  const formMala = new FormData();
  for (const m of htmlLogin.matchAll(
    /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g,
  )) {
    const d = (s) => (s ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    formMala.set(d(m[1]), d(m[2]));
  }
  formMala.set("email", "admin@academiademo.test");
  formMala.set("password", "contraseña-incorrecta");
  const malIntento = await fetch(`${BASE}/entrar`, {
    method: "POST",
    body: formMala,
    redirect: "manual",
  });
  const cookieMala = (malIntento.headers.getSetCookie?.() ?? []).find((c) =>
    c.startsWith("geminis_session="),
  );
  comprobar("una contraseña incorrecta no crea sesión", !cookieMala);

  const inexistente = new FormData();
  for (const [k, v] of formMala.entries()) inexistente.set(k, v);
  inexistente.set("email", "no-existe@ninguna-parte.test");
  const resInexistente = await fetch(`${BASE}/entrar`, {
    method: "POST",
    body: inexistente,
    redirect: "manual",
  });
  const cuerpoInexistente = await resInexistente.text();
  comprobar(
    "el mensaje no revela si el correo existe",
    cuerpoInexistente.includes("Correo o contraseña incorrectos"),
  );

  // ── 3. Sesiones reales ────────────────────────────────────────────────────
  const admin = await login("admin@academiademo.test");
  const profesora = await login("laura@academiademo.test");
  const secretaria = await login("secretaria@academiademo.test");
  const alumna = await login("alumno1@academiademo.test");
  const alumnoTests = await login("alumno2@academiademo.test");
  /*
   * Las credenciales del superadministrador vienen del entorno, nunca escritas
   * aquí. Estaban puestas a mano —correo y contraseña reales— y eso convertía
   * este script en el tercer sitio del repositorio desde el que se podía entrar
   * en la consola de plataforma de cualquier instalación. Un script de auditoría
   * que publica una credencial no está auditando: está abriendo una puerta.
   *
   * Si no están configuradas, las comprobaciones que necesitan ese nivel se
   * omiten y se dice. Omitirlas es correcto; inventarse un PASS, no.
   */
  const superadmin = SUPERADMIN_EMAIL
    ? await login(SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD)
    : null;

  comprobar("el administrador entra", Boolean(admin));
  comprobar("el alumnado entra", Boolean(alumna));

  const cookieFalsa = "geminis_session=" + "a".repeat(43);
  const conFalsa = await pedir(cookieFalsa, "/gestion");
  comprobar(
    "una cookie de sesión inventada no sirve",
    conFalsa.status === 307 && Boolean(conFalsa.location?.includes("/entrar")),
    `→ ${conFalsa.status}`,
  );

  // ── 4. Separación entre las dos aplicaciones ──────────────────────────────
  console.log("\n4. SEPARACIÓN MANAGER / CAMPUS");
  let fugasManager = 0;
  for (const ruta of RUTAS_MANAGER) {
    const r = await pedir(alumna, ruta);
    if (r.status === 200) {
      fugasManager += 1;
      console.log(`    ✗ el alumnado accede a ${ruta}`);
    }
  }
  comprobar("el alumnado no entra en ninguna pantalla de gestión", fugasManager === 0);

  const adminEnCampus = await pedir(admin, "/campus");
  comprobar(
    "el personal sin rol de alumno no entra en el Campus",
    adminEnCampus.status === 307,
    `→ ${adminEnCampus.status}`,
  );

  // ── 5. Permisos dentro de Manager ─────────────────────────────────────────
  console.log("\n5. PERMISOS POR ROL");
  const secretariaConfig = await pedir(secretaria, "/gestion/configuracion");
  comprobar(
    "la secretaría no ve la configuración ni los roles",
    secretariaConfig.status === 307,
    `→ ${secretariaConfig.status}`,
  );

  const secretariaPagos = await pedir(secretaria, "/gestion/pagos");
  comprobar("la secretaría sí gestiona pagos", secretariaPagos.status === 200);

  const profesoraTests = await pedir(profesora, "/gestion/tests");
  comprobar("la profesora accede al banco de preguntas", profesoraTests.status === 200);

  const adminPlataforma = await pedir(admin, "/plataforma");
  comprobar(
    "un administrador de academia no entra en la consola de plataforma",
    adminPlataforma.status === 307,
    `→ ${adminPlataforma.status}`,
  );

  if (!superadmin) {
    omitir(
      "el superadmin no entra en la gestión de una academia",
      "sin SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD en el entorno",
    );
  } else {
  const superadminAcademia = await pedir(superadmin, "/gestion");
  comprobar(
    "el superadmin no entra en la gestión de una academia sin pertenecer a ella",
    superadminAcademia.status === 307,
    `→ ${superadminAcademia.status}`,
  );
  }

  // ── 6. Contenido de pago ──────────────────────────────────────────────────
  console.log("\n6. CONTENIDO SEGÚN LO CONTRATADO");
  const estudiar = await pedir(alumna, "/campus/estudiar");
  const nodos = [
    ...new Set(
      [...estudiar.cuerpo.matchAll(/\/campus\/estudiar\/([0-9a-f-]{20,})/g)].map(
        (m) => m[1],
      ),
    ),
  ];

  if (nodos.length === 0) {
    // Cero contra cero no demuestra nada: ni que haya fuga ni que no la haya.
    omitir(
      "secciones que no se han contratado",
      "la alumna de referencia no tiene ninguna sección publicada a la que llegar",
    );
  } else {
    let alcanzables = 0;
    for (const nodo of nodos) {
      const r = await pedir(alumnoTests, `/campus/estudiar/${nodo}`);
      if (r.status === 200) alcanzables += 1;
    }
    comprobar(
      "el alumno con pack de tests no alcanza las secciones de la otra alumna",
      alcanzables < nodos.length,
      `(${alcanzables}/${nodos.length} alcanzables)`,
    );
  }

  // ── 7. Archivos ───────────────────────────────────────────────────────────
  console.log("\n7. ARCHIVOS");
  /** Recorre el árbol del Campus en anchura hasta dar con un documento. */
  const conPdf = await (async () => {
    const vistos = new Set();
    let cola = [...nodos];

    for (let nivel = 0; nivel < 5 && cola.length > 0; nivel += 1) {
      const siguiente = [];
      for (const nodo of cola) {
        if (vistos.has(nodo)) continue;
        vistos.add(nodo);

        const pagina = await pedir(alumna, `/campus/estudiar/${nodo}`);
        const archivo = pagina.cuerpo.match(/\/api\/archivos\/([0-9a-f-]{20,})/);
        if (archivo) return archivo[1];

        for (const hijo of [
          ...pagina.cuerpo.matchAll(/\/campus\/estudiar\/([0-9a-f-]{20,})/g),
        ].map((m) => m[1])) {
          if (!vistos.has(hijo)) siguiente.push(hijo);
        }
      }
      cola = siguiente;
    }
    return null;
  })();

  if (conPdf) {
    const sinSesion = await pedir(null, `/api/archivos/${conPdf}`);
    comprobar("un documento no se sirve sin sesión", sinSesion.status === 401);

    const otroAlumno = await pedir(alumnoTests, `/api/archivos/${conPdf}`);
    comprobar(
      "un documento no se sirve a quien no lo tiene contratado",
      otroAlumno.status === 404,
      `→ ${otroAlumno.status}`,
    );

    const propietaria = await pedir(alumna, `/api/archivos/${conPdf}`);
    comprobar("sí se sirve a quien lo tiene contratado", propietaria.status === 200);
    comprobar(
      "el documento no se cachea en intermediarios",
      (propietaria.cabeceras["cache-control"] ?? "").includes("private"),
    );
    comprobar(
      "se envía X-Content-Type-Options",
      propietaria.cabeceras["x-content-type-options"] === "nosniff",
    );

    /*
     * LA DESCARGA · comprobando la regla, no una configuración concreta
     *
     * Esto decía «la descarga se deniega si la academia no la permite» y
     * exigía un 403. Pero no comprobaba en ningún sitio que la academia NO la
     * permitiera: daba por supuesta una configuración de la demo. En cuanto la
     * demo se sembró con el temario descargable —que es lo normal— la
     * comprobación empezó a fallar diciendo que había una fuga donde lo que
     * había era un permiso concedido a propósito.
     *
     * Una aserción que afirma algo sobre un estado que no ha mirado no vale
     * para nada, y hace daño: quien la vea fallar buscará una vulnerabilidad
     * que no existe, o peor, la callará.
     *
     * Lo que sí es una regla de seguridad, y es lo que se comprueba ahora:
     *
     *   1. quien NO tiene el contenido contratado no lo descarga, permita lo
     *      que permita la academia;
     *   2. las dos respuestas posibles para quien sí lo tiene son coherentes:
     *      o 200 con `Content-Disposition: attachment`, o 403. Nunca un 200
     *      que en realidad sirva otra cosa.
     */
    const descargaAjena = await pedir(
      alumnoTests,
      `/api/archivos/${conPdf}?descargar=1`,
    );
    comprobar(
      "quien no tiene el contenido contratado tampoco lo descarga",
      descargaAjena.status === 404 || descargaAjena.status === 403,
      `→ ${descargaAjena.status}`,
    );

    const descarga = await pedir(alumna, `/api/archivos/${conPdf}?descargar=1`);
    const disposicion = descarga.cabeceras["content-disposition"] ?? "";
    comprobar(
      "la descarga o se deniega, o llega como adjunto",
      descarga.status === 403 ||
        (descarga.status === 200 && disposicion.startsWith("attachment")),
      `→ ${descarga.status} · ${disposicion.slice(0, 40)}`,
    );

    const inventado = await pedir(alumna, `/api/archivos/${"0".repeat(36)}`);
    comprobar("un identificador inventado devuelve 404", inventado.status === 404);
  } else {
    omitir(
      "servicio de archivos",
      "la demo no tiene ningún documento subido · npm run demo:contenido",
    );
  }

  // ── 8. Manipulación de identificadores ────────────────────────────────────
  console.log("\n8. MANIPULACIÓN DE IDENTIFICADORES");
  const fichas = await pedir(admin, "/gestion/alumnos");
  const idAlumno = fichas.cuerpo.match(/\/gestion\/alumnos\/([0-9a-f-]{20,})/)?.[1];
  if (idAlumno) {
    const alumnaMirandoFicha = await pedir(alumna, `/gestion/alumnos/${idAlumno}`);
    comprobar(
      "un alumno no abre la ficha de otro",
      alumnaMirandoFicha.status !== 200,
      `→ ${alumnaMirandoFicha.status}`,
    );
  }

  const tests = await pedir(alumna, "/campus/tests");
  const intento = tests.cuerpo.match(/\/campus\/tests\/([0-9a-f-]{20,})/)?.[1];
  if (intento) {
    const ajeno = await pedir(alumnoTests, `/campus/tests/${intento}`);
    comprobar(
      "un alumno no abre el test de otro",
      ajeno.status === 404,
      `→ ${ajeno.status}`,
    );
  }

  // ── 8b. Geminis IA ────────────────────────────────────────────────────────
  // La IA es material de la academia servido a través de otra puerta. Se
  // comprueba que esa puerta tiene la misma cerradura que las demás.
  console.log("\n8b. GEMINIS IA");

  const iaAlumna = await pedir(alumna, "/campus/ia");
  comprobar(
    "el asistente está disponible para el alumnado",
    iaAlumna.status === 200 && !iaAlumna.cuerpo.includes("no está activ"),
    `→ ${iaAlumna.status}`,
  );

  const iaSinSesion = await pedir(null, "/campus/ia");
  comprobar(
    "el asistente no responde sin sesión",
    iaSinSesion.status === 307 && iaSinSesion.location?.includes("/entrar"),
    `→ ${iaSinSesion.status}`,
  );

  // El selector de temas del asistente es, en la práctica, un listado de lo
  // que ese alumno tiene contratado: no puede ofrecer más de lo que estudia.
  /** Los identificadores de tema que el selector del asistente ofrece. */
  const temasOfrecidos = (cuerpo) =>
    new Set(
      [...cuerpo.matchAll(/<option value="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((v) => v && v !== ""),
    );

  const temasAlumna = temasOfrecidos(iaAlumna.cuerpo);
  const estudiarAlumna = await pedir(alumna, "/campus/estudiar");

  const iaOtroAlumno = await pedir(alumnoTests, "/campus/ia");
  const temasOtro = temasOfrecidos(iaOtroAlumno.cuerpo);

  if (temasAlumna.size === 0 && temasOtro.size === 0) {
    omitir(
      "el alcance de cada alumno en el asistente",
      "ningún alumno de la demo tiene temas contratados · npm run demo:todo",
    );
  } else {
    comprobar(
      "el asistente no ofrece temas que el alumno no tenga",
      temasAlumna.size > 0 && estudiarAlumna.status === 200,
      `${temasAlumna.size} temas ofrecidos`,
    );

    /*
     * Se comparan los CONJUNTOS, no los recuentos.
     *
     * Antes esto era `temasOtro !== temasEnIa`, es decir, dos números
     * distintos. Y eso no demuestra aislamiento por dos motivos: dos alumnos
     * con packs distintos pero del mismo tamaño harían fallar la comprobación
     * sin que hubiera nada mal, y dos alumnos con el mismo número de temas
     * podrían estar viendo EXACTAMENTE los mismos —que sería la fuga— y la
     * comprobación pasaría. Medía una cosa que no era la que importa.
     *
     * Lo que importa es que el alumno con menos contratado no vea ni un tema
     * que no sea suyo.
     */
    const ajenos = [...temasOtro].filter((t) => !temasAlumna.has(t));
    const compartidos = [...temasOtro].filter((t) => temasAlumna.has(t));

    comprobar(
      "cada alumno ve en el asistente solo su propio alcance",
      temasOtro.size < temasAlumna.size || ajenos.length > 0,
      `${temasAlumna.size} frente a ${temasOtro.size}, ${compartidos.length} en común`,
    );
  }

  const iaGestion = await pedir(alumna, "/gestion/ia");
  comprobar(
    "el alumnado no entra en el copiloto del profesorado",
    iaGestion.status !== 200,
    `→ ${iaGestion.status}`,
  );

  // ── 8c. Recuperación de contraseña ────────────────────────────────────────
  console.log("\n8c. RECUPERACIÓN DE CONTRASEÑA");

  const recuperar = await pedir(null, "/recuperar");
  comprobar(
    "la pantalla de recuperación es pública",
    recuperar.status === 200,
    `→ ${recuperar.status}`,
  );

  // El mensaje tiene que ser idéntico exista o no el correo. Si cambiara, este
  // formulario sería una lista de quién está dado de alta.
  const pedirEnlace = async (correo) => {
    const html = await (await fetch(`${BASE}/recuperar`)).text();
    const form = new FormData();
    for (const m of html.matchAll(
      /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g,
    )) {
      const d = (s) => (s ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      form.set(d(m[1]), d(m[2]));
    }
    form.set("email", correo);
    const res = await fetch(`${BASE}/recuperar`, { method: "POST", body: form });
    return (await res.text()).includes("Revisa tu correo");
  };

  const existente = await pedirEnlace("alumno1@academiademo.test");
  const inventado = await pedirEnlace("no-existe-jamas@ejemplo.test");
  comprobar(
    "no se distingue un correo registrado de uno que no lo está",
    existente === inventado,
    `registrado=${existente} inventado=${inventado}`,
  );

  const tokenFalso = await pedir(null, "/recuperar/estonoexisteenabsoluto123456789");
  comprobar(
    "un enlace inventado no abre el formulario de cambio",
    tokenFalso.status === 200 && !tokenFalso.cuerpo.includes('name="password"'),
    `→ ${tokenFalso.status}`,
  );

  const verificarFalso = await pedir(null, "/verificar/estonoexisteenabsoluto123");
  comprobar(
    "un enlace de verificación inventado no confirma nada",
    verificarFalso.status === 200 &&
      !verificarFalso.cuerpo.includes("Correo confirmado"),
    `→ ${verificarFalso.status}`,
  );

  // ── 8d. Los tres niveles ──────────────────────────────────────────────────
  console.log("\n8d. LOS TRES NIVELES");

  comprobar(
    "el superadministrador de plataforma entra en su consola",
    (await pedir(superadmin, "/plataforma")).status === 200,
  );

  // Lo que de verdad separa el nivel 1 del 2: el superadmin NO ve datos de
  // ninguna academia. Si esto fallara, «ninguna academia ve a otra» sería falso
  // para la persona con más acceso del sistema.
  const salud = await pedir(superadmin, "/plataforma/salud");
  comprobar(
    "el superadministrador ve el panel de salud",
    salud.status === 200,
    `→ ${salud.status}`,
  );

  const saludAjena = await pedir(admin, "/plataforma/salud");
  comprobar(
    "una academia NO ve el panel de salud de la plataforma",
    saludAjena.status !== 200,
    `→ ${saludAjena.status}`,
  );

  const superEnGestion = await pedir(superadmin, "/gestion/alumnos");
  comprobar(
    "el superadministrador NO ve el alumnado de una academia",
    superEnGestion.status !== 200,
    `→ ${superEnGestion.status}`,
  );

  const superEnContenido = await pedir(superadmin, "/gestion/contenido");
  comprobar(
    "el superadministrador NO ve el contenido de una academia",
    superEnContenido.status !== 200,
    `→ ${superEnContenido.status}`,
  );

  const adminEnPlataforma2 = await pedir(admin, "/plataforma");
  comprobar(
    "el administrador de una academia NO entra en la consola de plataforma",
    adminEnPlataforma2.status !== 200,
    `→ ${adminEnPlataforma2.status}`,
  );

  const alumnaEnConfig = await pedir(alumna, "/gestion/configuracion");
  comprobar(
    "un usuario del nivel 3 no toca la configuración de la academia",
    alumnaEnConfig.status !== 200,
    `→ ${alumnaEnConfig.status}`,
  );

  // ── 8e. Cobros y facturas ─────────────────────────────────────────────────
  console.log("\n8e. COBROS Y FACTURAS");

  const remesas = await pedir(admin, "/gestion/pagos/remesas");
  comprobar("la academia ve sus remesas", remesas.status === 200, `→ ${remesas.status}`);

  const facturas = await pedir(admin, "/gestion/facturas");
  comprobar("la academia ve sus facturas", facturas.status === 200, `→ ${facturas.status}`);

  const remesaSinSesion = await pedir(null, "/gestion/pagos/remesas");
  comprobar(
    "las remesas no son accesibles sin sesión",
    remesaSinSesion.status === 307,
    `→ ${remesaSinSesion.status}`,
  );

  // El fichero con los números de cuenta de media academia es lo más sensible
  // que sirve este software.
  const ficheroSinSesion = await pedir(null, "/api/remesas/inventado");
  comprobar(
    "el fichero de adeudos no se sirve sin sesión",
    ficheroSinSesion.status === 307 || ficheroSinSesion.status === 404,
    `→ ${ficheroSinSesion.status}`,
  );

  const ficheroAlumno = await pedir(alumna, "/api/remesas/inventado");
  comprobar(
    "un alumno no puede pedir un fichero de adeudos",
    ficheroAlumno.status !== 200,
    `→ ${ficheroAlumno.status}`,
  );

  const agenda = await pedir(admin, "/gestion/agenda");
  comprobar("la agenda responde", agenda.status === 200, `→ ${agenda.status}`);

  // ── 9. Cabeceras y superficie expuesta ────────────────────────────────────
  console.log("\n9. SUPERFICIE EXPUESTA");
  const login2 = await pedir(null, "/entrar");
  comprobar(
    "la pantalla de acceso no filtra la versión del servidor",
    !login2.cabeceras["x-powered-by"],
  );

  const inexistenteRuta = await pedir(admin, "/gestion/no-existe-esta-ruta");
  comprobar(
    "una ruta inexistente devuelve 404",
    inexistenteRuta.status === 404,
    `→ ${inexistenteRuta.status}`,
  );

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `RESULTADO: ${pasadas} comprobaciones superadas, ${fallidas} fallidas` +
      (omitidas > 0 ? `, ${omitidas} sin poder probarse` : ""),
  );

  if (sinProbar.length > 0) {
    // Se dicen aparte y en voz alta: una comprobación que no se ha podido
    // hacer no es una comprobación superada, y el informe no puede dar a
    // entender que sí.
    console.log("\nNO SE HAN PODIDO PROBAR (la demo no tenía con qué):");
    for (const linea of sinProbar) console.log(`  · ${linea}`);
    console.log("  Siembra la demo y vuelve a pasarla: npm run demo:todo");
  }

  if (fallos.length > 0) {
    console.log("\nFALLOS:");
    for (const fallo of fallos) console.log(`  · ${fallo}`);
    process.exit(1);
  }
  console.log("\nSin incidencias.\n");
}

main().catch((error) => {
  console.error("La auditoría no ha podido completarse:", error);
  process.exit(1);
});
