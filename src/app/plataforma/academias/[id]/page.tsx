import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/context";
import { prismaBase } from "@/lib/db/client";
import { type CodigoModulo } from "@/lib/modules/catalogo";
import { PageHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { SelectorDeModulos } from "./selector";

export const metadata: Metadata = { title: "Módulos de la academia" };

/**
 * Qué tiene contratado una academia, y a qué precio.
 *
 * Solo el superadministrador. Desde aquí se compone su pack y se ve el total al
 * instante, que es lo que permite vender por teléfono sin colgar a recalcular.
 */
export default async function ModulosDeAcademiaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;

  const academia = await prismaBase.academy.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      moduleDiscountPercent: true,
      deletedAt: true,
      modules: {
        select: {
          module: true,
          active: true,
          priceCents: true,
          activatedAt: true,
          deactivatedAt: true,
        },
      },
      _count: { select: { memberships: true } },
    },
  });

  if (!academia || academia.deletedAt) notFound();

  const activos = academia.modules
    .filter((m) => m.active)
    .map((m) => m.module as CodigoModulo);

  const preciosPactados: Partial<Record<CodigoModulo, number>> = {};
  for (const fila of academia.modules) {
    if (fila.priceCents !== null) {
      preciosPactados[fila.module as CodigoModulo] = fila.priceCents;
    }
  }

  const retirados = academia.modules
    .filter((m) => !m.active)
    .sort(
      (a, b) => (b.deactivatedAt?.getTime() ?? 0) - (a.deactivatedAt?.getTime() ?? 0),
    );

  return (
    <>
      <PageHeader
        title={academia.name}
        description={`/${academia.slug} · ${academia._count.memberships} personas · alta ${formatDate(academia.createdAt)}`}
        breadcrumb={
          <Link
            href="/plataforma"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Plataforma
          </Link>
        }
      />

      <SelectorDeModulos
        academyId={academia.id}
        inicial={activos}
        preciosPactados={preciosPactados}
        descuentoPactado={academia.moduleDiscountPercent}
      />

      {retirados.length > 0 ? (
        <section className="max-w-2xl space-y-2 pt-4">
          <h2 className="text-sm font-semibold text-ink">Módulos retirados</h2>
          <p className="text-sm text-ink-muted">
            Se conservan para poder responder qué tuvo contratado esta academia y
            hasta cuándo. Si vuelve a contratarlos, se reactivan con su precio.
          </p>
          <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-card)] border border-line bg-surface">
            {retirados.map((fila) => (
              <li
                key={fila.module}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="text-ink">{fila.module}</span>
                <span className="text-xs text-ink-muted">
                  de {formatDate(fila.activatedAt)} a {formatDate(fila.deactivatedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
