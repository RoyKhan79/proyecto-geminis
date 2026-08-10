"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { signInAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input } from "@/components/ui/primitives";

export function SignInForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signInAction,
    undefined,
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <form action={formAction} className="space-y-4" noValidate>
          {state?.error ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2.5 text-sm text-critical"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{state.error}</span>
            </div>
          ) : null}

          <Field label="Correo electrónico" htmlFor="email" required>
            <Input
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              placeholder="tu@correo.com"
              required
              autoFocus
            />
          </Field>

          <Field label="Contraseña" htmlFor="password" required>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>

          <Button type="submit" className="w-full" loading={pending}>
            Entrar
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
