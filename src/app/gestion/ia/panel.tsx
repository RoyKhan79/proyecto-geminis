"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import {
  generateQuestionsAction,
  indexContentAction,
  type AiState,
} from "@/server/ai/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Select,
} from "@/components/ui/primitives";

/** Copiloto del profesor: indexar material y generar preguntas en borrador. */
export function AiPanel({
  temas,
  puedeIndexar,
}: {
  temas: { id: string; label: string }[];
  puedeIndexar: boolean;
}) {
  const [genState, genAction, genPending] = useActionState<AiState, FormData>(
    generateQuestionsAction,
    undefined,
  );
  const [idxState, idxAction, idxPending] = useActionState<AiState, FormData>(
    async () => indexContentAction(),
    undefined,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden />
            Generar preguntas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <p className="text-xs text-ink-muted">
            A partir de vuestro material. Entran siempre como BORRADOR, con la
            fuente guardada, para que las revises antes de publicarlas.
          </p>

          {genState?.error ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-critical">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {genState.error}
            </p>
          ) : null}
          {genState?.respuesta ? (
            <p role="status" className="flex items-start gap-2 text-sm text-positive">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
              {genState.respuesta}
            </p>
          ) : null}

          <form action={genAction} className="space-y-3">
            <Field label="Tema" htmlFor="nodeId" required>
              <Select name="nodeId" required defaultValue="">
                <option value="">Elige el tema</option>
                {temas.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cuántas" htmlFor="cantidad">
                <Select name="cantidad" defaultValue="5">
                  <option value="3">3 preguntas</option>
                  <option value="5">5 preguntas</option>
                  <option value="10">10 preguntas</option>
                  <option value="20">20 preguntas</option>
                </Select>
              </Field>
              <Field label="Dificultad" htmlFor="dificultad">
                <Select name="dificultad" defaultValue="MEDIUM">
                  <option value="EASY">Fácil</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HARD">Difícil</option>
                </Select>
              </Field>
            </div>

            <Button type="submit" loading={genPending} className="w-full">
              Generar borradores
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Base de conocimiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5 pt-0">
          <p className="text-xs text-ink-muted">
            Procesa los documentos que hayáis autorizado y los deja listos para
            que la IA pueda citarlos. Repite el proceso cuando subas material
            nuevo; lo que no ha cambiado no se vuelve a procesar.
          </p>

          {idxState?.error ? (
            <p role="alert" className="text-sm text-critical">{idxState.error}</p>
          ) : null}
          {idxState?.respuesta ? (
            <p role="status" className="text-sm text-positive">{idxState.respuesta}</p>
          ) : null}

          {puedeIndexar ? (
            <form action={idxAction}>
              <Button type="submit" variant="secondary" loading={idxPending} className="w-full">
                <RefreshCw aria-hidden />
                Indexar material
              </Button>
            </form>
          ) : (
            <p className="text-xs text-ink-muted">
              Hace falta permiso de configuración de IA para reindexar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
