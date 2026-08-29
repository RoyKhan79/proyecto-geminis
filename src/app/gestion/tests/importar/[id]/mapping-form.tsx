"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  saveQuestionMappingAction,
  type QuestionImportState,
} from "@/server/imports/question-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Select } from "@/components/ui/primitives";

/**
 * Paso 2: decir qué columna del archivo es cada campo.
 *
 * Llega con una propuesta ya hecha a partir de los nombres de las cabeceras. La
 * academia solo corrige lo que no haya acertado.
 */
export function QuestionMappingForm({
  jobId,
  headers,
  fields,
  mapping,
  onDuplicate,
  editionId,
  editions,
  disabled,
}: {
  jobId: string;
  headers: string[];
  fields: { key: string; label: string; required: boolean; hint?: string }[];
  mapping: Record<string, string>;
  onDuplicate: "skip" | "import";
  editionId: string | null;
  editions: { id: string; name: string }[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<QuestionImportState, FormData>(
    saveQuestionMappingAction,
    undefined,
  );

  return (
    <Card>
      <CardContent className="space-y-5 p-5 pt-5">
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="jobId" value={jobId} />

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
              Asignación guardada. Revisa abajo la previsualización.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                htmlFor={`map.${field.key}`}
                required={field.required}
                hint={field.hint}
              >
                <Select
                  name={`map.${field.key}`}
                  defaultValue={mapping[field.key] ?? ""}
                  disabled={disabled}
                >
                  <option value="">— No importar —</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>

          <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <Field
              label="Si la pregunta ya está en el banco"
              htmlFor="onDuplicate"
              hint="Se compara el enunciado sin acentos ni signos: «¿Qué plazo hay?» y «Que plazo hay» son la misma."
            >
              <Select name="onDuplicate" defaultValue={onDuplicate} disabled={disabled}>
                <option value="skip">Saltarla</option>
                <option value="import">Importarla igualmente</option>
              </Select>
            </Field>

            <Field
              label="Convocatoria"
              htmlFor="editionId"
              hint="A qué convocatoria pertenecen estas preguntas. También acota la búsqueda de temas por nombre."
            >
              <Select
                name="editionId"
                defaultValue={editionId ?? ""}
                disabled={disabled}
              >
                <option value="">Sin convocatoria</option>
                {editions.map((edition) => (
                  <option key={edition.id} value={edition.id}>
                    {edition.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {!disabled ? (
            <div className="flex justify-end">
              <Button type="submit" variant="secondary" loading={pending}>
                Guardar y previsualizar
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
