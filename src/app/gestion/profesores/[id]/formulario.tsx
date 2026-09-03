"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updateTeacherAction } from "@/server/academic/actions";
import type { FormState } from "@/server/students/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";

/**
 * Los datos editables de un profesor.
 *
 * A diferencia de la ficha del alumnado, **aquí el correo sí se cambia**. En el
 * alumnado se dejó fuera porque cambiar la identidad de acceso arrastra
 * matrículas, avisos y sesiones. Un profesor es un caso más simple y más
 * frecuente —se cambia de correo al pasar de personal a contratado— y no tener
 * dónde tocarlo obligaba a darlo de alta otra vez.
 *
 * La comprobación de que ese correo no sea ya el de otra persona está en el
 * servidor, en `updateTeacherAction`, que es donde tiene que estar.
 */
export function FormularioDeProfesor({
  membershipId,
  valores,
  puedeEditar,
}: {
  membershipId: string;
  valores: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    headline: string;
    specialties: string;
  };
  puedeEditar: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateTeacherAction,
    undefined,
  );

  if (!puedeEditar) {
    return (
      <dl className="space-y-2 text-sm">
        {[
          ["Nombre", `${valores.firstName} ${valores.lastName}`.trim()],
          ["Correo", valores.email],
          ["Teléfono", valores.phone || "—"],
          ["Titulación", valores.headline || "—"],
          ["Especialidades", valores.specialties || "—"],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex justify-between gap-3">
            <dt className="text-ink-muted">{etiqueta}</dt>
            <dd className="min-w-0 truncate text-right text-ink">{valor}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="membershipId" value={membershipId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="firstName" required>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={valores.firstName}
            required
          />
        </Field>
        <Field label="Apellidos" htmlFor="lastName">
          <Input id="lastName" name="lastName" defaultValue={valores.lastName} />
        </Field>
        <Field label="Correo" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={valores.email}
            required
          />
        </Field>
        <Field label="Teléfono" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={valores.phone} />
        </Field>
      </div>

      <Field
        label="Titulación"
        htmlFor="headline"
        hint="Lo que se lee debajo de su nombre: «Derecho Administrativo»."
      >
        <Input id="headline" name="headline" defaultValue={valores.headline} />
      </Field>

      <Field
        label="Especialidades"
        htmlFor="specialties"
        hint="Separadas por comas. Salen como etiquetas en la lista."
      >
        <Input
          id="specialties"
          name="specialties"
          defaultValue={valores.specialties}
        />
      </Field>

      {state?.error ? (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-critical">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.error}
        </p>
      ) : null}

      {state?.ok ? (
        <p className="flex items-center gap-1.5 text-sm text-positive">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          Guardado.
        </p>
      ) : null}

      <Button type="submit" loading={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}
