import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Video } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import {
  loadGrants,
  loadProgressSummary,
  loadStudentEditions,
  loadUpcomingClasses,
} from "@/server/campus/queries";
import { daysUntil } from "@/server/dashboard/queries";
import { Button } from "@/components/ui/button";
import { QuickLinks } from "@/components/campus/quick-links";
import { PlanDelDia } from "@/components/campus/plan-del-dia";
import { proponerPlanDelDia } from "@/server/ai/insights";
import { Card, CardContent, EmptyState, IconTile } from "@/components/ui/primitives";
import { Anillo } from "@/components/ui/graficos";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

/**
 * La pantalla de inicio del Campus.
 *
 * Lo primero es el plan del día: qué toca estudiar hoy y qué hay pendiente. El
 * resto de destinos van debajo, en accesos rápidos.
 */
export default async function CampusHomePage() {
  const ctx = await requireAcademy();
  const studentId = ctx.membershipId;

  const [grants, matriculas, clases] = await Promise.all([
    loadGrants(ctx.academy.id, studentId),
    loadStudentEditions(ctx.db, studentId),
    loadUpcomingClasses(ctx.db, studentId),
  ]);

  const progreso = await loadProgressSummary(ctx.db, grants, studentId);

  // Lo que Geminis propone hoy a este alumno concreto. Si no tiene nada que
  // decir con fundamento, devuelve una lista vacía y no se pinta nada.
  const propuestas = ctx.permissions.has("ai.student")
    ? await proponerPlanDelDia({
        db: ctx.db,
        academyId: ctx.academy.id,
        studentId,
        grants,
        ahora: new Date(),
      })
    : [];
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

      <QuickLinks />

      <PlanDelDia propuestas={propuestas} />

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
            <CardContent className="flex items-center gap-4 p-4 pt-4">
              {/*
                Un anillo y no la barra de antes. Es UNA proporción, que es lo
                único para lo que sirve un anillo, y como cifra suelta en medio
                se lee de un vistazo desde el móvil sin tener que estimar una
                longitud contra un carril gris.

                La barra decía lo mismo, pero como dato «de acompañamiento». Lo
                que hace que alguien vuelva mañana es ver cuánto lleva.
              */}
              <Anillo
                valor={progreso.completados}
                total={progreso.temasAccesibles}
                etiqueta={`de ${progreso.temasAccesibles}`}
                tamano={84}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">Tu progreso</p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {progreso.completados === 0
                    ? "Empieza por el primer tema de tu temario."
                    : `Llevas ${progreso.porcentaje}% del temario que tienes abierto.`}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {progreso.enCurso > 0
                    ? `${progreso.enCurso} en curso`
                    : "Ningún tema a medias."}
                </p>
              </div>
            </CardContent>
          </Card>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-ink">Próxima clase</h2>
            {proxima ? (
              <Card>
                <CardContent className="space-y-3 p-4 pt-4">
                  <div className="flex items-start gap-3">
                    <IconTile tone="rose" size="sm" className="mt-0.5 size-9">
                      <CalendarClock />
                    </IconTile>
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

        </>
      )}
    </>
  );
}
