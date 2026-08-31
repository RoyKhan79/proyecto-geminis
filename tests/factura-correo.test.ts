import { describe, expect, it } from "vitest";
import {
  componerCorreoDeFactura,
  instruccionesDePago,
} from "@/server/billing/invoice-email";

/**
 * EL CORREO DE LA FACTURA
 *
 * Lo que se comprueba aquí no es que el correo salga bonito, sino que no diga
 * una mentira cara: a quien tiene la cuota domiciliada no se le puede pedir que
 * transfiera —pagaría dos veces— y a quien paga por transferencia no se le
 * puede decir que no haga nada.
 */

const BASE = {
  referencia: "A/2026/0042",
  nombreAcademia: "Academia de prueba S.L.",
};

describe("las instrucciones de pago dependen de cómo paga cada uno", () => {
  it("al domiciliado le dice que no haga nada, y cuándo se le cobra", () => {
    const { titulo, cuerpo } = instruccionesDePago({
      ...BASE,
      metodo: "SEPA_DIRECT_DEBIT",
      diaDeCobro: 5,
      ibanDelAlumno: "ES9121000418450200051332",
    });

    expect(titulo).toMatch(/no tienes que hacer nada/i);
    expect(cuerpo).toContain("día 5");
    expect(cuerpo).not.toMatch(/transfiere/i);
  });

  it("nunca escribe el IBAN entero del alumno", () => {
    const { cuerpo } = instruccionesDePago({
      ...BASE,
      metodo: "SEPA_DIRECT_DEBIT",
      ibanDelAlumno: "ES9121000418450200051332",
    });

    expect(cuerpo).not.toContain("ES9121000418450200051332");
    expect(cuerpo).toContain("ES91 **** **** 1332");
  });

  it("al de transferencia le da la cuenta y el concepto", () => {
    const { cuerpo } = instruccionesDePago({
      ...BASE,
      metodo: "TRANSFER",
      ibanDeLaAcademia: "ES7100302053091234567895",
    });

    expect(cuerpo).toContain("ES7100302053091234567895");
    expect(cuerpo).toContain("A/2026/0042");
  });

  it("sin cuenta de la academia no se inventa una", () => {
    const { cuerpo } = instruccionesDePago({ ...BASE, metodo: "TRANSFER" });
    expect(cuerpo).toMatch(/te pasamos el número de cuenta/i);
  });

  it("efectivo y tarjeta mandan a la academia, no al banco", () => {
    for (const metodo of ["CASH", "CARD"]) {
      const { cuerpo } = instruccionesDePago({ ...BASE, metodo });
      expect(cuerpo).toContain("Academia de prueba S.L.");
      expect(cuerpo).not.toMatch(/transfiere/i);
    }
  });

  it("un método desconocido no deja al alumno sin saber qué hacer", () => {
    const { cuerpo } = instruccionesDePago({ ...BASE, metodo: null });
    expect(cuerpo.length).toBeGreaterThan(20);
  });
});

const FACTURA = {
  reference: "A/2026/0042",
  issuedOn: new Date("2026-08-31T00:00:00.000Z"),
  customerName: "Ana Bermúdez",
  customerEmail: "ana@ejemplo.test",
  totalCents: 7900,
  taxCents: 0,
  taxableCents: 7900,
  exemptionNote: "Operación exenta de IVA en virtud del artículo 20.Uno.9º.",
  issuerName: "Academia de prueba S.L.",
  issuerEmail: "info@ejemplo.test",
  lines: [{ description: "Mensualidad · agosto", totalCents: 7900 }],
};

describe("el correo lleva lo que hace falta", () => {
  const pago = instruccionesDePago({ ...BASE, metodo: "CASH" });
  const correo = componerCorreoDeFactura(FACTURA, pago);

  it("el asunto identifica la factura sin abrirla", () => {
    expect(correo.subject).toContain("A/2026/0042");
    expect(correo.subject).toContain("Academia de prueba S.L.");
  });

  it("lleva el importe y el concepto en las dos versiones", () => {
    for (const cuerpo of [correo.text, correo.html]) {
      expect(cuerpo).toContain("Mensualidad · agosto");
      expect(cuerpo).toMatch(/79,00/);
    }
  });

  it("una factura exenta dice por qué lo está", () => {
    expect(correo.text).toContain("artículo 20.Uno.9º");
    expect(correo.html).toContain("artículo 20.Uno.9");
  });

  it("con IVA no cuela la mención de exención", () => {
    const conIva = componerCorreoDeFactura(
      { ...FACTURA, taxCents: 1659 },
      pago,
    );
    expect(conIva.text).not.toContain("exenta");
  });

  it("escapa el HTML de los nombres, que llevan de todo", () => {
    const raro = componerCorreoDeFactura(
      { ...FACTURA, customerName: '<b>Ana</b> & "Bermúdez"' },
      pago,
    );
    expect(raro.html).not.toContain("<b>Ana</b>");
    expect(raro.html).toContain("&lt;b&gt;Ana");
  });

  it("le dice al cliente qué hacer si el NIF está mal", () => {
    expect(correo.text).toMatch(/rectificativa/i);
  });
});
