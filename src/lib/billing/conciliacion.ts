import type { MovimientoBancario } from "./norma43";

/**
 * CASAR TRANSFERENCIAS CON RECIBOS
 *
 * Del extracto del banco a «este ingreso es la mensualidad de Ana».
 *
 * La regla que ordena todo lo demás: **ante la duda, no se casa**. Marcar el
 * recibo equivocado como cobrado es peor que no marcar ninguno, porque nadie se
 * entera: el alumno que sí pagó sigue apareciendo como moroso y se le acaba
 * cortando el acceso, y el que no pagó deja de aparecer. Un ingreso sin casar
 * solo cuesta un minuto de alguien.
 *
 * Por eso esto no cobra nada: propone. Quien mira la pantalla confirma.
 */

/** Un recibo pendiente, con lo justo para poder reconocerlo en un extracto. */
export type ReciboPendiente = {
  id: string;
  concepto: string;
  importeCents: number;
  alumno: string;
  /// Referencia de su factura, si la tiene. Es la pista más fiable de todas.
  referencia: string | null;
};

/** Lo que se propone para un ingreso del extracto, con su motivo. */
export type Propuesta = {
  movimiento: MovimientoBancario;
  /// El recibo propuesto, o nada si no hay ninguno claro.
  recibo: ReciboPendiente | null;
  /// Por qué se propone ese, en palabras de quien lo va a revisar.
  motivo: string;
  /// Si se puede marcar sin mirar. Solo cuando no hay ninguna ambigüedad.
  seguro: boolean;
};

/** Quita acentos, signos y mayúsculas: los bancos recortan y transforman. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Busca a quién corresponde cada ingreso.
 *
 * El orden de las pistas es el de su fiabilidad:
 *
 *   1. La referencia de la factura en el concepto. Es la que pedimos en el
 *      correo, no se parece a nada más y no hay margen de error.
 *   2. El nombre del alumno más el importe exacto. Un nombre suelto no basta:
 *      dos hermanos con el mismo apellido pagan cuotas distintas.
 *   3. El importe exacto, si solo hay UN recibo pendiente con ese importe. Con
 *      dos o más no se propone ninguno: con quince alumnos a cuarenta euros,
 *      acertar sería casualidad.
 *
 * @param movimientos Los ingresos del extracto. Los cargos se ignoran.
 * @param recibos Los recibos pendientes de la academia.
 * @returns Una propuesta por ingreso, en el mismo orden. Las que no tienen
 *   recibo llevan el motivo para poder decidir a mano.
 */
export function proponerConciliacion(
  movimientos: MovimientoBancario[],
  recibos: ReciboPendiente[],
): Propuesta[] {
  // Un recibo no puede casarse con dos ingresos distintos.
  const yaUsados = new Set<string>();
  const propuestas: Propuesta[] = [];

  for (const movimiento of movimientos) {
    // Solo el dinero que entra. Un recibo domiciliado devuelto sale como cargo
    // y no es el pago de nadie.
    if (movimiento.importeCents <= 0) continue;

    const disponibles = recibos.filter((r) => !yaUsados.has(r.id));
    const concepto = normalizar(movimiento.concepto);

    const proponer = (recibo: ReciboPendiente, motivo: string, seguro: boolean) => {
      yaUsados.add(recibo.id);
      propuestas.push({ movimiento, recibo, motivo, seguro });
    };

    // 1 · la referencia de la factura
    const porReferencia = disponibles.find(
      (r) => r.referencia && concepto.includes(normalizar(r.referencia)),
    );
    if (porReferencia) {
      const cuadra = porReferencia.importeCents === movimiento.importeCents;
      proponer(
        porReferencia,
        cuadra
          ? `Lleva la referencia ${porReferencia.referencia} y el importe cuadra.`
          : `Lleva la referencia ${porReferencia.referencia}, pero el importe no cuadra: revísalo.`,
        cuadra,
      );
      continue;
    }

    // 2 · el nombre y el importe exacto
    const porNombre = disponibles.filter(
      (r) =>
        r.importeCents === movimiento.importeCents &&
        concepto.includes(normalizar(r.alumno.split(" ")[0] ?? "")) &&
        normalizar(r.alumno.split(" ")[0] ?? "").length >= 3,
    );
    if (porNombre.length === 1) {
      proponer(porNombre[0], `El nombre y el importe coinciden.`, true);
      continue;
    }
    if (porNombre.length > 1) {
      propuestas.push({
        movimiento,
        recibo: null,
        motivo: `Encaja con ${porNombre.length} alumnos con ese nombre e importe. Elígelo tú.`,
        seguro: false,
      });
      continue;
    }

    // 3 · el importe exacto, y solo si es único
    const porImporte = disponibles.filter(
      (r) => r.importeCents === movimiento.importeCents,
    );
    if (porImporte.length === 1) {
      proponer(
        porImporte[0],
        "Es el único recibo pendiente con ese importe exacto.",
        true,
      );
      continue;
    }

    propuestas.push({
      movimiento,
      recibo: null,
      motivo:
        porImporte.length > 1
          ? `Hay ${porImporte.length} recibos pendientes de ese importe. Elígelo tú.`
          : "No encaja con ningún recibo pendiente.",
      seguro: false,
    });
  }

  return propuestas;
}
