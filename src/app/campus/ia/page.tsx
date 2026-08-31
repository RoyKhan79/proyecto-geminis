import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { requireAcademy } from "@/lib/auth/context";
import { loadGrants } from "@/server/campus/queries";
import { studentNodeWhere } from "@/lib/access/content-access";
import { Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { AskBox } from "./ask-box";
import { CampusTitulo } from "@/components/campus/titulo";

export const metadata: Metadata = { title: "Geminis IA" };

/**
 * El asistente del alumno.
 *
 * Solo responde con el material que tiene contratado y abierto, y cita de dónde
 * sale cada cosa. Si no encuentra nada, lo dice en lugar de inventar.
 */
export default async function IaCampusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireAcademy();
  const params = await searchParams;
  const nodeId = typeof params.tema === "string" ? params.tema : null;

  if (!ctx.permissions.has("ai.student")) {
    return (
      <Card>
        <EmptyState
          icon={<Sparkles className="size-5" />}
          title="Tu academia no tiene el asistente activado"
          description="Consúltalo con ella si te interesa."
        />
      </Card>
    );
  }

  const grants = await loadGrants(ctx.academy.id, ctx.membershipId);

  // Temas sobre los que puede preguntar: exactamente los que puede estudiar.
  const temas = await ctx.db.contentNode.findMany({
    where: { kind: "TOPIC", ...studentNodeWhere(grants) },
    orderBy: [{ path: "asc" }, { position: "asc" }],
    select: { id: true, label: true },
  });

  const contexto = nodeId ? temas.find((t) => t.id === nodeId) : null;

  return (
    <>
      <div className="space-y-1">
        <CampusTitulo>Pregunta a Geminis</CampusTitulo>
        <p className="text-sm text-ink-muted">
          Responde con el material de tu academia y te dice de dónde lo saca.
        </p>
      </div>

      <AskBox temas={temas} temaActual={contexto?.id ?? null} />

      <Card className="border-dashed">
        <CardContent className="p-4 pt-4">
          <p className="text-xs text-ink-muted">
            Geminis solo usa el material de tu academia, no internet. Si algo no
            está en tu temario, te lo dirá en vez de inventárselo. Y si crees que
            una respuesta no encaja con lo que ha dicho tu preparador, hazle caso
            a tu preparador.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
