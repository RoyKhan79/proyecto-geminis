"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, CreditCard } from "lucide-react";
import { saveTpvAction, type BillingState } from "@/server/billing/actions";
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
 * EL TPV DE LA ACADEMIA
 *
 * El cobro con tarjeta va contra el comercio de cada academia, no contra uno de
 * la plataforma: el dinero cae en la cuenta de cada una.
 *
 * Mientras no haya credenciales se cobra contra el entorno de pruebas de
 * Redsys, que no mueve dinero. No es un apaño: es que se pueda ver el cobro
 * funcionando de punta a punta antes de haberle pedido el TPV al banco, que
 * tarda semanas. La pantalla dice en qué modo está, siempre.
 */
export function DatosDelTpv({
  datos,
}: {
  datos: {
    redsysMerchantCode: string;
    redsysTerminal: string;
    tieneClave: boolean;
    redsysLive: boolean;
  };
}) {
  const [estado, accion, guardando] = useActionState<BillingState, FormData>(
    saveTpvAction,
    undefined,
  );
  const [enReal, setEnReal] = useState(datos.redsysLive);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4 text-ink-muted" aria-hidden />
          Cobro con tarjeta
        </CardTitle>
        <CardDescription>
          El TPV virtual que te da tu banco. Con esto, cada recibo lleva un
          enlace para pagarlo con tarjeta y se marca cobrado solo.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0">
        {!datos.redsysMerchantCode || !datos.tieneClave ? (
          <p className="rounded-[var(--radius-control)] bg-caution-soft px-3 py-2 text-xs leading-relaxed text-caution">
            <strong>Ahora mismo estás en pruebas.</strong> Los cobros funcionan de
            principio a fin, pero no se mueve dinero. Cuando tu banco te dé el
            TPV, pon aquí sus datos.
          </p>
        ) : null}

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
            Datos del TPV guardados.
          </p>
        ) : null}

        <form action={accion} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Código de comercio (FUC)"
              htmlFor="redsysMerchantCode"
              hint="Nueve dígitos. Te lo da el banco."
            >
              <Input
                name="redsysMerchantCode"
                defaultValue={datos.redsysMerchantCode}
                placeholder="999008881"
              />
            </Field>

            <Field label="Terminal" htmlFor="redsysTerminal" hint="Casi siempre 001.">
              <Input
                name="redsysTerminal"
                defaultValue={datos.redsysTerminal || "001"}
                placeholder="001"
              />
            </Field>
          </div>

          <Field
            label="Clave secreta del comercio"
            htmlFor="redsysSecretKey"
            hint={
              datos.tieneClave
                ? "Ya hay una guardada. Déjalo vacío para no cambiarla."
                : "Cópiala entera del panel de tu TPV, sin espacios."
            }
          >
            <Input
              name="redsysSecretKey"
              type="password"
              autoComplete="off"
              placeholder={datos.tieneClave ? "••••••••••••••••" : ""}
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-line p-3 transition-colors has-checked:border-caution/50 has-checked:bg-caution-soft/40">
            <input
              type="checkbox"
              name="redsysLive"
              value="1"
              checked={enReal}
              onChange={(e) => setEnReal(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">
                Cobrar de verdad
              </span>
              <span className="block text-xs leading-relaxed text-ink-muted">
                Con esto marcado se cobra dinero real. Déjalo apagado hasta que
                hayas hecho una prueba y el banco te confirme el alta.
              </span>
            </span>
          </label>

          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar el TPV"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
