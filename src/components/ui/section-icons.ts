import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  BookOpen,
  CalendarDays,
  Download,
  FileSignature,
  Home,
  Building2,
  Activity,
  ListChecks,
  Megaphone,
  MessageSquare,
  ClipboardList,
  Sparkles,
  UserRound,
  Video,
} from "lucide-react";
import { MANAGER_NAV } from "@/components/manager/nav-config";
import type { IconTone } from "@/components/ui/primitives";

/**
 * Qué icono y qué color le toca a cada sección.
 *
 * Existe para que el icono de una pantalla no se escriba en la pantalla. Si
 * «Alumnos» es violeta en la barra lateral, lo es también en su cabecera, en su
 * estado vacío y en la tarjeta que lleva hasta ella, porque sale de aquí. Es lo
 * que hace que el color signifique algo en lugar de decorar: quien lleva meses
 * dentro navega por el color antes que por el texto.
 *
 * Manager se lee de `MANAGER_NAV` para no mantener la misma tabla dos veces.
 * Campus y Plataforma, que no tienen menú lateral, se declaran aquí.
 */
export type SectionIcon = { href: string; icon: LucideIcon; tone: IconTone };

const CAMPUS: SectionIcon[] = [
  { href: "/campus", icon: Home, tone: "brand" },
  { href: "/campus/estudiar", icon: BookOpen, tone: "sky" },
  { href: "/campus/tests", icon: ListChecks, tone: "emerald" },
  { href: "/campus/muro", icon: Megaphone, tone: "amber" },
  { href: "/campus/perfil", icon: UserRound, tone: "violet" },
  { href: "/campus/avisos", icon: BellRing, tone: "amber" },
  { href: "/campus/calendario", icon: CalendarDays, tone: "rose" },
  { href: "/campus/descargas", icon: Download, tone: "teal" },
  { href: "/campus/examenes", icon: FileSignature, tone: "violet" },
  { href: "/campus/ia", icon: Sparkles, tone: "violet" },
  { href: "/campus/mensajes", icon: MessageSquare, tone: "teal" },
  { href: "/campus/salas", icon: Video, tone: "sky" },
  { href: "/campus/tareas", icon: ClipboardList, tone: "teal" },
];

const PLATAFORMA: SectionIcon[] = [
  { href: "/plataforma", icon: Building2, tone: "indigo" },
  { href: "/plataforma/salud", icon: Activity, tone: "emerald" },
];

const SECTIONS: SectionIcon[] = [
  ...MANAGER_NAV.flatMap((section) =>
    section.items.map((item) => ({
      href: item.href,
      icon: item.icon,
      tone: item.tone,
    })),
  ),
  ...CAMPUS,
  ...PLATAFORMA,
]
  // De más específico a menos, para que `/gestion/alumnos/nuevo` case con
  // «Alumnos» y no con el «Inicio» de `/gestion`.
  .sort((a, b) => b.href.length - a.href.length);

/**
 * El icono de la sección a la que pertenece una ruta, o `undefined` si no está
 * en ninguna (la entrada, el manual público, las páginas legales). Una pantalla
 * sin sección no se inventa un icono: se queda sin él.
 */
export function resolveSectionIcon(pathname: string): SectionIcon | undefined {
  return SECTIONS.find(
    (section) =>
      pathname === section.href || pathname.startsWith(`${section.href}/`),
  );
}
