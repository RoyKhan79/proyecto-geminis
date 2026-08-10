"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { saveMappingAction, type ImportState } from "@/server/imports/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Select } from "@/components/ui/primitives";

export type CampoImportable = {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
};

/**
 * Paso 3 del asistente: decir qué columna del archivo es cada campo.
 * Llega con una propuesta ya hecha; el usuario solo corrige lo que falle.
 */
export function MappingForm({
  jobId,
  headers,
  fields,
  mapping,
  onDuplicate,
  defaultCourseId,
  courses,
  disabled,
}: {
  jobId: string;
  headers: string[];
  fields: CampoImportable[];
  mapping: Record<string, string>;
  onDuplicate: "update" | "skip";
  defaultCourseId: string | null;
  courses: { id: string; name: string }[];
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    saveMappingAction,
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
              label="Si el alumno ya existe"
              htmlFor="onDuplicate"
              hint="Se detecta por el correo electrónico."
            >
              <Select
                name="onDuplicate"
                defaultValue={onDuplicate}
                disabled={disabled}
              >
                <option value="update">Actualizar sus datos</option>
                <option value="skip">Saltarlo y no tocar nada</option>
              </Select>
            </Field>

            <Field
              label="Matricular a todos en"
              htmlFor="defaultCourseId"
              hint="Opcional. La columna «Curso» del archivo tiene prioridad."
            >
              <Select
                name="defaultCourseId"
                defaultValue={defaultCourseId ?? ""}
                disabled={disabled}
              >
                <option value="">Sin matrícula</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
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
