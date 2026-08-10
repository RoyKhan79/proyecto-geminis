import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, GraduationCap, ListChecks, UserRound, Users } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

export default async function ManagerHomePage() {
  const ctx = await requireAcademy();
  const { db } = ctx;

  const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [alumnos, altas30, profesores, matriculasActivas, oposiciones, ultimosAlumnos] =
    await Promise.all([
      db.membership.count({
        where: { deletedAt: null, studentProfile: { is: { status: "ACTIVE" } } },
      }),
      db.membership.count({
        where: {
          deletedAt: null,
          studentProfile: { isNot: null },
          createdAt: { gte: desde30 },
        },
      }),
      db.membership.count({
        where: { deletedAt: null, teacherProfile: { isNot: null } },
      }),
      db.enrollment.count({ where: { status: "ACTIVE", deletedAt: null } }),
      db.opposition.count({ where: { status: "ACTIVE", deletedAt: null } }),
      db.membership.findMany({
        where: { deletedAt: null, studentProfile: { isNot: null } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

  const metricas = [
    { label: "Alumnos activos", value: alumnos, icon: Users, href: "/gestion/alumnos" },
    { label: "Altas (30 días)", value: altas30, icon: ArrowUpRight, href: "/gestion/alumnos" },
    { label: "Profesores", value: profesores, icon: UserRound, href: "/gestion/profesores" },
    {
      label: "Matrículas activas",
      value: matriculasActivas,
      icon: ListChecks,
      href: "/gestion/matriculas",
    },
    {
      label: "Oposiciones",
      value: oposiciones,
      icon: GraduationCap,
      href: "/gestion/oposiciones",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Hola, ${ctx.user.firstName}`}
        description={`Resumen de ${ctx.academy.name}.`}
      />

      <section
        aria-label="Métricas"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        {metricas.map((metrica) => {
          const Icon = metrica.icon;
          return (
            <Link key={metrica.label} href={metrica.href} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-[var(--shadow-raised)]">
                <CardContent className="space-y-2 p-4 pt-4">
                  <div className="flex items-center gap-2 text-ink-muted">
                    <Icon className="size-4" aria-hidden />
                    <span className="text-xs font-medium">{metrica.label}</span>
                  </div>
                  <p className="text-2xl font-semibold tabular-nums text-ink">
                    {metrica.value}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Últimas altas</h2>
            <Link
              href="/gestion/alumnos"
              className="text-xs font-medium text-accent hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {ultimosAlumnos.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              Todavía no hay alumnos dados de alta.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {ultimosAlumnos.map((alumno) => (
                <li key={alumno.id}>
                  <Link
                    href={`/gestion/alumnos/${alumno.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {alumno.user.firstName} {alumno.user.lastName ?? ""}
                      </p>
                      <p className="truncate text-xs text-ink-muted">
                        {alumno.user.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {formatDate(alumno.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
