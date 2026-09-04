import { NextResponse, type NextRequest } from "next/server";

/**
 * CABECERA DE SEGURIDAD DEL CONTENIDO, CON TESTIGO POR PETICIÓN
 *
 * Antes esto vivía entero en `next.config.ts` y la línea que importaba decía:
 *
 *     script-src 'self' 'unsafe-inline'
 *
 * Con `unsafe-inline`, la política **no protege de un XSS**: si alguien
 * consigue meter un `<script>` en una página, el navegador lo ejecuta porque la
 * propia política le ha dicho que los scripts en línea valen. Es la defensa de
 * fondo que se supone que está debajo del saneador de HTML, y estaba abierta;
 * cuando se encontró la forma de rodear el saneador (ver `src/lib/sanitize.ts`),
 * debajo no había nada.
 *
 * Ahora cada petición lleva su propio testigo aleatorio. Next.js se lo pone a
 * los scripts que genera él —el tiempo de ejecución de React, los paquetes de
 * la página— y el navegador ejecuta solo los que lo llevan. Un script inyectado
 * no puede llevarlo: tendría que adivinar 128 bits nuevos en cada carga.
 *
 * `strict-dynamic` es lo que hace que esto sea mantenible: los scripts que
 * carga uno ya autorizado heredan el permiso, así que no hay que enumerar cada
 * fragmento que Next parta en dos el día que cambie su empaquetado.
 *
 * ── LOS ESTILOS, EN DOS MITADES ─────────────────────────────────────────────
 *
 * Con CSS también se roba: un `<style>` inyectado puede sacar el contenido de
 * un campo carácter a carácter con selectores de atributo y una imagen de
 * fondo, y puede tapar un botón con otro. Menos grave que un script, pero no
 * inocuo, y aquí estuvo abierto mucho tiempo con la excusa de que «el soporte
 * de `style-src-attr` es desigual», que era una suposición y no una medida.
 *
 * El problema real era que `style-src` no distingue entre un bloque `<style>`
 * —que no hace falta ninguno— y un atributo `style=`, que la interfaz sí usa:
 * la barra de progreso de un test, el color de marca de cada academia. Un
 * atributo no puede llevar testigo. CSP 3 sí los distingue:
 *
 *   · `style-src-elem` — los bloques y las hojas. **Sin `unsafe-inline`.**
 *   · `style-src-attr` — los atributos. Con `unsafe-inline`, porque no hay
 *     alternativa mientras la interfaz los use.
 *   · `style-src` se queda como estaba, y ahí está la gracia: un navegador que
 *     no entienda las dos anteriores las ignora y cae en ésta. Ninguno queda
 *     peor que antes, y los que entienden CSP 3 quedan mejor.
 *
 * Cerrarlo destapó que la aplicación inyectaba una hoja de estilos en cada
 * carga sin que nadie la pidiera: `sonner`, la librería de avisos, montada en
 * el layout y con **cero llamadas a `toast()` en todo el proyecto**. Buscando
 * qué más inyectaba estilos aparecieron otros catorce paquetes de Radix
 * declarados y sin usar. Todo fuera. La comprobación de seguridad acabó
 * encontrando código muerto, que es lo que suele pasar cuando se comprueba en
 * vez de suponer.
 *
 * **Si algún día se añade una librería que cree hojas de estilo al vuelo** —los
 * diálogos de Radix lo hacen para bloquear el desplazamiento del fondo— hay que
 * pasarle el testigo o su estilo se bloqueará. Y no se verá al cargar la
 * página: hará falta abrir el diálogo. Las que usan `react-style-singleton` se
 * arreglan llamando a `setNonce` de `get-nonce` con la cabecera `x-nonce` desde
 * un componente de cliente montado en el layout.
 *
 * En desarrollo, `style-src-elem` sí lleva `unsafe-inline`: Turbopack inyecta
 * los estilos en bloques dentro del documento. Y lo lleva **en vez de** testigo,
 * no además: cuando hay testigo, la norma dice que `unsafe-inline` se ignora.
 *
 * `unsafe-eval` sigue solo en desarrollo, donde React lo necesita para
 * reconstruir las trazas de error del servidor en el navegador. En producción
 * ni React ni Next lo usan.
 *
 * Documentación de la versión instalada:
 * node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
 */

/**
 * Un testigo nuevo por petición.
 *
 * Tiene que ser impredecible: si se repitiera —o si se derivara de algo que un
 * atacante pueda ver— dejaría de servir para nada, porque bastaría con
 * incluirlo en el script inyectado. `randomUUID` va sobrado y está disponible
 * en el entorno donde corre esto, que no es Node completo.
 */
function generarTestigo(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

export function proxy(request: NextRequest) {
  const testigo = generarTestigo();
  const enDesarrollo = process.env.NODE_ENV === "development";

  const politica = [
    "default-src 'self'",
    // El testigo y `strict-dynamic`: se acabó `unsafe-inline` para scripts.
    `script-src 'self' 'nonce-${testigo}' 'strict-dynamic'${enDesarrollo ? " 'unsafe-eval'" : ""}`,
    // El respaldo para navegadores sin CSP 3, que ignoran las dos siguientes.
    "style-src 'self' 'unsafe-inline'",
    // Los bloques `<style>` y las hojas: nada en línea. En desarrollo sí,
    // porque Turbopack inyecta los estilos dentro del documento.
    enDesarrollo
      ? "style-src-elem 'self' 'unsafe-inline'"
      : `style-src-elem 'self' 'nonce-${testigo}'`,
    // Los atributos `style=`, que la interfaz usa y no pueden llevar testigo.
    "style-src-attr 'unsafe-inline'",
    // `https:` para las imágenes porque el temario de una academia puede
    // enlazar ilustraciones alojadas fuera; `blob:` lo usa la mochila sin
    // conexión, que reconstruye los documentos guardados en el dispositivo.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // Los PDF se muestran en un iframe del propio dominio.
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    // Que un formulario no pueda enviar a ningún sitio de fuera. Sin esto, un
    // formulario inyectado se lleva lo que escriba quien lo rellene.
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  // El testigo viaja en la petición para que Next lo lea al renderizar, y en la
  // respuesta para que el navegador sepa cuál acepta. Las dos cosas hacen falta.
  const cabecerasDePeticion = new Headers(request.headers);
  cabecerasDePeticion.set("x-nonce", testigo);
  cabecerasDePeticion.set("Content-Security-Policy", politica);

  const respuesta = NextResponse.next({
    request: { headers: cabecerasDePeticion },
  });
  respuesta.headers.set("Content-Security-Policy", politica);

  return respuesta;
}

export const config = {
  matcher: [
    /*
     * Todas las páginas menos:
     *   · /api        — sus respuestas no son documentos con scripts, y tienen
     *                   su propia política, más cerrada, en next.config.ts;
     *   · _next/static y _next/image — archivos ya generados;
     *   · favicon, manifiesto y trabajador de servicio — sin scripts propios.
     *
     * Y sin las precargas de `next/link`: son peticiones que no pintan nada, y
     * darles un testigo distinto al del documento que acaba cargando confunde
     * más que ayuda.
     */
    {
      source:
        "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
