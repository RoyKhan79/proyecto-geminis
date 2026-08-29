import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Receipt } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { formatCents, formatDate } from "@/lib/utils";
import { SeriesForm } from "./series-form";
import { FacturacionMensual } from "./mensual";

export const metadata: Metadata = { title: "Facturas" };

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
 * Facturación.
 *
 * Lo que hace distinta a esta pantalla de la de pagos: un pago es dinero que
 * entra; una factura es un documento con requisitos legales, número correlativo
 * y desglose de impuestos. Se parecen, pero no son lo mismo, y confundirlos es
 * lo que hace que después no cuadre la declaración.
 */
export default async function FacturasPage() {
  const ctx = await requirePagePermission("payments.read");
  const anio = new Date().getFullYear();

  const [facturas, series, academia, sinFacturar] = await Promise.all([
    ctx.db.invoice.findMany({
      orderBy: [{ issuedOn: "desc" }, { number: "desc" }],
      take: 100,
      select: {
        id: true,
        reference: true,
        status: true,
        issuedOn: true,
        customerName: true,
        taxableCents: true,
        taxCents: true,
        totalCents: true,
        rectifiesId: true,
      },
    }),
    ctx.db.invoiceSeries.findMany({
      orderBy: [{ year: "desc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        year: true,
        lastNumber: true,
        isDefault: true,
        isRectifying: true,
      },
    }),
    ctx.db.academy.findUnique({
      where: { id: ctx.academy.id },
      select: { taxId: true, legalName: true, name: true },
    }),
    ctx.db.payment.count({ where: { deletedAt: null, invoices: { none: {} } } }),
  ]);

  const puedeEscribir = ctx.permissions.has("payments.write");
  const emitidas = facturas.filter((f) => f.status !== "DRAFT");
  const facturado = emitidas.reduce((s, f) => s + f.totalCents, 0);
  const ivaRepercutido = emitidas.reduce((s, f) => s + f.taxCents, 0);

  return (
    <>
      <PageHeader
        title="Facturas"
        description="Numeración correlativa, desglose de IVA y rectificativas. Una factura emitida no se edita: se rectifica."
        actions={
          <Button asChild variant="secondary">
            <Link href="/gestion/pagos">
              <Receipt aria-hidden />
              Pagos
            </Link>
          </Button>
        }
      />

      {!academia?.taxId ? (
        <Card className="border-caution/40">
          <CardContent className="p-4 pt-4 text-sm text-ink">
            Falta el <strong>NIF de la academia</strong>. Una factura sin el NIF de
            quien la emite no es válida. Complétalo en{" "}
            <Link href="/gestion/pagos/remesas" className="text-accent underline-offset-2 hover:underline">
              Pagos → Remesas
            </Link>
            .
          </CardContent>
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica label="Facturas emitidas" valor={String(emitidas.length)} />
        <Metrica label="Facturado" valor={formatCents(facturado)} />
        <Metrica label="IVA repercutido" valor={formatCents(ivaRepercutido)} />
        <Metrica label="Recibos sin factura" valor={String(sinFacturar)} />
      </section>

      {puedeEscribir ? (
        <>
          <SeriesForm series={series} anio={anio} />
          <FacturacionMensual
            series={series
              .filter((s) => !s.isRectifying)
              .map((s) => ({ id: s.id, etiqueta: `${s.code} · ${s.year}` }))}
          />
        </>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Facturas emitidas</h2>
          <span className="text-xs text-ink-muted">{facturas.length} últimas</span>
        </div>

        {facturas.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="Todavía no has emitido ninguna factura"
            description="Crea una serie y usa «Facturar el mes» para emitirlas de golpe."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Número</Th>
                <Th>Fecha</Th>
                <Th>Cliente</Th>
                <Th className="hidden sm:table-cell">Base</Th>
                <Th className="hidden sm:table-cell">IVA</Th>
                <Th>Total</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((factura) => {
                const estado = ESTADO[factura.status] ?? ESTADO.DRAFT;
                return (
                  <tr key={factura.id}>
                    <Td>
                      <Link
                        href={`/gestion/facturas/${factura.id}`}
                        className="font-medium text-accent underline-offset-2 hover:underline"
                      >
                        {factura.reference ?? "Sin numerar"}
                      </Link>
                      {factura.rectifiesId ? (
                        <span className="ml-1 text-xs text-ink-muted">(rectificativa)</span>
                      ) : null}
                    </Td>
                    <Td className="text-ink-soft">{formatDate(factura.issuedOn)}</Td>
                    <Td className="text-ink">{factura.customerName}</Td>
                    <Td className="hidden tabular-nums text-ink-soft sm:table-cell">
                      {formatCents(factura.taxableCents)}
                    </Td>
                    <Td className="hidden tabular-nums text-ink-soft sm:table-cell">
                      {formatCents(factura.taxCents)}
                    </Td>
                    <Td className="tabular-nums font-medium text-ink">
                      {formatCents(factura.totalCents)}
                    </Td>
                    <Td>
                      <Badge tone={estado.tone}>{estado.label}</Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}

function Metrica({ label, valor }: { label: string; valor: string }) {
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-ink">{valor}</p>
      </CardContent>
    </Card>
  );
}
