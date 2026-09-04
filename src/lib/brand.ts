/**
 * Identidad del producto.
 *
 * El nombre está en un único sitio. Lo estuvo primero porque era provisional
 * —el producto se llamó Geminis hasta que se comprobó que el nombre no era
 * usable— y sigue estándolo porque una academia puede poner el suyo (§60).
 * Los identificadores internos (paquete npm, base de datos, rutas) usan
 * `catedria` y no se tocan: renombrarlos no aporta nada y rompe cosas.
 *
 * Aquí solo van los textos. El **signo** está en `src/components/marca.tsx`
 * —para la pantalla— y en `scripts/iconos.ts` —para los PNG del icono
 * instalable—. Hubo aquí una `initial: "G"` que dibujaba el logotipo como una
 * letra suelta en la tipografía del sistema; se quitó al haber marca de verdad,
 * porque un nombre y un dibujo no se mantienen en el mismo sitio.
 */
export const BRAND = {
  /** Nombre visible del producto. */
  name: "Catedria",
  /** Versión corta para espacios estrechos (barra lateral, móvil). */
  short: "Catedria",
  /** Aplicación de gestión para la academia. */
  manager: "Manager",
  /** Aplicación del alumnado. */
  campus: "Campus",
  /** Asistente de inteligencia artificial. */
  ai: "IA de Catedria",
} as const;
