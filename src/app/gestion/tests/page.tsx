import type { Metadata } from "next";
import { ListChecks, Search } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { setQuestionStatusAction } from "@/server/assessment/actions";
import {
  DIFFICULTY_LABEL,
  QUESTION_STATUS_LABEL,
  QUESTION_STATUS_TONE,
  listQuestions,
  loadTopicOptions,
} from "@/server/assessment/queries";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from "@/components/ui/primitives";
import type { QuestionStatus } from "@/generated/prisma/enums";
import { QuestionForm } from "./question-form";

export const metadata: Metadata = { title: "Tests" };

export default async function GestionTestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePagePermission("questions.read");
  const params = await searchParams;

  const search = typeof params.q === "string" ? params.q : undefined;
  const estadoBruto = typeof params.estado === "string" ? params.estado : "ALL";
  const estado: QuestionStatus | "ALL" =
    estadoBruto in QUESTION_STATUS_LABEL
      ? (estadoBruto as QuestionStatus)
      : "ALL";

  const [{ items, total }, topics] = await Promise.all([
    listQuestions(ctx.db, { search, status: estado }),
    loadTopicOptions(ctx.db),
  ]);

  const soloTemas = topics.filter((t) => t.kind === "TOPIC");
  const puedeEscribir = ctx.permissions.has("questions.write");
  const puedePublicar = ctx.permissions.has("questions.publish");

  const pendientes = items.filter(
    (q) => q.status === "DRAFT" || q.status === "PENDING_REVIEW",
  ).length;

  return (
    <>
      <PageHeader
        title="Banco de preguntas"
        description={`${total} preguntas. El alumnado solo ve las publicadas.`}
        actions={
          puedeEscribir ? (
            <QuestionForm topics={soloTemas} puedePublicar={puedePublicar} />
          ) : null
        }
      />

      {pendientes > 0 ? (
        <Card className="border-caution">
          <CardContent className="p-4 pt-4 text-sm text-ink">
            Hay <strong>{pendientes}</strong> preguntas en borrador o pendientes de
            revisión. Nada llega al alumnado hasta que alguien las aprueba.
          </CardContent>
        </Card>
      ) : null}

      <form className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Buscar en los enunciados"
            aria-label="Buscar preguntas"
            className="pl-9"
          />
        </div>
        <Select
          name="estado"
          defaultValue={estado}
          aria-label="Estado"
          className="sm:w-56"
        >
          <option value="ALL">Todos los estados</option>
          {Object.entries(QUESTION_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="size-5" />}
            title="Todavía no hay preguntas"
            description={
              soloTemas.length === 0
                ? "Crea antes algún tema en Contenido para poder clasificar las preguntas."
                : "Crea la primera pregunta o impórtalas desde tu banco actual."
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((pregunta) => {
            const acierto =
              pregunta.timesAnswered > 0
                ? Math.round((pregunta.timesCorrect / pregunta.timesAnswered) * 100)
                : null;

            return (
              <Card key={pregunta.id}>
                <CardContent className="space-y-3 p-4 pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm text-ink">
                      {pregunta.statement}
                    </p>
                    <Badge tone={QUESTION_STATUS_TONE[pregunta.status]}>
                      {QUESTION_STATUS_LABEL[pregunta.status]}
                    </Badge>
                  </div>

                  <ul className="space-y-1">
                    {pregunta.options
                      .sort((a, b) => a.position - b.position)
                      .map((opcion, i) => (
                        <li
                          key={opcion.id}
                          className={
                            opcion.isCorrect
                              ? "flex gap-2 text-sm font-medium text-positive"
                              : "flex gap-2 text-sm text-ink-soft"
                          }
                        >
                          <span>{String.fromCharCode(65 + i)}.</span>
                          <span>{opcion.text}</span>
                        </li>
                      ))}
                  </ul>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span>{pregunta.node?.label ?? "Sin tema"}</span>
                    <span>· {DIFFICULTY_LABEL[pregunta.difficulty]}</span>
                    {acierto !== null ? (
                      <span>
                        · {pregunta.timesAnswered} respuestas · {acierto}% de acierto
                      </span>
                    ) : (
                      <span>· sin responder todavía</span>
                    )}
                    {acierto !== null && acierto < 30 ? (
                      <Badge tone="caution">Muy difícil: ¿está bien redactada?</Badge>
                    ) : null}
                    {acierto !== null && acierto > 95 && pregunta.timesAnswered > 5 ? (
                      <Badge tone="neutral">Demasiado fácil</Badge>
                    ) : null}
                  </div>

                  {puedePublicar ? (
                    <div className="flex gap-2 border-t border-line pt-3">
                      {pregunta.status !== "PUBLISHED" ? (
                        <form action={setQuestionStatusAction}>
                          <input type="hidden" name="questionId" value={pregunta.id} />
                          <input type="hidden" name="estado" value="PUBLISHED" />
                          <Button type="submit" size="sm">
                            Publicar
                          </Button>
                        </form>
                      ) : (
                        <form action={setQuestionStatusAction}>
                          <input type="hidden" name="questionId" value={pregunta.id} />
                          <input type="hidden" name="estado" value="DRAFT" />
                          <Button type="submit" variant="secondary" size="sm">
                            Retirar
                          </Button>
                        </form>
                      )}
                      <form action={setQuestionStatusAction}>
                        <input type="hidden" name="questionId" value={pregunta.id} />
                        <input type="hidden" name="estado" value="ARCHIVED" />
                        <Button type="submit" variant="ghost" size="sm">
                          Archivar
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
