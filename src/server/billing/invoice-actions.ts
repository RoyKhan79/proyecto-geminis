"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { enviarFacturaAlCliente } from "./invoice-email";
import { requirePermission } from "@/lib/auth/context";
import { transaccionDeAcademia, type TenantClient } from "@/lib/db/tenant";
import {
  aCentimos,
  calcularFactura,
  MENCIONES_EXENCION,
  referenciaFactura,
  type LineaFactura,
} from "@/lib/billing/invoice";
import { inicioDeMes, nombreDelMes } from "./service";

/**
 * Lo que una acción devuelve a la pantalla.
 *
 * `undefined` es el estado inicial, antes de que nadie haya enviado nada. El
 * error viaja como dato y no como excepción a propósito: una excepción en una
 * acción de servidor llega al navegador como «algo ha fallado», y aquí hace
 * falta poder decir qué exactamente y volver a pintar el formulario con lo que
 * la persona había escrito.
 */
export type InvoiceState =
  | { error?: string; ok?: boolean; id?: string; mensaje?: string }
  | undefined;

/**
 * FACTURACIÓN
 *
 * La regla que ordena todo lo demás: **una factura emitida no se toca**. Ni se
 * edita ni se borra. Si está mal, se emite una rectificativa que la anula y se
 * hace otra bien. Es lo que exige el reglamento de facturación y es lo único
 * que da sentido a una numeración correlativa.
 */

// ── Series ───────────────────────────────────────────────────────────────────

const serieSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Escribe el código de la serie.")
    .max(8)
    .regex(/^[A-Za-z0-9]+$/, "Solo letras y números, sin espacios."),
  name: z.string().trim().min(2, "Ponle un nombre."),
  year: z.coerce.number().int().min(2000).max(2100),
  isDefault: z.string().optional(),
  isRectifying: z.string().optional(),
});

/**
 * Crea o edita una serie de facturación.
 *
 * La serie es lo que fija la numeración correlativa y si va exenta de IVA por
 * el artículo 20.Uno.9º de la ley del IVA, que es el caso de mucha enseñanza.
 *
 * @returns Confirmación, o el motivo.
 */
export async function saveInvoiceSeriesAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  const ctx = await requirePermission("payments.write");
  const parsed = serieSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;
  const codigo = data.code.toUpperCase();

  const existe = await ctx.db.invoiceSeries.findFirst({
    where: { code: codigo, year: data.year },
    select: { id: true },
  });
  if (existe) return { error: `Ya existe la serie ${codigo} de ${data.year}.` };

  const porDefecto = data.isDefault === "on";

  if (porDefecto) {
    await ctx.db.invoiceSeries.updateMany({
      where: { year: data.year, isDefault: true },
      data: { isDefault: false },
    });
  }

  const serie = await ctx.db.invoiceSeries.create({
    data: {
      code: codigo,
      name: data.name,
      year: data.year,
      isDefault: porDefecto,
      isRectifying: data.isRectifying === "on",
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "invoice.series.create",
    entityType: "InvoiceSeries",
    entityId: serie.id,
    changes: { codigo, anio: data.year },
  });

  revalidatePath("/gestion/facturas");
  return { ok: true };
}

// ── Emitir una factura ───────────────────────────────────────────────────────

const facturaSchema = z.object({
  studentId: z.string().min(1, "Elige un alumno."),
  seriesId: z.string().min(1, "Elige una serie."),
  issuedOn: z.string().trim().min(1, "Indica la fecha de la factura."),
  dueOn: z.string().trim().optional(),
  discount: z.string().trim().optional(),
  exemption: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
  paymentId: z.string().trim().optional(),
});

/** Lee las líneas del formulario: llegan como linea.0.descripcion, etc. */
function leerLineas(formData: FormData): LineaFactura[] {
  const lineas: LineaFactura[] = [];

  for (let i = 0; i < 20; i += 1) {
    const descripcion = String(formData.get(`linea.${i}.descripcion`) ?? "").trim();
    if (!descripcion) continue;

    const cantidad = Number(
      String(formData.get(`linea.${i}.cantidad`) ?? "1").replace(",", "."),
    );
    const precio = aCentimos(String(formData.get(`linea.${i}.precio`) ?? ""));
    const iva = Number(String(formData.get(`linea.${i}.iva`) ?? "0"));

    if (precio === null || !Number.isFinite(cantidad) || cantidad <= 0) continue;

    lineas.push({
      description: descripcion,
      quantity: cantidad,
      unitCents: precio,
      taxRate: Number.isFinite(iva) ? iva : 0,
    });
  }

  return lineas;
}

/**
 * Reserva el siguiente número de la serie.
 *
 * Va dentro de una transacción con bloqueo de fila (`FOR UPDATE`). Sin él, dos
 * personas emitiendo a la vez se llevarían el mismo número, y una numeración
 * con un duplicado no es una numeración correlativa: es un problema con
 * Hacienda.
 */
async function reservarNumero(
  academyId: string,
  seriesId: string,
): Promise<{ numero: number; code: string; year: number } | null> {
  return transaccionDeAcademia(academyId, async (tx) => {
    // La consulta lleva el academyId a mano: dentro de una transacción se
    // trabaja con el cliente sin guardia, y RLS comprueba lo mismo por debajo.
    const filas = await tx.$queryRaw<
      { id: string; code: string; year: number; lastNumber: number }[]
    >`SELECT id, code, year, "lastNumber" FROM invoice_series
       WHERE id = ${seriesId} AND "academyId" = ${academyId} FOR UPDATE`;

    const serie = filas[0];
    if (!serie) return null;

    const numero = serie.lastNumber + 1;

    await tx.invoiceSeries.update({
      where: { id: serie.id },
      data: { lastNumber: numero },
    });

    return { numero, code: serie.code, year: serie.year };
  });
}

/**
 * Emite una factura y le asigna su número.
 *
 * @returns El identificador de la factura emitida, o el motivo del fallo.
 * @remarks A partir de aquí **la factura no se puede modificar ni borrar**: si
 *   hay que corregirla se emite una rectificativa, que es lo que exige la ley.
 *   La numeración se reserva dentro de una transacción con bloqueo, porque dos
 *   personas emitiendo a la vez sacarían el mismo número y eso es un problema
 *   con Hacienda, no un error de pantalla.
 */
export async function issueInvoiceAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  const ctx = await requirePermission("payments.write");
  const parsed = facturaSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const lineas = leerLineas(formData);
  if (lineas.length === 0) {
    return { error: "La factura no tiene ninguna línea con importe." };
  }

  const alumno = await ctx.db.membership.findUnique({
    where: { id: data.studentId },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      studentProfile: {
        select: { nationalId: true, address: true, city: true, postalCode: true, province: true },
      },
    },
  });
  if (!alumno) return { error: "Ese alumno no existe." };

  const academia = await ctx.db.academy.findUnique({
    where: { id: ctx.academy.id },
    select: {
      name: true,
      legalName: true,
      taxId: true,
      address: true,
      city: true,
      province: true,
      email: true,
    },
  });
  if (!academia) return { error: "No se ha podido leer la academia." };

  if (!academia.taxId) {
    return {
      error:
        "Falta el NIF de la academia. Una factura sin el NIF de quien la emite no es válida: complétalo en Pagos → Remesas.",
    };
  }

  const descuento = data.discount ? (aCentimos(data.discount) ?? 0) : 0;
  const totales = calcularFactura(lineas, descuento);

  const numeracion = await reservarNumero(ctx.academy.id, data.seriesId);
  if (!numeracion) return { error: "Esa serie de facturación no existe." };

  const exencion = MENCIONES_EXENCION.find((m) => m.valor === data.exemption);
  const hayTipoCero = totales.porTipo.some((t) => t.taxRate === 0);

  if (hayTipoCero && !exencion) {
    return {
      error:
        "Hay líneas al 0 % de IVA. Una factura exenta tiene que decir por qué lo está: elige la mención de exención.",
    };
  }

  const direccionAlumno = [
    alumno.studentProfile?.address,
    alumno.studentProfile?.postalCode,
    alumno.studentProfile?.city,
    alumno.studentProfile?.province,
  ]
    .filter(Boolean)
    .join(", ");

  const factura = await ctx.db.invoice.create({
    data: {
      seriesId: data.seriesId,
      studentId: alumno.id,
      number: numeracion.numero,
      reference: referenciaFactura(numeracion.code, numeracion.year, numeracion.numero),
      status: "ISSUED",
      issuedOn: new Date(data.issuedOn),
      dueOn: data.dueOn ? new Date(data.dueOn) : null,

      issuerName: academia.legalName ?? academia.name,
      issuerTaxId: academia.taxId,
      issuerAddress: [academia.address, academia.city, academia.province]
        .filter(Boolean)
        .join(", "),
      issuerEmail: academia.email,

      customerName: `${alumno.user.firstName} ${alumno.user.lastName ?? ""}`.trim(),
      customerTaxId: alumno.studentProfile?.nationalId ?? null,
      customerAddress: direccionAlumno || null,
      customerEmail: alumno.user.email,

      subtotalCents: totales.subtotalCents,
      discountCents: totales.discountCents,
      taxableCents: totales.taxableCents,
      taxCents: totales.taxCents,
      totalCents: totales.totalCents,

      exemptionNote: exencion?.texto ?? null,
      notes: data.notes || null,
      paymentId: data.paymentId || null,
      createdById: ctx.membershipId,
    },
    select: { id: true, reference: true },
  });

  await ctx.db.invoiceLine.createMany({
    data: totales.lineas.map((linea, position) => ({
      invoiceId: factura.id,
      position,
      description: linea.description,
      quantity: linea.quantity,
      unitCents: linea.unitCents,
      taxRate: linea.taxRate,
      baseCents: linea.baseCents,
      taxCents: linea.taxCents,
      totalCents: linea.totalCents,
    })),
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "invoice.issue",
    entityType: "Invoice",
    entityId: factura.id,
    changes: { referencia: factura.reference, total: totales.totalCents },
  });

  revalidatePath("/gestion/facturas");
  revalidatePath(`/gestion/alumnos/${alumno.id}`);
  return { ok: true, id: factura.id };
}

/**
 * Emitir una rectificativa.
 *
 * No borra ni modifica la original: crea otra factura con los importes en
 * negativo que la anula, y marca la original como rectificada. Es la única
 * forma correcta de deshacer una factura ya emitida.
 */
export async function rectifyInvoiceAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  const ctx = await requirePermission("payments.write");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim();

  if (motivo.length < 5) {
    return { error: "Escribe el motivo de la rectificación." };
  }

  const original = await ctx.db.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      reference: true,
      status: true,
      studentId: true,
      seriesId: true,
      issuerName: true,
      issuerTaxId: true,
      issuerAddress: true,
      issuerEmail: true,
      customerName: true,
      customerTaxId: true,
      customerAddress: true,
      customerEmail: true,
      exemptionNote: true,
      lines: {
        orderBy: { position: "asc" },
        select: {
          description: true,
          quantity: true,
          unitCents: true,
          taxRate: true,
        },
      },
    },
  });

  if (!original) return { error: "Esa factura no existe." };
  if (original.status === "DRAFT") return { error: "Un borrador se borra, no se rectifica." };
  if (original.status === "RECTIFIED") {
    return { error: "Esa factura ya está rectificada." };
  }

  // Serie de rectificativas si la hay; si no, la misma de la original.
  const anio = new Date().getFullYear();
  const serieRect =
    (await ctx.db.invoiceSeries.findFirst({
      where: { isRectifying: true, year: anio },
      select: { id: true },
    })) ?? (original.seriesId ? { id: original.seriesId } : null);

  if (!serieRect) return { error: "No hay ninguna serie de facturación disponible." };

  /*
   * Los datos del cliente se releen de su ficha, no se copian de la original.
   *
   * El motivo más común de rectificar es justo que estaban mal: la propia
   * pantalla de la factura dice «pídele el NIF, añádelo a su ficha y emite una
   * rectificativa». Copiándolos de la original, esa instrucción no servía para
   * nada, porque la rectificativa salía con el mismo NIF vacío. Se recurre a
   * los de la original solo para lo que la ficha no tenga.
   */
  const alumnoAhora = await ctx.db.membership.findUnique({
    where: { id: original.studentId },
    select: {
      user: { select: { firstName: true, lastName: true, email: true } },
      studentProfile: {
        select: {
          nationalId: true,
          address: true,
          postalCode: true,
          city: true,
          province: true,
        },
      },
    },
  });

  const nombreAhora = alumnoAhora
    ? `${alumnoAhora.user.firstName} ${alumnoAhora.user.lastName ?? ""}`.trim()
    : "";
  const direccionAhora =
    [
      alumnoAhora?.studentProfile?.address,
      alumnoAhora?.studentProfile?.postalCode,
      alumnoAhora?.studentProfile?.city,
      alumnoAhora?.studentProfile?.province,
    ]
      .filter(Boolean)
      .join(", ") || null;

  const lineas: LineaFactura[] = original.lines.map((l) => ({
    description: `Rectificación de ${original.reference}: ${l.description}`,
    quantity: Number(l.quantity),
    // El importe en negativo es lo que anula la original.
    unitCents: -l.unitCents,
    taxRate: Number(l.taxRate),
  }));

  const totales = calcularFactura(lineas, 0);
  const numeracion = await reservarNumero(ctx.academy.id, serieRect.id);
  if (!numeracion) return { error: "No se ha podido numerar la rectificativa." };

  const rectificativa = await ctx.db.invoice.create({
    data: {
      seriesId: serieRect.id,
      studentId: original.studentId,
      number: numeracion.numero,
      reference: referenciaFactura(numeracion.code, numeracion.year, numeracion.numero),
      status: "ISSUED",
      issuedOn: new Date(),
      rectifiesId: original.id,

      issuerName: original.issuerName,
      issuerTaxId: original.issuerTaxId,
      issuerAddress: original.issuerAddress,
      issuerEmail: original.issuerEmail,
      customerName: nombreAhora || original.customerName,
      customerTaxId:
        alumnoAhora?.studentProfile?.nationalId ?? original.customerTaxId,
      customerAddress: direccionAhora ?? original.customerAddress,
      customerEmail: alumnoAhora?.user.email ?? original.customerEmail,

      subtotalCents: totales.subtotalCents,
      discountCents: 0,
      taxableCents: totales.taxableCents,
      taxCents: totales.taxCents,
      totalCents: totales.totalCents,

      exemptionNote: original.exemptionNote,
      notes: `Factura rectificativa de ${original.reference}. Motivo: ${motivo}`,
      createdById: ctx.membershipId,
    },
    select: { id: true, reference: true },
  });

  await ctx.db.invoiceLine.createMany({
    data: totales.lineas.map((linea, position) => ({
      invoiceId: rectificativa.id,
      position,
      description: linea.description,
      quantity: linea.quantity,
      unitCents: linea.unitCents,
      taxRate: linea.taxRate,
      baseCents: linea.baseCents,
      taxCents: linea.taxCents,
      totalCents: linea.totalCents,
    })),
  });

  await ctx.db.invoice.update({
    where: { id: original.id },
    data: { status: "RECTIFIED" },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "invoice.rectify",
    entityType: "Invoice",
    entityId: rectificativa.id,
    changes: { original: original.reference, motivo },
  });

  revalidatePath("/gestion/facturas");
  return { ok: true, id: rectificativa.id };
}

/**
 * Marca una factura como cobrada.
 *
 * Cambia el estado del cobro, no la factura: el documento sigue siendo
 * inmutable.
 */
export async function markInvoicePaidAction(formData: FormData) {
  const ctx = await requirePermission("payments.write");
  const invoiceId = String(formData.get("invoiceId") ?? "");

  const factura = await ctx.db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, status: true, reference: true },
  });
  if (!factura || factura.status !== "ISSUED") return;

  await ctx.db.invoice.update({
    where: { id: factura.id },
    data: { status: "PAID", paidOn: new Date() },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "invoice.paid",
    entityType: "Invoice",
    entityId: factura.id,
    changes: { referencia: factura.reference },
  });

  revalidatePath("/gestion/facturas");
}

// ── Facturación mensual en bloque ────────────────────────────────────────────

const mensualSchema = z.object({
  periodo: z.string().trim().regex(/^\d{4}-\d{2}$/, "Elige un mes."),
  seriesId: z.string().min(1, "Elige una serie."),
  taxRate: z.coerce.number().min(0).max(21).default(0),
  exemption: z.string().trim().optional(),
});

/**
 * Facturar de golpe los recibos del mes.
 *
 * Es el segundo botón que quita trabajo de verdad: después de emitir los
 * recibos, factura todos los que no tengan factura. Una factura por recibo, con
 * su número correlativo.
 *
 * No factura dos veces el mismo recibo: la factura queda enlazada a él.
 */
type ReciboAFacturar = {
  id: string;
  concept: string;
  amountCents: number;
  dueDate: Date | null;
  student: {
    id: string;
    user: { firstName: string; lastName: string | null; email: string };
    studentProfile: {
      nationalId: string | null;
      address: string | null;
      city: string | null;
      postalCode: string | null;
      province: string | null;
    } | null;
  };
};

type DatosDelEmisor = {
  name: string;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
};

/**
 * Convierte UN recibo en una factura emitida.
 *
 * Vive aparte porque la usan los dos caminos —facturar el mes entero y
 * facturar un recibo suelto— y son cosas que no pueden divergir: si el mensual
 * saca la base del IVA hacia atrás y el suelto no, el mismo alumno recibe dos
 * facturas con importes distintos según por dónde se le facturó.
 */
async function facturarRecibo(
  ctx: { academy: { id: string }; membershipId: string; db: TenantClient },
  recibo: ReciboAFacturar,
  opciones: {
    seriesId: string;
    taxRate: number;
    exencion: string | null;
    academia: DatosDelEmisor;
    direccionAcademia: string;
  },
): Promise<{ id: string } | { error: string }> {
  // El importe del recibo es lo que paga el alumno, impuestos incluidos. Si hay
  // IVA, hay que sacar la base hacia atrás: facturar el importe como base le
  // cobraría al alumno más de lo pactado.
  const tipo = opciones.taxRate;
  const baseUnitaria =
    tipo === 0
      ? recibo.amountCents
      : Math.round((recibo.amountCents * 100) / (100 + tipo));

  const totales = calcularFactura(
    [
      {
        description: recibo.concept,
        quantity: 1,
        unitCents: baseUnitaria,
        taxRate: tipo,
      },
    ],
    0,
  );

  const numeracion = await reservarNumero(ctx.academy.id, opciones.seriesId);
  if (!numeracion) return { error: "Esa serie de facturación no existe." };

  const alumno = recibo.student;
  const factura = await ctx.db.invoice.create({
    data: {
      seriesId: opciones.seriesId,
      studentId: alumno.id,
      paymentId: recibo.id,
      number: numeracion.numero,
      reference: referenciaFactura(numeracion.code, numeracion.year, numeracion.numero),
      status: "ISSUED",
      issuedOn: recibo.dueDate ?? new Date(),

      issuerName: opciones.academia.legalName ?? opciones.academia.name,
      issuerTaxId: opciones.academia.taxId,
      issuerAddress: opciones.direccionAcademia || null,
      issuerEmail: opciones.academia.email,

      customerName: `${alumno.user.firstName} ${alumno.user.lastName ?? ""}`.trim(),
      customerTaxId: alumno.studentProfile?.nationalId ?? null,
      customerAddress:
        [
          alumno.studentProfile?.address,
          alumno.studentProfile?.postalCode,
          alumno.studentProfile?.city,
          alumno.studentProfile?.province,
        ]
          .filter(Boolean)
          .join(", ") || null,
      customerEmail: alumno.user.email,

      subtotalCents: totales.subtotalCents,
      discountCents: 0,
      taxableCents: totales.taxableCents,
      taxCents: totales.taxCents,
      totalCents: totales.totalCents,

      exemptionNote: opciones.exencion,
      createdById: ctx.membershipId,
    },
    select: { id: true },
  });

  await ctx.db.invoiceLine.createMany({
    data: totales.lineas.map((linea, position) => ({
      invoiceId: factura.id,
      position,
      description: linea.description,
      quantity: linea.quantity,
      unitCents: linea.unitCents,
      taxRate: linea.taxRate,
      baseCents: linea.baseCents,
      taxCents: linea.taxCents,
      totalCents: linea.totalCents,
    })),
  });

  return { id: factura.id };
}

/** Lo que hace falta seleccionar de un recibo para poder facturarlo. */
const SELECT_RECIBO = {
  id: true,
  concept: true,
  amountCents: true,
  dueDate: true,
  student: {
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      studentProfile: {
        select: {
          nationalId: true,
          address: true,
          city: true,
          postalCode: true,
          province: true,
        },
      },
    },
  },
} as const;

export async function issueMonthlyInvoicesAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  const ctx = await requirePermission("payments.write");
  const parsed = mensualSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const [anio, mes] = parsed.data.periodo.split("-").map(Number);
  const desde = inicioDeMes(new Date(anio, mes - 1, 1));
  const hasta = new Date(anio, mes, 1);

  const academia = await ctx.db.academy.findUnique({
    where: { id: ctx.academy.id },
    select: {
      name: true,
      legalName: true,
      taxId: true,
      address: true,
      city: true,
      province: true,
      email: true,
    },
  });
  if (!academia?.taxId) {
    return {
      error:
        "Falta el NIF de la academia. Complétalo en Pagos → Remesas antes de facturar.",
    };
  }

  const exencion = MENCIONES_EXENCION.find((m) => m.valor === parsed.data.exemption);
  if (parsed.data.taxRate === 0 && !exencion) {
    return {
      error:
        "Vas a facturar al 0 % de IVA. Elige la mención de exención: una factura exenta tiene que decir por qué lo está.",
    };
  }

  const recibos = await ctx.db.payment.findMany({
    where: {
      deletedAt: null,
      dueDate: { gte: desde, lt: hasta },
      /*
       * Recibos sin ninguna factura viva.
       *
       * Antes se pedían recibos sin ninguna factura en absoluto, y eso dejaba
       * el circuito a medias: si una factura salía con el NIF mal, corregías la
       * ficha y emitías la rectificativa, el recibo se quedaba con la anulada
       * pegada y ya no había forma de emitir la buena. El cliente terminaba con
       * una factura anulada, una en negativo y ninguna correcta.
       *
       * Una factura rectificada está anulada, así que no cuenta: el recibo
       * vuelve a estar pendiente de facturar y este mismo botón emite la
       * correcta, ya con los datos nuevos.
       */
      invoices: { none: { status: { not: "RECTIFIED" } } },
    },
    select: SELECT_RECIBO,
  });

  if (recibos.length === 0) {
    return {
      error: `No hay recibos sin facturar en ${nombreDelMes(desde)}.`,
    };
  }

  const direccionAcademia = [academia.address, academia.city, academia.province]
    .filter(Boolean)
    .join(", ");

  let emitidas = 0;
  const emitidasIds: string[] = [];

  for (const recibo of recibos) {
    const factura = await facturarRecibo(ctx, recibo, {
      seriesId: parsed.data.seriesId,
      taxRate: parsed.data.taxRate,
      exencion: exencion?.texto ?? null,
      academia,
      direccionAcademia,
    });
    if ("error" in factura) return factura;

    emitidasIds.push(factura.id);
    emitidas += 1;
  }

  /*
   * Y se mandan.
   *
   * Va después de facturar y no dentro del bucle a propósito: la numeración es
   * lo delicado, y no puede quedarse a medias porque un servidor de correo
   * tarde o rechace una dirección. Aquí ya está todo emitido y guardado; lo que
   * pase con el correo no lo deshace.
   *
   * En serie y no todas a la vez: cien correos de golpe es exactamente la forma
   * de que un proveedor de SMTP te limite el envío.
   */
  let enviadas = 0;
  const sinCorreo: string[] = [];

  for (const id of emitidasIds) {
    const resultado = await enviarFacturaAlCliente(ctx.academy.id, id);
    if (resultado.enviada) enviadas += 1;
    else if (resultado.motivo) sinCorreo.push(resultado.motivo);
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "invoice.monthly",
    entityType: "Academy",
    entityId: ctx.academy.id,
    changes: { mes: parsed.data.periodo, emitidas, enviadas },
  });

  revalidatePath("/gestion/facturas");

  // Se cuenta lo que ha pasado de verdad. «Facturas emitidas» a secas, cuando
  // tres no han salido, es la clase de mensaje por la que alguien se entera un
  // mes después.
  const resumen =
    sinCorreo.length === 0
      ? `${emitidas} ${emitidas === 1 ? "factura emitida y enviada" : "facturas emitidas y enviadas"}.`
      : `${emitidas} emitidas · ${enviadas} enviadas. Sin enviar: ${sinCorreo.slice(0, 3).join(" ")}${
          sinCorreo.length > 3 ? ` y ${sinCorreo.length - 3} más.` : ""
        }`;

  return { ok: true, mensaje: resumen };
}

const unSoloSchema = z.object({
  paymentId: z.string().min(1),
  seriesId: z.string().min(1, "Elige una serie."),
  taxRate: z.coerce.number().min(0).max(21),
  exemption: z.string().trim().optional(),
});

/**
 * Facturar un recibo suelto, sin esperar al cierre del mes.
 *
 * Es el «cliente a cliente»: alguien pide su factura hoy, o entra un cobro
 * fuera de la mensualidad y hay que facturarlo aparte. Usa exactamente el mismo
 * camino que el botón mensual —misma numeración, mismo cálculo del IVA hacia
 * atrás, mismo correo— para que la factura salga igual se emita por donde se
 * emita.
 */
export async function issueInvoiceForPaymentAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  const ctx = await requirePermission("payments.write");
  const parsed = unSoloSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const exencion = MENCIONES_EXENCION.find((m) => m.valor === parsed.data.exemption);
  if (parsed.data.taxRate === 0 && !exencion) {
    return {
      error:
        "Vas a facturar al 0 % de IVA. Elige la mención de exención: una factura exenta tiene que decir por qué lo está.",
    };
  }

  const academia = await ctx.db.academy.findUnique({
    where: { id: ctx.academy.id },
    select: {
      name: true,
      legalName: true,
      taxId: true,
      address: true,
      city: true,
      province: true,
      email: true,
    },
  });
  if (!academia?.taxId) {
    return {
      error:
        "Falta el NIF de la academia. Complétalo en Pagos → Remesas antes de facturar.",
    };
  }

  const recibo = await ctx.db.payment.findFirst({
    where: {
      id: parsed.data.paymentId,
      deletedAt: null,
      // La misma regla que el mensual: una factura rectificada está anulada y
      // no cuenta, así que el recibo se puede volver a facturar.
      invoices: { none: { status: { not: "RECTIFIED" } } },
    },
    select: SELECT_RECIBO,
  });
  if (!recibo) {
    return { error: "Ese recibo no existe o ya tiene una factura en vigor." };
  }

  const factura = await facturarRecibo(ctx, recibo, {
    seriesId: parsed.data.seriesId,
    taxRate: parsed.data.taxRate,
    exencion: exencion?.texto ?? null,
    academia,
    direccionAcademia: [academia.address, academia.city, academia.province]
      .filter(Boolean)
      .join(", "),
  });
  if ("error" in factura) return factura;

  const envio = await enviarFacturaAlCliente(ctx.academy.id, factura.id);

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "invoice.issue",
    entityType: "Invoice",
    entityId: factura.id,
    changes: { paymentId: parsed.data.paymentId, enviada: envio.enviada },
  });

  revalidatePath("/gestion/pagos");
  revalidatePath("/gestion/facturas");
  revalidatePath(`/gestion/alumnos/${recibo.student.id}`);

  return {
    ok: true,
    id: factura.id,
    mensaje: envio.enviada
      ? `Factura emitida y enviada a ${envio.destino}.`
      : `Factura emitida, pero no se ha enviado: ${envio.motivo ?? "error de correo"}`,
  };
}

/**
 * Vuelve a mandarle la factura al cliente.
 *
 * Existe porque «no me ha llegado» pasa, y porque después de corregir los datos
 * de alguien y emitirle la rectificativa hay que poder mandársela sin buscar el
 * correo original.
 */
export async function resendInvoiceAction(
  _prev: InvoiceState,
  formData: FormData,
): Promise<InvoiceState> {
  const ctx = await requirePermission("payments.write");
  const invoiceId = String(formData.get("invoiceId") ?? "");

  const resultado = await enviarFacturaAlCliente(ctx.academy.id, invoiceId);
  if (!resultado.enviada) {
    return { error: resultado.motivo ?? "No se ha podido enviar." };
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "invoice.send",
    entityType: "Invoice",
    entityId: invoiceId,
    changes: { destino: resultado.destino ?? "" },
  });

  revalidatePath(`/gestion/facturas/${invoiceId}`);
  revalidatePath("/gestion/facturas");
  return { ok: true, mensaje: `Enviada a ${resultado.destino}.` };
}
