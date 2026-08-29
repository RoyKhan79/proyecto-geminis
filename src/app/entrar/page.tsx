import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/context";
import { BRAND } from "@/lib/brand";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

/**
 * La puerta.
 *
 * Es la primera pantalla que ve todo el mundo: la academia que evalúa el
 * producto y el alumno a las siete de la mañana. Por eso está cuidada y por eso
 * no tiene nada más que lo necesario para entrar.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAuthContext();
  if (ctx) redirect("/inicio");

  const params = await searchParams;

  return (
    <main className="shell-wash relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-surface-sunken px-4 py-10">
      <div className="relative w-full max-w-sm space-y-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-hover text-xl font-bold text-accent-contrast shadow-[inset_0_1px_0_0_oklch(1_0_0/0.28),var(--shadow-raised)]">
            {BRAND.initial}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-3xl font-semibold leading-tight text-ink">
              {BRAND.name}
            </h1>
            <p className="text-sm text-ink-soft">
              Accede a tu academia para continuar.
            </p>
          </div>
        </div>

        <SignInForm cambiada={params.cambiada === "1"} />

        <div className="space-y-3 text-center">
          <p className="text-xs text-ink-muted">
            ¿Problemas para entrar? Ponte en contacto con tu academia.
          </p>
          <p className="text-xs text-ink-muted">
            <Link href="/privacidad" className="underline-offset-2 hover:underline">
              Privacidad
            </Link>
            <span aria-hidden> · </span>
            <Link href="/condiciones" className="underline-offset-2 hover:underline">
              Condiciones de uso
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
