/**
 * SANEADO DE HTML
 *
 * El contenido enriquecido que sube una academia (apuntes, explicaciones) se
 * pinta como HTML. Sin sanear, cualquiera con permiso de contenido podría
 * inyectar un script que se ejecutaría en el navegador de todo su alumnado, y
 * en un producto multi-tenant eso es un problema mucho mayor que un defacement:
 * ese script corre con la sesión de quien lo lee.
 *
 * Enfoque de LISTA BLANCA: se permite lo que se sabe seguro y se descarta el
 * resto. Lo contrario —listar lo peligroso— siempre se queda corto.
 *
 * Se aplica DOS veces, a propósito:
 *   · al guardar, para no almacenar basura,
 *   · al pintar, porque puede haber contenido guardado antes de existir esto.
 */

/** Etiquetas admitidas. Suficientes para unos apuntes decentes. */
const ETIQUETAS = new Set([
  "p", "br", "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "dl", "dt", "dd",
  "blockquote", "pre", "code",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "a", "img", "figure", "figcaption", "hr", "div", "span",
]);

/** Atributos admitidos por etiqueta. Lo no listado se elimina. */
const ATRIBUTOS: Record<string, Set<string>> = {
  a: new Set(["href", "title"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  td: new Set(["colspan", "rowspan"]),
};

/**
 * Esquemas de URL admitidos. `javascript:` y `data:` quedan fuera: el primero
 * ejecuta código y el segundo permite incrustar un documento entero.
 */
const ESQUEMAS = /^(https?:\/\/|mailto:|\/|#)/i;

/**
 * Limpia HTML escrito por una persona antes de pintarlo.
 *
 * @param html Lo que ha escrito la academia en el editor.
 * @returns El mismo texto sin nada ejecutable: fuera `<script>`, fuera los
 *   atributos `on*` y fuera los enlaces `javascript:`. Los enlaces que quedan
 *   salen con `rel="noopener noreferrer nofollow"`.
 * @remarks Se aplica **al guardar y también al pintar**. Dos veces a propósito:
 *   puede haber contenido guardado antes de que existiera el saneador, y un
 *   script inyectado se ejecutaría con la sesión de quien lo lee.
 */
export function sanitizeHtml(sucio: string | null | undefined): string {
  if (!sucio) return "";

  let limpio = sucio;

  // 1. Fuera bloques completos que nunca deben pasar, con su contenido.
  limpio = limpio.replace(
    /<(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta|base|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
    "",
  );
  // Y sus versiones sin cierre.
  limpio = limpio.replace(
    /<(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta|base)\b[^>]*>/gi,
    "",
  );

  // 2. Comentarios: pueden esconder trucos de parseo condicional.
  limpio = limpio.replace(/<!--[\s\S]*?-->/g, "");

  // 3. Recorre las etiquetas restantes y filtra atributos.
  limpio = limpio.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*)?)\/?>/g,
    (_todo, cierre: string, etiqueta: string, atributos: string) => {
      const nombre = etiqueta.toLowerCase();
      if (!ETIQUETAS.has(nombre)) return "";
      if (cierre) return `</${nombre}>`;

      const permitidos = ATRIBUTOS[nombre];
      if (!permitidos) return `<${nombre}>`;

      const conservados: string[] = [];
      for (const attr of atributos.matchAll(
        /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g,
      )) {
        const clave = attr[1].toLowerCase();
        const valor = attr[3] ?? attr[4] ?? attr[5] ?? "";

        if (!permitidos.has(clave)) continue;

        // Cualquier atributo de evento (onclick, onerror…) queda descartado por
        // no estar en la lista, pero lo comprobamos también por si acaso.
        if (clave.startsWith("on")) continue;

        if ((clave === "href" || clave === "src") && !ESQUEMAS.test(valor.trim())) {
          continue;
        }

        conservados.push(`${clave}="${escaparAtributo(valor)}"`);
      }

      // Los enlaces externos se abren fuera y sin arrastrar la referencia.
      if (nombre === "a") {
        conservados.push('rel="noopener noreferrer nofollow"', 'target="_blank"');
      }

      const cola = nombre === "img" || nombre === "hr" || nombre === "br" ? " /" : "";
      return `<${nombre}${conservados.length ? " " + conservados.join(" ") : ""}${cola}>`;
    },
  );

  return limpio.trim();
}

function escaparAtributo(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Convierte HTML en texto plano. Útil para resúmenes e indexación. */
export function htmlAtexto(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}
