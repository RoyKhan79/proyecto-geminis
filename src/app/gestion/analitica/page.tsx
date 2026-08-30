import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  TrendingDown,
  Users,
} from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  loadPreguntasARevisar,
  loadResumenAcademia,
  loadRiesgoAbandono,
  loadTemasProblematicos,
  type NivelRiesgo,
} from "@/server/analytics/queries";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Analítica" };

const RIESGO: Record<
  NivelRiesgo,
  { label: string; tone: "critical" | "caution" | "info" | "positive"; punto: string }
> = {
  ALTO: { label: "Atención urgente", tone: "critical", punto: "🔴" },
  MEDIO: { label: "Vigilar", tone: "caution", punto: "🟠" },
  BAJO: { label: "Leve", tone: "info", punto: "🟡" },
  OK: { label: "Al día", tone: "positive", punto: "🟢" },
};

/**
 * Analítica de la academia.
 *
 * Lo importante no son los totales de arriba: es la lista de quién necesita
 * atención, con el motivo. Un número de riesgo sin explicación no sirve para
 * llamar a nadie.
 */
export default async function AnaliticaPage() {
  const ctx = await requirePagePermission("analytics.read");

  const [resumen, riesgo, temas, preguntas] = await Promise.all([
    loadResumenAcademia(ctx.db),
    loadRiesgoAbandono(ctx.db),
    loadTemasProblematicos(ctx.db),
    loadPreguntasARevisar(ctx.db),
  ]);

  const requierenAtencion = riesgo.filter((a) => a.nivel !== "OK");

  return (
    <>
      <PageHeader
        title="Analítica"
        description="Lo que de verdad hace falta saber: quién se está desenganchando y qué se atraganta."
      />

      <section
        aria-label="Cifras generales"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Metrica label="Alumnos activos" valor={resumen.alumnosActivos} />
        <Metrica label="Altas (30 días)" valor={resumen.altas30} tono="positive" />
        <Metrica
          label="Activos esta semana"
          valor={`${resumen.participacion}%`}
          pie={`${resumen.activosSemana} de ${resumen.alumnosActivos}`}
        />
        <Metrica
          label="Media de resultados"
          valor={resumen.mediaResultados !== null ? `${resumen.mediaResultados}%` : "—"}
          pie="últimos 30 días"
        />
        <Metrica label="Tests esta semana" valor={resumen.testsSemana} />
        <Metrica label="Clases (30 días)" valor={resumen.clases30} />
        <Metrica
          label="Pagos pendientes"
          valor={resumen.pagosPendientes}
          tono={resumen.pagosPendientes > 0 ? "critical" : undefined}
        />
        <Metrica label="Bajas (30 días)" valor={resumen.bajas30} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-caution" aria-hidden />
            Alumnos que requieren atención
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requierenAtencion.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="Nadie en riesgo ahora mismo"
              description="Todo el alumnado activo ha aparecido por el Campus recientemente."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {requierenAtencion.map((alumno) => {
                const nivel = RIESGO[alumno.nivel];
                return (
                  <li key={alumno.membershipId}>
                    <Link
                      href={`/gestion/alumnos/${alumno.membershipId}`}
                      className="flex flex-wrap items-start gap-3 px-5 py-3.5 hover:bg-surface-muted"
                    >
                      <span className="text-base" aria-hidden>
                        {nivel.punto}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{alumno.nombre}</p>
                        <ul className="mt-0.5 space-y-0.5">
                          {alumno.motivos.map((motivo) => (
                            <li key={motivo} className="text-xs text-ink-muted">
                              · {motivo}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {alumno.tendencia === "baja" ? (
                          <ArrowDownRight
                            className="size-4 text-critical"
                            aria-label="Resultados a la baja"
                          />
                        ) : alumno.tendencia === "sube" ? (
                          <ArrowUpRight
                            className="size-4 text-positive"
                            aria-label="Resultados al alza"
                          />
                        ) : alumno.tendencia === "estable" ? (
                          <Minus className="size-4 text-ink-muted" aria-hidden />
                        ) : null}
                        <Badge tone={nivel.tone}>{nivel.label}</Badge>
                      </div>

                      <p className="w-full text-xs text-ink-muted sm:w-auto">
                        Última actividad: {formatDate(alumno.ultimaActividad)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
        <div className="border-t border-line px-5 py-3">
          <p className="text-xs text-ink-muted">
            El riesgo se calcula con reglas explicables (días sin entrar, tests sin
            hacer, material sin abrir, faltas y caída de resultados). No es una
            predicción: es un aviso para que llames tú.
          </p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="size-4 text-ink-muted" aria-hidden />
              Temas que se atragantan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {temas.length === 0 ? (
              <EmptyState
                title="Aún no hay datos suficientes"
                description="Cuando el alumnado haga tests, aquí verás dónde falla."
              />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {temas.map((tema) => (
                  <li key={tema.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{tema.label}</p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className={
                            tema.acierto >= 70
                              ? "h-full rounded-full bg-positive"
                              : tema.acierto >= 50
                                ? "h-full rounded-full bg-caution"
                                : "h-full rounded-full bg-critical"
                          }
                          style={{ width: `${tema.acierto}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {tema.respuestas} respuestas
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                      {tema.acierto}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preguntas que conviene revisar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {preguntas.length === 0 ? (
              <EmptyState
                title="Ninguna pregunta sospechosa"
                description="Se señalan las que casi nadie acierta o las que acierta todo el mundo."
              />
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {preguntas.map((pregunta) => (
                  <li key={pregunta.id} className="space-y-1 px-5 py-3">
                    <p className="line-clamp-2 text-sm text-ink">{pregunta.statement}</p>
                    <p className="text-xs text-ink-muted">
                      {pregunta.node?.label ?? "Sin tema"} · {pregunta.acierto}% de
                      acierto en {pregunta.timesAnswered} respuestas
                    </p>
                    <Badge tone={pregunta.acierto < 25 ? "caution" : "neutral"}>
                      {pregunta.motivo}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Metrica({
  label,
  valor,
  pie,
  tono,
}: {
  label: string;
  valor: string | number;
  pie?: string;
  tono?: "positive" | "critical";
}) {
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <p className="text-xs text-ink-muted">{label}</p>
        <p
          className={
            tono === "critical"
              ? "text-2xl font-semibold tabular-nums text-critical"
              : tono === "positive"
                ? "text-2xl font-semibold tabular-nums text-positive"
                : "text-2xl font-semibold tabular-nums text-ink"
          }
        >
          {valor}
        </p>
        {pie ? <p className="text-xs text-ink-muted">{pie}</p> : null}
      </CardContent>
    </Card>
  );
}
