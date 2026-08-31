"use client";

import { useActionState, useState } from "react";
import { AlertCircle, BellRing, CheckCircle2 } from "lucide-react";
import { saveDunningAction, type BillingState } from "@/server/billing/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  Input,
} from "@/components/ui/primitives";

/**
 * LOS PLAZOS PARA RECLAMAR
 *
 * Cuándo se le recuerda a alguien que debe un recibo, cada cuánto se insiste y
 * cuándo se le pausa el acceso.
 *
 * Debajo se lee en una frase lo que va a pasar, con los números puestos. Tres
 * campos numéricos sueltos no dicen qué política tienes; la frase sí, y es
 * donde se ve si te has pasado antes de guardarlo.
 */
export function AvisosDeImpago({
  inicial,
}: {
  inicial: {
    dunningEnabled: boolean;
    dunningFirstDays: number;
    dunningEveryDays: number;
    dunningSuspendDays: number;
  };
}) {
  const [estado, accion, guardando] = useActionState<BillingState, FormData>(
    saveDunningAction,
    undefined,
  );

  const [activo, setActivo] = useState(inicial.dunningEnabled);
  const [primero, setPrimero] = useState(inicial.dunningFirstDays);
  const [cada, setCada] = useState(inicial.dunningEveryDays);
  const [corta, setCorta] = useState(inicial.dunningSuspendDays);

  const resumen = !activo
    ? "No se manda ningún aviso ni se pausa el acceso de nadie. Los impagos se reclaman a mano."
    : `A los ${primero} ${primero === 1 ? "día" : "días"} del vencimiento se le manda el primer aviso, y se repite cada ${cada} ${cada === 1 ? "día" : "días"} mientras siga sin pagar. ${
        corta > 0
          ? `A los ${corta} días se le pausa el acceso, y se le devuelve solo en cuanto pague.`
          : "El acceso no se pausa nunca: lo decides tú, alumno a alumno."
      }`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4 text-ink-muted" aria-hidden />
          Avisos de impago
        </CardTitle>
        <CardDescription>
          Qué hace el sistema cuando un recibo vence y no se paga.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0">
        {estado?.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {estado.error}
          </p>
        ) : null}

        {estado?.ok ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            Plazos guardados.
          </p>
        ) : null}

        <form action={accion} className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-line p-3 transition-colors has-checked:border-accent/40 has-checked:bg-accent-soft/40">
            <input
              type="checkbox"
              name="dunningEnabled"
              value="1"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">
                Reclamar los recibos vencidos
              </span>
              <span className="block text-xs leading-relaxed text-ink-muted">
                Una tarea diaria manda los avisos. Apagado, no se manda nada.
              </span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Primer aviso" htmlFor="dunningFirstDays" hint="Días tras vencer.">
              <Input
                type="number"
                name="dunningFirstDays"
                min={0}
                max={90}
                value={primero}
                disabled={!activo}
                onChange={(e) => setPrimero(Number(e.target.value))}
              />
            </Field>

            <Field label="Repetir cada" htmlFor="dunningEveryDays" hint="Días entre avisos.">
              <Input
                type="number"
                name="dunningEveryDays"
                min={1}
                max={90}
                value={cada}
                disabled={!activo}
                onChange={(e) => setCada(Number(e.target.value))}
              />
            </Field>

            <Field
              label="Pausar acceso a los"
              htmlFor="dunningSuspendDays"
              hint="Días. Cero = nunca."
            >
              <Input
                type="number"
                name="dunningSuspendDays"
                min={0}
                max={365}
                value={corta}
                disabled={!activo}
                onChange={(e) => setCorta(Number(e.target.value))}
              />
            </Field>
          </div>

          <p className="rounded-[var(--radius-control)] bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
            {resumen}
          </p>

          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar plazos"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
