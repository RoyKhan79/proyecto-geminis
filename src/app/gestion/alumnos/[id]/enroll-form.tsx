"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { enrollStudentAction, type FormState } from "@/server/students/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/primitives";
import type { CourseOption } from "../student-form";

export function EnrollForm({
  membershipId,
  courses,
}: {
  membershipId: string;
  courses: CourseOption[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    enrollStudentAction,
    undefined,
  );
  const [courseId, setCourseId] = useState("");

  const grupos = courses.find((course) => course.id === courseId)?.groups ?? [];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="membershipId" value={membershipId} />

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
          Matrícula creada y acceso concedido.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Curso" htmlFor="courseId" required>
          <Select
            name="courseId"
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            required
          >
            <option value="">Elige un curso</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.oppositionEdition.opposition.name} · {course.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Grupo"
          htmlFor="groupId"
          hint={courseId ? undefined : "Elige antes un curso."}
        >
          <Select name="groupId" disabled={!courseId} defaultValue="">
            <option value="">Sin grupo</option>
            {grupos.map((grupo) => (
              <option key={grupo.id} value={grupo.id}>
                {grupo.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Importe acordado"
          htmlFor="priceCents"
          hint="En céntimos. 6900 = 69,00 €."
        >
          <Input name="priceCents" type="number" min={0} step={100} />
        </Field>

        <Field label="Observaciones" htmlFor="notes">
          <Input name="notes" />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={!courseId}>
          Matricular
        </Button>
      </div>
    </form>
  );
}
