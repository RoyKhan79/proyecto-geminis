"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Receipt } from "lucide-react";
import { generarRemesaAction, type BillingState } from "@/server/billing/actions";
import { Button } from "@/components/ui/button";

/**
 * Emitir los recibos del mes.
 *
 * El botón dice cuántos recibos va a crear antes de pulsarlo. Es un botón que
 * genera cargos contra las cuentas de los alumnos: tiene que decir exactamente
 * qué va a pasar.
 */
export function GenerarRemesa({
  periodo,
  mes,
  pendientes,
  yaExiste,
  bloqueada,
}: {
  periodo: string;
  mes: string;
  pendientes: number;
  yaExiste: boolean;
  bloqueada: boolean;
}) {
  const [estado, accion, generando] = useActionState<BillingState, FormData>(
    generarRemesaAction,
    undefined,
  );

  return (
    <div className="space-y-3 border-t border-line pt-4">
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
          Recibos emitidos. Descarga el fichero y súbelo a tu banco.
        </p>
      ) : null}

      <form action={accion} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="periodo" value={periodo} />

        <Button type="submit" loading={generando} disabled={pendientes === 0 || bloqueada}>
          <Receipt aria-hidden />
          {pendientes === 0
            ? "No queda nada por emitir"
            : `Emitir ${pendientes} ${pendientes === 1 ? "recibo" : "recibos"} de ${mes}`}
        </Button>

        <p className="text-xs text-ink-muted">
          {bloqueada
            ? "La remesa de este mes ya se envió al banco. No se puede volver a emitir sobre ella."
            : yaExiste
              ? "Ya hay una remesa de este mes sin enviar: los recibos nuevos se añadirán a ella."
              : "No se cobra dos veces: los recibos ya emitidos se saltan."}
        </p>
      </form>
    </div>
  );
}
