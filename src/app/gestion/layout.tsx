import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldAlert } from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import { requireAcademy } from "@/lib/auth/context";
import { MANAGER_NAV } from "@/components/manager/nav-config";
import { ManagerSidebar } from "@/components/manager/sidebar";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { initials } from "@/lib/utils";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAcademy();

  // La autorización de entrada se comprueba en el servidor, en el layout: así
  // ninguna página de Manager puede quedarse sin protección por descuido.
  if (!ctx.permissions.has("manager.access")) {
    redirect(ctx.permissions.has("campus.access") ? "/campus" : "/sin-acceso");
  }

  const allowed = MANAGER_NAV.flatMap((section) => section.items)
    .filter((item) => ctx.permissions.has(item.permission))
    .map((item) => item.href);

  return (
    <div className="flex min-h-dvh bg-surface-sunken">
      <div className="sticky top-0 hidden h-dvh lg:block">
        <ManagerSidebar allowed={allowed} academyName={ctx.academy.name} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
          <Link href="/gestion" className="lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-contrast">
              {BRAND.initial}
            </span>
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink lg:hidden">
              {ctx.academy.name}
            </p>
          </div>

          {ctx.impersonatedById ? (
            <span className="flex items-center gap-1.5 rounded-full bg-caution-soft px-2.5 py-1 text-xs font-medium text-caution">
              <ShieldAlert className="size-3.5" aria-hidden />
              Sesión de soporte
            </span>
          ) : null}

          {ctx.memberships.length > 1 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/elegir-academia">Cambiar academia</Link>
            </Button>
          ) : null}

          <div className="flex items-center gap-2">
            <span
              className="flex size-8 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-ink-soft"
              title={ctx.user.email}
            >
              {initials(ctx.user.firstName, ctx.user.lastName)}
            </span>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Cerrar sesión"
              >
                <LogOut aria-hidden />
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
