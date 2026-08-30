/**
 * CÁLCULO DE UNA FACTURA
 *
 * Está aparte de las acciones y sin tocar la base de datos porque es lo que
 * tiene que salir bien siempre y lo que se puede probar sin levantar nada. Un
 * céntimo de diferencia entre lo que dice la factura y lo que suman sus líneas
 * es un problema en la declaración trimestral.
 *
 * Reglas de redondeo, que es donde se equivoca todo el mundo:
 *
 *   · Se trabaja en céntimos, con enteros. Nunca en euros con decimales: 0.1 +
 *     0.2 no da 0.3 en coma flotante, y eso acaba en un descuadre.
 *   · El IVA se calcula sobre la base de CADA línea y se redondea línea a
 *     línea, no sobre el total. Es como lo hace Hacienda y como lo hace
 *     cualquier programa de contabilidad: calcularlo sobre el total da
 *     diferencias de un céntimo que no cuadran con el desglose impreso.
 *   · El descuento se aplica sobre el subtotal y se reparte proporcionalmente
 *     entre las líneas antes de calcular impuestos, para que el desglose por
 *     tipo siga siendo correcto.
 */

export type LineaFactura = {
  description: string;
  /// Cantidad. Admite decimales (media hora de clase, por ejemplo).
  quantity: number;
  /// Precio unitario SIN impuestos, en céntimos.
  unitCents: number;
  /// Tipo de IVA en porcentaje: 0, 4, 10, 21.
  taxRate: number;
};

/** Una línea de factura con su IVA y sus totales ya calculados. */
export type LineaCalculada = LineaFactura & {
  baseCents: number;
  taxCents: number;
  totalCents: number;
};

/**
 * Los totales de una factura, desglosados por tipo de IVA.
 *
 * Van desglosados porque la ley lo exige cuando hay varios tipos en la misma
 * factura, y porque una academia puede tener una parte exenta y otra no.
 */
export type TotalesFactura = {
  lineas: LineaCalculada[];
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxCents: number;
  totalCents: number;
  /// Desglose por tipo de IVA, que es lo que hay que imprimir en la factura.
  porTipo: { taxRate: number; baseCents: number; taxCents: number }[];
};

/** Redondeo al céntimo, medio arriba, que es el criterio habitual. */
function redondear(valor: number): number {
  return Math.round(valor);
}

/**
 * Calcula las líneas y los totales de una factura.
 *
 * Todo en céntimos y en enteros. El redondeo se hace **por línea** y luego se
 * suma, que es como lo hace Hacienda: redondear el total al final da céntimos
 * de diferencia y una factura que no cuadra con su propio desglose.
 *
 * @param lineas Concepto, cantidad, precio unitario y tipo de IVA.
 * @returns Las líneas con sus importes y los totales agrupados por tipo.
 */
export function calcularFactura(
  lineas: LineaFactura[],
  descuentoCents = 0,
): TotalesFactura {
  const bases = lineas.map((l) => redondear(l.quantity * l.unitCents));
  const subtotalCents = bases.reduce((s, b) => s + b, 0);

  // El descuento no puede superar el subtotal ni ser negativo.
  const descuento = Math.max(0, Math.min(descuentoCents, subtotalCents));

  // Se reparte proporcionalmente. El último se lleva la diferencia para que la
  // suma cuadre al céntimo pase lo que pase con el redondeo.
  const descuentos: number[] = [];
  let repartido = 0;
  bases.forEach((base, i) => {
    if (i === bases.length - 1) {
      descuentos.push(descuento - repartido);
    } else {
      const parte = subtotalCents === 0 ? 0 : redondear((base * descuento) / subtotalCents);
      descuentos.push(parte);
      repartido += parte;
    }
  });

  const calculadas: LineaCalculada[] = lineas.map((linea, i) => {
    const baseCents = bases[i] - (descuentos[i] ?? 0);
    const taxCents = redondear((baseCents * linea.taxRate) / 100);
    return {
      ...linea,
      baseCents,
      taxCents,
      totalCents: baseCents + taxCents,
    };
  });

  const taxableCents = calculadas.reduce((s, l) => s + l.baseCents, 0);
  const taxCents = calculadas.reduce((s, l) => s + l.taxCents, 0);

  // Desglose por tipo, ordenado de menor a mayor como en las facturas.
  const mapa = new Map<number, { baseCents: number; taxCents: number }>();
  for (const linea of calculadas) {
    const actual = mapa.get(linea.taxRate) ?? { baseCents: 0, taxCents: 0 };
    actual.baseCents += linea.baseCents;
    actual.taxCents += linea.taxCents;
    mapa.set(linea.taxRate, actual);
  }

  const porTipo = [...mapa.entries()]
    .map(([taxRate, v]) => ({ taxRate, ...v }))
    .sort((a, b) => a.taxRate - b.taxRate);

  return {
    lineas: calculadas,
    subtotalCents,
    discountCents: descuento,
    taxableCents,
    taxCents,
    totalCents: taxableCents + taxCents,
    porTipo,
  };
}

/**
 * Menciones de exención de IVA más habituales en una academia.
 *
 * La preparación de oposiciones suele estar exenta por el artículo 20.Uno.9º de
 * la Ley 37/1992. No siempre: depende de si la materia está incluida en planes
 * de estudio del sistema educativo, y hay servicios accesorios que sí tributan.
 * Por eso se ofrecen como opciones y no se decide por la academia.
 */
export const MENCIONES_EXENCION = [
  {
    valor: "EDUCACION",
    etiqueta: "Enseñanza exenta (art. 20.Uno.9º LIVA)",
    texto:
      "Operación exenta de IVA en virtud del artículo 20.Uno.9º de la Ley 37/1992, del Impuesto sobre el Valor Añadido.",
  },
  {
    valor: "NO_SUJETA",
    etiqueta: "No sujeta",
    texto: "Operación no sujeta a IVA.",
  },
  {
    valor: "INVERSION",
    etiqueta: "Inversión del sujeto pasivo",
    texto:
      "Operación con inversión del sujeto pasivo conforme al artículo 84.Uno.2º de la Ley 37/1992.",
  },
] as const;

/** Referencia visible de una factura: serie, año y número con ceros. */
export function referenciaFactura(
  codigoSerie: string,
  anio: number,
  numero: number,
): string {
  return `${codigoSerie}/${anio}/${String(numero).padStart(4, "0")}`;
}

/** Convierte «60», «60,50» o «60.50 €» en céntimos. Devuelve null si no vale. */
export function aCentimos(texto: string): number | null {
  const limpio = texto.replace(/[€\s]/g, "").replace(",", ".");
  if (limpio === "") return null;
  const valor = Number(limpio);
  if (!Number.isFinite(valor)) return null;
  return Math.round(valor * 100);
}
