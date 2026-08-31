"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";

/**
 * GESTIÓN ECONÓMICA
 *
 * Lo justo para llevar el control de cobros de una academia: recibos, estados y
 * quién debe qué. NO es una contabilidad completa ni pretende serlo (§31), y la
 * pasarela de pago llegará después: el modelo ya guarda referencia externa y
 * método para no tener que migrar nada.
 *
 * Regla que conecta con el resto del producto: marcar un recibo como impagado
 * puede suspender el acceso del alumno, porque el acceso lo da un derecho, no
 * una casilla de "pagado" (ADR-0008).
 */

export type PaymentState = { error?: string; ok?: string } | undefined;

const cobroSchema = z.object({
  studentId: z.string().min(1, "Elige un alumno."),
  concept: z.string().trim().min(3, "Escribe el concepto."),
  amountEuros: z.coerce.number().min(0, "El importe no puede ser negativo."),
  method: z.enum(["CASH", "TRANSFER", "CARD", "SEPA_DIRECT_DEBIT", "OTHER"]),
  dueDate: z.string().optional(),
  status: z.enum(["PENDING", "PAID"]),
  enrollmentId: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
});

/**
 * Registra un cobro: en efectivo, con tarjeta o por transferencia.
 *
 * @returns Confirmación, o el motivo.
 */
export async function createPaymentAction(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const ctx = await requirePermission("payments.write");
  const parsed = cobroSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const data = parsed.data;

  const alumno = await ctx.db.membership.findUnique({
    where: { id: data.studentId },
    select: { id: true },
  });
  if (!alumno) return { error: "Ese alumno no existe." };

  // Los importes se guardan en céntimos: con decimales flotantes, sumar cien
  // recibos acaba dando céntimos de diferencia.
  const amountCents = Math.round(data.amountEuros * 100);

  const pago = await ctx.db.payment.create({
    data: {
      studentId: alumno.id,
      enrollmentId: data.enrollmentId || null,
      concept: data.concept,
      amountCents,
      method: data.method,
      status: data.status,
      dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
      paidAt: data.status === "PAID" ? new Date() : null,
      notes: data.notes || null,
      receiptNo: await siguienteNumeroDeRecibo(ctx.db),
    },
  });

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "payment.create",
    entityType: "Payment",
    entityId: pago.id,
    changes: { concepto: data.concept, importe: amountCents, estado: data.status },
  });

  revalidatePath("/gestion/pagos");
  revalidatePath(`/gestion/alumnos/${data.studentId}`);
  return { ok: "Recibo registrado." };
}

const estadoSchema = z.object({
  paymentId: z.string().min(1),
  status: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"]),
  suspenderAcceso: z.string().optional(),
});

/**
 * Cambia el estado de un recibo.
 *
 * @remarks Marcarlo como **devuelto suspende el acceso del alumno**. Es lo que
 *   hace que la lista de pagos sirva para algo y no sea solo un registro, y por
 *   eso conviene saberlo antes de pulsar.
 */
export async function setPaymentStatusAction(formData: FormData) {
  const ctx = await requirePermission("payments.write");
  const parsed = estadoSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error("Datos no válidos.");

  const { paymentId, status } = parsed.data;
  const suspender = parsed.data.suspenderAcceso === "1";

  const pago = await ctx.db.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, studentId: true, concept: true, enrollmentId: true },
  });
  if (!pago) throw new Error("Ese recibo no existe.");

  await ctx.db.payment.update({
    where: { id: paymentId },
    data: {
      status,
      paidAt: status === "PAID" ? new Date() : null,
    },
  });

  /*
   * Al cobrar se recupera el acceso, pero solo si no queda nada más pendiente.
   *
   * Sin esta comprobación, alguien que debe tres recibos paga uno y recupera
   * todo: y como la tarea de avisos no vuelve a suspender un recibo que ya
   * suspendió una vez, se quedaría dentro debiendo dos meses. Se recupera el
   * acceso cuando se está al día, que es lo que significa estar al día.
   */
  if (status === "PAID") {
    const pendientes = await ctx.db.payment.count({
      where: {
        studentId: pago.studentId,
        deletedAt: null,
        id: { not: paymentId },
        status: { in: ["PENDING", "FAILED"] },
        dueDate: { lt: new Date() },
      },
    });

    if (pendientes === 0) {
      await ctx.db.entitlement.updateMany({
        where: { studentId: pago.studentId, status: "PAST_DUE" },
        data: { status: "ACTIVE" },
      });
      await ctx.db.enrollment.updateMany({
        where: { studentId: pago.studentId, status: "PAST_DUE" },
        data: { status: "ACTIVE" },
      });
    }
  }

  // Suspender es una decisión de la academia, nunca automática: hay impagos que
  // son un error del banco y cortar el acceso sin avisar es la mejor forma de
  // perder a un alumno.
  if (suspender && (status === "FAILED" || status === "PENDING")) {
    await ctx.db.entitlement.updateMany({
      where: { studentId: pago.studentId, status: "ACTIVE" },
      data: { status: "PAST_DUE" },
    });
    await ctx.db.enrollment.updateMany({
      where: { studentId: pago.studentId, status: "ACTIVE" },
      data: { status: "PAST_DUE" },
    });
    await ctx.db.notification.create({
      data: {
        recipientId: pago.studentId,
        type: "payment.due",
        title: "Recibo pendiente",
        body: `Tienes pendiente el recibo «${pago.concept}». Ponte en contacto con la academia para recuperar el acceso.`,
        status: "SENT",
        sentAt: new Date(),
      },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    action: "payment.status",
    entityType: "Payment",
    entityId: paymentId,
    changes: { estado: status, suspendido: suspender },
  });

  revalidatePath("/gestion/pagos");
  revalidatePath(`/gestion/alumnos/${pago.studentId}`);
}

/** Numeración correlativa simple por academia. */
async function siguienteNumeroDeRecibo(
  db: Awaited<ReturnType<typeof requirePermission>>["db"],
) {
  const año = new Date().getFullYear();
  const emitidos = await db.payment.count({
    where: { createdAt: { gte: new Date(`${año}-01-01T00:00:00.000Z`) } },
  });
  return `${año}-${String(emitidos + 1).padStart(5, "0")}`;
}
