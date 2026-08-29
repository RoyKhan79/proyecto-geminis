"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { transaccionDeAcademia } from "@/lib/db/tenant";
import {
  aCentimos,
  calcularFactura,
  MENCIONES_EXENCION,
  referenciaFactura,
  type LineaFactura,
} from "@/lib/billing/invoice";
import { inicioDeMes, nombreDelMes } from "./service";

export type InvoiceState = { error?: string; ok?: boolean; id?: string } | undefined;

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
      customerName: original.customerName,
      customerTaxId: original.customerTaxId,
      customerAddress: original.customerAddress,
      customerEmail: original.customerEmail,

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
      invoices: { none: {} },
    },
    select: {
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
    },
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

  for (const recibo of recibos) {
    // El importe del recibo es lo que paga el alumno, impuestos incluidos. Si
    // hay IVA, hay que sacar la base hacia atrás: facturar el importe como base
    // le cobraría al alumno más de lo pactado.
    const tipo = parsed.data.taxRate;
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

    const numeracion = await reservarNumero(ctx.academy.id, parsed.data.seriesId);
    if (!numeracion) return { error: "Esa serie de facturación no existe." };

    const alumno = recibo.student;
    const factura = await ctx.db.invoice.create({
      data: {
        seriesId: parsed.data.seriesId,
        studentId: alumno.id,
        paymentId: recibo.id,
        number: numeracion.numero,
        reference: referenciaFactura(numeracion.code, numeracion.year, numeracion.numero),
        status: "ISSUED",
        issuedOn: recibo.dueDate ?? new Date(),

        issuerName: academia.legalName ?? academia.name,
        issuerTaxId: academia.taxId,
        issuerAddress: direccionAcademia || null,
        issuerEmail: academia.email,

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

        exemptionNote: exencion?.texto ?? null,
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

    emitidas += 1;
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "invoice.monthly",
    entityType: "Academy",
    entityId: ctx.academy.id,
    changes: { mes: parsed.data.periodo, emitidas },
  });

  revalidatePath("/gestion/facturas");
  return { ok: true };
}
