"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";
import { submitAssignmentAction, type TaskState } from "@/server/tasks/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/primitives";

/** Caja de entrega del alumno: texto y archivos. */
export function SubmitForm({
  assignmentId,
  fueraDePlazo,
  yaEntregado,
  textoPrevio,
}: {
  assignmentId: string;
  fueraDePlazo: boolean;
  yaEntregado: boolean;
  textoPrevio: string | null;
}) {
  const [state, formAction, pending] = useActionState<TaskState, FormData>(
    submitAssignmentAction,
    undefined,
  );
  const [archivos, setArchivos] = useState<string[]>([]);

  return (
    <form action={formAction} className="space-y-2 border-t border-line pt-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />

      <Textarea
        name="body"
        rows={2}
        defaultValue={textoPrevio ?? ""}
        placeholder="Escribe aquí tu respuesta o comenta lo que envías…"
      />

      <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line px-3 py-2 text-sm text-ink-soft hover:border-accent">
        <Upload className="size-4" aria-hidden />
        {archivos.length > 0 ? archivos.join(", ") : "Adjuntar archivos"}
        <input
          type="file"
          name="files"
          multiple
          className="sr-only"
          onChange={(e) =>
            setArchivos([...(e.target.files ?? [])].map((f) => f.name))
          }
        />
      </label>

      {fueraDePlazo ? (
        <p className="text-xs text-caution">
          El plazo ya ha pasado: se marcará como entrega fuera de plazo.
        </p>
      ) : null}

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

      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={pending}>
          {yaEntregado ? "Volver a entregar" : "Entregar"}
        </Button>
      </div>
    </form>
  );
}
