import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/context";
import { RecoveryForm } from "./recovery-form";
import { SignoGeminis } from "@/components/marca";

export const metadata: Metadata = { title: "Recuperar contraseña" };

/**
 * Pedir un enlace para cambiar la contraseña.
 *
 * Responde lo mismo exista el correo o no: si no, este formulario sería un
 * comprobador de quién está apuntado en la academia.
 */
export default async function RecuperarPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect("/inicio");

  return (
    <main className="shell-wash flex min-h-dvh flex-col items-center justify-center bg-surface-sunken px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-hover text-xl font-bold text-accent-contrast shadow-[inset_0_1px_0_0_oklch(1_0_0/0.28),var(--shadow-raised)]">
            <SignoGeminis className="size-full" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold leading-tight text-ink">
              ¿Has olvidado tu contraseña?
            </h1>
            <p className="text-sm text-ink-soft">
              Escribe tu correo y te mandamos un enlace para elegir una nueva.
            </p>
          </div>
        </div>

        <RecoveryForm />

        <p className="text-center text-xs text-ink-muted">
          <Link href="/entrar" className="underline-offset-2 hover:underline">
            Volver a entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
