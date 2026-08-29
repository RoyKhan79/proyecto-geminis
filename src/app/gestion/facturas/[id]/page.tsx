import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { markInvoicePaidAction } from "@/server/billing/invoice-actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent } from "@/components/ui/primitives";
import { formatCents, formatDate } from "@/lib/utils";
import { BotonImprimir, Rectificar } from "./acciones";

export const metadata: Metadata = { title: "Factura" };

const ESTADO: Record<
  string,
  { label: string; tone: "neutral" | "positive" | "caution" | "critical" }
> = {
  DRAFT: { label: "Borrador", tone: "neutral" },
  ISSUED: { label: "Emitida", tone: "caution" },
  PAID: { label: "Cobrada", tone: "positive" },
  RECTIFIED: { label: "Rectificada", tone: "critical" },
};

/**
 * La factura, tal y como se entrega al alumno.
 *
 * Se imprime con el diálogo del navegador: los botones y los avisos internos
 * llevan `print:hidden` y desaparecen del papel. Lo que queda es el documento,
 * con todo lo que la norma exige que lleve.
 */
export default async function FacturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePagePermission("payments.read");
  const { id } = await params;

  const factura = await ctx.db.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      status: true,
      issuedOn: true,
      dueOn: true,
      paidOn: true,
      issuerName: true,
      issuerTaxId: true,
      issuerAddress: true,
      issuerEmail: true,
      customerName: true,
      customerTaxId: true,
      customerAddress: true,
      customerEmail: true,
      subtotalCents: true,
      discountCents: true,
      taxableCents: true,
      taxCents: true,
      totalCents: true,
      exemptionNote: true,
      notes: true,
      rectifies: { select: { id: true, reference: true } },
      rectifiedBy: { select: { id: true, reference: true } },
      lines: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          unitCents: true,
          taxRate: true,
          baseCents: true,
          taxCents: true,
          totalCents: true,
        },
      },
    },
  });

  if (!factura) notFound();

  const estado = ESTADO[factura.status] ?? ESTADO.DRAFT;
  const puedeEscribir = ctx.permissions.has("payments.write");

  // Desglose por tipo de IVA. Es obligatorio cuando hay más de un tipo en la
  // misma factura, y aclara siempre.
  const porTipo = new Map<number, { base: number; cuota: number }>();
  for (const linea of factura.lines) {
    const tipo = Number(linea.taxRate);
    const actual = porTipo.get(tipo) ?? { base: 0, cuota: 0 };
    actual.base += linea.baseCents;
    actual.cuota += linea.taxCents;
    porTipo.set(tipo, actual);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/gestion/facturas"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Facturas
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={estado.tone}>{estado.label}</Badge>

          {puedeEscribir && factura.status === "ISSUED" ? (
            <>
              <form action={markInvoicePaidAction}>
                <input type="hidden" name="invoiceId" value={factura.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Marcar cobrada
                </Button>
              </form>
              <Rectificar
                invoiceId={factura.id}
                referencia={factura.reference ?? ""}
              />
            </>
          ) : null}

          <BotonImprimir />
        </div>
      </div>

      {factura.rectifies ? (
        <Card className="border-caution/40 print:hidden">
          <CardContent className="p-4 pt-4 text-sm text-ink">
            Esta es una factura rectificativa de{" "}
            <Link
              href={`/gestion/facturas/${factura.rectifies.id}`}
              className="text-accent underline-offset-2 hover:underline"
            >
              {factura.rectifies.reference}
            </Link>
            .
          </CardContent>
        </Card>
      ) : null}

      {factura.rectifiedBy.length > 0 ? (
        <Card className="border-critical/30 print:hidden">
          <CardContent className="p-4 pt-4 text-sm text-ink">
            Esta factura está anulada por{" "}
            {factura.rectifiedBy.map((r) => (
              <Link
                key={r.id}
                href={`/gestion/facturas/${r.id}`}
                className="text-accent underline-offset-2 hover:underline"
              >
                {r.reference}
              </Link>
            ))}
            .
          </CardContent>
        </Card>
      ) : null}

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-8 p-8 pt-8">
          <header className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {factura.rectifies ? "Factura rectificativa" : "Factura"}
              </p>
              <p className="font-display text-2xl font-semibold text-ink">
                {factura.reference ?? "Sin numerar"}
              </p>
              <p className="text-sm text-ink-muted">
                Fecha de expedición: {formatDate(factura.issuedOn)}
                {factura.dueOn ? ` · Vencimiento: ${formatDate(factura.dueOn)}` : ""}
              </p>
            </div>

            <div className="text-right text-sm">
              <p className="font-semibold text-ink">{factura.issuerName}</p>
              {factura.issuerTaxId ? (
                <p className="text-ink-soft">NIF: {factura.issuerTaxId}</p>
              ) : null}
              {factura.issuerAddress ? (
                <p className="text-ink-muted">{factura.issuerAddress}</p>
              ) : null}
              {factura.issuerEmail ? (
                <p className="text-ink-muted">{factura.issuerEmail}</p>
              ) : null}
            </div>
          </header>

          <section className="rounded-[var(--radius-control)] border border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Cliente
            </p>
            <p className="mt-1 font-medium text-ink">{factura.customerName}</p>
            {factura.customerTaxId ? (
              <p className="text-sm text-ink-soft">NIF: {factura.customerTaxId}</p>
            ) : (
              <p className="text-sm text-caution print:hidden">
                Sin NIF. Si el alumno la necesita para deducirla, pídeselo, añádelo
                a su ficha y emite una rectificativa.
              </p>
            )}
            {factura.customerAddress ? (
              <p className="text-sm text-ink-muted">{factura.customerAddress}</p>
            ) : null}
          </section>

          <section className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong">
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Descripción
                  </th>
                  <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Cant.
                  </th>
                  <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Precio
                  </th>
                  <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    IVA
                  </th>
                  <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Base
                  </th>
                </tr>
              </thead>
              <tbody>
                {factura.lines.map((linea) => (
                  <tr key={linea.id} className="border-b border-line">
                    <td className="py-2.5 text-ink">{linea.description}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-soft">
                      {Number(linea.quantity)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-ink-soft">
                      {formatCents(linea.unitCents)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-ink-soft">
                      {Number(linea.taxRate)} %
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium text-ink">
                      {formatCents(linea.baseCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <Fila etiqueta="Subtotal" valor={formatCents(factura.subtotalCents)} />
              {factura.discountCents > 0 ? (
                <Fila
                  etiqueta="Descuento"
                  valor={`− ${formatCents(factura.discountCents)}`}
                />
              ) : null}
              <Fila
                etiqueta="Base imponible"
                valor={formatCents(factura.taxableCents)}
              />

              {[...porTipo.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([tipo, v]) => (
                  <Fila
                    key={tipo}
                    etiqueta={`IVA ${tipo} % sobre ${formatCents(v.base)}`}
                    valor={formatCents(v.cuota)}
                  />
                ))}

              <div className="flex items-center justify-between border-t border-line-strong pt-2 text-base font-semibold text-ink">
                <span>Total</span>
                <span className="tabular-nums">{formatCents(factura.totalCents)}</span>
              </div>
            </div>
          </section>

          {factura.exemptionNote ? (
            <p className="border-t border-line pt-4 text-xs leading-relaxed text-ink-soft">
              {factura.exemptionNote}
            </p>
          ) : null}

          {factura.notes ? (
            <p className="text-xs leading-relaxed text-ink-muted">{factura.notes}</p>
          ) : null}

          {factura.paidOn ? (
            <p className="text-xs text-positive">
              Cobrada el {formatDate(factura.paidOn)}.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-ink-soft">
      <span>{etiqueta}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}
