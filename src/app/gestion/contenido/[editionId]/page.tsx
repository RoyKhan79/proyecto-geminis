import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Info, SlidersHorizontal, Wand2 } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, PageHeader } from "@/components/ui/primitives";
import { ContentTree, type TreeNode } from "./tree";

export const metadata: Metadata = { title: "Contenido" };

/**
 * El árbol de contenido de una convocatoria.
 *
 * Los apartados los nombra la academia. Desde aquí se sube material, se cambian
 * las banderas de cada rama y se entra al asistente de temario.
 */
export default async function ArbolContenidoPage({
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
    },
  });
  if (!edicion) notFound();

  const planos = await ctx.db.contentNode.findMany({
    where: { editionId, deletedAt: null },
    orderBy: [{ depth: "asc" }, { position: "asc" }],
    select: {
      id: true,
      parentId: true,
      label: true,
      description: true,
      kind: true,
      sectionKind: true,
      status: true,
      depth: true,
      isFree: true,
      visibleToStudents: true,
      downloadable: true,
      aiEnabled: true,
      usableForTests: true,
      watermark: true,
      estimatedMinutes: true,
      resource: {
        select: { type: true, fileId: true, externalUrl: true },
      },
    },
  });

  // Montamos el árbol en memoria: son pocos nodos y evitamos N consultas.
  const porId = new Map<string, TreeNode>();
  for (const nodo of planos) {
    porId.set(nodo.id, {
      id: nodo.id,
      parentId: nodo.parentId,
      label: nodo.label,
      description: nodo.description,
      kind: nodo.kind,
      sectionKind: nodo.sectionKind,
      status: nodo.status,
      depth: nodo.depth,
      isFree: nodo.isFree,
      visibleToStudents: nodo.visibleToStudents,
      downloadable: nodo.downloadable,
      aiEnabled: nodo.aiEnabled,
      usableForTests: nodo.usableForTests,
      watermark: nodo.watermark,
      estimatedMinutes: nodo.estimatedMinutes,
      fileId: nodo.resource?.fileId ?? null,
      resourceType: nodo.resource?.type ?? null,
      externalUrl: nodo.resource?.externalUrl ?? null,
      children: [],
    });
  }

  const raices: TreeNode[] = [];
  for (const nodo of porId.values()) {
    if (nodo.parentId) porId.get(nodo.parentId)?.children.push(nodo);
    else raices.push(nodo);
  }

  const publicados = planos.filter((n) => n.status === "PUBLISHED").length;

  return (
    <>
      <PageHeader
        title={edicion.opposition.name}
        description={`${edicion.name} · ${planos.length} elementos, ${publicados} publicados`}
        breadcrumb={
          <Link
            href="/gestion/contenido"
            className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            Contenido
          </Link>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/gestion/contenido/${editionId}/ritmo`}>
                <SlidersHorizontal aria-hidden />
                Ritmo del temario
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/gestion/contenido/${editionId}/asistente`}>
                <Wand2 aria-hidden />
                Subir temario entero
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="border-dashed">
        <CardContent className="flex gap-3 p-4 pt-4">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <p className="text-xs text-ink-muted">
            Los apartados los creas y los nombras tú: si en tu especialidad se llama
            «Programación de aula» o «Situaciones de aprendizaje», escríbelo así. El
            alumno solo verá lo que esté <strong>publicado</strong> y dentro de lo que
            tenga contratado.
          </p>
        </CardContent>
      </Card>

      <ContentTree
        editionId={editionId}
        nodes={raices}
        permisos={{
          escribir: ctx.permissions.has("content.write"),
          publicar: ctx.permissions.has("content.publish"),
          borrar: ctx.permissions.has("content.delete"),
        }}
      />
    </>
  );
}
