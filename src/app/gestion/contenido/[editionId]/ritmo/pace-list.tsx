"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from "lucide-react";
import {
  releaseUpToAction,
  setNodeReleaseAction,
  type ReleaseState,
} from "@/server/content/release-actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, Input, Select } from "@/components/ui/primitives";
import { cn, formatDate } from "@/lib/utils";

export type TemaRitmo = {
  id: string;
  label: string;
  bloque: string | null;
  publicado: boolean;
  /// Reglas de apertura: por grupo o para todos.
  reglas: { groupId: string | null; isOpen: boolean; releasedAt: string }[];
  recursos: number;
  preguntas: number;
};

export type GrupoRitmo = { id: string; name: string; curso: string };

/**
 * Panel del ritmo del temario.
 *
 * Pensado para el gesto real del profesor: "hoy hemos dado el tema 7, ábrelo".
 * Por eso lo primero es el botón «Abrir hasta aquí» y no una lista de casillas.
 */
export function PaceList({
  editionId,
  temas,
  grupos,
}: {
  editionId: string;
  temas: TemaRitmo[];
  grupos: GrupoRitmo[];
}) {
  const [grupoId, setGrupoId] = useState<string>("");
  const [state, formAction, pending] = useActionState<ReleaseState, FormData>(
    setNodeReleaseAction,
    undefined,
  );
  const [upState, upAction, upPending] = useActionState<ReleaseState, FormData>(
    releaseUpToAction,
    undefined,
  );

  const mensaje = state ?? upState;

  /** Estado de un tema para el grupo que se está mirando. */
  function estadoDe(tema: TemaRitmo) {
    const ahora = Date.now();
    const paraTodos = tema.reglas.find((r) => r.groupId === null);
    const paraGrupo = grupoId
      ? tema.reglas.find((r) => r.groupId === grupoId)
      : undefined;

    // La regla del grupo que se está mirando manda sobre la general.
    const regla = paraGrupo ?? paraTodos;

    if (tema.reglas.length === 0) {
      return tema.publicado
        ? ({ tipo: "abierto", desde: null } as const)
        : ({ tipo: "cerrado" } as const);
    }
    if (!regla || !regla.isOpen) return { tipo: "cerrado" } as const;
    if (new Date(regla.releasedAt).getTime() > ahora) {
      return { tipo: "programado", desde: regla.releasedAt } as const;
    }
    return {
      tipo: "abierto",
      desde: regla.releasedAt,
      soloGrupo: Boolean(paraGrupo && !paraTodos),
    } as const;
  }

  const abiertos = temas.filter((t) => estadoDe(t).tipo === "abierto").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 space-y-1.5">
              <span className="block text-sm font-medium text-ink">
                Estás abriendo temario para
              </span>
              <Select
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
                aria-label="Grupo"
              >
                <option value="">Todos los grupos</option>
                {grupos.map((grupo) => (
                  <option key={grupo.id} value={grupo.id}>
                    {grupo.curso} · {grupo.name}
                  </option>
                ))}
              </Select>
            </label>

            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {abiertos}
                <span className="text-base text-ink-muted">/{temas.length}</span>
              </p>
              <p className="text-xs text-ink-muted">temas abiertos</p>
            </div>
          </div>

          <p className="text-xs text-ink-muted">
            {grupoId
              ? "Lo que abras aquí lo verá solo ese grupo. El resto seguirá como estaba."
              : "Lo que abras aquí lo verán todos los grupos de la convocatoria."}
          </p>
        </CardContent>
      </Card>

      {mensaje?.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {mensaje.error}
        </p>
      ) : null}

      {mensaje?.ok ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {mensaje.ok}
        </p>
      ) : null}

      <Card className="divide-y divide-[var(--border-subtle)]">
        {temas.map((tema, indice) => {
          const estado = estadoDe(tema);
          const abierto = estado.tipo === "abierto";

          return (
            <div
              key={tema.id}
              className={cn(
                "flex flex-wrap items-center gap-3 px-4 py-3",
                !abierto && "bg-surface-muted/40",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  abierto
                    ? "bg-positive-soft text-positive"
                    : estado.tipo === "programado"
                      ? "bg-caution-soft text-caution"
                      : "bg-surface-muted text-ink-muted",
                )}
              >
                {indice + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm",
                    abierto ? "font-medium text-ink" : "text-ink-muted",
                  )}
                >
                  {tema.label}
                </p>
                <p className="text-xs text-ink-muted">
                  {[
                    tema.bloque,
                    `${tema.recursos} ${tema.recursos === 1 ? "documento" : "documentos"}`,
                    `${tema.preguntas} ${tema.preguntas === 1 ? "pregunta" : "preguntas"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              {estado.tipo === "programado" ? (
                <Badge tone="caution">
                  <CalendarClock className="size-3" aria-hidden />
                  Se abre el {formatDate(estado.desde)}
                </Badge>
              ) : abierto ? (
                <Badge tone="positive">
                  <Unlock className="size-3" aria-hidden />
                  {"soloGrupo" in estado && estado.soloGrupo ? "Solo este grupo" : "Visible"}
                </Badge>
              ) : (
                <Badge>
                  <Lock className="size-3" aria-hidden />
                  Oculto
                </Badge>
              )}

              <div className="flex shrink-0 items-center gap-1.5">
                <form action={formAction}>
                  <input type="hidden" name="nodeId" value={tema.id} />
                  <input type="hidden" name="editionId" value={editionId} />
                  <input type="hidden" name="groupId" value={grupoId} />
                  <input
                    type="hidden"
                    name="accion"
                    value={abierto ? "cerrar" : "abrir"}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant={abierto ? "ghost" : "secondary"}
                    loading={pending}
                  >
                    {abierto ? (
                      <>
                        <EyeOff aria-hidden />
                        Ocultar
                      </>
                    ) : (
                      <>
                        <Eye aria-hidden />
                        Mostrar
                      </>
                    )}
                  </Button>
                </form>

                <form action={upAction}>
                  <input type="hidden" name="nodeId" value={tema.id} />
                  <input type="hidden" name="editionId" value={editionId} />
                  <input type="hidden" name="groupId" value={grupoId} />
                  <Button
                    type="submit"
                    size="sm"
                    variant="ghost"
                    loading={upPending}
                    title="Abre este tema y todos los anteriores; cierra los siguientes"
                  >
                    Hasta aquí
                  </Button>
                </form>
              </div>

              {!abierto && estado.tipo !== "programado" ? (
                <form
                  action={formAction}
                  className="flex w-full items-center gap-2 sm:w-auto"
                >
                  <input type="hidden" name="nodeId" value={tema.id} />
                  <input type="hidden" name="editionId" value={editionId} />
                  <input type="hidden" name="groupId" value={grupoId} />
                  <input type="hidden" name="accion" value="programar" />
                  <Input
                    type="date"
                    name="fecha"
                    aria-label={`Programar apertura de ${tema.label}`}
                    className="h-8 w-auto text-xs"
                  />
                  <Button type="submit" size="sm" variant="ghost">
                    Programar
                  </Button>
                </form>
              ) : null}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
