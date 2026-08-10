"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, Radar, X } from "lucide-react";
import { createWatchAction, type RadarState } from "@/server/radar/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

export function WatchForm({
  oposiciones,
  correoAcademia,
}: {
  oposiciones: { id: string; name: string }[];
  correoAcademia: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState<RadarState, FormData>(
    createWatchAction,
    undefined,
  );

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        <Plus aria-hidden />
        Nueva vigilancia
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Radar className="size-4 text-accent" aria-hidden />
            Vigilar una oposición
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAbierto(false)}
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
            {state.ok}
          </p>
        ) : null}

        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="name" required>
              <Input name="name" placeholder="Administrativo del Estado" required />
            </Field>

            <Field
              label="Oposición a la que pertenece"
              htmlFor="oppositionId"
              hint="Si la dejas vacía, al aceptar una convocatoria se creará una oposición nueva."
            >
              <Select name="oppositionId" defaultValue="">
                <option value="">Crear oposición nueva al aceptar</option>
                {oposiciones.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Palabras que buscar"
            htmlFor="keywords"
            required
            hint="Separadas por comas. Basta con que aparezca una."
          >
            <Textarea
              name="keywords"
              rows={2}
              placeholder="administrativo, cuerpo general administrativo, auxiliar administrativo"
              required
            />
          </Field>

          <Field
            label="Palabras que descartar"
            htmlFor="excludeKeywords"
            hint="Déjalo vacío para usar la lista habitual (nombramientos, listas de admitidos, correcciones de errores…)."
          >
            <Textarea name="excludeKeywords" rows={2} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Avisar a"
              htmlFor="notifyEmails"
              hint={
                correoAcademia
                  ? `Si lo dejas vacío se avisa a ${correoAcademia}.`
                  : "Correos separados por comas."
              }
            >
              <Input name="notifyEmails" placeholder="direccion@academia.com" />
            </Field>

            <Field label="Boletines" htmlFor="fuentes">
              <Select name="fuentes" defaultValue="BOE">
                <option value="BOE">Solo el BOE</option>
                <option value="TODAS">
                  Todos los disponibles (autonómicos en preparación)
                </option>
              </Select>
            </Field>
          </div>

          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="requireCallPhrase"
              defaultChecked
              className="mt-0.5 size-4"
            />
            <span>
              Avisar solo de convocatorias nuevas
              <span className="block text-xs text-ink-muted">
                Filtra trámites como listas de admitidos o correcciones. Recomendado:
                sin esto llegan muchos correos y se dejan de leer.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Crear vigilancia
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
