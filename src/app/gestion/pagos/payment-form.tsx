"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, X } from "lucide-react";
import { createPaymentAction, type PaymentState } from "@/server/payments/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";

/**
 * Registrar un cobro.
 */
export function PaymentForm({
  alumnos,
}: {
  alumnos: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, pending] = useActionState<PaymentState, FormData>(
    createPaymentAction,
    undefined,
  );

  if (!abierto) {
    return (
      <Button size="sm" onClick={() => setAbierto(true)}>
        <Plus aria-hidden />
        Nuevo recibo
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Nuevo recibo</h3>
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

        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Alumno" htmlFor="studentId" required>
            <Select name="studentId" required defaultValue="">
              <option value="">Elige un alumno</option>
              {alumnos.map((alumno) => (
                <option key={alumno.id} value={alumno.id}>
                  {alumno.nombre}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Concepto" htmlFor="concept" required>
            <Input name="concept" placeholder="Mensualidad de septiembre" required />
          </Field>

          <Field label="Importe (€)" htmlFor="amountEuros" required>
            <Input
              name="amountEuros"
              type="number"
              step="0.01"
              min={0}
              placeholder="69.00"
              required
            />
          </Field>

          <Field label="Forma de pago" htmlFor="method">
            <Select name="method" defaultValue="SEPA_DIRECT_DEBIT">
              <option value="SEPA_DIRECT_DEBIT">Domiciliado</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="CARD">Tarjeta</option>
              <option value="CASH">Efectivo</option>
              <option value="OTHER">Otro</option>
            </Select>
          </Field>

          <Field label="Vencimiento" htmlFor="dueDate">
            <Input name="dueDate" type="date" />
          </Field>

          <Field label="Estado" htmlFor="status">
            <Select name="status" defaultValue="PENDING">
              <option value="PENDING">Pendiente de cobro</option>
              <option value="PAID">Ya cobrado</option>
            </Select>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Observaciones" htmlFor="notes">
              <Textarea name="notes" rows={2} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Guardar recibo
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
