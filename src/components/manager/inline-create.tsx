"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import type { FormState } from "@/server/academic/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";

/**
 * Formulario de alta desplegable.
 *
 * Para entidades sencillas (una convocatoria, un grupo) abrir una página aparte
 * es un paso de más: la academia crea varias seguidas y quiere ver la lista
 * mientras lo hace.
 */
export function InlineCreate({
  action,
  label,
  title,
  children,
  successMessage = "Creado correctamente.",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  title: string;
  children: React.ReactNode;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined,
  );

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {label}
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
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
            {successMessage}
          </p>
        ) : null}

        <form action={formAction} className="space-y-4">
          {children}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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
