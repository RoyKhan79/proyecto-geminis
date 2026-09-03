import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad.
 *
 * Se aplican a todas las respuestas. Cada una está aquí por un motivo concreto,
 * no por copiar una lista de internet:
 *
 *   · `X-Frame-Options` y `frame-ancestors`: nadie puede meter el Campus dentro
 *     de un iframe suyo para robar clics o capturar credenciales.
 *   · `Referrer-Policy`: al salir a un enlace externo no se filtra la URL
 *     interna, que puede llevar identificadores de alumnos.
 *   · `Permissions-Policy`: la aplicación no necesita cámara, micrófono ni
 *     geolocalización; se niegan de entrada.
 *   · `Content-Security-Policy`: limita de dónde se puede cargar código. Es la
 *     defensa de fondo contra XSS si algún día se cuela HTML sin sanear.
 *   · `Strict-Transport-Security`: solo en producción, donde hay HTTPS.
 */
const cabecerasSeguridad = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

/**
 * La política de las respuestas de API.
 *
 * La de las páginas ya NO está aquí: la pone `src/proxy.ts`, que genera un
 * testigo distinto en cada petición y así puede prescindir de `unsafe-inline`
 * para los scripts. Poner también una aquí sería contraproducente: dos
 * cabeceras `Content-Security-Policy` no se suman, se aplican las dos, y la de
 * aquí —sin el testigo— bloquearía justo los scripts que la otra autoriza.
 *
 * Las rutas de `/api` quedan fuera del proxy, así que llevan la suya, y es más
 * cerrada porque puede serlo: ninguna respuesta de API es un documento con
 * scripts. Eso importa más de lo que parece en `/api/archivos`, que sirve lo
 * que ha subido una academia: aunque un día se colara ahí un HTML con el tipo
 * equivocado, con `script-src 'none'` no ejecutaría nada.
 */
const cspDeApi = [
  "default-src 'none'",
  "script-src 'none'",
  // Los PDF y las imágenes se abren en un iframe o una etiqueta del propio
  // sitio, y el visor del navegador necesita poder pintarlos.
  "img-src 'self' data: blob:",
  "style-src 'unsafe-inline'",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // No anunciamos con qué está hecho: es información gratuita para quien busca
  // vulnerabilidades conocidas de una versión concreta.
  poweredByHeader: false,

  experimental: {
    /*
     * EL TAMAÑO DE LO QUE SE PUEDE SUBIR
     *
     * Next corta el cuerpo de una Server Action en 1 MB por defecto, y en este
     * proyecto TODAS las subidas van por Server Actions: temario, exámenes,
     * tareas, importaciones y la foto del alumno. Sin esta línea, el producto
     * no admitía ningún archivo de más de 1 MB.
     *
     * Lo peor no era el límite, era que nadie lo sabía: cada sitio comprobaba
     * su propio tope —200 MB el temario, 10 MB el Excel, 5 MB la foto— y esas
     * comprobaciones no se alcanzaban nunca. El usuario no veía «la foto no
     * puede pasar de 5 MB», veía una pantalla de error de Next.
     *
     * 32 MB y no 200: el cuerpo de una Server Action se carga ENTERO en
     * memoria antes de llegar al código, así que el número no es una promesa
     * gratis, son megas de RAM por subida simultánea. 32 da de sobra para un
     * tema escaneado y para cualquier Excel de alumnos, y no tumba el servidor
     * si tres profesores suben a la vez.
     *
     * Para vídeo hace falta otra cosa: una ruta que reciba en flujo y escriba
     * directamente en el almacén, sin pasar por memoria. No existe todavía y
     * está anotado en docs/DECISIONS.md.
     */
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },

  async headers() {
    const cabeceras = [...cabecerasSeguridad];

    if (process.env.NODE_ENV === "production") {
      cabeceras.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [
      { source: "/:path*", headers: cabeceras },
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: cspDeApi }],
      },
    ];
  },
};

export default nextConfig;
