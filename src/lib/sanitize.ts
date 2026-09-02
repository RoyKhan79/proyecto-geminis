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
 *
 * ── POR QUÉ ESTO ES UN RECORRIDO Y NO UNA EXPRESIÓN REGULAR ─────────────────
 *
 * La versión anterior buscaba etiquetas con una expresión regular y filtraba
 * los atributos de las que encontraba. Tenía un fallo que no era un descuido,
 * sino la consecuencia inevitable del método: **lo que la expresión no
 * reconocía como etiqueta salía intacto**. Y hay muchas formas de escribir algo
 * que un navegador entiende como etiqueta y una expresión regular no. La que se
 * demostró explotable:
 *
 *     <img/src=x onerror=alert(1)>
 *
 * La barra hace de separador para el navegador, que ejecuta el `onerror`; para
 * la expresión regular no era una etiqueta y por eso ni se tocaba. Lo mismo con
 * `<div/onmouseover=…>`. Con esa entrada, un profesor podía robarle la sesión a
 * cualquier alumno que abriera el tema, y a cualquier administrador que lo
 * revisara.
 *
 * La lección no es «arregla la expresión»: es que **la regla de fallo estaba
 * al revés**. Lo que no se entiende no puede pasar; tiene que escaparse. Esto
 * recorre el texto de principio a fin, sabe cuándo está dentro de unas comillas
 * y emite solo lo que ha reconocido. Todo lo demás se convierte en texto
 * visible, que como mucho es feo, nunca peligroso.
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

/** Las que no llevan cierre. Se emiten cerradas sobre sí mismas. */
const VACIAS = new Set(["br", "hr", "img"]);

/**
 * Etiquetas cuyo contenido NO es HTML para el navegador.
 *
 * Dentro de un `<script>` o un `<style>`, el navegador no busca etiquetas: se
 * traga todo hasta el cierre correspondiente. Si aquí se descartara solo la
 * etiqueta de apertura y se siguiera recorriendo lo de dentro, el cuerpo del
 * script acabaría pintado como texto —o peor, reinterpretado—. Se salta entero.
 *
 * `svg` y `math` van en la lista por otro motivo: dentro de ellos valen reglas
 * de análisis distintas (XML) donde `<style>` o los atributos de evento se
 * comportan de otra forma. No hay ningún apunte que los necesite.
 */
const CON_CUERPO_CRUDO = new Set([
  "script", "style", "textarea", "title", "svg", "math", "iframe", "noscript",
  "template", "xmp",
]);

/**
 * Esquemas de URL admitidos. `javascript:` y `data:` quedan fuera: el primero
 * ejecuta código y el segundo permite incrustar un documento entero.
 */
const ESQUEMAS = /^(https?:\/\/|mailto:|\/|#)/i;

/** Nombre válido de atributo. Cualquier otra cosa no se conserva. */
const NOMBRE_ATRIBUTO = /^[a-zA-Z][a-zA-Z0-9-]*$/;

/**
 * ¿Se puede usar esta URL?
 *
 * Se quitan antes los espacios y los caracteres de control, porque
 * `java\tscript:` y `java\nscript:` los ignora el navegador y llegarían aquí
 * como algo que no empieza por `javascript:`. Después se exige que la dirección
 * empiece por un esquema de la lista: es una comprobación positiva, así que un
 * esquema nuevo que a nadie se le haya ocurrido tampoco pasa.
 */
function urlAdmitida(valor: string): boolean {
  // Todo lo que esté por debajo del espacio, el DEL y el espacio duro. Se
  // recorre carácter a carácter en lugar de escribir un rango con caracteres
  // de control dentro del código fuente, que es ilegible y se estropea en
  // cuanto alguien reformatea el archivo.
  let limpio = "";
  for (const caracter of valor) {
    const codigo = caracter.codePointAt(0) ?? 0;
    if (codigo <= 0x20 || (codigo >= 0x7f && codigo <= 0xa0)) continue;
    limpio += caracter;
  }
  return ESQUEMAS.test(limpio);
}

/**
 * Una entidad HTML ya escrita: `&amp;`, `&nbsp;`, `&#233;`, `&#x41;`.
 *
 * Hace falta porque el saneador se pasa DOS veces sobre el mismo texto —una al
 * guardar y otra al pintar— y `&` no se puede escapar a ciegas: la segunda
 * pasada convertiría el `&lt;` que dejó la primera en `&amp;lt;`, y el alumno
 * vería `&lt;` escrito en mitad de sus apuntes. Escapar solo los `&` que no
 * abren una entidad deja el saneado idempotente, que es la propiedad que esa
 * doble pasada necesita.
 */
const ENTIDAD = /^&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/;

function escaparAmpersand(valor: string): string {
  return valor.replace(/&/g, (_coincidencia, posicion: number) =>
    ENTIDAD.test(valor.slice(posicion, posicion + 34)) ? "&" : "&amp;",
  );
}

function escaparTexto(valor: string): string {
  return escaparAmpersand(valor).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escaparAtributo(valor: string): string {
  return escaparAmpersand(valor)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Una etiqueta ya leída del texto.
 *
 * `fin` es la posición justo después del `>`, y es lo que permite seguir
 * recorriendo sin volver a analizar lo mismo.
 */
type Etiqueta = {
  nombre: string;
  cierre: boolean;
  atributos: { clave: string; valor: string }[];
  fin: number;
};

/**
 * Lee una etiqueta a partir del `<` que hay en `inicio`.
 *
 * Es el corazón del asunto y por eso está escrito a mano: entiende las mismas
 * cosas que un navegador —comillas simples y dobles, valores sin comillas,
 * barras y espacios sueltos entre atributos— y, sobre todo, **no se pierde con
 * un `>` que esté dentro de unas comillas**. Ese era otro camino de evasión de
 * la versión anterior.
 *
 * @returns La etiqueta leída, o `null` si lo que hay ahí no llega a serlo (un
 *   `<` suelto, o una etiqueta que se queda sin cerrar al final del texto). En
 *   ese caso quien llama escapa el carácter y sigue: nunca lo copia tal cual.
 */
function leerEtiqueta(html: string, inicio: number): Etiqueta | null {
  let i = inicio + 1;
  const cierre = html[i] === "/";
  if (cierre) i += 1;

  const inicioNombre = i;
  while (i < html.length && /[a-zA-Z0-9]/.test(html[i])) i += 1;
  if (i === inicioNombre) return null; // «<» que no abre ninguna etiqueta.

  const nombre = html.slice(inicioNombre, i).toLowerCase();
  const atributos: { clave: string; valor: string }[] = [];

  while (i < html.length) {
    // Entre atributos puede haber espacios y barras; el navegador las ignora, y
    // aquí también. Justo por confiar en que solo hubiera espacios se colaba
    // `<img/src=x onerror=…>`.
    while (i < html.length && /[\s/]/.test(html[i])) i += 1;

    if (i >= html.length) return null; // Se acabó el texto sin cerrar: no vale.
    if (html[i] === ">") return { nombre, cierre, atributos, fin: i + 1 };

    const inicioClave = i;
    while (i < html.length && !/[\s/>=]/.test(html[i])) i += 1;
    const clave = html.slice(inicioClave, i).toLowerCase();
    if (!clave) {
      // Un carácter que no encaja en nada (por ejemplo `=` suelto): se salta
      // para no quedarse dando vueltas en el mismo sitio.
      i += 1;
      continue;
    }

    while (i < html.length && /\s/.test(html[i])) i += 1;

    let valor = "";
    if (html[i] === "=") {
      i += 1;
      while (i < html.length && /\s/.test(html[i])) i += 1;

      const comilla = html[i];
      if (comilla === '"' || comilla === "'") {
        i += 1;
        const inicioValor = i;
        while (i < html.length && html[i] !== comilla) i += 1;
        if (i >= html.length) return null; // Comillas sin cerrar: no vale.
        valor = html.slice(inicioValor, i);
        i += 1;
      } else {
        const inicioValor = i;
        while (i < html.length && !/[\s>]/.test(html[i])) i += 1;
        valor = html.slice(inicioValor, i);
      }
    }

    atributos.push({ clave, valor });
  }

  return null;
}

/**
 * Limpia HTML escrito por una persona antes de pintarlo.
 *
 * @param sucio Lo que ha escrito la academia en el editor.
 * @returns El mismo texto sin nada ejecutable: fuera `<script>`, fuera los
 *   atributos `on*` y fuera los enlaces `javascript:`. Los enlaces que quedan
 *   salen con `rel="noopener noreferrer nofollow"`.
 * @remarks Se aplica **al guardar y también al pintar**. Dos veces a propósito:
 *   puede haber contenido guardado antes de que existiera el saneador, y un
 *   script inyectado se ejecutaría con la sesión de quien lo lee.
 *
 * @example
 * ```ts
 * sanitizeHtml("<p>Plazo: <b>15 días</b></p>");   // igual
 * sanitizeHtml("<img/src=x onerror=alert(1)>");   // ""
 * sanitizeHtml("<a href='javascript:x'>y</a>");   // enlace sin href
 * ```
 */
export function sanitizeHtml(sucio: string | null | undefined): string {
  if (!sucio) return "";

  const salida: string[] = [];
  let i = 0;

  while (i < sucio.length) {
    const siguiente = sucio.indexOf("<", i);

    if (siguiente === -1) {
      salida.push(escaparTexto(sucio.slice(i)));
      break;
    }

    if (siguiente > i) salida.push(escaparTexto(sucio.slice(i, siguiente)));

    // Comentarios: pueden esconder trucos de análisis condicional, y dentro de
    // uno mal cerrado se puede meter cualquier cosa. Se van enteros.
    if (sucio.startsWith("<!--", siguiente)) {
      const cierre = sucio.indexOf("-->", siguiente + 4);
      i = cierre === -1 ? sucio.length : cierre + 3;
      continue;
    }

    // Declaraciones e instrucciones de proceso: `<!DOCTYPE …>`, `<?xml …>`.
    if (sucio[siguiente + 1] === "!" || sucio[siguiente + 1] === "?") {
      const cierre = sucio.indexOf(">", siguiente);
      i = cierre === -1 ? sucio.length : cierre + 1;
      continue;
    }

    const etiqueta = leerEtiqueta(sucio, siguiente);

    // AQUÍ ESTÁ LA REGLA QUE IMPORTA: si no se ha entendido, se escapa el «<» y
    // se sigue desde el carácter siguiente. Nunca se copia tal cual, que es lo
    // que hacía la versión de expresiones regulares y lo que la rompía.
    if (!etiqueta) {
      salida.push("&lt;");
      i = siguiente + 1;
      continue;
    }

    // Etiquetas cuyo cuerpo no es HTML: se salta hasta su cierre, contenido
    // incluido. Si no aparece el cierre, se descarta lo que queda: un `<script`
    // sin cerrar al final no puede convertirse en texto pintable.
    if (CON_CUERPO_CRUDO.has(etiqueta.nombre)) {
      if (etiqueta.cierre) {
        i = etiqueta.fin;
        continue;
      }
      const cierre = new RegExp(`</${etiqueta.nombre}\\s*>`, "i").exec(
        sucio.slice(etiqueta.fin),
      );
      i = cierre ? etiqueta.fin + cierre.index + cierre[0].length : sucio.length;
      continue;
    }

    if (!ETIQUETAS.has(etiqueta.nombre)) {
      // Etiqueta desconocida: se tira la etiqueta y se conserva lo que hay
      // dentro, que suele ser texto legítimo del apunte.
      i = etiqueta.fin;
      continue;
    }

    if (etiqueta.cierre) {
      if (!VACIAS.has(etiqueta.nombre)) salida.push(`</${etiqueta.nombre}>`);
      i = etiqueta.fin;
      continue;
    }

    const permitidos = ATRIBUTOS[etiqueta.nombre];
    const conservados: string[] = [];

    if (permitidos) {
      for (const { clave, valor } of etiqueta.atributos) {
        if (!NOMBRE_ATRIBUTO.test(clave)) continue;
        if (!permitidos.has(clave)) continue;
        // Los atributos de evento ya quedan fuera por no estar en la lista;
        // esto lo deja escrito para que añadir uno nuevo a ATRIBUTOS no pueda
        // abrir la puerta por descuido.
        if (clave.startsWith("on")) continue;
        if ((clave === "href" || clave === "src") && !urlAdmitida(valor)) continue;

        conservados.push(`${clave}="${escaparAtributo(valor)}"`);
      }
    }

    // Los enlaces externos se abren fuera y sin arrastrar la referencia.
    if (etiqueta.nombre === "a") {
      conservados.push('rel="noopener noreferrer nofollow"', 'target="_blank"');
    }

    const cola = VACIAS.has(etiqueta.nombre) ? " /" : "";
    salida.push(
      `<${etiqueta.nombre}${conservados.length ? " " + conservados.join(" ") : ""}${cola}>`,
    );
    i = etiqueta.fin;
  }

  return salida.join("").trim();
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
