import type { Metadata } from "next";
import { Timer } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { toggleSimulationAction } from "@/server/simulations/actions";
import { loadSimulationPanel } from "@/server/simulations/queries";
import { Button } from "@/components/ui/button";
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
import { SimulationForms } from "./forms";

export const metadata: Metadata = { title: "Simulacros" };

/** Muestra "1/3" en lugar de 0.333, que es como lo dicen las convocatorias. */
function penalizacionLegible(valor: number): string {
  if (valor === 0) return "sin penalización";
  const fracciones: [number, string][] = [
    [1 / 2, "1/2"],
    [1 / 3, "1/3"],
    [1 / 4, "1/4"],
    [1 / 5, "1/5"],
  ];
  for (const [numero, texto] of fracciones) {
    if (Math.abs(valor - numero) < 0.01) return `−${texto} por fallo`;
  }
  return `−${valor} por fallo`;
}

export default async function SimulacrosPage() {
  const ctx = await requirePagePermission("tests.read");
  const panel = await loadSimulationPanel(ctx.db);
  const puedeEscribir = ctx.permissions.has("tests.write");
  const puedePublicar = ctx.permissions.has("tests.publish");

  return (
    <>
      <PageHeader
        title="Simulacros"
        description="Reproduce el examen real: número de preguntas, tiempo y penalización por fallo."
      />

      {puedeEscribir ? (
        <SimulationForms plantillas={panel.plantillas} ediciones={panel.ediciones} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Simulacros</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {panel.simulacros.length === 0 ? (
            <EmptyState
              icon={<Timer className="size-5" />}
              title="Todavía no hay simulacros"
              description="Crea primero una plantilla con las condiciones del examen y después monta el simulacro."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {panel.simulacros.map((simulacro) => (
                <li
                  key={simulacro.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{simulacro.title}</p>
                    <p className="text-xs text-ink-muted">
                      {[
                        `${simulacro.questionCount} preguntas`,
                        simulacro.timeLimitMinutes
                          ? `${simulacro.timeLimitMinutes} min`
                          : null,
                        penalizacionLegible(Number(simulacro.penaltyPerWrong)),
                        simulacro.blueprint?.name,
                        simulacro.maxAttempts
                          ? `máx. ${simulacro.maxAttempts} intentos`
                          : null,
                        simulacro.availableUntil
                          ? `hasta ${formatDate(simulacro.availableUntil)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {simulacro.realizados > 0 ? (
                      <p className="text-xs text-ink-muted">
                        {simulacro.realizados}{" "}
                        {simulacro.realizados === 1 ? "realizado" : "realizados"} ·
                        media {simulacro.media}%
                      </p>
                    ) : null}
                  </div>

                  <Badge
                    tone={simulacro.status === "PUBLISHED" ? "positive" : "neutral"}
                  >
                    {simulacro.status === "PUBLISHED" ? "Publicado" : "Borrador"}
                  </Badge>

                  {puedePublicar ? (
                    <form action={toggleSimulationAction}>
                      <input type="hidden" name="simulationId" value={simulacro.id} />
                      <input
                        type="hidden"
                        name="publicar"
                        value={simulacro.status === "PUBLISHED" ? "0" : "1"}
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        {simulacro.status === "PUBLISHED" ? "Retirar" : "Publicar"}
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plantillas de examen</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {panel.plantillas.length === 0 ? (
            <EmptyState
              title="Sin plantillas"
              description="Una plantilla describe cómo es el examen real: preguntas, tiempo y penalización."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {panel.plantillas.map((plantilla) => (
                <li key={plantilla.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-ink">{plantilla.name}</p>
                  <p className="text-xs text-ink-muted">
                    {[
                      `${plantilla.totalQuestions} preguntas`,
                      `${plantilla.optionsPerQuestion} opciones`,
                      `${plantilla.durationMinutes} min`,
                      penalizacionLegible(Number(plantilla.penaltyPerWrong)),
                      plantilla.passingScore
                        ? `aprueba con ${Number(plantilla.passingScore)}`
                        : null,
                      plantilla.edition
                        ? `${plantilla.edition.opposition.name} · ${plantilla.edition.name}`
                        : null,
                      plantilla._count.tests > 0
                        ? `${plantilla._count.tests} simulacros`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
