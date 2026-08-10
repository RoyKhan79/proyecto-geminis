/**
 * Identidad del producto.
 *
 * El nombre está en un único sitio porque es provisional: cuando se decida el
 * definitivo se cambia aquí y no hay que buscarlo por toda la aplicación.
 * Los identificadores internos (paquete npm, base de datos, rutas) siguen
 * usando `geminis` a propósito: renombrarlos no aporta nada y rompe cosas.
 */
export const BRAND = {
  /** Nombre visible del producto. */
  name: "Proyecto Geminis",
  /** Versión corta para espacios estrechos (barra lateral, móvil). */
  short: "Proyecto Geminis",
  /** Inicial del logotipo. */
  initial: "G",
  /** Aplicación de gestión para la academia. */
  manager: "Manager",
  /** Aplicación del alumnado. */
  campus: "Campus",
  /** Asistente de inteligencia artificial. */
  ai: "IA de Proyecto Geminis",
} as const;
