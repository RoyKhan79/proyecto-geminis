import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { getAuthContext } from "@/lib/auth/context";
import { comprobarToken } from "@/lib/auth/recovery";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/primitives";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

/**
 * La pantalla del enlace del correo.
 *
 * El testigo se comprueba al abrir para no enseñar un formulario que va a
 * fallar, pero NO se consume aquí: se consume al guardar la contraseña. Si se
 * consumiera al abrir, bastaría con que el antivirus del correo siguiera el
 * enlace para dejar a la persona sin poder usarlo.
 */
export default async function NuevaContrasenaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const ctx = await getAuthContext();
  if (ctx) redirect("/inicio");

  const { token } = await params;
  const resultado = await comprobarToken(token, "reset");

  return (
    <main className="shell-wash flex min-h-dvh flex-col items-center justify-center bg-surface-sunken px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-hover text-xl font-bold text-accent-contrast shadow-[inset_0_1px_0_0_oklch(1_0_0/0.28),var(--shadow-raised)]">
            {BRAND.initial}
          </div>
          <h1 className="text-2xl font-semibold leading-tight text-ink">
            Elige tu nueva contraseña
          </h1>
        </div>

        {resultado.ok ? (
          <ResetForm token={token} />
        ) : (
          <Card>
            <CardContent className="space-y-3 p-5 pt-5 text-center">
              <AlertCircle className="mx-auto size-8 text-critical" aria-hidden />
              <p className="font-medium text-ink">
                {resultado.motivo === "caducado"
                  ? "Este enlace ha caducado"
                  : resultado.motivo === "usado"
                    ? "Este enlace ya se ha usado"
                    : "Este enlace no es válido"}
              </p>
              <p className="text-sm text-ink-soft">
                Los enlaces duran una hora y sirven una sola vez. Pide uno nuevo y
                ábrelo cuanto antes.
              </p>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/recuperar">Pedir un enlace nuevo</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-ink-muted">
          <Link href="/entrar" className="underline-offset-2 hover:underline">
            Volver a entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
