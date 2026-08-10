"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Building2, CheckCircle2, X } from "lucide-react";
import { createAcademyAction, type PlatformState } from "@/server/platform/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input, Select } from "@/components/ui/primitives";

/** Alta de una academia con su primer administrador, en un solo paso. */
export function NewAcademyForm() {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState<PlatformState, FormData>(
    createAcademyAction,
    undefined,
  );

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        <Building2 aria-hidden />
        Nueva academia
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Dar de alta una academia</h3>
          <Button variant="ghost" size="icon" onClick={() => setAbierto(false)} aria-label="Cerrar">
            <X aria-hidden />
          </Button>
        </div>

        {state?.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.ok}
          </p>
        ) : null}

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de la academia" htmlFor="name" required>
            <Input name="name" placeholder="Academia Oposita" required />
          </Field>
          <Field label="Identificador" htmlFor="slug" hint="Para la URL. Si lo dejas vacío se genera solo.">
            <Input name="slug" placeholder="academia-oposita" />
          </Field>
          <Field label="Correo de contacto" htmlFor="email" required>
            <Input name="email" type="email" required />
          </Field>
          <Field label="Plan" htmlFor="planCode">
            <Select name="planCode" defaultValue="PRO">
              <option value="STARTER">Starter</option>
              <option value="PRO">Pro</option>
              <option value="BUSINESS">Business</option>
              <option value="ENTERPRISE">Enterprise</option>
            </Select>
          </Field>

          <div className="sm:col-span-2 border-t border-line pt-4">
            <p className="text-sm font-medium text-ink">Persona responsable</p>
            <p className="text-xs text-ink-muted">
              Recibirá el rol de administrador y podrá entrar de inmediato.
            </p>
          </div>

          <Field label="Nombre" htmlFor="adminNombre" required>
            <Input name="adminNombre" required />
          </Field>
          <Field label="Apellidos" htmlFor="adminApellidos">
            <Input name="adminApellidos" />
          </Field>
          <Field label="Correo de acceso" htmlFor="adminEmail" required>
            <Input name="adminEmail" type="email" required />
          </Field>
          <Field label="Contraseña inicial" htmlFor="adminPassword" required hint="Mínimo 10 caracteres.">
            <Input name="adminPassword" type="password" minLength={10} required />
          </Field>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button type="submit" loading={pending}>Crear academia</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
