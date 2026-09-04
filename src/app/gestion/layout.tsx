import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { BotonCerrarSesion } from "@/components/cerrar-sesion";
import { stopImpersonationAction } from "@/server/platform/actions";
import { requireAcademy } from "@/lib/auth/context";
import { MANAGER_NAV } from "@/components/manager/nav-config";
import { moduloDelPermiso } from "@/lib/modules/catalogo";
import { ManagerSidebar } from "@/components/manager/sidebar";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/utils";
import { MarcaCatedria } from "@/components/marca";

/**
 * El armazón de Manager: barra lateral, cabecera y aviso de soporte.
 *
 * El menú se construye con los permisos de quien ha entrado, así que lo que no
 * se puede hacer tampoco se ve. Ocultar no es autorizar: cada pantalla vuelve a
 * comprobarlo por su cuenta.
 */
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

  // Dos filtros, y son cosas distintas: el permiso dice qué puede hacer ESTA
  // persona, y el módulo qué ha contratado LA ACADEMIA. Enseñar un apartado que
  // la academia no tiene sería ofrecerle una puerta cerrada; esconderlo es lo
  // cortés. Lo que de verdad protege es que la acción responda que no, y eso lo
  // hace `requirePermission` por su cuenta.
  const allowed = MANAGER_NAV.flatMap((section) => section.items)
    .filter(
      (item) =>
        ctx.permissions.has(item.permission) &&
        ctx.modulos.has(moduloDelPermiso(item.permission)),
    )
    .map((item) => item.href);

  return (
    <div className="shell-wash flex min-h-dvh bg-surface-sunken">
      <div className="sticky top-0 hidden h-dvh lg:block">
        <ManagerSidebar allowed={allowed} academyName={ctx.academy.name} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line/70 bg-surface/70 px-5 backdrop-blur-2xl">
          <Link href="/gestion" className="lg:hidden">
            <MarcaCatedria className="size-9" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[0.9375rem] font-semibold text-ink lg:hidden">
              {ctx.academy.name}
            </p>
          </div>

          {ctx.impersonatedById ? (
            <form action={stopImpersonationAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-full bg-caution-soft px-2.5 py-1 text-xs font-medium text-caution hover:brightness-95"
                title="Salir de la sesión de soporte"
              >
                <ShieldAlert className="size-3.5" aria-hidden />
                Sesión de soporte · salir
              </button>
            </form>
          ) : null}

          {ctx.memberships.length > 1 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/elegir-academia">Cambiar academia</Link>
            </Button>
          ) : null}

          <div className="flex items-center gap-2">
            <span
              className="flex size-9 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-ink-soft ring-1 ring-inset ring-[var(--border-subtle)]"
              title={ctx.user.email}
            >
              {initials(ctx.user.firstName, ctx.user.lastName)}
            </span>
            <BotonCerrarSesion />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 space-y-7 p-4 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
