import { describe, expect, it } from "vitest";
import {
  CLAVE_DE_PRUEBAS,
  COMERCIO_DE_PRUEBAS,
  comprobarRespuesta,
  construirPeticion,
  firmar,
  numeroDePedido,
  REDSYS_URLS,
} from "@/lib/billing/redsys";

/**
 * COBRO CON TARJETA
 *
 * Aquí un fallo no es una pantalla rota: o se cobra un importe equivocado, o se
 * acepta como pagado algo que nadie ha pagado. Las dos mitades se comprueban.
 */

const CONFIG = {
  ...COMERCIO_DE_PRUEBAS,
  secretKey: CLAVE_DE_PRUEBAS,
  live: false,
};

const PETICION = {
  config: CONFIG,
  orden: "0001ABCD1234",
  importeCents: 4500,
  concepto: "Mensualidad · septiembre",
  urlNotificacion: "https://ejemplo.test/api/pagos/tarjeta/notificacion",
  urlVuelta: "https://ejemplo.test/pagar/1?estado=ok",
  urlVueltaKo: "https://ejemplo.test/pagar/1?estado=ko",
};

/** Construye una respuesta del banco como la que llega de verdad. */
function respuestaDelBanco(
  campos: Record<string, string>,
  clave = CLAVE_DE_PRUEBAS,
) {
  const parametros = Buffer.from(JSON.stringify(campos)).toString("base64");
  return {
    Ds_MerchantParameters: parametros,
    Ds_Signature: firmar(parametros, campos.Ds_Order, clave),
  };
}

describe("el número de pedido cumple lo que exige Redsys", () => {
  it("tiene doce caracteres y empieza por cuatro dígitos", () => {
    const orden = numeroDePedido("01a05771-2a5c-7091-aa18-6990f6959c65");
    expect(orden).toHaveLength(12);
    expect(orden.slice(0, 4)).toMatch(/^\d{4}$/);
    expect(orden).toMatch(/^[0-9A-Z]+$/);
  });

  it("dos recibos distintos no comparten pedido", () => {
    const ahora = new Date();
    expect(numeroDePedido("aaaaaaaa-1111", ahora)).not.toBe(
      numeroDePedido("bbbbbbbb-2222", ahora),
    );
  });
});

describe("la petición que se manda al banco", () => {
  const peticion = construirPeticion(PETICION);

  it("va al entorno de pruebas mientras no se active el real", () => {
    expect(peticion.url).toBe(REDSYS_URLS.test);
    expect(construirPeticion({ ...PETICION, config: { ...CONFIG, live: true } }).url).toBe(
      REDSYS_URLS.live,
    );
  });

  it("manda el importe en céntimos y sin decimales", () => {
    const params = JSON.parse(
      Buffer.from(peticion.Ds_MerchantParameters, "base64").toString("utf8"),
    );
    // Mandar "45.00" en lugar de "4500" cobraría cuarenta y cinco céntimos.
    expect(params.DS_MERCHANT_AMOUNT).toBe("4500");
    expect(params.DS_MERCHANT_CURRENCY).toBe("978");
    expect(params.DS_MERCHANT_ORDER).toBe("0001ABCD1234");
  });

  it("la firma depende del pedido: no vale para otro", () => {
    const otra = construirPeticion({ ...PETICION, orden: "0002ABCD1234" });
    expect(otra.Ds_Signature).not.toBe(peticion.Ds_Signature);
  });

  it("la firma depende de la clave del comercio", () => {
    const otroComercio = construirPeticion({
      ...PETICION,
      config: { ...CONFIG, secretKey: Buffer.from("clave-de-24-bytes-exacta").toString("base64") },
    });
    expect(otroComercio.Ds_Signature).not.toBe(peticion.Ds_Signature);
  });
});

describe("lo que contesta el banco solo cuenta si está bien firmado", () => {
  it("acepta una respuesta buena y la da por pagada", () => {
    const r = comprobarRespuesta(
      respuestaDelBanco({
        Ds_Order: "0001ABCD1234",
        Ds_Response: "0000",
        Ds_AuthorisationCode: "123456",
      }),
      CLAVE_DE_PRUEBAS,
    );

    expect(r.valida).toBe(true);
    expect(r.pagada).toBe(true);
    expect(r.autorizacion).toBe("123456");
  });

  it("RECHAZA una firma inventada, que es el ataque obvio", () => {
    const buena = respuestaDelBanco({ Ds_Order: "0001ABCD1234", Ds_Response: "0000" });
    const falsa = { ...buena, Ds_Signature: "ZmFsc2lmaWNhZGE=" };

    const r = comprobarRespuesta(falsa, CLAVE_DE_PRUEBAS);
    expect(r.valida).toBe(false);
    expect(r.pagada).toBe(false);
  });

  it("RECHAZA una respuesta firmada con otra clave", () => {
    const otra = Buffer.from("otra-clave-de-24-bytes!!").toString("base64");
    const r = comprobarRespuesta(
      respuestaDelBanco({ Ds_Order: "0001ABCD1234", Ds_Response: "0000" }, otra),
      CLAVE_DE_PRUEBAS,
    );
    expect(r.valida).toBe(false);
  });

  it("RECHAZA si le cambian el importe manteniendo la firma", () => {
    const buena = respuestaDelBanco({
      Ds_Order: "0001ABCD1234",
      Ds_Response: "0000",
      Ds_Amount: "4500",
    });
    const manipulada = {
      Ds_Signature: buena.Ds_Signature,
      Ds_MerchantParameters: Buffer.from(
        JSON.stringify({
          Ds_Order: "0001ABCD1234",
          Ds_Response: "0000",
          Ds_Amount: "1",
        }),
      ).toString("base64"),
    };

    expect(comprobarRespuesta(manipulada, CLAVE_DE_PRUEBAS).valida).toBe(false);
  });

  it("entiende la firma en base64 seguro para URL, que es como la manda", () => {
    const buena = respuestaDelBanco({ Ds_Order: "0001ABCD1234", Ds_Response: "0000" });
    const comoLaManda = {
      ...buena,
      Ds_Signature: buena.Ds_Signature.replace(/\+/g, "-").replace(/\//g, "_"),
    };

    // Comparar sin normalizar esto rechazaría pagos buenos.
    expect(comprobarRespuesta(comoLaManda, CLAVE_DE_PRUEBAS).valida).toBe(true);
  });

  it("un rechazo del banco está bien firmado pero no está pagado", () => {
    const r = comprobarRespuesta(
      // 0190 = denegada por el emisor.
      respuestaDelBanco({ Ds_Order: "0001ABCD1234", Ds_Response: "0190" }),
      CLAVE_DE_PRUEBAS,
    );

    expect(r.valida).toBe(true);
    expect(r.pagada).toBe(false);
  });

  it("acepta todo el rango de códigos de éxito, no solo el 0000", () => {
    for (const codigo of ["0000", "0001", "0099"]) {
      const r = comprobarRespuesta(
        respuestaDelBanco({ Ds_Order: "0001ABCD1234", Ds_Response: codigo }),
        CLAVE_DE_PRUEBAS,
      );
      expect(r.pagada, codigo).toBe(true);
    }
    for (const codigo of ["0100", "0900", "9999"]) {
      const r = comprobarRespuesta(
        respuestaDelBanco({ Ds_Order: "0001ABCD1234", Ds_Response: codigo }),
        CLAVE_DE_PRUEBAS,
      );
      expect(r.pagada, codigo).toBe(false);
    }
  });

  it("no se cae con basura", () => {
    expect(comprobarRespuesta({}, CLAVE_DE_PRUEBAS).valida).toBe(false);
    expect(
      comprobarRespuesta(
        { Ds_MerchantParameters: "no-es-base64-json", Ds_Signature: "x" },
        CLAVE_DE_PRUEBAS,
      ).valida,
    ).toBe(false);
  });
});
