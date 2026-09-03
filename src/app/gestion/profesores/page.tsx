import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { createTeacherAction } from "@/server/academic/actions";
import { InlineCreate } from "@/components/manager/inline-create";
import { Avatar } from "@/components/ui/avatar";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Profesores" };

/**
 * El profesorado y el personal de la academia, con su rol.
 */
export default async function ProfesoresPage() {
  const ctx = await requireAcademy();
  const puedeEscribir = ctx.permissions.has("teachers.write");

  const profesores = await ctx.db.membership.findMany({
    where: { deletedAt: null, teacherProfile: { isNot: null } },
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
    select: {
      id: true,
      status: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
        },
      },
      teacherProfile: { select: { headline: true, specialties: true } },
      assignments: {
        select: {
          isCoordinator: true,
          opposition: { select: { name: true } },
          course: { select: { name: true } },
          group: { select: { name: true } },
        },
      },
      _count: { select: { taughtClasses: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Profesores"
        description="Cada profesor solo ve las oposiciones y grupos que tiene asignados."
        actions={
          puedeEscribir ? (
            <InlineCreate
              action={createTeacherAction}
              label="Nuevo profesor"
              title="Nuevo profesor"
              successMessage="Profesor dado de alta. Entra en su ficha para ponerle la foto."
              aviso="La foto se pone después, desde su ficha: hay que crear a la persona antes de tener dónde guardarla."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" htmlFor="firstName" required>
                  <Input name="firstName" required />
                </Field>
                <Field label="Apellidos" htmlFor="lastName">
                  <Input name="lastName" />
                </Field>
                <Field label="Correo electrónico" htmlFor="email" required>
                  <Input name="email" type="email" required />
                </Field>
                <Field label="Teléfono" htmlFor="phone">
                  <Input name="phone" type="tel" />
                </Field>
                <Field label="Titular" htmlFor="headline" hint="Ej.: Derecho Administrativo">
                  <Input name="headline" />
                </Field>
                <Field
                  label="Especialidades"
                  htmlFor="specialties"
                  hint="Separadas por comas."
                >
                  <Input name="specialties" placeholder="Ley 39/2015, Ley 40/2015" />
                </Field>
              </div>
            </InlineCreate>
          ) : null
        }
      />

      <Card className="overflow-hidden">
        {profesores.length === 0 ? (
          <EmptyState
            icon={<UserRound className="size-5" />}
            title="Todavía no hay profesores"
            description="Da de alta al primer preparador para asignarle oposiciones y grupos."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Profesor</Th>
                <Th className="hidden sm:table-cell">Especialidades</Th>
                <Th className="hidden md:table-cell">Asignaciones</Th>
                <Th>Clases</Th>
              </tr>
            </thead>
            <tbody>
              {profesores.map((profesor) => (
                <tr key={profesor.id} className="hover:bg-surface-muted">
                  <Td>
                    {/*
                      El enlace envuelve solo el nombre y no la fila entera: una
                      fila-enlace no se puede copiar ni abrir en otra pestaña con
                      el botón central, y aquí la gente hace las dos cosas.
                    */}
                    <Link
                      href={`/gestion/profesores/${profesor.id}`}
                      className="flex items-center gap-3"
                    >
                      <Avatar
                        nombre={`${profesor.user.firstName} ${profesor.user.lastName ?? ""}`}
                        url={profesor.user.avatarUrl}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-ink hover:underline">
                          {profesor.user.firstName} {profesor.user.lastName ?? ""}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {profesor.teacherProfile?.headline ?? profesor.user.email}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(profesor.teacherProfile?.specialties ?? []).length === 0 ? (
                        <span className="text-xs text-ink-muted">—</span>
                      ) : (
                        profesor.teacherProfile?.specialties.map((especialidad) => (
                          <Badge key={especialidad}>{especialidad}</Badge>
                        ))
                      )}
                    </div>
                  </Td>
                  <Td className="hidden text-sm text-ink-soft md:table-cell">
                    {profesor.assignments.length === 0
                      ? "Sin asignar"
                      : profesor.assignments
                          .map(
                            (asignacion) =>
                              asignacion.group?.name ??
                              asignacion.course?.name ??
                              asignacion.opposition?.name ??
                              "—",
                          )
                          .join(", ")}
                  </Td>
                  <Td className="tabular-nums text-ink-soft">
                    {profesor._count.taughtClasses}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
