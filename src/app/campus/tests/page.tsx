import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ListChecks, Shuffle, Target, TrendingDown } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { startAttemptAction } from "@/server/assessment/actions";
import {
  countWrongQuestions,
  loadAttempts,
  loadStudentTestTopics,
  loadWeakTopics,
} from "@/server/assessment/queries";
import { loadGrants } from "@/server/campus/queries";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Select,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Tests" };

const MODO_LABEL: Record<string, string> = {
  TOPIC: "Por tema",
  RANDOM: "Aleatorio",
  ERRORS: "Mis errores",
  CUSTOM: "Personalizado",
  SIMULATION: "Simulacro",
};

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

  const [temas, intentos, debiles, falladas] = await Promise.all([
    loadStudentTestTopics(ctx.db, grants),
    loadAttempts(ctx.db, ctx.membershipId, 10),
    loadWeakTopics(ctx.db, ctx.membershipId),
    countWrongQuestions(ctx.db, ctx.membershipId),
  ]);

  const totalPreguntas = temas.reduce((suma, t) => suma + t._count.questions, 0);

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Tests</h1>

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
          <Card>
            <CardContent className="space-y-4 p-4 pt-4">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-accent" aria-hidden />
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
                  <Shuffle className="size-4 text-accent" aria-hidden />
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
                  <AlertTriangle className="size-4 text-caution" aria-hidden />
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
