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
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js necesita inline para su arranque; en desarrollo además eval.
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      // Los PDFs se muestran en un iframe del propio dominio.
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // No anunciamos con qué está hecho: es información gratuita para quien busca
  // vulnerabilidades conocidas de una versión concreta.
  poweredByHeader: false,

  async headers() {
    const cabeceras = [...cabecerasSeguridad];

    if (process.env.NODE_ENV === "production") {
      cabeceras.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [{ source: "/:path*", headers: cabeceras }];
  },
};

export default nextConfig;
