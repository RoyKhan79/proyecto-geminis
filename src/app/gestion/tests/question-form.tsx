"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import {
  createQuestionAction,
  type AssessmentState,
} from "@/server/assessment/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Un tema al que se puede asociar la pregunta.
 */
export type TopicOption = {
  id: string;
  label: string;
  kind: string;
  depth: number;
  edition: { name: string; opposition: { name: string } };
};

/**
 * Formulario para crear o editar una pregunta del banco.
 */
export function QuestionForm({
  topics,
  puedePublicar,
}: {
  topics: TopicOption[];
  puedePublicar: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [correcta, setCorrecta] = useState(0);
  const [state, formAction, pending] = useActionState<AssessmentState, FormData>(
    createQuestionAction,
    undefined,
  );

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        <Plus aria-hidden />
        Nueva pregunta
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Nueva pregunta</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar"
          >
            <X aria-hidden />
          </Button>
        </div>

        {state?.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </p>
        ) : null}

        {state?.ok ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            Pregunta guardada.
          </p>
        ) : null}

        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tema" htmlFor="nodeId" required>
              <Select name="nodeId" required defaultValue="">
                <option value="">Elige un tema</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {"— ".repeat(Math.max(0, topic.depth - 1))}
                    {topic.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Dificultad" htmlFor="difficulty">
              <Select name="difficulty" defaultValue="MEDIUM">
                <option value="EASY">Fácil</option>
                <option value="MEDIUM">Media</option>
                <option value="HARD">Difícil</option>
              </Select>
            </Field>
          </div>

          <Field label="Enunciado" htmlFor="statement" required>
            <Textarea name="statement" rows={3} required />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">
              Opciones
              <span className="ml-2 text-xs font-normal text-ink-muted">
                Marca la correcta
              </span>
            </legend>

            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrecta(i)}
                  aria-label={`Marcar la opción ${String.fromCharCode(65 + i)} como correcta`}
                  aria-pressed={correcta === i}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    correcta === i
                      ? "border-positive bg-positive text-white"
                      : "border-line text-ink-muted hover:border-line-strong",
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </button>
                <Input
                  name={`option${i}`}
                  placeholder={
                    i < 2 ? `Opción ${String.fromCharCode(65 + i)}` : "Opcional"
                  }
                  required={i < 2}
                />
              </div>
            ))}
            <input type="hidden" name="correct" value={correcta} />
          </fieldset>

          <Field
            label="Explicación"
            htmlFor="explanation"
            hint="Se muestra al alumno tras responder. Es lo que más se agradece."
          >
            <Textarea name="explanation" rows={2} />
          </Field>

          {puedePublicar ? (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="publicar" className="size-4" />
              Publicar ya (si no, queda en borrador para revisar)
            </label>
          ) : (
            <p className="text-xs text-ink-muted">
              Se guardará como borrador: publicarla requiere permiso de revisión.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
