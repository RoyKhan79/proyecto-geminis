import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import {
  listStudents,
  loadCourseOptions,
  STUDENT_STATUS_LABEL,
  STUDENT_STATUS_TONE,
  type StudentFilters,
} from "@/server/students/queries";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import type { StudentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Alumnos" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

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
          <Table>
            <thead>
              <tr>
                <Th>Alumno</Th>
                <Th className="hidden sm:table-cell">Expediente</Th>
                <Th className="hidden md:table-cell">Curso · grupo</Th>
                <Th>Estado</Th>
                <Th className="hidden lg:table-cell">Última actividad</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((alumno) => {
                const estado = alumno.studentProfile?.status ?? "ACTIVE";
                const matricula = alumno.enrollments[0];
                return (
                  <tr key={alumno.id} className="hover:bg-surface-muted">
                    <Td>
                      <Link
                        href={`/gestion/alumnos/${alumno.id}`}
                        className="block font-medium text-ink hover:text-accent"
                      >
                        {alumno.user.firstName} {alumno.user.lastName ?? ""}
                      </Link>
                      <span className="text-xs text-ink-muted">{alumno.user.email}</span>
                    </Td>
                    <Td className="hidden text-ink-soft sm:table-cell">
                      {alumno.studentProfile?.code ?? "—"}
                    </Td>
                    <Td className="hidden text-ink-soft md:table-cell">
                      {matricula ? (
                        <>
                          <span className="block">{matricula.course.name}</span>
                          <span className="text-xs text-ink-muted">
                            {matricula.group?.name ?? "Sin grupo"}
                          </span>
                        </>
                      ) : (
                        "Sin matrícula"
                      )}
                    </Td>
                    <Td>
                      <Badge tone={STUDENT_STATUS_TONE[estado]}>
                        {STUDENT_STATUS_LABEL[estado]}
                      </Badge>
                    </Td>
                    <Td className="hidden text-ink-soft lg:table-cell">
                      {formatDate(alumno.studentProfile?.lastActivityAt)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
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
