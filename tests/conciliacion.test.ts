import { describe, expect, it } from "vitest";
import { leerFecha, leerImporte, leerNorma43 } from "@/lib/billing/norma43";
import {
  normalizar,
  proponerConciliacion,
  type ReciboPendiente,
} from "@/lib/billing/conciliacion";

/**
 * CONCILIAR TRANSFERENCIAS
 *
 * Dos mitades que fallan distinto. Leer mal el fichero del banco da importes
 * equivocados; casar mal da el recibo de otro por cobrado, y eso no lo detecta
 * nadie: el que pagó sigue como moroso hasta que le cortan el acceso, y el que
 * no pagó desaparece de la lista.
 *
 * Por eso casi todas estas pruebas comprueban que NO se propone nada.
 */

/** Una línea de movimiento del cuaderno, de 80 caracteres exactos. */
function movimiento({
  fecha = "260901",
  signo = "2",
  importe = "00000000004500",
  documento = "0000000001",
  ref1 = "",
  ref2 = "",
}: Partial<Record<string, string>> = {}) {
  return (
    "22" +
    "    " + // libre
    "0001" + // oficina
    fecha + // fecha operación
    fecha + // fecha valor
    "12" + // concepto común
    "003" + // concepto propio
    signo +
    importe +
    documento.padEnd(10, " ") +
    ref1.padEnd(12, " ") +
    ref2.padEnd(16, " ")
  );
}

describe("leer el fichero del banco", () => {
  it("los importes vienen con dos decimales implícitos", () => {
    // «000000012345» son 123,45 €. Tratarlo como euros cobraría cien veces más.
    expect(leerImporte("00000000012345", "2")).toBe(12345);
    expect(leerImporte("00000000004500", "2")).toBe(4500);
  });

  it("el signo 1 es dinero que sale", () => {
    expect(leerImporte("00000000004500", "1")).toBe(-4500);
  });

  it("rechaza importes que no son números", () => {
    expect(leerImporte("0000000000450X", "2")).toBeNull();
  });

  it("lee las fechas del cuaderno y rechaza las imposibles", () => {
    const f = leerFecha("260901");
    expect(f?.getFullYear()).toBe(2026);
    expect(f?.getMonth()).toBe(8);
    expect(f?.getDate()).toBe(1);

    expect(leerFecha("260230")).toBeNull(); // 30 de febrero
    expect(leerFecha("261301")).toBeNull(); // mes 13
    expect(leerFecha("26091")).toBeNull(); // corta
  });

  it("la fecha leída es la del extracto, sin corrimientos de huso", () => {
    // Un 1 de septiembre no puede acabar enseñándose como 31 de agosto: es el
    // dato con el que alguien compara contra el extracto de su banco.
    const { movimientos } = leerNorma43(movimiento({ fecha: "260901" }));
    expect(movimientos[0].fecha.getDate()).toBe(1);
    expect(movimientos[0].fecha.getMonth()).toBe(8);
  });

  it("junta las líneas de concepto con su movimiento", () => {
    const fichero = [
      movimiento({ ref1: "TRANSF", ref2: "ANA BERMUDEZ" }),
      "2301" + "Concepto: mensualidad septiembre".padEnd(38, " ") + "".padEnd(38, " "),
    ].join("\n");

    const { movimientos, errores } = leerNorma43(fichero);
    expect(errores).toHaveLength(0);
    expect(movimientos).toHaveLength(1);
    expect(movimientos[0].concepto).toContain("ANA BERMUDEZ");
    expect(movimientos[0].concepto).toContain("mensualidad septiembre");
  });

  it("no se calla los problemas: una línea corta se reporta", () => {
    const { movimientos, errores } = leerNorma43("22corta");
    expect(movimientos).toHaveLength(0);
    expect(errores[0]).toMatch(/80 caracteres/);
  });

  it("ignora las líneas que no son movimientos", () => {
    const fichero = ["1120950001...", movimiento(), "8899999999"].join("\n");
    expect(leerNorma43(fichero).movimientos).toHaveLength(1);
  });
});

describe("casar ingresos con recibos", () => {
  const recibo = (extra: Partial<ReciboPendiente> = {}): ReciboPendiente => ({
    id: "r1",
    concepto: "Mensualidad septiembre",
    importeCents: 4500,
    alumno: "Ana Bermúdez",
    referencia: null,
    ...extra,
  });

  const ingreso = (concepto: string, importeCents = 4500) => ({
    fecha: new Date(2026, 8, 1),
    importeCents,
    concepto,
    referencia: "0000000001",
  });

  it("la referencia de la factura manda sobre todo lo demás", () => {
    const [p] = proponerConciliacion(
      [ingreso("TRANSF A/2026/0042 DE ALGUIEN")],
      [recibo({ referencia: "A/2026/0042" })],
    );
    expect(p.recibo?.id).toBe("r1");
    expect(p.seguro).toBe(true);
  });

  it("con la referencia pero el importe distinto, propone y AVISA", () => {
    const [p] = proponerConciliacion(
      [ingreso("PAGO A/2026/0042", 3000)],
      [recibo({ referencia: "A/2026/0042" })],
    );
    expect(p.recibo?.id).toBe("r1");
    // No se marca solo: un importe que no cuadra lo tiene que ver una persona.
    expect(p.seguro).toBe(false);
    expect(p.motivo).toMatch(/no cuadra/i);
  });

  it("encuentra el nombre aunque el banco quite los acentos", () => {
    const [p] = proponerConciliacion([ingreso("TRANSF DE ANA BERMUDEZ")], [recibo()]);
    expect(p.recibo?.id).toBe("r1");
  });

  it("NO propone si dos recibos encajan por importe", () => {
    const [p] = proponerConciliacion(
      [ingreso("INGRESO EN EFECTIVO")],
      [recibo(), recibo({ id: "r2", alumno: "Luis Marín" })],
    );
    expect(p.recibo).toBeNull();
    expect(p.motivo).toMatch(/2 recibos/);
  });

  it("NO propone si el importe no coincide con ninguno", () => {
    const [p] = proponerConciliacion([ingreso("TRANSFERENCIA", 9999)], [recibo()]);
    expect(p.recibo).toBeNull();
  });

  it("un mismo recibo no se casa con dos ingresos", () => {
    const propuestas = proponerConciliacion(
      [ingreso("TRANSF DE ANA BERMUDEZ"), ingreso("TRANSF DE ANA BERMUDEZ")],
      [recibo()],
    );
    expect(propuestas[0].recibo?.id).toBe("r1");
    expect(propuestas[1].recibo).toBeNull();
  });

  it("los cargos no son pagos de nadie", () => {
    // Un recibo domiciliado devuelto sale como dinero que SALE.
    expect(proponerConciliacion([ingreso("DEVOLUCION", -4500)], [recibo()])).toHaveLength(0);
  });

  it("un nombre demasiado corto no vale como pista", () => {
    const [p] = proponerConciliacion(
      [ingreso("PAGO DE JO", 4500)],
      [recibo({ alumno: "Jo Li", id: "r9" }), recibo({ id: "r8", alumno: "Otra Persona" })],
    );
    // Cae al importe, que empata entre dos: no se propone ninguno.
    expect(p.recibo).toBeNull();
  });

  it("normalizar deja el texto comparable", () => {
    expect(normalizar("Ana Bermúdez-Gil")).toBe("ANABERMUDEZGIL");
  });
});
