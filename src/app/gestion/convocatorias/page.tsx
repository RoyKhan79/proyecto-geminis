import type { Metadata } from "next";
import { ExternalLink, Radar, Trash2 } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/context";
import {
  acceptCallAction,
  deleteWatchAction,
  dismissCallAction,
  toggleWatchAction,
} from "@/server/radar/actions";
import { loadRadarPanel } from "@/server/radar/queries";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
} from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/utils";
import { WatchForm } from "./watch-form";

export const metadata: Metadata = { title: "Convocatorias" };

const ESTADO: Record<
  string,
  { label: string; tone: "info" | "positive" | "neutral" | "caution" }
> = {
  NEW: { label: "Nueva", tone: "info" },
  REVIEWING: { label: "En revisión", tone: "caution" },
  ACCEPTED: { label: "Aceptada", tone: "positive" },
  DISMISSED: { label: "Descartada", tone: "neutral" },
};

/**
 * Las convocatorias de cada oposición.
 *
 * De ellas cuelgan el temario y las preguntas, y por eso una convocatoria nueva
 * no obliga a rehacer nada.
 */
export default async function ConvocatoriasPage() {
  const ctx = await requirePagePermission("oppositions.read");
  const panel = await loadRadarPanel(ctx.db, ctx.academy.id);

  const puedeConfigurar = ctx.permissions.has("settings.write");
  const puedeAceptar = ctx.permissions.has("oppositions.write");

  return (
    <>
      <PageHeader
        title="Radar de convocatorias"
        description="Cada mañana revisamos el BOE por ti. Si sale algo de lo que preparáis, te avisamos por correo."
        actions={
          puedeConfigurar ? (
            <WatchForm
              oposiciones={panel.oposiciones}
              correoAcademia={panel.correoAcademia}
            />
          ) : null
        }
      />

      <Card className={panel.ultimaPasada ? undefined : "border-caution"}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 pt-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Radar className="size-4" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-medium text-ink">
                {panel.ultimaPasada
                  ? `Última revisión: ${formatDateTime(panel.ultimaPasada.startedAt)}`
                  : "El radar todavía no se ha ejecutado"}
              </p>
              <p className="text-xs text-ink-muted">
                {panel.ultimaPasada
                  ? `${panel.ultimaPasada.itemsScanned} anuncios analizados del boletín del ${formatDate(panel.ultimaPasada.bulletinDate)}`
                  : "Se ejecuta solo en el servidor con la tarea programada del sistema."}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums text-ink">
              {panel.nuevas.length}
            </p>
            <p className="text-xs text-ink-muted">sin revisar</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Convocatorias detectadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {panel.convocatorias.length === 0 ? (
            <EmptyState
              icon={<Radar className="size-5" />}
              title="Todavía no hemos encontrado nada"
              description={
                panel.vigilancias.length === 0
                  ? "Crea una vigilancia con las palabras de tus oposiciones y empezaremos a mirar."
                  : "Seguimos mirando cada mañana. Te avisaremos en cuanto salga algo."
              }
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {panel.convocatorias.map((convocatoria) => {
                const estado = ESTADO[convocatoria.status] ?? ESTADO.NEW;
                return (
                  <li key={convocatoria.id} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 text-sm text-ink">
                        {convocatoria.title}
                      </p>
                      <Badge tone={estado.tone}>{estado.label}</Badge>
                    </div>

                    <p className="text-xs text-ink-muted">
                      {[
                        convocatoria.source,
                        convocatoria.department,
                        formatDate(convocatoria.publishedAt),
                        convocatoria.watch?.name
                          ? `vigilancia: ${convocatoria.watch.name}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {convocatoria.url ? (
                        <Button asChild variant="ghost" size="sm">
                          <a href={convocatoria.url} target="_blank" rel="noreferrer">
                            <ExternalLink aria-hidden />
                            Ver en el boletín
                          </a>
                        </Button>
                      ) : null}

                      {puedeAceptar && convocatoria.status === "NEW" ? (
                        <>
                          <form
                            action={acceptCallAction}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="callId" value={convocatoria.id} />
                            <Input
                              name="nombre"
                              defaultValue={convocatoria.watch?.name ?? ""}
                              placeholder="Nombre de la oposición"
                              className="h-8 w-56 text-xs"
                              aria-label="Nombre de la oposición"
                            />
                            <Button type="submit" size="sm">
                              Aceptar y crear
                            </Button>
                          </form>

                          <form action={dismissCallAction}>
                            <input type="hidden" name="callId" value={convocatoria.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              Descartar
                            </Button>
                          </form>
                        </>
                      ) : null}

                      {convocatoria.status === "ACCEPTED" ? (
                        <span className="text-xs text-positive">
                          Oposición creada y lista para subir temario.
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qué estamos vigilando</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {panel.vigilancias.length === 0 ? (
            <EmptyState
              title="Sin vigilancias configuradas"
              description="Dinos qué oposiciones preparáis y las buscaremos cada mañana."
            />
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {panel.vigilancias.map((vigilancia) => (
                <li
                  key={vigilancia.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{vigilancia.name}</p>
                    <p className="text-xs text-ink-muted">
                      {vigilancia.keywords.join(" · ")}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Avisa a:{" "}
                      {vigilancia.notifyEmails.length > 0
                        ? vigilancia.notifyEmails.join(", ")
                        : (panel.correoAcademia ?? "sin destinatario")}
                      {vigilancia._count.calls > 0
                        ? ` · ${vigilancia._count.calls} hallazgos`
                        : ""}
                    </p>
                  </div>

                  <Badge tone={vigilancia.isActive ? "positive" : "neutral"}>
                    {vigilancia.isActive ? "Activa" : "Pausada"}
                  </Badge>

                  {puedeConfigurar ? (
                    <div className="flex gap-1">
                      <form action={toggleWatchAction}>
                        <input type="hidden" name="watchId" value={vigilancia.id} />
                        <input
                          type="hidden"
                          name="activar"
                          value={vigilancia.isActive ? "0" : "1"}
                        />
                        <Button type="submit" variant="ghost" size="sm">
                          {vigilancia.isActive ? "Pausar" : "Activar"}
                        </Button>
                      </form>
                      <form action={deleteWatchAction}>
                        <input type="hidden" name="watchId" value={vigilancia.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar vigilancia"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <div className="border-t border-line px-5 py-3">
          <p className="text-xs text-ink-muted">
            El radar corre solo en el servidor cada mañana; no hace falta tener el
            programa abierto. Nunca crea una oposición por su cuenta: te avisa y
            decides tú.
          </p>
        </div>
      </Card>
    </>
  );
}
