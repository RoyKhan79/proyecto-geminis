import { describe, expect, it } from "vitest";
import {
  componerAvisoDeImpago,
  diasDesde,
  quePasaHoy,
} from "@/server/billing/dunning";
import { instruccionesDePago } from "@/server/billing/invoice-email";

/**
 * EL CALENDARIO DE LOS AVISOS
 *
 * Aquí un error no es una pantalla fea: es cortarle el acceso a alguien antes
 * de tiempo, o mandarle un correo todos los días. Las dos cosas cuestan un
 * alumno, así que el calendario se comprueba día a día.
 */

const AJUSTES = {
  dunningEnabled: true,
  dunningFirstDays: 3,
  dunningEveryDays: 7,
  dunningSuspendDays: 30,
};

/*
 * Las fechas se construyen con partes LOCALES y no con cadenas terminadas en
 * Z. Los vencimientos se guardan así en toda la aplicación —`new Date(año,
 * mes, día)`— y los días se cuentan como los cuenta una academia, en su
 * calendario. Escribirlas en UTC haría que estas pruebas pasaran o fallaran
 * según el huso del ordenador que las ejecuta.
 */
const dia = (n: number) => new Date(2026, 8, n, 10, 0, 0);
const VENCE = dia(1);

const recibo = (extra: Partial<Parameters<typeof quePasaHoy>[0]> = {}) => ({
  dueDate: VENCE,
  lastReminderAt: null,
  suspendedAt: null,
  ...extra,
});

describe("cuenta los días sin que la hora estorbe", () => {
  it("dos momentos del mismo día son cero días", () => {
    expect(
      diasDesde(new Date(2026, 8, 1, 23, 59), new Date(2026, 8, 1, 0, 1)),
    ).toBe(0);
  });

  it("la medianoche cuenta como un día", () => {
    expect(
      diasDesde(new Date(2026, 8, 1, 23, 59), new Date(2026, 8, 2, 0, 1)),
    ).toBe(1);
  });
});

describe("antes del plazo no se molesta a nadie", () => {
  it("el día del vencimiento no se avisa", () => {
    expect(quePasaHoy(recibo(), AJUSTES, dia(1)).avisar).toBe(false);
  });

  it("tampoco el día antes de que toque", () => {
    expect(quePasaHoy(recibo(), AJUSTES, dia(3)).avisar).toBe(false);
  });

  it("el primer aviso sale exactamente al cumplirse el plazo", () => {
    const hoy = quePasaHoy(recibo(), AJUSTES, dia(4));
    expect(hoy.avisar).toBe(true);
    expect(hoy.suspender).toBe(false);
    expect(hoy.diasDeRetraso).toBe(3);
  });
});

describe("no se insiste todos los días", () => {
  it("al día siguiente de avisar, no se vuelve a avisar", () => {
    const r = recibo({ lastReminderAt: dia(4) });
    expect(quePasaHoy(r, AJUSTES, dia(5)).avisar).toBe(false);
  });

  it("se vuelve a avisar al cumplirse el intervalo, no antes", () => {
    const r = recibo({ lastReminderAt: dia(4) });
    expect(quePasaHoy(r, AJUSTES, dia(10)).avisar).toBe(false);
    expect(quePasaHoy(r, AJUSTES, dia(11)).avisar).toBe(true);
  });
});

describe("cortar el acceso llega al final y una sola vez", () => {
  it("no se corta antes del plazo aunque ya se esté avisando", () => {
    expect(quePasaHoy(recibo({ lastReminderAt: dia(20) }), AJUSTES, dia(25)).suspender).toBe(
      false,
    );
  });

  it("se corta al cumplirse los días, y ese día también se avisa", () => {
    const r = quePasaHoy(recibo({ lastReminderAt: dia(25) }), AJUSTES, dia(31));
    expect(r.suspender).toBe(true);
    // Aunque no tocara por intervalo, el correo sale: es el que explica que se
    // ha cortado y cómo recuperarlo.
    expect(r.avisar).toBe(true);
  });

  it("no se vuelve a suspender a quien ya está suspendido", () => {
    const r = recibo({ suspendedAt: dia(31), lastReminderAt: dia(31) });
    expect(quePasaHoy(r, AJUSTES, dia(40)).suspender).toBe(false);
  });

  it("con cero días no se corta nunca, por mucho retraso que haya", () => {
    const sinCorte = { ...AJUSTES, dunningSuspendDays: 0 };
    expect(quePasaHoy(recibo(), sinCorte, dia(30)).suspender).toBe(false);
  });
});

describe("apagado no hace absolutamente nada", () => {
  it("ni avisa ni suspende", () => {
    const apagado = { ...AJUSTES, dunningEnabled: false };
    const r = quePasaHoy(recibo(), apagado, dia(30));
    expect(r.avisar).toBe(false);
    expect(r.suspender).toBe(false);
  });

  it("un recibo sin fecha de vencimiento no se reclama", () => {
    expect(quePasaHoy(recibo({ dueDate: null }), AJUSTES, dia(30)).avisar).toBe(false);
  });
});

describe("el correo dice lo que corresponde", () => {
  const base = {
    nombre: "Ana Bermúdez",
    concepto: "Mensualidad · septiembre",
    importeCents: 7900,
    vencimiento: VENCE,
    diasDeRetraso: 10,
    academia: "Academia de prueba S.L.",
    pago: instruccionesDePago({
      metodo: "TRANSFER",
      referencia: "REF-1",
      nombreAcademia: "Academia de prueba S.L.",
      ibanDeLaAcademia: "ES7100302053091234567895",
    }),
  };

  it("el recordatorio no amenaza con nada", () => {
    const c = componerAvisoDeImpago({ ...base, seCorta: false, yaCortado: false });
    expect(c.subject).toMatch(/Recordatorio/);
    expect(c.text).not.toMatch(/pausado/i);
    expect(c.text).toMatch(/si ya lo has pagado/i);
  });

  it("el del corte dice que se ha cortado y cómo se recupera", () => {
    const c = componerAvisoDeImpago({ ...base, seCorta: true, yaCortado: false });
    expect(c.subject).toMatch(/Acceso pausado/);
    expect(c.text).toMatch(/el acceso se te devuelve solo/i);
  });

  it("siempre lleva cómo pagar y el importe", () => {
    const c = componerAvisoDeImpago({ ...base, seCorta: false, yaCortado: false });
    expect(c.text).toContain("ES7100302053091234567895");
    expect(c.text).toMatch(/79,00/);
  });
});
