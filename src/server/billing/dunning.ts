import { prismaBase } from "@/lib/db/client";
import { tenantDb, type TenantClient } from "@/lib/db/tenant";
import { sendEmail } from "@/lib/email";
import { descifrar } from "@/lib/crypto/field";
import { formatDate } from "@/lib/utils";
import { enlaceDePago, instruccionesDePago } from "./invoice-email";

/**
 * AVISOS DE IMPAGO
 *
 * Reclamar un recibo es un trabajo que nadie hace todos los días: se acuerda
 * uno a los dos meses, cuando ya son tres recibos y la conversación es mucho
 * peor. Esto lo hace la tarea diaria.
 *
 * Dos reglas que no son técnicas y explican casi todo el archivo:
 *
 *   · Se avisa varias veces ANTES de cortar. Cortarle el acceso a alguien que
 *     no sabía que debía algo —una tarjeta caducada, un cambio de cuenta— es
 *     perder a un alumno por un error administrativo.
 *   · Cortar no es castigar: se le dice en el mismo correo qué tiene que hacer
 *     para recuperarlo, y se recupera solo en cuanto paga.
 *
 * Cada academia pone sus plazos, porque una que cobra treinta euros al mes y
 * otra que cobra trescientos no esperan lo mismo antes de insistir.
 */

const euros = (centimos: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    centimos / 100,
  );

const DIA = 24 * 60 * 60 * 1000;

/**
 * Días naturales entre dos fechas, sin que la hora del día cuente.
 *
 * Cuenta en el calendario LOCAL y no en UTC, a propósito: los vencimientos se
 * guardan con `new Date(año, mes, día)` en toda la aplicación, y «lleva tres
 * días de retraso» es una frase que dice una persona mirando su calendario, no
 * el meridiano de Greenwich.
 *
 * @param fecha Punto de partida.
 * @param hasta Punto de llegada.
 * @returns Días naturales completos entre las dos, negativos si van al revés.
 */
export function diasDesde(fecha: Date, hasta: Date): number {
  const a = Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.floor((b - a) / DIA);
}

/**
 * Decide qué toca hacer hoy con un recibo vencido.
 *
 * Separada del envío para poder probar el calendario entero sin base de datos
 * ni correo: es la parte donde un error se traduce en cortarle el acceso a
 * alguien antes de tiempo.
 *
 * @param recibo Vencimiento, último aviso y si ya se suspendió por él.
 * @param ajustes Los plazos de la academia.
 * @param hoy El día que se está procesando.
 * @returns Si toca avisar, si toca cortar el acceso, y cuántos días lleva de
 *   retraso. Con los avisos apagados o sin fecha de vencimiento, no toca nada.
 */
export function quePasaHoy(
  recibo: {
    dueDate: Date | null;
    lastReminderAt: Date | null;
    suspendedAt: Date | null;
  },
  ajustes: {
    dunningEnabled: boolean;
    dunningFirstDays: number;
    dunningEveryDays: number;
    dunningSuspendDays: number;
  },
  hoy: Date,
): { avisar: boolean; suspender: boolean; diasDeRetraso: number } {
  const nada = { avisar: false, suspender: false, diasDeRetraso: 0 };
  if (!ajustes.dunningEnabled || !recibo.dueDate) return nada;

  const retraso = diasDesde(recibo.dueDate, hoy);
  if (retraso < ajustes.dunningFirstDays) return nada;

  // Suspender solo si la academia lo ha pedido (cero = nunca) y todavía no se
  // hizo por este recibo.
  const suspender =
    ajustes.dunningSuspendDays > 0 &&
    retraso >= ajustes.dunningSuspendDays &&
    !recibo.suspendedAt;

  // El primer aviso al llegar al plazo; los siguientes, cada `cada` días. Si
  // hoy además toca cortar, el aviso va igualmente: ese correo es el que
  // explica que se ha cortado y cómo recuperarlo.
  const cada = Math.max(1, ajustes.dunningEveryDays);
  const avisar = recibo.lastReminderAt
    ? diasDesde(recibo.lastReminderAt, hoy) >= cada
    : true;

  return { avisar: avisar || suspender, suspender, diasDeRetraso: retraso };
}

/** Escapa lo que va dentro del HTML: los conceptos y los nombres llevan de todo. */
function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** El correo que se le manda a quien debe un recibo. */
/**
 * @param datos Alumno, deuda, retraso y la forma de pago ya redactada, más si
 *   este correo es el que anuncia el corte o si ya estaba cortado.
 * @returns Asunto, texto y HTML. El tono cambia según corte: el recordatorio no
 *   amenaza con nada y el del corte explica cómo se recupera.
 */
export function componerAvisoDeImpago(datos: {
  nombre: string;
  concepto: string;
  importeCents: number;
  vencimiento: Date;
  diasDeRetraso: number;
  academia: string;
  pago: { titulo: string; cuerpo: string };
  seCorta: boolean;
  yaCortado: boolean;
}) {
  const nombre = datos.nombre.split(" ")[0] ?? "";
  const importe = euros(datos.importeCents);

  const encabezado = datos.seCorta
    ? `Hemos pausado tu acceso por el recibo pendiente`
    : `Tienes un recibo pendiente`;

  const cierre = datos.seCorta
    ? "En cuanto se registre el pago, el acceso se te devuelve solo. Si crees que es un error o necesitas otro plazo, contesta a este correo: lo arreglamos."
    : datos.yaCortado
      ? "Tu acceso sigue pausado hasta que se registre el pago. Si crees que es un error, contesta a este correo."
      : "Si ya lo has pagado, no hagas caso de este correo: puede que se hayan cruzado. Si tienes cualquier problema para pagarlo, contéstanos y buscamos una solución.";

  const text = [
    `Hola ${nombre},`.trim(),
    "",
    `${encabezado}: «${datos.concepto}», ${importe}, que venció el ${formatDate(datos.vencimiento)} (hace ${datos.diasDeRetraso} días).`,
    "",
    datos.pago.titulo.toUpperCase(),
    datos.pago.cuerpo,
    "",
    cierre,
    "",
    datos.academia,
  ].join("\n");

  const html = `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
  <p>Hola ${escapar(nombre)},</p>
  <p>${encabezado}: <strong>${escapar(datos.concepto)}</strong>, ${importe}, que venció el ${formatDate(datos.vencimiento)} (hace ${datos.diasDeRetraso} días).</p>
  <div style="background:#f4f6fb;border-radius:10px;padding:14px 16px;margin:20px 0">
    <p style="margin:0 0 4px;font-weight:600">${escapar(datos.pago.titulo)}</p>
    <p style="margin:0;color:#333">${escapar(datos.pago.cuerpo)}</p>
  </div>
  <p>${cierre}</p>
  <p style="margin-top:24px">${escapar(datos.academia)}</p>
</div>`;

  return {
    subject: datos.seCorta
      ? `Acceso pausado · recibo pendiente de ${importe}`
      : `Recordatorio: recibo pendiente de ${importe}`,
    text,
    html,
  };
}

/**
 * Manda el aviso de impago a UN alumno, ahora.
 *
 * Comparte el correo y las marcas con la tarea diaria: si esto mandara un texto
 * distinto, el alumno recibiría dos versiones de la misma reclamación según
 * quién la disparó.
 *
 * @param db Cliente acotado a la academia.
 * @param academyId La academia, para leer su nombre y su cuenta.
 * @param membershipId El alumno al que se reclama.
 * @param hoy Fecha del aviso.
 * @returns Cuántos recibos cubre el correo enviado; cero si no debía nada.
 */
export async function reclamarA(
  db: TenantClient,
  academyId: string,
  membershipId: string,
  hoy: Date = new Date(),
): Promise<number> {
  const academia = await prismaBase.academy.findUnique({
    where: { id: academyId },
    select: { name: true, legalName: true, billingIban: true },
  });
  if (!academia) return 0;

  const recibos = await db.payment.findMany({
    where: {
      studentId: membershipId,
      deletedAt: null,
      status: { in: ["PENDING", "FAILED"] },
      dueDate: { not: null, lt: hoy },
    },
    select: {
      id: true,
      concept: true,
      amountCents: true,
      dueDate: true,
      suspendedAt: true,
      student: {
        select: {
          user: { select: { firstName: true, email: true } },
          billingProfile: { select: { method: true, chargeDay: true, iban: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  // Se avisa del más antiguo, que es el que da la cifra de días de retraso. Un
  // correo por cada recibo vencido sería tres correos a la misma persona.
  const recibo = recibos[0];
  if (!recibo) return 0;

  const correo = componerAvisoDeImpago({
    nombre: recibo.student.user.firstName,
    concepto:
      recibos.length > 1
        ? `${recibo.concept} (y ${recibos.length - 1} más)`
        : recibo.concept,
    importeCents: recibos.reduce((t, r) => t + r.amountCents, 0),
    vencimiento: recibo.dueDate as Date,
    diasDeRetraso: diasDesde(recibo.dueDate as Date, hoy),
    academia: academia.legalName ?? academia.name,
    seCorta: false,
    yaCortado: Boolean(recibo.suspendedAt),
    pago: instruccionesDePago({
      metodo: recibo.student.billingProfile?.method,
      diaDeCobro: recibo.student.billingProfile?.chargeDay,
      // Cifrados en columna: sin descifrar, el correo enseñaría base64.
      ibanDelAlumno: descifrar(recibo.student.billingProfile?.iban ?? null),
      ibanDeLaAcademia: descifrar(academia.billingIban),
      referencia: recibo.concept,
      nombreAcademia: academia.legalName ?? academia.name,
      enlaceDePago: enlaceDePago(recibo.id),
    }),
  });

  await sendEmail({ to: recibo.student.user.email, ...correo });

  // Se marcan TODOS: si no, la tarea diaria volvería a escribirle mañana por
  // los otros recibos y recibiría dos correos casi seguidos.
  await db.payment.updateMany({
    where: { id: { in: recibos.map((r) => r.id) } },
    data: { lastReminderAt: hoy, reminderCount: { increment: 1 } },
  });

  return recibos.length;
}

/** Lo que ha hecho una pasada de avisos, para poder contarlo en el registro. */
export type ResultadoDunning = {
  academias: number;
  avisos: number;
  suspendidos: number;
  errores: string[];
};

/**
 * Pasa los avisos de impago de todas las academias.
 *
 * Pensada para la tarea diaria. Es idempotente por construcción: las marcas del
 * recibo —`lastReminderAt` y `suspendedAt`— hacen que ejecutarla dos veces el
 * mismo día no mande el aviso dos veces ni vuelva a suspender.
 *
 * @param hoy El día que se procesa. Se puede pasar otro para comprobar el
 *   calendario sin esperar semanas.
 * @returns Cuántas academias se han recorrido, cuántos avisos han salido,
 *   cuántos alumnos se han suspendido y los errores que no han impedido seguir.
 */
export async function ejecutarAvisosDeImpago(
  hoy: Date = new Date(),
): Promise<ResultadoDunning> {
  const resultado: ResultadoDunning = {
    academias: 0,
    avisos: 0,
    suspendidos: 0,
    errores: [],
  };

  const academias = await prismaBase.academy.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "TRIAL"] },
      dunningEnabled: true,
      // Reclamar cobros es del módulo de cobros: quien no lo tiene contratado
      // no recibe este servicio.
      modules: { some: { module: "COBROS", active: true } },
    },
    select: {
      id: true,
      name: true,
      legalName: true,
      billingIban: true,
      dunningEnabled: true,
      dunningFirstDays: true,
      dunningEveryDays: true,
      dunningSuspendDays: true,
    },
  });

  for (const academia of academias) {
    resultado.academias += 1;
    const db = tenantDb(academia.id);

    const recibos = await db.payment.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PENDING", "FAILED"] },
        dueDate: { not: null, lt: hoy },
      },
      select: {
        id: true,
        concept: true,
        amountCents: true,
        dueDate: true,
        lastReminderAt: true,
        suspendedAt: true,
        studentId: true,
        student: {
          select: {
            user: { select: { firstName: true, email: true } },
            billingProfile: {
              select: { method: true, chargeDay: true, iban: true },
            },
          },
        },
      },
    });

    /*
     * Se agrupa POR ALUMNO antes de hacer nada.
     *
     * Recorriendo recibos, alguien con tres meses sin pagar recibía TRES
     * correos idénticos en la misma pasada, tres avisos en su bandeja y un
     * recuento de suspendidos inflado por tres. Se reclama a una persona, no a
     * un apunte contable: un correo, con la deuda entera.
     */
    const porAlumno = new Map<string, typeof recibos>();
    for (const recibo of recibos) {
      const suyos = porAlumno.get(recibo.studentId) ?? [];
      suyos.push(recibo);
      porAlumno.set(recibo.studentId, suyos);
    }

    for (const [studentId, suyos] of porAlumno) {
      // El más antiguo manda: marca desde cuándo se debe y decide los plazos.
      const masAntiguo = suyos.reduce((peor, r) =>
        (r.dueDate as Date) < (peor.dueDate as Date) ? r : peor,
      );
      const ultimoAviso = suyos.reduce<Date | null>(
        (u, r) => (r.lastReminderAt && (!u || r.lastReminderAt > u) ? r.lastReminderAt : u),
        null,
      );
      const yaSuspendido = suyos.find((r) => r.suspendedAt)?.suspendedAt ?? null;

      const accion = quePasaHoy(
        {
          dueDate: masAntiguo.dueDate,
          lastReminderAt: ultimoAviso,
          suspendedAt: yaSuspendido,
        },
        academia,
        hoy,
      );
      if (!accion.avisar && !accion.suspender) continue;

      const deudaCents = suyos.reduce((t, r) => t + r.amountCents, 0);

      try {
        if (accion.suspender) {
          await db.entitlement.updateMany({
            where: { studentId, status: "ACTIVE" },
            data: { status: "PAST_DUE" },
          });
          await db.enrollment.updateMany({
            where: { studentId, status: "ACTIVE" },
            data: { status: "PAST_DUE" },
          });
          // La marca va en todos sus recibos vencidos: si solo fuera en uno, la
          // pasada de mañana volvería a «suspender» por los demás.
          await db.payment.updateMany({
            where: { id: { in: suyos.map((r) => r.id) } },
            data: { suspendedAt: hoy },
          });
          await db.notification.create({
            data: {
              recipientId: studentId,
              type: "payment.due",
              title: "Acceso pausado por un recibo pendiente",
              body: `Tienes pendiente «${masAntiguo.concept}». En cuanto se registre el pago recuperas el acceso.`,
              status: "SENT",
              sentAt: hoy,
            },
          });
          resultado.suspendidos += 1;
        }

        const correo = componerAvisoDeImpago({
          nombre: masAntiguo.student.user.firstName,
          concepto:
            suyos.length > 1
              ? `${masAntiguo.concept} (y ${suyos.length - 1} más)`
              : masAntiguo.concept,
          importeCents: deudaCents,
          vencimiento: masAntiguo.dueDate as Date,
          diasDeRetraso: accion.diasDeRetraso,
          academia: academia.legalName ?? academia.name,
          seCorta: accion.suspender,
          yaCortado: Boolean(yaSuspendido),
          pago: instruccionesDePago({
            metodo: masAntiguo.student.billingProfile?.method,
            diaDeCobro: masAntiguo.student.billingProfile?.chargeDay,
            // Cifrados en columna: sin descifrar, el correo enseñaría base64.
            ibanDelAlumno: descifrar(masAntiguo.student.billingProfile?.iban ?? null),
            ibanDeLaAcademia: descifrar(academia.billingIban),
            referencia: masAntiguo.concept,
            nombreAcademia: academia.legalName ?? academia.name,
            enlaceDePago: enlaceDePago(masAntiguo.id),
          }),
        });

        await sendEmail({ to: masAntiguo.student.user.email, ...correo });

        await db.payment.updateMany({
          where: { id: { in: suyos.map((r) => r.id) } },
          data: { lastReminderAt: hoy, reminderCount: { increment: 1 } },
        });
        resultado.avisos += 1;
      } catch (error) {
        // Un alumno que falla no puede impedir que se reclame a los demás.
        resultado.errores.push(
          `${academia.name} · ${masAntiguo.student.user.email}: ${(error as Error).message}`,
        );
      }
    }
  }

  return resultado;
}
