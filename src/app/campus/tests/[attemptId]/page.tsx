import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, RotateCcw, XCircle } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { calcularPercentil } from "@/server/simulations/queries";
import { ExamTimer } from "@/components/campus/exam-timer";
import { ExplainButton } from "./explain-button";
import {
  answerQuestionAction,
  submitAttemptAction,
} from "@/server/assessment/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Test" };

export default async function IntentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAcademy();
  const { attemptId } = await params;
  const query = await searchParams;

  const intento = await ctx.db.testAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      status: true,
      kind: true,
      totalQuestions: true,
      correctCount: true,
      wrongCount: true,
      blankCount: true,
      score: true,
      scorePercent: true,
      expiresAt: true,
      config: true,
      testDefinitionId: true,
      answers: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          isCorrect: true,
          selectedOptionId: true,
          question: {
            select: {
              id: true,
              statement: true,
              explanation: true,
              node: { select: { label: true } },
              options: {
                orderBy: { position: "asc" },
                select: { id: true, text: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });

  // El intento es del alumno o no existe: no se consultan resultados ajenos.
  if (!intento || intento.studentId !== ctx.membershipId) notFound();

  const respuestas = [...intento.answers].sort((a, b) => a.position - b.position);
  const terminado = intento.status !== "IN_PROGRESS";

  if (terminado) {
    const percentil = intento.testDefinitionId
      ? await calcularPercentil(
          ctx.db,
          intento.testDefinitionId,
          Number(intento.scorePercent ?? 0),
        )
      : null;
    return (
      <Resultado
        intento={intento}
        respuestas={respuestas}
        percentil={percentil}
        puedeUsarIa={ctx.permissions.has("ai.student")}
      />
    );
  }

  const indice = Math.min(
    Math.max(0, Number(typeof query.p === "string" ? query.p : 0) || 0),
    respuestas.length - 1,
  );
  const actual = respuestas[indice];
  const contestadas = respuestas.filter((r) => r.selectedOptionId).length;

  const config = (intento.config ?? {}) as { penalizacion?: number };
  const penalizacion = Number(config.penalizacion ?? 0);
  const esSimulacro = intento.kind === "SIMULATION" && penalizacion > 0;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/campus/tests"
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Salir
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-muted">
            {indice + 1} de {respuestas.length} · {contestadas} contestadas
          </span>
          {intento.expiresAt ? (
            <ExamTimer expiraISO={intento.expiresAt.toISOString()} />
          ) : null}
        </div>
      </div>

      {esSimulacro ? (
        <p className="rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 text-xs text-caution">
          Simulacro en condiciones de examen: cada fallo resta{" "}
          {penalizacion.toString().replace(".", ",")} aciertos. Si dudas, piensa si
          te compensa arriesgar.
        </p>
      ) : null}

      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={contestadas}
        aria-valuemin={0}
        aria-valuemax={respuestas.length}
        aria-label="Progreso del test"
      >
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${(contestadas / respuestas.length) * 100}%` }}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 pt-4">
          {actual.question.node ? (
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {actual.question.node.label}
            </p>
          ) : null}

          <p className="text-base leading-relaxed text-ink">
            {actual.question.statement}
          </p>

          <div className="space-y-2">
            {actual.question.options.map((opcion, i) => {
              const elegida = actual.selectedOptionId === opcion.id;
              return (
                <form key={opcion.id} action={answerQuestionAction}>
                  <input type="hidden" name="attemptId" value={intento.id} />
                  <input type="hidden" name="questionId" value={actual.question.id} />
                  <input type="hidden" name="optionId" value={opcion.id} />
                  <button
                    type="submit"
                    className={cn(
                      "flex w-full items-start gap-3 rounded-[var(--radius-control)] border p-3 text-left text-sm transition-colors",
                      elegida
                        ? "border-accent bg-accent-soft text-ink"
                        : "border-line bg-surface text-ink hover:bg-surface-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        elegida
                          ? "border-accent bg-accent text-accent-contrast"
                          : "border-line text-ink-muted",
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="pt-0.5">{opcion.text}</span>
                  </button>
                </form>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        {indice > 0 ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={`/campus/tests/${intento.id}?p=${indice - 1}`}>Anterior</Link>
          </Button>
        ) : (
          <span />
        )}

        {indice < respuestas.length - 1 ? (
          <Button asChild size="sm">
            <Link href={`/campus/tests/${intento.id}?p=${indice + 1}`}>Siguiente</Link>
          </Button>
        ) : (
          <form action={submitAttemptAction}>
            <input type="hidden" name="attemptId" value={intento.id} />
            <Button type="submit" size="sm">
              Entregar test
            </Button>
          </form>
        )}
      </div>

      <nav aria-label="Ir a una pregunta" className="flex flex-wrap gap-1.5">
        {respuestas.map((r, i) => (
          <Link
            key={r.position}
            href={`/campus/tests/${intento.id}?p=${i}`}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-xs font-medium transition-colors",
              i === indice
                ? "bg-accent text-accent-contrast"
                : r.selectedOptionId
                  ? "bg-accent-soft text-accent"
                  : "bg-surface-muted text-ink-muted hover:bg-surface",
            )}
          >
            {i + 1}
          </Link>
        ))}
      </nav>

      {contestadas < respuestas.length ? (
        <form action={submitAttemptAction}>
          <input type="hidden" name="attemptId" value={intento.id} />
          <Button type="submit" variant="ghost" size="sm" className="w-full">
            Entregar con {respuestas.length - contestadas} sin contestar
          </Button>
        </form>
      ) : null}
    </>
  );
}

type Respuesta = {
  position: number;
  isCorrect: boolean | null;
  selectedOptionId: string | null;
  question: {
    id: string;
    statement: string;
    explanation: string | null;
    node: { label: string } | null;
    options: { id: string; text: string; isCorrect: boolean }[];
  };
};

function Resultado({
  intento,
  respuestas,
  percentil,
  puedeUsarIa,
}: {
  intento: {
    id: string;
    totalQuestions: number;
    correctCount: number;
    wrongCount: number;
    blankCount: number;
    score: unknown;
    scorePercent: unknown;
    config: unknown;
  };
  respuestas: Respuesta[];
  puedeUsarIa: boolean;
  percentil: { percentil: number; muestra: number; media: number } | null;
}) {
  const porcentaje = Number(intento.scorePercent ?? 0);
  const config = (intento.config ?? {}) as { penalizacion?: number };
  const penalizacion = Number(config.penalizacion ?? 0);
  const notaNeta = intento.score !== null ? Number(intento.score) : null;

  return (
    <>
      <Link
        href="/campus/tests"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Tests
      </Link>

      <Card>
        <CardContent className="space-y-4 p-5 pt-5 text-center">
          <p className="text-4xl font-semibold tabular-nums text-ink">
            {intento.correctCount}
            <span className="text-xl text-ink-muted">/{intento.totalQuestions}</span>
          </p>
          <p
            className={cn(
              "text-sm font-medium",
              porcentaje >= 70
                ? "text-positive"
                : porcentaje >= 50
                  ? "text-caution"
                  : "text-critical",
            )}
          >
            {porcentaje.toFixed(0)}% de aciertos
          </p>

          <div className="flex justify-center gap-4 text-xs text-ink-muted">
            <span>{intento.correctCount} aciertos</span>
            <span>{intento.wrongCount} fallos</span>
            <span>{intento.blankCount} en blanco</span>
          </div>

          {penalizacion > 0 && notaNeta !== null ? (
            <p className="text-xs text-ink-muted">
              Nota neta {notaNeta.toString().replace(".", ",")} sobre{" "}
              {intento.totalQuestions}, aplicando la penalización de{" "}
              {penalizacion.toString().replace(".", ",")} por fallo.
            </p>
          ) : null}

          {percentil ? (
            <div className="rounded-[var(--radius-control)] bg-surface-muted p-3">
              <p className="text-sm font-medium text-ink">
                Estás por encima del {percentil.percentil}% de tu academia
              </p>
              <p className="text-xs text-ink-muted">
                Sobre {percentil.muestra} personas que lo han hecho · media{" "}
                {percentil.media}%
              </p>
            </div>
          ) : null}

          <Button asChild variant="secondary" size="sm">
            <Link href="/campus/tests">
              <RotateCcw aria-hidden />
              Hacer otro test
            </Link>
          </Button>
        </CardContent>
      </Card>

      <h2 className="text-sm font-semibold text-ink">Corrección</h2>

      <div className="space-y-3">
        {respuestas.map((r, i) => {
          const correcta = r.question.options.find((o) => o.isCorrect);
          const acerto = r.isCorrect === true;
          const enBlanco = !r.selectedOptionId;

          return (
            <Card key={r.position}>
              <CardContent className="space-y-3 p-4 pt-4">
                <div className="flex items-start gap-2">
                  {acerto ? (
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-positive"
                      aria-label="Correcta"
                    />
                  ) : (
                    <XCircle
                      className="mt-0.5 size-4 shrink-0 text-critical"
                      aria-label="Incorrecta"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-muted">Pregunta {i + 1}</p>
                    <p className="text-sm text-ink">{r.question.statement}</p>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {r.question.options.map((opcion, indice) => {
                    const elegida = r.selectedOptionId === opcion.id;
                    return (
                      <li
                        key={opcion.id}
                        className={cn(
                          "flex items-start gap-2 rounded-[var(--radius-control)] px-2.5 py-1.5 text-sm",
                          opcion.isCorrect
                            ? "bg-positive-soft text-positive"
                            : elegida
                              ? "bg-critical-soft text-critical"
                              : "text-ink-soft",
                        )}
                      >
                        <span className="font-semibold">
                          {String.fromCharCode(65 + indice)}
                        </span>
                        <span>{opcion.text}</span>
                        {elegida ? (
                          <Badge tone={opcion.isCorrect ? "positive" : "critical"}>
                            Tu respuesta
                          </Badge>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {enBlanco && correcta ? (
                  <p className="text-xs text-ink-muted">
                    No contestaste. La correcta era la {" "}
                    <strong>
                      {String.fromCharCode(
                        65 + r.question.options.findIndex((o) => o.isCorrect),
                      )}
                    </strong>
                    .
                  </p>
                ) : null}

                {!acerto && puedeUsarIa ? (
                  <ExplainButton attemptId={intento.id} questionId={r.question.id} />
                ) : null}

                {r.question.explanation ? (
                  <div className="rounded-[var(--radius-control)] bg-surface-muted p-3">
                    <p className="text-xs font-medium text-ink">
                      Explicación del preparador
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {r.question.explanation}
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
