/**
 * IBAN · validación y presentación
 *
 * Un IBAN mal escrito no se descubre al escribirlo: se descubre semanas
 * después, cuando el banco devuelve el recibo y la academia tiene que llamar al
 * alumno. Por eso se comprueba el dígito de control aquí, al guardarlo.
 *
 * El algoritmo es el de la norma ISO 13616: se mueven los cuatro primeros
 * caracteres al final, se convierte cada letra en dos dígitos (A=10 … Z=35) y
 * el número resultante tiene que dar 1 al dividirlo entre 97. Se calcula por
 * trozos porque el número completo no cabe en un entero de JavaScript.
 */

/** Longitud del IBAN por país. Solo los que se usan de verdad aquí. */
const LONGITUDES: Record<string, number> = {
  ES: 24,
  PT: 25,
  FR: 27,
  IT: 27,
  DE: 22,
  GB: 22,
  IE: 22,
  NL: 18,
  BE: 16,
  AD: 24,
  LU: 20,
  CH: 21,
  AT: 20,
};

/** Quita espacios y guiones y pasa a mayúsculas. */
export function normalizarIban(valor: string): string {
  return valor.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Qué ha pasado al validar un IBAN.
 *
 * Cuando falla dice **por qué** en lenguaje llano. Un «IBAN no válido» a secas
 * deja a quien lo teclea sin saber si sobra un dígito o si se equivocó de país.
 */
export type ResultadoIban =
  | { valido: true; iban: string; pais: string }
  | { valido: false; motivo: string };

/**
 * Valida un IBAN con el algoritmo oficial, módulo 97.
 *
 * No es una comprobación de formato: es la misma cuenta que hace el banco, así
 * que un dígito cambiado se detecta aquí y no tres semanas después, cuando la
 * remesa vuelve rechazada y el alumno lleva un mes sin pagar sin saberlo.
 *
 * @param entrada El IBAN tal como se ha escrito, con espacios o sin ellos.
 * @returns `{ valido: true }` con la versión normalizada, o `{ valido: false }`
 *   con el motivo en lenguaje llano.
 */
export function validarIban(valor: string): ResultadoIban {
  const iban = normalizarIban(valor);

  if (iban.length === 0) return { valido: false, motivo: "Escribe el IBAN." };

  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) {
    return {
      valido: false,
      motivo: "El IBAN empieza por dos letras del país y dos dígitos de control.",
    };
  }

  const pais = iban.slice(0, 2);
  const esperada = LONGITUDES[pais];

  if (esperada === undefined) {
    return { valido: false, motivo: `No se reconoce el país «${pais}».` };
  }
  if (iban.length !== esperada) {
    return {
      valido: false,
      motivo: `Un IBAN de ${pais} tiene ${esperada} caracteres y este tiene ${iban.length}.`,
    };
  }

  if (mod97(iban) !== 1) {
    return {
      valido: false,
      motivo: "El IBAN no es correcto: los dígitos de control no cuadran. Revísalo.",
    };
  }

  return { valido: true, iban, pais };
}

/**
 * Resto de dividir el IBAN entre 97, calculado por trozos.
 *
 * El número completo de un IBAN español tiene 24 dígitos convertidos en más de
 * 30: no cabe en un `number`. Se va arrastrando el resto de nueve en nueve
 * dígitos, que es exactamente lo que hace la norma.
 */
function mod97(iban: string): number {
  const reordenado = iban.slice(4) + iban.slice(0, 4);

  let numerico = "";
  for (const caracter of reordenado) {
    numerico += /[A-Z]/.test(caracter)
      ? String(caracter.charCodeAt(0) - 55)
      : caracter;
  }

  let resto = 0;
  for (let i = 0; i < numerico.length; i += 7) {
    resto = Number(String(resto) + numerico.slice(i, i + 7)) % 97;
  }
  return resto;
}

/** IBAN en grupos de cuatro, que es como se lee y como se copia de un papel. */
export function formatearIban(valor: string): string {
  return normalizarIban(valor).replace(/(.{4})/g, "$1 ").trim();
}

/**
 * IBAN parcialmente oculto para las pantallas.
 *
 * En una lista de alumnos no hace falta ver el número de cuenta entero de
 * nadie: se enseña lo justo para reconocerlo. El completo solo aparece al
 * editarlo.
 */
export function ocultarIban(valor: string): string {
  const iban = normalizarIban(valor);
  if (iban.length < 8) return "••••";
  return `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}`;
}

/**
 * Referencia de mandato SEPA.
 *
 * Tiene que ser única por deudor y estable en el tiempo: si cambia, el banco lo
 * trata como un mandato nuevo y vuelve a pedir el primer cobro como FRST. Se
 * construye con un prefijo de la academia y un identificador del alumno, sin
 * caracteres raros: la norma solo admite un juego muy limitado.
 */
export function generarReferenciaMandato(
  prefijoAcademia: string,
  studentId: string,
): string {
  const prefijo = limpiarParaSepa(prefijoAcademia).slice(0, 8) || "CATEDRIA";
  const sufijo = studentId.replace(/-/g, "").slice(-12).toUpperCase();
  return `${prefijo}-${sufijo}`;
}

/**
 * Deja solo los caracteres que admite SEPA.
 *
 * La norma acepta letras sin acentos, dígitos y unos pocos signos. Si se cuela
 * una eñe o un acento, el banco rechaza el fichero entero, no la línea.
 */
export function limpiarParaSepa(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
