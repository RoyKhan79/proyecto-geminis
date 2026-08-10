"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MANAGER_NAV, type NavSection } from "./nav-config";
import { cn } from "@/lib/utils";

/**
 * Barra lateral de Manager. Recibe ya filtrados los elementos que la persona
 * puede ver: el filtrado por permisos se hace en el servidor, aquí solo se
 * pinta. Ocultar en cliente nunca es una medida de seguridad.
 */
export function ManagerSidebar({
  allowed,
  academyName,
}: {
  allowed: string[];
  academyName: string;
}) {
  const pathname = usePathname();
  const allowedSet = new Set(allowed);

  const sections: NavSection[] = MANAGER_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => allowedSet.has(item.href)),
  })).filter((section) => section.items.length > 0);

  return (
    <nav
      aria-label="Navegación principal"
      className="flex h-full w-60 shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-surface px-3 py-4"
    >
      <div className="flex items-center gap-2.5 px-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-contrast">
          G
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{academyName}</p>
          <p className="text-[0.6875rem] uppercase tracking-wide text-ink-muted">
            Manager
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {sections.map((section, index) => (
          <div key={section.title ?? index} className="space-y-1">
            {section.title ? (
              <p className="px-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-muted">
                {section.title}
              </p>
            ) : null}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/gestion"
                  ? pathname === "/gestion"
                  : pathname.startsWith(item.href);

              if (item.status === "soon") {
                return (
                  <span
                    key={item.href}
                    aria-disabled
                    title={`Disponible en ${item.phase ?? "una próxima fase"}`}
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-sm text-ink-muted opacity-60"
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                    <span className="ml-auto rounded-full bg-surface-muted px-1.5 py-0.5 text-[0.625rem] font-medium">
                      Pronto
                    </span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
