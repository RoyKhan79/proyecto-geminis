import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ArrowDownToLine,
  BookOpen,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
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
        label: "Clases",
        href: "/gestion/clases",
        icon: CalendarDays,
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
        label: "Normativa",
        href: "/gestion/normativa",
        icon: Scale,
        permission: "legislation.read",
        status: "soon",
        phase: "Fase 6",
      },
    ],
  },
  {
    title: "Academia",
    items: [
      {
        label: "IA",
        href: "/gestion/ia",
        icon: Sparkles,
        permission: "ai.copilot",
        status: "soon",
        phase: "Fase 5",
      },
      {
        label: "Analítica",
        href: "/gestion/analitica",
        icon: BarChart3,
        permission: "analytics.read",
        status: "ready",
      },
      {
        label: "Comunicaciones",
        href: "/gestion/comunicaciones",
        icon: MessageSquare,
        permission: "communications.send",
        status: "soon",
        phase: "Fase 3",
      },
      {
        label: "Pagos",
        href: "/gestion/pagos",
        icon: CreditCard,
        permission: "payments.read",
        status: "soon",
        phase: "Fase 3",
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
