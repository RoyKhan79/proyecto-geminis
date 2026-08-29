"use client";

import { useActionState } from "react";
import { AlertCircle, MailCheck, Send } from "lucide-react";
import {
  requestRecoveryAction,
  type RecoveryState,
} from "@/server/auth/recovery-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input } from "@/components/ui/primitives";

export function RecoveryForm() {
  const [state, formAction, pending] = useActionState<RecoveryState, FormData>(
    requestRecoveryAction,
    undefined,
  );

  // El mensaje de éxito NO dice si ese correo existe. Si lo dijera, este
  // formulario sería una forma cómoda de averiguar quién está dado de alta.
  if (state?.enviado) {
    return (
      <Card>
        <CardContent className="space-y-2 p-5 pt-5 text-center">
          <MailCheck className="mx-auto size-8 text-positive" aria-hidden />
          <p className="font-medium text-ink">Revisa tu correo</p>
          <p className="text-sm text-ink-soft">
            Si ese correo pertenece a una cuenta, te hemos enviado un enlace para
            cambiar la contraseña. Caduca en una hora.
          </p>
          <p className="text-xs text-ink-muted">
            ¿No te llega? Mira en la carpeta de correo no deseado y comprueba que
            has escrito bien la dirección.
          </p>
        </CardContent>
      </Card>
    );
  }

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

          <Field label="Correo electrónico" htmlFor="email" required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              required
              autoFocus
            />
          </Field>

          <Button type="submit" loading={pending} className="w-full">
            <Send aria-hidden />
            Enviarme el enlace
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
