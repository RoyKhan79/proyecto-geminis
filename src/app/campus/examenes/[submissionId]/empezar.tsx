"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { iniciarExamenAction, type ExamState } from "@/server/exams/actions";
import { Button } from "@/components/ui/button";

/**
 * Empezar el examen.
 *
 * Es un componente de cliente y no un `<form action={…}>` a secas porque la
 * acción puede decir que no —todavía no es la hora, el plazo se cerró— y ese
 * mensaje tiene que llegar al alumno. Una acción de formulario no devuelve
 * nada; con `useActionState` sí, y el alumno lee el motivo en lugar de pulsar
 * un botón que aparentemente no hace nada.
 */
export function BotonEmpezar({ submissionId }: { submissionId: string }) {
  const [state, formAction, pending] = useActionState<ExamState, FormData>(
    iniciarExamenAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="submissionId" value={submissionId} />

      {state?.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" loading={pending} className="w-full">
        Empezar el examen
      </Button>
    </form>
  );
}
