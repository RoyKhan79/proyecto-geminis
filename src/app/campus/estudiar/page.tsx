import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight, Lock } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import {
  loadAccessibleSections,
  loadGrants,
  loadStudentEditions,
} from "@/server/campus/queries";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { CampusTitulo } from "@/components/campus/titulo";

export const metadata: Metadata = { title: "Estudiar" };

/**
 * Índice de estudio.
 *
 * Las secciones que ve el alumno son las que la ACADEMIA ha creado y nombrado,
 * y solo aquellas que su producto le da. Geminis no impone ni "Temario" ni
 * "Tests": lee el árbol y pinta lo que hay.
 */
export default async function EstudiarPage() {
  const ctx = await requireAcademy();
  const grants = await loadGrants(ctx.academy.id, ctx.membershipId);
  const matriculas = await loadStudentEditions(ctx.db, ctx.membershipId);

  const ediciones = [
    ...new Map(
      matriculas.map((m) => [m.course.oppositionEdition.id, m.course.oppositionEdition]),
    ).values(),
  ];

  if (ediciones.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="Sin oposiciones activas"
          description="Cuando estés matriculado verás aquí tu material de estudio."
        />
      </Card>
    );
  }

  const bloques = await Promise.all(
    ediciones.map(async (edicion) => ({
      edicion,
      secciones: await loadAccessibleSections(ctx.db, grants, edicion.id),
    })),
  );

  return (
    <>
      <CampusTitulo>Estudiar</CampusTitulo>

      {bloques.map(({ edicion, secciones }) => (
        <section key={edicion.id} className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">
            {edicion.opposition.name}
            <span className="ml-1.5 font-normal text-ink-muted">{edicion.name}</span>
          </h2>

          {secciones.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Lock className="size-5" />}
                title="Tu plan no incluye contenido en esta oposición"
                description="Habla con tu academia si crees que deberías tener acceso."
              />
            </Card>
          ) : (
            <Card className="divide-y divide-[var(--border-subtle)]">
              {secciones.map((seccion) => (
                <Link
                  key={seccion.id}
                  href={`/campus/estudiar/${seccion.id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{seccion.label}</p>
                    {seccion.description ? (
                      <p className="line-clamp-2 text-sm text-ink-muted">
                        {seccion.description}
                      </p>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-ink-muted"
                    aria-hidden
                  />
                </Link>
              ))}
            </Card>
          )}
        </section>
      ))}

      <Card className="border-dashed">
        <CardContent className="p-4 pt-4">
          <p className="text-xs text-ink-muted">
            Solo aparece el material incluido en lo que tienes contratado. Si tu
            academia te añade un pack, se verá aquí automáticamente.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
