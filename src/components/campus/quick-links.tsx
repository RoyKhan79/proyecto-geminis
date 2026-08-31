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
import { Card, IconTile } from "@/components/ui/primitives";
import { resolveSectionIcon } from "@/components/ui/section-icons";

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

/**
 * Los accesos rápidos de la pantalla de inicio del Campus.
 */
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
              className="group flex flex-col items-center gap-1.5 bg-surface px-1 py-3 text-center transition-colors hover:bg-surface-muted"
            >
              {/*
                Cada acceso con el color de su sección, el mismo que tendrá
                dentro. Siete iconos del mismo azul se leen como una fila de
                siete cosas iguales; con su color, cada uno se busca por lo que
                es y el pulgar acierta a la primera.
              */}
              <IconTile tone={resolveSectionIcon(enlace.href)?.tone} size="md">
                <Icon />
              </IconTile>
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
