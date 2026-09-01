"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/context";
import { leerNorma43 } from "@/lib/billing/norma43";
import {
  proponerConciliacion,
  type Propuesta,
  type ReciboPendiente,
} from "@/lib/billing/conciliacion";

/**
 * CONCILIAR EL EXTRACTO DEL BANCO
 *
 * Se sube el fichero de Norma 43 que da la banca electrónica y se propone qué
 * ingreso es de qué recibo. Nada se marca solo: esta acción solo lee y propone.
 * Cobrar es la segunda, y la dispara una persona que ha mirado la lista.
 *
 * Se hace en dos pasos a propósito. Marcar un recibo como cobrado al alumno
 * equivocado no lo detecta nadie: el que pagó sigue apareciendo como moroso
 * hasta que se le corta el acceso, y el que no pagó desaparece de la lista de
 * reclamaciones.
 */

/** Lo que devuelve el primer paso: una propuesta por ingreso, o el motivo. */
export type ConciliacionState =
  | {
      error?: string;
      propuestas?: {
        fecha: string;
        importeCents: number;
        concepto: string;
        reciboId: string | null;
        reciboEtiqueta: string | null;
        motivo: string;
        seguro: boolean;
      }[];
      avisos?: string[];
    }
  | undefined;

/**
 * La fecha en AAAA-MM-DD, con el calendario de aquí.
 *
 * `toISOString()` pasa por UTC, y en España eso resta un día a todo lo que
 * ocurre antes de las dos de la madrugada: un ingreso del 1 de septiembre se
 * enseñaba como del 31 de agosto, que es justo el dato con el que alguien
 * compara contra su extracto.
 */
function comoFecha(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Tamaño máximo del extracto. Un año entero de una academia no llega a esto. */
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Lee un extracto y propone las conciliaciones, sin tocar ningún recibo.
 *
 * @param _prev Estado anterior del formulario, que aquí no se usa.
 * @param formData El fichero de Norma 43 en el campo `extracto`.
 * @returns Una propuesta por ingreso, con lo que se ha entendido y por qué; o
 *   el motivo si el fichero no se puede leer.
 */
export async function analizarExtractoAction(
  _prev: ConciliacionState,
  formData: FormData,
): Promise<ConciliacionState> {
  const ctx = await requirePermission("payments.write");

  const fichero = formData.get("extracto");
  if (!(fichero instanceof File) || fichero.size === 0) {
    return { error: "Elige el fichero del extracto." };
  }
  if (fichero.size > MAX_BYTES) {
    return { error: "Ese fichero es demasiado grande para ser un extracto." };
  }

  /*
   * Latin-1 y no UTF-8: el cuaderno 43 es de 1988 y los bancos lo siguen
   * emitiendo en ISO-8859-1. Leerlo como UTF-8 convierte cada eñe y cada acento
   * en un carácter de sustitución, y los nombres dejan de casar.
   */
  const bytes = Buffer.from(await fichero.arrayBuffer());
  const contenido = new TextDecoder("iso-8859-1").decode(bytes);

  const { movimientos, errores } = leerNorma43(contenido);
  if (movimientos.length === 0) {
    return {
      error:
        errores[0] ??
        "No he encontrado ningún movimiento. ¿Seguro que es un fichero de Norma 43?",
    };
  }

  const pendientes = await ctx.db.payment.findMany({
    where: {
      deletedAt: null,
      status: { in: ["PENDING", "FAILED"] },
      // Los domiciliados los cobra el banco solo; conciliar aquí los duplicaría.
      method: { in: ["TRANSFER", "CASH", "OTHER"] },
    },
    select: {
      id: true,
      concept: true,
      amountCents: true,
      student: { select: { user: { select: { firstName: true, lastName: true } } } },
      invoices: {
        where: { status: { not: "RECTIFIED" } },
        select: { reference: true },
        take: 1,
      },
    },
  });

  const recibos: ReciboPendiente[] = pendientes.map((p) => ({
    id: p.id,
    concepto: p.concept,
    importeCents: p.amountCents,
    alumno: `${p.student.user.firstName} ${p.student.user.lastName ?? ""}`.trim(),
    referencia: p.invoices[0]?.reference ?? null,
  }));

  const propuestas = proponerConciliacion(movimientos, recibos);

  return {
    avisos: errores,
    propuestas: propuestas.map((p: Propuesta) => ({
      fecha: comoFecha(p.movimiento.fecha),
      importeCents: p.movimiento.importeCents,
      concepto: p.movimiento.concepto,
      reciboId: p.recibo?.id ?? null,
      reciboEtiqueta: p.recibo
        ? `${p.recibo.alumno} · ${p.recibo.concepto}`
        : null,
      motivo: p.motivo,
      seguro: p.seguro,
    })),
  };
}

/** Lo que devuelve el segundo paso: si se marcaron y cuántos, o el motivo. */
export type ConfirmacionState =
  | { error?: string; ok?: boolean; mensaje?: string }
  | undefined;

const confirmarSchema = z.object({
  reciboIds: z.array(z.string().min(1)).min(1, "No has marcado ningún ingreso."),
});

/**
 * Da por cobrados los recibos que la persona ha confirmado.
 *
 * @param _prev Estado anterior del formulario, que aquí no se usa.
 * @param formData Los identificadores de recibo marcados, en `reciboIds`.
 * @returns Cuántos se han marcado, o el motivo si no se ha marcado ninguno.
 * @remarks Devuelve el acceso a quien se le hubiera cortado, con la misma regla
 *   que el resto: solo si no le queda nada más vencido. Pagar uno de tres
 *   recibos no es estar al día.
 */
export async function confirmarConciliacionAction(
  _prev: ConciliacionState,
  formData: FormData,
): Promise<ConfirmacionState> {
  const ctx = await requirePermission("payments.write");

  const parsed = confirmarSchema.safeParse({
    reciboIds: formData.getAll("reciboIds").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa la selección." };
  }

  // Solo recibos de ESTA academia y que sigan pendientes: `ctx.db` ya acota por
  // inquilino, y el estado evita cobrar dos veces si alguien recarga.
  const recibos = await ctx.db.payment.findMany({
    where: {
      id: { in: parsed.data.reciboIds },
      deletedAt: null,
      status: { in: ["PENDING", "FAILED"] },
    },
    select: { id: true, studentId: true },
  });
  if (recibos.length === 0) {
    return { error: "Esos recibos ya no están pendientes." };
  }

  const ahora = new Date();
  await ctx.db.payment.updateMany({
    where: { id: { in: recibos.map((r) => r.id) } },
    data: { status: "PAID", paidAt: ahora },
  });

  for (const studentId of new Set(recibos.map((r) => r.studentId))) {
    const pendientes = await ctx.db.payment.count({
      where: {
        studentId,
        deletedAt: null,
        status: { in: ["PENDING", "FAILED"] },
        dueDate: { lt: ahora },
      },
    });
    if (pendientes > 0) continue;

    await ctx.db.entitlement.updateMany({
      where: { studentId, status: "PAST_DUE" },
      data: { status: "ACTIVE" },
    });
    await ctx.db.enrollment.updateMany({
      where: { studentId, status: "PAST_DUE" },
      data: { status: "ACTIVE" },
    });
  }

  await recordAudit({
    academyId: ctx.academy.id,
    actorId: ctx.user.id,
    impersonatorId: ctx.impersonatedById,
    action: "billing.reconcile",
    entityType: "Academy",
    entityId: ctx.academy.id,
    changes: { recibos: recibos.length },
  });

  revalidatePath("/gestion/pagos");
  revalidatePath("/gestion/pagos/morosidad");

  return {
    ok: true,
    mensaje: `${recibos.length} ${recibos.length === 1 ? "recibo marcado" : "recibos marcados"} como cobrados.`,
  };
}
