import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, FileSignature, Lock, Timer } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { loadStudentExams } from "@/server/exams/queries";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Exámenes" };

/**
 * Exámenes de desarrollo del alumno.
 *
 * Separados de los tipo test porque no se parecen en nada al hacerlos: un test
 * se responde a golpes de dedo y se corrige solo; un examen de desarrollo son
 * dos horas escribiendo y una persona leyéndolo después.
 */
export default async function ExamenesCampusPage() {
  const ctx = await requireAcademy();
  const examenes = await loadStudentExams(ctx.db, ctx.membershipId);

  if (examenes.length === 0) {
    return (
      <>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Exámenes</h1>
        <Card>
          <EmptyState
            icon={<FileSignature className="size-5" />}
            title="No tienes exámenes convocados"
            description="Cuando tu academia convoque un examen de desarrollo aparecerá aquí, con su hora y su tiempo."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Exámenes</h1>

      {examenes.map((examen) => {
        const { estado } = examen;

        return (
          <Card key={examen.submissionId}>
            <CardContent className="space-y-3 p-4 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{examen.titulo}</p>
                  <p className="text-xs text-ink-muted">
                    {examen.timeLimitMinutes
                      ? `${examen.timeLimitMinutes} minutos`
                      : "Sin límite de tiempo"}
                    {` · sobre ${examen.maxScore}`}
                  </p>
                </div>

                {estado.fase === "corregido" ? (
                  <span className="text-lg font-semibold tabular-nums text-ink">
                    {examen.score ?? "—"}
                    <span className="text-sm text-ink-muted">/{examen.maxScore}</span>
                  </span>
                ) : (
                  <Badge
                    tone={
                      estado.fase === "en_curso"
                        ? "caution"
                        : estado.fase === "disponible"
                          ? "positive"
                          : estado.fase === "entregado"
                            ? "info"
                            : "neutral"
                    }
                  >
                    {
                      {
                        no_abierto: "Convocado",
                        disponible: "Puedes empezarlo",
                        en_curso: "En curso",
                        tiempo_agotado: "Tiempo agotado",
                        entregado: "Entregado",
                        corregido: "Corregido",
                        caducado: "No presentado",
                      }[estado.fase]
                    }
                  </Badge>
                )}
              </div>

              {estado.fase === "no_abierto" ? (
                <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                  <CalendarClock className="size-4 shrink-0" aria-hidden />
                  Se abre el {formatDateTime(estado.abreEn)}
                </p>
              ) : null}

              {estado.fase === "en_curso" ? (
                <p className="flex items-center gap-1.5 text-sm text-caution">
                  <Timer className="size-4 shrink-0" aria-hidden />
                  Lo tienes empezado · termina a las {formatDateTime(estado.terminaEn)}
                </p>
              ) : null}

              {estado.fase === "caducado" ? (
                <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                  <Lock className="size-4 shrink-0" aria-hidden />
                  Se cerró el {formatDateTime(estado.cerroEn)} y no llegaste a empezarlo.
                </p>
              ) : null}

              {examen.autoSubmitted ? (
                <p className="text-xs text-ink-muted">
                  Se entregó solo al agotarse el tiempo, con lo último que habías
                  escrito.
                </p>
              ) : null}

              {examen.feedback ? (
                <div className="rounded-[var(--radius-control)] bg-surface-muted p-3">
                  <p className="text-xs font-medium text-ink">
                    Comentario del profesor
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">
                    {examen.feedback}
                  </p>
                </div>
              ) : null}

              {["disponible", "en_curso", "entregado", "corregido", "tiempo_agotado"].includes(
                estado.fase,
              ) ? (
                <Button asChild variant={estado.fase === "en_curso" ? "primary" : "secondary"} className="w-full">
                  <Link href={`/campus/examenes/${examen.submissionId}`}>
                    {estado.fase === "disponible"
                      ? "Empezar el examen"
                      : estado.fase === "en_curso"
                        ? "Seguir escribiendo"
                        : "Ver el examen"}
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
