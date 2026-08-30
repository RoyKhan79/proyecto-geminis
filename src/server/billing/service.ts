import type { TenantClient } from "@/lib/db/tenant";
import { generarReferenciaMandato } from "@/lib/billing/iban";
import { descifrar } from "@/lib/crypto/field";

/**
 * COBROS RECURRENTES · la lógica
 *
 * El trabajo administrativo que esto quita es concreto: a primeros de mes,
 * alguien de secretaría se sienta a crear ochenta recibos iguales que los del
 * mes pasado y a preparar el fichero para el banco. Aquí eso es un botón.
 *
 * Las reglas que sigue, y por qué:
 *
 *   · **Nunca se duplica un recibo.** Si la remesa de marzo ya se generó y
 *     alguien vuelve a pulsar, no se cobra dos veces. Un cargo duplicado en la
 *     cuenta de un alumno cuesta una llamada, una devolución y confianza.
 *   · **Solo entran las cuotas vigentes ese mes.** Una cuota de septiembre a
 *     junio no genera nada en julio.
 *   · **Quien no tiene mandato firmado no entra en la remesa**, pero su recibo
 *     sí se crea, marcado con su forma de pago. La academia lo cobrará en mano
 *     o por transferencia, y le sigue constando como pendiente.
 */

/** Primer día del mes, a las 00:00. Es la clave con la que se agrupa todo. */
export function inicioDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * El nombre del mes en español, para el concepto del recibo.
 *
 * @returns «septiembre de 2026». Lo lee una persona en su extracto bancario, y
 *   por eso va escrito y no como `2026-09`.
 */
export function nombreDelMes(fecha: Date): string {
  return fecha.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

/**
 * ¿Está vigente esta cuota en este mes?
 *
 * Se compara por meses completos y no por días: una cuota que empieza el 20 de
 * septiembre se cobra en septiembre, no en octubre.
 */
export function vigenteEn(
  cuota: { startsOn: Date; endsOn: Date | null; status: string },
  mes: Date,
): boolean {
  if (cuota.status !== "ACTIVE") return false;

  const inicio = inicioDeMes(cuota.startsOn);
  if (inicio.getTime() > mes.getTime()) return false;

  if (cuota.endsOn) {
    const fin = inicioDeMes(cuota.endsOn);
    if (fin.getTime() < mes.getTime()) return false;
  }

  return true;
}

/**
 * Día del mes en que toca el cargo.
 *
 * El día se limita a 28 al guardarlo, así que siempre existe. Aun así se
 * comprueba, porque un dato guardado antes de esa regla no debe romper la
 * generación de toda una remesa.
 */
export function fechaDeCargo(mes: Date, dia: number): Date {
  const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  return new Date(mes.getFullYear(), mes.getMonth(), Math.min(dia, ultimoDia));
}

/**
 * Un cargo que entraría en la remesa del mes.
 *
 * Se calcula antes de emitir nada para poder enseñar el detalle: cuántos
 * alumnos, cuánto suma y **quién se queda fuera y por qué**. Emitir una remesa
 * a ciegas es cómo se descubre en el banco que faltaban diez recibos.
 */
export type LineaPrevista = {
  studentId: string;
  nombre: string;
  concepto: string;
  amountCents: number;
  metodo: string;
  iban: string | null;
  mandatoRef: string | null;
  mandatoFecha: Date | null;
  primerCobro: boolean;
  /// Motivo por el que no puede ir en el fichero del banco, si lo hay.
  impedimento: string | null;
  yaCobrado: boolean;
};

/**
 * Qué se cobraría este mes, sin escribir nada.
 *
 * Es la previsualización: la academia tiene que poder ver la lista completa
 * antes de generar ochenta recibos.
 */
export async function preverMes(
  db: TenantClient,
  mes: Date,
): Promise<LineaPrevista[]> {
  const cuotas = await db.recurringCharge.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      studentId: true,
      concept: true,
      amountCents: true,
      startsOn: true,
      endsOn: true,
      status: true,
      student: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const vigentes = cuotas.filter((c) => vigenteEn(c, mes));
  if (vigentes.length === 0) return [];

  const perfiles = await db.billingProfile.findMany({
    where: { studentId: { in: vigentes.map((c) => c.studentId) } },
    select: {
      studentId: true,
      method: true,
      iban: true,
      holderName: true,
      mandateRef: true,
      mandateSignedAt: true,
      mandateUsed: true,
    },
  });
  const perfilPorAlumno = new Map(perfiles.map((p) => [p.studentId, p]));

  // Recibos que ya existen de estas cuotas para este mes. Es lo que impide
  // cobrar dos veces si alguien vuelve a pulsar el botón.
  const siguienteMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);
  const yaCreados = await db.payment.findMany({
    where: {
      deletedAt: null,
      recurringChargeId: { in: vigentes.map((c) => c.id) },
      dueDate: { gte: mes, lt: siguienteMes },
    },
    select: { recurringChargeId: true },
  });
  const cobrados = new Set(yaCreados.map((p) => p.recurringChargeId));

  return vigentes.map((cuota) => {
    const perfil = perfilPorAlumno.get(cuota.studentId);
    const nombre = [
      cuota.student.user.firstName,
      cuota.student.user.lastName ?? "",
    ]
      .join(" ")
      .trim();

    // El IBAN se guarda cifrado; aquí se descifra solo para comprobarlo y
    // enseñarlo parcialmente oculto.
    const ibanClaro = descifrar(perfil?.iban ?? null);

    let impedimento: string | null = null;
    if (!perfil || perfil.method !== "SEPA_DIRECT_DEBIT") {
      impedimento = "No paga por domiciliación.";
    } else if (!perfil.iban) {
      impedimento = "No tiene número de cuenta.";
    } else if (!ibanClaro) {
      // El dato está, pero no se puede leer: casi siempre es que la clave de
      // cifrado ha cambiado. Decirlo es mejor que mandar una remesa a medias.
      impedimento = "El número de cuenta no se puede descifrar. Vuelve a introducirlo.";
    } else if (!perfil.mandateRef || !perfil.mandateSignedAt) {
      impedimento = "No tiene el mandato firmado.";
    }

    return {
      studentId: cuota.studentId,
      nombre,
      concepto: cuota.concept,
      amountCents: cuota.amountCents,
      metodo: perfil?.method ?? "TRANSFER",
      iban: ibanClaro,
      mandatoRef: perfil?.mandateRef ?? null,
      mandatoFecha: perfil?.mandateSignedAt ?? null,
      primerCobro: perfil ? !perfil.mandateUsed : false,
      impedimento,
      yaCobrado: cobrados.has(cuota.id),
    };
  });
}

/** Referencia de mandato para un alumno, si la academia no la ha puesto. */
export function referenciaPorDefecto(
  prefijoAcademia: string | null,
  academiaNombre: string,
  studentId: string,
): string {
  return generarReferenciaMandato(prefijoAcademia ?? academiaNombre, studentId);
}
