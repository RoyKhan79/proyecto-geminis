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
 * ── LO QUE NO SE HA QUITADO Y POR QUÉ ───────────────────────────────────────
 *
 * `style-src` conserva `unsafe-inline`. No es un olvido: la interfaz usa
 * atributos `style` en varios sitios (la barra de progreso de un test, el color
 * de marca de cada academia) y esos atributos no los cubre un testigo, hace
 * falta `style-src-attr`, cuyo soporte todavía es desigual. El riesgo tampoco
 * es comparable: con CSS en línea se puede afear una página; con JavaScript en
 * línea se roba una sesión. Queda anotado como lo que es, un pendiente.
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
    // Pendiente: quitar `unsafe-inline` de aquí requiere sacar los atributos
    // `style` de la interfaz. Ver la explicación de arriba.
    "style-src 'self' 'unsafe-inline'",
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
