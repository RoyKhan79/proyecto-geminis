"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { signInAction, type ActionState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";

/**
 * El formulario de acceso.
 *
 * El mensaje de error es el mismo exista el correo o no: distinguirlos
 * convertiría esta pantalla en un comprobador de quién está apuntado.
 *
 * Va sin tarjeta a propósito. La página ya está partida en dos, y meter el
 * formulario en una caja dentro de la mitad izquierda añade un borde que no
 * separa nada: aquí no hay otra cosa con la que confundirlo.
 */
export function SignInForm({ cambiada = false }: { cambiada?: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    signInAction,
    undefined,
  );
  const [verClave, setVerClave] = useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {cambiada && !state?.error ? (
        <div
          role="status"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2.5 text-sm text-positive"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Contraseña cambiada. Entra con la nueva.</span>
        </div>
      ) : null}

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
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          placeholder="tu@correo.com"
          required
          autoFocus
          className="h-12 text-[0.9375rem]"
        />
      </Field>

      <Field label="Contraseña" htmlFor="password" required>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={verClave ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-12 pr-12 text-[0.9375rem]"
          />
          {/*
            Ver lo que se escribe. No es un capricho: en un móvil, con una
            contraseña larga y el teclado tapando media pantalla, es la
            diferencia entre entrar y pedir que te la cambien.
          */}
          <button
            type="button"
            onClick={() => setVerClave((v) => !v)}
            aria-label={verClave ? "Ocultar la contraseña" : "Ver la contraseña"}
            aria-pressed={verClave}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[var(--radius-control)] text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          >
            {verClave ? (
              <EyeOff className="size-[1.05rem]" aria-hidden />
            ) : (
              <Eye className="size-[1.05rem]" aria-hidden />
            )}
          </button>
        </div>
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Entrar
      </Button>

      <div className="text-center">
        <Link
          href="/recuperar"
          className="text-[0.8125rem] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          He olvidado mi contraseña
        </Link>
      </div>
    </form>
  );
}
