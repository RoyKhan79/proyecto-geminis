import type { Metadata } from "next";
import { ClipboardList, FileText } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { AssignmentForm } from "./assignment-form";
import { GradeForm } from "./grade-form";

export const metadata: Metadata = { title: "Tareas" };

const ESTADO: Record<
  string,
  { label: string; tone: "neutral" | "positive" | "caution" | "critical" | "info" }
> = {
  PENDING: { label: "Sin entregar", tone: "neutral" },
  SUBMITTED: { label: "Entregado", tone: "info" },
  LATE: { label: "Fuera de plazo", tone: "caution" },
  RETURNED: { label: "Devuelto", tone: "caution" },
  GRADED: { label: "Corregido", tone: "positive" },
};

export default async function TareasPage() {
  const ctx = await requirePagePermission("classes.read");

  const [tareas, cursos, temas] = await Promise.all([
    ctx.db.assignment.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        instructions: true,
        status: true,
        dueAt: true,
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
            submittedAt: true,
            body: true,
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
        groups: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
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
        title="Tareas"
        description="Manda supuestos y simulacros escritos, recibe las entregas y corrígelas."
        actions={
          puedeEscribir ? (
            <AssignmentForm
              cursos={cursos.map((c) => ({ id: c.id, name: c.name, grupos: c.groups }))}
              temas={temas}
            />
          ) : null
        }
      />

      {tareas.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="Todavía no hay tareas"
            description="Crea la primera: los tipo test se corrigen solos, pero un supuesto lo tienes que leer tú."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {tareas.map((tarea) => {
            const entregadas = tarea.submissions.filter(
              (s) => s.status !== "PENDING",
            ).length;
            const corregidas = tarea.submissions.filter(
              (s) => s.status === "GRADED",
            ).length;

            return (
              <Card key={tarea.id}>
                <CardContent className="space-y-4 p-5 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-ink">{tarea.title}</h2>
                      <p className="text-xs text-ink-muted">
                        {[
                          tarea.course?.name,
                          tarea.group?.name,
                          tarea.dueAt ? `entrega ${formatDate(tarea.dueAt)}` : null,
                          `sobre ${Number(tarea.maxScore)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge tone={tarea.status === "PUBLISHED" ? "positive" : "neutral"}>
                        {tarea.status === "PUBLISHED" ? "Publicada" : "Borrador"}
                      </Badge>
                      <Badge>
                        {entregadas}/{tarea.submissions.length} entregadas
                      </Badge>
                      {corregidas > 0 ? (
                        <Badge tone="accent">{corregidas} corregidas</Badge>
                      ) : null}
                    </div>
                  </div>

                  {tarea.submissions.length > 0 ? (
                    <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-control)] border border-line">
                      {tarea.submissions.map((entrega) => {
                        const estado = ESTADO[entrega.status] ?? ESTADO.PENDING;
                        return (
                          <li key={entrega.id} className="space-y-2 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-ink">
                                {entrega.student.user.firstName}{" "}
                                {entrega.student.user.lastName ?? ""}
                              </p>
                              <div className="flex items-center gap-2">
                                {entrega.score !== null ? (
                                  <span className="text-sm font-semibold tabular-nums text-ink">
                                    {Number(entrega.score)}/{Number(tarea.maxScore)}
                                  </span>
                                ) : null}
                                <Badge tone={estado.tone}>{estado.label}</Badge>
                              </div>
                            </div>

                            {entrega.body ? (
                              <p className="whitespace-pre-line text-sm text-ink-soft">
                                {entrega.body}
                              </p>
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

                            {puedeEscribir && entrega.status !== "PENDING" ? (
                              <GradeForm
                                submissionId={entrega.id}
                                maxScore={Number(tarea.maxScore)}
                                score={entrega.score !== null ? Number(entrega.score) : null}
                                feedback={entrega.feedback}
                              />
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      Todavía no hay entregas. Publica la tarea para que aparezcan.
                    </p>
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
