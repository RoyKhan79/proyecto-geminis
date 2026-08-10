"use client";

import { useActionState } from "react";
import { gradeSubmissionAction, type TaskState } from "@/server/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/primitives";

/**
 * Caja de corrección de una entrega: nota, comentario y la opción de
 * devolverla para que el alumno la rehaga sin perder lo anterior.
 */
export function GradeForm({
  submissionId,
  maxScore,
  score,
  feedback,
}: {
  submissionId: string;
  maxScore: number;
  score: number | null;
  feedback: string | null;
}) {
  const [state, formAction, pending] = useActionState<TaskState, FormData>(
    gradeSubmissionAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="submissionId" value={submissionId} />

      <div className="flex flex-wrap items-end gap-2">
        <Input
          name="score"
          type="number"
          step="0.25"
          min={0}
          max={maxScore}
          defaultValue={score ?? ""}
          placeholder="Nota"
          aria-label="Nota"
          className="h-9 w-24"
        />
        <Textarea
          name="feedback"
          rows={1}
          defaultValue={feedback ?? ""}
          placeholder="Comentario para el alumno"
          className="min-h-9 flex-1"
        />
        <Button type="submit" size="sm" loading={pending}>
          Corregir
        </Button>
        <Button type="submit" name="devolver" value="1" size="sm" variant="secondary">
          Devolver
        </Button>
      </div>

      {state?.error ? (
        <p role="alert" className="text-xs text-critical">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-xs text-positive">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
