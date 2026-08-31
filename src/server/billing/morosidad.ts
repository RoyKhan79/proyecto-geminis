import type { TenantClient } from "@/lib/db/tenant";
import { diasDesde, quePasaHoy } from "./dunning";

/**
 * QUIÉN PAGA Y QUIÉN NO
 *
 * La pregunta que se hace una academia el día 5 de cada mes. Hoy se contestaba
 * mirando una lista de recibos sueltos y sumando de cabeza, que es como se
 * cuelan los que llevan tres meses.
 *
 * Se agrupa POR ALUMNO y no por recibo a propósito: a quien se llama es a una
 * persona, no a un recibo, y lo que hay que saber antes de descolgar es cuánto
 * debe en total y desde cuándo, no que tiene un apunte de cuarenta euros.
 *
 * Y se separa a quien hay que reclamar de quien no. Alguien vencido ayer con la
 * cuota domiciliada no es un moroso: es un cargo que el banco todavía está
 * procesando. Meterlo en la misma lista que quien lleva dos meses hace que la
 * lista no se mire.
 */

export type SituacionAlumno =
  | "al-dia"
  | "reciente"
  | "reclamar"
  | "suspendido";

export type FilaDeMorosidad = {
  membershipId: string;
  nombre: string;
  email: string;
  metodo: string | null;
  situacion: SituacionAlumno;
  /// Lo que debe ahora mismo, sumando todos sus recibos vencidos.
  deudaCents: number;
  recibosVencidos: number;
  /// Días desde que venció el más antiguo. Es la cifra que ordena la lista.
  diasDeRetraso: number;
  ultimoAviso: Date | null;
  avisosEnviados: number;
  suspendidoEl: Date | null;
  /// Lo que la tarea diaria hará con él, para no tener que adivinarlo.
  proximoPaso: string;
};

export type ResumenDeMorosidad = {
  filas: FilaDeMorosidad[];
  totales: {
    alDia: number;
    reciente: number;
    reclamar: number;
    suspendidos: number;
    deudaCents: number;
  };
};

export type AjustesDeAviso = {
  dunningEnabled: boolean;
  dunningFirstDays: number;
  dunningEveryDays: number;
  dunningSuspendDays: number;
};

/**
 * El estado de cobro de todos los alumnos.
 *
 * Incluye a los que están al día a propósito: la pregunta no es solo «a quién
 * reclamo», también es «de quién no me tengo que preocupar», y una lista donde
 * solo salen los morosos no deja ver que el resto va bien.
 */
export async function cargarMorosidad(
  db: TenantClient,
  ajustes: AjustesDeAviso,
  hoy: Date = new Date(),
): Promise<ResumenDeMorosidad> {
  const alumnos = await db.membership.findMany({
    where: { deletedAt: null, studentProfile: { isNot: null } },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true, email: true } },
      billingProfile: { select: { method: true } },
      payments: {
        where: { deletedAt: null, status: { in: ["PENDING", "FAILED"] } },
        select: {
          amountCents: true,
          dueDate: true,
          lastReminderAt: true,
          reminderCount: true,
          suspendedAt: true,
        },
      },
    },
  });

  const filas: FilaDeMorosidad[] = alumnos.map((alumno) => {
    const vencidos = alumno.payments.filter(
      (p) => p.dueDate !== null && p.dueDate < hoy,
    );

    const deudaCents = vencidos.reduce((total, p) => total + p.amountCents, 0);

    // El más antiguo manda: es el que marca desde cuándo se debe dinero.
    const masAntiguo = vencidos.reduce<Date | null>(
      (peor, p) => (!peor || (p.dueDate as Date) < peor ? (p.dueDate as Date) : peor),
      null,
    );
    const diasDeRetraso = masAntiguo ? diasDesde(masAntiguo, hoy) : 0;

    const ultimoAviso = vencidos.reduce<Date | null>(
      (ultimo, p) =>
        p.lastReminderAt && (!ultimo || p.lastReminderAt > ultimo)
          ? p.lastReminderAt
          : ultimo,
      null,
    );
    const suspendidoEl = vencidos.reduce<Date | null>(
      (primero, p) =>
        p.suspendedAt && (!primero || p.suspendedAt < primero)
          ? p.suspendedAt
          : primero,
      null,
    );
    const avisosEnviados = vencidos.reduce((n, p) => n + p.reminderCount, 0);

    const situacion: SituacionAlumno =
      vencidos.length === 0
        ? "al-dia"
        : suspendidoEl
          ? "suspendido"
          : diasDeRetraso < ajustes.dunningFirstDays
            ? "reciente"
            : "reclamar";

    return {
      membershipId: alumno.id,
      nombre: `${alumno.user.firstName} ${alumno.user.lastName ?? ""}`.trim(),
      email: alumno.user.email,
      metodo: alumno.billingProfile?.method ?? null,
      situacion,
      deudaCents,
      recibosVencidos: vencidos.length,
      diasDeRetraso,
      ultimoAviso,
      avisosEnviados,
      suspendidoEl,
      proximoPaso: describirProximoPaso(
        { masAntiguo, ultimoAviso, suspendidoEl },
        ajustes,
        hoy,
        situacion,
      ),
    };
  });

  // Primero quien más días lleva; entre iguales, quien más debe.
  filas.sort(
    (a, b) => b.diasDeRetraso - a.diasDeRetraso || b.deudaCents - a.deudaCents,
  );

  return {
    filas,
    totales: {
      alDia: filas.filter((f) => f.situacion === "al-dia").length,
      reciente: filas.filter((f) => f.situacion === "reciente").length,
      reclamar: filas.filter((f) => f.situacion === "reclamar").length,
      suspendidos: filas.filter((f) => f.situacion === "suspendido").length,
      deudaCents: filas.reduce((total, f) => total + f.deudaCents, 0),
    },
  };
}

/**
 * Qué le va a pasar a este alumno, en una frase.
 *
 * Es la columna que evita la pregunta «¿y a este ya le hemos escrito?». Sale de
 * la MISMA función que usa la tarea diaria, así que no puede prometer una cosa
 * y hacer otra.
 */
function describirProximoPaso(
  recibo: {
    masAntiguo: Date | null;
    ultimoAviso: Date | null;
    suspendidoEl: Date | null;
  },
  ajustes: AjustesDeAviso,
  hoy: Date,
  situacion: SituacionAlumno,
): string {
  if (situacion === "al-dia") return "Nada. Está al día.";
  if (!ajustes.dunningEnabled) return "Nada: los avisos están apagados.";
  if (!recibo.masAntiguo) return "Nada.";

  const accion = quePasaHoy(
    {
      dueDate: recibo.masAntiguo,
      lastReminderAt: recibo.ultimoAviso,
      suspendedAt: recibo.suspendidoEl,
    },
    ajustes,
    hoy,
  );

  if (accion.suspender) return "Hoy se le pausa el acceso.";
  if (accion.avisar) return "Hoy se le manda un aviso.";

  const retraso = diasDesde(recibo.masAntiguo, hoy);

  if (!recibo.ultimoAviso) {
    const faltan = ajustes.dunningFirstDays - retraso;
    return faltan > 0
      ? `Primer aviso en ${faltan} ${faltan === 1 ? "día" : "días"}.`
      : "Aviso pendiente.";
  }

  const desdeElUltimo = diasDesde(recibo.ultimoAviso, hoy);
  const faltan = Math.max(0, ajustes.dunningEveryDays - desdeElUltimo);

  if (recibo.suspendidoEl) {
    return faltan > 0
      ? `Ya suspendido. Siguiente aviso en ${faltan} ${faltan === 1 ? "día" : "días"}.`
      : "Ya suspendido. Aviso pendiente.";
  }

  const paraElCorte =
    ajustes.dunningSuspendDays > 0 ? ajustes.dunningSuspendDays - retraso : null;

  const siguiente =
    faltan > 0
      ? `Siguiente aviso en ${faltan} ${faltan === 1 ? "día" : "días"}`
      : "Aviso pendiente";

  return paraElCorte !== null && paraElCorte > 0
    ? `${siguiente}; se le pausa en ${paraElCorte}.`
    : `${siguiente}.`;
}
