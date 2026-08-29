import type { Fragmento } from "./retrieval";

/**
 * MOTOR LOCAL DE GEMINIS IA
 *
 * Responde usando el material de la academia SIN ningún proveedor externo.
 *
 * Por qué existe: una academia no debería depender de contratar una API para
 * que su asistente funcione, ni enviar su temario fuera si no quiere. Este
 * motor lee los fragmentos recuperados, entiende qué se le está preguntando y
 * compone una respuesta con lo que dice el material, citando siempre de dónde
 * sale cada frase.
 *
 * Qué es y qué no es, sin adornos:
 *   · SÍ: entiende la intención, localiza lo relevante, extrae y ordena lo que
 *     dice el material, resume, compara, define y genera preguntas.
 *   · NO: no redacta explicaciones nuevas ni razona más allá del texto. Si el
 *     material no lo dice, no se lo inventa.
 *
 * Con un proveedor configurado, el gateway toma el relevo y la respuesta es
 * conversacional. Sin él, esto funciona igualmente y con la misma barrera de
 * permisos. Nunca hay una pantalla que diga «no disponible».
 */

export type Intencion =
  | "DEFINICION"
  | "PLAZO_O_CIFRA"
  | "COMPARACION"
  | "RESUMEN"
  | "ENUMERACION"
  | "EXPLICACION"
  | "GENERAL";

export type RespuestaLocal = {
  texto: string;
  intencion: Intencion;
  citas: number[];
  /// Confianza declarada. Se muestra al alumno: es más honesto que callarla.
  confianza: "alta" | "media" | "baja";
};

const NORMALIZAR = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Qué se está preguntando, a partir de cómo está formulada la pregunta. */
export function detectarIntencion(pregunta: string): Intencion {
  const p = NORMALIZAR(pregunta);

  if (/\b(resume|resumen|resumeme|sintetiza|en pocas palabras)\b/.test(p)) {
    return "RESUMEN";
  }
  if (/\b(diferencia|diferencias|compara|comparacion|frente a|vs)\b/.test(p)) {
    return "COMPARACION";
  }
  if (
    /\b(cuanto|cuantos|cuantas|plazo|plazos|dias|meses|anos|numero|cifra|porcentaje)\b/.test(
      p,
    )
  ) {
    return "PLAZO_O_CIFRA";
  }
  if (/\b(que es|qué es|define|definicion|concepto de|en que consiste)\b/.test(p)) {
    return "DEFINICION";
  }
  if (/\b(enumera|cuales son|tipos de|clases de|requisitos|elementos)\b/.test(p)) {
    return "ENUMERACION";
  }
  if (/\b(explica|explicame|por que|porque|como funciona|razon)\b/.test(p)) {
    return "EXPLICACION";
  }
  return "GENERAL";
}

/**
 * ¿Esta frase contiene una cantidad?
 *
 * No basta con buscar dígitos: el temario jurídico escribe los plazos con
 * letra («será de tres meses»), que es justo lo que más se pregunta. Buscando
 * solo `\d` se descartaría la frase correcta y se respondería con la que lleva
 * el número de artículo, que es otra cosa.
 */
function contieneCantidad(frase: string): boolean {
  if (/\d/.test(frase)) return true;
  return /\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|sesenta|cien|mil)\s+(dias?|meses|mes|anos|años|horas|semanas|euros|por ciento)\b/i.test(
    NORMALIZAR(frase),
  );
}

type FraseValorada = {
  texto: string;
  fragmento: number;
  puntos: number;
};

/**
 * Palabras que no dicen nada sobre el tema de la pregunta.
 *
 * Hacen falta por una razón concreta: buscar por subcadena, «cuál» aparece
 * dentro de «cualquiera» y «capital» dentro de «Capítulo». Sin esta lista, la
 * pregunta «¿cuál es la capital de Mongolia?» encontraba frases del temario y
 * el motor contestaba con el artículo 21.
 */
const VACIAS = new Set([
  "cual", "cuales", "cuando", "cuanto", "cuantos", "cuantas", "como", "donde",
  "quien", "quienes", "porque", "para", "pero", "esto", "esta", "este", "estos",
  "estas", "eso", "esa", "ese", "unos", "unas", "todo", "toda", "todos", "todas",
  "sobre", "entre", "segun", "hasta", "desde", "tiene", "tienen", "hace", "hacen",
  "dice", "dicen", "puede", "pueden", "debe", "deben", "sera", "seran", "haya",
  "tema", "temas", "temario", "material", "apuntes", "explica", "explicame",
  "resume", "resumeme", "dime", "quiero", "saber", "favor", "gracias", "ejemplo",
  "manera", "forma", "caso", "casos", "parte", "partes", "vez", "veces",
]);

/** Palabras de la pregunta que valen para buscar. */
function clavesDeBusqueda(pregunta: string): string[] {
  return [
    ...new Set(
      NORMALIZAR(pregunta)
        .split(/[^a-z0-9ñ]+/)
        .filter((t) => t.length > 3 && !VACIAS.has(t)),
    ),
  ];
}

/** Palabras de una frase, para poder comparar por palabra y no por trozo. */
function palabrasDe(texto: string): Set<string> {
  return new Set(NORMALIZAR(texto).split(/[^a-z0-9ñ]+/).filter(Boolean));
}

/** Parte los fragmentos en frases y las valora según la pregunta. */
function valorarFrases(pregunta: string, fragmentos: Fragmento[]): FraseValorada[] {
  const claves = clavesDeBusqueda(pregunta);
  if (claves.length === 0) return [];

  // Se cortan primero todas las frases, porque para valorarlas hace falta saber
  // cómo de común es cada palabra en ESTE material.
  const candidatas: { texto: string; palabras: Set<string>; fragmento: number }[] = [];

  fragmentos.forEach((fragmento, indice) => {
    // Se corta por punto seguido, pero respetando abreviaturas habituales del
    // lenguaje jurídico ("art.", "núm.", "apdo.") para no partir por la mitad.
    const texto = fragmento.content
      .replace(/\b(art|arts|núm|num|apdo|pág|pag|ss|etc)\./gi, "$1<<>>")
      .split(/(?<=[.:;])\s+/)
      .map((f) => f.replace(/<<>>/g, ".").trim())
      .filter((f) => f.length > 25);

    for (const frase of texto) {
      candidatas.push({ texto: frase, palabras: palabrasDe(frase), fragmento: indice + 1 });
    }
  });

  // Cuántas frases contienen cada palabra buscada. Una palabra que sale en casi
  // todas no distingue nada: en un temario de derecho administrativo,
  // «administrativo» no separa el grano de la paja, y si pesara lo mismo que
  // «silencio», la pregunta por el silencio administrativo se respondería con
  // la definición del acto administrativo.
  const frecuencia = new Map<string, number>();
  for (const clave of claves) {
    frecuencia.set(
      clave,
      candidatas.filter((c) => c.palabras.has(clave)).length,
    );
  }

  const frases: FraseValorada[] = [];

  for (const candidata of candidatas) {
    let relevancia = 0;

    for (const clave of claves) {
      const comunes = (frecuencia.get(clave) ?? 0) / Math.max(1, candidatas.length);
      const peso = comunes > 0.4 ? 1 : 3;

      if (candidata.palabras.has(clave)) {
        relevancia += peso;
      } else if (
        clave.length >= 6 &&
        [...candidata.palabras].some((p) => p.startsWith(clave.slice(0, -1)))
      ) {
        // Singular y plural, o la misma raíz: «plazo» / «plazos». Solo con
        // palabras largas y comparando palabra completa contra su prefijo, no
        // trozos sueltos dentro de otra palabra.
        relevancia += Math.max(1, peso - 1);
      }
    }

    // Sin ninguna palabra en común, la frase no entra. Los refuerzos de abajo
    // NO pueden meterla: si contaran por sí solos, cualquier frase con un
    // número sería "relevante" para cualquier pregunta, y el motor acabaría
    // respondiendo a «la capital de Mongolia» con el artículo 21.
    if (relevancia === 0) continue;

    let puntos = relevancia;
    // Con cifra dentro pesa más: es lo que se suele preguntar.
    if (contieneCantidad(candidata.texto)) puntos += 1;
    // Y las que citan un artículo son las que el alumno necesita ver.
    if (/\bart\.?\s*\d+/i.test(candidata.texto)) puntos += 2;

    frases.push({ texto: candidata.texto, fragmento: candidata.fragmento, puntos });
  }

  return frases.sort((a, b) => b.puntos - a.puntos);
}

/**
 * Quita el epígrafe pegado al principio de una frase.
 *
 * Al extraer texto de un PDF, el título de sección va sin puntuación y queda
 * cosido a la primera frase: «EL SILENCIO ADMINISTRATIVO En los procedimientos
 * iniciados...». Se corta esa tirada inicial de mayúsculas porque el alumno lo
 * lee como si la IA estuviera gritando.
 */
function limpiarEpigrafe(frase: string): string {
  const limpia = frase.replace(/\s+/g, " ").trim();
  const epigrafe = limpia.match(/^([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s.,·-]{4,60}?)\s+(?=[A-ZÁÉÍÓÚÑ][a-záéíóúñ])/);

  if (!epigrafe) return limpia;

  // Solo si de verdad es un epígrafe: todo en mayúsculas y sin punto final.
  const candidato = epigrafe[1].trim();
  if (candidato !== candidato.toUpperCase() || candidato.endsWith(".")) return limpia;

  return limpia.slice(epigrafe[0].length).trim();
}

/** Une frases sin repetir ideas y añadiendo la cita de cada una. */
function componer(frases: FraseValorada[], maximo: number): {
  texto: string;
  citas: number[];
} {
  const usadas: string[] = [];
  const citas = new Set<number>();
  const partes: string[] = [];

  for (const frase of frases) {
    if (partes.length >= maximo) break;

    // Evita repetir lo mismo dicho de dos maneras: si comparte demasiadas
    // palabras con algo ya incluido, se descarta.
    const palabras = new Set(NORMALIZAR(frase.texto).split(/\s+/));
    const repetida = usadas.some((anterior) => {
      const otras = new Set(NORMALIZAR(anterior).split(/\s+/));
      const comunes = [...palabras].filter((w) => otras.has(w)).length;
      return comunes / Math.max(1, palabras.size) > 0.6;
    });
    if (repetida) continue;

    usadas.push(frase.texto);
    citas.add(frase.fragmento);
    partes.push(`${limpiarEpigrafe(frase.texto)} [${frase.fragmento}]`);
  }

  return { texto: partes.join(" "), citas: [...citas].sort((a, b) => a - b) };
}

/**
 * Las primeras frases con sustancia de cada fragmento.
 *
 * Sirve para resumir cuando la pregunta no aporta ninguna palabra que buscar.
 * Se descartan los epígrafes sueltos (líneas en mayúsculas o muy cortas), que
 * son índice y no contenido.
 */
function primerasFrases(fragmentos: Fragmento[]): FraseValorada[] {
  const frases: FraseValorada[] = [];

  fragmentos.forEach((fragmento, indice) => {
    const trozos = fragmento.content
      .split(/(?<=[.:;])\s+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 60 && f !== f.toUpperCase())
      .slice(0, 2);

    for (const trozo of trozos) {
      frases.push({ texto: trozo, fragmento: indice + 1, puntos: 1 });
    }
  });

  return frases;
}

const SIN_INFORMACION =
  "No encuentro esa información en el material de tu academia. Puede que ese tema todavía no esté abierto o que no lo tengas incluido en tu plan. Consúltalo con tu preparador.";

/**
 * Responde a partir de los fragmentos.
 *
 * La forma de la respuesta cambia según lo que se pregunte, porque no es lo
 * mismo pedir un plazo que pedir un resumen.
 */
export function responderConMaterial(
  pregunta: string,
  fragmentos: Fragmento[],
): RespuestaLocal {
  const intencion = detectarIntencion(pregunta);

  if (fragmentos.length === 0) {
    return { texto: SIN_INFORMACION, intencion, citas: [], confianza: "baja" };
  }

  const frases = valorarFrases(pregunta, fragmentos);

  // «Resúmeme esto» no lleva ninguna palabra que buscar: lo que hay que
  // resumir es el material que ya se ha recuperado por el tema, no lo que
  // coincida con la pregunta. Así que se resume lo que hay.
  if (frases.length === 0 && intencion === "RESUMEN") {
    const { texto, citas } = componer(primerasFrases(fragmentos), 8);
    if (texto) {
      return {
        texto: `Esto es lo que dice tu material:\n\n${texto}`,
        intencion,
        citas,
        confianza: "media",
      };
    }
  }

  if (frases.length === 0) {
    return {
      texto: `${SIN_INFORMACION}\n\nHe buscado en ${fragmentos.length} fragmentos de tu temario, pero ninguno habla de eso.`,
      intencion,
      citas: [],
      confianza: "baja",
    };
  }

  const mejorPuntuacion = frases[0].puntos;
  const confianza: RespuestaLocal["confianza"] =
    mejorPuntuacion >= 9 ? "alta" : mejorPuntuacion >= 5 ? "media" : "baja";

  switch (intencion) {
    case "RESUMEN": {
      const { texto, citas } = componer(frases, 6);
      return {
        texto: `Esto es lo que dice tu material:\n\n${texto}`,
        intencion,
        citas,
        confianza,
      };
    }

    case "PLAZO_O_CIFRA": {
      // Se priorizan las frases con la cantidad dentro, escrita en cifra o en
      // letra: en el temario los plazos suelen ir con letra.
      const conCifras = frases.filter((f) => contieneCantidad(f.texto));
      const elegidas = conCifras.length > 0 ? conCifras : frases;
      const { texto, citas } = componer(elegidas, 3);
      return { texto, intencion, citas, confianza };
    }

    case "COMPARACION": {
      const { texto, citas } = componer(frases, 6);
      return {
        texto: `Tu material dice lo siguiente sobre los dos términos:\n\n${texto}\n\nLa comparación fina la tiene que hacer tu preparador: aquí solo he reunido lo que dice el temario de cada uno.`,
        intencion,
        citas,
        confianza,
      };
    }

    case "ENUMERACION": {
      const { citas } = componer(frases, 6);
      const lista = frases
        .slice(0, 6)
        .map((f) => `· ${limpiarEpigrafe(f.texto)} [${f.fragmento}]`)
        .join("\n");
      return { texto: lista, intencion, citas, confianza };
    }

    case "DEFINICION": {
      // Una definición suele venir en la frase que contiene «es», «se entiende
      // por» o «se define como». Eso SUMA puntos, pero no filtra: si filtrara,
      // la frase que mejor responde se caería solo por no llevar el verbo, y
      // se acabaría definiendo otra cosa parecida que sí lo lleva.
      const definitoria = /\b(es|son|se entiende|se define|consiste en|se considera)\b/i;
      const ordenadas = [...frases]
        .map((f) => ({
          ...f,
          puntos: f.puntos + (definitoria.test(f.texto) ? 3 : 0),
        }))
        .sort((a, b) => b.puntos - a.puntos);

      const { texto, citas } = componer(ordenadas, 3);
      return { texto, intencion, citas, confianza };
    }

    default: {
      const { texto, citas } = componer(frases, 4);
      return { texto, intencion, citas, confianza };
    }
  }
}

/**
 * Genera preguntas tipo test a partir del material, sin proveedor externo.
 *
 * Toma frases con datos concretos (cifras, plazos, artículos) y construye
 * preguntas de completar. Las opciones falsas se generan alterando la cifra o
 * cogiendo datos de otras frases del mismo tema, que es lo que las hace
 * plausibles.
 *
 * Todo lo que salga de aquí entra como BORRADOR, igual que lo generado por un
 * modelo: quien decide sigue siendo el profesor.
 */
export type PreguntaGenerada = {
  enunciado: string;
  opciones: string[];
  correcta: number;
  explicacion: string;
  fragmento: number;
};

export function generarPreguntasLocales(
  fragmentos: Fragmento[],
  cantidad: number,
): PreguntaGenerada[] {
  const candidatas: { frase: string; fragmento: number; dato: string }[] = [];

  fragmentos.forEach((fragmento, indice) => {
    const frases = fragmento.content
      .split(/(?<=[.:;])\s+/)
      .map((f) => f.trim())
      .filter((f) => f.length > 40 && f.length < 300);

    for (const frase of frases) {
      // Busca el dato concreto que se puede preguntar: un plazo, una cifra o
      // un número de artículo.
      const plazo = frase.match(
        /\b(un|una|dos|tres|cuatro|cinco|seis|diez|quince|veinte|treinta|\d+)\s+(dias?|meses|anos|años|horas)\b/i,
      );
      const articulo = frase.match(/\bart(?:ículo|iculo)?\.?\s*(\d+(?:\.\d+)?)/i);

      const dato = plazo?.[0] ?? articulo?.[0];
      if (dato) candidatas.push({ frase, fragmento: indice + 1, dato });
    }
  });

  const generadas: PreguntaGenerada[] = [];
  const usadas = new Set<string>();

  for (const candidata of candidatas) {
    if (generadas.length >= cantidad) break;
    if (usadas.has(candidata.frase)) continue;
    usadas.add(candidata.frase);

    const opciones = construirOpciones(candidata.dato, candidatas);
    if (opciones.length < 3) continue;

    // La correcta se coloca en una posición variable: si siempre fuera la A,
    // el banco no serviría para nada.
    const posicion = generadas.length % opciones.length;
    const ordenadas = [...opciones];
    const indiceCorrecta = ordenadas.indexOf(candidata.dato);
    [ordenadas[posicion], ordenadas[indiceCorrecta]] = [
      ordenadas[indiceCorrecta],
      ordenadas[posicion],
    ];

    const hueco = limpiarEpigrafe(candidata.frase).replace(candidata.dato, "________");
    // Si el dato estaba dentro del epígrafe que se acaba de quitar, la pregunta
    // se queda sin hueco y no vale.
    if (!hueco.includes("________")) continue;

    generadas.push({
      enunciado: `Completa según el temario: «${hueco}»`,
      opciones: ordenadas,
      correcta: posicion,
      explicacion: `Según el material: «${limpiarEpigrafe(candidata.frase)}» [${candidata.fragmento}]`,
      fragmento: candidata.fragmento,
    });
  }

  return generadas;
}

/** Opciones falsas plausibles: mismo formato que la correcta, distinto valor. */
function construirOpciones(
  correcta: string,
  candidatas: { dato: string }[],
): string[] {
  const opciones = new Set<string>([correcta]);

  // Primero, datos reales de otras frases del mismo material: son los
  // distractores más creíbles porque suenan a temario.
  for (const otra of candidatas) {
    if (opciones.size >= 4) break;
    if (otra.dato !== correcta && mismaForma(otra.dato, correcta)) {
      opciones.add(otra.dato);
    }
  }

  // Si no hay suficientes, se alteran los números de la correcta.
  if (opciones.size < 4) {
    const numero = correcta.match(/\d+/);
    if (numero) {
      const base = Number(numero[0]);
      for (const delta of [1, 2, -1, 3]) {
        if (opciones.size >= 4) break;
        const nuevo = base + delta;
        if (nuevo > 0) opciones.add(correcta.replace(/\d+/, String(nuevo)));
      }
    } else {
      const equivalencias: Record<string, string[]> = {
        un: ["dos", "tres"],
        una: ["dos", "tres"],
        dos: ["tres", "un"],
        tres: ["dos", "seis"],
        seis: ["tres", "doce"],
        diez: ["quince", "cinco"],
        quince: ["diez", "veinte"],
        veinte: ["quince", "treinta"],
        treinta: ["veinte", "sesenta"],
      };
      const primera = correcta.split(/\s+/)[0].toLowerCase();
      for (const alternativa of equivalencias[primera] ?? []) {
        if (opciones.size >= 4) break;
        opciones.add(correcta.replace(new RegExp(`^${primera}`, "i"), alternativa));
      }
    }
  }

  return [...opciones];
}

/** ¿Son del mismo tipo? Un plazo no se compara con un número de artículo. */
function mismaForma(a: string, b: string): boolean {
  const esPlazo = (t: string) => /\b(dias?|meses|anos|años|horas)\b/i.test(t);
  const esArticulo = (t: string) => /\bart/i.test(t);
  return (esPlazo(a) && esPlazo(b)) || (esArticulo(a) && esArticulo(b));
}

/**
 * Explica por qué una respuesta era incorrecta.
 *
 * Usa la explicación del preparador si existe —que es la buena— y la refuerza
 * con lo que diga el material. Nunca la contradice.
 */
export function explicarFallo(params: {
  enunciado: string;
  respuestaDada: string | null;
  respuestaCorrecta: string;
  explicacionProfesor: string | null;
  fragmentos: Fragmento[];
}): RespuestaLocal {
  const partes: string[] = [];

  partes.push(`La respuesta correcta es: «${params.respuestaCorrecta}».`);

  if (params.respuestaDada) {
    partes.push(`Tú marcaste: «${params.respuestaDada}».`);
  } else {
    partes.push("La dejaste en blanco.");
  }

  if (params.explicacionProfesor) {
    partes.push(`\nTu preparador lo explica así:\n${params.explicacionProfesor}`);
  }

  const frases = valorarFrases(
    `${params.enunciado} ${params.respuestaCorrecta}`,
    params.fragmentos,
  );

  let citas: number[] = [];
  if (frases.length > 0) {
    const { texto, citas: usadas } = componer(frases, 3);
    citas = usadas;
    partes.push(`\nEn tu temario aparece así:\n${texto}`);
  }

  return {
    texto: partes.join("\n"),
    intencion: "EXPLICACION",
    citas,
    confianza: params.explicacionProfesor ? "alta" : frases.length > 0 ? "media" : "baja",
  };
}
