import { prismaBase } from "@/lib/db/client";
import { descifrar } from "@/lib/crypto/field";
import { env } from "@/lib/env";
import {
  CLAVE_DE_PRUEBAS,
  COMERCIO_DE_PRUEBAS,
  construirPeticion,
  numeroDePedido,
  type ConfiguracionRedsys,
  type PeticionDePago,
} from "@/lib/billing/redsys";

/**
 * COBRAR UN RECIBO CON TARJETA
 *
 * Une el recibo con la pasarela del banco de SU academia. Lo que no hace, y es
 * lo importante: no toca datos de tarjeta. El alumno los teclea en la página
 * del banco; aquí solo se prepara la petición firmada y se espera la respuesta.
 */

/**
 * Las credenciales de una academia, o las de pruebas si aún no las tiene.
 *
 * Empezar en pruebas no es un apaño: es que quien está montando su academia
 * pueda ver el cobro funcionando de punta a punta antes de haber pedido el TPV
 * al banco, que tarda semanas. En pruebas no se mueve un euro, y la pantalla lo
 * dice bien claro.
 */
export function configuracionDeCobro(academia: {
  redsysMerchantCode: string | null;
  redsysTerminal: string | null;
  redsysSecretKey: string | null;
  redsysLive: boolean;
}): {
  config: ConfiguracionRedsys;
  enPruebas: boolean;
  /**
   * La academia no ha puesto sus credenciales y se está usando el comercio de
   * demostración. Es lo que impide dar por cobrado nada: la clave de pruebas de
   * Redsys es PÚBLICA, así que cualquiera puede firmar con ella una
   * notificación que diga «pagado». Quien reciba la respuesta del banco tiene
   * que mirar esto ANTES de tocar un recibo.
   */
  sinConfigurar: boolean;
} {
  const clave = descifrar(academia.redsysSecretKey);

  if (academia.redsysMerchantCode && clave) {
    return {
      config: {
        merchantCode: academia.redsysMerchantCode,
        terminal: academia.redsysTerminal ?? "001",
        secretKey: clave,
        live: academia.redsysLive,
      },
      enPruebas: !academia.redsysLive,
      sinConfigurar: false,
    };
  }

  return {
    config: {
      ...COMERCIO_DE_PRUEBAS,
      secretKey: CLAVE_DE_PRUEBAS,
      live: false,
    },
    enPruebas: true,
    sinConfigurar: true,
  };
}

/** La dirección pública de la aplicación, que el banco tiene que poder llamar. */
function base(): string {
  return (env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * El resultado de preparar un cobro: el formulario firmado, o el motivo por el
 * que no se puede cobrar ese recibo.
 */
export type PreparacionDeCobro =
  | {
      ok: true;
      peticion: PeticionDePago;
      enPruebas: boolean;
      sinConfigurar: boolean;
      importeCents: number;
    }
  | { ok: false; motivo: string };

/**
 * Prepara el cobro de un recibo: le asigna número de pedido y firma la petición.
 *
 * El número de pedido se guarda en el recibo, y solo se genera uno nuevo si no
 * lo tenía: si alguien vuelve atrás y lo intenta otra vez, tiene que ser el
 * mismo pedido. Con uno nuevo cada vez, un pago que llegara tarde no
 * encontraría a qué recibo pertenece.
 */
/**
 * @param academyId Academia dueña del recibo.
 * @param paymentId El recibo que se va a cobrar.
 * @returns El formulario firmado para la pasarela, o el motivo del rechazo si
 *   el recibo no existe, ya está pagado o no tiene importe.
 */
export async function prepararCobroConTarjeta(
  academyId: string,
  paymentId: string,
): Promise<PreparacionDeCobro> {
  const recibo = await prismaBase.payment.findFirst({
    where: { id: paymentId, academyId, deletedAt: null },
    select: {
      id: true,
      concept: true,
      amountCents: true,
      status: true,
      gatewayOrder: true,
    },
  });
  if (!recibo) return { ok: false, motivo: "Ese recibo no existe." };
  if (recibo.status === "PAID") return { ok: false, motivo: "Ese recibo ya está pagado." };
  if (recibo.amountCents <= 0) {
    return { ok: false, motivo: "Ese recibo no tiene importe que cobrar." };
  }

  const academia = await prismaBase.academy.findUnique({
    where: { id: academyId },
    select: {
      redsysMerchantCode: true,
      redsysTerminal: true,
      redsysSecretKey: true,
      redsysLive: true,
    },
  });
  if (!academia) return { ok: false, motivo: "No se ha podido leer la academia." };

  const { config, enPruebas, sinConfigurar } = configuracionDeCobro(academia);

  let orden = recibo.gatewayOrder;
  if (!orden) {
    orden = numeroDePedido(recibo.id);
    await prismaBase.payment.update({
      where: { id: recibo.id },
      data: { gatewayOrder: orden },
    });
  }

  return {
    ok: true,
    enPruebas,
    sinConfigurar,
    importeCents: recibo.amountCents,
    peticion: construirPeticion({
      config,
      orden,
      importeCents: recibo.amountCents,
      concepto: recibo.concept,
      urlNotificacion: `${base()}/api/pagos/tarjeta/notificacion`,
      urlVuelta: `${base()}/pagar/${recibo.id}?estado=ok`,
      urlVueltaKo: `${base()}/pagar/${recibo.id}?estado=ko`,
    }),
  };
}
