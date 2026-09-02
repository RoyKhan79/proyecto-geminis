import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verificarCorreo } from "@/lib/auth/recovery";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";
import { SignoGeminis } from "@/components/marca";

export const metadata: Metadata = { title: "Confirmar correo" };

/**
 * Confirmación del correo.
 *
 * No hace falta tener sesión: quien abre el enlace desde su buzón ya está
 * demostrando que ese correo es suyo, que es exactamente lo que se quería
 * comprobar.
 */
export default async function VerificarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resultado = await verificarCorreo(token);

  return (
    <main className="shell-wash flex min-h-dvh flex-col items-center justify-center bg-surface-sunken px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-hover text-xl font-bold text-accent-contrast shadow-[inset_0_1px_0_0_oklch(1_0_0/0.28),var(--shadow-raised)]">
          <SignoGeminis className="size-full" />
        </div>

        <Card>
          <CardContent className="space-y-3 p-6 pt-6 text-center">
            {resultado.ok ? (
              <>
                <CheckCircle2 className="mx-auto size-9 text-positive" aria-hidden />
                <p className="font-medium text-ink">Correo confirmado</p>
                <p className="text-sm text-ink-soft">
                  Ya podemos avisarte de tus clases, de tus entregas y de las
                  convocatorias que te interesan.
                </p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto size-9 text-critical" aria-hidden />
                <p className="font-medium text-ink">
                  {resultado.motivo === "caducado"
                    ? "Este enlace ha caducado"
                    : resultado.motivo === "usado"
                      ? "Este correo ya estaba confirmado"
                      : "Este enlace no es válido"}
                </p>
                <p className="text-sm text-ink-soft">
                  {resultado.motivo === "usado"
                    ? "No tienes que hacer nada más."
                    : "Entra en tu perfil y pide que te lo enviemos otra vez."}
                </p>
              </>
            )}

            <Button asChild className="w-full">
              <Link href="/entrar">Ir a {BRAND.name}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
