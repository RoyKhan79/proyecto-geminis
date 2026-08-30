import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Info } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { Card, CardContent, EmptyState, PageHeader } from "@/components/ui/primitives";
import { PaceList, type GrupoRitmo, type TemaRitmo } from "./pace-list";

export const metadata: Metadata = { title: "Ritmo del temario" };

/**
 * El ritmo del temario: hasta dónde tiene abierto cada grupo.
 *
 * Es lo que permite subir el temario completo el primer día y que cada clase
 * vea solo por dónde va.
 */
export default async function RitmoPage({
  params,
}: {
  params: Promise<{ editionId: string }>;
}) {
  const ctx = await requirePagePermission("content.read");
  const { editionId } = await params;

  const edicion = await ctx.db.oppositionEdition.findUnique({
    where: { id: editionId },
    select: {
      id: true,
      name: true,
      opposition: { select: { name: true } },
      courses: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          groups: {
            where: { deletedAt: null },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
        },
      },
    },
  });
  if (!edicion) notFound();

  const nodos = await ctx.db.contentNode.findMany({
    where: { editionId, kind: "TOPIC", deletedAt: null },
    select: {
      id: true,
      label: true,
      path: true,
      position: true,
      status: true,
      parentId: true,
      releases: { select: { groupId: true, isOpen: true, releasedAt: true } },
      _count: {
        select: {
          children: { where: { deletedAt: null } },
          questions: { where: { deletedAt: null, status: "PUBLISHED" } },
        },
      },
    },
  });

  const padres = await ctx.db.contentNode.findMany({
    where: { editionId, kind: { in: ["FOLDER", "SECTION"] }, deletedAt: null },
    select: { id: true, label: true },
  });
  const nombrePadre = new Map(padres.map((p) => [p.id, p.label]));

  const ordenados = [...nodos].sort((a, b) =>
    a.path === b.path ? a.position - b.position : a.path.localeCompare(b.path),
  );

  const temas: TemaRitmo[] = ordenados.map((nodo) => ({
    id: nodo.id,
    label: nodo.label,
    bloque: nodo.parentId ? (nombrePadre.get(nodo.parentId) ?? null) : null,
    publicado: nodo.status === "PUBLISHED",
    reglas: nodo.releases.map((r) => ({
      groupId: r.groupId,
      isOpen: r.isOpen,
      releasedAt: r.releasedAt.toISOString(),
    })),
    recursos: nodo._count.children,
    preguntas: nodo._count.questions,
  }));

  const grupos: GrupoRitmo[] = edicion.courses.flatMap((curso) =>
    curso.groups.map((grupo) => ({
      id: grupo.id,
      name: grupo.name,
      curso: curso.name,
    })),
  );

  return (
    <>
      <PageHeader
        title="Ritmo del temario"
        description={`${edicion.opposition.name} · ${edicion.name}`}
        breadcrumb={
          <Link
            href={`/gestion/contenido/${editionId}`}
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Contenido
          </Link>
        }
      />

      <Card className="border-dashed">
        <CardContent className="flex gap-3 p-4 pt-4">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <p className="text-xs text-ink-muted">
            Sube el temario completo cuando quieras: el alumnado solo verá los temas
            que abras aquí. Los tests también se limitan a esos temas, así que nadie
            se examina de lo que aún no habéis dado. Cada grupo puede llevar su
            propio ritmo.
          </p>
        </CardContent>
      </Card>

      {temas.length === 0 ? (
        <Card>
          <EmptyState
            title="Esta convocatoria todavía no tiene temas"
            description="Créalos en Contenido y después decides aquí cuándo se ven."
          />
        </Card>
      ) : ctx.permissions.has("content.publish") ? (
        <PaceList
          editionId={editionId}
          temas={temas}
          grupos={grupos}
          ahoraISO={new Date().toISOString()}
        />
      ) : (
        <Card>
          <EmptyState
            title="Solo lectura"
            description="No tienes permiso para publicar contenido, así que no puedes cambiar el ritmo."
          />
        </Card>
      )}
    </>
  );
}
