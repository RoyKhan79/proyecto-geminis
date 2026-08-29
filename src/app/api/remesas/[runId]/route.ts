import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/context";
import { generarFicheroAdeudos } from "@/lib/billing/sepa";
import { descifrar } from "@/lib/crypto/field";

/**
 * Descarga del fichero de adeudos de una remesa.
 *
 * Va por una ruta de API y no por una acción porque lo que se devuelve es un
 * archivo. Como en la descarga de documentos, la comprobación de permiso se
 * hace aquí dentro: una ruta que sirve datos bancarios no puede fiarse de que
 * quien la llama ya haya comprobado nada.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const ctx = await requirePermission("payments.write");
  const { runId } = await params;

  const remesa = await ctx.db.directDebitRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      period: true,
      chargeOn: true,
      creditorName: true,
      creditorIban: true,
      creditorId: true,
    },
  });

  if (!remesa) {
    return NextResponse.json({ error: "Esa remesa no existe." }, { status: 404 });
  }

  const ibanAcreedor = descifrar(remesa.creditorIban);

  if (!ibanAcreedor || !remesa.creditorId) {
    return NextResponse.json(
      {
        error:
          "Faltan los datos de acreedor de la academia. Complétalos antes de generar el fichero.",
      },
      { status: 400 },
    );
  }

  const recibos = await ctx.db.payment.findMany({
    where: { directDebitRunId: remesa.id, deletedAt: null },
    select: {
      id: true,
      concept: true,
      amountCents: true,
      student: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
          billingProfile: {
            select: {
              iban: true,
              holderName: true,
              mandateRef: true,
              mandateSignedAt: true,
              mandateUsed: true,
            },
          },
        },
      },
    },
  });

  // El IBAN se guarda cifrado. Se descifra aquí, en el último momento y solo
  // para las filas que van al fichero.
  const adeudos = recibos
    .map((r) => ({ recibo: r, iban: descifrar(r.student.billingProfile?.iban ?? null) }))
    .filter(
      ({ recibo, iban }) =>
        iban &&
        recibo.student.billingProfile?.mandateRef &&
        recibo.student.billingProfile.mandateSignedAt,
    )
    .map(({ recibo: r, iban }) => {
      const perfil = r.student.billingProfile!;
      const nombreAlumno = [
        r.student.user.firstName,
        r.student.user.lastName ?? "",
      ]
        .join(" ")
        .trim();

      return {
        id: r.id,
        deudor: perfil.holderName?.trim() || nombreAlumno,
        iban: iban!,
        importeCents: r.amountCents,
        concepto: r.concept,
        mandatoRef: perfil.mandateRef!,
        mandatoFecha: perfil.mandateSignedAt!,
        primerCobro: !perfil.mandateUsed,
      };
    });

  if (adeudos.length === 0) {
    return NextResponse.json(
      { error: "Esta remesa no tiene ningún recibo domiciliable." },
      { status: 400 },
    );
  }

  const fichero = generarFicheroAdeudos({
    acreedor: {
      nombre: remesa.creditorName,
      iban: ibanAcreedor,
      identificador: remesa.creditorId,
    },
    adeudos,
    fechaCobro: remesa.chargeOn,
    referencia: remesa.id.slice(-12).toUpperCase(),
    ahora: new Date(),
  });

  return new NextResponse(fichero.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fichero.nombreArchivo}"`,
      // Un fichero con los números de cuenta de media academia no se queda en
      // ninguna caché intermedia.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
