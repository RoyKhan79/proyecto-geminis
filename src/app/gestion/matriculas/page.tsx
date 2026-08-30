import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatCents, formatDate } from "@/lib/utils";
import type { EnrollmentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Matrículas" };

const ESTADO: Record<EnrollmentStatus, { label: string; tone: "positive" | "caution" | "critical" | "neutral" }> = {
  PENDING: { label: "Pendiente", tone: "caution" },
  ACTIVE: { label: "Activa", tone: "positive" },
  PAST_DUE: { label: "Impago", tone: "critical" },
  SUSPENDED: { label: "Suspendida", tone: "caution" },
  EXPIRED: { label: "Caducada", tone: "neutral" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
};

/**
 * Las matrículas de la academia.
 *
 * Matricular crea además el derecho de acceso al contenido del curso.
 */
export default async function MatriculasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAcademy();
  const params = await searchParams;
  const cursoId = typeof params.curso === "string" ? params.curso : undefined;

  // El estado llega por la URL: se valida contra los valores reales del enum en
  // lugar de confiar en la cadena que venga.
  const estadoBruto = typeof params.estado === "string" ? params.estado : "ALL";
  const estado: EnrollmentStatus | "ALL" =
    estadoBruto in ESTADO ? (estadoBruto as EnrollmentStatus) : "ALL";

  const [matriculas, cursos] = await Promise.all([
    ctx.db.enrollment.findMany({
      where: {
        deletedAt: null,
        ...(estado !== "ALL" ? { status: estado } : {}),
        ...(cursoId ? { courseId: cursoId } : {}),
      },
      orderBy: { startDate: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        startDate: true,
        priceCents: true,
        student: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        course: {
          select: {
            name: true,
            oppositionEdition: {
              select: { name: true, opposition: { select: { name: true } } },
            },
          },
        },
        group: { select: { name: true } },
        entitlements: { select: { id: true, status: true } },
      },
    }),
    ctx.db.course.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Matrículas"
        description="Matricular crea además el derecho de acceso al contenido correspondiente."
      />

      <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select name="estado" defaultValue={estado} aria-label="Estado" className="sm:w-48">
          <option value="ALL">Todos los estados</option>
          {Object.entries(ESTADO).map(([value, config]) => (
            <option key={value} value={value}>
              {config.label}
            </option>
          ))}
        </Select>
        <Select name="curso" defaultValue={cursoId ?? ""} aria-label="Curso" className="sm:w-64">
          <option value="">Todos los cursos</option>
          {cursos.map((curso) => (
            <option key={curso.id} value={curso.id}>
              {curso.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <Card className="overflow-hidden">
        {matriculas.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-5" />}
            title="No hay matrículas"
            description="Matricula a un alumno desde su ficha."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Alumno</Th>
                <Th className="hidden md:table-cell">Curso</Th>
                <Th className="hidden sm:table-cell">Grupo</Th>
                <Th className="hidden lg:table-cell">Desde</Th>
                <Th>Importe</Th>
                <Th>Estado</Th>
                <Th className="hidden lg:table-cell">Acceso</Th>
              </tr>
            </thead>
            <tbody>
              {matriculas.map((matricula) => {
                const config = ESTADO[matricula.status] ?? ESTADO.PENDING;
                const accesoActivo = matricula.entitlements.some(
                  (derecho) => derecho.status === "ACTIVE",
                );
                return (
                  <tr key={matricula.id} className="hover:bg-surface-muted">
                    <Td>
                      <Link
                        href={`/gestion/alumnos/${matricula.student.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {matricula.student.user.firstName}{" "}
                        {matricula.student.user.lastName ?? ""}
                      </Link>
                    </Td>
                    <Td className="hidden text-ink-soft md:table-cell">
                      <span className="block">{matricula.course.name}</span>
                      <span className="text-xs text-ink-muted">
                        {matricula.course.oppositionEdition.opposition.name}
                      </span>
                    </Td>
                    <Td className="hidden text-ink-soft sm:table-cell">
                      {matricula.group?.name ?? "—"}
                    </Td>
                    <Td className="hidden text-ink-soft lg:table-cell">
                      {formatDate(matricula.startDate)}
                    </Td>
                    <Td className="tabular-nums text-ink-soft">
                      {formatCents(matricula.priceCents)}
                    </Td>
                    <Td>
                      <Badge tone={config.tone}>{config.label}</Badge>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <Badge tone={accesoActivo ? "positive" : "caution"}>
                        {accesoActivo ? "Concedido" : "Sin acceso"}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
