import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  Landmark,
  Send,
} from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  marcarRemesaExportadaAction,
  previsualizarRemesa,
} from "@/server/billing/actions";
import { inicioDeMes, nombreDelMes } from "@/server/billing/service";
import { revisarAntesDeEnviar } from "@/lib/billing/sepa";
import { ocultarIban } from "@/lib/billing/iban";
import { descifrar } from "@/lib/crypto/field";
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
import { GenerarRemesa } from "./generar";
import { DatosAcreedorForm } from "./acreedor";

export const metadata: Metadata = { title: "Remesas" };

const ESTADO_REMESA: Record<
  string,
  { label: string; tone: "neutral" | "caution" | "positive" }
> = {
  DRAFT: { label: "Sin enviar", tone: "caution" },
  EXPORTED: { label: "Enviada al banco", tone: "positive" },
  SETTLED: { label: "Liquidada", tone: "positive" },
};

const METODO_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  SEPA_DIRECT_DEBIT: "Domiciliación",
  OTHER: "Otra",
};

/**
 * Remesas de cobro.
 *
 * Lo que esta pantalla resuelve es un día concreto: el 1 de cada mes, cuando
 * alguien de secretaría se sentaba a crear ochenta recibos iguales y a preparar
 * el fichero del banco a mano.
 */
export default async function RemesasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePagePermission("payments.read");
  const params = await searchParams;

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const periodo =
    typeof params.mes === "string" && /^\d{4}-\d{2}$/.test(params.mes)
      ? params.mes
      : mesActual;

  const [anio, mes] = periodo.split("-").map(Number);
  const primerDia = inicioDeMes(new Date(anio, mes - 1, 1));

  const [previsión, academia, remesas] = await Promise.all([
    previsualizarRemesa(periodo),
    ctx.db.academy.findUnique({
      where: { id: ctx.academy.id },
      select: {
        legalName: true,
        name: true,
        taxId: true,
        billingIban: true,
        creditorId: true,
        mandatePrefix: true,
      },
    }),
    ctx.db.directDebitRun.findMany({
      orderBy: { period: "desc" },
      take: 12,
      select: {
        id: true,
        period: true,
        chargeOn: true,
        status: true,
        totalCents: true,
        itemCount: true,
        exportedAt: true,
      },
    }),
  ]);

  const remesaDelMes = remesas.find(
    (r) => r.period.getTime() === primerDia.getTime(),
  );

  const domiciliables = previsión.filter((l) => !l.impedimento && !l.yaCobrado);
  const otros = previsión.filter((l) => l.impedimento && !l.yaCobrado);
  const yaEmitidos = previsión.filter((l) => l.yaCobrado);

  const totalDomiciliable = domiciliables.reduce((s, l) => s + l.amountCents, 0);
  const totalOtros = otros.reduce((s, l) => s + l.amountCents, 0);

  const ibanAcreedor = descifrar(academia?.billingIban ?? null);

  const avisos = revisarAntesDeEnviar({
    acreedor: {
      nombre: academia?.legalName ?? academia?.name,
      iban: ibanAcreedor ?? undefined,
      identificador: academia?.creditorId ?? undefined,
    },
    fechaCobro: remesaDelMes?.chargeOn ?? new Date(anio, mes - 1, 1),
    hoy,
  });

  const puedeEscribir = ctx.permissions.has("payments.write");

  return (
    <>
      <PageHeader
        title="Remesas de cobro"
        description="Emite las cuotas del mes y genera el fichero que subes a tu banco."
        breadcrumb={
          <Link
            href="/gestion/pagos"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Pagos
          </Link>
        }
      />

      <Card className="border-dashed">
        <CardContent className="p-4 pt-4 text-sm text-ink-soft">
          <p>
            <strong className="text-ink">Geminis no cobra el dinero.</strong> Prepara
            los recibos y genera el fichero de adeudos SEPA; el cargo lo hace tu
            banco cuando subes ese fichero. Necesitas tener firmado con él un
            contrato de adeudos y que cada alumno domiciliado haya firmado su
            mandato.
          </p>
        </CardContent>
      </Card>

      {puedeEscribir ? (
        <DatosAcreedorForm
          datos={{
            legalName: academia?.legalName ?? "",
            taxId: academia?.taxId ?? "",
            billingIban: ibanAcreedor ?? "",
            creditorId: academia?.creditorId ?? "",
            mandatePrefix: academia?.mandatePrefix ?? "",
          }}
          avisos={avisos}
        />
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-5 pt-5">
          <form className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label
                htmlFor="mes"
                className="block text-sm font-medium text-ink"
              >
                Mes a cobrar
              </label>
              <input
                id="mes"
                name="mes"
                type="month"
                defaultValue={periodo}
                className="h-10 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-ink"
              />
            </div>
            <Button type="submit" variant="secondary">
              Ver
            </Button>
          </form>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metrica
              label="Se domiciliarán"
              valor={`${domiciliables.length} · ${formatCents(totalDomiciliable)}`}
              tono="positive"
            />
            <Metrica
              label="Se cobran de otra forma"
              valor={`${otros.length} · ${formatCents(totalOtros)}`}
              tono="neutral"
            />
            <Metrica
              label="Ya emitidos este mes"
              valor={String(yaEmitidos.length)}
              tono="neutral"
            />
          </div>

          {puedeEscribir ? (
            <GenerarRemesa
              periodo={periodo}
              mes={nombreDelMes(primerDia)}
              pendientes={domiciliables.length + otros.length}
              yaExiste={Boolean(remesaDelMes)}
              bloqueada={remesaDelMes?.status !== undefined && remesaDelMes.status !== "DRAFT"}
            />
          ) : null}
        </CardContent>
      </Card>

      {previsión.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Landmark className="size-5" />}
            title={`No hay cuotas activas en ${nombreDelMes(primerDia)}`}
            description="Las cuotas se configuran en la ficha de cada alumno, en «Forma de pago»."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">
              Qué se cobra en {nombreDelMes(primerDia)}
            </h2>
            <span className="text-xs text-ink-muted">{previsión.length} alumnos</span>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Alumno</Th>
                <Th>Concepto</Th>
                <Th>Forma de pago</Th>
                <Th className="hidden sm:table-cell">Cuenta</Th>
                <Th>Importe</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {previsión.map((linea) => (
                <tr key={linea.studentId}>
                  <Td className="font-medium text-ink">{linea.nombre}</Td>
                  <Td className="text-ink-soft">{linea.concepto}</Td>
                  <Td className="text-ink-soft">
                    {METODO_LABEL[linea.metodo] ?? linea.metodo}
                  </Td>
                  <Td className="hidden font-mono text-xs text-ink-muted sm:table-cell">
                    {linea.iban ? ocultarIban(linea.iban) : "—"}
                  </Td>
                  <Td className="tabular-nums text-ink">
                    {formatCents(linea.amountCents)}
                  </Td>
                  <Td>
                    {linea.yaCobrado ? (
                      <Badge tone="neutral">Ya emitido</Badge>
                    ) : linea.impedimento ? (
                      <span
                        className="flex items-center gap-1 text-xs text-caution"
                        title={linea.impedimento}
                      >
                        <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                        {linea.impedimento}
                      </span>
                    ) : (
                      <Badge tone="positive">
                        {linea.primerCobro ? "Primer cargo" : "Se domicilia"}
                      </Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Remesas emitidas</h2>
        </div>
        {remesas.length === 0 ? (
          <EmptyState
            title="Todavía no has emitido ninguna remesa"
            description="Elige un mes arriba y pulsa «Emitir los recibos»."
          />
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {remesas.map((remesa) => {
              const estado = ESTADO_REMESA[remesa.status] ?? ESTADO_REMESA.DRAFT;
              return (
                <li
                  key={remesa.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink first-letter:uppercase">
                      {nombreDelMes(remesa.period)}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {remesa.itemCount} recibos · {formatCents(remesa.totalCents)} ·
                      cargo el {formatDate(remesa.chargeOn)}
                      {remesa.exportedAt
                        ? ` · enviada el ${formatDate(remesa.exportedAt)}`
                        : ""}
                    </p>
                  </div>

                  <Badge tone={estado.tone}>{estado.label}</Badge>

                  {puedeEscribir && remesa.itemCount > 0 ? (
                    <div className="flex items-center gap-2">
                      <Button asChild variant="secondary" size="sm">
                        <a href={`/api/remesas/${remesa.id}`} download>
                          <Download aria-hidden />
                          Descargar fichero
                        </a>
                      </Button>

                      {remesa.status === "DRAFT" ? (
                        <form action={marcarRemesaExportadaAction}>
                          <input type="hidden" name="runId" value={remesa.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            <Send aria-hidden />
                            Marcar enviada
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

function Metrica({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: string;
  tono: "positive" | "neutral";
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-line p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${
          tono === "positive" ? "text-positive" : "text-ink"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
