"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Printer, Undo2 } from "lucide-react";
import {
  rectifyInvoiceAction,
  type InvoiceState,
} from "@/server/billing/invoice-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input } from "@/components/ui/primitives";

/**
 * Imprimir.
 *
 * Se usa la impresión del navegador y no un PDF generado en el servidor: es el
 * mismo documento, se puede guardar como PDF desde el propio diálogo, y evita
 * arrastrar una dependencia pesada para algo que ya está resuelto.
 */
export function BotonImprimir() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      <Printer aria-hidden />
      Imprimir
    </Button>
  );
}

/**
 * Rectificar una factura.
 *
 * No hay botón de borrar y no lo va a haber: una factura emitida no se borra.
 * Se emite otra que la anula, con su motivo, y las dos quedan enlazadas.
 */
export function Rectificar({
  invoiceId,
  referencia,
}: {
  invoiceId: string;
  referencia: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, rectificando] = useActionState<InvoiceState, FormData>(
    rectifyInvoiceAction,
    undefined,
  );

  if (!abierto) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setAbierto(true)}>
        <Undo2 aria-hidden />
        Rectificar
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink">Rectificar {referencia}</p>
          <p className="text-xs text-ink-muted">
            Se emitirá una factura nueva con los importes en negativo que anula
            esta. La original no se borra ni se modifica: así lo exige el
            reglamento de facturación.
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

        <form action={accion} className="space-y-4">
          <input type="hidden" name="invoiceId" value={invoiceId} />

          <Field
            label="Motivo de la rectificación"
            htmlFor="motivo"
            required
            hint="Queda escrito en la factura rectificativa."
          >
            <Input
              name="motivo"
              placeholder="Error en el importe"
              required
              minLength={5}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" loading={rectificando}>
              Emitir rectificativa
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
