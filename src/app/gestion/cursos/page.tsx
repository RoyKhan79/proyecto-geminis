import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { createCourseAction, createGroupAction } from "@/server/academic/actions";
import { InlineCreate } from "@/components/manager/inline-create";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Cursos y grupos" };

const MODALIDAD: Record<string, string> = {
  PRESENCIAL: "Presencial",
  ONLINE: "Online",
  HIBRIDO: "Híbrido",
};

export default async function CursosPage() {
  const ctx = await requireAcademy();
  const puedeCursos = ctx.permissions.has("courses.write");
  const puedeGrupos = ctx.permissions.has("groups.write");

  const [cursos, convocatorias] = await Promise.all([
    ctx.db.course.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        modality: true,
        status: true,
        startDate: true,
        endDate: true,
        capacity: true,
        oppositionEdition: {
          select: { name: true, opposition: { select: { name: true } } },
        },
        groups: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            schedule: true,
            modality: true,
            capacity: true,
            _count: { select: { enrollments: true } },
          },
        },
        _count: { select: { enrollments: true } },
      },
    }),
    ctx.db.oppositionEdition.findMany({
      where: { deletedAt: null },
      orderBy: { name: "desc" },
      select: {
        id: true,
        name: true,
        opposition: { select: { name: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Cursos y grupos"
        description="Un curso pertenece a una convocatoria; los grupos son sus turnos."
        actions={
          puedeCursos && convocatorias.length > 0 ? (
            <InlineCreate
              action={createCourseAction}
              label="Nuevo curso"
              title="Nuevo curso"
              successMessage="Curso creado."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Convocatoria" htmlFor="oppositionEditionId" required>
                  <Select name="oppositionEditionId" required defaultValue="">
                    <option value="">Elige una convocatoria</option>
                    {convocatorias.map((convocatoria) => (
                      <option key={convocatoria.id} value={convocatoria.id}>
                        {convocatoria.opposition.name} · {convocatoria.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nombre" htmlFor="name" required>
                  <Input name="name" placeholder="Curso anual 2026" required />
                </Field>
                <Field label="Código" htmlFor="code">
                  <Input name="code" />
                </Field>
                <Field label="Modalidad" htmlFor="modality" required>
                  <Select name="modality" defaultValue="PRESENCIAL">
                    {Object.entries(MODALIDAD).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Inicio" htmlFor="startDate">
                  <Input name="startDate" type="date" />
                </Field>
                <Field label="Fin" htmlFor="endDate">
                  <Input name="endDate" type="date" />
                </Field>
                <Field label="Plazas" htmlFor="capacity">
                  <Input name="capacity" type="number" min={0} />
                </Field>
              </div>
            </InlineCreate>
          ) : null
        }
      />

      {cursos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="size-5" />}
            title="Todavía no hay cursos"
            description={
              convocatorias.length === 0
                ? "Crea antes una oposición con su convocatoria."
                : "Crea el primer curso para poder matricular alumnos."
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {cursos.map((curso) => (
            <Card key={curso.id}>
              <CardContent className="space-y-4 p-5 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-ink">{curso.name}</h2>
                    <p className="text-sm text-ink-muted">
                      {curso.oppositionEdition.opposition.name} ·{" "}
                      {curso.oppositionEdition.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {[
                        MODALIDAD[curso.modality],
                        curso.startDate ? `Desde ${formatDate(curso.startDate)}` : null,
                        curso.capacity ? `${curso.capacity} plazas` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Badge tone="accent">
                    {curso._count.enrollments}{" "}
                    {curso._count.enrollments === 1 ? "matrícula" : "matrículas"}
                  </Badge>
                </div>

                {curso.groups.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {curso.groups.map((grupo) => (
                      <li
                        key={grupo.id}
                        className="rounded-[var(--radius-control)] border border-line px-3 py-2"
                      >
                        <p className="text-sm font-medium text-ink">{grupo.name}</p>
                        <p className="text-xs text-ink-muted">
                          {[
                            MODALIDAD[grupo.modality],
                            grupo.schedule,
                            `${grupo._count.enrollments} alumnos`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-muted">
                    Este curso no tiene grupos. Puedes trabajar sin ellos si no los
                    necesitas.
                  </p>
                )}

                {puedeGrupos ? (
                  <InlineCreate
                    action={createGroupAction}
                    label="Añadir grupo"
                    title={`Nuevo grupo de ${curso.name}`}
                    successMessage="Grupo creado."
                  >
                    <input type="hidden" name="courseId" value={curso.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Nombre" htmlFor={`gname-${curso.id}`} required>
                        <Input name="name" placeholder="Mañana" required />
                      </Field>
                      <Field label="Horario" htmlFor={`gsched-${curso.id}`}>
                        <Input name="schedule" placeholder="L-X-V · 10:00 a 13:00" />
                      </Field>
                      <Field label="Modalidad" htmlFor={`gmod-${curso.id}`} required>
                        <Select name="modality" defaultValue={curso.modality}>
                          {Object.entries(MODALIDAD).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Plazas" htmlFor={`gcap-${curso.id}`}>
                        <Input name="capacity" type="number" min={0} />
                      </Field>
                    </div>
                  </InlineCreate>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
