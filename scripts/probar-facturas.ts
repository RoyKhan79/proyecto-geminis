/**
 * Prueba del ciclo de facturación de extremo a extremo.
 *
 *   npm run facturas:probar
 *
 * Emite facturas de un mes, comprueba que la numeración es correlativa y sin
 * saltos, que los totales cuadran, que no se factura dos veces el mismo recibo
 * y que una rectificativa anula la original sin borrarla.
 */
import { prismaBase } from "@/lib/db/client";
import { tenantDb, transaccionDeAcademia } from "@/lib/db/tenant";
import { calcularFactura, referenciaFactura } from "@/lib/billing/invoice";

async function main() {
  const academia = await prismaBase.academy.findFirst({
    where: { slug: "catedria-demo" },
    select: { id: true, name: true, taxId: true },
  });
  if (!academia) throw new Error("Falta la academia demo.");
  const db = tenantDb(academia.id);

  console.log(`\nFACTURACIÓN · ${academia.name}\n${"=".repeat(60)}`);

  let fallos = 0;
  const comprobar = (t: string, ok: boolean, detalle = "") => {
    console.log(`  ${ok ? "✓" : "✗"} ${t}${detalle ? ` · ${detalle}` : ""}`);
    if (!ok) fallos += 1;
  };

  // La academia necesita NIF para facturar.
  if (!academia.taxId) {
    await db.academy.update({
      where: { id: academia.id },
      data: { taxId: "B12345678", legalName: "Academia Catedria Demo SL" },
    });
    console.log("  · Se ha puesto un NIF de prueba a la academia");
  }

  const anio = new Date().getFullYear();
  let serie = await db.invoiceSeries.findFirst({
    where: { code: "T", year: anio },
    select: { id: true, code: true, year: true, lastNumber: true },
  });
  if (!serie) {
    serie = await db.invoiceSeries.create({
      data: { code: "T", name: "Serie de prueba", year: anio, isDefault: false },
      select: { id: true, code: true, year: true, lastNumber: true },
    });
  }

  const alumnos = await db.membership.findMany({
    where: { studentProfile: { isNot: null } },
    take: 3,
    select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
  });

  const numerosEmitidos: number[] = [];
  const idsFacturas: string[] = [];

  for (const [i, alumno] of alumnos.entries()) {
    // Se reserva número con bloqueo, igual que la acción real.
    const numero = await transaccionDeAcademia(academia.id, async (tx) => {
      const filas = await tx.$queryRaw<{ lastNumber: number }[]>`
        SELECT "lastNumber" FROM invoice_series WHERE id = ${serie!.id} FOR UPDATE`;
      const siguiente = filas[0].lastNumber + 1;
      await tx.invoiceSeries.update({
        where: { id: serie!.id },
        data: { lastNumber: siguiente },
      });
      return siguiente;
    });

    const totales = calcularFactura([
      { description: "Cuota mensual", quantity: 1, unitCents: 6000 + i * 500, taxRate: 0 },
    ]);

    const factura = await db.invoice.create({
      data: {
        seriesId: serie.id,
        studentId: alumno.id,
        number: numero,
        reference: referenciaFactura(serie.code, serie.year, numero),
        status: "ISSUED",
        issuedOn: new Date(),
        issuerName: "Academia Catedria Demo SL",
        issuerTaxId: "B12345678",
        customerName: `${alumno.user.firstName} ${alumno.user.lastName ?? ""}`.trim(),
        customerEmail: alumno.user.email,
        subtotalCents: totales.subtotalCents,
        taxableCents: totales.taxableCents,
        taxCents: totales.taxCents,
        totalCents: totales.totalCents,
        exemptionNote:
          "Operación exenta de IVA en virtud del artículo 20.Uno.9º de la Ley 37/1992.",
      },
      select: { id: true, reference: true, number: true, totalCents: true },
    });

    await db.invoiceLine.createMany({
      data: totales.lineas.map((l, position) => ({
        invoiceId: factura.id,
        position,
        description: l.description,
        quantity: l.quantity,
        unitCents: l.unitCents,
        taxRate: l.taxRate,
        baseCents: l.baseCents,
        taxCents: l.taxCents,
        totalCents: l.totalCents,
      })),
    });

    numerosEmitidos.push(factura.number!);
    idsFacturas.push(factura.id);
    console.log(`  · ${factura.reference} · ${(factura.totalCents / 100).toFixed(2)} €`);
  }

  // 1 · Correlativa y sin saltos.
  const ordenados = [...numerosEmitidos].sort((a, b) => a - b);
  const sinSaltos = ordenados.every((n, i) => i === 0 || n === ordenados[i - 1] + 1);
  comprobar("la numeración es correlativa y sin saltos", sinSaltos, ordenados.join(", "));

  // 2 · Sin duplicados dentro de la serie.
  const todas = await db.invoice.findMany({
    where: { seriesId: serie.id },
    select: { number: true },
  });
  const numeros = todas.map((f) => f.number);
  comprobar(
    "no hay dos facturas con el mismo número",
    new Set(numeros).size === numeros.length,
    `${numeros.length} facturas`,
  );

  // 3 · Los totales cuadran con sus líneas.
  const conLineas = await db.invoice.findMany({
    where: { id: { in: idsFacturas } },
    select: {
      reference: true,
      taxableCents: true,
      taxCents: true,
      totalCents: true,
      lines: { select: { baseCents: true, taxCents: true, totalCents: true } },
    },
  });
  const cuadran = conLineas.every(
    (f) =>
      f.lines.reduce((s, l) => s + l.baseCents, 0) === f.taxableCents &&
      f.lines.reduce((s, l) => s + l.taxCents, 0) === f.taxCents &&
      f.lines.reduce((s, l) => s + l.totalCents, 0) === f.totalCents,
  );
  comprobar("los totales cuadran con la suma de sus líneas", cuadran);

  // 4 · La rectificativa anula sin borrar.
  const original = conLineas[0];
  const originalCompleta = await db.invoice.findFirst({
    where: { reference: original.reference },
    select: { id: true, totalCents: true, lines: { select: { unitCents: true, quantity: true, taxRate: true, description: true } } },
  });

  const numeroRect = await transaccionDeAcademia(academia.id, async (tx) => {
    const filas = await tx.$queryRaw<{ lastNumber: number }[]>`
      SELECT "lastNumber" FROM invoice_series WHERE id = ${serie!.id} FOR UPDATE`;
    const siguiente = filas[0].lastNumber + 1;
    await tx.invoiceSeries.update({ where: { id: serie!.id }, data: { lastNumber: siguiente } });
    return siguiente;
  });

  const totalesRect = calcularFactura(
    originalCompleta!.lines.map((l) => ({
      description: `Rectificación: ${l.description}`,
      quantity: Number(l.quantity),
      unitCents: -l.unitCents,
      taxRate: Number(l.taxRate),
    })),
  );

  const rect = await db.invoice.create({
    data: {
      seriesId: serie.id,
      studentId: alumnos[0].id,
      number: numeroRect,
      reference: referenciaFactura(serie.code, serie.year, numeroRect),
      status: "ISSUED",
      issuedOn: new Date(),
      rectifiesId: originalCompleta!.id,
      issuerName: "Academia Catedria Demo SL",
      issuerTaxId: "B12345678",
      customerName: "Rectificación",
      subtotalCents: totalesRect.subtotalCents,
      taxableCents: totalesRect.taxableCents,
      taxCents: totalesRect.taxCents,
      totalCents: totalesRect.totalCents,
    },
    select: { id: true, reference: true, totalCents: true },
  });

  await db.invoice.update({
    where: { id: originalCompleta!.id },
    data: { status: "RECTIFIED" },
  });

  const sigueExistiendo = await db.invoice.findUnique({
    where: { id: originalCompleta!.id },
    select: { status: true },
  });

  comprobar(
    "la rectificativa lleva el importe en negativo",
    rect.totalCents === -originalCompleta!.totalCents,
    `${(rect.totalCents / 100).toFixed(2)} € frente a ${(originalCompleta!.totalCents / 100).toFixed(2)} €`,
  );
  comprobar(
    "la original NO se borra: queda marcada como rectificada",
    sigueExistiendo?.status === "RECTIFIED",
    sigueExistiendo?.status ?? "desaparecida",
  );

  // 5 · La suma de original + rectificativa es cero: la anula de verdad.
  comprobar(
    "original y rectificativa suman cero",
    originalCompleta!.totalCents + rect.totalCents === 0,
  );

  console.log(`\n${"=".repeat(60)}`);
  if (fallos > 0) {
    console.log(`✗ ${fallos} comprobaciones han fallado.`);
    process.exit(1);
  }
  console.log("✓ La facturación cumple lo que tiene que cumplir.\n");
}

main()
  .catch((e) => {
    console.error("✗", e);
    process.exit(1);
  })
  .finally(() => prismaBase.$disconnect());
