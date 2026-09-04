import type { LegislationChangeType } from "@/generated/prisma/enums";

/**
 * ¿ESTE ANUNCIO DEL BOE TOCA UNA NORMA DE LA ACADEMIA?
 *
 * El radar de convocatorias lee la sección II.B. Las leyes cambian en otra
 * sección, la I, y hasta ahora nadie la miraba: una academia se enteraba de que
 * habían modificado la Ley 39/2015 cuando se lo decía un alumno.
 *
 * Aquí no se llama a nadie ni se escribe nada. Solo se decide, a partir del
 * título del anuncio, si afecta a una norma concreta y de qué manera. Sin base
 * de datos y sin red, que es lo que permite probarlo con títulos reales del
 * BOE.
 *
 * ── EL TÍTULO DEL BOE ES MUY REGULAR ───────────────────────────────────────
 *
 * Y eso es lo que hace viable detectarlo sin leer el texto completo:
 *
 *   «Real Decreto 203/2021, de 30 de marzo, por el que se aprueba el
 *    Reglamento de actuación… y se modifica la Ley 39/2015, de 1 de octubre…»
 *   «Corrección de errores de la Ley 39/2015, de 1 de octubre, del
 *    Procedimiento Administrativo Común…»
 *   «Ley Orgánica 1/2025, de 2 de enero, … por la que se deroga la Ley…»
 *
 * ── POR QUÉ NO BASTA CON BUSCAR «LEY 39/2015» ──────────────────────────────
 *
 * Porque una norma se cita constantemente sin que la cambien: «de acuerdo con
 * lo previsto en la Ley 39/2015», «al amparo del artículo 21 de la Ley
 * 39/2015». Si cada mención abriera una alerta, la academia tendría una alerta
 * falsa por semana y dejaría de mirarlas, que es la forma de que un aviso
 * bueno pase desapercibido.
 *
 * Así que se exige **un verbo de cambio**, y además que aparezca *antes* de la
 * referencia en el título, que es como se construyen estos títulos en español:
 * «por el que se modifica la Ley 39/2015», nunca «la Ley 39/2015 se modifica».
 */

/** Cómo queda una norma después de lo que dice el anuncio. */
export type CambioDetectado = {
  tipo: LegislationChangeType;
  /// El trozo del título que lo delata. Va a la alerta para que quien la lea
  /// pueda juzgar por sí mismo si el radar ha acertado.
  motivo: string;
};

/**
 * Los verbos que indican cambio, con el tipo que les corresponde.
 *
 * El orden importa: se prueba de más específico a más general. «Corrección de
 * errores de la Ley…» lleva también la palabra «Ley», y una derogación parcial
 * suele decir «se deroga» y «se modifica» en el mismo título; ahí manda la
 * derogación, que es la más grave.
 */
const VERBOS: { patron: RegExp; tipo: LegislationChangeType; que: string }[] = [
  {
    patron: /correcci[oó]n de errores/i,
    tipo: "CORRECTED",
    que: "corrección de errores",
  },
  {
    patron: /\b(se\s+)?derogan?\b|derogaci[oó]n/i,
    tipo: "REPEALED",
    que: "derogación",
  },
  {
    patron: /\b(se\s+)?modifican?\b|modificaci[oó]n\s+(de|del)\b/i,
    tipo: "AMENDED",
    que: "modificación",
  },
  {
    patron: /\bse\s+a[ñn]aden?\b|\bnueva\s+redacci[oó]n\b/i,
    tipo: "AMENDED",
    que: "nueva redacción",
  },
];

/** Quita acentos y baja a minúsculas, para comparar sin sorpresas. */
function llano(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Dónde empieza la referencia dentro del título, o -1.
 *
 * La referencia se busca de forma flexible porque una academia la escribe como
 * quiere: «Ley 39/2015», «ley 39/2015», «L 39/2015». Lo que no cambia nunca es
 * el número y el año, así que eso es lo que manda; el resto solo tiene que
 * estar cerca.
 */
function dondeApareceLaNorma(titulo: string, referencia: string): number {
  const t = llano(titulo);
  const r = llano(referencia).trim();
  if (!r) return -1;

  const directa = t.indexOf(r);
  if (directa !== -1) return directa;

  // El número y el año, que es lo que identifica de verdad la norma.
  const numero = r.match(/(\d+)\s*\/\s*(\d{4})/);
  if (!numero) return -1;

  const suelto = new RegExp(`\\b${numero[1]}\\s*/\\s*${numero[2]}\\b`);
  const m = t.match(suelto);
  return m?.index ?? -1;
}

/**
 * ¿El anuncio cambia esta norma?
 *
 * @param titulo Título del anuncio del BOE, tal cual.
 * @param referencia La referencia de la norma según la academia («Ley 39/2015»).
 * @returns Qué cambio es, o `null` si el anuncio solo la menciona.
 */
export function detectarCambio(
  titulo: string,
  referencia: string,
): CambioDetectado | null {
  const posicionNorma = dondeApareceLaNorma(titulo, referencia);
  if (posicionNorma === -1) return null;

  for (const verbo of VERBOS) {
    const m = llano(titulo).match(verbo.patron);
    if (!m || m.index === undefined) continue;

    /*
     * El verbo tiene que ir DELANTE de la norma.
     *
     * Es lo que separa «por el que se modifica la Ley 39/2015» —que sí— de
     * «Real Decreto por el que se aprueba el reglamento previsto en la Ley
     * 39/2015 y se modifica el Real Decreto 1065/2007» —donde lo que se
     * modifica es otra cosa y la Ley 39/2015 solo sale citada—.
     *
     * La corrección de errores es la excepción: va siempre al principio del
     * título y afecta a lo que venga detrás.
     */
    if (verbo.tipo !== "CORRECTED" && m.index > posicionNorma) continue;

    return { tipo: verbo.tipo, motivo: verbo.que };
  }

  return null;
}

/**
 * Los artículos que el título dice que cambian, si los dice.
 *
 * Muchos títulos no bajan a ese detalle y devuelve una lista vacía; cuando sí
 * lo hacen, es lo que permite marcar exactamente las preguntas de ese artículo
 * en lugar de todas las de la norma.
 *
 * @returns Números de artículo tal como se escriben en la ficha: «21», «21.2».
 */
export function articulosCitados(titulo: string): string[] {
  const encontrados = new Set<string>();
  const t = llano(titulo);

  // «artículo 21», «artículos 21 y 22», «art. 21.2».
  for (const m of t.matchAll(/art(?:[ií]culos?|\.)\s*([\d.\s,y]+)/g)) {
    for (const trozo of m[1].split(/[,y]/)) {
      const numero = trozo.trim().replace(/\.$/, "");
      if (/^\d+(\.\d+)?$/.test(numero)) encontrados.add(numero);
    }
  }

  return [...encontrados];
}
