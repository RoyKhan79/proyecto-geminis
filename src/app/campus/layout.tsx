import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { stopImpersonationAction } from "@/server/platform/actions";
import { requireAcademy } from "@/lib/auth/context";
import { CampusTabBar } from "@/components/campus/tab-bar";
import { InstallPrompt } from "@/components/campus/install-prompt";
import { BotonSalir } from "@/components/campus/salir";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";

/**
 * Geminis Campus.
 *
 * Mobile first de verdad (§44): navegación inferior alcanzable con el pulgar,
 * contenido en una sola columna y nada de tablas densas. En pantallas grandes
 * la misma estructura se ensancha, no se convierte en otro producto.
 */
export default async function CampusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAcademy();

  if (!ctx.permissions.has("campus.access")) {
    redirect(ctx.permissions.has("manager.access") ? "/gestion" : "/sin-acceso");
  }

  return (
    <div className="shell-wash flex min-h-dvh flex-col bg-surface-sunken">
      <header className="sticky top-0 z-20 flex h-15 items-center gap-3 border-b border-line bg-surface/75 px-4 backdrop-blur-xl">
        <Link href="/campus" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-accent to-accent-hover text-sm font-bold text-accent-contrast shadow-[inset_0_1px_0_0_oklch(1_0_0/0.25),var(--shadow-soft)]">
            {BRAND.initial}
          </span>
          <span className="truncate font-display text-[0.9375rem] font-semibold text-ink">
            {ctx.academy.name}
          </span>
        </Link>

        <div className="flex-1" />

        {ctx.impersonatedById ? (
          <form action={stopImpersonationAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full bg-caution-soft px-2.5 py-1 text-xs font-medium text-caution"
              title="Salir de la sesión de soporte"
            >
              <ShieldAlert className="size-3.5" aria-hidden />
              Soporte · salir
            </button>
          </form>
        ) : null}

        {ctx.permissions.has("manager.access") ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/gestion">Ir a Manager</Link>
          </Button>
        ) : null}

        <BotonSalir />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 p-4 pb-24">
        {children}
      </main>

      <CampusTabBar />
      <InstallPrompt />
    </div>
  );
}
