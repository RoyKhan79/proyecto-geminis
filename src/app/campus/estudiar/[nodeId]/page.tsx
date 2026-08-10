import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { loadChildren, loadGrants, loadNodeForStudent } from "@/server/campus/queries";
import { markProgressAction } from "@/server/campus/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Estudiar" };

export default async function NodoPage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const ctx = await requireAcademy();
  const { nodeId } = await params;

  const grants = await loadGrants(ctx.academy.id, ctx.membershipId);
  const nodo = await loadNodeForStudent(ctx.db, grants, nodeId);

  // Si no tiene derecho de acceso, para el alumno el contenido simplemente no
  // existe. No revelamos que hay algo detrás que no ha pagado.
  if (!nodo) notFound();

  const hijos = await loadChildren(ctx.db, grants, ctx.membershipId, nodo.id);

  const volverHref = nodo.parentId
    ? `/campus/estudiar/${nodo.parentId}`
    : "/campus/estudiar";

  return (
    <>
      <div className="space-y-1">
        <Link
          href={volverHref}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Volver
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{nodo.label}</h1>
        {nodo.description ? (
          <p className="text-sm text-ink-muted">{nodo.description}</p>
        ) : null}
      </div>

      {nodo.resource?.richText ? (
        <Card>
          <CardContent
            className="prose prose-sm max-w-none p-4 pt-4 text-ink"
            // El HTML se sanea en servidor antes de guardarse (ver docs/SECURITY_MODEL.md).
            dangerouslySetInnerHTML={{ __html: nodo.resource.richText }}
          />
        </Card>
      ) : null}

      {nodo.kind === "TOPIC" ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 pt-4">
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Clock className="size-4" aria-hidden />
              {nodo.estimatedMinutes
                ? `${nodo.estimatedMinutes} min estimados`
                : "Tema de estudio"}
            </div>
            <form action={markProgressAction} className="flex gap-2">
              <input type="hidden" name="nodeId" value={nodo.id} />
              <input type="hidden" name="status" value="IN_PROGRESS" />
              <Button type="submit" variant="secondary" size="sm">
                Marcar en curso
              </Button>
            </form>
            <form action={markProgressAction}>
              <input type="hidden" name="nodeId" value={nodo.id} />
              <input type="hidden" name="status" value="COMPLETED" />
              <Button type="submit" size="sm">
                <CheckCircle2 aria-hidden />
                Completado
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {hijos.length === 0 ? (
        nodo.kind !== "TOPIC" ? (
          <Card>
            <EmptyState
              title="Todavía no hay contenido publicado aquí"
              description="Tu academia lo irá subiendo. Vuelve a mirar en unos días."
            />
          </Card>
        ) : null
      ) : (
        <Card className="divide-y divide-[var(--border-subtle)]">
          {hijos.map((hijo) => {
            const estado = hijo.progress[0]?.status ?? "NOT_STARTED";
            return (
              <Link
                key={hijo.id}
                href={`/campus/estudiar/${hijo.id}`}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-muted"
              >
                {estado === "COMPLETED" ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-positive"
                    aria-label="Completado"
                  />
                ) : (
                  <Circle
                    className={
                      estado === "IN_PROGRESS"
                        ? "size-4 shrink-0 text-accent"
                        : "size-4 shrink-0 text-ink-muted"
                    }
                    aria-label={estado === "IN_PROGRESS" ? "En curso" : "Sin empezar"}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{hijo.label}</p>
                  {hijo.estimatedMinutes ? (
                    <p className="text-xs text-ink-muted">
                      {hijo.estimatedMinutes} min
                    </p>
                  ) : null}
                </div>
                <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
