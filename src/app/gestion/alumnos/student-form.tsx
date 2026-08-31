"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { FormState } from "@/server/students/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { STUDENT_STATUS_LABEL } from "@/lib/students/estados";

/**
 * Un curso en el que se puede matricular al alumno.
 */
export type CourseOption = {
  id: string;
  name: string;
  oppositionEdition: { opposition: { name: string } };
  groups: { id: string; name: string }[];
};

/**
 * Los datos del formulario de alta, antes de validarlos.
 */
export type StudentFormValues = {
  firstName?: string;
  lastName?: string | null;
  email?: string;
  phone?: string | null;
  code?: string | null;
  status?: string;
  source?: string | null;
  notes?: string | null;
};

/**
 * Formulario de alta y edición de alumno.
 * En edición el correo no se toca aquí: cambiar la identidad de acceso es otra
 * operación con sus propias consecuencias (sesiones, avisos) y merece su flujo.
 */
export function StudentForm({
  action,
  values,
  courses,
  mode,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  values?: StudentFormValues;
  courses?: CourseOption[];
  mode: "create" | "edit";
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2.5 text-sm text-critical"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      ) : null}

      {state?.ok ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2.5 text-sm text-positive"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Cambios guardados.</span>
        </div>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 p-5 pt-5 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="firstName" required>
            <Input name="firstName" defaultValue={values?.firstName} required />
          </Field>

          <Field label="Apellidos" htmlFor="lastName">
            <Input name="lastName" defaultValue={values?.lastName ?? ""} />
          </Field>

          <Field
            label="Correo electrónico"
            htmlFor="email"
            required
            hint={
              mode === "edit"
                ? "El correo de acceso se cambia desde la ficha de la cuenta."
                : "Será su usuario para entrar en el Campus."
            }
          >
            <Input
              name="email"
              type="email"
              defaultValue={values?.email}
              required
              readOnly={mode === "edit"}
              className={mode === "edit" ? "bg-surface-muted" : undefined}
            />
          </Field>

          <Field label="Teléfono" htmlFor="phone">
            <Input name="phone" type="tel" defaultValue={values?.phone ?? ""} />
          </Field>

          <Field label="Nº de expediente" htmlFor="code" hint="Interno de la academia.">
            <Input name="code" defaultValue={values?.code ?? ""} />
          </Field>

          <Field label="Estado" htmlFor="status" required>
            <Select name="status" defaultValue={values?.status ?? "ACTIVE"}>
              {Object.entries(STUDENT_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="¿Cómo nos conoció?" htmlFor="source">
            <Input name="source" defaultValue={values?.source ?? ""} />
          </Field>

          {mode === "create" && courses && courses.length > 0 ? (
            <>
              <Field
                label="Matricular en"
                htmlFor="courseId"
                hint="Opcional. Puedes matricularlo después."
              >
                <Select name="courseId" defaultValue="">
                  <option value="">Sin matrícula</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.oppositionEdition.opposition.name} · {course.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Grupo" htmlFor="groupId">
                <Select name="groupId" defaultValue="">
                  <option value="">Sin grupo</option>
                  {courses.flatMap((course) =>
                    course.groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {course.name} · {group.name}
                      </option>
                    )),
                  )}
                </Select>
              </Field>
            </>
          ) : null}

          <div className="sm:col-span-2">
            <Field
              label="Observaciones internas"
              htmlFor="notes"
              hint="No las ve el alumno."
            >
              <Textarea name="notes" defaultValue={values?.notes ?? ""} rows={3} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
