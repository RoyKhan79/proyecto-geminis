import type { Metadata } from "next";
import { FileSignature, FileText, Timer } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDateTime, fullName } from "@/lib/utils";
import { estadoDelExamen } from "@/server/exams/estado";
import { GradeForm } from "../tareas/grade-form";
import { ExamForm } from "./exam-form";

export const metadata: Metadata = { title: "Exámenes" };

/**
 * Exámenes de desarrollo, del lado de la academia.
 *
 * Lo que un preparador necesita ver de un vistazo es quién está escribiendo
 * ahora mismo, quién ha entregado y qué le queda por corregir. Ese orden.
 */
export default async function ExamenesGestionPage() {
  const ctx = await requirePagePermission("classes.read");
  const ahora = new Date();

  const [examenes, cursos, temas] = await Promise.all([
    ctx.db.assignment.findMany({
      where: { deletedAt: null, kind: "EXAM" },
      orderBy: [{ opensAt: "desc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        instructions: true,
        status: true,
        opensAt: true,
        dueAt: true,
        timeLimitMinutes: true,
        maxScore: true,
        group: { select: { name: true } },
        course: { select: { name: true } },
        submissions: {
          orderBy: { student: { user: { lastName: "asc" } } },
          select: {
            id: true,
            status: true,
            score: true,
            feedback: true,
            body: true,
            startedAt: true,
            submittedAt: true,
            autoSubmitted: true,
            student: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
            files: {
              select: {
                id: true,
                file: { select: { id: true, originalName: true } },
              },
            },
          },
        },
      },
    }),
    ctx.db.course.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        groups: { where: { deletedAt: null }, select: { id: true, name: true } },
      },
    }),
    ctx.db.contentNode.findMany({
      where: { kind: "TOPIC", deletedAt: null },
      orderBy: [{ path: "asc" }, { position: "asc" }],
      take: 200,
      select: { id: true, label: true },
    }),
  ]);

  const puedeEscribir = ctx.permissions.has("classes.write");

  return (
    <>
      <PageHeader
        title="Exámenes de desarrollo"
        description="Convoca un examen escrito con hora y reloj, y corrígelo cuando lo tengas entregado. Los tipo test están en su propia pantalla."
        actions={
          puedeEscribir ? (
            <ExamForm
              cursos={cursos.map((c) => ({ id: c.id, name: c.name, grupos: c.groups }))}
              temas={temas}
            />
          ) : null
        }
      />

      {examenes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileSignature className="size-5" />}
            title="Todavía no has convocado ningún examen"
            description="Un examen de desarrollo se abre a una hora, dura los minutos que tú digas y se guarda solo mientras el alumno escribe."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {examenes.map((examen) => {
            const estados = examen.submissions.map((entrega) => ({
              entrega,
              estado: estadoDelExamen(examen, entrega, ahora),
            }));

            const escribiendo = estados.filter(
              (e) => e.estado.fase === "en_curso",
            ).length;
            const entregados = estados.filter((e) =>
              ["entregado", "corregido"].includes(e.estado.fase),
            ).length;
            const porCorregir = estados.filter(
              (e) => e.estado.fase === "entregado",
            ).length;

            return (
              <Card key={examen.id}>
                <CardContent className="space-y-4 p-5 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-ink">{examen.title}</h2>
                      <p className="text-xs text-ink-muted">
                        {[
                          examen.course?.name,
                          examen.group?.name,
                          examen.opensAt
                            ? `abre ${formatDateTime(examen.opensAt)}`
                            : null,
                          examen.timeLimitMinutes
                            ? `${examen.timeLimitMinutes} min`
                            : "sin reloj",
                          `sobre ${Number(examen.maxScore)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {examen.status !== "PUBLISHED" ? (
                        <Badge tone="neutral">Borrador</Badge>
                      ) : null}
                      {escribiendo > 0 ? (
                        <Badge tone="caution">
                          <Timer className="size-3" aria-hidden />
                          {escribiendo} escribiendo
                        </Badge>
                      ) : null}
                      {porCorregir > 0 ? (
                        <Badge tone="info">{porCorregir} por corregir</Badge>
                      ) : null}
                      <span className="text-xs text-ink-muted">
                        {entregados}/{examen.submissions.length} entregados
                      </span>
                    </div>
                  </div>

                  {examen.submissions.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      Nadie convocado todavía. Publícalo para que aparezca al
                      alumnado matriculado.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--border-subtle)]">
                      {estados.map(({ entrega, estado }) => (
                        <li key={entrega.id} className="space-y-2 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium text-ink">
                              {fullName(entrega.student.user)}
                            </span>
                            <div className="flex items-center gap-2">
                              {entrega.autoSubmitted ? (
                                <span
                                  className="text-xs text-ink-muted"
                                  title="Se cerró solo al agotarse el tiempo"
                                >
                                  cierre automático
                                </span>
                              ) : null}
                              <Badge
                                tone={
                                  estado.fase === "corregido"
                                    ? "positive"
                                    : estado.fase === "entregado"
                                      ? "info"
                                      : estado.fase === "en_curso"
                                        ? "caution"
                                        : "neutral"
                                }
                              >
                                {
                                  {
                                    no_abierto: "Sin abrir",
                                    disponible: "Sin empezar",
                                    en_curso: "Escribiendo",
                                    tiempo_agotado: "Tiempo agotado",
                                    entregado: "Entregado",
                                    corregido: "Corregido",
                                    caducado: "No presentado",
                                  }[estado.fase]
                                }
                              </Badge>
                            </div>
                          </div>

                          {entrega.submittedAt ? (
                            <p className="text-xs text-ink-muted">
                              Entregado el {formatDateTime(entrega.submittedAt)}
                            </p>
                          ) : null}

                          {entrega.body &&
                          ["entregado", "corregido", "tiempo_agotado"].includes(
                            estado.fase,
                          ) ? (
                            <details className="rounded-[var(--radius-control)] bg-surface-muted p-3">
                              <summary className="cursor-pointer text-xs font-medium text-ink">
                                Leer la respuesta (
                                {entrega.body.trim().split(/\s+/).length} palabras)
                              </summary>
                              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                                {entrega.body}
                              </p>
                            </details>
                          ) : null}

                          {entrega.files.length > 0 ? (
                            <ul className="flex flex-wrap gap-2">
                              {entrega.files.map((archivo) => (
                                <li key={archivo.id}>
                                  <a
                                    href={`/api/archivos/${archivo.file.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-accent hover:bg-surface-muted"
                                  >
                                    <FileText className="size-3" aria-hidden />
                                    {archivo.file.originalName}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : null}

                          {puedeEscribir &&
                          ["entregado", "corregido"].includes(estado.fase) ? (
                            <GradeForm
                              submissionId={entrega.id}
                              maxScore={Number(examen.maxScore)}
                              score={entrega.score === null ? null : Number(entrega.score)}
                              feedback={entrega.feedback}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
