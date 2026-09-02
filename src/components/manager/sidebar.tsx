"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MANAGER_NAV, type NavSection } from "./nav-config";
import { BRAND } from "@/lib/brand";
import { iconToneText } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { MarcaGeminis } from "@/components/marca";

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
        <MarcaGeminis className="size-9" />
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
                    <Icon
                      aria-hidden
                      className="size-[1.05rem] shrink-0 text-ink-muted"
                      strokeWidth={1.7}
                    />
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
                    "before:absolute before:left-0 before:top-1/2 before:h-[1.15rem] before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-gold before:transition-opacity",
                    active
                      ? // Lo activo va sobre su propia superficie, con anillo y
                        // filo de luz: se lee como una pieza levantada, no como
                        // un rectángulo de color.
                        "bg-surface font-semibold text-ink shadow-[var(--highlight),var(--shadow-soft)] before:opacity-100"
                      : "text-ink-soft before:opacity-0 hover:bg-surface-muted/70 hover:text-ink",
                  )}
                >
                  {/*
                    EL ICONO VA DESNUDO, sin pastilla.
                    
                    Cada destino llevaba su icono dentro de un cuadrado de
                    color. Uno solo queda bien; veinte seguidos son veinte
                    manchas de color en cinco centímetros, y el ojo no sabe
                    dónde mirar porque ninguna de ellas dice nada.
                    
                    La pastilla sigue existiendo y sigue estando bien donde
                    encabeza una pantalla o corona una tarjeta: ahí es una pieza
                    sola y se lee como un adorno cuidado. En una lista es ruido.
                    
                    Aquí el trazo fino basta, y lo que señala dónde estás es el
                    oro del icono más la barrita de la izquierda.
                  */}
                  <Icon
                    aria-hidden
                    className={cn(
                      "size-[1.05rem] shrink-0 transition-colors",
                      // El icono lleva el color de su área. Sin la pastilla
                      // detrás el color no grita, pero sigue haciendo su
                      // trabajo: en una barra de treinta destinos, es lo que
                      // se busca primero. En gris se perdía y la columna
                      // entera se leía como una lista de texto.
                      active ? "text-gold" : iconToneText[item.tone],
                    )}
                    strokeWidth={active ? 2 : 1.7}
                  />
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
