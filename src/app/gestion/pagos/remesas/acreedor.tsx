"use client";

import { useActionState, useState } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Settings2 } from "lucide-react";
import { saveCreditorAction, type BillingState } from "@/server/billing/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, Field, Input } from "@/components/ui/primitives";

/**
 * Datos de la academia como acreedor.
 *
 * Van aquí y no perdidos en la configuración general porque es donde se
 * necesitan: si falta alguno, el banco rechaza el fichero entero y la academia
 * se entera dos días después.
 */
export function DatosAcreedorForm({
  datos,
  avisos,
}: {
  datos: {
    legalName: string;
    taxId: string;
    /**
     * La cuenta de la academia, ENMASCARADA: «ES91 •••• •••• 1332».
     *
     * Aquí no llega el número entero, y es a propósito. Antes sí llegaba, en el
     * `defaultValue` de un campo de texto, así que la cuenta de cobro de la
     * academia viajaba dentro del HTML de una pantalla de listado: se quedaba en
     * la caché del navegador, salía en cualquier captura de pantalla y estaría
     * al alcance de un script si algún día se colara uno. Lo cazó
     * `npm run pentest`, y por eso ahora solo baja la máscara.
     */
    ibanOculto: string;
    /** Si ya hay cuenta guardada. Cambia lo que dice el campo. */
    tieneIban: boolean;
    creditorId: string;
    mandatePrefix: string;
  };
  avisos: string[];
}) {
  const [abierto, setAbierto] = useState(avisos.length > 0);
  const [estado, accion, guardando] = useActionState<BillingState, FormData>(
    saveCreditorAction,
    undefined,
  );

  return (
    <Card className={avisos.length > 0 ? "border-caution/40" : undefined}>
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Settings2 className="size-4 text-ink-muted" aria-hidden />
              Datos de tu academia para el banco
            </p>
            {avisos.length > 0 ? (
              <ul className="space-y-1">
                {avisos.map((aviso) => (
                  <li
                    key={aviso}
                    className="flex items-start gap-1.5 text-xs text-caution"
                  >
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {aviso}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-muted">
                Completos. Ya puedes generar ficheros de adeudos.
              </p>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={() => setAbierto(!abierto)}>
            {abierto ? "Cerrar" : "Editar"}
          </Button>
        </div>

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
                Guardado.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre fiscal"
                htmlFor="legalName"
                hint="Tal y como aparece en el contrato con tu banco."
              >
                <Input name="legalName" defaultValue={datos.legalName} />
              </Field>

              <Field label="NIF / CIF" htmlFor="taxId">
                <Input name="taxId" defaultValue={datos.taxId} />
              </Field>

              <Field
                label="Cuenta donde se ingresan los recibos"
                htmlFor="billingIban"
                hint={
                  datos.tieneIban
                    ? `Guardada: ${datos.ibanOculto}. Déjalo en blanco para no cambiarla.`
                    : "Todavía no hay ninguna cuenta guardada."
                }
              >
                <Input
                  name="billingIban"
                  placeholder={
                    datos.tieneIban ? datos.ibanOculto : "ES91 2100 0418 4502 0005 1332"
                  }
                  defaultValue=""
                  autoComplete="off"
                />
              </Field>

              {datos.tieneIban ? (
                <label className="flex items-start gap-2 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    name="borrarIban"
                    value="1"
                    className="mt-0.5"
                  />
                  <span>
                    Quitar la cuenta guardada. Sin cuenta no se pueden generar
                    ficheros de adeudos.
                  </span>
                </label>
              ) : null}

              <Field
                label="Identificador de acreedor"
                htmlFor="creditorId"
                hint="Te lo da tu banco al firmar el contrato de adeudos. En España empieza por ES."
              >
                <Input
                  name="creditorId"
                  placeholder="ES12ZZZX1234567X"
                  defaultValue={datos.creditorId}
                  autoComplete="off"
                />
              </Field>

              <Field
                label="Prefijo de las referencias de mandato"
                htmlFor="mandatePrefix"
                hint="Hasta 8 caracteres. No lo cambies una vez empieces a cobrar."
              >
                <Input name="mandatePrefix" maxLength={8} defaultValue={datos.mandatePrefix} />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="secondary" loading={guardando}>
                Guardar
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
