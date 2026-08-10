import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, GraduationCap } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Contenido" };

export default async function ContenidoPage() {
  const ctx = await requirePagePermission("content.read");

  const oposiciones = await ctx.db.opposition.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      editions: {
        where: { deletedAt: null },
        orderBy: { name: "desc" },
        select: {
          id: true,
          name: true,
          _count: { select: { contentNodes: true } },
        },
      },
    },
  });

  const conContenido = oposiciones.filter((o) => o.editions.length > 0);

  return (
    <>
      <PageHeader
        title="Contenido"
        description="Organiza el material como trabajáis vosotros. Los apartados los creas y los nombras tú."
      />

      {conContenido.length === 0 ? (
        <Card>
          <EmptyState
            icon={<GraduationCap className="size-5" />}
            title="Todavía no hay convocatorias"
            description="Crea antes una oposición con su convocatoria para poder subir material."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {conContenido.map((oposicion) => (
            <Card key={oposicion.id}>
              <CardContent className="space-y-3 p-5 pt-5">
                <h2 className="font-semibold text-ink">{oposicion.name}</h2>
                <ul className="space-y-2">
                  {oposicion.editions.map((edicion) => (
                    <li key={edicion.id}>
                      <Link
                        href={`/gestion/contenido/${edicion.id}`}
                        className="flex items-center gap-3 rounded-[var(--radius-control)] border border-line px-3 py-2.5 transition-colors hover:bg-surface-muted"
                      >
                        <FileText className="size-4 shrink-0 text-ink-muted" aria-hidden />
                        <span className="flex-1 text-sm font-medium text-ink">
                          {edicion.name}
                        </span>
                        <Badge>
                          {edicion._count.contentNodes}{" "}
                          {edicion._count.contentNodes === 1 ? "elemento" : "elementos"}
                        </Badge>
                        <ChevronRight
                          className="size-4 shrink-0 text-ink-muted"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
