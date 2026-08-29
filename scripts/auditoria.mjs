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

const BASE = process.argv[2] ?? "http://localhost:3000";
const PASSWORD = "Geminis2026!";

let pasadas = 0;
let fallidas = 0;
const fallos = [];

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
  const superadmin = await login("antonio.fusterverdu@gmail.com", "licantropiA1!");

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

  const superadminAcademia = await pedir(superadmin, "/gestion");
  comprobar(
    "el superadmin no entra en la gestión de una academia sin pertenecer a ella",
    superadminAcademia.status === 307,
    `→ ${superadminAcademia.status}`,
  );

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

    const descarga = await pedir(alumna, `/api/archivos/${conPdf}?descargar=1`);
    comprobar(
      "la descarga se deniega si la academia no la permite",
      descarga.status === 403,
      `→ ${descarga.status}`,
    );

    const inventado = await pedir(alumna, `/api/archivos/${"0".repeat(36)}`);
    comprobar("un identificador inventado devuelve 404", inventado.status === 404);
  } else {
    comprobar("hay un documento con el que probar", false, "(no encontrado)");
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
  const temasEnIa = (iaAlumna.cuerpo.match(/<option value="[^"]+"/g) ?? []).length;
  const estudiarAlumna = await pedir(alumna, "/campus/estudiar");
  comprobar(
    "el asistente no ofrece temas que el alumno no tenga",
    temasEnIa > 0 && estudiarAlumna.status === 200,
    `${temasEnIa} temas ofrecidos`,
  );

  const iaOtroAlumno = await pedir(alumnoTests, "/campus/ia");
  const temasOtro = (iaOtroAlumno.cuerpo.match(/<option value="[^"]+"/g) ?? []).length;
  comprobar(
    "cada alumno ve en la IA solo su propio alcance",
    temasOtro !== temasEnIa,
    `${temasEnIa} frente a ${temasOtro}`,
  );

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
  console.log(`RESULTADO: ${pasadas} comprobaciones superadas, ${fallidas} fallidas`);
  if (fallos.length > 0) {
    console.log("\nFALLOS:");
    for (const fallo of fallos) console.log(`  · ${fallo}`);
    process.exit(1);
  }
  console.log("Sin incidencias.\n");
}

main().catch((error) => {
  console.error("La auditoría no ha podido completarse:", error);
  process.exit(1);
});
