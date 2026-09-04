import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ArrowDownToLine,
  Radar,
  BookOpen,
  CalendarDays,
  CreditCard,
  FileSignature,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  ClipboardList,
  Video,
  Timer,
  MessageSquare,
  Megaphone,
  Scale,
  Settings,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";
import type { IconTone } from "@/components/ui/primitives";

/**
 * Navegación de Catedria Manager.
 *
 * `status: "soon"` marca lo que todavía no existe. Se muestra apagado y con la
 * etiqueta "Pronto", nunca como un botón que no lleva a ninguna parte (§80).
 * Al terminar cada módulo se cambia una línea de este archivo.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * La familia de color del icono. Es identidad de área, no estado: quien usa
   * Manager ocho horas al día acaba yendo al color antes que al texto, y con
   * treinta destinos en la barra eso es la diferencia entre buscar y ver.
   */
  tone: IconTone;
  permission: Permission;
  status: "ready" | "soon";
  phase?: string;
};

/**
 * Un bloque del menú de Manager, con sus destinos.
 */
export type NavSection = { title?: string; items: NavItem[] };

/**
 * El menú de Manager, agrupado por áreas.
 *
 * Cada destino lleva el permiso que hace falta para verlo, así que el menú se
 * construye con los permisos de quien ha entrado. **Ocultar no es autorizar**:
 * cada pantalla vuelve a comprobarlo por su cuenta, porque una dirección se
 * puede escribir a mano.
 */
export const MANAGER_NAV: NavSection[] = [
  {
    items: [
      {
        label: "Inicio",
        href: "/gestion",
        tone: "brand",
        icon: LayoutDashboard,
        permission: "manager.access",
        status: "ready",
      },
    ],
  },
  {
    title: "Personas",
    items: [
      {
        label: "Alumnos",
        href: "/gestion/alumnos",
        tone: "indigo",
        icon: Users,
        permission: "students.read",
        status: "ready",
      },
      {
        label: "Profesores",
        href: "/gestion/profesores",
        tone: "violet",
        icon: UserRound,
        permission: "teachers.read",
        status: "ready",
      },
      {
        label: "Importar",
        href: "/gestion/importar",
        tone: "teal",
        icon: ArrowDownToLine,
        permission: "imports.run",
        status: "ready",
      },
    ],
  },
  {
    title: "Académico",
    items: [
      {
        label: "Oposiciones",
        href: "/gestion/oposiciones",
        tone: "amber",
        icon: GraduationCap,
        permission: "oppositions.read",
        status: "ready",
      },
      {
        label: "Cursos y grupos",
        href: "/gestion/cursos",
        tone: "brand",
        icon: BookOpen,
        permission: "courses.read",
        status: "ready",
      },
      {
        label: "Matrículas",
        href: "/gestion/matriculas",
        tone: "indigo",
        icon: ListChecks,
        permission: "enrollments.read",
        status: "ready",
      },
      {
        label: "Contenido",
        href: "/gestion/contenido",
        tone: "sky",
        icon: FileText,
        permission: "content.read",
        status: "ready",
      },
      {
        label: "Agenda",
        href: "/gestion/agenda",
        tone: "rose",
        icon: CalendarDays,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Clases",
        href: "/gestion/clases",
        tone: "rose",
        icon: CalendarDays,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Tareas",
        href: "/gestion/tareas",
        tone: "teal",
        icon: ClipboardList,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Exámenes",
        href: "/gestion/examenes",
        tone: "violet",
        icon: FileSignature,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Salas online",
        href: "/gestion/salas",
        tone: "sky",
        icon: Video,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Tests",
        href: "/gestion/tests",
        tone: "emerald",
        icon: ListChecks,
        permission: "questions.read",
        status: "ready",
      },
      {
        label: "Simulacros",
        href: "/gestion/simulacros",
        tone: "amber",
        icon: Timer,
        permission: "tests.read",
        status: "ready",
      },
      {
        label: "Convocatorias",
        href: "/gestion/convocatorias",
        tone: "rose",
        icon: Radar,
        permission: "oppositions.read",
        status: "ready",
      },
      {
        label: "Normativa",
        href: "/gestion/normativa",
        tone: "indigo",
        icon: Scale,
        permission: "legislation.read",
        status: "ready",
      },
    ],
  },
  {
    title: "Academia",
    items: [
      {
        label: "Catedria IA",
        href: "/gestion/ia",
        tone: "violet",
        icon: Sparkles,
        permission: "ai.copilot",
        status: "ready",
      },
      {
        label: "Analítica",
        href: "/gestion/analitica",
        tone: "sky",
        icon: BarChart3,
        permission: "analytics.read",
        status: "ready",
      },
      {
        label: "Muro de clase",
        href: "/gestion/muro",
        tone: "amber",
        icon: Megaphone,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Mensajes",
        href: "/gestion/mensajes",
        tone: "teal",
        icon: MessageSquare,
        permission: "students.read",
        status: "ready",
      },
      {
        label: "Comunicaciones",
        href: "/gestion/comunicaciones",
        tone: "teal",
        icon: MessageSquare,
        permission: "communications.send",
        status: "ready",
      },
      {
        label: "Pagos",
        href: "/gestion/pagos",
        tone: "emerald",
        icon: CreditCard,
        permission: "payments.read",
        status: "ready",
      },
      {
        label: "Facturas",
        href: "/gestion/facturas",
        tone: "emerald",
        icon: FileText,
        permission: "payments.read",
        status: "ready",
      },
      {
        label: "Manual",
        href: "/manual",
        tone: "brand",
        icon: BookOpen,
        permission: "manager.access",
        status: "ready",
      },
      {
        label: "Configuración",
        href: "/gestion/configuracion",
        tone: "indigo",
        icon: Settings,
        permission: "settings.read",
        status: "ready",
      },
    ],
  },
];
