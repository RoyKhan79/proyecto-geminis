"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Home, ListChecks, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra inferior del Campus (§44).
 * Cinco destinos como máximo, iconos grandes y área táctil cómoda. Lo que aún
 * no existe se marca como "Pronto" en lugar de llevar a una pantalla vacía.
 */
const TABS = [
  { label: "Inicio", href: "/campus", icon: Home, ready: true },
  { label: "Estudiar", href: "/campus/estudiar", icon: BookOpen, ready: true },
  { label: "Tests", href: "/campus/tests", icon: ListChecks, ready: false },
  { label: "Calendario", href: "/campus/calendario", icon: CalendarDays, ready: true },
  { label: "Perfil", href: "/campus/perfil", icon: UserRound, ready: true },
];

export function CampusTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación del campus"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.href === "/campus"
              ? pathname === "/campus"
              : pathname.startsWith(tab.href);

          if (!tab.ready) {
            return (
              <li key={tab.href} className="flex-1">
                <span
                  aria-disabled
                  title="Disponible próximamente"
                  className="touch-target flex flex-col items-center justify-center gap-0.5 py-2 text-ink-muted opacity-45"
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="text-[0.6875rem]">{tab.label}</span>
                </span>
              </li>
            );
          }

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-target flex flex-col items-center justify-center gap-0.5 py-2 transition-colors",
                  active ? "text-accent" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.5]")} aria-hidden />
                <span className="text-[0.6875rem] font-medium">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
