import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Users, Video } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
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

export default async function ClasesPage() {
  const ctx = await requirePagePermission("classes.read");

  const desde = new Date();
  desde.setDate(desde.getDate() - 30);

  const [clases, cursos, profesores, temas] = await Promise.all([
    ctx.db.classSession.findMany({
      where: { deletedAt: null, startsAt: { gte: desde } },
      orderBy: { startsAt: "asc" },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
        endsAt: true,
        location: true,
        meetingUrl: true,
        recordingUrl: true,
        group: { select: { name: true } },
        course: { select: { name: true } },
        teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { attendances: true } },
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
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
    ctx.db.membership.findMany({
      where: { deletedAt: null, teacherProfile: { isNot: null } },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
    ctx.db.contentNode.findMany({
      where: { kind: "TOPIC", deletedAt: null },
      orderBy: [{ path: "asc" }, { position: "asc" }],
      take: 200,
      select: { id: true, label: true },
    }),
  ]);

  const ahora = Date.now();
  const proximas = clases.filter((c) => c.startsAt.getTime() >= ahora);
  const pasadas = clases.filter((c) => c.startsAt.getTime() < ahora).reverse();

  const puedeEscribir = ctx.permissions.has("classes.write");

  return (
    <>
      <PageHeader
        title="Clases"
        description="Programa las sesiones, pasa lista y publica la grabación."
        actions={
          puedeEscribir ? (
            <ClassForm
              cursos={cursos.map((c) => ({ id: c.id, name: c.name, grupos: c.groups }))}
              profesores={profesores.map((p) => ({
                id: p.id,
                nombre: `${p.user.firstName} ${p.user.lastName ?? ""}`.trim(),
              }))}
              temas={temas}
            />
          ) : null
        }
      />

      {clases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="No hay clases programadas"
            description="Programa la primera y el alumnado del grupo recibirá un aviso."
          />
        </Card>
      ) : (
        <>
          <Seccion titulo={`Próximas (${proximas.length})`} clases={proximas} />
          <Seccion titulo={`Impartidas (${pasadas.length})`} clases={pasadas} />
        </>
      )}
    </>
  );
}

type ClaseLista = {
  id: string;
  title: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  meetingUrl: string | null;
  recordingUrl: string | null;
  group: { name: string } | null;
  course: { name: string } | null;
  teacher: { user: { firstName: string; lastName: string | null } } | null;
  _count: { attendances: number };
};

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
