import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { loadSections } from "@/server/content/tree";
import { PageHeader } from "@/components/ui/primitives";
import { AsistenteDeTemario } from "./asistente";

export const metadata: Metadata = { title: "Asistente de temario" };

/**
 * Subir un temario entero de una vez.
 *
 * La pantalla que decide si una academia llega a probar el producto o se queda
 * en la puerta: su temario está en una carpeta con sesenta PDF, y montarlo tema
 * a tema es una tarde. Con esto es un rato, y se puede deshacer.
 */
export default async function AsistentePage({
  params,
}: {
  params: Promise<{ editionId: string }>;
}) {
  const ctx = await requirePagePermission("content.write");
  const { editionId } = await params;

  const edicion = await ctx.db.oppositionEdition.findUnique({
    where: { id: editionId },
    select: {
      id: true,
      name: true,
      deletedAt: true,
      opposition: { select: { name: true } },
    },
  });
  if (!edicion || edicion.deletedAt) notFound();

  const secciones = await loadSections(ctx.db, editionId);

  return (
    <>
      <PageHeader
        title="Asistente de temario"
        description="Sube la carpeta entera de una vez. Leemos el número y el título de cada archivo, te enseñamos lo que se va a crear y solo lo creamos cuando digas."
        breadcrumb={
          <Link
            href={`/gestion/contenido/${editionId}`}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            {edicion.opposition.name} · {edicion.name}
          </Link>
        }
      />

      <AsistenteDeTemario
        secciones={secciones.map((s) => ({ id: s.id, label: s.label }))}
      />
    </>
  );
}
