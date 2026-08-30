import Link from "next/link";
import {
  Sparkles,
  CalendarDays,
  ClipboardList,
  Download,
  FileSignature,
  MessageSquare,
  Video,
} from "lucide-react";
import { Card } from "@/components/ui/primitives";

/**
 * Accesos rápidos del Campus.
 *
 * La barra inferior tiene cinco destinos como máximo, así que lo demás vive
 * aquí, en la pantalla de inicio, donde se ve sin buscar. En el móvil van a
 * cuatro por fila: siguen siendo un objetivo cómodo para el pulgar, que es de
 * lo que va toda esta pantalla, y caben las siete sin tener que esconder nada
 * detrás de un menú.
 */
const ENLACES = [
  { href: "/campus/examenes", label: "Exámenes", icon: FileSignature },
  { href: "/campus/tareas", label: "Tareas", icon: ClipboardList },
  { href: "/campus/mensajes", label: "Mensajes", icon: MessageSquare },
  { href: "/campus/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/campus/descargas", label: "Descargas", icon: Download },
  { href: "/campus/salas", label: "Salas", icon: Video },
  { href: "/campus/ia", label: "Geminis IA", icon: Sparkles },
];

export function QuickLinks() {
  return (
    <nav aria-label="Accesos rápidos">
      <Card className="grid grid-cols-4 gap-px overflow-hidden bg-[var(--border-subtle)] sm:grid-cols-7">
        {ENLACES.map((enlace) => {
          const Icon = enlace.icon;
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className="flex flex-col items-center gap-1.5 bg-surface px-1 py-3 text-center transition-colors hover:bg-surface-muted"
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
