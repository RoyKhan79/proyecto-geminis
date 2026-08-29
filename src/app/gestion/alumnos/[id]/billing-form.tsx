"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Landmark } from "lucide-react";
import {
  saveBillingProfileAction,
  saveRecurringChargeAction,
  type BillingState,
} from "@/server/billing/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { fechaParaInput } from "@/lib/utils";

const METODOS = [
  { valor: "CASH", etiqueta: "Efectivo" },
  { valor: "TRANSFER", etiqueta: "Transferencia" },
  { valor: "CARD", etiqueta: "Tarjeta" },
  { valor: "SEPA_DIRECT_DEBIT", etiqueta: "Domiciliación bancaria" },
  { valor: "OTHER", etiqueta: "Otra" },
];

/**
 * Cómo paga este alumno.
 *
 * Los campos bancarios solo aparecen si se elige domiciliación: pedir un IBAN a
 * quien paga en efectivo es pedir un dato que no hace falta, y cuantos menos
 * datos bancarios haya guardados, mejor.
 */
export function BillingForm({
  studentId,
  perfil,
  cuota,
}: {
  studentId: string;
  perfil: {
    method: string;
    iban: string | null;
    holderName: string | null;
    mandateRef: string | null;
    mandateSignedAt: Date | null;
    chargeDay: number;
    notes: string | null;
  } | null;
  cuota: {
    concept: string;
    amountCents: number;
    startsOn: Date;
    endsOn: Date | null;
    status: string;
  } | null;
}) {
  const [metodo, setMetodo] = useState(perfil?.method ?? "TRANSFER");

  const [estadoPerfil, guardarPerfil, guardandoPerfil] = useActionState<
    BillingState,
    FormData
  >(saveBillingProfileAction, undefined);

  const [estadoCuota, guardarCuota, guardandoCuota] = useActionState<
    BillingState,
    FormData
  >(saveRecurringChargeAction, undefined);

  const domicilia = metodo === "SEPA_DIRECT_DEBIT";
  const fecha = fechaParaInput;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="size-4 text-ink-muted" aria-hidden />
          Forma de pago
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 p-5 pt-0">
        <form action={guardarPerfil} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />

          <Aviso estado={estadoPerfil} exito="Forma de pago guardada." />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cómo paga" htmlFor="method" required>
              <Select
                name="method"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value)}
              >
                {METODOS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.etiqueta}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Día de cobro"
              htmlFor="chargeDay"
              hint="Del 1 al 28, para que exista también en febrero."
            >
              <Input
                name="chargeDay"
                type="number"
                min={1}
                max={28}
                defaultValue={perfil?.chargeDay ?? 1}
              />
            </Field>
          </div>

          {domicilia ? (
            <div className="space-y-4 rounded-[var(--radius-control)] border border-line p-4">
              <p className="text-xs text-ink-muted">
                Para domiciliar hace falta el número de cuenta y que el alumno haya
                firmado el mandato. Guarda el papel firmado: el banco puede
                pedírtelo hasta trece meses después de cada cargo.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="IBAN"
                  htmlFor="iban"
                  required
                  hint="Se comprueba el dígito de control al guardar."
                >
                  <Input
                    name="iban"
                    placeholder="ES91 2100 0418 4502 0005 1332"
                    defaultValue={perfil?.iban ?? ""}
                    autoComplete="off"
                  />
                </Field>

                <Field
                  label="Titular de la cuenta"
                  htmlFor="holderName"
                  hint="Solo si no es el propio alumno."
                >
                  <Input
                    name="holderName"
                    defaultValue={perfil?.holderName ?? ""}
                    autoComplete="off"
                  />
                </Field>

                <Field label="Fecha de firma del mandato" htmlFor="mandateSignedAt" required>
                  <Input
                    name="mandateSignedAt"
                    type="date"
                    defaultValue={fecha(perfil?.mandateSignedAt)}
                  />
                </Field>

                <Field
                  label="Referencia del mandato"
                  htmlFor="mandateRef"
                  hint="Si la dejas vacía se genera una. No la cambies después."
                >
                  <Input
                    name="mandateRef"
                    defaultValue={perfil?.mandateRef ?? ""}
                    autoComplete="off"
                  />
                </Field>
              </div>
            </div>
          ) : (
            <input type="hidden" name="iban" value={perfil?.iban ?? ""} />
          )}

          <Field label="Notas de cobro" htmlFor="notes">
            <Textarea name="notes" rows={2} defaultValue={perfil?.notes ?? ""} />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" variant="secondary" loading={guardandoPerfil}>
              Guardar forma de pago
            </Button>
          </div>
        </form>

        <div className="border-t border-line pt-6">
          <form action={guardarCuota} className="space-y-4">
            <input type="hidden" name="studentId" value={studentId} />

            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink">Cuota mensual</h3>
              <p className="text-xs text-ink-muted">
                Se emite sola cada mes desde Pagos → Remesas. Si este alumno paga de
                una vez, déjalo vacío.
              </p>
            </div>

            <Aviso estado={estadoCuota} exito="Cuota guardada." />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Concepto" htmlFor="concept" required>
                <Input
                  name="concept"
                  placeholder="Curso anual Administrativo"
                  defaultValue={cuota?.concept ?? ""}
                />
              </Field>

              <Field label="Importe al mes" htmlFor="amount" required>
                <Input
                  name="amount"
                  placeholder="60"
                  defaultValue={
                    cuota ? (cuota.amountCents / 100).toFixed(2).replace(".", ",") : ""
                  }
                />
              </Field>

              <Field label="Desde" htmlFor="startsOn" required>
                <Input
                  name="startsOn"
                  type="date"
                  defaultValue={fecha(cuota?.startsOn)}
                />
              </Field>

              <Field
                label="Hasta"
                htmlFor="endsOn"
                hint="Vacío = indefinida. Un curso anual suele acabar en junio."
              >
                <Input name="endsOn" type="date" defaultValue={fecha(cuota?.endsOn)} />
              </Field>

              <Field label="Estado" htmlFor="status">
                <Select name="status" defaultValue={cuota?.status ?? "ACTIVE"}>
                  <option value="ACTIVE">Activa</option>
                  <option value="PAUSED">En pausa</option>
                  <option value="ENDED">Terminada</option>
                </Select>
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="secondary" loading={guardandoCuota}>
                Guardar cuota
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

function Aviso({ estado, exito }: { estado: BillingState; exito: string }) {
  if (estado?.error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-[var(--radius-control)] bg-critical-soft px-3 py-2 text-sm text-critical"
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        {estado.error}
      </p>
    );
  }
  if (estado?.ok) {
    return (
      <p
        role="status"
        className="flex items-start gap-2 rounded-[var(--radius-control)] bg-positive-soft px-3 py-2 text-sm text-positive"
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        {exito}
      </p>
    );
  }
  return null;
}
