"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MANAGER_NAV, type NavSection } from "./nav-config";
import { BRAND } from "@/lib/brand";
import { IconTile } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { SignoGeminis } from "@/components/marca";

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
      className="flex h-full w-[16.5rem] shrink-0 flex-col gap-7 overflow-y-auto border-r border-line/70 bg-surface/70 px-3.5 py-6 backdrop-blur-2xl"
    >
      <div className="flex items-center gap-3 px-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-accent to-accent-hover text-sm font-bold text-accent-contrast shadow-[inset_0_1px_0_0_oklch(1_0_0/0.25),var(--shadow-soft)]">
          <SignoGeminis className="size-full" />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 font-display text-[0.9375rem] font-semibold leading-tight text-ink">
            {academyName}
          </p>
          <p className="eyebrow">{BRAND.manager}</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {sections.map((section, index) => (
          <div key={section.title ?? index} className="space-y-1">
            {section.title ? (
              <p className="eyebrow px-2.5 pb-1.5">{section.title}</p>
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
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-sm text-ink-muted opacity-50 grayscale"
                  >
                    <IconTile tone={item.tone} size="sm">
                      <Icon />
                    </IconTile>
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
                    // La marca de la izquierda señala dónde estás sin repintar
                    // media barra: se lee de un vistazo y no compite con el
                    // contenido.
                    "group relative flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 text-[0.875rem] transition-all duration-150",
                    "before:absolute before:left-0 before:top-1/2 before:h-[1.15rem] before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-accent before:transition-opacity",
                    active
                      ? // Lo activo va sobre su propia superficie, con anillo y
                        // filo de luz: se lee como una pieza levantada, no como
                        // un rectángulo de color.
                        "bg-surface font-semibold text-ink shadow-[var(--highlight),var(--shadow-soft)] before:opacity-100"
                      : "text-ink-soft before:opacity-0 hover:bg-surface-muted/70 hover:text-ink",
                  )}
                >
                  {/*
                    El icono lleva el color de su área y el destino en el que
                    estás lo lleva lleno. Con la barra entera a la vista, el
                    color es lo que se busca primero; el relleno es lo que
                    contesta «estás aquí» sin repintar media columna.
                  */}
                  <IconTile
                    tone={item.tone}
                    fill={active ? "solid" : "soft"}
                    size="sm"
                    className={cn(
                      "transition-shadow",
                      !active && "opacity-90 group-hover:opacity-100",
                    )}
                  >
                    <Icon className={cn(active && "stroke-[2.2]")} />
                  </IconTile>
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
