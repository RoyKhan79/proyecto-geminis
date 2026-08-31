import type { Metadata } from "next";
import { ClipboardList, FileText } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { Badge, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { loadStudentTasks } from "@/server/tasks/queries";
import { formatDate } from "@/lib/utils";
import { SubmitForm } from "./submit-form";
import { CampusTitulo } from "@/components/campus/titulo";

export const metadata: Metadata = { title: "Tareas" };

const ESTADO: Record<
  string,
  { label: string; tone: "neutral" | "positive" | "caution" | "info" }
> = {
  PENDING: { label: "Pendiente", tone: "caution" },
  SUBMITTED: { label: "Entregado", tone: "info" },
  LATE: { label: "Entregado fuera de plazo", tone: "caution" },
  RETURNED: { label: "Devuelto para rehacer", tone: "caution" },
  GRADED: { label: "Corregido", tone: "positive" },
};

/** Tareas del alumno: lo que le han mandado, lo que ha entregado y sus notas. */
export default async function TareasCampusPage() {
  const ctx = await requireAcademy();

  const visibles = await loadStudentTasks(ctx.db, ctx.membershipId);

  return (
    <>
      <CampusTitulo>Tareas</CampusTitulo>

      {visibles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title="No tienes tareas"
            description="Cuando tu profesor mande un supuesto o un trabajo, aparecerá aquí."
          />
        </Card>
      ) : (
        visibles.map((entrega) => {
          const estado = ESTADO[entrega.status] ?? ESTADO.PENDING;
          const { plazoPasado, cerrado, puedeEntregar } = entrega;

          return (
            <Card key={entrega.id}>
              <CardContent className="space-y-3 p-4 pt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{entrega.assignment.title}</p>
                    <p className="text-xs text-ink-muted">
                      {entrega.assignment.dueAt
                        ? `Entrega antes del ${formatDate(entrega.assignment.dueAt)}`
                        : "Sin fecha límite"}
                      {` · sobre ${Number(entrega.assignment.maxScore)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entrega.score !== null ? (
                      <span className="text-lg font-semibold tabular-nums text-ink">
                        {Number(entrega.score)}
                        <span className="text-sm text-ink-muted">
                          /{Number(entrega.assignment.maxScore)}
                        </span>
                      </span>
                    ) : null}
                    <Badge tone={estado.tone}>{estado.label}</Badge>
                  </div>
                </div>

                {entrega.assignment.instructions ? (
                  <p className="whitespace-pre-line text-sm text-ink-soft">
                    {entrega.assignment.instructions}
                  </p>
                ) : null}

                {entrega.feedback ? (
                  <div className="rounded-[var(--radius-control)] bg-surface-muted p-3">
                    <p className="text-xs font-medium text-ink">
                      Comentario del profesor
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">
                      {entrega.feedback}
                    </p>
                  </div>
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

                {puedeEntregar ? (
                  <SubmitForm
                    assignmentId={entrega.assignment.id}
                    fueraDePlazo={plazoPasado}
                    yaEntregado={entrega.status !== "PENDING"}
                    textoPrevio={entrega.body}
                  />
                ) : cerrado ? (
                  <p className="text-xs text-ink-muted">
                    El plazo se ha cerrado y esta tarea no admite entregas tardías.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      )}
    </>
  );
}
