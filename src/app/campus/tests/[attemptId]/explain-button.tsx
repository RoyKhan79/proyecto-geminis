"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { explainMistakeAction, type AiState } from "@/server/ai/actions";
import { Button } from "@/components/ui/button";

/**
 * «¿Por qué he fallado?» debajo de cada pregunta errada.
 *
 * Se pide bajo demanda y no al cargar la corrección: la mayoría de fallos el
 * alumno ya sabe por qué son, y calcular todos sería trabajo tirado.
 */
export function ExplainButton({
  attemptId,
  questionId,
}: {
  attemptId: string;
  questionId: string;
}) {
  const [state, formAction, pending] = useActionState<AiState, FormData>(
    explainMistakeAction,
    undefined,
  );

  return (
    <div className="space-y-2">
      {state?.respuesta ? (
        <div className="rounded-[var(--radius-control)] border border-accent-soft bg-accent-soft/40 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
            <Sparkles className="size-3.5 text-accent" aria-hidden />
            Geminis IA
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">
            {state.respuesta}
          </p>
          {state.fuentes && state.fuentes.length > 0 ? (
            <ul className="mt-2 space-y-0.5">
              {state.fuentes.map((f) => (
                <li key={f.numero} className="text-xs text-ink-muted">
                  [{f.numero}] {f.titulo}
                  {f.localizador ? ` · ${f.localizador}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {state?.error ? (
        <p className="text-xs text-critical">{state.error}</p>
      ) : null}

      {state?.respuesta ? null : (
        <form action={formAction}>
          <input type="hidden" name="attemptId" value={attemptId} />
          <input type="hidden" name="questionId" value={questionId} />
          <Button type="submit" variant="ghost" size="sm" loading={pending}>
            <Sparkles aria-hidden />
            ¿Por qué he fallado?
          </Button>
        </form>
      )}
    </div>
  );
}
