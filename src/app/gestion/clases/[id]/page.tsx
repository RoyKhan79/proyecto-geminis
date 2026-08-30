import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, MapPin, Video } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  deleteClassAction,
  saveAttendanceAction,
} from "@/server/classes/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { ClassAdminForm } from "./class-admin-form";

export const metadata: Metadata = { title: "Clase" };

const ASISTENCIA = [
  { value: "PRESENT", label: "Presente" },
  { value: "ONLINE", label: "Online" },
  { value: "WATCHED_RECORDING", label: "Vio grabación" },
  { value: "EXCUSED", label: "Justificada" },
  { value: "ABSENT", label: "Falta" },
] as const;

/**
 * Una clase concreta, con su lista de asistencia.
 *
 * La asistencia admite cinco estados porque en una academia «no vino»,
 * «avisó» y «vio la grabación» no son lo mismo.
 */
export default async function ClasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requirePagePermission("classes.read");
  const { id } = await params;

  const clase = await ctx.db.classSession.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      location: true,
      meetingUrl: true,
      recordingUrl: true,
      summary: true,
      groupId: true,
      courseId: true,
      course: { select: { name: true } },
      group: { select: { name: true } },
      node: { select: { id: true, label: true } },
      teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
      attendances: {
        select: { studentId: true, status: true },
      },
    },
  });
  if (!clase) notFound();

  const matriculados = await ctx.db.enrollment.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACTIVE", "PAST_DUE"] },
      ...(clase.groupId
        ? { groupId: clase.groupId }
        : clase.courseId
          ? { courseId: clase.courseId }
          : { id: "" }),
    },
    orderBy: { student: { user: { lastName: "asc" } } },
    select: {
      student: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  const yaMarcado = new Map(clase.attendances.map((a) => [a.studentId, a.status]));
  const puedeEscribir = ctx.permissions.has("classes.write");
  const puedeAsistencia = ctx.permissions.has("attendance.write");

  return (
    <>
      <PageHeader
        title={clase.title}
        description={formatDateTime(clase.startsAt)}
        breadcrumb={
          <Link
            href="/gestion/clases"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Clases
          </Link>
        }
        actions={
          puedeEscribir ? (
            <form action={deleteClassAction}>
              <input type="hidden" name="classId" value={clase.id} />
              <Button type="submit" variant="secondary" size="sm">
                Cancelar clase
              </Button>
            </form>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 p-5 pt-5 text-sm">
              <Dato
                icono={<Clock className="size-4" />}
                texto={`${clase.durationMinutes ?? 90} minutos`}
              />
              {clase.location ? (
                <Dato icono={<MapPin className="size-4" />} texto={clase.location} />
              ) : null}
              {clase.meetingUrl ? (
                <Dato
                  icono={<Video className="size-4" />}
                  texto={
                    <a
                      href={clase.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      Aula virtual
                    </a>
                  }
                />
              ) : null}
              {clase.teacher ? (
                <p className="text-ink-soft">
                  Profesor: {clase.teacher.user.firstName}{" "}
                  {clase.teacher.user.lastName ?? ""}
                </p>
              ) : null}
              {clase.course || clase.group ? (
                <p className="text-ink-soft">
                  {[clase.course?.name, clase.group?.name].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {clase.node ? (
                <p className="text-ink-soft">Tema: {clase.node.label}</p>
              ) : null}
              {clase.description ? (
                <p className="text-ink-soft">{clase.description}</p>
              ) : null}
            </CardContent>
          </Card>

          {puedeEscribir ? (
            <ClassAdminForm
              classId={clase.id}
              status={clase.status}
              recordingUrl={clase.recordingUrl}
              summary={clase.summary}
            />
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Asistencia</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {matriculados.length === 0 ? (
              <EmptyState
                title="Sin alumnos asignados"
                description="Asocia la clase a un curso o grupo para poder pasar lista."
              />
            ) : (
              <form action={saveAttendanceAction}>
                <input type="hidden" name="classId" value={clase.id} />
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {matriculados.map(({ student }) => {
                    const actual = yaMarcado.get(student.id) ?? "ABSENT";
                    return (
                      <li key={student.id} className="px-4 py-2.5">
                        <p className="text-sm font-medium text-ink">
                          {student.user.firstName} {student.user.lastName ?? ""}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {ASISTENCIA.map((opcion) => (
                            <label
                              key={opcion.value}
                              className="cursor-pointer text-xs"
                            >
                              <input
                                type="radio"
                                name={`asistencia.${student.id}`}
                                value={opcion.value}
                                defaultChecked={actual === opcion.value}
                                disabled={!puedeAsistencia}
                                className="peer sr-only"
                              />
                              <span className="inline-flex rounded-full border border-line px-2.5 py-1 text-ink-muted peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:font-medium peer-checked:text-accent">
                                {opcion.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {puedeAsistencia ? (
                  <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
                    <p className="text-xs text-ink-muted">
                      {clase.attendances.length > 0
                        ? `Lista pasada para ${clase.attendances.length} alumnos.`
                        : "Todavía no has pasado lista."}
                    </p>
                    <Button type="submit" size="sm">
                      Guardar asistencia
                    </Button>
                  </div>
                ) : null}
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {clase.recordingUrl ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4 pt-4">
            <div>
              <p className="text-sm font-medium text-ink">Grabación publicada</p>
              <p className="text-xs text-ink-muted">
                El alumnado del grupo ya puede verla.
              </p>
            </div>
            <Badge tone="positive">Disponible</Badge>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function Dato({ icono, texto }: { icono: React.ReactNode; texto: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-ink-soft">
      <span className="text-ink-muted">{icono}</span>
      {texto}
    </p>
  );
}
