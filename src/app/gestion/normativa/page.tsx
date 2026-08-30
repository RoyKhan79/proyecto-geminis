import type { Metadata } from "next";
import { AlertTriangle, Link2, Scale } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  detectReferencesAction,
  resolveAlertAction,
} from "@/server/legislation/actions";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { LegislationForms } from "./forms";

export const metadata: Metadata = { title: "Normativa" };

const AMBITO: Record<string, string> = {
  EUROPEAN: "Europea",
  STATE: "Estatal",
  REGIONAL: "Autonómica",
  LOCAL: "Local",
  OTHER: "Otra",
};

const CAMBIO: Record<string, string> = {
  CREATED: "Norma nueva",
  AMENDED: "Modificación",
  REPEALED: "Derogación",
  CORRECTED: "Corrección",
};

/**
 * La normativa que la academia sigue, enlazada con los temas que la explican.
 *
 * Cuando una ley cambia, los temas y las preguntas afectadas se marcan para
 * revisar. No se cambia nada solo.
 */
export default async function NormativaPage() {
  const ctx = await requirePagePermission("legislation.read");

  const [normas, alertas, temas] = await Promise.all([
    ctx.db.legislation.findMany({
      where: { deletedAt: null },
      orderBy: { reference: "asc" },
      select: {
        id: true,
        reference: true,
        title: true,
        scope: true,
        status: true,
        officialUrl: true,
        articles: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            title: true,
            _count: { select: { links: true } },
          },
        },
      },
    }),
    ctx.db.legislationChangeAlert.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        description: true,
        changeType: true,
        status: true,
        createdAt: true,
        impact: true,
        legislation: { select: { reference: true } },
        article: { select: { number: true } },
      },
    }),
    ctx.db.contentNode.findMany({
      where: { kind: "TOPIC", deletedAt: null },
      orderBy: [{ path: "asc" }, { position: "asc" }],
      take: 200,
      select: { id: true, label: true },
    }),
  ]);

  const puedeEscribir = ctx.permissions.has("legislation.write");
  const puedeRevisar = ctx.permissions.has("legislation.review");
  const abiertas = alertas.filter((a) => a.status === "OPEN");

  return (
    <>
      <PageHeader
        title="Normativa"
        description="Registra las leyes que dais, enlázalas con vuestros temas y preguntas, y sabrás al instante qué revisar cuando cambien."
      />

      {abiertas.length > 0 ? (
        <Card className="border-caution">
          <CardContent className="flex items-center gap-3 p-4 pt-4">
            <AlertTriangle className="size-5 shrink-0 text-caution" aria-hidden />
            <p className="text-sm text-ink">
              Hay <strong>{abiertas.length}</strong> cambios legislativos sin revisar.
              Las preguntas afectadas están marcadas y no se muestran como
              publicadas hasta que decidas.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {puedeEscribir || puedeRevisar ? (
        <LegislationForms
          normas={normas.map((n) => ({
            id: n.id,
            reference: n.reference,
            articulos: n.articles.map((a) => ({
              id: a.id,
              number: a.number,
              title: a.title,
            })),
          }))}
          temas={temas}
          puedeEscribir={puedeEscribir}
          puedeRevisar={puedeRevisar}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Alertas de cambio</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {alertas.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle className="size-5" />}
              title="Sin cambios registrados"
              description="Cuando registres un cambio, te diremos qué temas y preguntas quedan afectados."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {alertas.map((alerta) => {
                const impacto = alerta.impact as {
                  totalTemas?: number;
                  totalPreguntas?: number;
                  temas?: { id: string; label: string }[];
                } | null;

                return (
                  <li key={alerta.id} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{alerta.title}</p>
                        <p className="text-xs text-ink-muted">
                          {alerta.legislation.reference}
                          {alerta.article ? ` · artículo ${alerta.article.number}` : ""}
                          {` · ${CAMBIO[alerta.changeType]} · ${formatDate(alerta.createdAt)}`}
                        </p>
                      </div>
                      <Badge
                        tone={
                          alerta.status === "OPEN"
                            ? "caution"
                            : alerta.status === "APPLIED"
                              ? "positive"
                              : "neutral"
                        }
                      >
                        {alerta.status === "OPEN"
                          ? "Sin revisar"
                          : alerta.status === "APPLIED"
                            ? "Revisado"
                            : "Descartado"}
                      </Badge>
                    </div>

                    {alerta.description ? (
                      <p className="text-sm text-ink-soft">{alerta.description}</p>
                    ) : null}

                    <div className="rounded-[var(--radius-control)] bg-surface-muted p-3">
                      <p className="text-xs font-medium text-ink">
                        Contenido posiblemente afectado
                      </p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {impacto?.totalTemas ?? 0} temas ·{" "}
                        {impacto?.totalPreguntas ?? 0} preguntas
                      </p>
                      {impacto?.temas && impacto.temas.length > 0 ? (
                        <ul className="mt-1 space-y-0.5">
                          {impacto.temas.slice(0, 5).map((t) => (
                            <li key={t.id} className="text-xs text-ink-muted">
                              · {t.label}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    {puedeRevisar && alerta.status === "OPEN" ? (
                      <div className="flex gap-2">
                        <form action={resolveAlertAction}>
                          <input type="hidden" name="alertId" value={alerta.id} />
                          <input type="hidden" name="accion" value="aplicar" />
                          <Button type="submit" size="sm">
                            Dar por revisado
                          </Button>
                        </form>
                        <form action={resolveAlertAction}>
                          <input type="hidden" name="alertId" value={alerta.id} />
                          <input type="hidden" name="accion" value="descartar" />
                          <Button type="submit" size="sm" variant="secondary">
                            No afecta · reactivar preguntas
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Normas registradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {normas.length === 0 ? (
            <EmptyState
              icon={<Scale className="size-5" />}
              title="Todavía no hay normas"
              description="Registra las leyes que dais para poder relacionarlas con vuestro temario."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {normas.map((norma) => (
                <li key={norma.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {norma.reference}
                        <span className="ml-2 text-sm font-normal text-ink-muted">
                          {AMBITO[norma.scope]}
                        </span>
                      </p>
                      <p className="text-sm text-ink-muted">{norma.title}</p>
                    </div>
                    {puedeEscribir ? (
                      <form action={detectReferencesAction}>
                        <input type="hidden" name="legislationId" value={norma.id} />
                        <Button type="submit" variant="secondary" size="sm">
                          <Link2 aria-hidden />
                          Detectar en las preguntas
                        </Button>
                      </form>
                    ) : null}
                  </div>

                  {norma.articles.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5">
                      {norma.articles.map((articulo) => (
                        <li key={articulo.id}>
                          <Badge tone={articulo._count.links > 0 ? "accent" : "neutral"}>
                            Art. {articulo.number}
                            {articulo._count.links > 0
                              ? ` · ${articulo._count.links}`
                              : ""}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-ink-muted">
                      Sin artículos registrados todavía.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
