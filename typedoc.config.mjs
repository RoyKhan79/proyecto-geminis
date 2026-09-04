/**
 * REFERENCIA DEL CÓDIGO
 *
 * El equivalente de Doxygen para TypeScript. Doxygen entiende C, C++ y unos
 * cuantos más, pero de TypeScript solo lee lo que se le parece a JavaScript:
 * pierde los tipos, los genéricos y los tipos de retorno, que aquí es justo lo
 * que hay que documentar. TypeDoc lee el proyecto con el compilador de
 * TypeScript, así que los tipos que salen en la referencia son los de verdad y
 * no una copia escrita a mano que se desactualiza al primer cambio.
 *
 * Las etiquetas son las de siempre —@param, @returns, @throws, @example— y se
 * escriben igual.
 *
 *   npm run docs         genera la referencia en docs/api
 *   npm run docs:faltan  solo dice qué queda sin documentar, sin generar nada
 *
 * La salida no entra en el repositorio: son miles de archivos y se rehacen en
 * segundos. Lo que se versiona son los comentarios del código.
 *
 * Se usa configuración en JavaScript y no en JSON porque el JSON no admite
 * comentarios, y en este proyecto una configuración sin explicar es una
 * configuración que nadie se atreve a tocar.
 */

/** @type {Partial<import("typedoc").TypeDocOptions>} */
const configuracion = {
  // `expand` recorre las carpetas y toma cada archivo como punto de entrada.
  // Es lo que hace falta aquí: no hay un único `index.ts` que exporte todo,
  // sino módulos por área, y esa separación es intencionada.
  entryPoints: ["src/lib", "src/server", "src/components", "src/app"],
  entryPointStrategy: "expand",

  exclude: [
    "**/node_modules/**",
    // Lo genera Prisma: son cien mil líneas de tipos que nadie escribió y que
    // ahogarían la referencia de lo que sí hemos escrito nosotros.
    "**/src/generated/**",
    "**/*.test.ts",
    "**/*.d.ts",
  ],

  out: "docs/api",
  name: "Catedria · referencia del código",
  readme: "docs/API_README.md",

  includeVersion: false,
  hideGenerator: true,
  categorizeByGroup: true,

  // Orden de aparición en el archivo, no alfabético. Los módulos de este
  // proyecto están escritos para leerse de arriba abajo.
  sort: ["source-order"],

  excludeInternal: true,
  excludePrivate: false,

  /**
   * Avisa de lo que falta en lugar de generar una referencia llena de huecos en
   * silencio. `notDocumented` es la lista de trabajo pendiente, y por eso
   * existe `npm run docs:faltan`.
   *
   * No se tratan como errores: la referencia con huecos sigue siendo útil, y
   * romper la compilación por un comentario que falta acaba en que alguien
   * apaga la comprobación entera.
   */
  validation: {
    notExported: true,
    invalidLink: true,
    notDocumented: true,
  },
  treatValidationWarningsAsErrors: false,
};

export default configuracion;
