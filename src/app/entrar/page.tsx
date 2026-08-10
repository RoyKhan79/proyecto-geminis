import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/context";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function SignInPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect("/inicio");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-sunken px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-accent-contrast">
            G
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Geminis</h1>
          <p className="text-sm text-ink-muted">
            Accede a tu academia para continuar.
          </p>
        </div>

        <SignInForm />

        <p className="text-center text-xs text-ink-muted">
          ¿Problemas para entrar? Ponte en contacto con tu academia.
        </p>
      </div>
    </main>
  );
}
