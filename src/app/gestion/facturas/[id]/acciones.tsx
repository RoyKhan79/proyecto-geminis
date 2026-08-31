"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Printer, Send, Undo2 } from "lucide-react";
import {
  rectifyInvoiceAction,
  resendInvoiceAction,
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
 * Mandarle la factura al cliente otra vez.
 *
 * El envío ya ocurre solo al facturar el mes; esto es para cuando no llegó, o
 * para después de corregirle los datos a alguien y emitirle la rectificativa.
 *
 * Debajo dice cuándo se mandó y a dónde, porque reenviar sin saber si ya salió
 * es lo que acaba mandando la misma factura tres veces.
 */
export function Reenviar({
  invoiceId,
  enviadaEl,
  enviadaA,
}: {
  invoiceId: string;
  enviadaEl: string | null;
  enviadaA: string | null;
}) {
  const [estado, accion, enviando] = useActionState<InvoiceState, FormData>(
    resendInvoiceAction,
    undefined,
  );

  return (
    <form action={accion} className="contents">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        disabled={enviando}
        title={
          enviadaEl
            ? `Ya se envió el ${enviadaEl}${enviadaA ? ` a ${enviadaA}` : ""}`
            : "Todavía no se le ha enviado"
        }
      >
        <Send aria-hidden />
        {enviando ? "Enviando…" : enviadaEl ? "Volver a enviar" : "Enviar al cliente"}
      </Button>

      {estado?.error ? (
        <span
          role="alert"
          className="flex items-center gap-1.5 text-xs font-medium text-critical"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {estado.error}
        </span>
      ) : null}

      {estado?.ok ? (
        <span
          role="status"
          className="flex items-center gap-1.5 text-xs font-medium text-positive"
        >
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
          {estado.mensaje ?? "Enviada."}
        </span>
      ) : null}
    </form>
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
