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

/**
 * Navegación de Geminis Manager.
 *
 * `status: "soon"` marca lo que todavía no existe. Se muestra apagado y con la
 * etiqueta "Pronto", nunca como un botón que no lleva a ninguna parte (§80).
 * Al terminar cada módulo se cambia una línea de este archivo.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  status: "ready" | "soon";
  phase?: string;
};

export type NavSection = { title?: string; items: NavItem[] };

export const MANAGER_NAV: NavSection[] = [
  {
    items: [
      {
        label: "Inicio",
        href: "/gestion",
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
        icon: Users,
        permission: "students.read",
        status: "ready",
      },
      {
        label: "Profesores",
        href: "/gestion/profesores",
        icon: UserRound,
        permission: "teachers.read",
        status: "ready",
      },
      {
        label: "Importar",
        href: "/gestion/importar",
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
        icon: GraduationCap,
        permission: "oppositions.read",
        status: "ready",
      },
      {
        label: "Cursos y grupos",
        href: "/gestion/cursos",
        icon: BookOpen,
        permission: "courses.read",
        status: "ready",
      },
      {
        label: "Matrículas",
        href: "/gestion/matriculas",
        icon: ListChecks,
        permission: "enrollments.read",
        status: "ready",
      },
      {
        label: "Contenido",
        href: "/gestion/contenido",
        icon: FileText,
        permission: "content.read",
        status: "ready",
      },
      {
        label: "Agenda",
        href: "/gestion/agenda",
        icon: CalendarDays,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Clases",
        href: "/gestion/clases",
        icon: CalendarDays,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Tareas",
        href: "/gestion/tareas",
        icon: ClipboardList,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Exámenes",
        href: "/gestion/examenes",
        icon: FileSignature,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Salas online",
        href: "/gestion/salas",
        icon: Video,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Tests",
        href: "/gestion/tests",
        icon: ListChecks,
        permission: "questions.read",
        status: "ready",
      },
      {
        label: "Simulacros",
        href: "/gestion/simulacros",
        icon: Timer,
        permission: "tests.read",
        status: "ready",
      },
      {
        label: "Convocatorias",
        href: "/gestion/convocatorias",
        icon: Radar,
        permission: "oppositions.read",
        status: "ready",
      },
      {
        label: "Normativa",
        href: "/gestion/normativa",
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
        label: "Geminis IA",
        href: "/gestion/ia",
        icon: Sparkles,
        permission: "ai.copilot",
        status: "ready",
      },
      {
        label: "Analítica",
        href: "/gestion/analitica",
        icon: BarChart3,
        permission: "analytics.read",
        status: "ready",
      },
      {
        label: "Muro de clase",
        href: "/gestion/muro",
        icon: Megaphone,
        permission: "classes.read",
        status: "ready",
      },
      {
        label: "Mensajes",
        href: "/gestion/mensajes",
        icon: MessageSquare,
        permission: "students.read",
        status: "ready",
      },
      {
        label: "Comunicaciones",
        href: "/gestion/comunicaciones",
        icon: MessageSquare,
        permission: "communications.send",
        status: "ready",
      },
      {
        label: "Pagos",
        href: "/gestion/pagos",
        icon: CreditCard,
        permission: "payments.read",
        status: "ready",
      },
      {
        label: "Facturas",
        href: "/gestion/facturas",
        icon: FileText,
        permission: "payments.read",
        status: "ready",
      },
      {
        label: "Configuración",
        href: "/gestion/configuracion",
        icon: Settings,
        permission: "settings.read",
        status: "ready",
      },
    ],
  },
];
