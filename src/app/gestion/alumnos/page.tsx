import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import {
  listStudents,
  loadCourseOptions,
  type StudentFilters,
} from "@/server/students/queries";
import { Avatar } from "@/components/ui/avatar";
import {
  STUDENT_STATUS_LABEL,
  STUDENT_STATUS_TONE,
} from "@/lib/students/estados";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import type { StudentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Alumnos" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * El listado de alumnado, con búsqueda y filtros.
 */
export default async function AlumnosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireAcademy();
  const params = await searchParams;

  const filters: StudentFilters = {
    search: readParam(params, "q"),
    status: (readParam(params, "estado") as StudentStatus | "ALL") ?? "ALL",
    courseId: readParam(params, "curso"),
    page: Number(readParam(params, "pagina") ?? 1),
  };

  const [{ items, total, page, pageCount }, cursos] = await Promise.all([
    listStudents(ctx.db, filters),
    loadCourseOptions(ctx.db),
  ]);

  const puedeCrear = ctx.permissions.has("students.write");
  const sinFiltros = !filters.search && filters.status === "ALL" && !filters.courseId;

  return (
    <>
      <PageHeader
        title="Alumnos"
        description={`${total} ${total === 1 ? "alumno" : "alumnos"} en ${ctx.academy.name}.`}
        actions={
          puedeCrear ? (
            <Button asChild size="sm">
              <Link href="/gestion/alumnos/nuevo">
                <Plus aria-hidden />
                Nuevo alumno
              </Link>
            </Button>
          ) : null
        }
      />

      <form className="flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={filters.search}
            placeholder="Buscar por nombre, correo o expediente"
            aria-label="Buscar alumnos"
            className="pl-9"
          />
        </div>

        <Select
          name="estado"
          defaultValue={filters.status}
          aria-label="Filtrar por estado"
          className="sm:w-44"
        >
          <option value="ALL">Todos los estados</option>
          {Object.entries(STUDENT_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Select
          name="curso"
          defaultValue={filters.courseId ?? ""}
          aria-label="Filtrar por curso"
          className="sm:w-56"
        >
          <option value="">Todos los cursos</option>
          {cursos.map((curso) => (
            <option key={curso.id} value={curso.id}>
              {curso.oppositionEdition.opposition.name} · {curso.name}
            </option>
          ))}
        </Select>

        <Button type="submit" variant="secondary" size="md">
          Filtrar
        </Button>
      </form>

      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title={sinFiltros ? "Todavía no hay alumnos" : "Ningún alumno coincide"}
            description={
              sinFiltros
                ? "Da de alta al primero o importa tu listado desde Excel."
                : "Prueba con otros filtros o borra la búsqueda."
            }
            action={
              sinFiltros && puedeCrear ? (
                <Button asChild size="sm">
                  <Link href="/gestion/alumnos/nuevo">Nuevo alumno</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {/*
              Lista de enlaces, no una tabla.

              Era una tabla con el enlace SOLO en el nombre, y eso hacía que la
              fila pareciera pulsable y no lo fuera: se pincha en el correo, en
              el curso o en el estado y no pasa nada. Aquí la fila entera es un
              enlace, que es lo que espera cualquiera, y sigue viéndose en
              columnas alineadas.
            */}
            <div
              aria-hidden
              className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] gap-4 border-b border-line bg-surface-muted px-4 py-2.5 font-mono text-[0.65rem] uppercase tracking-wider text-ink-muted sm:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]"
            >
              <span>Alumno</span>
              <span className="hidden sm:block">Expediente</span>
              <span className="hidden md:block">Curso · grupo</span>
              <span>Estado</span>
              <span className="hidden lg:block">Última actividad</span>
            </div>

            <ul className="divide-y divide-[var(--border-subtle)]">
              {items.map((alumno) => {
                const estado = alumno.studentProfile?.status ?? "ACTIVE";
                const matricula = alumno.enrollments[0];
                return (
                  <li key={alumno.id}>
                    <Link
                      href={`/gestion/alumnos/${alumno.id}`}
                      className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1fr)] md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Avatar
                          nombre={`${alumno.user.firstName} ${alumno.user.lastName ?? ""}`}
                          url={alumno.user.avatarUrl}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {alumno.user.firstName} {alumno.user.lastName ?? ""}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">
                            {alumno.user.email}
                          </span>
                        </span>
                      </span>

                      <span className="hidden truncate text-ink-soft sm:block">
                        {alumno.studentProfile?.code ?? "—"}
                      </span>

                      <span className="hidden min-w-0 md:block">
                        {matricula ? (
                          <>
                            <span className="block truncate text-ink-soft">
                              {matricula.course.name}
                            </span>
                            <span className="block truncate text-xs text-ink-muted">
                              {matricula.group?.name ?? "Sin grupo"}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-muted">Sin matrícula</span>
                        )}
                      </span>

                      <span>
                        <Badge tone={STUDENT_STATUS_TONE[estado]}>
                          {STUDENT_STATUS_LABEL[estado]}
                        </Badge>
                      </span>

                      <span className="hidden truncate text-ink-soft lg:block">
                        {formatDate(alumno.studentProfile?.lastActivityAt)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

      {pageCount > 1 ? (
        <nav
          aria-label="Paginación"
          className="flex items-center justify-between text-sm text-ink-muted"
        >
          <span>
            Página {page} de {pageCount}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={buildHref(params, page - 1)}>Anterior</Link>
              </Button>
            ) : null}
            {page < pageCount ? (
              <Button asChild variant="secondary" size="sm">
                <Link href={buildHref(params, page + 1)}>Siguiente</Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}

function buildHref(
  params: Record<string, string | string[] | undefined>,
  page: number,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value && key !== "pagina") query.set(key, value);
  }
  query.set("pagina", String(page));
  return `/gestion/alumnos?${query.toString()}`;
}
