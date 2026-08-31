import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Landmark } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { setPaymentStatusAction } from "@/server/payments/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { formatCents, formatDate } from "@/lib/utils";
import type { PaymentStatus } from "@/generated/prisma/enums";
import { PaymentForm } from "./payment-form";
import { FacturarRecibo } from "./facturar-recibo";

export const metadata: Metadata = { title: "Pagos" };

const ESTADO: Record<
  PaymentStatus,
  { label: string; tone: "neutral" | "positive" | "caution" | "critical" }
> = {
  PENDING: { label: "Pendiente", tone: "caution" },
  PAID: { label: "Pagado", tone: "positive" },
  FAILED: { label: "Devuelto", tone: "critical" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
};

const METODO: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  SEPA_DIRECT_DEBIT: "Domiciliado",
  OTHER: "Otro",
};

/**
 * El estado de cuentas: quién ha pagado, quién debe y qué se ha devuelto.
 *
 * Marcar un recibo como devuelto suspende el acceso del alumno, que es lo que
 * hace que esta lista sirva para algo y no sea solo un registro.
 */
export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePagePermission("payments.read");
  const params = await searchParams;

  const bruto = typeof params.estado === "string" ? params.estado : "ALL";
  const estado: PaymentStatus | "ALL" =
    bruto in ESTADO ? (bruto as PaymentStatus) : "ALL";

  const [pagos, alumnos, resumen] = await Promise.all([
    ctx.db.payment.findMany({
      where: {
        deletedAt: null,
        ...(estado !== "ALL" ? { status: estado } : {}),
      },
      orderBy: { dueDate: "desc" },
      take: 200,
      select: {
        id: true,
        concept: true,
        amountCents: true,
        status: true,
        method: true,
        dueDate: true,
        paidAt: true,
        receiptNo: true,
        // Solo cuentan las que siguen en vigor: una rectificada está anulada y
        // el recibo vuelve a estar pendiente de facturar.
        invoices: {
          where: { status: { not: "RECTIFIED" } },
          select: { id: true, reference: true },
          take: 1,
        },
        student: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    ctx.db.membership.findMany({
      where: { deletedAt: null, studentProfile: { isNot: null } },
      orderBy: { user: { lastName: "asc" } },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    ctx.db.payment.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  const cobrado =
    resumen.find((r) => r.status === "PAID")?._sum.amountCents ?? 0;
  const pendiente =
    resumen.find((r) => r.status === "PENDING")?._sum.amountCents ?? 0;
  const devuelto =
    resumen.find((r) => r.status === "FAILED")?._sum.amountCents ?? 0;

  const puedeEscribir = ctx.permissions.has("payments.write");

  // Las series de facturación, para poder facturar un recibo sin salir de aquí.
  const series = puedeEscribir
    ? (
        await ctx.db.invoiceSeries.findMany({
          where: { isRectifying: false },
          orderBy: [{ year: "desc" }, { code: "asc" }],
          select: { id: true, code: true, year: true },
        })
      ).map((serie) => ({ id: serie.id, etiqueta: `${serie.code} · ${serie.year}` }))
    : [];

  return (
    <>
      <PageHeader
        title="Pagos"
        description="Recibos y control de cobros. Las cuotas mensuales se emiten desde Remesas."
        actions={
          puedeEscribir ? (
            <>
              <Button asChild variant="secondary">
                <Link href="/gestion/pagos/remesas">
                  <Landmark aria-hidden />
                  Remesas
                </Link>
              </Button>
              <PaymentForm
              alumnos={alumnos.map((a) => ({
                id: a.id,
                nombre: `${a.user.firstName} ${a.user.lastName ?? ""}`.trim(),
              }))}
              />
            </>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Resumen label="Cobrado" valor={formatCents(cobrado)} tono="positive" />
        <Resumen label="Pendiente" valor={formatCents(pendiente)} tono="caution" />
        <Resumen label="Devuelto" valor={formatCents(devuelto)} tono="critical" />
      </section>

      <form className="flex gap-2">
        <Select name="estado" defaultValue={estado} aria-label="Estado" className="sm:w-56">
          <option value="ALL">Todos los estados</option>
          {Object.entries(ESTADO).map(([value, config]) => (
            <option key={value} value={value}>
              {config.label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <Card className="overflow-hidden">
        {pagos.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="size-5" />}
            title="No hay recibos"
            description="Registra el primer cobro para empezar a llevar el control."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Recibo</Th>
                <Th>Alumno</Th>
                <Th className="hidden md:table-cell">Concepto</Th>
                <Th>Importe</Th>
                <Th className="hidden sm:table-cell">Vencimiento</Th>
                <Th>Estado</Th>
                {puedeEscribir ? <Th>Acciones</Th> : null}
              </tr>
            </thead>
            <tbody>
              {pagos.map((pago) => {
                const config = ESTADO[pago.status];
                return (
                  <tr key={pago.id} className="hover:bg-surface-muted">
                    <Td className="text-xs tabular-nums text-ink-muted">
                      {pago.receiptNo ?? "—"}
                    </Td>
                    <Td>
                      <Link
                        href={`/gestion/alumnos/${pago.student.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {pago.student.user.firstName} {pago.student.user.lastName ?? ""}
                      </Link>
                    </Td>
                    <Td className="hidden text-ink-soft md:table-cell">
                      <span className="block">{pago.concept}</span>
                      <span className="text-xs text-ink-muted">
                        {METODO[pago.method] ?? pago.method}
                      </span>
                    </Td>
                    <Td className="font-medium tabular-nums text-ink">
                      {formatCents(pago.amountCents)}
                    </Td>
                    <Td className="hidden text-ink-soft sm:table-cell">
                      {formatDate(pago.dueDate)}
                    </Td>
                    <Td>
                      <Badge tone={config.tone}>{config.label}</Badge>
                    </Td>
                    {puedeEscribir ? (
                      <Td>
                        <div className="flex gap-1">
                          {pago.status !== "PAID" ? (
                            <form action={setPaymentStatusAction}>
                              <input type="hidden" name="paymentId" value={pago.id} />
                              <input type="hidden" name="status" value="PAID" />
                              <Button type="submit" size="sm" variant="secondary">
                                Cobrado
                              </Button>
                            </form>
                          ) : null}
                          {pago.status === "PENDING" ? (
                            <form action={setPaymentStatusAction}>
                              <input type="hidden" name="paymentId" value={pago.id} />
                              <input type="hidden" name="status" value="FAILED" />
                              <input type="hidden" name="suspenderAcceso" value="1" />
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                title="Marca el recibo como devuelto y suspende el acceso del alumno"
                              >
                                Devuelto
                              </Button>
                            </form>
                          ) : null}
                          {/*
                            Facturar sin esperar al cierre del mes. Si ya tiene
                            factura en vigor, se enseña cuál en lugar del botón:
                            la pregunta que trae a alguien a esta fila suele ser
                            «¿esto está facturado?».
                          */}
                          {pago.invoices.length > 0 ? (
                            <Link
                              href={`/gestion/facturas/${pago.invoices[0].id}`}
                              className="self-center text-xs font-medium text-accent hover:underline"
                            >
                              {pago.invoices[0].reference ?? "Ver factura"}
                            </Link>
                          ) : (
                            <FacturarRecibo paymentId={pago.id} series={series} />
                          )}
                        </div>
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="border-dashed">
        <CardContent className="p-4 pt-4">
          <p className="text-xs text-ink-muted">
            Marcar un recibo como devuelto suspende el acceso del alumno, y cobrarlo
            se lo devuelve. Es una decisión de la academia, nunca automática: hay
            impagos que son un error del banco.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function Resumen({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: string;
  tono: "positive" | "caution" | "critical";
}) {
  const color = {
    positive: "text-positive",
    caution: "text-caution",
    critical: "text-critical",
  }[tono];

  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className={`text-xl font-semibold tabular-nums ${color}`}>{valor}</p>
      </CardContent>
    </Card>
  );
}
