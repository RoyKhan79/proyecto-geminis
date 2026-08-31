import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  BrainCircuit,
  ListChecks,
  Shuffle,
  Target,
  Timer,
  TrendingDown,
} from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { startAttemptAction } from "@/server/assessment/actions";
import {
  countDueForReview,
  countWrongQuestions,
  loadAttempts,
  loadStudentTestTopics,
  loadWeakTopics,
} from "@/server/assessment/queries";
import { loadGrants } from "@/server/campus/queries";
import { loadStudentSimulations } from "@/server/simulations/queries";
import { startSimulationAction } from "@/server/simulations/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  IconTile,
  Select,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { CampusTitulo } from "@/components/campus/titulo";

export const metadata: Metadata = { title: "Tests" };

const MODO_LABEL: Record<string, string> = {
  TOPIC: "Por tema",
  RANDOM: "Aleatorio",
  ERRORS: "Mis errores",
  REVIEW: "Repaso programado",
  CUSTOM: "Personalizado",
  SIMULATION: "Simulacro",
};

/**
 * Los tests del alumno: lo que puede practicar por su cuenta y lo que convoca
 * la academia.
 *
 * Los simulacros que aparecen son solo los de SU oposición.
 */
export default async function CampusTestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const aviso =
    typeof (await searchParams).aviso === "string"
      ? ((await searchParams).aviso as string)
      : null;
  const ctx = await requireAcademy();
  const grants = await loadGrants(ctx.academy.id, ctx.membershipId);

  const [temas, intentos, debiles, falladas, simulacros, pendientesRepaso] =
    await Promise.all([
      loadStudentTestTopics(ctx.db, grants),
      loadAttempts(ctx.db, ctx.membershipId, 10),
      loadWeakTopics(ctx.db, ctx.membershipId),
      countWrongQuestions(ctx.db, ctx.membershipId),
      loadStudentSimulations(ctx.db, ctx.membershipId),
      countDueForReview(ctx.db, ctx.membershipId),
    ]);

  const totalPreguntas = temas.reduce((suma, t) => suma + t._count.questions, 0);

  return (
    <>
      <CampusTitulo>Tests</CampusTitulo>

      {aviso ? (
        <div
          role="status"
          className="rounded-[var(--radius-control)] bg-caution-soft px-3 py-2.5 text-sm text-caution"
        >
          {aviso}
        </div>
      ) : null}

      {temas.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="size-5" />}
            title="Todavía no tienes tests disponibles"
            description="Aparecerán aquí cuando tu academia publique preguntas de los temas que tienes contratados."
          />
        </Card>
      ) : (
        <>
          {pendientesRepaso > 0 ? (
            <Card className="border-accent">
              <CardContent className="space-y-3 p-4 pt-4">
                <div className="flex items-center gap-2">
                  <IconTile tone="violet" size="sm">
                    <BrainCircuit />
                  </IconTile>
                  <p className="text-sm font-medium text-ink">
                    Repaso de hoy · {pendientesRepaso}{" "}
                    {pendientesRepaso === 1 ? "pregunta" : "preguntas"}
                  </p>
                </div>
                <p className="text-xs text-ink-muted">
                  Geminis lleva la cuenta de cuándo estás a punto de olvidar cada
                  pregunta y te las devuelve justo a tiempo. Es la forma de que lo
                  del tema 1 siga en pie el día del examen.
                </p>
                <form action={startAttemptAction}>
                  <input type="hidden" name="modo" value="REVIEW" />
                  <input
                    type="hidden"
                    name="cantidad"
                    value={Math.min(30, Math.max(5, pendientesRepaso))}
                  />
                  <Button type="submit" size="sm" className="w-full">
                    Empezar el repaso
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="space-y-4 p-4 pt-4">
              <div className="flex items-center gap-2">
                <IconTile tone="sky" size="sm">
                  <Target />
                </IconTile>
                <p className="text-sm font-medium text-ink">Test por tema</p>
              </div>

              <form action={startAttemptAction} className="space-y-3">
                <input type="hidden" name="modo" value="TOPIC" />
                <Select name="nodeId" aria-label="Tema" required>
                  {temas.map((tema) => (
                    <option key={tema.id} value={tema.id}>
                      {tema.label} ({tema._count.questions})
                    </option>
                  ))}
                </Select>
                <div className="flex gap-2">
                  <Select name="cantidad" defaultValue="10" aria-label="Número de preguntas">
                    <option value="5">5 preguntas</option>
                    <option value="10">10 preguntas</option>
                    <option value="20">20 preguntas</option>
                    <option value="30">30 preguntas</option>
                  </Select>
                  <Button type="submit" className="shrink-0">
                    Empezar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 p-4 pt-4">
                <div className="flex items-center gap-2">
                  <IconTile tone="teal" size="sm">
                    <Shuffle />
                  </IconTile>
                  <p className="text-sm font-medium text-ink">Test aleatorio</p>
                </div>
                <p className="text-xs text-ink-muted">
                  Preguntas de todos tus temas ({totalPreguntas} disponibles).
                </p>
                <form action={startAttemptAction}>
                  <input type="hidden" name="modo" value="RANDOM" />
                  <input type="hidden" name="cantidad" value="20" />
                  <Button type="submit" variant="secondary" size="sm" className="w-full">
                    20 preguntas al azar
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className={falladas > 0 ? "border-caution" : undefined}>
              <CardContent className="space-y-3 p-4 pt-4">
                <div className="flex items-center gap-2">
                  <IconTile tone="amber" size="sm">
                    <AlertTriangle />
                  </IconTile>
                  <p className="text-sm font-medium text-ink">Test de mis errores</p>
                </div>
                <p className="text-xs text-ink-muted">
                  {falladas > 0
                    ? `Tienes ${falladas} preguntas falladas alguna vez.`
                    : "Cuando falles preguntas, podrás repasarlas aquí."}
                </p>
                <form action={startAttemptAction}>
                  <input type="hidden" name="modo" value="ERRORS" />
                  <input type="hidden" name="cantidad" value="20" />
                  <Button
                    type="submit"
                    variant={falladas > 0 ? "primary" : "secondary"}
                    size="sm"
                    className="w-full"
                    disabled={falladas === 0}
                  >
                    Repasar errores
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {simulacros.length > 0 ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Timer className="size-4 text-ink-muted" aria-hidden />
            Simulacros
          </h2>
          {simulacros.map((simulacro) => (
            <Card key={simulacro.id} className="border-accent">
              <CardContent className="space-y-3 p-4 pt-4">
                <div>
                  <p className="font-medium text-ink">{simulacro.title}</p>
                  <p className="text-xs text-ink-muted">
                    {[
                      `${simulacro.questionCount} preguntas`,
                      simulacro.timeLimitMinutes
                        ? `${simulacro.timeLimitMinutes} minutos`
                        : null,
                      Number(simulacro.penaltyPerWrong) > 0
                        ? `cada fallo resta ${Number(simulacro.penaltyPerWrong)
                            .toString()
                            .replace(".", ",")}`
                        : "sin penalización",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {simulacro.description ? (
                    <p className="mt-1 text-sm text-ink-muted">
                      {simulacro.description}
                    </p>
                  ) : null}
                </div>

                {simulacro.mejorNota !== null ? (
                  <p className="text-xs text-ink-muted">
                    Tu mejor resultado: {Math.round(simulacro.mejorNota)}% ·{" "}
                    {simulacro.intentosHechos}{" "}
                    {simulacro.intentosHechos === 1 ? "intento" : "intentos"}
                  </p>
                ) : null}

                <form action={startSimulationAction}>
                  <input type="hidden" name="simulationId" value={simulacro.id} />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={simulacro.agotado}
                  >
                    {simulacro.agotado
                      ? "Has agotado tus intentos"
                      : simulacro.intentosHechos > 0
                        ? "Repetir simulacro"
                        : "Empezar simulacro"}
                  </Button>
                </form>

                <p className="text-xs text-ink-muted">
                  Una vez empezado corre el tiempo. Hazlo cuando puedas estar sin
                  interrupciones.
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      {debiles.length > 0 ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <TrendingDown className="size-4 text-ink-muted" aria-hidden />
            Dónde flojeas
          </h2>
          <Card className="divide-y divide-[var(--border-subtle)]">
            {debiles.slice(0, 5).map((tema) => (
              <div key={tema.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{tema.label}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={
                        tema.aciertoPorcentaje >= 70
                          ? "h-full rounded-full bg-positive"
                          : tema.aciertoPorcentaje >= 50
                            ? "h-full rounded-full bg-caution"
                            : "h-full rounded-full bg-critical"
                      }
                      style={{ width: `${tema.aciertoPorcentaje}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums text-ink">
                  {tema.aciertoPorcentaje}%
                </span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {intentos.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">Tus últimos tests</h2>
          <Card className="divide-y divide-[var(--border-subtle)]">
            {intentos.map((intento) => (
              <Link
                key={intento.id}
                href={`/campus/tests/${intento.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {MODO_LABEL[intento.kind] ?? intento.kind}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDateTime(intento.startedAt)}
                  </p>
                </div>
                {intento.status === "IN_PROGRESS" ? (
                  <Badge tone="caution">Sin terminar</Badge>
                ) : (
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-ink">
                      {intento.correctCount}/{intento.totalQuestions}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {Number(intento.scorePercent ?? 0).toFixed(0)}%
                    </p>
                  </div>
                )}
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
