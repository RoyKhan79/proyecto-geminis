import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Send } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { cargarMorosidad, type SituacionAlumno } from "@/server/billing/morosidad";
import { reclamarAlumnoAction } from "@/server/billing/actions";
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

export const metadata: Metadata = { title: "Quién debe" };

/**
 * QUIÉN PAGA Y QUIÉN NO
 *
 * La pantalla del día 5. Contesta tres cosas en este orden: cuánto se debe, a
 * quién hay que reclamar hoy, y de quién no hay que preocuparse.
 *
 * La columna «qué pasa ahora» sale de la misma función que ejecuta la tarea
 * diaria, así que lo que promete es exactamente lo que va a hacer.
 */

const SITUACION: Record<
  SituacionAlumno,
  { label: string; tone: "positive" | "neutral" | "caution" | "critical"; explica: string }
> = {
  "al-dia": {
    label: "Al día",
    tone: "positive",
    explica: "No debe nada vencido.",
  },
  reciente: {
    label: "Vencido hace poco",
    tone: "neutral",
    explica:
      "Ha vencido hace muy poco. Todavía no se le reclama: si está domiciliado, puede ser un cargo que el banco está procesando.",
  },
  reclamar: {
    label: "Hay que reclamar",
    tone: "caution",
    explica: "Lleva bastante sin pagar y ya se le está reclamando.",
  },
  suspendido: {
    label: "Acceso pausado",
    tone: "critical",
    explica: "Se le ha cortado el acceso. Vuelve solo en cuanto pague.",
  },
};

const METODO: Record<string, string> = {
  SEPA_DIRECT_DEBIT: "Domiciliado",
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

export default async function MorosidadPage() {
  const ctx = await requirePagePermission("payments.read");

  const academia = await ctx.db.academy.findUnique({
    where: { id: ctx.academy.id },
    select: {
      dunningEnabled: true,
      dunningFirstDays: true,
      dunningEveryDays: true,
      dunningSuspendDays: true,
    },
  });

  const { filas, totales } = await cargarMorosidad(
    ctx.db,
    academia ?? {
      dunningEnabled: false,
      dunningFirstDays: 3,
      dunningEveryDays: 7,
      dunningSuspendDays: 30,
    },
  );

  const puedeEscribir = ctx.permissions.has("payments.write");
  const conDeuda = filas.filter((f) => f.situacion !== "al-dia");
  const alDia = filas.filter((f) => f.situacion === "al-dia");

  return (
    <>
      <PageHeader
        title="Quién debe"
        description="Cuánto se debe, a quién hay que reclamar hoy y de quién no hay que preocuparse."
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

      <section
        aria-label="Resumen"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <Recuadro
          etiqueta="Se debe"
          valor={formatCents(totales.deudaCents)}
          tono="critical"
        />
        <Recuadro etiqueta="Hay que reclamar" valor={totales.reclamar} tono="caution" />
        <Recuadro etiqueta="Acceso pausado" valor={totales.suspendidos} tono="critical" />
        <Recuadro etiqueta="Al día" valor={totales.alDia} tono="positive" />
      </section>

      {!academia?.dunningEnabled ? (
        <Card className="border-caution">
          <CardContent className="p-4 pt-4 text-sm leading-relaxed text-ink-soft">
            Los avisos automáticos están apagados: nadie va a recibir nada ni se
            le va a pausar el acceso a nadie.{" "}
            <Link
              href="/gestion/pagos/remesas"
              className="font-medium text-accent hover:underline"
            >
              Encenderlos en Remesas →
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {conDeuda.length === 0 ? (
            <EmptyState
              title="No debe nadie"
              description="Todos los alumnos están al día. Nada que reclamar."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Alumno</Th>
                  <Th>Situación</Th>
                  <Th className="text-right">Debe</Th>
                  <Th className="hidden text-right sm:table-cell">Retraso</Th>
                  <Th className="hidden md:table-cell">Cómo paga</Th>
                  <Th className="hidden lg:table-cell">Último aviso</Th>
                  <Th>Qué pasa ahora</Th>
                  {puedeEscribir ? <Th /> : null}
                </tr>
              </thead>
              <tbody>
                {conDeuda.map((fila) => {
                  const situacion = SITUACION[fila.situacion];
                  return (
                    <tr key={fila.membershipId}>
                      <Td>
                        <Link
                          href={`/gestion/alumnos/${fila.membershipId}`}
                          className="font-medium text-ink hover:text-accent hover:underline"
                        >
                          {fila.nombre}
                        </Link>
                        <span className="block text-xs text-ink-muted">
                          {fila.recibosVencidos}{" "}
                          {fila.recibosVencidos === 1 ? "recibo" : "recibos"}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={situacion.tone} title={situacion.explica}>
                          {situacion.label}
                        </Badge>
                      </Td>
                      <Td className="text-right font-medium tabular-nums text-ink">
                        {formatCents(fila.deudaCents)}
                      </Td>
                      <Td className="hidden text-right tabular-nums text-ink-soft sm:table-cell">
                        {fila.diasDeRetraso} d
                      </Td>
                      <Td className="hidden text-ink-soft md:table-cell">
                        {fila.metodo ? METODO[fila.metodo] ?? fila.metodo : "—"}
                      </Td>
                      <Td className="hidden text-xs text-ink-muted lg:table-cell">
                        {fila.ultimoAviso ? (
                          <>
                            {formatDate(fila.ultimoAviso)}
                            <span className="block">
                              {fila.avisosEnviados}{" "}
                              {fila.avisosEnviados === 1 ? "aviso" : "avisos"}
                            </span>
                          </>
                        ) : (
                          "Todavía ninguno"
                        )}
                      </Td>
                      <Td className="text-xs leading-snug text-ink-soft">
                        {fila.proximoPaso}
                      </Td>
                      {puedeEscribir ? (
                        <Td>
                          <form action={reclamarAlumnoAction}>
                            <input
                              type="hidden"
                              name="membershipId"
                              value={fila.membershipId}
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              title="Le manda ahora el aviso de impago. No le pausa el acceso."
                            >
                              <Send aria-hidden />
                              Reclamar
                            </Button>
                          </form>
                        </Td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/*
        Los que van bien, aparte y sin ruido. Están porque la pregunta no es solo
        «a quién reclamo»: también es poder decir «del resto no te preocupes».
      */}
      {alDia.length > 0 ? (
        <Card>
          <CardContent className="space-y-2 p-5 pt-5">
            <p className="text-sm font-semibold text-ink">
              Al día · {alDia.length}{" "}
              {alDia.length === 1 ? "alumno" : "alumnos"}
            </p>
            <p className="text-sm leading-relaxed text-ink-muted">
              {alDia
                .slice(0, 12)
                .map((f) => f.nombre)
                .join(" · ")}
              {alDia.length > 12 ? ` y ${alDia.length - 12} más.` : "."}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function Recuadro({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: string | number;
  tono: "positive" | "caution" | "critical";
}) {
  const color =
    valor === 0
      ? "text-ink-muted"
      : tono === "positive"
        ? "text-positive"
        : tono === "caution"
          ? "text-caution"
          : "text-critical";

  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <p className="text-[0.8125rem] font-medium leading-snug text-ink-muted">
          {etiqueta}
        </p>
        <p className={`cifra mt-1.5 text-[1.75rem] ${color}`}>{valor}</p>
      </CardContent>
    </Card>
  );
}
