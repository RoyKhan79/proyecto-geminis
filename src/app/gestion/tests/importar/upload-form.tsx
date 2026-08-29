"use client";

import { useActionState } from "react";
import { AlertCircle, Upload } from "lucide-react";
import {
  uploadQuestionsAction,
  type QuestionImportState,
} from "@/server/imports/question-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input } from "@/components/ui/primitives";

/** Paso 1: subir el archivo con el banco de preguntas. */
export function UploadQuestionsForm() {
  const [state, formAction, pending] = useActionState<QuestionImportState, FormData>(
    uploadQuestionsAction,
    undefined,
  );

  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <form action={formAction} className="space-y-4">
          {state?.error ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {state.error}
            </p>
          ) : null}

          <Field
            label="Archivo del banco de preguntas"
            htmlFor="file"
            required
            hint="CSV, XLS o XLSX. Hasta 10 MB. Una pregunta por fila."
          >
            <Input
              id="file"
              name="file"
              type="file"
              accept=".csv,.xls,.xlsx,text/csv"
              required
            />
          </Field>

          <Button type="submit" loading={pending}>
            <Upload aria-hidden />
            Subir y continuar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
