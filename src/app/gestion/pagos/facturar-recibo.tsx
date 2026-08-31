"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import {
  issueInvoiceForPaymentAction,
  type InvoiceState,
} from "@/server/billing/invoice-actions";
import { MENCIONES_EXENCION } from "@/lib/billing/invoice";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/primitives";

/**
 * FACTURAR UN RECIBO SUELTO
 *
 * El botón mensual factura todo el mes de golpe; esto es para cuando alguien
 * pide su factura hoy, o entra un cobro fuera de la mensualidad.
 *
 * Se despliega en vez de llevar a otra pantalla: hay que elegir serie e IVA, y
 * mandar a alguien a un formulario aparte para dos desplegables es sacarlo del
 * sitio donde estaba trabajando.
 */
export function FacturarRecibo({
  paymentId,
  series,
}: {
  paymentId: string;
  series: { id: string; etiqueta: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, emitiendo] = useActionState<InvoiceState, FormData>(
    issueInvoiceForPaymentAction,
    undefined,
  );

  if (series.length === 0) return null;

  if (estado?.ok) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-positive">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
        {estado.mensaje ?? "Facturada."}
      </span>
    );
  }

  if (!abierto) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setAbierto(true)}
        title="Emite la factura de este recibo y se la manda al alumno"
      >
        <FileText aria-hidden />
        Facturar
      </Button>
    );
  }

  return (
    <form action={accion} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="paymentId" value={paymentId} />

      <Select name="seriesId" aria-label="Serie" className="h-9 w-auto text-xs">
        {series.map((serie) => (
          <option key={serie.id} value={serie.id}>
            {serie.etiqueta}
          </option>
        ))}
      </Select>

      <Select
        name="taxRate"
        aria-label="IVA"
        defaultValue="0"
        className="h-9 w-auto text-xs"
      >
        <option value="0">Exento</option>
        <option value="4">4 %</option>
        <option value="10">10 %</option>
        <option value="21">21 %</option>
      </Select>

      <Select
        name="exemption"
        aria-label="Motivo de la exención"
        className="h-9 w-auto text-xs"
      >
        {MENCIONES_EXENCION.map((mencion) => (
          <option key={mencion.valor} value={mencion.valor}>
            {mencion.etiqueta}
          </option>
        ))}
      </Select>

      <Button type="submit" size="sm" disabled={emitiendo}>
        {emitiendo ? "Emitiendo…" : "Emitir"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setAbierto(false)}
      >
        Cancelar
      </Button>

      {estado?.error ? (
        <span
          role="alert"
          className="flex w-full items-center gap-1.5 text-xs font-medium text-critical"
        >
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {estado.error}
        </span>
      ) : null}
    </form>
  );
}
