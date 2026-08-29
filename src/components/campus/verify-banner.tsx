"use client";

import { useActionState } from "react";
import { MailWarning } from "lucide-react";
import { resendVerificationAction } from "@/server/auth/recovery-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";

/**
 * Aviso de correo sin confirmar.
 *
 * No bloquea nada: el alumno puede seguir estudiando. Se avisa porque un correo
 * mal escrito significa que no le llegará el aviso de la clase ni el del plazo
 * de entrega, y eso no se descubre hasta que ya es tarde.
 */
export function VerifyBanner() {
  const [enviado, formAction, pending] = useActionState<boolean, FormData>(
    async () => {
      await resendVerificationAction();
      return true;
    },
    false,
  );

  return (
    <Card className="border-caution/40">
      <CardContent className="flex flex-wrap items-center gap-3 p-4 pt-4">
        <MailWarning className="size-5 shrink-0 text-caution" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            Tu correo todavía no está confirmado
          </p>
          <p className="text-xs text-ink-muted">
            {enviado
              ? "Te lo hemos enviado otra vez. Revisa tu bandeja y el correo no deseado."
              : "Hasta que lo confirmes no podremos avisarte de clases, entregas ni convocatorias."}
          </p>
        </div>
        {enviado ? null : (
          <form action={formAction}>
            <Button type="submit" variant="secondary" size="sm" loading={pending}>
              Reenviar
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
