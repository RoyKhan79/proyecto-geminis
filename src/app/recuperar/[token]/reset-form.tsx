"use client";

import { useActionState } from "react";
import { AlertCircle, KeyRound } from "lucide-react";
import {
  resetPasswordAction,
  type RecoveryState,
} from "@/server/auth/recovery-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input } from "@/components/ui/primitives";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<RecoveryState, FormData>(
    resetPasswordAction,
    undefined,
  );

  return (
    <Card>
      <CardContent className="p-5 pt-5">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />

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
            label="Nueva contraseña"
            htmlFor="password"
            required
            hint="Al menos 10 caracteres. Una frase que recuerdes es mejor que una palabra rara."
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
              autoFocus
            />
          </Field>

          <Field label="Repítela" htmlFor="repeat" required>
            <Input
              id="repeat"
              name="repeat"
              type="password"
              autoComplete="new-password"
              minLength={10}
              required
            />
          </Field>

          <p className="text-xs text-ink-muted">
            Al cambiarla se cerrarán todas tus sesiones abiertas, también en el
            móvil. Tendrás que volver a entrar.
          </p>

          <Button type="submit" loading={pending} className="w-full">
            <KeyRound aria-hidden />
            Guardar y entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
