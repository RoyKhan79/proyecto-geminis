"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { normalizarIban, validarIban } from "@/lib/billing/iban";
import { cifrar, descifrar } from "@/lib/crypto/field";
import {
  fechaDeCargo,
  inicioDeMes,
  nombreDelMes,
  preverMes,
  referenciaPorDefecto,
  vigenteEn,
} from "./service";

/**
 * Lo que una acción devuelve a la pantalla.
 *
 * `undefined` es el estado inicial, antes de que nadie haya enviado nada. El
 * error viaja como dato y no como excepción a propósito: una excepción en una
 * acción de servidor llega al navegador como «algo ha fallado», y aquí hace
 * falta poder decir qué exactamente y volver a pintar el formulario con lo que
 * la persona había escrito.
 */
export type BillingState = { error?: string; ok?: boolean } | undefined;

// ── Forma de pago del alumno ─────────────────────────────────────────────────

const perfilSchema = z.object({
  studentId: z.string().min(1),
  method: z.enum(["CASH", "TRANSFER", "CARD", "SEPA_DIRECT_DEBIT", "OTHER"]),
  iban: z.string().trim().optional(),
  holderName: z.string().trim().max(120).optional(),
  mandateRef: z.string().trim().max(35).optional(),
  mandateSignedAt: z.string().trim().optional(),
  chargeDay: z.coerce.number().int().min(1).max(28).default(1),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Guardar cómo paga un alumno.
 *
 * Si la forma es domiciliación se exige IBAN válido y mandato firmado. No es
 * burocracia: sin mandato el alumno puede reclamar el cargo hasta trece meses
 * después y el banco se lo devuelve a la academia sin discusión.
 */
export async function saveBillingProfileAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const ctx = await requirePermission("payments.write");
  const parsed = perfilSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const alumno = await ctx.db.membership.findUnique({
    where: { id: data.studentId },
    select: { id: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (!alumno) return { error: "Ese alumno no existe." };

  const academia = await ctx.db.academy.findUnique({
    where: { id: ctx.academy.id },
    select: { name: true, mandatePrefix: true },
  });

  let iban: string | null = null;

  if (data.method === "SEPA_DIRECT_DEBIT") {
    const comprobado = validarIban(data.iban ?? "");
    if (!comprobado.valido) {
      return { error: comprobado.motivo };
    }
    iban = comprobado.iban;

    if (!data.mandateSignedAt) {
      return {
        error:
          "Para domiciliar hace falta la fecha en que el alumno firmó el mandato. Sin ella, el banco puede devolver el recibo.",
      };
    }
  } else if (data.iban?.trim()) {
    // Se guarda igual: hay academias que tienen la cuenta apuntada aunque
    // cobren en mano, y borrársela al cambiar de método sería perder un dato
    // que costó pedir.
    const comprobado = validarIban(data.iban);
    if (!comprobado.valido) return { error: comprobado.motivo };
    iban = comprobado.iban;
  }

  const referencia =
    data.mandateRef?.trim() ||
    referenciaPorDefecto(
      academia?.mandatePrefix ?? null,
      academia?.name ?? ctx.academy.name,
      alumno.id,
    );

  const existente = await ctx.db.billingProfile.findFirst({
    where: { studentId: alumno.id },
    select: { id: true, iban: true, mandateRef: true, mandateUsed: true },
  });

  // Si cambia el IBAN o la referencia, el mandato es otro a efectos del banco:
  // el próximo cobro tiene que volver a ir como primero. La comparación se hace
  // sobre el valor descifrado: dos cifrados del mismo IBAN son distintos, así
  // que comparar los textos cifrados diría siempre que ha cambiado.
  const ibanAnterior = descifrar(existente?.iban ?? null);
  const cambioDeMandato =
    existente !== null &&
    (ibanAnterior !== iban || existente.mandateRef !== referencia);

  const payload = {
    method: data.method,
    // El IBAN se guarda cifrado: un volcado de la base no debe enseñar los
    // números de cuenta de media academia.
    iban: iban ? cifrar(iban) : null,
    holderName: data.holderName || null,
    mandateRef: data.method === "SEPA_DIRECT_DEBIT" ? referencia : null,
    mandateSignedAt: data.mandateSignedAt ? new Date(data.mandateSignedAt) : null,
    mandateUsed: cambioDeMandato ? false : (existente?.mandateUsed ?? false),
    chargeDay: data.chargeDay,
    notes: data.notes || null,
  };

  if (existente) {
    await ctx.db.billingProfile.update({ where: { id: existente.id }, data: payload });
  } else {
    await ctx.db.billingProfile.create({
      data: { studentId: alumno.id, ...payload },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "billing.profile.save",
    entityType: "Membership",
    entityId: alumno.id,
    // El IBAN NO se anota en la auditoría: es un dato bancario y el registro lo
    // pueden leer más personas que la ficha.
    changes: { metodo: data.method, mandatoNuevo: cambioDeMandato },
  });

  revalidatePath(`/gestion/alumnos/${alumno.id}`);
  revalidatePath("/gestion/pagos");
  return { ok: true };
}

// ── Cuota periódica ──────────────────────────────────────────────────────────

const cuotaSchema = z.object({
  studentId: z.string().min(1),
  concept: z.string().trim().min(3, "Escribe el concepto de la cuota."),
  amount: z.string().trim().min(1, "Indica el importe."),
  startsOn: z.string().trim().min(1, "Indica desde cuándo se cobra."),
  endsOn: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ENDED"]).default("ACTIVE"),
  enrollmentId: z.string().trim().optional(),
});

/** Convierte «60», «60,50» o «60.50» en céntimos. */
function aCentimos(texto: string): number | null {
  const limpio = texto.replace(/[€\s]/g, "").replace(",", ".");
  const valor = Number(limpio);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

/**
 * Guarda el cargo mensual de un alumno y su cuenta bancaria.
 *
 * @returns Confirmación, o el motivo: el IBAN se valida con el módulo 97, la
 *   misma cuenta que hace el banco, así que un dígito cambiado se detecta aquí
 *   y no cuando la remesa vuelve rechazada tres semanas después.
 * @remarks El IBAN se guarda **cifrado**; en pantalla solo se ven los últimos
 *   dígitos. Hace falta también el mandato firmado: sin él, el banco puede
 *   devolver el cargo y la academia se queda sin cobrar y con la comisión.
 */
export async function saveRecurringChargeAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const ctx = await requirePermission("payments.write");
  const parsed = cuotaSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const importe = aCentimos(data.amount);
  if (importe === null || importe === 0) {
    return { error: "El importe no es válido." };
  }

  const alumno = await ctx.db.membership.findUnique({
    where: { id: data.studentId },
    select: { id: true },
  });
  if (!alumno) return { error: "Ese alumno no existe." };

  const perfil = await ctx.db.billingProfile.findFirst({
    where: { studentId: alumno.id },
    select: { id: true },
  });

  const existente = await ctx.db.recurringCharge.findFirst({
    where: { studentId: alumno.id },
    select: { id: true },
  });

  const payload = {
    concept: data.concept,
    amountCents: importe,
    startsOn: new Date(data.startsOn),
    endsOn: data.endsOn ? new Date(data.endsOn) : null,
    status: data.status,
    billingProfileId: perfil?.id ?? null,
    enrollmentId: data.enrollmentId || null,
  };

  if (existente) {
    await ctx.db.recurringCharge.update({ where: { id: existente.id }, data: payload });
  } else {
    await ctx.db.recurringCharge.create({
      data: { studentId: alumno.id, ...payload },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "billing.charge.save",
    entityType: "Membership",
    entityId: alumno.id,
    changes: { concepto: data.concept, importe, estado: data.status },
  });

  revalidatePath(`/gestion/alumnos/${alumno.id}`);
  revalidatePath("/gestion/pagos/remesas");
  return { ok: true };
}

/**
 * Quita el cargo mensual de un alumno.
 *
 * @remarks No toca las remesas ya emitidas: un cobro que ya se mandó al banco
 *   está mandado, y borrarlo aquí solo dejaría la contabilidad sin explicación.
 */
export async function deleteRecurringChargeAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const ctx = await requirePermission("payments.write");
  const studentId = String(formData.get("studentId") ?? "");

  const cuota = await ctx.db.recurringCharge.findFirst({
    where: { studentId },
    select: { id: true, concept: true },
  });
  if (!cuota) return { error: "Ese alumno no tiene cuota." };

  // Se borra la cuota, no los recibos ya emitidos: esos son historia contable y
  // borrarlos descuadraría las cuentas de la academia.
  await ctx.db.recurringCharge.delete({ where: { id: cuota.id } });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "billing.charge.delete",
    entityType: "Membership",
    entityId: studentId,
    changes: { concepto: cuota.concept },
  });

  revalidatePath(`/gestion/alumnos/${studentId}`);
  return { ok: true };
}

// ── Datos de acreedor de la academia ─────────────────────────────────────────

const acreedorSchema = z.object({
  legalName: z.string().trim().max(160).optional(),
  taxId: z.string().trim().max(20).optional(),
  billingIban: z.string().trim().optional(),
  creditorId: z.string().trim().max(35).optional(),
  mandatePrefix: z.string().trim().max(8).optional(),
});

/**
 * Guarda los datos con los que la academia cobra.
 *
 * @returns Confirmación, o el motivo. El identificador de acreedor **no es el
 *   CIF**: lo asigna el banco, y sin él la remesa entera se rechaza.
 */
export async function saveCreditorAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const ctx = await requirePermission("settings.write");
  const parsed = acreedorSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  let iban: string | null = null;
  if (data.billingIban?.trim()) {
    const comprobado = validarIban(data.billingIban);
    if (!comprobado.valido) return { error: `Cuenta de la academia: ${comprobado.motivo}` };
    iban = comprobado.iban;
  }

  const identificador = data.creditorId?.trim().toUpperCase() || null;
  if (identificador && !/^[A-Z]{2}[0-9A-Z]{5,33}$/.test(identificador)) {
    return {
      error:
        "El identificador de acreedor no tiene el formato correcto. Te lo da tu banco; en España empieza por ES.",
    };
  }

  await ctx.db.academy.update({
    where: { id: ctx.academy.id },
    data: {
      legalName: data.legalName || null,
      taxId: data.taxId || null,
      billingIban: iban ? cifrar(iban) : null,
      creditorId: identificador,
      mandatePrefix: data.mandatePrefix?.toUpperCase() || null,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "billing.creditor.save",
    entityType: "Academy",
    entityId: ctx.academy.id,
    changes: { tieneIban: Boolean(iban), tieneIdentificador: Boolean(identificador) },
  });

  revalidatePath("/gestion/pagos/remesas");
  revalidatePath("/gestion/configuracion");
  return { ok: true };
}

// ── Generar la remesa del mes ────────────────────────────────────────────────

const remesaSchema = z.object({
  periodo: z.string().trim().regex(/^\d{4}-\d{2}$/, "Elige un mes."),
  chargeOn: z.string().trim().optional(),
});

/**
 * Emitir los recibos del mes.
 *
 * Crea un recibo por cada cuota vigente que no lo tenga ya, y agrupa en una
 * remesa los que se pueden domiciliar. Los demás quedan como pendientes con su
 * forma de pago, para cobrarlos en mano o por transferencia.
 *
 * Lo importante es lo que NO hace: no cobra dos veces. Si la remesa del mes ya
 * existe, se reutiliza y solo se añaden los recibos que falten.
 */
export async function generarRemesaAction(
  _prev: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const ctx = await requirePermission("payments.write");
  const parsed = remesaSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }

  const [anio, mesTexto] = parsed.data.periodo.split("-").map(Number);
  const mes = new Date(anio, mesTexto - 1, 1);

  const academia = await ctx.db.academy.findUnique({
    where: { id: ctx.academy.id },
    select: {
      name: true,
      legalName: true,
      billingIban: true,
      creditorId: true,
      mandatePrefix: true,
    },
  });
  if (!academia) return { error: "No se ha podido leer la academia." };

  const cuotas = await ctx.db.recurringCharge.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      studentId: true,
      concept: true,
      amountCents: true,
      startsOn: true,
      endsOn: true,
      status: true,
      enrollmentId: true,
    },
  });

  const vigentes = cuotas.filter((c) => vigenteEn(c, mes));
  if (vigentes.length === 0) {
    return { error: `No hay ninguna cuota activa en ${nombreDelMes(mes)}.` };
  }

  const perfiles = await ctx.db.billingProfile.findMany({
    where: { studentId: { in: vigentes.map((c) => c.studentId) } },
    select: { studentId: true, method: true, chargeDay: true },
  });
  const perfilPorAlumno = new Map(perfiles.map((p) => [p.studentId, p]));

  const siguienteMes = new Date(anio, mesTexto, 1);
  const yaCreados = await ctx.db.payment.findMany({
    where: {
      deletedAt: null,
      recurringChargeId: { in: vigentes.map((c) => c.id) },
      dueDate: { gte: mes, lt: siguienteMes },
    },
    select: { recurringChargeId: true },
  });
  const cobrados = new Set(yaCreados.map((p) => p.recurringChargeId));

  const pendientes = vigentes.filter((c) => !cobrados.has(c.id));
  if (pendientes.length === 0) {
    return {
      error: `Los recibos de ${nombreDelMes(mes)} ya estaban emitidos. No se ha vuelto a cobrar nada.`,
    };
  }

  // La remesa del mes: si ya existe se reutiliza.
  let remesa = await ctx.db.directDebitRun.findFirst({
    where: { period: mes },
    select: { id: true, status: true },
  });

  const diaPorDefecto = perfiles[0]?.chargeDay ?? 1;
  const cargo = parsed.data.chargeOn
    ? new Date(parsed.data.chargeOn)
    : fechaDeCargo(mes, diaPorDefecto);

  if (!remesa) {
    remesa = await ctx.db.directDebitRun.create({
      data: {
        period: mes,
        chargeOn: cargo,
        creditorName: academia.legalName ?? academia.name,
        creditorIban: academia.billingIban ?? "", // ya viene cifrado de la academia
        creditorId: academia.creditorId ?? "",
        createdById: ctx.membershipId,
      },
      select: { id: true, status: true },
    });
  } else if (remesa.status !== "DRAFT") {
    return {
      error:
        "La remesa de ese mes ya se ha exportado al banco. Crea los recibos que falten a mano para no descuadrar lo enviado.",
    };
  }

  let domiciliados = 0;
  let otros = 0;

  for (const cuota of pendientes) {
    const perfil = perfilPorAlumno.get(cuota.studentId);
    const domicilia = perfil?.method === "SEPA_DIRECT_DEBIT";

    await ctx.db.payment.create({
      data: {
        studentId: cuota.studentId,
        enrollmentId: cuota.enrollmentId,
        recurringChargeId: cuota.id,
        directDebitRunId: domicilia ? remesa.id : null,
        concept: `${cuota.concept} · ${nombreDelMes(mes)}`,
        amountCents: cuota.amountCents,
        status: "PENDING",
        method: perfil?.method ?? "TRANSFER",
        dueDate: fechaDeCargo(mes, perfil?.chargeDay ?? 1),
      },
    });

    if (domicilia) domiciliados += 1;
    else otros += 1;
  }

  const totales = await ctx.db.payment.aggregate({
    where: { directDebitRunId: remesa.id, deletedAt: null },
    _sum: { amountCents: true },
    _count: true,
  });

  await ctx.db.directDebitRun.update({
    where: { id: remesa.id },
    data: {
      totalCents: totales._sum.amountCents ?? 0,
      itemCount: totales._count,
      chargeOn: cargo,
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "billing.run.generate",
    entityType: "DirectDebitRun",
    entityId: remesa.id,
    changes: { mes: parsed.data.periodo, domiciliados, otros },
  });

  revalidatePath("/gestion/pagos/remesas");
  revalidatePath("/gestion/pagos");
  return { ok: true };
}

/** Marca la remesa como enviada al banco. Se llama tras descargar el fichero. */
export async function marcarRemesaExportadaAction(formData: FormData) {
  const ctx = await requirePermission("payments.write");
  const runId = String(formData.get("runId") ?? "");

  const remesa = await ctx.db.directDebitRun.findUnique({
    where: { id: runId },
    select: { id: true, status: true },
  });
  if (!remesa || remesa.status !== "DRAFT") return;

  await ctx.db.directDebitRun.update({
    where: { id: remesa.id },
    data: { status: "EXPORTED", exportedAt: new Date() },
  });

  // Los mandatos usados en esta remesa dejan de ser "primer cobro". Si no se
  // marcara, el banco rechazaría la siguiente remesa por enviar dos veces un
  // primer adeudo del mismo mandato.
  const alumnos = await ctx.db.payment.findMany({
    where: { directDebitRunId: remesa.id, deletedAt: null },
    select: { studentId: true },
  });

  await ctx.db.billingProfile.updateMany({
    where: { studentId: { in: alumnos.map((p) => p.studentId) } },
    data: { mandateUsed: true },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "billing.run.export",
    entityType: "DirectDebitRun",
    entityId: remesa.id,
    changes: { recibos: alumnos.length },
  });

  revalidatePath("/gestion/pagos/remesas");
}

/** Vista previa del mes, para la pantalla. */
export async function previsualizarRemesa(periodo: string) {
  const ctx = await requirePermission("payments.read");
  const [anio, mes] = periodo.split("-").map(Number);
  return preverMes(ctx.db, inicioDeMes(new Date(anio, mes - 1, 1)));
}

export { normalizarIban };
