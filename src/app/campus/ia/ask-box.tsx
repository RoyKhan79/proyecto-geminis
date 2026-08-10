"use client";

import { useActionState } from "react";
import { AlertCircle, Send, Sparkles } from "lucide-react";
import { askStudentAction, type AiState } from "@/server/ai/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Select, Textarea } from "@/components/ui/primitives";

const SUGERENCIAS = [
  "Explícame esto de otra forma",
  "Hazme un resumen del tema",
  "Ponme un ejemplo práctico",
  "Hazme cinco preguntas de este tema",
];

export function AskBox({
  temas,
  temaActual,
}: {
  temas: { id: string; label: string }[];
  temaActual: string | null;
}) {
  const [state, formAction, pending] = useActionState<AiState, FormData>(
    askStudentAction,
    undefined,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4 pt-4">
          <form action={formAction} className="space-y-3">
            {temas.length > 0 ? (
              <Select
                name="nodeId"
                defaultValue={temaActual ?? ""}
                aria-label="Sobre qué tema"
              >
                <option value="">Sobre todo mi temario</option>
                {temas.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </Select>
            ) : null}

            <Textarea
              name="pregunta"
              rows={3}
              placeholder="¿Qué plazo hay para resolver un procedimiento?"
              required
            />

            <div className="flex flex-wrap gap-1.5">
              {SUGERENCIAS.map((sugerencia) => (
                <span
                  key={sugerencia}
                  className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-muted"
                >
                  {sugerencia}
                </span>
              ))}
            </div>

            <Button type="submit" loading={pending} className="w-full">
              <Send aria-hidden />
              Preguntar
            </Button>
          </form>
        </CardContent>
      </Card>

      {state?.error ? (
        <Card>
          <CardContent className="flex items-start gap-2 p-4 pt-4 text-sm text-critical">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </CardContent>
        </Card>
      ) : null}

      {state?.respuesta ? (
        <Card>
          <CardContent className="space-y-3 p-4 pt-4">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <p className="whitespace-pre-line text-sm text-ink">{state.respuesta}</p>
            </div>

            {state.fuentes && state.fuentes.length > 0 ? (
              <div className="border-t border-line pt-3">
                <p className="text-xs font-medium text-ink">Fuentes utilizadas</p>
                <ul className="mt-1 space-y-0.5">
                  {state.fuentes.map((fuente) => (
                    <li key={fuente.numero} className="text-xs text-ink-muted">
                      [{fuente.numero}] {fuente.titulo}
                      {fuente.localizador ? ` · ${fuente.localizador}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : state.sinFuentes ? (
              <p className="border-t border-line pt-3 text-xs text-ink-muted">
                No se ha usado ninguna fuente porque no se ha encontrado material.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
