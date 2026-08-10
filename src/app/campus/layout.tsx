import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { requireAcademy } from "@/lib/auth/context";
import { CampusTabBar } from "@/components/campus/tab-bar";
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
    <div className="flex min-h-dvh flex-col bg-surface-sunken">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
        <Link href="/campus" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-contrast">
            G
          </span>
          <span className="truncate text-sm font-medium text-ink">
            {ctx.academy.name}
          </span>
        </Link>

        <div className="flex-1" />

        {ctx.permissions.has("manager.access") ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/gestion">Ir a Manager</Link>
          </Button>
        ) : null}

        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión">
            <LogOut aria-hidden />
          </Button>
        </form>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 p-4 pb-24">
        {children}
      </main>

      <CampusTabBar />
    </div>
  );
}
