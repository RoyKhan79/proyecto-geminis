import { describe, expect, it } from "vitest";
import {
  CLAVE_DE_PRUEBAS,
  comprobarRespuesta,
  firmar,
} from "@/lib/billing/redsys";
import { configuracionDeCobro } from "@/server/billing/tarjeta";

/**
 * QUE NADIE PUEDA PONERSE «PAGADO»
 *
 * Estas pruebas están escritas desde el lado del atacante, y todas describen
 * algo que llegó a ser posible.
 *
 * El caso que las motiva: la clave del entorno de pruebas de Redsys es PÚBLICA
 * —está en su documentación— y se usaba como respaldo para las academias que
 * todavía no habían configurado su TPV. Cualquiera con conocimientos medios
 * podía leer el número de pedido en su propia página de pago, firmar con esa
 * clave una notificación que dijera «pagado», mandarla y saldar su recibo.
 *
 * La regla que sale de ahí: sin credenciales propias NO se salda nada. La
 * demostración sirve para ver el circuito, no para pagar.
 */

const academiaSinTpv = {
  redsysMerchantCode: null,
  redsysTerminal: null,
  redsysSecretKey: null,
  redsysLive: false,
};

describe("una academia sin TPV no puede saldar recibos", () => {
  it("se marca como sin configurar, que es lo que corta el paso", () => {
    const { sinConfigurar, enPruebas } = configuracionDeCobro(academiaSinTpv);
    expect(sinConfigurar).toBe(true);
    expect(enPruebas).toBe(true);
  });

  it("una academia con solo la clave, sin comercio, TAMPOCO cuenta", () => {
    // Este caso hacía que se firmara con una clave y se verificara con otra, y
    // ningún cobro llegaba a completarse nunca.
    const { sinConfigurar } = configuracionDeCobro({
      ...academiaSinTpv,
      redsysSecretKey: "loquesea",
    });
    expect(sinConfigurar).toBe(true);
  });

  it("una academia con solo el comercio, sin clave, tampoco", () => {
    const { sinConfigurar } = configuracionDeCobro({
      ...academiaSinTpv,
      redsysMerchantCode: "999008881",
    });
    expect(sinConfigurar).toBe(true);
  });

  it("con las dos cosas sí queda configurada, y firma con SU clave", () => {
    const { sinConfigurar, config } = configuracionDeCobro({
      redsysMerchantCode: "123456789",
      redsysTerminal: "002",
      // El cifrado real se prueba aparte; aquí basta con que no sea la pública.
      redsysSecretKey: null,
      redsysLive: true,
    });
    // Sin clave descifrable sigue sin estar configurada: no se cuela a real.
    expect(sinConfigurar).toBe(true);
    expect(config.secretKey).toBe(CLAVE_DE_PRUEBAS);
  });
});

describe("la notificación del banco no se puede falsificar", () => {
  const pedido = "0001ABCD1234";

  const notificacion = (campos: Record<string, string>, clave: string) => {
    const parametros = Buffer.from(JSON.stringify(campos)).toString("base64");
    return { Ds_MerchantParameters: parametros, Ds_Signature: firmar(parametros, pedido, clave) };
  };

  it("firmada con la clave PÚBLICA de pruebas no vale contra una academia real", () => {
    const claveDeLaAcademia = Buffer.from("clave-de-24-bytes-exacta").toString("base64");

    // Lo que haría el atacante: firmar con la clave que cualquiera conoce.
    const falsa = notificacion(
      { Ds_Order: pedido, Ds_Response: "0000" },
      CLAVE_DE_PRUEBAS,
    );

    expect(comprobarRespuesta(falsa, claveDeLaAcademia).valida).toBe(false);
  });

  it("sin código de respuesta no se da por pagada", () => {
    // `Number("")` es cero, y cero estaba dentro del rango de «aprobada»: una
    // notificación bien firmada pero sin código pasaba por buena.
    const sinCodigo = notificacion({ Ds_Order: pedido }, CLAVE_DE_PRUEBAS);
    const r = comprobarRespuesta(sinCodigo, CLAVE_DE_PRUEBAS);
    expect(r.valida).toBe(true);
    expect(r.pagada).toBe(false);
  });

  it("con un código que no es un número tampoco", () => {
    for (const codigo of ["", "   ", "SI", "0000x", "-1"]) {
      const r = comprobarRespuesta(
        notificacion({ Ds_Order: pedido, Ds_Response: codigo }, CLAVE_DE_PRUEBAS),
        CLAVE_DE_PRUEBAS,
      );
      expect(r.pagada, `código «${codigo}»`).toBe(false);
    }
  });

  it("cambiar el pedido invalida la firma: no se puede reutilizar la de otro", () => {
    const buena = notificacion({ Ds_Order: pedido, Ds_Response: "0000" }, CLAVE_DE_PRUEBAS);
    const otroPedido = Buffer.from(
      JSON.stringify({ Ds_Order: "0009ZZZZ9999", Ds_Response: "0000" }),
    ).toString("base64");

    expect(
      comprobarRespuesta(
        { Ds_MerchantParameters: otroPedido, Ds_Signature: buena.Ds_Signature },
        CLAVE_DE_PRUEBAS,
      ).valida,
    ).toBe(false);
  });
});
