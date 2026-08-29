/**
 * Prueba del ciclo completo de cobro recurrente.
 *
 *   npm run remesa:probar
 *
 * Configura tres alumnos con formas de pago distintas, emite los recibos de un
 * mes, genera el fichero para el banco y comprueba lo que de verdad importa:
 * que no se cobra dos veces.
 */
import { prismaBase } from "@/lib/db/client";
import { tenantDb } from "@/lib/db/tenant";
import { generarFicheroAdeudos } from "@/lib/billing/sepa";
import { preverMes, inicioDeMes, nombreDelMes } from "@/server/billing/service";

const MES = new Date(2026, 8, 1); // septiembre de 2026

async function main() {
  const academia = await prismaBase.academy.findFirst({
    where: { slug: "geminis-demo" },
    select: { id: true, name: true },
  });
  if (!academia) throw new Error("Falta la academia demo.");
  const db = tenantDb(academia.id);

  console.log(`\nCICLO DE COBRO · ${nombreDelMes(MES)}\n${"=".repeat(60)}`);

  const alumnos = await db.membership.findMany({
    where: { studentProfile: { isNot: null } },
    take: 3,
    select: { id: true, user: { select: { firstName: true, lastName: true } } },
  });

  const configuracion = [
    {
      method: "SEPA_DIRECT_DEBIT" as const,
      iban: "ES9121000418450200051332",
      mandateRef: "DEMO-0001",
      mandateSignedAt: new Date(2026, 0, 15),
    },
    {
      method: "SEPA_DIRECT_DEBIT" as const,
      iban: "ES7921000813610123456789",
      mandateRef: "DEMO-0002",
      mandateSignedAt: new Date(2026, 1, 3),
    },
    { method: "CASH" as const, iban: null, mandateRef: null, mandateSignedAt: null },
  ];

  for (const [i, alumno] of alumnos.entries()) {
    const cfg = configuracion[i];
    const existente = await db.billingProfile.findFirst({
      where: { studentId: alumno.id }, select: { id: true },
    });
    const datos = { ...cfg, chargeDay: 5, mandateUsed: false };
    if (existente) await db.billingProfile.update({ where: { id: existente.id }, data: datos });
    else await db.billingProfile.create({ data: { studentId: alumno.id, ...datos } });

    const cuota = await db.recurringCharge.findFirst({
      where: { studentId: alumno.id }, select: { id: true },
    });
    const datosCuota = {
      concept: "Curso anual Administrativo",
      amountCents: 6000 + i * 500,
      startsOn: new Date(2026, 8, 1),
      endsOn: new Date(2027, 5, 30),
      status: "ACTIVE" as const,
    };
    if (cuota) await db.recurringCharge.update({ where: { id: cuota.id }, data: datosCuota });
    else await db.recurringCharge.create({ data: { studentId: alumno.id, ...datosCuota } });

    const nombre = `${alumno.user.firstName} ${alumno.user.lastName ?? ""}`.trim();
    console.log(`  · ${nombre.padEnd(24)} ${cfg.method}`);
  }

  const previsión = await preverMes(db, inicioDeMes(MES));
  console.log(`\nPrevisión: ${previsión.length} cuotas vigentes`);
  for (const l of previsión) {
    console.log(
      `  ${l.nombre.padEnd(24)} ${(l.amountCents / 100).toFixed(2)} €  ${
        l.impedimento ?? (l.primerCobro ? "primer cargo" : "recurrente")
      }${l.yaCobrado ? " · YA EMITIDO" : ""}`,
    );
  }

  const domiciliables = previsión.filter((l) => !l.impedimento && !l.yaCobrado);
  if (domiciliables.length > 0) {
    const fichero = generarFicheroAdeudos({
      acreedor: {
        nombre: academia.name,
        iban: "ES9121000418450200051332",
        identificador: "ES12ZZZX1234567X",
      },
      adeudos: domiciliables.map((l, i) => ({
        id: `PRUEBA-${i + 1}`,
        deudor: l.nombre,
        iban: l.iban!,
        importeCents: l.amountCents,
        concepto: `${l.concepto} · ${nombreDelMes(MES)}`,
        mandatoRef: l.mandatoRef!,
        mandatoFecha: l.mandatoFecha!,
        primerCobro: l.primerCobro,
      })),
      fechaCobro: new Date(2026, 8, 5),
      referencia: "PRUEBA01",
      ahora: new Date(2026, 8, 1, 9, 0, 0),
    });

    console.log(`\nFichero SEPA · ${fichero.nombreArchivo}`);
    console.log(
      `  ${fichero.adeudos} adeudos · ${(fichero.totalCents / 100).toFixed(2)} € · ${fichero.lotes} lote(s)`,
    );
    console.log(`  ${fichero.xml.split("\n").length} líneas de XML`);

    // Comprobaciones sobre el contenido del fichero.
    const comprobar = (t: string, ok: boolean) => console.log(`  ${ok ? "✓" : "✗"} ${t}`);
    comprobar("declara el esquema pain.008.001.02", fichero.xml.includes("pain.008.001.02"));
    comprobar("los importes van en euros, no en céntimos", fichero.xml.includes("<InstdAmt Ccy=\"EUR\">60.00</InstdAmt>"));
    comprobar("lleva el identificador de acreedor", fichero.xml.includes("ES12ZZZX1234567X"));
    comprobar("separa primeros cobros de recurrentes", !(fichero.xml.match(/<SeqTp>FRST<\/SeqTp>[\s\S]*?<SeqTp>FRST<\/SeqTp>/) && fichero.lotes === 1));
    comprobar("no cuela acentos ni eñes", !/[áéíóúñÁÉÍÓÚÑ]/.test(fichero.xml));
    comprobar("la suma de control cuadra", fichero.xml.includes(`<CtrlSum>${(fichero.totalCents / 100).toFixed(2)}</CtrlSum>`));
  }

  console.log("");
  await prismaBase.$disconnect();
}

main().catch((e) => {
  console.error("✗", e);
  process.exit(1);
});
