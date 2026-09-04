import { describe, expect, it } from "vitest";
import {
  formatearIban,
  generarReferenciaMandato,
  limpiarParaSepa,
  ocultarIban,
  validarIban,
} from "@/lib/billing/iban";
import { generarFicheroAdeudos } from "@/lib/billing/sepa";
import { aCentimos, calcularFactura, referenciaFactura } from "@/lib/billing/invoice";

/**
 * Aquí se mueve dinero de las cuentas de los alumnos y se emiten documentos con
 * validez fiscal. Es lo que más caro sale si falla, así que es lo que más se
 * prueba.
 */

describe("validarIban", () => {
  it("acepta un IBAN correcto, con y sin espacios", () => {
    expect(validarIban("ES9121000418450200051332").valido).toBe(true);
    expect(validarIban("ES91 2100 0418 4502 0005 1332").valido).toBe(true);
    expect(validarIban("es91-2100-0418-4502-0005-1332").valido).toBe(true);
  });

  it("rechaza un dígito de control incorrecto", () => {
    // Es el caso que importa: un número que parece bien y no lo está.
    const r = validarIban("ES9121000418450200051333");
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.motivo).toContain("dígitos de control");
  });

  it("rechaza una longitud que no corresponde al país", () => {
    const r = validarIban("ES912100041845020005133");
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.motivo).toContain("24 caracteres");
  });

  it("rechaza un país desconocido", () => {
    expect(validarIban("XX9121000418450200051332").valido).toBe(false);
  });

  it("acepta IBAN de otros países SEPA", () => {
    expect(validarIban("DE89370400440532013000").valido).toBe(true);
    expect(validarIban("PT50000201231234567890154").valido).toBe(true);
  });

  it("no acepta un IBAN vacío", () => {
    expect(validarIban("").valido).toBe(false);
    expect(validarIban("   ").valido).toBe(false);
  });
});

describe("presentación del IBAN", () => {
  it("se agrupa de cuatro en cuatro", () => {
    expect(formatearIban("ES9121000418450200051332")).toBe(
      "ES91 2100 0418 4502 0005 1332",
    );
  });

  it("oculta el centro pero deja reconocerlo", () => {
    const oculto = ocultarIban("ES9121000418450200051332");
    expect(oculto).toContain("ES91");
    expect(oculto).toContain("1332");
    expect(oculto).not.toContain("0418");
  });
});

describe("limpiarParaSepa", () => {
  it("quita acentos y eñes, que hacen rechazar el fichero entero", () => {
    expect(limpiarParaSepa("Academia Peña & Muñoz — Ávila")).toBe(
      "Academia Pena Munoz Avila",
    );
  });

  it("conserva los signos que la norma sí admite", () => {
    expect(limpiarParaSepa("Cuota 1/2026 (septiembre)")).toBe(
      "Cuota 1/2026 (septiembre)",
    );
  });
});

describe("generarReferenciaMandato", () => {
  it("es estable para el mismo alumno", () => {
    const a = generarReferenciaMandato("CATEDRIA", "0195c0de-1234-7890-abcd-ef0123456789");
    const b = generarReferenciaMandato("CATEDRIA", "0195c0de-1234-7890-abcd-ef0123456789");
    expect(a).toBe(b);
  });

  it("distingue a dos alumnos", () => {
    const a = generarReferenciaMandato("GEM", "0195c0de-1111-7890-abcd-ef0123456789");
    const b = generarReferenciaMandato("GEM", "0195c0de-2222-7890-abcd-ef0123456780");
    expect(a).not.toBe(b);
  });

  it("no cuela caracteres que el banco rechaza", () => {
    const ref = generarReferenciaMandato("Academia Peña", "abc-def-123456789012");
    expect(ref).toMatch(/^[A-Za-z0-9/\-?:().,'+ ]+$/);
  });
});

describe("generarFicheroAdeudos", () => {
  const acreedor = {
    nombre: "Academia Demo SL",
    iban: "ES9121000418450200051332",
    identificador: "ES12ZZZX1234567X",
  };

  const adeudo = (id: string, primerCobro: boolean, importeCents = 6000) => ({
    id,
    deudor: "Lucia Marin",
    iban: "ES7921000813610123456789",
    importeCents,
    concepto: "Cuota septiembre",
    mandatoRef: `REF-${id}`,
    mandatoFecha: new Date(2026, 0, 15),
    primerCobro,
  });

  it("separa los primeros cobros de los recurrentes en lotes distintos", () => {
    const fichero = generarFicheroAdeudos({
      acreedor,
      adeudos: [adeudo("1", true), adeudo("2", false)],
      fechaCobro: new Date(2026, 8, 5),
      referencia: "TEST",
      ahora: new Date(2026, 8, 1),
    });

    expect(fichero.lotes).toBe(2);
    expect(fichero.xml).toContain("<SeqTp>FRST</SeqTp>");
    expect(fichero.xml).toContain("<SeqTp>RCUR</SeqTp>");
  });

  it("usa un solo lote si todos son del mismo tipo", () => {
    const fichero = generarFicheroAdeudos({
      acreedor,
      adeudos: [adeudo("1", false), adeudo("2", false)],
      fechaCobro: new Date(2026, 8, 5),
      referencia: "TEST",
      ahora: new Date(2026, 8, 1),
    });
    expect(fichero.lotes).toBe(1);
  });

  it("escribe los importes en euros, no en céntimos", () => {
    const fichero = generarFicheroAdeudos({
      acreedor,
      adeudos: [adeudo("1", false, 6050)],
      fechaCobro: new Date(2026, 8, 5),
      referencia: "TEST",
      ahora: new Date(2026, 8, 1),
    });
    expect(fichero.xml).toContain('<InstdAmt Ccy="EUR">60.50</InstdAmt>');
  });

  it("la suma de control coincide con el total", () => {
    const fichero = generarFicheroAdeudos({
      acreedor,
      adeudos: [adeudo("1", false, 6000), adeudo("2", false, 6500)],
      fechaCobro: new Date(2026, 8, 5),
      referencia: "TEST",
      ahora: new Date(2026, 8, 1),
    });
    expect(fichero.totalCents).toBe(12500);
    expect(fichero.xml).toContain("<CtrlSum>125.00</CtrlSum>");
  });

  it("manda la fecha de cobro exacta, sin restar un día por la zona horaria", () => {
    // Es el fallo que se coló y se corrigió: `toISOString()` convertía el 5 de
    // septiembre a las 00:00 de Madrid en el 4 de septiembre en UTC.
    const fichero = generarFicheroAdeudos({
      acreedor,
      adeudos: [adeudo("1", false)],
      fechaCobro: new Date(2026, 8, 5),
      referencia: "TEST",
      ahora: new Date(2026, 8, 1),
    });
    expect(fichero.xml).toContain("<ReqdColltnDt>2026-09-05</ReqdColltnDt>");
    expect(fichero.nombreArchivo).toContain("2026-09-05");
  });

  it("no deja pasar acentos al fichero", () => {
    const fichero = generarFicheroAdeudos({
      acreedor: { ...acreedor, nombre: "Academia Peña Ávila" },
      adeudos: [{ ...adeudo("1", false), deudor: "José Muñoz", concepto: "Cuota más" }],
      fechaCobro: new Date(2026, 8, 5),
      referencia: "TEST",
      ahora: new Date(2026, 8, 1),
    });
    expect(fichero.xml).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/);
  });

  it("se niega a generar un fichero vacío", () => {
    expect(() =>
      generarFicheroAdeudos({
        acreedor,
        adeudos: [],
        fechaCobro: new Date(2026, 8, 5),
        referencia: "TEST",
        ahora: new Date(2026, 8, 1),
      }),
    ).toThrow();
  });
});

describe("calcularFactura", () => {
  it("una cuota exenta no lleva IVA", () => {
    const r = calcularFactura([
      { description: "Cuota", quantity: 1, unitCents: 6000, taxRate: 0 },
    ]);
    expect(r.taxableCents).toBe(6000);
    expect(r.taxCents).toBe(0);
    expect(r.totalCents).toBe(6000);
  });

  it("el IVA se calcula línea a línea y la suma cuadra", () => {
    const r = calcularFactura([
      { description: "Material", quantity: 2, unitCents: 1550, taxRate: 21 },
      { description: "Clase", quantity: 1.5, unitCents: 2000, taxRate: 21 },
    ]);
    expect(r.lineas.reduce((s, l) => s + l.totalCents, 0)).toBe(r.totalCents);
    expect(r.lineas.reduce((s, l) => s + l.taxCents, 0)).toBe(r.taxCents);
  });

  it("el descuento se reparte sin perder ni un céntimo", () => {
    const r = calcularFactura(
      [
        { description: "A", quantity: 1, unitCents: 3333, taxRate: 21 },
        { description: "B", quantity: 1, unitCents: 3333, taxRate: 21 },
        { description: "C", quantity: 1, unitCents: 3334, taxRate: 21 },
      ],
      1000,
    );
    expect(r.subtotalCents - r.taxableCents).toBe(1000);
    expect(r.lineas.reduce((s, l) => s + l.baseCents, 0)).toBe(r.taxableCents);
  });

  it("desglosa por tipo de IVA, que es lo que hay que imprimir", () => {
    const r = calcularFactura([
      { description: "Curso", quantity: 1, unitCents: 6000, taxRate: 0 },
      { description: "Libro", quantity: 1, unitCents: 2500, taxRate: 4 },
    ]);
    expect(r.porTipo).toEqual([
      { taxRate: 0, baseCents: 6000, taxCents: 0 },
      { taxRate: 4, baseCents: 2500, taxCents: 100 },
    ]);
  });

  it("un descuento mayor que el total no deja la base en negativo", () => {
    const r = calcularFactura(
      [{ description: "A", quantity: 1, unitCents: 1000, taxRate: 0 }],
      5000,
    );
    expect(r.taxableCents).toBe(0);
    expect(r.discountCents).toBe(1000);
  });
});

describe("aCentimos", () => {
  it("entiende cómo escribe la gente los importes", () => {
    expect(aCentimos("60")).toBe(6000);
    expect(aCentimos("60,50")).toBe(6050);
    expect(aCentimos("60.50")).toBe(6050);
    expect(aCentimos("60,50 €")).toBe(6050);
  });

  it("devuelve null si no es un número", () => {
    expect(aCentimos("sesenta")).toBeNull();
    expect(aCentimos("")).toBeNull();
  });
});

describe("referenciaFactura", () => {
  it("rellena con ceros para que ordenen bien", () => {
    expect(referenciaFactura("A", 2026, 42)).toBe("A/2026/0042");
    expect(referenciaFactura("A", 2026, 1)).toBe("A/2026/0001");
  });
});
