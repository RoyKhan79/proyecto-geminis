import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Sparkles, Video } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import {
  loadGrants,
  loadProgressSummary,
  loadStudentEditions,
  loadUpcomingClasses,
} from "@/server/campus/queries";
import { daysUntil } from "@/server/dashboard/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

export default async function CampusHomePage() {
  const ctx = await requireAcademy();
  const studentId = ctx.membershipId;

  const [grants, matriculas, clases] = await Promise.all([
    loadGrants(ctx.academy.id, studentId),
    loadStudentEditions(ctx.db, studentId),
    loadUpcomingClasses(ctx.db, studentId),
  ]);

  const progreso = await loadProgressSummary(ctx.db, grants, studentId);
  const proxima = clases[0];
  const oposicion = matriculas[0]?.course.oppositionEdition;

  const diasParaExamen = daysUntil(oposicion?.examDate);

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Hola, {ctx.user.firstName}
        </h1>
        {oposicion ? (
          <p className="text-sm text-ink-muted">
            {oposicion.opposition.name} · {oposicion.name}
            {diasParaExamen ? ` · quedan ${diasParaExamen} días para el examen` : ""}
          </p>
        ) : null}
      </header>

      {matriculas.length === 0 ? (
        <Card>
          <EmptyState
            title="Todavía no tienes ninguna matrícula activa"
            description="En cuanto la academia te matricule, aquí verás tu oposición, tus clases y tu plan de estudio."
          />
        </Card>
      ) : (
        <>
          {progreso.continuar ? (
            <Card>
              <CardContent className="flex items-center justify-between gap-4 p-4 pt-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                    Continuar donde lo dejaste
                  </p>
                  <p className="truncate font-medium text-ink">
                    {progreso.continuar.node.label}
                  </p>
                </div>
                <Button asChild size="sm" className="shrink-0">
                  <Link href={`/campus/estudiar/${progreso.continuar.node.id}`}>
                    Seguir
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="space-y-3 p-4 pt-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-ink">Tu progreso</p>
                <p className="text-sm tabular-nums text-ink-muted">
                  {progreso.completados} de {progreso.temasAccesibles} temas
                </p>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-surface-sunken"
                role="progressbar"
                aria-valuenow={progreso.porcentaje}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progreso del temario"
              >
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progreso.porcentaje}%` }}
                />
              </div>
              <p className="text-xs text-ink-muted">
                {progreso.enCurso > 0
                  ? `${progreso.enCurso} en curso`
                  : "Empieza por el primer tema de tu temario."}
              </p>
            </CardContent>
          </Card>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">Próxima clase</h2>
            {proxima ? (
              <Card>
                <CardContent className="space-y-3 p-4 pt-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                      <CalendarClock className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{proxima.title}</p>
                      <p className="text-sm text-ink-muted">
                        {formatDateTime(proxima.startsAt)}
                        {proxima.group ? ` · ${proxima.group.name}` : ""}
                      </p>
                      {proxima.teacher ? (
                        <p className="text-xs text-ink-muted">
                          {proxima.teacher.user.firstName}{" "}
                          {proxima.teacher.user.lastName ?? ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {proxima.meetingUrl ? (
                    <Button asChild variant="secondary" size="sm" className="w-full">
                      <a href={proxima.meetingUrl} target="_blank" rel="noreferrer">
                        <Video aria-hidden />
                        Entrar al aula virtual
                      </a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <EmptyState
                  title="No tienes clases programadas"
                  description="Cuando tu academia programe la siguiente, aparecerá aquí."
                />
              </Card>
            )}
          </section>

          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3 p-4 pt-4">
              <Sparkles className="size-4 shrink-0 text-accent" aria-hidden />
              <p className="text-sm text-ink-muted">
                Geminis IA llegará en una próxima fase y responderá usando el
                material de tu academia, citando siempre de dónde sale cada dato.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
