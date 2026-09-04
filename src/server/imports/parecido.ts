/**
 * PREGUNTAS QUE SE PARECEN, Y PREGUNTAS AMBIGUAS
 *
 * Un banco de veinte años trae la misma pregunta cuatro veces con distinta
 * redacción, y trae preguntas que hoy serían impugnables. Detectar solo las
 * copias exactas —que es lo que hacía la importación— deja fuera precisamente
 * el caso frecuente: nadie copia y pega, la gente reescribe.
 *
 *   «¿Cuál es el plazo máximo para resolver el procedimiento?»
 *   «Indique el plazo máximo de resolución del procedimiento.»
 *
 * Normalizadas son dos cadenas distintas y la comparación exacta no las junta.
 * Comparadas por las palabras que llevan dentro, son la misma pregunta.
 *
 * ── CÓMO SE COMPARA ────────────────────────────────────────────────────────
 *
 * Por conjuntos de palabras con significado (Jaccard: lo que comparten dividido
 * entre todo lo que tienen entre las dos). Se eligió esto y no una distancia de
 * edición por una razón concreta: la distancia de edición castiga el orden de
 * las palabras y reordenar una pregunta es justo lo que hace quien la
 * reescribe. Y no se usa `pg_trgm` dentro de la base porque el banco de una
 * academia cabe de sobra en memoria y así la comparación se puede probar sin
 * base de datos delante.
 *
 * Para no comparar cada fila contra todo el banco —que sería el cuadrado del
 * número de preguntas— se indexa al revés: de cada palabra, en qué preguntas
 * aparece. Solo se comparan las que comparten alguna palabra poco común.
 *
 * ── POR QUÉ AVISO Y NO ERROR ───────────────────────────────────────────────
 *
 * Porque dos preguntas parecidas pueden ser legítimamente distintas: cambiar
 * «tres meses» por «seis meses» son dos palabras de diferencia y dos preguntas
 * que no tienen nada que ver. Quien decide es la persona que importa, y para eso
 * el aviso dice CON CUÁL se parece.
 */

/**
 * Palabras que no distinguen una pregunta de otra.
 *
 * Además de las vacías del español, van las de andamiaje del tipo test
 * —«señale», «indique», «cuál», «respecto»—: aparecen en la mitad del banco y
 * si cuentan, dos preguntas de temas distintos ya parten de un parecido alto.
 */
const SIN_VALOR = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "que",
  "y", "o", "en", "por", "para", "con", "se", "es", "son", "al", "a", "su",
  "sus", "lo", "como", "cual", "cuales", "cuando", "donde", "sobre", "entre",
  "este", "esta", "esto", "estos", "estas", "ese", "esa", "no", "si", "mas",
  "pero", "sino", "ha", "han", "hay", "ser", "sera", "seran", "segun",
  "senale", "indique", "cite", "diga", "marque", "respecto", "siguiente",
  "siguientes", "opcion", "opciones", "correcta", "correctas", "incorrecta",
  "verdadero", "falso", "cuestion", "pregunta", "acerca", "relacion",
]);

/**
 * Longitud de la raíz con la que se compara una palabra.
 *
 * Las palabras se recortan a sus cinco primeras letras antes de comparar. Sin
 * eso, «resolver» y «resolución» son dos palabras distintas y dos redacciones
 * de la misma pregunta se quedaban en 0,71 de parecido, justo por debajo del
 * umbral. Recortadas, las dos son «resol» y la pregunta se detecta.
 *
 * Es un lematizador de pobre y se sabe. El bueno lo tiene PostgreSQL y se usa
 * en la búsqueda de la IA, pero esto tiene que poder ejecutarse —y probarse—
 * sin base de datos delante. Cinco letras es donde se separan bien las dos
 * cosas que importan: junta las formas de una misma palabra y todavía no junta
 * palabras que no tienen nada que ver.
 *
 * Lo que sí junta de más: «administrativo» con «administración». Para decidir
 * si dos preguntas son la misma, eso ayuda más que estorba.
 */
const RAIZ = 5;

/**
 * Las raíces de las palabras con significado de un texto.
 *
 * Se quitan acentos y signos, y se descartan las de menos de cuatro letras: en
 * español casi todas las de tres o menos son gramaticales, y las pocas que no
 * —«ley», «BOE»— aparecen en tantas preguntas que tampoco distinguen.
 */
export function palabrasConSignificado(texto: string): Set<string> {
  return new Set(
    texto
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9ñ]+/)
      // Las cifras de dos dígitos en adelante cuentan aunque sean cortas: en
      // un banco de oposiciones la diferencia entre dos preguntas suele ser
      // exactamente esa —«artículo 21» y «artículo 103»— y sin ellas las dos
      // parecerían la misma pregunta.
      .filter(
        (p) => (p.length >= 4 || /^\d{2,}$/.test(p)) && !SIN_VALOR.has(p),
      )
      // Las cifras no se recortan: «103» y «1035» son cosas distintas.
      .map((p) => (/^\d+$/.test(p) ? p : p.slice(0, RAIZ))),
  );
}

/**
 * Cuánto se parecen dos conjuntos de palabras, de 0 a 1.
 *
 * @returns 1 si llevan exactamente las mismas palabras, 0 si no comparten
 *   ninguna. Dos conjuntos vacíos dan 0 y no 1: sin palabras con significado no
 *   hay nada que comparar, y decir que se parecen del todo sería inventárselo.
 */
export function parecido(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let comunes = 0;
  const [menor, mayor] = a.size <= b.size ? [a, b] : [b, a];
  for (const p of menor) if (mayor.has(p)) comunes += 1;
  return comunes / (a.size + b.size - comunes);
}

/**
 * A partir de qué parecido se avisa.
 *
 * 0,72 sale de probar contra reformulaciones reales: dos redacciones de la
 * misma pregunta se quedan por encima, y dos preguntas del mismo tema que
 * comparten vocabulario —el caso que hay que NO marcar— se quedan por debajo.
 * Bajarlo llena la simulación de avisos y entonces no se lee ninguno.
 */
export const UMBRAL_PARECIDO = 0.72;

/** Una pregunta ya conocida, para comparar contra ella. */
export type PreguntaConocida = {
  /// De dónde viene: una fila del archivo o una pregunta del banco.
  referencia: string;
  palabras: Set<string>;
};

/**
 * Busca parecidos sin comparar todo contra todo.
 *
 * Mantiene un índice invertido —de cada palabra, qué preguntas la llevan— y
 * solo compara contra las que comparten alguna palabra. En un banco donde casi
 * ninguna pregunta comparte vocabulario con casi ninguna otra, eso deja el
 * trabajo en una fracción del cuadrado.
 */
export class BuscadorDeParecidas {
  private readonly porPalabra = new Map<string, number[]>();
  private readonly conocidas: PreguntaConocida[] = [];

  /**
   * @param umbral Parecido mínimo para considerarlas la misma pregunta.
   */
  constructor(private readonly umbral: number = UMBRAL_PARECIDO) {}

  /** Añade una pregunta al índice para comparaciones posteriores. */
  añadir(referencia: string, texto: string): void {
    const palabras = palabrasConSignificado(texto);
    const indice = this.conocidas.length;
    this.conocidas.push({ referencia, palabras });
    for (const p of palabras) {
      const lista = this.porPalabra.get(p);
      if (lista) lista.push(indice);
      else this.porPalabra.set(p, [indice]);
    }
  }

  /**
   * La pregunta conocida que más se parece a este texto, si pasa del umbral.
   *
   * @returns La referencia y cuánto se parecen, o `null` si ninguna llega.
   */
  buscar(texto: string): { referencia: string; parecido: number } | null {
    const palabras = palabrasConSignificado(texto);
    if (palabras.size === 0) return null;

    const candidatas = new Set<number>();
    for (const p of palabras) {
      const lista = this.porPalabra.get(p);
      if (lista) for (const i of lista) candidatas.add(i);
    }

    let mejor: { referencia: string; parecido: number } | null = null;
    for (const i of candidatas) {
      const p = parecido(palabras, this.conocidas[i].palabras);
      if (p >= this.umbral && (!mejor || p > mejor.parecido)) {
        mejor = { referencia: this.conocidas[i].referencia, parecido: p };
      }
    }
    return mejor;
  }
}

/**
 * Opciones que remiten a las demás y obligan a mirar la pregunta a mano.
 *
 * No son un error: son legítimas y muy frecuentes en oposiciones. Pero cuando
 * llegan importadas de otro programa, el orden de las opciones cambia y «todas
 * las anteriores» deja de significar lo mismo. Eso sí acaba en impugnación.
 */
const REMITEN_A_LAS_DEMAS =
  /^(todas|ninguna|ambas|a\s*y\s*b|b\s*y\s*c)\b|(las\s+)?(anteriores|opciones)\s+(son|es)\b|son\s+correctas$/i;

/** Un problema encontrado en las opciones de una pregunta. */
export type ProblemaDeOpciones = {
  nivel: "error" | "warning";
  texto: string;
};

/**
 * Revisa las opciones de una pregunta buscando lo que la haría impugnable.
 *
 * Lo idéntico ya se detecta antes, en la importación. Aquí va lo que se le
 * escapa: opciones que **casi** dicen lo mismo, opciones que remiten a las
 * demás, y opciones vacías o de relleno.
 *
 * @param opciones Los textos de las opciones, en su orden.
 * @param correcta Índice de la correcta, o -1 si no se pudo determinar.
 */
export function revisarOpciones(
  opciones: string[],
  correcta: number,
): ProblemaDeOpciones[] {
  const problemas: ProblemaDeOpciones[] = [];
  const letra = (i: number) => String.fromCharCode(65 + i);

  // ── Opciones que casi dicen lo mismo ──────────────────────────────────────
  const palabras = opciones.map(palabrasConSignificado);
  for (let i = 0; i < opciones.length; i += 1) {
    for (let j = i + 1; j < opciones.length; j += 1) {
      // Con muy pocas palabras el parecido salta con nada: «tres meses» y
      // «seis meses» comparten «meses» y ya sería 0,33. Ahí se exige que una
      // esté contenida en la otra, que es el caso real de «el plazo es de tres
      // meses» frente a «tres meses».
      const pocas = palabras[i].size < 3 || palabras[j].size < 3;
      const contenida =
        palabras[i].size > 0 &&
        palabras[j].size > 0 &&
        ([...palabras[i]].every((p) => palabras[j].has(p)) ||
          [...palabras[j]].every((p) => palabras[i].has(p)));

      const p = parecido(palabras[i], palabras[j]);
      if (pocas ? contenida : p >= 0.8) {
        problemas.push({
          nivel: "warning",
          texto:
            `Las opciones ${letra(i)} y ${letra(j)} dicen casi lo mismo. ` +
            "Si las dos pueden darse por buenas, la pregunta es impugnable.",
        });
      }
    }
  }

  // ── Opciones que remiten a las demás ──────────────────────────────────────
  const remiten = opciones
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => REMITEN_A_LAS_DEMAS.test(o.trim()));

  if (remiten.length > 0) {
    const cuales = remiten.map(({ i }) => letra(i)).join(" y ");
    problemas.push({
      nivel: "warning",
      texto:
        `La opción ${cuales} remite a las demás («${remiten[0].o.trim()}»). ` +
        "Al importar cambia el orden de las opciones: revisa que siga " +
        "significando lo mismo.",
    });

    // Y el caso que de verdad rompe: si «todas las anteriores» es la correcta,
    // el orden importa todavía más.
    if (remiten.some(({ i }) => i === correcta)) {
      problemas.push({
        nivel: "warning",
        texto:
          "Además es la respuesta marcada como correcta, así que depende por " +
          "completo del orden en que queden las opciones.",
      });
    }
  }

  // ── Relleno ───────────────────────────────────────────────────────────────
  opciones.forEach((o, i) => {
    const limpio = o.trim();
    if (/^(-+|n\/?a|nulo|vacio|vacío|\.+|x)$/i.test(limpio)) {
      problemas.push({
        nivel: "error",
        texto: `La opción ${letra(i)} («${limpio}») no es una respuesta.`,
      });
    }
  });

  return problemas;
}
