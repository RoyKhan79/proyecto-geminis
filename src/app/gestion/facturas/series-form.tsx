"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Hash, Plus } from "lucide-react";
import {
  saveInvoiceSeriesAction,
  type InvoiceState,
} from "@/server/billing/invoice-actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, Field, Input } from "@/components/ui/primitives";

/**
 * Series de facturación.
 *
 * Se numera por serie y por año. Una academia normal tiene una sola serie; la
 * segunda suele ser la de rectificativas, que conviene tener aparte para que la
 * numeración de las facturas normales no tenga huecos raros.
 */
export function SeriesForm({
  series,
  anio,
}: {
  series: {
    id: string;
    code: string;
    name: string;
    year: number;
    lastNumber: number;
    isDefault: boolean;
    isRectifying: boolean;
  }[];
  anio: number;
}) {
  const [abierto, setAbierto] = useState(series.length === 0);
  const [estado, accion, guardando] = useActionState<InvoiceState, FormData>(
    saveInvoiceSeriesAction,
    undefined,
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Hash className="size-4 text-ink-muted" aria-hidden />
            Series de facturación
          </p>
          <Button variant="ghost" size="sm" onClick={() => setAbierto(!abierto)}>
            {abierto ? "Cerrar" : "Nueva serie"}
          </Button>
        </div>

        {series.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Todavía no hay ninguna serie. Crea al menos una para poder facturar.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {series.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">
                  {s.code}/{s.year}
                </span>
                <span className="text-xs text-ink-muted">{s.name}</span>
                <span className="text-xs tabular-nums text-ink-muted">
                  · {s.lastNumber} emitidas
                </span>
                {s.isDefault ? <Badge tone="accent">Por defecto</Badge> : null}
                {s.isRectifying ? <Badge tone="caution">Rectificativas</Badge> : null}
              </li>
            ))}
          </ul>
        )}

        {abierto ? (
          <form action={accion} className="space-y-4 border-t border-line pt-4">
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
                Serie creada.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Código" htmlFor="code" required hint="Ej.: A">
                <Input name="code" maxLength={8} defaultValue="A" required />
              </Field>
              <Field label="Nombre" htmlFor="name" required>
                <Input name="name" defaultValue="Facturación general" required />
              </Field>
              <Field label="Año" htmlFor="year" required>
                <Input name="year" type="number" min={2000} max={2100} defaultValue={anio} />
              </Field>
              <div className="flex flex-col justify-center gap-2 pt-5">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="isDefault" defaultChecked />
                  Por defecto
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" name="isRectifying" />
                  Para rectificativas
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="secondary" loading={guardando}>
                <Plus aria-hidden />
                Crear serie
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
