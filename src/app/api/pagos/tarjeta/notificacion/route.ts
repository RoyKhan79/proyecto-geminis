import { NextResponse } from "next/server";
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { descifrar } from "@/lib/crypto/field";
import { recordAudit } from "@/lib/audit";
import {
  CLAVE_DE_PRUEBAS,
  comprobarRespuesta,
} from "@/lib/billing/redsys";

/**
 * LO QUE CONTESTA EL BANCO CUANDO ALGUIEN PAGA CON TARJETA
 *
 * Redsys llama aquí por detrás, desde sus servidores, minutos después de que el
 * alumno pague. Esta llamada —y no la vuelta del navegador— es la que da un
 * recibo por cobrado: el alumno puede cerrar la pestaña antes de volver, y el
 * dinero ya está cobrado igualmente.
 *
 * No hay sesión ni cookie: quien llama es un banco, no una persona. Lo único
 * que autoriza es la firma. Si no cuadra, la petición se tira entera sin mirar
 * nada más, porque sin eso cualquiera que conozca esta dirección se lleva el
 * curso gratis mandando un «pagado».
 */
export async function POST(request: Request) {
  let cuerpo: { Ds_MerchantParameters?: string; Ds_Signature?: string };

  try {
    // Redsys manda un formulario, no JSON.
    const form = await request.formData();
    cuerpo = {
      Ds_MerchantParameters: String(form.get("Ds_MerchantParameters") ?? ""),
      Ds_Signature: String(form.get("Ds_Signature") ?? ""),
    };
  } catch {
    return NextResponse.json({ error: "Cuerpo no válido" }, { status: 400 });
  }

  if (!cuerpo.Ds_MerchantParameters) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  }

  /*
   * Para verificar la firma hace falta la clave del comercio, y para saber qué
   * clave es hay que saber de qué academia es el pedido. Se localiza por el
   * número de pedido, que se guardó al preparar el cobro; solo entonces se
   * comprueba la firma con la clave de ESA academia.
   */
  let orden: string | null = null;
  try {
    const datos = JSON.parse(
      Buffer.from(cuerpo.Ds_MerchantParameters, "base64").toString("utf8"),
    );
    orden = datos.Ds_Order ?? datos.DS_ORDER ?? null;
  } catch {
    return NextResponse.json({ error: "Parámetros ilegibles" }, { status: 400 });
  }
  if (!orden) {
    return NextResponse.json({ error: "Sin número de pedido" }, { status: 400 });
  }

  const recibo = await prismaBase.payment.findUnique({
    where: { gatewayOrder: orden },
    select: {
      id: true,
      academyId: true,
      status: true,
      concept: true,
      studentId: true,
      academy: {
        select: {
          redsysMerchantCode: true,
          redsysSecretKey: true,
          redsysLive: true,
        },
      },
    },
  });

  // Un pedido que no conocemos no es un error nuestro. Se contesta 200 para que
  // Redsys no lo reintente eternamente, pero no se toca nada.
  if (!recibo) return new NextResponse("OK", { status: 200 });

  const clave =
    descifrar(recibo.academy.redsysSecretKey) ??
    // Sin credenciales propias, el cobro salió por el comercio de pruebas.
    CLAVE_DE_PRUEBAS;

  const respuesta = comprobarRespuesta(cuerpo, clave);

  if (!respuesta.valida) {
    console.error(
      "[tarjeta] notificación rechazada para el pedido",
      orden,
      respuesta.motivo,
    );
    return NextResponse.json({ error: "Firma no válida" }, { status: 400 });
  }

  if (!respuesta.pagada) {
    // Rechazo del banco: tarjeta sin fondos, caducada, o el alumno se arrepiente.
    // No es un impago que haya que reclamar hoy; el recibo sigue pendiente y la
    // tarea de avisos ya se ocupa cuando toque.
    return new NextResponse("OK", { status: 200 });
  }

  // Ya estaba cobrado: Redsys reintenta la notificación si duda de la respuesta,
  // y cobrar dos veces el mismo recibo descuadraría la caja.
  if (recibo.status === "PAID") return new NextResponse("OK", { status: 200 });

  const db = tenantDb(recibo.academyId);

  await db.payment.update({
    where: { id: recibo.id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      method: "CARD",
      externalRef: respuesta.autorizacion ?? orden,
    },
  });

  /*
   * Y se le devuelve el acceso si estaba cortado, con la misma regla que al
   * cobrar a mano: solo si no le queda nada más vencido. Pagar uno de tres
   * recibos no es estar al día.
   */
  const pendientes = await db.payment.count({
    where: {
      studentId: recibo.studentId,
      deletedAt: null,
      id: { not: recibo.id },
      status: { in: ["PENDING", "FAILED"] },
      dueDate: { lt: new Date() },
    },
  });

  if (pendientes === 0) {
    await db.entitlement.updateMany({
      where: { studentId: recibo.studentId, status: "PAST_DUE" },
      data: { status: "ACTIVE" },
    });
    await db.enrollment.updateMany({
      where: { studentId: recibo.studentId, status: "PAST_DUE" },
      data: { status: "ACTIVE" },
    });
  }

  await recordAudit({
    academyId: recibo.academyId,
    actorId: null,
    action: "payment.card",
    entityType: "Payment",
    entityId: recibo.id,
    changes: {
      pedido: orden,
      autorizacion: respuesta.autorizacion ?? "",
      accesoDevuelto: pendientes === 0,
    },
  });

  return new NextResponse("OK", { status: 200 });
}
