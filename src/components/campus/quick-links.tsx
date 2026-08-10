import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  MessageSquare,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/primitives";

/**
 * Accesos rápidos del Campus.
 *
 * La barra inferior tiene cinco destinos como máximo, así que lo demás vive
 * aquí, en la pantalla de inicio, donde se ve sin buscar.
 */
const ENLACES = [
  { href: "/campus/tareas", label: "Tareas", icon: ClipboardList },
  { href: "/campus/mensajes", label: "Mensajes", icon: MessageSquare },
  { href: "/campus/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/campus/salas", label: "Salas", icon: Video },
  { href: "/campus/avisos", label: "Avisos", icon: Bell },
];

export function QuickLinks() {
  return (
    <nav aria-label="Accesos rápidos">
      <Card className="grid grid-cols-5 divide-x divide-[var(--border-subtle)] overflow-hidden">
        {ENLACES.map((enlace) => {
          const Icon = enlace.icon;
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className="flex flex-col items-center gap-1.5 px-1 py-3 text-center transition-colors hover:bg-surface-muted"
            >
              <Icon className="size-5 text-accent" aria-hidden />
              <span className="text-[0.6875rem] font-medium text-ink">
                {enlace.label}
              </span>
            </Link>
          );
        })}
      </Card>
    </nav>
  );
}
