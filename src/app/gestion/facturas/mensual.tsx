"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import {
  issueMonthlyInvoicesAction,
  type InvoiceState,
} from "@/server/billing/invoice-actions";
import { MENCIONES_EXENCION } from "@/lib/billing/invoice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Select } from "@/components/ui/primitives";

/**
 * Facturar un mes entero.
 *
 * Emite una factura por cada recibo del mes que todavía no la tenga. El tipo de
 * IVA se elige aquí y no por alumno porque en una academia es el mismo para
 * todos: o la enseñanza está exenta, o no lo está.
 */
export function FacturacionMensual({
  series,
}: {
  series: { id: string; etiqueta: string }[];
}) {
  const [estado, accion, emitiendo] = useActionState<InvoiceState, FormData>(
    issueMonthlyInvoicesAction,
    undefined,
  );

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  if (series.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <FileText className="size-4 text-ink-muted" aria-hidden />
            Facturar el mes
          </p>
          <p className="text-xs text-ink-muted">
            Emite una factura por cada recibo del mes que todavía no la tenga y
            se la manda por correo a cada alumno, con su forma de pago. No
            factura dos veces el mismo recibo.
          </p>
        </div>

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
            {estado.mensaje ?? "Facturas emitidas."}
          </p>
        ) : null}

        <form action={accion} className="grid gap-4 sm:grid-cols-4">
          <Field label="Mes" htmlFor="periodo" required>
            <input
              id="periodo"
              name="periodo"
              type="month"
              defaultValue={mesActual}
              className="h-10 w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm text-ink"
            />
          </Field>

          <Field label="Serie" htmlFor="seriesId" required>
            <Select name="seriesId">
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.etiqueta}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="IVA"
            htmlFor="taxRate"
            hint="La preparación de oposiciones suele estar exenta."
          >
            <Select name="taxRate" defaultValue="0">
              <option value="0">Exento / 0 %</option>
              <option value="4">4 %</option>
              <option value="10">10 %</option>
              <option value="21">21 %</option>
            </Select>
          </Field>

          <Field label="Motivo de la exención" htmlFor="exemption">
            <Select name="exemption" defaultValue="EDUCACION">
              {MENCIONES_EXENCION.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.etiqueta}
                </option>
              ))}
            </Select>
          </Field>

          <div className="sm:col-span-4">
            <Button type="submit" loading={emitiendo}>
              <FileText aria-hidden />
              Emitir las facturas del mes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
