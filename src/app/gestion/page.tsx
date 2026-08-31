import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, GraduationCap, ListChecks, UserRound, Users } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { loadAcademyOverview } from "@/server/dashboard/queries";
import {
  Card,
  CardContent,
  IconTile,
  PageHeader,
  type IconTone,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Inicio" };

/**
 * La pantalla de inicio de Manager.
 *
 * Lo que hay que mirar hoy: cobros pendientes, entregas sin corregir y quien
 * lleva días sin entrar.
 */
export default async function ManagerHomePage() {
  const ctx = await requireAcademy();
  const { db } = ctx;

  const resumen = await loadAcademyOverview(db);

  /*
   * Cada cifra lleva el color de la sección a la que lleva, el mismo que tiene
   * en la barra lateral. En cinco pastillas seguidas el color es lo que
   * distingue una de otra antes de leer la etiqueta, y al hacerlo también
   * enseña dónde hay que pulsar para ver el detalle.
   *
   * «Altas» va en verde y no en el violeta de Alumnos aunque lleve allí: es
   * crecimiento, y ese es el único sitio del panel donde el color dice algo
   * más que a dónde vas.
   */
  const metricas: {
    label: string;
    value: number;
    icon: typeof Users;
    href: string;
    tone: IconTone;
  }[] = [
    {
      label: "Alumnos activos",
      value: resumen.alumnosActivos,
      icon: Users,
      href: "/gestion/alumnos",
      tone: "indigo",
    },
    {
      label: "Altas (30 días)",
      value: resumen.altasUltimos30,
      icon: ArrowUpRight,
      href: "/gestion/alumnos",
      tone: "emerald",
    },
    {
      label: "Profesores",
      value: resumen.profesores,
      icon: UserRound,
      href: "/gestion/profesores",
      tone: "violet",
    },
    {
      label: "Matrículas activas",
      value: resumen.matriculasActivas,
      icon: ListChecks,
      href: "/gestion/matriculas",
      tone: "teal",
    },
    {
      label: "Oposiciones",
      value: resumen.oposiciones,
      icon: GraduationCap,
      href: "/gestion/oposiciones",
      tone: "amber",
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
            <Link
              key={metrica.label}
              href={metrica.href}
              className="card-interactive group rounded-[var(--radius-card)] bg-surface p-5"
            >
              {/*
                El icono en su pastilla arriba y la cifra grande debajo, en la
                serif de la marca. Un número a 24 px en la misma tipografía que
                su etiqueta no destaca: parece un dato más de un formulario. A
                36 px, con la serif y las cifras tabulares, se lee desde el otro
                lado de la mesa, que es para lo que existe un panel.
              */}
              <IconTile tone={metrica.tone} size="sm" className="size-9">
                <Icon />
              </IconTile>
              <p className="mt-3.5 text-[0.8125rem] font-medium leading-snug text-ink-muted">
                {metrica.label}
              </p>
              <p className="cifra mt-1.5 text-[2.25rem] text-ink">{metrica.value}</p>
            </Link>
          );
        })}
      </section>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-line/70 px-6 py-4">
            <h2 className="font-display text-[1.0625rem] font-semibold tracking-[-0.015em] text-ink">
              Últimas altas
            </h2>
            <Link
              href="/gestion/alumnos"
              className="text-xs font-medium text-accent hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {resumen.ultimasAltas.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              Todavía no hay alumnos dados de alta.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {resumen.ultimasAltas.map((alumno) => (
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
