import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Users, Video } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { loadClassBoard, type ClaseLista } from "@/server/classes/queries";
import { ClassForm } from "./class-form";

export const metadata: Metadata = { title: "Clases" };

const ESTADO: Record<
  string,
  { label: string; tone: "neutral" | "positive" | "caution" | "critical" | "info" }
> = {
  SCHEDULED: { label: "Programada", tone: "info" },
  LIVE: { label: "En directo", tone: "positive" },
  FINISHED: { label: "Impartida", tone: "neutral" },
  CANCELLED: { label: "Cancelada", tone: "critical" },
};

const hora = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });

/**
 * El listado de clases programadas.
 */
export default async function ClasesPage() {
  const ctx = await requirePagePermission("classes.read");
  const tablero = await loadClassBoard(ctx.db);
  const puedeEscribir = ctx.permissions.has("classes.write");

  return (
    <>
      <PageHeader
        title="Clases"
        description="Programa las sesiones, pasa lista y publica la grabación."
        actions={
          puedeEscribir ? (
            <ClassForm
              cursos={tablero.cursos}
              profesores={tablero.profesores}
              temas={tablero.temas}
            />
          ) : null
        }
      />

      {tablero.total === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="No hay clases programadas"
            description="Programa la primera y el alumnado del grupo recibirá un aviso."
          />
        </Card>
      ) : (
        <>
          <Seccion
            titulo={`Próximas (${tablero.proximas.length})`}
            clases={tablero.proximas}
          />
          <Seccion
            titulo={`Impartidas (${tablero.pasadas.length})`}
            clases={tablero.pasadas}
          />
        </>
      )}
    </>
  );
}

function Seccion({ titulo, clases }: { titulo: string; clases: ClaseLista[] }) {
  if (clases.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
      <Card className="divide-y divide-[var(--border-subtle)]">
        {clases.map((clase) => {
          const estado = ESTADO[clase.status] ?? ESTADO.SCHEDULED;
          return (
            <Link
              key={clase.id}
              href={`/gestion/clases/${clase.id}`}
              className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-muted"
            >
              <div className="w-20 shrink-0 text-center">
                <p className="text-xs text-ink-muted">{formatDate(clase.startsAt)}</p>
                <p className="text-sm font-semibold tabular-nums text-ink">
                  {hora.format(clase.startsAt)}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{clase.title}</p>
                <p className="truncate text-xs text-ink-muted">
                  {[
                    clase.course?.name,
                    clase.group?.name,
                    clase.teacher
                      ? `${clase.teacher.user.firstName} ${clase.teacher.user.lastName ?? ""}`.trim()
                      : null,
                    clase.location,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              {clase._count.attendances > 0 ? (
                <Badge>
                  <Users className="size-3" aria-hidden />
                  {clase._count.attendances}
                </Badge>
              ) : null}
              {clase.recordingUrl ? (
                <Badge tone="accent">
                  <Video className="size-3" aria-hidden />
                  Grabada
                </Badge>
              ) : null}
              <Badge tone={estado.tone}>{estado.label}</Badge>
            </Link>
          );
        })}
      </Card>
    </section>
  );
}
