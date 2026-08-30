/**
 * LEER EL NOMBRE DE UN ARCHIVO DE TEMARIO
 *
 * Una academia no tiene su temario en una base de datos: lo tiene en una
 * carpeta, con nombres como «Tema 01 - El acto administrativo.pdf» o
 * «T12_Fuentes del Derecho.PDF». Subir eso tema a tema es una tarde de trabajo,
 * y es la tarde que hace que una academia no llegue a probar el producto.
 *
 * Esto lee esos nombres y propone una estructura. Propone: la academia corrige
 * lo que quiera antes de que se cree nada. El principio del proyecto es que los
 * nombres los pone ella, y una propuesta editable lo respeta; una imposición
 * automática, no.
 *
 * Funciones puras a propósito, sin base de datos: es la parte con más casos
 * raros y la única que se puede probar a fondo sin levantar nada.
 */

export type LecturaDeNombre = {
  /** Número de tema, si se ha sabido leer. */
  numero: number | null;
  /** Bloque o parte, si el nombre lo trae («Bloque II», «Parte 1»). */
  bloque: string | null;
  /** Título propuesto, ya limpio. */
  titulo: string;
  /** Qué patrón se reconoció. Se enseña en pantalla para que se pueda revisar. */
  patron: "tema" | "numero" | "sin-numero";
};

const EXTENSIONES = /\.(pdf|docx?|pptx?|odt|odp|epub|txt|md|zip)$/i;

/** Números romanos habituales en bloques de temario. No hace falta más. */
const ROMANOS: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15,
};

/**
 * Siglas que aparecen de verdad en un temario de oposición español.
 *
 * Sí, es una lista escrita a mano, y no cubre todas. Es a propósito: en un
 * título ENTERAMENTE EN MAYÚSCULAS no hay ninguna señal que distinga una sigla
 * de una palabra corriente —«ACTO» y «LPAC» se ven igual—, así que cualquier
 * regla automática se equivoca en un sentido o en el otro. Preferimos
 * equivocarnos por defecto, dejando en minúscula una sigla rara, porque eso la
 * academia lo corrige en la tabla de un vistazo; lo contrario deja títulos
 * GRITANDO por toda la pantalla del alumno.
 */
const SIGLAS = new Set([
  "LPAC", "LPACAP", "LRJSP", "LRJPAC", "EBEP", "TREBEP", "ET", "LGT", "LIVA",
  "IRPF", "IVA", "IAE", "BOE", "DOUE", "UE", "CE", "TC", "TS", "TSJ", "AN",
  "LOPDGDD", "RGPD", "LOMLOE", "LOE", "LOGSE", "LOU", "ESO", "FP", "TIC",
  "SS", "INSS", "SEPE", "TGSS", "RD", "RDL", "LGSS", "LCSP", "LOREG",
  "LOTC", "LOPJ", "CCAA", "AEAT", "PGE", "IPREM", "SMI", "ONU", "OTAN", "OIT",
]);

/**
 * Pasa un título gritado a mayúscula inicial sin destrozar las siglas.
 *
 * Media España nombra sus archivos en mayúsculas. Pasarlo todo a minúsculas
 * convertiría «LPAC» en «lpac», que es peor que dejarlo feo. Y dejarlo como
 * está llena de gritos la pantalla del alumno.
 *
 * Solo actúa si el título viene ENTERO en mayúsculas. Un título bien escrito no
 * se toca: si la academia puso «Fuentes del Derecho», eso es lo que quiere.
 */
export function arreglarMayusculas(texto: string): string {
  const soloMayusculas = texto === texto.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(texto);
  if (!soloMayusculas) return texto;

  const palabras = texto.split(/\s+/).map((palabra) => {
    const nucleo = palabra.replace(/[^A-ZÁÉÍÓÚÜÑ0-9]/gi, "");

    if (SIGLAS.has(nucleo)) return palabra;
    // Sin vocales y con más de una letra: «RD», «BOE» ya está en la lista, pero
    // esto recoge las que no lo están sin arriesgarse con palabras reales.
    if (nucleo.length > 1 && !/[AEIOUÁÉÍÓÚ]/i.test(nucleo)) return palabra;

    return palabra.toLowerCase();
  });

  const frase = palabras.join(" ");
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

/** Quita separadores de relleno y espacios repetidos. */
function limpiar(texto: string): string {
  return texto
    .replace(/[_]+/g, " ")
    .replace(/\s*[-–—·:.]+\s*$/, "")
    .replace(/^\s*[-–—·:.]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lee el número y el título del nombre de un archivo de temario.
 *
 * @param nombreArchivo El nombre tal cual, con su extensión.
 * @returns Lo que ha sabido deducir y **con qué patrón**, para que la academia
 *   pueda revisarlo. `numero` es `null` cuando no lo ha encontrado, y entonces
 *   ese archivo se va al final de la lista en lugar de esconderse.
 *
 * @example
 * ```ts
 * leerNombre("Bloque II - Tema 3 - Fuentes.pdf");
 * // { bloque: "Bloque 2", numero: 3, titulo: "Fuentes", patron: "tema" }
 * ```
 */
export function leerNombre(nombreArchivo: string): LecturaDeNombre {
  const base = nombreArchivo.replace(EXTENSIONES, "");

  // Bloque o parte, si viene delante. Se saca antes que el tema porque
  // «Bloque II - Tema 3» trae los dos y el número que importa es el del tema.
  let bloque: string | null = null;
  const conBloque = base.match(
    /^\s*(bloque|parte|m[oó]dulo)\s*([0-9]{1,2}|[ivxIVX]{1,5})\b\s*[-–—_.:]?\s*/i,
  );

  let resto = base;
  if (conBloque) {
    const etiqueta = conBloque[1];
    const valor = conBloque[2];
    const numero = /^[0-9]+$/.test(valor)
      ? Number(valor)
      : (ROMANOS[valor.toLowerCase()] ?? null);
    bloque = numero
      ? `${etiqueta.charAt(0).toUpperCase()}${etiqueta.slice(1).toLowerCase()} ${numero}`
      : limpiar(conBloque[0]);
    resto = base.slice(conBloque[0].length);
  }

  // «Tema 12», «Tema12», «T12», «T-12», «Tma 3»… seguido o no de separador.
  // `(?![0-9])` y no `\b`: para una expresión regular el guion bajo es una
  // letra, así que `\b` no encuentra frontera en «T12_Fuentes» y el patrón
  // fallaba justo con la forma de nombrar archivos más común en Windows.
  const conTema = resto.match(
    /^\s*(tema|tma|t)\s*[-–—_.]?\s*([0-9]{1,3})(?![0-9])\s*[-–—_.:]?\s*/i,
  );
  if (conTema) {
    return {
      numero: Number(conTema[2]),
      bloque,
      titulo: arreglarMayusculas(limpiar(resto.slice(conTema[0].length))),
      patron: "tema",
    };
  }

  // «01. El acto administrativo», «12 - Fuentes», «3_Procedimiento».
  //
  // Se exige un separador después del número. Sin él, «2024 Convocatoria» se
  // leería como el tema 2024, y un temario con temas numerados por el año es
  // menos probable que un archivo que empieza por una fecha.
  const conNumero = resto.match(/^\s*([0-9]{1,3})\s*[-–—_.:)]+\s*/);
  if (conNumero) {
    return {
      numero: Number(conNumero[1]),
      bloque,
      titulo: arreglarMayusculas(limpiar(resto.slice(conNumero[0].length))),
      patron: "numero",
    };
  }

  return {
    numero: null,
    bloque,
    titulo: arreglarMayusculas(limpiar(resto)),
    patron: "sin-numero",
  };
}

/** Un tema propuesto: lo leído del nombre, más su etiqueta y su orden. */
export type PropuestaDeTema = LecturaDeNombre & {
  nombreArchivo: string;
  /** Cómo se llamará el tema si nadie lo toca. */
  etiqueta: string;
  /** Orden propuesto, 1 en adelante. */
  posicion: number;
};

/**
 * Lee una tanda de archivos y propone el temario ordenado.
 *
 * Orden: primero los que tienen número, por su número; después los que no, por
 * su nombre. Los que no se han sabido leer van al final y no se esconden: la
 * academia tiene que verlos para decidir, y enterrarlos en medio de la lista
 * sería la forma de que se colara un tema mal puesto.
 */
export function proponerTemario(nombres: string[]): PropuestaDeTema[] {
  const leidos = nombres.map((nombreArchivo) => ({
    ...leerNombre(nombreArchivo),
    nombreArchivo,
  }));

  const conNumero = leidos
    .filter((l) => l.numero !== null)
    .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));

  const sinNumero = leidos
    .filter((l) => l.numero === null)
    .sort((a, b) => a.nombreArchivo.localeCompare(b.nombreArchivo, "es"));

  return [...conNumero, ...sinNumero].map((lectura, indice) => ({
    ...lectura,
    posicion: indice + 1,
    etiqueta:
      lectura.numero !== null
        ? `Tema ${lectura.numero}${lectura.titulo ? ` · ${lectura.titulo}` : ""}`
        : lectura.titulo || lectura.nombreArchivo,
  }));
}

/**
 * Avisos sobre una propuesta, para enseñarlos ANTES de crear nada.
 *
 * Un asistente que crea sesenta temas y luego dice «por cierto, había dos con
 * el número 7» no sirve de nada: para entonces ya hay que deshacerlo a mano.
 */
export function avisosDeLaPropuesta(propuesta: PropuestaDeTema[]): string[] {
  const avisos: string[] = [];

  const numeros = propuesta.map((p) => p.numero).filter((n): n is number => n !== null);
  const repetidos = [...new Set(numeros.filter((n, i) => numeros.indexOf(n) !== i))];
  if (repetidos.length > 0) {
    avisos.push(
      `Hay más de un archivo con el mismo número de tema: ${repetidos.join(", ")}. Revisa que no se te haya colado una versión antigua.`,
    );
  }

  const sinNumero = propuesta.filter((p) => p.numero === null);
  if (sinNumero.length > 0) {
    avisos.push(
      `${sinNumero.length} ${sinNumero.length === 1 ? "archivo no tiene" : "archivos no tienen"} número de tema en el nombre. Están al final de la lista para que les pongas título tú.`,
    );
  }

  if (numeros.length > 1) {
    const ordenados = [...new Set(numeros)].sort((a, b) => a - b);
    const huecos: number[] = [];
    for (let n = ordenados[0]; n < ordenados[ordenados.length - 1]; n += 1) {
      if (!ordenados.includes(n)) huecos.push(n);
    }
    if (huecos.length > 0 && huecos.length <= 10) {
      avisos.push(
        `Faltan los temas ${huecos.join(", ")}. Si es a propósito, adelante; si no, quizá se te ha quedado algún archivo sin subir.`,
      );
    }
  }

  const sinTitulo = propuesta.filter((p) => !p.titulo);
  if (sinTitulo.length > 0) {
    avisos.push(
      `${sinTitulo.length} ${sinTitulo.length === 1 ? "tema se queda" : "temas se quedan"} solo con su número. Ponles título antes de publicarlos: el alumno verá esa lista.`,
    );
  }

  return avisos;
}
