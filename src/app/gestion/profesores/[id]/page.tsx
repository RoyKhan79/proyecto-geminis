import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import {
  quitarFotoProfesorAction,
  subirFotoProfesorAction,
} from "@/server/academic/actions";
import { FotoDePersona } from "@/components/gestion/foto-persona";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { FormularioDeProfesor } from "./formulario";

export const metadata: Metadata = { title: "Profesor" };

/**
 * LA FICHA DE UN PROFESOR
 *
 * Existía la lista y el alta, pero no había dónde entrar: un profesor mal
 * escrito el primer día se quedaba mal escrito para siempre, y no había forma
 * de ponerle cara. Esta pantalla es el equivalente de la ficha del alumnado, y
 * a propósito más corta: de un profesor interesan sus datos, sus especialidades
 * y qué tiene asignado, no un historial.
 */
export default async function FichaProfesorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireAcademy();
  const { id } = await params;
  const puedeEditar = ctx.permissions.has("teachers.write");

  const profesor = await ctx.db.membership.findFirst({
    where: { id, deletedAt: null, teacherProfile: { isNot: null } },
    select: {
      id: true,
      createdAt: true,
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
          id: true,
          isCoordinator: true,
          opposition: { select: { name: true } },
          course: { select: { name: true } },
          group: { select: { name: true } },
        },
      },
      _count: { select: { taughtClasses: true } },
    },
  });

  if (!profesor?.teacherProfile) notFound();

  const nombre = `${profesor.user.firstName} ${profesor.user.lastName ?? ""}`.trim();

  return (
    <>
      <PageHeader
        title={nombre}
        description={profesor.teacherProfile.headline ?? profesor.user.email}
        breadcrumb={
          <Link
            href="/gestion/profesores"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Profesores
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <FotoDePersona
                membershipId={profesor.id}
                nombre={nombre}
                url={profesor.user.avatarUrl}
                puedeEditar={puedeEditar}
                subir={subirFotoProfesorAction}
                quitar={quitarFotoProfesorAction}
              />
              <div className="min-w-0">
                <p className="font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em] text-ink">
                  Foto
                </p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  Pulsa encima para cambiarla. Sale en el muro de clase y en el
                  calendario del alumnado, donde ayuda a saber quién da qué.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <FormularioDeProfesor
                membershipId={profesor.id}
                valores={{
                  firstName: profesor.user.firstName,
                  lastName: profesor.user.lastName ?? "",
                  email: profesor.user.email,
                  phone: profesor.user.phone ?? "",
                  headline: profesor.teacherProfile.headline ?? "",
                  specialties: profesor.teacherProfile.specialties.join(", "),
                }}
                puedeEditar={puedeEditar}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Qué tiene asignado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              {profesor.assignments.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Sin asignar. Un profesor sin asignaciones no ve ninguna
                  oposición ni ningún grupo: se le da acceso desde el curso o el
                  grupo, no desde aquí.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {profesor.assignments.map((asignacion) => (
                    <li
                      key={asignacion.id}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="min-w-0 text-ink-soft">
                        {asignacion.group?.name ??
                          asignacion.course?.name ??
                          asignacion.opposition?.name ??
                          "—"}
                      </span>
                      {asignacion.isCoordinator ? (
                        <Badge tone="gold">Coordina</Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>En la academia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-ink-muted">Alta</span>
                <span className="text-ink">{formatDate(profesor.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-muted">Clases impartidas</span>
                <span className="tabular-nums text-ink">
                  {profesor._count.taughtClasses}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
