/**
 * NORMA 43 · el extracto que dan todos los bancos españoles
 *
 * El «cuaderno 43» del Consejo Superior Bancario. Se descarga de la banca
 * electrónica y trae los movimientos de la cuenta: fecha, importe y concepto.
 * Con eso se pueden casar las transferencias de los alumnos con sus recibos, en
 * lugar de ir marcándolos a mano uno a uno mirando el extracto.
 *
 * Es un formato de posiciones fijas, sin separadores, de los de contar
 * caracteres. Cada línea empieza por dos dígitos que dicen qué es:
 *
 *   11  cabecera de cuenta
 *   22  un movimiento
 *   23  líneas de concepto del movimiento anterior (hasta cinco)
 *   33  fin de cuenta
 *   88  fin de fichero
 *
 * Los importes vienen en enteros con dos decimales implícitos: «000000012345»
 * son 123,45 €. No hay coma, y meterla al leerlo es la forma clásica de cobrar
 * cien veces de más.
 *
 * Se lee solo lo que hace falta para conciliar; el resto de campos del cuaderno
 * se ignoran a propósito, porque cada uno que se lee es uno más que puede
 * fallar cuando un banco lo rellene a su manera.
 */

/** Un movimiento del extracto, ya interpretado. */
export type MovimientoBancario = {
  /// Fecha de la operación.
  fecha: Date;
  /// Importe en céntimos. Positivo si entra dinero, negativo si sale.
  importeCents: number;
  /// El texto que ve el titular: nombre del ordenante, concepto, referencias.
  concepto: string;
  /// Referencia que da el banco al apunte. Sirve para no importar dos veces.
  referencia: string;
};

/** Lo leído de un extracto: los movimientos y lo que no se ha entendido. */
export type LecturaDeExtracto = {
  movimientos: MovimientoBancario[];
  /// Líneas que no se han podido leer, con el motivo. No se ocultan: un
  /// extracto medio leído es peor que uno que no se lee.
  errores: string[];
};

/** Dos dígitos de año del cuaderno a un año de cuatro cifras. */
function anioCompleto(dosDigitos: number): number {
  // El cuaderno 43 es de 1988 y no previó esto. Se resuelve como todo el mundo:
  // por debajo de 80 es de este siglo.
  return dosDigitos < 80 ? 2000 + dosDigitos : 1900 + dosDigitos;
}

/**
 * Lee una fecha en formato AAMMDD.
 *
 * @param texto Los seis dígitos.
 * @returns La fecha, o `null` si no son seis dígitos o no forman una fecha.
 */
export function leerFecha(texto: string): Date | null {
  if (!/^\d{6}$/.test(texto)) return null;

  const anio = anioCompleto(Number(texto.slice(0, 2)));
  const mes = Number(texto.slice(2, 4));
  const dia = Number(texto.slice(4, 6));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const fecha = new Date(anio, mes - 1, dia);
  // Un 31 de febrero se convertiría en marzo sin protestar.
  if (fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;

  return fecha;
}

/**
 * Lee un importe del cuaderno: entero con dos decimales implícitos.
 *
 * @param texto Los catorce dígitos del importe.
 * @param signo «1» si sale dinero, «2» si entra.
 * @returns El importe en céntimos, negativo si es un cargo; `null` si no se
 *   puede leer. Se devuelve en céntimos y no en euros a propósito: pasar por
 *   coma flotante es lo que hace que 0,1 + 0,2 no sea 0,3.
 */
export function leerImporte(texto: string, signo: string): number | null {
  if (!/^\d+$/.test(texto)) return null;
  const centimos = Number(texto);
  if (!Number.isSafeInteger(centimos)) return null;
  return signo === "1" ? -centimos : centimos;
}

/**
 * Interpreta un fichero de Norma 43.
 *
 * @param contenido El fichero entero, tal cual se descargó del banco.
 * @returns Los movimientos leídos y las líneas que no se han podido interpretar.
 *   **No lanza**: un extracto con una línea rara tiene que poder revisarse igual,
 *   con el problema a la vista.
 */
export function leerNorma43(contenido: string): LecturaDeExtracto {
  const movimientos: MovimientoBancario[] = [];
  const errores: string[] = [];

  const lineas = contenido.split(/\r?\n/);

  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    if (linea.trim().length === 0) continue;

    const tipo = linea.slice(0, 2);

    // Líneas de concepto: se pegan al movimiento anterior.
    if (tipo === "23") {
      const ultimo = movimientos[movimientos.length - 1];
      if (!ultimo) {
        errores.push(`Línea ${i + 1}: un concepto sin movimiento al que pegarse.`);
        continue;
      }
      const trozo = `${linea.slice(4, 42)} ${linea.slice(42, 80)}`.trim();
      if (trozo) ultimo.concepto = `${ultimo.concepto} ${trozo}`.trim();
      continue;
    }

    if (tipo !== "22") continue;

    if (linea.length < 80) {
      errores.push(
        `Línea ${i + 1}: un movimiento tiene que ocupar 80 caracteres y ocupa ${linea.length}.`,
      );
      continue;
    }

    const fecha = leerFecha(linea.slice(10, 16));
    if (!fecha) {
      errores.push(`Línea ${i + 1}: la fecha de la operación no se entiende.`);
      continue;
    }

    const importeCents = leerImporte(linea.slice(28, 42), linea.slice(27, 28));
    if (importeCents === null) {
      errores.push(`Línea ${i + 1}: el importe no se entiende.`);
      continue;
    }

    movimientos.push({
      fecha,
      importeCents,
      // Referencias 1 y 2, que es donde muchos bancos ponen el ordenante.
      concepto: `${linea.slice(52, 64)} ${linea.slice(64, 80)}`.trim(),
      referencia: linea.slice(42, 52).trim(),
    });
  }

  return { movimientos, errores };
}
