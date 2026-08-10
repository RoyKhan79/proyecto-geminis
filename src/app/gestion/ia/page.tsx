import type { Metadata } from "next";
import { Database, Sparkles } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import { aiDisponible } from "@/lib/ai/gateway";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import { AiPanel } from "./panel";

export const metadata: Metadata = { title: "Geminis IA" };

export default async function IaPage() {
  const ctx = await requirePagePermission("ai.copilot");

  const [fuentes, temas, consumo] = await Promise.all([
    ctx.db.knowledgeSource.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        status: true,
        chunkCount: true,
        version: true,
        lastIndexedAt: true,
        error: true,
      },
    }),
    ctx.db.contentNode.findMany({
      where: { kind: "TOPIC", deletedAt: null },
      orderBy: [{ path: "asc" }, { position: "asc" }],
      take: 200,
      select: { id: true, label: true },
    }),
    ctx.db.aIUsage.groupBy({
      by: ["feature"],
      _sum: {
        promptTokens: true,
        completionTokens: true,
        costMilliCents: true,
      },
      _count: true,
    }),
  ]);

  const indexadas = fuentes.filter((f) => f.status === "INDEXED");
  const fragmentos = indexadas.reduce((s, f) => s + f.chunkCount, 0);
  const costeTotal = consumo.reduce(
    (s, c) => s + (c._sum.costMilliCents ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title="Geminis IA"
        description="Responde con VUESTRO material y cita de dónde sale cada dato. Nunca publica nada sin que lo apruebe una persona."
      />

      {!aiDisponible() ? (
        <Card className="border-caution">
          <CardContent className="p-4 pt-4 text-sm text-ink">
            La IA no está activada en esta instalación. Configura{" "}
            <code className="rounded bg-surface-muted px-1 text-xs">AI_PROVIDER</code> y
            la clave del proveedor en el servidor. Todo lo demás (indexación,
            permisos, citas) ya funciona y se puede preparar mientras tanto.
          </CardContent>
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metrica label="Documentos indexados" valor={indexadas.length} />
        <Metrica label="Fragmentos" valor={fragmentos} />
        <Metrica
          label="Consultas"
          valor={consumo.reduce((s, c) => s + c._count, 0)}
        />
        <Metrica
          label="Coste estimado"
          valor={`${(costeTotal / 100000).toFixed(2)} €`}
        />
      </section>

      <AiPanel temas={temas} puedeIndexar={ctx.permissions.has("ai.settings")} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4 text-ink-muted" aria-hidden />
            Base de conocimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {fuentes.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="Nada indexado todavía"
              description="Sube documentos en Contenido y pulsa «Indexar material». Solo entra lo que hayas autorizado para la IA."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {fuentes.map((fuente) => (
                <li
                  key={fuente.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {fuente.title}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {fuente.chunkCount} fragmentos · versión {fuente.version}
                      {fuente.lastIndexedAt
                        ? ` · ${formatDateTime(fuente.lastIndexedAt)}`
                        : ""}
                    </p>
                    {fuente.error ? (
                      <p className="text-xs text-critical">{fuente.error}</p>
                    ) : null}
                  </div>
                  <Badge
                    tone={fuente.status === "INDEXED" ? "positive" : "caution"}
                  >
                    {fuente.status === "INDEXED" ? "Indexado" : fuente.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <div className="border-t border-line px-5 py-3">
          <p className="text-xs text-ink-muted">
            Vuestro material nunca se usa para responder a otra academia ni para
            entrenar ningún modelo. Al proveedor solo se le envían los fragmentos
            necesarios para cada respuesta.
          </p>
        </div>
      </Card>
    </>
  );
}

function Metrica({ label, valor }: { label: string; valor: string | number }) {
  return (
    <Card>
      <CardContent className="p-4 pt-4">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-ink">{valor}</p>
      </CardContent>
    </Card>
  );
}
