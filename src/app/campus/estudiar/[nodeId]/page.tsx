import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  PlayCircle,
} from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { getEffectiveFlags, grantsCover } from "@/lib/access/content-access";
import { loadChildren, loadGrants, loadNodeForStudent } from "@/server/campus/queries";
import { markProgressAction } from "@/server/campus/actions";
import { DocumentViewer } from "@/components/campus/document-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { sanitizeHtml } from "@/lib/sanitize";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Estudiar" };

export default async function NodoPage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const ctx = await requireAcademy();
  const { nodeId } = await params;

  const grants = await loadGrants(ctx.academy.id, ctx.membershipId);
  const nodo = await loadNodeForStudent(ctx.db, grants, nodeId, ctx.academy.id);

  // Si no tiene derecho de acceso, para el alumno el contenido simplemente no
  // existe. No revelamos que hay algo detrás que no ha pagado.
  if (!nodo) notFound();

  const hijos = await loadChildren(ctx.db, grants, ctx.membershipId, nodo.id);
  const flags = await getEffectiveFlags(ctx.academy.id, nodo.id);

  // Descargar es un permiso distinto de ver: hacen falta las dos cosas.
  const puedeDescargar =
    (flags?.downloadable ?? false) &&
    grantsCover(grants, nodo, "DOWNLOAD_CONTENT");

  const marcaDeAgua = flags?.watermark
    ? `${ctx.academy.name} · ${ctx.user.firstName} ${ctx.user.lastName ?? ""} · ${formatDate(new Date())}`
    : null;

  // «Volver» solo apunta al padre si el alumno puede verlo de verdad.
  //
  // Antes apuntaba siempre, y eso enseñaba el identificador de una sección que
  // podía no tener contratada. Lo señaló la revisión de seguridad: era la pieza
  // que hacía cómodo el intento de fuga por la IA (H-07). Aunque el destino ya
  // devolvía 404 y la fuga está cerrada, un enlace que lleva a una pantalla de
  // «no existe» tampoco es aceptable como experiencia.
  const padreVisible = nodo.parentId
    ? await loadNodeForStudent(ctx.db, grants, nodo.parentId, ctx.academy.id)
    : null;

  const volverHref = padreVisible
    ? `/campus/estudiar/${padreVisible.id}`
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
            // Saneado también aquí, no solo al guardar: puede haber contenido
            // almacenado antes de que existiera el saneador, y un script
            // inyectado se ejecutaría con la sesión de quien lo lee.
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(nodo.resource.richText) }}
          />
        </Card>
      ) : null}

      {nodo.resource?.type === "PDF" && nodo.resource.fileId ? (
        <DocumentViewer
          fileId={nodo.resource.fileId}
          fileName={nodo.label}
          puedeDescargar={puedeDescargar}
          marcaDeAgua={marcaDeAgua}
        />
      ) : null}

      {nodo.resource?.externalUrl ? (
        <Card>
          <CardContent className="p-4 pt-4">
            <Button asChild variant="secondary" className="w-full">
              <a href={nodo.resource.externalUrl} target="_blank" rel="noreferrer">
                {nodo.resource.type === "VIDEO" ? (
                  <PlayCircle aria-hidden />
                ) : (
                  <ExternalLink aria-hidden />
                )}
                {nodo.resource.type === "VIDEO" ? "Ver el vídeo" : "Abrir el enlace"}
              </a>
            </Button>
          </CardContent>
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
            <div className="flex gap-2">
              <form action={markProgressAction}>
                <input type="hidden" name="nodeId" value={nodo.id} />
                <input type="hidden" name="status" value="IN_PROGRESS" />
                <Button type="submit" variant="secondary" size="sm">
                  En curso
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
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hijos.length === 0 ? (
        nodo.kind !== "TOPIC" && !nodo.resource ? (
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
            const esRecurso = hijo.kind === "RESOURCE";
            return (
              <Link
                key={hijo.id}
                href={`/campus/estudiar/${hijo.id}`}
                className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-muted"
              >
                {esRecurso ? (
                  <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden />
                ) : estado === "COMPLETED" ? (
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
                  <p className="truncate font-medium text-ink">{hijo.label}</p>
                  {hijo.estimatedMinutes ? (
                    <p className="text-xs text-ink-muted">{hijo.estimatedMinutes} min</p>
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
