import type { Metadata } from "next";
import { CalendarDays, Video } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { loadStudentEditions } from "@/server/campus/queries";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { CampusTitulo } from "@/components/campus/titulo";

export const metadata: Metadata = { title: "Calendario" };

const horaFormatter = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Las clases del alumno, día a día, con el tema de cada una.
 *
 * Sale de la agenda que lleva la academia: aquí no se programa nada, solo se ve.
 */
export default async function CalendarioPage() {
  const ctx = await requireAcademy();

  const matriculas = await loadStudentEditions(ctx.db, ctx.membershipId);
  const courseIds = matriculas.map((m) => m.course.id);
  const groupIds = matriculas.map((m) => m.group?.id).filter((id): id is string => !!id);

  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  const clases =
    courseIds.length === 0
      ? []
      : await ctx.db.classSession.findMany({
          where: {
            deletedAt: null,
            startsAt: { gte: desde },
            OR: [
              { groupId: { in: groupIds } },
              { groupId: null, courseId: { in: courseIds } },
            ],
          },
          orderBy: { startsAt: "asc" },
          take: 40,
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            status: true,
            meetingUrl: true,
            location: true,
            group: { select: { name: true } },
            teacher: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        });

  // Agrupamos por día para que la lista se lea de un vistazo en el móvil.
  const porDia = new Map<string, typeof clases>();
  for (const clase of clases) {
    const clave = formatDate(clase.startsAt);
    porDia.set(clave, [...(porDia.get(clave) ?? []), clase]);
  }

  return (
    <>
      <CampusTitulo>Calendario</CampusTitulo>

      {clases.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="No hay nada programado"
            description="Aquí verás tus clases, simulacros y fechas importantes."
          />
        </Card>
      ) : (
        [...porDia.entries()].map(([dia, delDia]) => (
          <section key={dia} className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">{dia}</h2>
            <Card className="divide-y divide-[var(--border-subtle)]">
              {delDia.map((clase) => (
                <CardContent key={clase.id} className="p-4 pt-4">
                  <div className="flex items-start gap-3">
                    <span className="w-14 shrink-0 text-sm font-medium tabular-nums text-ink">
                      {horaFormatter.format(clase.startsAt)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{clase.title}</p>
                      <p className="text-xs text-ink-muted">
                        {[
                          clase.group?.name,
                          clase.teacher
                            ? `${clase.teacher.user.firstName} ${clase.teacher.user.lastName ?? ""}`.trim()
                            : null,
                          clase.location,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {clase.meetingUrl && clase.status !== "FINISHED" ? (
                        <a
                          href={clase.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                        >
                          <Video className="size-3.5" aria-hidden />
                          Aula virtual
                        </a>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              ))}
            </Card>
          </section>
        ))
      )}
    </>
  );
}
