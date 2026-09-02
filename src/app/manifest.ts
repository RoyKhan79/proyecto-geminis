import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/**
 * Manifiesto de la aplicación instalable (§46).
 *
 * Decisión ADR-0021: la app del alumnado es una PWA, no una aplicación nativa.
 * Se instala en la pantalla de inicio, se abre sin barra de navegador y podrá
 * recibir notificaciones. Motivos:
 *
 *   · una sola base de código para móvil, tablet y escritorio;
 *   · las correcciones llegan al alumno sin pasar por revisión de tienda, que
 *     para un producto que cambia cada semana es determinante;
 *   · sin comisiones de tienda sobre lo que cobre la academia.
 *
 * Si más adelante hace falta estar en App Store y Google Play, la arquitectura
 * no lo impide: se envuelve la PWA o se hace una app nativa contra la misma API.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} · Campus`,
    short_name: BRAND.name,
    description:
      "Estudia tu oposición: temario, clases, tests y seguimiento de tu progreso.",
    // Al instalarse se abre directamente en el Campus, no en la pantalla de
    // acceso genérica: quien instala la app es el alumnado.
    start_url: "/campus",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f3ef",
    // La tinta de la marca, no el azul de antes: es el color de la barra del
    // sistema cuando la app está instalada, y tiene que ser el del sello.
    theme_color: "#232c44",
    lang: "es-ES",
    categories: ["education"],
    icons: [
      {
        src: "/icono-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icono-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icono-mascara.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Estudiar", url: "/campus/estudiar" },
      { name: "Tests", url: "/campus/tests" },
      { name: "Avisos", url: "/campus/avisos" },
    ],
  };
}
