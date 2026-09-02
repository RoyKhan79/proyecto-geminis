import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

/**
 * SANEADO DE HTML · pruebas de evasión
 *
 * Estas pruebas no comprueban que el saneador «funcione»: comprueban que NO se
 * puede rodear. Cada caso de `EVASIONES` estuvo o pudo estar en el repertorio
 * de alguien que quisiera ejecutar un script en el navegador del alumnado.
 *
 * Las dos primeras son las que de verdad pasaban con la versión anterior, que
 * buscaba etiquetas con una expresión regular: lo que no reconocía como
 * etiqueta lo copiaba tal cual a la salida.
 *
 * La comprobación es siempre la misma y es deliberadamente tosca: en la salida
 * no puede quedar NI UN atributo de evento, NI UN `javascript:`, NI UNA
 * etiqueta ejecutable. No se comprueba que la salida sea igual a un texto
 * concreto porque eso ata la prueba a la implementación, y esta prueba tiene
 * que seguir valiendo si mañana el saneador se cambia por una biblioteca.
 */

const EVASIONES = [
  // La barra hace de separador de atributos para el navegador. Esta entrada
  // ejecutaba de verdad: era el fallo de la versión de expresiones regulares.
  "<img/src=x onerror=alert(1)>",
  "<div/onmouseover=alert(1)>hola</div>",
  // Variantes del mismo truco.
  "<img//////src=x onerror=alert(1)>",
  "<img\tsrc=x\tonerror=alert(1)>",
  "<img\nsrc=x\nonerror=alert(1)>",
  "<IMG SRC=x ONERROR=alert(1)>",
  // Un `>` dentro de unas comillas no debe cortar el análisis de la etiqueta.
  '<img src="x" alt="a>b" onerror="alert(1)">',
  '<a href="#" title="x>" onclick="alert(1)">t</a>',
  // Etiquetas que no deben sobrevivir de ninguna forma.
  "<script>alert(1)</script>",
  "<script src=//x/y.js></script>",
  "<scr<script>ipt>alert(1)</script>",
  "<svg onload=alert(1)></svg>",
  "<svg><script>alert(1)</script></svg>",
  "<iframe src=//evil.test></iframe>",
  "<iframe/src=//evil.test>",
  "<object data=x></object>",
  "<embed src=x>",
  "<form action=//evil.test><input name=a></form>",
  "<math><mtext><script>alert(1)</script></mtext></math>",
  "<style>body{background:url(javascript:alert(1))}</style>",
  "<base href=//evil.test>",
  "<meta http-equiv=refresh content=0;url=//evil.test>",
  // Esquemas de URL que ejecutan o incrustan.
  '<a href="javascript:alert(1)">t</a>',
  "<a href=javascript:alert(1)>t</a>",
  '<a href="JaVaScRiPt:alert(1)">t</a>',
  '<a href="java\tscript:alert(1)">t</a>',
  '<a href="java\nscript:alert(1)">t</a>',
  '<a href=" javascript:alert(1)">t</a>',
  '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
  '<a href="vbscript:msgbox(1)">t</a>',
  // Comentarios y declaraciones usados para confundir al analizador.
  "<!--<img src=x onerror=alert(1)>-->",
  "<!--><img src=x onerror=alert(1)>",
  "<![CDATA[<img src=x onerror=alert(1)>]]>",
  // Etiquetas sin cerrar al final del texto.
  "<img src=x onerror=alert(1)",
  '<a href="javascript:alert(1)',
  "<script>alert(1)",
];

/** Lo que no puede quedar en la salida bajo ninguna circunstancia. */
const PROHIBIDO: { nombre: string; patron: RegExp }[] = [
  { nombre: "atributo de evento", patron: /\son[a-z]+\s*=/i },
  { nombre: "esquema javascript:", patron: /javascript\s*:/i },
  { nombre: "esquema vbscript:", patron: /vbscript\s*:/i },
  { nombre: "esquema data:", patron: /data\s*:/i },
  {
    nombre: "etiqueta ejecutable",
    patron: /<\s*\/?\s*(script|iframe|object|embed|form|input|svg|math|style|base|meta|link)\b/i,
  },
];

/**
 * Deja solo las etiquetas que el navegador va a interpretar.
 *
 * Lo que el saneador escapa —un `<` suelto convertido en `&lt;`— sale del otro
 * lado como texto visible, y ahí un `javascript:` es tan inofensivo como la
 * palabra «plazo». Si no se quitara ese texto antes de comprobar, las pruebas
 * marcarían como fallo justo el caso en el que el saneador ha hecho bien su
 * trabajo, y la forma cómoda de «arreglarlo» sería relajar la comprobación.
 */
function soloLoQueSeInterpreta(html: string): string {
  return html.replace(/&lt;[\s\S]*?(?=&lt;|<|$)/g, "");
}

describe("saneado de HTML · no se puede rodear", () => {
  for (const entrada of EVASIONES) {
    it(`neutraliza ${JSON.stringify(entrada)}`, () => {
      const salida = soloLoQueSeInterpreta(sanitizeHtml(entrada));
      for (const { nombre, patron } of PROHIBIDO) {
        expect(
          patron.test(salida),
          `queda un ${nombre} en la salida: ${JSON.stringify(salida)}`,
        ).toBe(false);
      }
    });
  }

  it("no deja pasar ninguna etiqueta fuera de la lista blanca", () => {
    for (const entrada of EVASIONES) {
      const salida = sanitizeHtml(entrada);
      const etiquetas = [...salida.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)].map(
        (m) => m[1].toLowerCase(),
      );
      for (const etiqueta of etiquetas) {
        expect(
          ["p", "br", "strong", "b", "em", "i", "u", "s", "mark", "small",
            "sub", "sup", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
            "dl", "dt", "dd", "blockquote", "pre", "code", "table", "thead",
            "tbody", "tfoot", "tr", "th", "td", "caption", "a", "img", "figure",
            "figcaption", "hr", "div", "span"],
          `${entrada} → ${salida}`,
        ).toContain(etiqueta);
      }
    }
  });
});

describe("saneado de HTML · lo legítimo sigue funcionando", () => {
  it("conserva el formato de unos apuntes normales", () => {
    const apunte =
      "<h2>Artículo 103</h2><p>La Administración sirve con <strong>objetividad</strong>" +
      " los intereses <em>generales</em>.</p><ul><li>Eficacia</li><li>Jerarquía</li></ul>";
    const salida = sanitizeHtml(apunte);

    expect(salida).toContain("<h2>");
    expect(salida).toContain("<strong>");
    expect(salida).toContain("<li>Eficacia</li>");
    expect(salida).toContain("Artículo 103");
  });

  it("conserva las tablas con sus atributos admitidos", () => {
    const salida = sanitizeHtml(
      '<table><tr><th scope="col" colspan="2">Plazos</th></tr>' +
        '<tr><td colspan="2">Quince días</td></tr></table>',
    );
    expect(salida).toContain('scope="col"');
    expect(salida).toContain('colspan="2"');
  });

  it("conserva los enlaces y las imágenes admitidos, con su protección", () => {
    const salida = sanitizeHtml(
      '<a href="https://boe.es/x" title="BOE">ver</a>' +
        '<img src="/api/archivos/abc" alt="Esquema" width="400">',
    );
    expect(salida).toContain('href="https://boe.es/x"');
    expect(salida).toContain('rel="noopener noreferrer nofollow"');
    expect(salida).toContain('src="/api/archivos/abc"');
    expect(salida).toContain('alt="Esquema"');
    expect(salida).toContain('width="400"');
  });

  it("quita el enlace peligroso pero conserva el texto del enlace", () => {
    const salida = sanitizeHtml('<a href="javascript:alert(1)">pulsa aquí</a>');
    expect(salida).toContain("pulsa aquí");
    expect(salida).not.toContain("javascript");
  });

  it("escapa lo que no llega a ser una etiqueta, en vez de copiarlo", () => {
    // Un apunte de matemáticas o de programación puede llevar «<» sueltos.
    const salida = sanitizeHtml("<p>si a < b y b > c entonces a < c</p>");
    expect(salida).toContain("&lt;");
    expect(salida).toContain("<p>");
  });

  it("es idempotente: sanear lo ya saneado no cambia nada", () => {
    for (const entrada of [
      "<p>Texto <b>en negrita</b></p>",
      '<a href="https://x.test">e</a>',
      "<img/src=x onerror=alert(1)>",
      "<p>a < b</p>",
    ]) {
      const una = sanitizeHtml(entrada);
      expect(sanitizeHtml(una)).toBe(una);
    }
  });

  it("no se cuelga con entradas degeneradas", () => {
    // Cada una de estas rompía o dejaba dando vueltas alguna versión anterior.
    for (const entrada of ["<", "<<<<<", "<a=", "<a =", "<<a b=", "< a>", "<>", "</>"]) {
      expect(() => sanitizeHtml(entrada)).not.toThrow();
    }
  });

  it("trata el texto vacío o ausente sin quejarse", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
    expect(sanitizeHtml("")).toBe("");
  });
});
